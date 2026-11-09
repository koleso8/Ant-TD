import { angleTo, dist, lerpAngle, roll, TAU, type Vec } from '../engine/math';
import type { GameCtx } from './types';
import type { Enemy } from './enemy';
import { ANT_SOLDIER, drawAnt, drawDaze, drawHealthBar, drawShadow, pebble } from '../render/art';

const ENGAGE_R = 70;
const LEASH_R = 130;
const MOVE_SPEED = 135;
const FORMATION: readonly Vec[] = [{ x: 0, y: -18 }, { x: -16, y: 8 }, { x: 16, y: 8 }, { x: 0, y: 28 }];

/** Кому принадлежит солдат: казарме или дружине заклинания. Башня подходит без обёртки. */
export interface SoldierHost {
  x: number;
  y: number;
  /** Точка сбора: солдаты стоят вокруг неё и держат врагов рядом. */
  rally: Vec;
  rallyAngle: number;
  stats: { soldierHp?: number; soldierDmg?: readonly [number, number]; respawn?: number };
  specDef: { soldierArmor?: number } | null;
}

/** Муравей-солдат: держит врага на тропе, бьёт в ближнем бою, возрождается у своего хозяина. */
export class Soldier {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead = false;
  respawnTimer = 0;
  target: Enemy | null = null;
  blocking = false;
  attackCd = 0;
  angle: number;
  legPhase = Math.random() * TAU;
  moving = false;
  /** Оглушён «Напором» босса: не двигается и не бьёт. */
  staggerTimer = 0;

  constructor(readonly host: SoldierHost, readonly slot: number) {
    this.maxHp = this.hp = host.stats.soldierHp ?? 50;
    this.x = host.x;
    this.y = host.y;
    this.angle = host.rallyAngle + Math.PI;
  }

  get formationPos(): Vec {
    const f = FORMATION[this.slot % FORMATION.length];
    return { x: this.host.rally.x + f.x, y: this.host.rally.y + f.y };
  }

  /** После улучшения казармы: новое здоровье и полное лечение. */
  refreshStats(): void {
    const hp = this.host.stats.soldierHp ?? 50;
    this.maxHp = hp;
    this.hp = hp;
  }

  update(dt: number, g: GameCtx): void {
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.dead = false;
        this.hp = this.maxHp;
        this.x = this.host.x;
        this.y = this.host.y;
      }
      return;
    }
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.moving = false;
      return;
    }
    const rally = this.host.rally;
    if (this.target && (this.target.dead || dist(this.target.x, this.target.y, rally.x, rally.y) > LEASH_R)) {
      this.dropTarget();
    }
    if (!this.target || !this.blocking) this.acquire(g);

    const t = this.target;
    let dest: Vec;
    if (t) {
      const dx = this.x - t.x;
      const dy = this.y - t.y;
      const L = Math.hypot(dx, dy) || 1;
      const r = t.def.radius + 11;
      dest = { x: t.x + (dx / L) * r, y: t.y + (dy / L) * r };
    } else {
      dest = this.formationPos;
    }
    const d = dist(this.x, this.y, dest.x, dest.y);
    if (d > 2) {
      const k = Math.min(1, (MOVE_SPEED * dt) / d);
      this.x += (dest.x - this.x) * k;
      this.y += (dest.y - this.y) * k;
      this.moving = true;
      this.legPhase += dt * 14;
    } else {
      this.moving = false;
    }

    if (t) {
      this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, t.x, t.y), Math.min(1, dt * 12));
      if (dist(this.x, this.y, t.x, t.y) <= t.def.radius + 16) {
        this.attackCd -= dt;
        if (this.attackCd <= 0) {
          this.attackCd = 1.0;
          t.damage(roll(this.host.stats.soldierDmg ?? [3, 5]), 'physical', g, false, 0, 'barracks');
          g.effects.hitSpark(t.x, t.visualY);
        }
      }
    } else {
      this.angle = lerpAngle(this.angle, this.host.rallyAngle + Math.PI, Math.min(1, dt * 4));
    }
  }

  private acquire(g: GameCtx): void {
    const rally = this.host.rally;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.def.flying || e.blockedBy || e.unstoppable) continue;
      const d = dist(e.x, e.y, rally.x, rally.y);
      if (d <= ENGAGE_R && d < bd) { bd = d; best = e; }
    }
    if (best) {
      this.dropTarget();
      this.target = best;
      this.blocking = true;
      best.blockedBy = this;
      return;
    }
    if (this.target) return;
    for (const e of g.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, rally.x, rally.y);
      if (d <= ENGAGE_R + 20 && d < bd) { bd = d; best = e; }
    }
    if (best) {
      this.target = best;
      this.blocking = false;
    }
  }

  dropTarget(): void {
    if (this.target && this.blocking && this.target.blockedBy === this) this.target.blockedBy = null;
    this.target = null;
    this.blocking = false;
  }

  takeDamage(a: number, g: GameCtx): void {
    if (this.dead) return;
    this.hp -= a * (1 - (this.host.specDef?.soldierArmor ?? 0));
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnTimer = this.host.stats.respawn ?? 10;
      g.effects.death(this.x, this.y, '#dd6a4c');
      this.dropTarget();
    }
  }

  /** Отброшен «Напором» босса: отлетает от него и несколько секунд приходит в себя. */
  stagger(dur: number, fromX: number, fromY: number): void {
    if (this.dead) return;
    this.dropTarget();
    this.staggerTimer = Math.max(this.staggerTimer, dur);
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const L = Math.hypot(dx, dy) || 1;
    this.x += (dx / L) * 26;
    this.y += (dy / L) * 26;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    drawShadow(ctx, this.x, this.y + 4, 12, 5);
    drawAnt(ctx, this.x, this.y, this.angle, 0.8, ANT_SOLDIER, this.moving ? this.legPhase : 0, true);
    if (this.host.specDef?.soldierArmor) {
      // Броненосцы: панцирь из гальки на спине.
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      pebble(ctx, -3, 0, 8, 5.5);
      ctx.restore();
    }
    if (this.staggerTimer > 0) drawDaze(ctx, this.x, this.y - 22, performance.now() / 1000);
    if (this.hp < this.maxHp) drawHealthBar(ctx, this.x, this.y - 24, 26, this.hp / this.maxHp);
  }
}
