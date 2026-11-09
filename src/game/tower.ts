import { angleTo, dist, lerpAngle, rand, roll, type Vec } from '../engine/math';
import { SELL_RATIO, TOWERS, type SpecDef, type TowerDef, type TowerKind, type TowerLevel } from './config';
import type { GameCtx, Plot } from './types';
import type { Path } from './path';
import type { Enemy } from './enemy';
import { Soldier } from './soldier';
import { AcidGlob, Seed } from './projectile';
import { applyPerks, NO_PERKS, type Perks } from './perks';
import { drawScaffold, drawTowerAcid, drawTowerBarracks, drawTowerCatapult, drawTowerSpore } from '../render/art';
import type { Construction } from './construction';

/** Башни рисуются крупнее своих площадок: так читаются на телефоне. */
export const TOWER_SCALE = 1.2;
export const MAX_BASE_LEVEL = 3;

export class Tower {
  readonly def: TowerDef;
  level = 1;
  /** Индекс специализации после 3-го уровня, иначе null. */
  spec: number | null = null;
  x: number;
  y: number;
  cooldown = 0.3;
  angle = -Math.PI / 2;
  fireTime = -10;
  spent: number;
  soldiers: Soldier[] = [];
  rally: Vec;
  rallyAngle: number;
  private statsCache: { key: string; value: TowerLevel } | null = null;
  /** Текущая стройка (постройка или улучшение): пока идёт, башня не стреляет. */
  construction: Construction | null = null;
  buildLeft = 0;
  buildTotal = 1;
  /** Хоть раз достроена: солдаты казармы выходят только после первой стройки. */
  built = false;

  constructor(readonly kind: TowerKind, readonly plot: Plot, paths: readonly Path[], readonly perks: Perks = NO_PERKS) {
    this.def = TOWERS[kind];
    this.x = plot.x;
    this.y = plot.y;
    this.spent = this.def.levels[0].cost;
    // Точка сбора солдат: ближайшая тропа.
    let best = paths[0];
    let bn = best.nearest(this.x, this.y);
    for (const p of paths) {
      const n = p.nearest(this.x, this.y);
      if (n.dist < bn.dist) { best = p; bn = n; }
    }
    this.rally = { x: bn.x, y: bn.y };
    this.rallyAngle = best.at(bn.d).angle;
    if (kind === 'barracks') this.syncSoldiers();
  }

  get specDef(): SpecDef | null {
    return this.spec === null ? null : this.def.specs[this.spec];
  }
  get stats(): TowerLevel {
    const key = `${this.level}/${this.spec ?? '-'}`;
    if (this.statsCache && this.statsCache.key === key) return this.statsCache.value;
    const s = this.specDef;
    const base = s ? s.stats : this.def.levels[this.level - 1];
    const value = applyPerks(this.kind, base, this.perks);
    this.statsCache = { key, value };
    return value;
  }
  get upgradeCost(): number | null {
    return !this.building && this.level < MAX_BASE_LEVEL ? this.def.levels[this.level].cost : null;
  }
  get canSpecialize(): boolean {
    return !this.building && this.level === MAX_BASE_LEVEL && this.spec === null;
  }
  get building(): boolean {
    return this.buildLeft > 0;
  }
  /** Насколько башня выросла из земли: 0, пока строители бегут, 1 — готова. */
  get progress(): number {
    if (!this.building) return 1;
    return this.construction ? this.construction.progress : 1 - this.buildLeft / this.buildTotal;
  }

  /** Начать стройку: башня молчит, пока рабочие не закончат. */
  beginBuild(c: Construction): void {
    this.construction = c;
    this.buildLeft = this.buildTotal = c.duration;
  }
  get sellValue(): number {
    return Math.floor(this.spent * SELL_RATIO);
  }
  /** Вариант отрисовки: 0 базовый, 1 и 2 специализации. */
  get variant(): number {
    return this.spec === null ? 0 : this.spec + 1;
  }

  upgrade(): void {
    const c = this.upgradeCost;
    if (c === null) return;
    this.level++;
    this.spent += c;
    for (const s of this.soldiers) s.refreshStats();
  }

  specialize(i: number): void {
    if (!this.canSpecialize) return;
    this.spec = i;
    this.level = MAX_BASE_LEVEL + 1;
    this.spent += this.def.specs[i].cost;
    this.syncSoldiers();
    for (const s of this.soldiers) s.refreshStats();
  }

  private syncSoldiers(): void {
    if (this.kind !== 'barracks') return;
    const want = this.specDef?.soldiers ?? 3;
    while (this.soldiers.length < want) this.soldiers.push(new Soldier(this, this.soldiers.length));
  }

  destroy(): void {
    for (const s of this.soldiers) s.dropTarget();
    this.soldiers = [];
  }

