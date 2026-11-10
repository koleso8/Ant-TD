import { roundRect, type Vec } from '../engine/math';
import type { TowerKind } from './config';
import type { Game } from './game';
import type { Enemy } from './enemy';
import type { Tower } from './tower';
import { t, type UiKey } from './i18n';
import { PAL } from '../render/palette';
import { drawText, wrapText } from '../render/text';
import { circle, drawHero } from '../render/art';

/**
 * Куда показывает подсказка: центр и размер. ui — координаты экрана (кнопка интерфейса),
 * иначе мира (клетка, башня, враги). Круг радиуса r или прямоугольник w×h.
 */
export interface Target { x: number; y: number; r?: number; w?: number; h?: number; ui: boolean }

interface Step {
  /** Текст подсказки; может зависеть от того, что игрок уже выбрал. Без текста шаг просто ждёт момента. */
  text?: (g: Game) => UiKey;
  target?: (g: Game) => Target | null;
  /** Время стоит, пока шаг не выполнен: так заклинание не промахнётся по убежавшей толпе. */
  freeze?: boolean;
  /** Сколько нектара нужно на задание: если не хватает, королева подкидывает. */
  need?: (g: Game) => number;
  enter?: (g: Game) => void;
  /** Шаг выполнен; time — сколько секунд он идёт. */
  done: (g: Game, time: number) => boolean;
  /** Шаг-приглашение позвать волну: только в нём волна не удерживается. */
  wave?: boolean;
}

/** Клетки, на которые указывают задания: углы поворотов и место под тропой (см. TUTORIAL в levels.ts). */
const CELL_ACID: Vec = { x: 360, y: 360 };
const CELL_BARRACKS: Vec = { x: 600, y: 600 };
const CELL_SPORE: Vec = { x: 760, y: 440 };

const towerOf = (g: Game, kind: TowerKind): Tower | null => g.towers.find((tw) => tw.kind === kind) ?? null;
const has = (g: Game, kind: TowerKind): boolean => !!towerOf(g, kind);
const plotSelected = (g: Game): boolean => g.selected?.type === 'plot';
const towerSelected = (g: Game, kind: TowerKind): boolean => g.selected?.type === 'tower' && g.selected.tower.kind === kind;
const alive = (g: Game): Enemy[] => g.enemies.filter((e) => !e.dead);
const cleared = (g: Game, n: number): boolean => g.world.clearedWaves >= n;

function cell(g: Game, c: Vec): Target | null {
  const p = g.world.plotAt(c.x, c.y);
  return p && !p.tower ? { x: p.x, y: p.y, w: 76, h: 76, ui: false } : null;
}

function anchor(g: Game, name: string): Target | null {
  const a = g.ui.anchor(name);
  return a ? { ...a, ui: true } : null;
}

/** Середина толпы наземных и летающих врагов; без врагов — середина тропы. */
function crowd(g: Game): Target {
  const list = alive(g);
  if (!list.length) {
    const p = g.world.paths[0].at(g.world.paths[0].length * 0.55);
    return { x: p.x, y: p.y, r: 70, ui: false };
  }
  let x = 0;
  let y = 0;
  for (const e of list) { x += e.x; y += e.y; }
  return { x: x / list.length, y: y / list.length, r: 70, ui: false };
}

/** Точка тропы чуть впереди жука: туда и встанет дружина. */
function aheadOfBeetle(g: Game): Target {
  const b = alive(g).find((e) => e.def.kind === 'beetle');
  const path = b ? b.path : g.world.paths[0];
  const p = path.at(b ? b.progress + 110 : path.length * 0.6);
  return { x: p.x, y: p.y, r: 46, ui: false };
}

/** Строительное задание: клетка подсвечена, после тапа по ней стрелка переходит на нужную башню в меню. */
function buildStep(kind: TowerKind, c: Vec, cellKey: UiKey, pickKey: UiKey): Step {
  return {
    text: (g) => (plotSelected(g) ? pickKey : cellKey),
    target: (g) => (plotSelected(g) ? anchor(g, `build:${kind}`) : cell(g, c)),
    need: () => ({ acid: 70, barracks: 90, spore: 100, catapult: 120 })[kind],
    done: (g) => has(g, kind),
  };
}

function waveStep(n: number, key: UiKey): Step {
  return { text: () => key, target: (g) => anchor(g, 'wave'), wave: true, done: (g) => g.waves.index >= n };
}

