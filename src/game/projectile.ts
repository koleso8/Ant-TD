import { angleTo, dist, lerp } from '../engine/math';
import type { Enemy } from './enemy';
import type { GameCtx } from './types';
import { drawAcidGlob, drawSeed, drawShadow } from '../render/art';

export interface Projectile {
  dead: boolean;
  update(dt: number, g: GameCtx): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

/** Плевок кислотой: самонаводится на цель. */
export class AcidGlob implements Projectile {
  dead = false;
  private tx: number;
  private ty: number;
  private angle = 0;

  constructor(
    public x: number, public y: number, private target: Enemy, private dmg: number,
    private pierce = 0, private speed = 520,
  ) {
    this.tx = target.x;
    this.ty = target.visualY;
  }

  update(dt: number, g: GameCtx): void {
    if (!this.target.dead) {
      this.tx = this.target.x;
      this.ty = this.target.visualY;
    }
    const d = dist(this.x, this.y, this.tx, this.ty);
    const step = this.speed * dt;
    this.angle = angleTo(this.x, this.y, this.tx, this.ty);
    if (d <= step + 6) {
      this.x = this.tx;
      this.y = this.ty;
      this.dead = true;
      if (!this.target.dead) this.target.damage(this.dmg, 'physical', g, false, this.pierce, 'acid');
      g.effects.acidHit(this.x, this.y);
      return;
    }
    this.x += Math.cos(this.angle) * step;
    this.y += Math.sin(this.angle) * step;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawAcidGlob(ctx, this.x, this.y, this.angle);
  }
}

/** Семя (или валун) катапульты: летит по дуге в точку и бьёт по площади. */
export class Seed implements Projectile {
  dead = false;
  x: number;
  y: number;
  private t = 0;

  constructor(
    private x0: number, private y0: number,
    private x1: number, private y1: number,
    private flight: number, private dmg: number, private splash: number,
    private stun = 0, private boulder = false,
  ) {
    this.x = x0;
    this.y = y0;
  }

  update(dt: number, g: GameCtx): void {
    this.t += dt / this.flight;
    if (this.t >= 1) {
      this.dead = true;
      this.explode(g);
      return;
    }
    const h = 4 * this.t * (1 - this.t) * (this.boulder ? 150 : 130);
    this.x = lerp(this.x0, this.x1, this.t);
    this.y = lerp(this.y0, this.y1, this.t) - h;
  }

  private explode(g: GameCtx): void {
    g.effects.explosion(this.x1, this.y1, this.splash);
    for (const e of g.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = dist(e.x, e.y, this.x1, this.y1);
      if (d <= this.splash + e.def.radius) {
        const k = 1 - 0.45 * Math.min(1, d / this.splash);
        e.damage(this.dmg * k, 'physical', g, false, 0, 'catapult');
        if (this.stun > 0) e.stun(this.stun);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const gx = lerp(this.x0, this.x1, this.t);
    const gy = lerp(this.y0, this.y1, this.t);
    drawShadow(ctx, gx, gy, this.boulder ? 9 : 6, this.boulder ? 4.5 : 3, 0.25);
    drawSeed(ctx, this.x, this.y, this.boulder ? 11 : 7, this.boulder);
  }
}
