/**
 * Генератор карт кампании: тропы по клеткам 16×9, препятствия и оценка карты.
 * Тропа — случайное блуждание отрезками по 2–6 клеток с поворотами на 90°: между её витками и
 * между разными тропами всегда остаётся хотя бы ряд клеток под башни; вода, лёд и ущелья
 * пересекаются только поперёк; дополнительные тропы вливаются в первую задолго до муравейника.
 * Из многих попыток берётся карта с лучшей оценкой: больше клеток у тропы и мест, откуда
 * башня бьёт по двум участкам сразу.
 */
import { Rng } from '../src/engine/rng';
import { CELL } from '../src/game/config';
import type { BandKind } from '../src/game/levels';
import { levelFromGen, type MapGen, type ThemeKey } from '../src/game/campaign';
import { Path, snapWaypoints } from '../src/game/path';
import { World } from '../src/game/world';

interface Cell { c: number; r: number }
type Dir = 0 | 1 | 2 | 3;
const DC = [1, 0, -1, 0] as const;
const DR = [0, 1, 0, -1] as const;
const px = (c: number): number => 40 + 80 * c;
const py = (r: number): number => 40 + 80 * r;
const key = (c: number, r: number): string => `${c},${r}`;
const rev = (d: Dir): Dir => ((d + 2) % 4) as Dir;

/** Что нужно от карты: тема, сколько троп, особенности местности. */
export interface MapSpec {
  id: string;
  act: number;
  slot: number;
  theme: ThemeKey;
  paths: number;
  band?: { row: number; kind: BandKind };
  /** Стена термитника вдоль верха: тропы выходят из нор у её подножия. */
  wall?: boolean;
  /** Гнилой пень в верхнем углу: первая тропа выходит из его норы. */
  stump?: boolean;
  /** Павший дуб вдоль верха: сверху тропы не заходят. */
  oak?: boolean;
  /** Сколько препятствий попробовать поставить. */
  blobs: number;
  waves: number;
  gold: number;
}

interface Entry {
  cell: Cell;
  dir: Dir;
  start: readonly [number, number];
}

/** Тропа в клетках: от первой клетки на карте до последней (муравейник или место слияния). */
interface Walk {
  cells: Cell[];
  start: readonly [number, number];
}

interface Ctx {
  rng: Rng;
  rowMin: number;
  rowMax: number;
  bandRow: number | null;
  /** Занятые клетки (уже проложенные тропы) и запретные (пень, норы). */
  occ: Set<string>;
  blocked: Set<string>;
  /** Муравейник и клетки вокруг: сюда заходит только последний отрезок главной тропы. */
  zone: Set<string>;
}

function inBounds(ctx: Ctx, c: number, r: number): boolean {
  return c >= 0 && c <= 15 && r >= ctx.rowMin && r <= ctx.rowMax;
}

/** Рядом (в том числе по диагонали) есть занятая клетка, кроме разрешённых. */
function crowded(ctx: Ctx, own: Set<string>, c: number, r: number, allow: Set<string>): boolean {
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const k = key(c + dc, r + dr);
      if (allow.has(k)) continue;
      if (ctx.occ.has(k) || own.has(k)) return true;
    }
  }
  return false;
}

/**
 * Отрезок от последней клетки на len клеток в направлении d. Каждая новая клетка свободна, не рядом с
 * чужими тропами и с дальними участками своей (две последние клетки своей тропы не в счёт);
 * по полосе воды можно только идти поперёк, и останавливаться в ней нельзя.
 */
function run(ctx: Ctx, cells: Cell[], own: Set<string>, d: Dir, len: number, extraAllow: Set<string> = new Set(), finalCell?: Cell, intoZone = false): Cell[] | null {
  const out: Cell[] = [];
  let { c, r } = cells[cells.length - 1];
  for (let i = 1; i <= len; i++) {
    c += DC[d];
    r += DR[d];
    const k = key(c, r);
    const isFinal = !!finalCell && i === len && c === finalCell.c && r === finalCell.r;
    if (!isFinal) {
      if (!inBounds(ctx, c, r) || own.has(k) || ctx.occ.has(k) || ctx.blocked.has(k)) return null;
      if (!intoZone && ctx.zone.has(k)) return null;
    }
    if (ctx.bandRow !== null && r === ctx.bandRow && (d === 0 || d === 2)) return null;
    const chain = [...cells, ...out];
    const allow = new Set(extraAllow);
    for (const q of chain.slice(-2)) allow.add(key(q.c, q.r));
    if (!isFinal && crowded(ctx, own, c, r, allow)) return null;
    out.push({ c, r });
  }
  const last = out[out.length - 1];
  if (ctx.bandRow !== null && last.r === ctx.bandRow && !finalCell) return null;
  return out;
}

