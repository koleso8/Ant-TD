/**
 * Сборка карт кампании: генерация троп и подбор сложности роботом.
 *   npx tsx sim/campaign.ts gen            — сгенерировать тропы всех карт (сложность 1)
 *   npx tsx sim/campaign.ts tune [id ...]  — подобрать сложность (все карты или перечисленные)
 *   npx tsx sim/campaign.ts soften id ...  — снижать сложность по 8 %, пока обе смешанные стратегии не выиграют
 *   npx tsx sim/campaign.ts soften --no-spells id ... — то же, но выиграть должен и робот без заклинаний
 *   npx tsx sim/campaign.ts check          — прогнать все карты всеми стратегиями и показать итог
 * Результат пишется в src/game/maps.gen.ts; файл коммитится, игра его только читает.
 */
import { writeFileSync } from 'node:fs';
import { Rng } from '../src/engine/rng';
import { DIFFICULTIES, type TowerKind } from '../src/game/config';
import { levelFromGen, LEVELS, type MapGen, type ThemeKey } from '../src/game/campaign';
import { GENERATED } from '../src/game/maps.gen';
import { PERKS, perksFromRanks, type Perks } from '../src/game/perks';
import { World } from '../src/game/world';
import type { BandKind, LevelDef } from '../src/game/levels';
import { GreedyPolicy, type PolicyOptions } from './policy';
import { generate, type MapSpec } from './mapgen';

declare const process: { argv: string[]; env: Record<string, string | undefined>; exit(code: number): never };

const OUT = 'src/game/maps.gen.ts';

/** Волн на карте: больше к концу акта и к дальним актам. */
function wavesFor(act: number, slot: number): number {
  return 11 + Math.floor(slot / 2) + Math.floor(act / 2);
}
function goldFor(act: number, slot: number): number {
  return 300 + 35 * act + 12 * slot;
}

const BIOMES: readonly ThemeKey[] = ['desert', 'mountains', 'jungle', 'snow', 'forest', 'asia'];
const BANDS: Partial<Record<ThemeKey, BandKind>> = { mountains: 'ravine', jungle: 'water', snow: 'ice', forest: 'water', asia: 'koi' };

/** Какие карты нужны: темы первых двух актов между ручными уровнями и девять карт каждого нового акта. */
export function specs(): MapSpec[] {
  const out: MapSpec[] = [];
  const add = (act: number, slot: number, theme: ThemeKey, o: Partial<MapSpec> = {}): void => {
    out.push({ id: `a${act}s${slot}`, act, slot, theme, paths: 1, blobs: 2, waves: wavesFor(act, slot), gold: goldFor(act, slot), ...o });
  };
  add(0, 2, 'meadow');
  add(0, 3, 'roots', { oak: true });
  add(0, 4, 'meadow', { paths: 2 });
  add(0, 5, 'night', { paths: 2, stump: true });
  add(0, 6, 'roots', { paths: 2, oak: true });
  add(0, 7, 'meadow', { paths: 2 });
  add(1, 2, 'stream', { band: { row: 4, kind: 'water' } });
  add(1, 3, 'cave', { paths: 2 });
  add(1, 4, 'mound', { paths: 2, wall: true });
  add(1, 5, 'stream', { paths: 2, band: { row: 3, kind: 'water' } });
  add(1, 6, 'cave', { paths: 2 });
  add(1, 7, 'mound', { paths: 2, wall: true });
  BIOMES.forEach((biome, i) => {
    const act = i + 2;
    for (let slot = 0; slot < 9; slot++) {
      const paths = slot < 3 ? 1 : slot < 6 ? (slot === 3 ? 1 : 2) : slot === 8 && act >= 4 ? 3 : 2;
      const kind = BANDS[biome];
      const band = kind && slot % 3 === 1 ? { row: (act + Math.floor(slot / 3)) % 2 === 0 ? 3 : 4, kind } : undefined;
      add(act, slot, biome, { paths, band, blobs: biome === 'desert' ? 3 : 2 });
    }
  });
  return out;
}

