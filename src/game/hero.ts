import { angleTo, clamp, dist, lerpAngle, roll, TAU, type Vec } from '../engine/math';
import { HERO, LOGICAL_H, LOGICAL_W } from './config';
import type { Blocker, GameCtx } from './types';
import type { Enemy } from './enemy';
import { drawDaze, drawHealthBar, drawHero, drawShadow } from '../render/art';
import { PAL } from '../render/palette';

/**
 * Герой Жвал: выходит на поле заклинанием «Дружина» на несколько секунд, держит одного врага
 * как солдат, бьёт всех рядом и сам пускает «Жвалы». Игрок им не управляет, только призывает.
 */
export class Hero implements Blocker {
  x = 0;
  y = 0;
  /** Точка призыва: герой дерётся рядом с ней и далеко не уходит. */
  home: Vec = { x: 0, y: 0 };
  hp: number;
  maxHp: number;
  /** Пока не призван или пал, героя на поле нет. */
  dead = true;
  /** Сколько секунд осталось быть на поле. */
  leaveTimer = 0;
  target: Enemy | null = null;
  blocking = false;
  attackCd = 0;
  cooldown = 0;
  sinceHit = 10;
  angle = -Math.PI / 2;
  legPhase = 0;
  moving = false;
  spin = 0;
  /** Оглушён «Напором» босса: не двигается, не бьёт и не пускает способность. */
  staggerTimer = 0;
  readonly level: number;

  constructor(level = 1) {
    this.level = Math.max(1, Math.min(level, HERO.levels.length));
    this.maxHp = this.hp = this.stats.hp;
  }

  get stats() {
    return HERO.levels[this.level - 1];
  }
  get abilityReady(): boolean {
    return !this.dead && this.cooldown <= 0 && this.staggerTimer <= 0;
  }

  /** Призыв «Дружиной»: появляется в точке с полным здоровьем и готовой способностью. */
  summon(p: Vec, duration: number, g: GameCtx): void {
    this.dropTarget();
    this.x = p.x;
    this.y = p.y;
    this.home = { x: p.x, y: p.y };
    this.hp = this.maxHp;
    this.dead = false;
    this.leaveTimer = duration;
    this.cooldown = 0;
    this.sinceHit = 10;
    this.staggerTimer = 0;
    this.spin = 0;
    g.effects.ring(p.x, p.y, 44, 'rgba(255,240,200,0.9)', 0.5);
  }

  /** Время вышло: уходит обратно в муравейник. */
  private leave(g: GameCtx): void {
    this.dropTarget();
    this.dead = true;
    g.effects.burst(this.x, this.y, 10, 'rgba(255,240,200,0.9)', 90, 3, 0.4, 0);
  }

  useAbility(g: GameCtx): boolean {
    if (!this.abilityReady) return false;
    this.cooldown = HERO.abilityCooldown;
    this.spin = 1;
    const dmg = this.stats.abilityDmg;
    for (const e of g.enemies) {
      if (e.dead || e.def.flying) continue;
      if (dist(e.x, e.y, this.x, this.y) <= HERO.abilityRadius + e.def.radius) {
        e.damage(dmg, 'physical', g, true);
        e.stun(HERO.abilityStun);
      }
    }
    g.effects.ring(this.x, this.y, HERO.abilityRadius, 'rgba(255,220,120,0.95)', 0.45);
    g.effects.burst(this.x, this.y, 14, 'rgba(160,110,60,0.9)', 160, 5, 0.5, 200);
    g.effects.text(`${HERO.abilityName}!`, this.x, this.y - 44, PAL.uiGold, 20);
    return true;
  }

  update(dt: number, g: GameCtx): void {
    if (this.dead) return;
    this.leaveTimer -= dt;
    if (this.leaveTimer <= 0) {
      this.leave(g);
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceHit += dt;
    this.spin = Math.max(0, this.spin - dt * 2.2);
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.moving = false;
      return;
    }

    const home = this.home;
    if (this.target && (this.target.dead || dist(this.target.x, this.target.y, home.x, home.y) > HERO.leash)) {
      this.dropTarget();
    }
    const nearHome = dist(this.x, this.y, home.x, home.y) < 90;
    if (nearHome && (!this.target || !this.blocking)) this.acquire(g);
    // Сам бьёт способностью, когда рядом двое и больше наземных врагов.
    if (this.abilityReady) {
      let near = 0;
      for (const e of g.enemies) {
        if (e.dead || e.def.flying) continue;
        if (dist(e.x, e.y, this.x, this.y) <= HERO.abilityRadius + e.def.radius) near++;
      }
      if (near >= 2) this.useAbility(g);
    }

    const t = this.target;
    let dest: Vec;
    if (t) {
      const dx = this.x - t.x;
      const dy = this.y - t.y;
      const L = Math.hypot(dx, dy) || 1;
      const r = t.def.radius + 14;
      dest = { x: t.x + (dx / L) * r, y: t.y + (dy / L) * r };
    } else {
      dest = home;
    }
    const d = dist(this.x, this.y, dest.x, dest.y);
    if (d > 2) {
      const k = Math.min(1, (HERO.speed * dt) / d);
      this.x += (dest.x - this.x) * k;
      this.y += (dest.y - this.y) * k;
      if (!t) this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, dest.x, dest.y), Math.min(1, dt * 10));
      this.moving = true;
      this.legPhase += dt * 15;
    } else {
      this.moving = false;
    }

    if (t) {
      this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, t.x, t.y), Math.min(1, dt * 12));
      if (dist(this.x, this.y, t.x, t.y) <= t.def.radius + 20) {
        this.attackCd -= dt;
        if (this.attackCd <= 0) {
          this.attackCd = HERO.attackInterval;
          t.damage(roll(this.stats.dmg), 'physical', g, true);
          g.effects.hitSpark(t.x, t.visualY);
        }
      }
    } else if (this.sinceHit > HERO.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + HERO.regenPerSec * dt);
    }
  }

  private acquire(g: GameCtx): void {
    const home = this.home;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.def.flying || e.blockedBy || e.unstoppable) continue;
      const d = dist(e.x, e.y, home.x, home.y);
      if (d <= HERO.engageRadius && d < bd) { bd = d; best = e; }
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
      const d = dist(e.x, e.y, home.x, home.y);
      if (d <= HERO.engageRadius + 25 && d < bd) { bd = d; best = e; }
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
    this.sinceHit = 0;
    this.hp -= a * (1 - this.stats.armor);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      g.effects.death(this.x, this.y, '#d4573c');
      g.effects.text(`${HERO.name} пал!`, this.x, this.y - 40, PAL.uiRed, 22);
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
    this.x = clamp(this.x + (dx / L) * 30, 30, LOGICAL_W - 30);
    this.y = clamp(this.y + (dy / L) * 30, 90, LOGICAL_H - 30);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    drawShadow(ctx, this.x, this.y + 5, 16, 7);
    const spinAngle = this.spin > 0 ? (1 - this.spin) * TAU : 0;
    drawHero(ctx, this.x, this.y, this.angle + spinAngle, this.moving ? this.legPhase : 0);
    if (this.staggerTimer > 0) drawDaze(ctx, this.x, this.y - 30, performance.now() / 1000, 11);
    if (this.hp < this.maxHp) drawHealthBar(ctx, this.x, this.y - 30, 34, this.hp / this.maxHp);
    // Сколько осталось быть на поле: тонкая дуга под ногами.
    ctx.strokeStyle = 'rgba(255,217,90,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y + 6, 20, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, this.leaveTimer / HERO.summonDuration)));
    ctx.stroke();
  }
}