function dirTo(a: Cell, b: Cell): Dir | null {
  if (a.r === b.r && a.c !== b.c) return b.c > a.c ? 0 : 2;
  if (a.c === b.c && a.r !== b.r) return b.r > a.r ? 1 : 3;
  return null;
}

/** Попробовать закончить тропу у цели прямо или углом; последний отрезок не короче двух клеток. */
function finish(ctx: Ctx, cells: Cell[], own: Set<string>, dir: Dir, target: Cell, allow: Set<string>, needDir?: (d: Dir) => boolean, intoZone = false): Cell[] | null {
  const p = cells[cells.length - 1];
  const tries: Cell[][] = [];
  const straight = dirTo(p, target);
  if (straight !== null) tries.push([target]);
  if (p.c !== target.c && p.r !== target.r) {
    const k1 = { c: target.c, r: p.r };
    const k2 = { c: p.c, r: target.r };
    if (ctx.rng.next() < 0.5) tries.push([k1, target], [k2, target]);
    else tries.push([k2, target], [k1, target]);
  }
  for (const legs of tries) {
    let chain = [...cells];
    const ownTry = new Set(own);
    let d = dir;
    let ok = true;
    for (let li = 0; li < legs.length && ok; li++) {
      const from = chain[chain.length - 1];
      const to = legs[li];
      const nd = dirTo(from, to);
      if (nd === null || nd === rev(d)) { ok = false; break; }
      const len = Math.abs(to.c - from.c) + Math.abs(to.r - from.r);
      const lastLeg = li === legs.length - 1;
      if (len < 2) { ok = false; break; }
      if (lastLeg && needDir && !needDir(nd)) { ok = false; break; }
      if (!lastLeg && ctx.bandRow !== null && to.r === ctx.bandRow) { ok = false; break; }
      const seg = run(ctx, chain, ownTry, nd, len, lastLeg ? allow : new Set(), lastLeg ? target : undefined, lastLeg && intoZone);
      if (!seg) { ok = false; break; }
      for (const q of seg) ownTry.add(key(q.c, q.r));
      chain = [...chain, ...seg];
      d = nd;
    }
    if (ok) return chain;
  }
  return null;
}

/**
 * Блуждание от входа к цели: отрезки по 2–6 клеток, повороты направо или налево, с середины пути
 * чаще в сторону цели. Цель — муравейник или клетка чужой тропы, куда эта тропа вливается.
 */
function walk(ctx: Ctx, entry: Entry, target: Cell, minCells: number, maxCells: number, allow: Set<string>, needDir?: (d: Dir) => boolean, intoZone = false): Walk | null {
  const { rng } = ctx;
  const first = entry.cell;
  if (!inBounds(ctx, first.c, first.r) || ctx.occ.has(key(first.c, first.r)) || ctx.blocked.has(key(first.c, first.r))) return null;
  if (crowded(ctx, new Set(), first.c, first.r, new Set())) return null;
  let cells: Cell[] = [first];
  const own = new Set([key(first.c, first.r)]);
  let dir = entry.dir;
  for (let seg = 0; seg < 26; seg++) {
    if (cells.length > maxCells) return null;
    if (cells.length >= minCells) {
      const done = finish(ctx, cells, own, dir, target, allow, needDir, intoZone);
      if (done) return { cells: done, start: entry.start };
    }
    const p = cells[cells.length - 1];
    let options: Dir[];
    if (seg === 0) options = [dir];
    else {
      const right = ((dir + 1) % 4) as Dir;
      const left = ((dir + 3) % 4) as Dir;
      const toward = (d: Dir): number => DC[d] * (target.c - p.c) + DR[d] * (target.r - p.r);
      const late = cells.length >= minCells * 0.6;
      const prefer = late ? (toward(right) >= toward(left) ? right : left) : (rng.next() < 0.5 ? right : left);
      options = rng.next() < (late ? 0.75 : 0.5) ? [prefer, prefer === right ? left : right] : [prefer === right ? left : right, prefer];
    }
    let moved = false;
    for (const nd of options) {
      const maxLen = seg === 0 ? rng.int(2, 5) : rng.pick([2, 3, 3, 4, 4, 5, 6]);
      for (let len = maxLen; len >= 2 && !moved; len--) {
        const seg2 = run(ctx, cells, own, nd, len);
        if (!seg2) continue;
        // Отрезок не заходит в окрестность цели раньше времени.
        if (seg2.some((q) => Math.max(Math.abs(q.c - target.c), Math.abs(q.r - target.r)) <= 1 && !(q.c === target.c && q.r === target.r))) continue;
        for (const q of seg2) own.add(key(q.c, q.r));
        cells = [...cells, ...seg2];
        dir = nd;
        moved = true;
      }
      if (moved) break;
    }
    if (!moved) return null;
  }
  return null;
}