function fmt(m: MapGen): string {
  const pts = (a: ReadonlyArray<readonly [number, number]>): string => `[${a.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`;
  const parts = [
    `id: '${m.id}'`, `act: ${m.act}`, `slot: ${m.slot}`, `theme: '${m.theme}'`, `seed: ${m.seed}`,
    `paths: [${m.paths.map(pts).join(', ')}]`, `anthill: [${m.anthill[0]}, ${m.anthill[1]}]`,
  ];
  if (m.band !== undefined) parts.push(`band: ${m.band}`, `bandKind: '${m.bandKind}'`);
  if (m.wall !== undefined) parts.push(`wall: ${m.wall}`);
  if (m.stump) parts.push(`stump: [${m.stump[0]}, ${m.stump[1]}]`);
  if (m.blobs) parts.push(`blobs: [${m.blobs.map(([x, y, r]) => `[${x}, ${y}, ${r}]`).join(', ')}]`);
  parts.push(`waves: ${m.waves}`, `diff: ${m.diff}`, `gold: ${m.gold}`);
  return `  { ${parts.join(', ')} },`;
}

function write(maps: readonly MapGen[]): void {
  const body = [
    '// Сгенерировано sim/campaign.ts: тропы, препятствия и сложность карт. Руками не править — перегенерировать.',
    "import type { MapGen } from './campaign';",
    '',
    'export const GENERATED: readonly MapGen[] = [',
    ...maps.map(fmt),
    '];',
    '',
  ].join('\n');
  writeFileSync(OUT, body);
}

// ───────────── подбор сложности ─────────────

/** Перки, которые к этой карте скорее всего уже куплены: по две звезды за каждую пройденную карту. */
function perksAt(globalIndex: number): Perks {
  let stars = Math.min(20, globalIndex * 2);
  const ranks: Record<string, number> = {};
  const order = ['bounty', 'startGold', 'acidDmg', 'soldierHp', 'spore', 'catapultDmg', 'hero', 'lives'];
  while (stars > 0) {
    let bought = false;
    for (const id of order) {
      const def = PERKS.find((p) => p.id === id)!;
      if ((ranks[id] ?? 0) < def.maxRank && stars >= def.cost) {
        ranks[id] = (ranks[id] ?? 0) + 1;
        stars -= def.cost;
        bought = true;
      }
    }
    if (!bought) break;
  }
  return perksFromRanks(ranks);
}

const MIX: TowerKind[] = ['acid', 'barracks', 'acid', 'spore', 'catapult', 'acid', 'barracks', 'spore'];
const TUNE_POLICIES: PolicyOptions[] = [
  { name: 'mix-early', early: true, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: true },
  { name: 'mix-patient', early: false, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: true },
];
const CHECK_POLICIES: PolicyOptions[] = [
  ...TUNE_POLICIES,
  { name: 'upgrader', early: true, order: MIX, towersBeforeUpgrades: 4, buildFraction: 0.45, maxTowers: 9, specPick: 'alt', useSpells: true },
  { name: 'acid-heavy', early: true, order: ['acid', 'acid', 'barracks', 'acid', 'spore', 'acid', 'catapult'], towersBeforeUpgrades: 6, buildFraction: 0.6, maxTowers: 12, specPick: 0, useSpells: true },
  { name: 'no-spells', early: true, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: false },
];

function play(level: LevelDef, perks: Perks, pol: PolicyOptions, seed: number): number {
  const rng = new Rng(seed);
  Math.random = () => rng.next();
  const w = new World(level, perks, DIFFICULTIES[1]);
  const policy = new GreedyPolicy(w, pol);
  const dt = 1 / 60;
  while (w.state === 'playing' && w.time < 3000) {
    policy.act(dt);
    w.step(dt);
  }
  return w.state === 'won' ? w.lives : -1;
}

/** Средний остаток личинок у робота; поражение считается как −4, чтобы подбор от него уходил. */
function meanLives(m: MapGen, diff: number, pols: PolicyOptions[], seeds: number): number {
  const level = levelFromGen({ ...m, diff });
  const perks = perksAt(LEVELS.findIndex((l) => l.id === m.id));
  let sum = 0;
  let n = 0;
  for (const pol of pols) {
    for (let s = 1; s <= seeds; s++) {
      const lives = play(level, perks, pol, 1000 + s * 7919);
      sum += lives < 0 ? -4 : lives;
      n++;
    }
  }
  return sum / n;
}

