import { dist, type Vec } from '../src/engine/math';
import { SPELLS, TOWERS, type TowerKind } from '../src/game/config';
import type { World } from '../src/game/world';
import type { Plot } from '../src/game/types';

export interface PolicyOptions {
  name: string;
  /** Звать следующую волну сразу, как только поле чистое (бонус нектара). */
  early: boolean;
  /** Порядок типов башен при застройке. */
  order: TowerKind[];
  /** Сколько башен поставить подряд, прежде чем начать улучшать. */
  towersBeforeUpgrades: number;
  /** Какую долю клеток застраивать, прежде чем переключиться на улучшения. */
  buildFraction: number;
  /** Потолок числа башен: при свободной застройке клеток много, а нектара нет. */
  maxTowers: number;
  specPick: 0 | 1 | 'alt';
  /** Пользоваться заклинаниями у финального участка тропы. */
  useSpells: boolean;
}

/**
 * Игрок-робот: ставит башни на клетки с лучшим покрытием тропы, качает самые
 * полезные, бьёт заклинаниями по скоплению у финального участка. Хуже человека,
 * но стабилен, поэтому если он проходит уровень, человек пройдёт тем более.
 */
export class GreedyPolicy {
  private acc = 0;
  private coverage = new Map<Plot, number>();
  private station: Vec;
  private specToggle = 0;

  constructor(private w: World, readonly o: PolicyOptions) {
    for (const p of w.plots) this.coverage.set(p, this.score(p));
    // Заклинания летят в общий финальный участок тропы, где сходятся все враги.
    const p0 = w.paths[0];
    const st = p0.at(Math.max(0, p0.length - 150));
    this.station = { x: st.x, y: st.y };
  }

  /** Сколько пикселей троп (с шагом 8) попадает в радиус 150 от клетки: чем больше, тем дольше враги под огнём. */
  private score(p: Plot): number {
    let n = 0;
    for (const path of this.w.paths) {
      for (let d = 0; d < path.length; d += 8) {
        const q = path.at(d);
        if (dist(p.x, p.y, q.x, q.y) <= 150) n++;
      }
    }
    return n;
  }

  act(dt: number): void {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    const w = this.w;
    if (this.o.early && w.waves.canCall && w.enemies.length === 0) w.callWave();
    if (this.o.useSpells) this.spells();
    this.economy();
  }

  /** Кислота и туча по скоплению из трёх и больше (или по боссу), дружина, когда рядом двое наземных. */
  private spells(): void {
    const w = this.w;
    const st = this.station;
    for (let i = 0; i < SPELLS.length; i++) {
      if (!w.spells.ready(i)) continue;
      const def = SPELLS[i];
      const near = w.enemies.filter((e) => !e.dead && (def.id === 'acid' || !e.def.flying) && dist(e.x, e.y, st.x, st.y) <= 180);
      if (near.length === 0) continue;
      const boss = near.some((e) => e.def.boss);
      const need = def.id === 'retinue' ? 2 : 3;
      if (near.length < need && !boss) continue;
      let cx = 0;
      let cy = 0;
      for (const e of near) { cx += e.x; cy += e.y; }
      const target = def.id === 'retinue' ? st : { x: cx / near.length, y: cy / near.length };
      w.castSpell(i, target);
    }
  }

  private economy(): void {
    const w = this.w;
    const cov = (p: Plot) => this.coverage.get(p) ?? 0;
    const empties = w.plots.filter((p) => !p.tower).sort((a, b) => cov(b) - cov(a));
    const byValue = [...w.towers].sort((a, b) => cov(b.plot) - cov(a.plot));
    const nextKind = this.o.order[w.towers.length % this.o.order.length];
    const buildCost = TOWERS[nextKind].levels[0].cost;
    const upgradable = byValue.filter((t) => t.upgradeCost !== null);
    const specable = byValue.filter((t) => t.canSpecialize);
    const lowLevel = upgradable.filter((t) => t.level < 2);

    if (empties.length && w.towers.length < this.o.towersBeforeUpgrades) {
      if (w.gold >= buildCost) w.build(nextKind, empties[0]);
      return;
    }
    if (lowLevel.length) {
      const t = lowLevel[0];
      if (w.gold >= (t.upgradeCost ?? 0)) w.upgrade(t);
      return;
    }
    const cap = Math.min(this.o.maxTowers, Math.ceil(w.plots.length * this.o.buildFraction));
    const wantBuild = empties.length > 0 && w.towers.length < cap;
    if (wantBuild) {
      if (w.gold >= buildCost) w.build(nextKind, empties[0]);
      return;
    }
    if (upgradable.length) {
      const t = upgradable[0];
      if (w.gold >= (t.upgradeCost ?? 0)) w.upgrade(t);
      return;
    }
    if (specable.length) {
      const t = specable[0];
      const i = this.o.specPick === 'alt' ? this.specToggle++ % 2 : this.o.specPick;
      if (w.gold >= t.def.specs[i].cost) w.specialize(t, i);
      return;
    }
    if (empties.length && w.towers.length < this.o.maxTowers && w.gold >= buildCost) w.build(nextKind, empties[0]);
  }
}