/** Повороты тропы: клетки, где меняется направление, и последняя клетка. */
function turnsOf(cells: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = dirTo(cells[i - 1], cells[i]);
    const b = dirTo(cells[i], cells[i + 1]);
    if (a !== b) out.push(cells[i]);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

function entryAt(side: 'W' | 'E' | 'N' | 'S', i: number): Entry {
  switch (side) {
    case 'W': return { cell: { c: 0, r: i }, dir: 0, start: [-70, py(i)] };
    case 'E': return { cell: { c: 15, r: i }, dir: 2, start: [1350, py(i)] };
    case 'N': return { cell: { c: i, r: 1 }, dir: 1, start: [px(i), -70] };
    case 'S': return { cell: { c: i, r: 7 }, dir: 3, start: [px(i), 790] };
  }
}

interface Built {
  gen: MapGen;
  score: number;
}

/** Одна попытка собрать карту по спецификации; null, если тропы не сложились. */
export function attempt(spec: MapSpec, seed: number): MapGen | null {
  const rng = new Rng(seed);
  const band = spec.band ? spec.band.row : null;
  const ctx: Ctx = { rng, rowMin: spec.wall ? 2 : 1, rowMax: 7, bandRow: band, occ: new Set(), blocked: new Set(), zone: new Set() };
  // Муравейник: подальше от краёв, по другую сторону полосы от входов.
  let anth: Cell;
  const mainSide = spec.wall || spec.stump ? 'N' : rng.pick(spec.oak ? ['W', 'W', 'E', 'S'] as const : ['W', 'W', 'W', 'E', 'N', 'S'] as const);
  if (spec.wall) anth = { c: rng.int(3, 12), r: rng.int(5, 6) };
  else if (band !== null) anth = { c: rng.int(2, 13), r: rng.int(Math.min(band + 2, 6), 6) };
  else if (spec.stump) anth = { c: rng.int(6, 12), r: rng.int(4, 6) };
  else if (mainSide === 'W') anth = { c: rng.int(10, 14), r: rng.int(2, 6) };
  else if (mainSide === 'E') anth = { c: rng.int(1, 5), r: rng.int(2, 6) };
  else if (mainSide === 'N') anth = { c: rng.int(3, 12), r: rng.int(4, 6) };
  else anth = { c: rng.int(3, 12), r: rng.int(2, 3) };
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) ctx.zone.add(key(anth.c + dc, anth.r + dr));

  // Входы: у стены — норы у подножия, у пня — нора пня, иначе края карты (выше полосы воды).
  const entries: Entry[] = [];
  let stump: readonly [number, number] | undefined;
  const sideRow = (): number => (band !== null ? rng.int(1, Math.max(1, band - 1)) : rng.int(1, 6));
  if (spec.wall) {
    const cols = [rng.int(1, 4), rng.int(6, 9), rng.int(11, 14)];
    const order = rng.next() < 0.5 ? [1, 0, 2] : [1, 2, 0];
    for (let i = 0; i < spec.paths; i++) {
      const c = cols[order[i]];
      entries.push({ cell: { c, r: 2 }, dir: 1, start: [px(c), 150] });
    }
  } else {
    if (spec.stump) {
      const sc = rng.pick([1, 14]);
      stump = [px(sc) + (sc === 1 ? -20 : 20), 150];
      entries.push({ cell: { c: sc, r: 2 }, dir: 1, start: [stump[0], stump[1] + 20] });
      // Вокруг пня не застраивают и не прокладывают другие тропы.
      for (let dc = -1; dc <= 1; dc++) ctx.blocked.add(key(sc + dc, 1));
      ctx.blocked.add(key(sc + (sc === 1 ? 1 : -1), 2));
    } else {
      entries.push(entryAt(mainSide, mainSide === 'W' || mainSide === 'E' ? sideRow() : mainSide === 'S' ? rng.int(5, 10) : rng.int(2, 13)));
    }
    const used = new Set<string>([mainSide]);
    for (let i = 1; i < spec.paths; i++) {
      const sides = (band !== null ? ['W', 'E', 'N'] : spec.oak ? ['W', 'E', 'S'] : ['W', 'E', 'N', 'S']) as ('W' | 'E' | 'N' | 'S')[];
      const free = sides.filter((s) => !used.has(s));
      const side = rng.pick(free.length ? free : sides);
      used.add(side);
      entries.push(entryAt(side, side === 'W' || side === 'E' ? sideRow() : side === 'S' ? rng.int(5, 10) : rng.int(2, 13)));
    }
  }
  for (const e of entries.slice(1)) {
    if (Math.abs(e.cell.c - entries[0].cell.c) + Math.abs(e.cell.r - entries[0].cell.r) < 3) return null;
  }

  // Главная тропа к муравейнику.
  const main = walk(ctx, entries[0], anth, 16, 32, new Set(), undefined, true);
  if (!main) return null;
  const walks: { walk: Walk; joinIndex: number; host: number }[] = [{ walk: main, joinIndex: -1, host: -1 }];
  for (const q of main.cells) ctx.occ.add(key(q.c, q.r));
  // Остальные вливаются в уже проложенные: в середину тропы, на прямом участке.
  for (let i = 1; i < entries.length; i++) {
    let ok = false;
    for (let t = 0; t < 40 && !ok; t++) {
      const hostIdx = rng.int(0, walks.length - 1);
      const host = walks[hostIdx].walk.cells;
      const lo = Math.max(3, Math.floor(host.length * 0.25));
      const hi = Math.floor(host.length * 0.7);
      if (hi <= lo) continue;
      const j = rng.int(lo, hi);
      const prev = host[j - 1];
      const at = host[j];
      const next = host[j + 1];
      if (!next || dirTo(prev, at) !== dirTo(at, next)) continue;
      const hd = dirTo(at, next)!;
      const allow = new Set([key(prev.c, prev.r), key(at.c, at.r), key(next.c, next.r)]);
      const perpendicular = (d: Dir): boolean => d % 2 !== hd % 2;
      const w = walk(ctx, entries[i], at, 6, 22, allow, perpendicular);
      if (!w) continue;
      walks.push({ walk: w, joinIndex: j, host: hostIdx });
      for (const q of w.cells) ctx.occ.add(key(q.c, q.r));
      ok = true;
    }
    if (!ok) return null;
  }

  // Точки троп: старт, повороты, у влившихся — дальше по хозяйской тропе до муравейника.
  const fullCells = (idx: number): Cell[] => {
    const w = walks[idx];
    if (w.host < 0) return w.walk.cells;
    const hostCells = fullCells(w.host);
    const hostOwn = walks[w.host].walk.cells;
    const joinCell = hostOwn[w.joinIndex];
    const pos = hostCells.findIndex((q) => q.c === joinCell.c && q.r === joinCell.r);
    return [...w.walk.cells.slice(0, -1), ...hostCells.slice(pos)];
  };
  const paths: [number, number][][] = walks.map((w, idx) => {
    const cells = fullCells(idx);
    const pts: [number, number][] = [[w.walk.start[0], w.walk.start[1]]];
    for (const q of turnsOf(cells)) pts.push([px(q.c), py(q.r)]);
    return pts;
  });
  const anthill: [number, number] = [px(anth.c), py(anth.r) - 8];

  // Препятствия: подальше от троп, муравейника и друг друга.
  const blobs: [number, number, number][] = [];
  const pathCells = [...ctx.occ].map((k) => k.split(',').map(Number));
  for (let t = 0; t < 60 && blobs.length < spec.blobs; t++) {
    const c = rng.int(1, 14);
    const r = rng.int(spec.wall ? 3 : 1, 7);
    const far = pathCells.every(([pc, pr]) => Math.max(Math.abs(pc - c), Math.abs(pr - r)) >= 3);
    const fromAnth = Math.max(Math.abs(anth.c - c), Math.abs(anth.r - r)) >= 3;
    const apart = blobs.every(([bx, by]) => Math.hypot(bx - px(c), by - py(r)) > 240);
    const offBand = band === null || Math.abs(r - band) >= 2;
    const offStump = !stump || Math.hypot(stump[0] - px(c), stump[1] - py(r)) > 220;
    if (far && fromAnth && apart && offBand && offStump) {
      blobs.push([px(c) + rng.int(-16, 16), py(r) + rng.int(-12, 12), rng.int(44, 66)]);
    }
  }

  return {
    id: spec.id,
    act: spec.act,
    slot: spec.slot,
    theme: spec.theme,
    seed,
    paths,
    anthill,
    band: band !== null ? band * 80 : undefined,
    bandKind: spec.band?.kind,
    wall: spec.wall ? 140 : undefined,
    stump,
    blobs: blobs.length ? blobs : undefined,
    waves: spec.waves,
    diff: 1,
    gold: spec.gold,
  };
}