/** Сколько личинок должно остаться у робота: в начале акта много, к финалу акта меньше. */
function targetLives(slot: number): number {
  return 15 - slot * 0.75;
}

function tune(m: MapGen): MapGen {
  const target = targetLives(m.slot);
  let lo = 0.3;
  let hi = 8;
  let best = m.diff;
  for (let i = 0; i < 9; i++) {
    const mid = Math.sqrt(lo * hi);
    const lives = meanLives(m, mid, TUNE_POLICIES, 2);
    if (lives > target) lo = mid;
    else hi = mid;
    best = Math.sqrt(lo * hi);
  }
  return { ...m, diff: Math.round(best * 100) / 100 };
}

const mode = process.argv[2] ?? 'check';
if (mode === 'gen') {
  const maps = specs().map((s) => {
    const m = generate(s);
    console.log(`${m.id} ${m.theme} троп ${m.paths.length} ${m.band !== undefined ? 'полоса ' : ''}${m.blobs ? `препятствий ${m.blobs.length}` : ''}`);
    return m;
  });
  write(maps);
  console.log(`записано ${maps.length} карт в ${OUT}`);
} else if (mode === 'tune') {
  // Файл переписывается после каждой карты: долгий подбор можно прервать, не потеряв посчитанное.
  const only = new Set(process.argv.slice(3));
  const maps = [...GENERATED];
  maps.forEach((m, i) => {
    if (only.size && !only.has(m.id)) return;
    const t = tune(m);
    maps[i] = t;
    if (!process.env.NOWRITE) write(maps);
    console.log(`${t.id}: сложность ${t.diff}, у робота ${meanLives(t, t.diff, TUNE_POLICIES, 2).toFixed(1)} личинок (цель ${targetLives(t.slot)})`);
  });
} else if (mode === 'soften') {
  // Подбор целится в среднее и иногда оставляет одно поражение; тут добиваемся побед на тех же зёрнах, что и в check.
  // С --no-spells карта должна проходиться и без заклинаний: так ослаблен первый акт, где новичок ими ещё не пользуется.
  const args = process.argv.slice(3);
  const pols = args.includes('--no-spells') ? [...TUNE_POLICIES, CHECK_POLICIES.find((p) => p.name === 'no-spells')!] : TUNE_POLICIES;
  const only = new Set(args.filter((a) => !a.startsWith('--')));
  const maps = [...GENERATED];
  maps.forEach((m, i) => {
    if (!only.has(m.id)) return;
    const perks = perksAt(LEVELS.findIndex((l) => l.id === m.id));
    let diff = m.diff;
    for (let k = 0; k < 10; k++) {
      const level = levelFromGen({ ...m, diff });
      const lost = pols.some((pol) => [1, 2].some((s) => play(level, perks, pol, 1000 + s * 7919) < 0));
      if (!lost) break;
      diff = Math.round(diff * 0.92 * 100) / 100;
    }
    maps[i] = { ...m, diff };
    if (!process.env.NOWRITE) write(maps);
    console.log(`${m.id}: сложность ${diff} (было ${m.diff})`);
  });
} else {
  // Без списка — все сгенерированные карты; в списке можно назвать и ручные уровни (oak-roots и т.п.).
  const only = new Set(process.argv.slice(3));
  for (const [index, level] of LEVELS.entries()) {
    const m = GENERATED.find((g) => g.id === level.id);
    if (only.size ? !only.has(level.id) : !m) continue;
    const perks = perksAt(index);
    const res = CHECK_POLICIES.map((pol) => {
      const r = [1, 2].map((s) => play(level, perks, pol, 1000 + s * 7919));
      return `${pol.name} ${r.map((x) => (x < 0 ? '✗' : x)).join('/')}`;
    });
    console.log(`${level.id} (${m ? `${m.theme}, сложн. ${m.diff}` : 'ручной'}): ${res.join('  ')}`);
  }
}