  update(dt: number, g: GameCtx): void {
    if (this.buildLeft > 0) {
      this.buildLeft -= dt;
      if (this.buildLeft <= 0) {
        this.buildLeft = 0;
        this.built = true;
        g.sound('done');
        g.effects.build(this.x, this.y);
      } else if (this.kind !== 'barracks' || !this.built) {
        return;
      }
    }
    this.cooldown -= dt;
    const spec = this.specDef;
    switch (this.kind) {
      case 'acid': {
        const targets = this.pickMany(g, spec?.multishot ?? 1);
        if (targets.length === 0) break;
        const t = targets[0];
        const muzzleY = this.y - 34 * TOWER_SCALE;
        this.angle = lerpAngle(this.angle, angleTo(this.x, muzzleY, t.x, t.visualY), Math.min(1, dt * 10));
        if (this.cooldown <= 0) {
          this.cooldown = this.stats.interval ?? 1;
          this.fireTime = g.time;
          g.sound('shotAcid');
          for (const target of targets) {
            const a = angleTo(this.x, muzzleY, target.x, target.visualY);
            const mx = this.x + Math.cos(a) * 10;
            const my = muzzleY + Math.sin(a) * 10;
            g.projectiles.push(new AcidGlob(mx, my, target, roll(this.stats.damage ?? [1, 1]), spec?.armorPierce ?? 0));
          }
        }
        break;
      }
      case 'catapult': {
        const t = this.pick(g);
        if (!t) break;
        this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, t.x, t.y), Math.min(1, dt * 6));
        if (this.cooldown <= 0) {
          this.cooldown = this.stats.interval ?? 2;
          this.fireTime = g.time;
          g.sound('shotCatapult');
          const T = this.stats.flightTime ?? 0.9;
          const lead = t.blockedBy || t.stunTimer > 0 ? 0 : t.speed * T;
          const p = t.path.at(t.progress + lead);
          const n = spec?.volley ?? 1;
          for (let i = 0; i < n; i++) {
            const ox = n > 1 ? rand(-36, 36) : 0;
            const oy = n > 1 ? rand(-26, 26) : 0;
            g.projectiles.push(new Seed(
              this.x, this.y - 20, p.x + ox, p.y + oy, T,
              roll(this.stats.damage ?? [1, 1]), this.stats.splash ?? 50,
              spec?.stunOnHit ?? 0, !!spec?.stunOnHit,
            ));
          }
        }
        break;
      }
      case 'spore': {
        if (this.cooldown > 0) break;
        const t = this.pick(g);
        if (!t) break;
        const s = this.stats;
        this.cooldown = s.interval ?? 2.5;
        this.fireTime = g.time;
        g.clouds.push({
          x: t.x, y: t.y, r: s.cloudRadius ?? 70, life: s.cloudDur ?? 3, max: s.cloudDur ?? 3,
          slow: s.slow ?? 0.4, dps: s.poisonDps ?? 5, poisonDur: s.poisonDur ?? 2.5,
          stun: spec?.cloudStun ?? 0, stunned: new Set(), variant: this.variant,
        });
        g.effects.sporePuff(this.x, this.y - 30);
        g.sound('spore');
        break;
      }
      case 'barracks':
        for (const s of this.soldiers) s.update(dt, g);
        break;
    }
  }

  /** Цель по общему режиму (g.targetMode): по умолчанию самый продвинувшийся по тропе враг в радиусе. */
  private pick(g: GameCtx): Enemy | null {
    return this.pickMany(g, 1)[0] ?? null;
  }

  private pickMany(g: GameCtx, n: number): Enemy[] {
    const r = this.stats.range;
    const inRange: Enemy[] = [];
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.def.flying ? !this.def.hitsAir : !this.def.hitsGround) continue;
      if (dist(this.x, this.y, e.x, e.y) <= r + e.def.radius) inRange.push(e);
    }
    inRange.sort((a, b) => {
      switch (g.targetMode) {
        case 'last': return a.progress - b.progress;
        case 'near': return dist(this.x, this.y, a.x, a.y) - dist(this.x, this.y, b.x, b.y);
        case 'strong': return b.hp - a.hp;
        case 'weak': return a.hp - b.hp;
        default: return b.progress - a.progress;
      }
    });
    return inRange.slice(0, n);
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.building) {
      // Стройплощадка, а башня поднимается из земли по мере работы.
      const p = this.progress;
      drawScaffold(ctx, this.x, this.y, p);
      if (p > 0) {
        const h = 170;
        const bottom = this.y + 40 * TOWER_SCALE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x - 90, bottom - h * p, 180, h * p);
        ctx.clip();
        this.drawScaled(ctx, time);
        ctx.restore();
      }
      return;
    }
    this.drawScaled(ctx, time);
  }

  private drawScaled(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(TOWER_SCALE, TOWER_SCALE);
    ctx.translate(-this.x, -this.y);
    this.drawSprite(ctx, time);
    ctx.restore();
  }

  private drawSprite(ctx: CanvasRenderingContext2D, time: number): void {
    const v = this.variant;
    switch (this.kind) {
      case 'acid': {
        const k = Math.max(0, 1 - (time - this.fireTime) / 0.25);
        drawTowerAcid(ctx, this.x, this.y, this.level, this.angle, k, v);
        break;
      }
      case 'barracks':
        drawTowerBarracks(ctx, this.x, this.y, this.level, v);
        break;
      case 'catapult': {
        const t = time - this.fireTime;
        let p = 0;
        if (t < 0.15) p = t / 0.15;
        else if (t < 1.2) p = Math.max(0, 1 - (t - 0.15) / 1.05);
        drawTowerCatapult(ctx, this.x, this.y, this.level, this.angle, p, v);
        break;
      }
      case 'spore':
        drawTowerSpore(ctx, this.x, this.y, this.level, time, v);
        break;
    }
  }
}