/**
 * Оценка карты: клетки у тропы, места, откуда башня достаёт до двух далёких участков, повороты.
 * null — карта не годится (мало клеток, тропа слишком короткая или длинная).
 */
export function rate(gen: MapGen): number | null {
  const lv = levelFromGen(gen);
  const paths = lv.paths.map((w) => new Path(snapWaypoints(w, CELL)));
  const plots = World.makeGrid(lv, paths);
  const main = paths[0];
  if (main.length < 1250 || main.length > 2500) return null;
  let near = 0;
  let double = 0;
  // Мёртвые зоны: клетки, откуда ни одна башня не достанет до тропы. Их много — карта пустая и скучная.
  let dead = 0;
  for (const p of plots) {
    if (paths.every((path) => path.nearest(p.x, p.y).dist > 230)) dead++;
  }
  for (const p of plots) {
    let hit = false;
    let twice = false;
    for (const path of paths) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let d = 0; d < path.length; d += 16) {
        const q = path.at(d);
        if (Math.hypot(q.x - p.x, q.y - p.y) <= 140) {
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
      }
      if (hi >= lo) hit = true;
      if (hi - lo >= 360) twice = true;
    }
    if (hit) near++;
    if (twice) double++;
  }
  if (near < 18 || plots.length < 30) return null;
  const turns = gen.paths[0].length - 2;
  if (turns < 3) return null;
  // Самый длинный прямой участок: длинные прямые скучны.
  let longest = 0;
  for (const pts of gen.paths) {
    for (let i = 1; i < pts.length; i++) longest = Math.max(longest, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  // Размах: тропа должна обходить всё поле, а не жаться к одному краю.
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const pts of gen.paths) for (const [x, y] of pts) {
    if (x < 0 || x > 1280 || y < 0 || y > 720) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const spread = ((x1 - x0) * (y1 - y0)) / (1120 * 560);
  const ideal = gen.paths.length > 1 ? 1700 : 2050;
  return near * 0.6 + double * 2.2 + Math.min(turns, 12) * 1.5 + spread * 12 - dead * 0.5
    - Math.max(0, longest - 560) / 40 - Math.abs(main.length - ideal) / 200;
}

/** Карта, отражённая слева направо: входы, повороты, муравейник, пень и препятствия. */
function mirror(m: MapGen): MapGen {
  const fx = (x: number): number => 1280 - x;
  return {
    ...m,
    paths: m.paths.map((p) => p.map(([x, y]) => [fx(x), y] as [number, number])),
    anthill: [fx(m.anthill[0]), m.anthill[1]],
    stump: m.stump ? [fx(m.stump[0]), m.stump[1]] : undefined,
    blobs: m.blobs?.map(([x, y, r]) => [fx(x), y, r] as [number, number, number]),
  };
}

/**
 * Карта из многих попыток. Победитель выбирается случайно из шести лучших, а каждая вторая карта
 * отражена слева направо: иначе у карт с одинаковыми условиями сходилась одна и та же лучшая форма.
 * Зерно выводится из id карты, так что результат повторяем.
 */
export function generate(spec: MapSpec, tries = spec.paths > 2 ? 40000 : 12000): MapGen {
  let base = 0;
  for (const ch of spec.id) base = (base * 31 + ch.charCodeAt(0)) >>> 0;
  const pool: Built[] = [];
  for (let t = 0; t < tries && pool.length < 40; t++) {
    const gen = attempt(spec, (base + t * 104729) >>> 0);
    if (!gen) continue;
    const score = rate(gen);
    if (score === null) continue;
    pool.push({ gen, score });
  }
  if (!pool.length) throw new Error(`карта ${spec.id} не сложилась`);
  pool.sort((a, b) => b.score - a.score);
  const pickRng = new Rng(base ^ 0x5bd1e995);
  const chosen = pool[pickRng.int(0, Math.min(5, pool.length - 1))].gen;
  return (spec.act + spec.slot) % 2 === 1 ? mirror(chosen) : chosen;
}