const STEPS: readonly Step[] = [
  buildStep('acid', CELL_ACID, 'tut.acidCell', 'tut.acidPick'),
  waveStep(1, 'tut.wave1'),
  { text: () => 'tut.loot', target: (g) => anchor(g, 'hud:gold'), done: (g) => cleared(g, 1) },
  buildStep('barracks', CELL_BARRACKS, 'tut.barracksCell', 'tut.barracksPick'),
  waveStep(2, 'tut.wave2'),
  {
    text: () => 'tut.hold',
    target: (g) => {
      const b = towerOf(g, 'barracks');
      return b ? { x: b.rally.x, y: b.rally.y, r: 46, ui: false } : null;
    },
    done: (g) => cleared(g, 2),
  },
  {
    text: (g) => (towerSelected(g, 'acid') ? 'tut.upgradePick' : 'tut.upgradeTower'),
    target: (g) => {
      if (towerSelected(g, 'acid')) return anchor(g, 'upgrade');
      const tw = towerOf(g, 'acid');
      return tw ? { x: tw.x, y: tw.y - 10, r: 48, ui: false } : null;
    },
    need: (g) => towerOf(g, 'acid')?.upgradeCost ?? 0,
    // Стрелков продали — учить нечему, идём дальше.
    done: (g) => {
      const tw = towerOf(g, 'acid');
      return !tw || tw.level >= 2;
    },
  },
  buildStep('spore', CELL_SPORE, 'tut.sporeCell', 'tut.sporePick'),
  waveStep(3, 'tut.wave3'),
  {
    text: () => 'tut.air',
    target: (g) => {
      const f = alive(g).find((e) => e.def.flying);
      return f ? { x: f.x, y: f.visualY, r: 34, ui: false } : null;
    },
    done: (g) => cleared(g, 3),
  },
  waveStep(4, 'tut.wave4'),
  // Ждём, пока толпа зайдёт на поле подальше от края, и тогда останавливаем время.
  {
    done: (g) => {
      const list = alive(g);
      const mid = list.reduce((s, e) => s + e.progress, 0) / Math.max(1, list.length);
      return (list.length >= 6 && mid >= 220) || (!g.waves.spawning && list.length >= 2 && mid >= 160) || cleared(g, 4);
    },
  },
  {
    text: (g) => (g.armedSpell === 0 ? 'tut.rainTap' : 'tut.rainArm'),
    target: (g) => (g.armedSpell === 0 ? crowd(g) : anchor(g, 'spell0')),
    freeze: true,
    enter: (g) => { g.world.spells.cooldowns[0] = 0; },
    done: (g) => g.world.spells.cooldowns[0] > 0,
  },
  { text: () => 'tut.spells', target: (g) => anchor(g, 'spell0'), done: (g, time) => cleared(g, 4) && time > 4 },
  waveStep(5, 'tut.wave5'),
  { text: () => 'tut.speed', target: (g) => anchor(g, 'speed'), done: (g, time) => g.speed === 2 || time > 6 },
  // Ждём, пока жук отойдёт от края; если его уже нет, всё равно покажем дружину.
  {
    done: (g) => {
      const b = alive(g).find((e) => e.def.kind === 'beetle');
      if (b) return b.progress > b.path.length * 0.3;
      return !g.waves.queue.some((s) => s.kind === 'beetle');
    },
  },
  {
    text: (g) => (g.armedSpell === 1 ? 'tut.heroTap' : 'tut.heroArm'),
    target: (g) => (g.armedSpell === 1 ? aheadOfBeetle(g) : anchor(g, 'spell1')),
    freeze: true,
    enter: (g) => { g.world.spells.cooldowns[1] = 0; },
    done: (g) => g.world.spells.cooldowns[1] > 0,
  },
  { text: () => 'tut.finish', done: () => false },
];

/**
 * Обучение на учебном плацу: воевода Жвал ведёт по шагам. Каждый шаг ждёт действия игрока,
 * а следующая волна стоит, пока не дойдёт до шага-приглашения: отстать нельзя, ошибиться тоже.
 */
export class Tutorial {
  private index = 0;
  private time = 0;
  private entered = false;

  private get step(): Step | null {
    return STEPS[this.index] ?? null;
  }

  /** Время стоит: мир не двигается, но игрок может нажимать кнопки и тапать по полю. */
  get frozen(): boolean {
    return !!this.step?.freeze && this.entered;
  }

  update(dt: number, g: Game): void {
    // За один кадр можно пройти несколько шагов подряд, если они уже выполнены.
    for (let guard = 0; guard < 4; guard++) {
      const st = this.step;
      if (!st) {
        g.world.waves.hold = false;
        return;
      }
      if (!this.entered) {
        this.entered = true;
        this.time = 0;
        st.enter?.(g);
      }
      g.world.waves.hold = !st.wave;
      if (st.done(g, this.time)) {
        this.index++;
        this.entered = false;
        continue;
      }
      // Нектар подкидываем, только пока задание не выполнено: иначе подарок прилетал бы сразу после постройки.
      const need = st.need?.(g) ?? 0;
      if (need > g.gold) {
        const n = need - g.gold;
        g.world.addGold(n);
        const o = g.ui.hud();
        g.uiFx.text(t('fx.gift', n), 160 + o.l, 112 + o.t, PAL.uiGold, 18);
      }
      break;
    }
    this.time += dt;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game): void {
    const st = this.step;
    if (!st || !this.entered || !st.text) return;
    const tg = st.target?.(g) ?? null;
    if (tg) this.drawPointer(ctx, g, tg);
    this.drawCoach(ctx, g, t(st.text(g)));
  }

  /** Пульсирующая рамка вокруг цели и прыгающая стрелка к ней. */
  private drawPointer(ctx: CanvasRenderingContext2D, g: Game, tg: Target): void {
    const z = tg.ui ? 1 : g.camera.zoom;
    const c = tg.ui ? { x: tg.x, y: tg.y } : g.camera.toScreen(tg.x, tg.y);
    const pulse = Math.sin(g.clock * 5);
    const pad = 6 + 3 * pulse;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255,217,90,${(0.75 + 0.25 * pulse).toFixed(2)})`;
    ctx.shadowColor = 'rgba(255,217,90,0.8)';
    ctx.shadowBlur = 12;
    let top: number;
    let bottom: number;
    if (tg.w !== undefined && tg.h !== undefined) {
      const w = tg.w * z + pad * 2;
      const h = tg.h * z + pad * 2;
      roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, 14);
      ctx.stroke();
      top = c.y - h / 2;
      bottom = c.y + h / 2;
    } else {
      const r = (tg.r ?? 40) * z + pad;
      circle(ctx, c.x, c.y, r);
      ctx.stroke();
      top = c.y - r;
      bottom = c.y + r;
    }
    ctx.restore();
    // Стрелка сверху вниз; у верхнего края экрана — снизу вверх.
    const bounce = 6 * Math.abs(Math.sin(g.clock * 4));
    const up = top - 70 < g.ui.hud().t + 10;
    const tipY = up ? bottom + 8 + bounce : top - 8 - bounce;
    const dir = up ? 1 : -1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(c.x, tipY);
    ctx.lineTo(c.x - 16, tipY + dir * 20);
    ctx.lineTo(c.x - 7, tipY + dir * 20);
    ctx.lineTo(c.x - 7, tipY + dir * 44);
    ctx.lineTo(c.x + 7, tipY + dir * 44);
    ctx.lineTo(c.x + 7, tipY + dir * 20);
    ctx.lineTo(c.x + 16, tipY + dir * 20);
    ctx.closePath();
    ctx.fillStyle = PAL.uiGold;
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  /** Панель воеводы под верхней панелью: портрет и текст задания. */
  private drawCoach(ctx: CanvasRenderingContext2D, g: Game, text: string): void {
    const o = g.ui.hud();
    const w = 720;
    const x = 640 - w / 2;
    const y = o.t + 82;
    // Крупнее остального интерфейса: на телефоне подсказка должна читаться с первого взгляда.
    const lines = wrapText(ctx, text, w - 108, 19, 'bold');
    const h = Math.max(70, 22 + lines.length * 25);
    ctx.save();
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = 'rgba(43,22,8,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,90,0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Портрет Жвала в зелёном круге.
    const px = x + 44;
    const py = y + h / 2;
    circle(ctx, px, py, 27);
    ctx.fillStyle = '#3c8a2b';
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.save();
    circle(ctx, px, py, 25);
    ctx.clip();
    ctx.translate(px, py + 6);
    ctx.scale(0.85, 0.85);
    drawHero(ctx, 0, 0, -Math.PI / 2, 0);
    ctx.restore();
    lines.forEach((ln, i) => {
      drawText(ctx, ln, x + 88, y + h / 2 + (i - (lines.length - 1) / 2) * 25, { size: 19, color: PAL.uiLight, strokeWidth: 3 });
    });
    ctx.restore();
  }
}
