import { rand, TAU } from '../engine/math';
import { PAL } from '../render/palette';
import { drawText } from '../render/text';
import { circle } from '../render/art';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; grav: number; ring: boolean;
}
interface FloatText {
  x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number;
}

/** Частицы и всплывающие надписи. Без текстур: кружки, кольца, текст. */
export class Effects {
  particles: Particle[] = [];
  texts: FloatText[] = [];

  clear(): void {
    this.particles.length = 0;
    this.texts.length = 0;
  }

  burst(x: number, y: number, n: number, color: string, speed: number, size: number, life: number, grav = 0): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(speed * 0.3, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.2,
        life, max: life, size: rand(size * 0.6, size * 1.3), color, grav, ring: false,
      });
    }
  }
  ring(x: number, y: number, size: number, color: string, life = 0.35): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, grav: 0, ring: true });
  }
  text(txt: string, x: number, y: number, color: string, size = 22): void {
    this.texts.push({ x, y, vy: -46, life: 0.9, max: 0.9, text: txt, color, size });
  }

  acidHit(x: number, y: number): void { this.burst(x, y, 6, PAL.acid, 90, 3, 0.35, 260); }
  explosion(x: number, y: number, r: number): void {
    this.ring(x, y, r, 'rgba(255,230,180,0.9)', 0.3);
    this.burst(x, y, 10, PAL.stoneLight, 160, 4, 0.5, 300);
    this.burst(x, y, 8, 'rgba(120,80,40,0.8)', 110, 6, 0.6, 120);
  }
  sporePuff(x: number, y: number): void { this.burst(x, y, 8, PAL.spore, 60, 4, 0.7, -40); }
  death(x: number, y: number, color: string): void {
    this.burst(x, y, 9, color, 120, 4, 0.5, 240);
    this.burst(x, y, 4, '#ffffff', 70, 2.5, 0.4, 0);
  }
  hitSpark(x: number, y: number): void { this.burst(x, y, 3, '#fff3c4', 80, 2.5, 0.25, 0); }
  build(x: number, y: number): void {
    this.ring(x, y, 40, 'rgba(255,240,200,0.8)', 0.4);
    this.burst(x, y, 10, 'rgba(160,110,60,0.9)', 120, 5, 0.6, 200);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const k = p.life / p.max;
      if (p.ring) {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        circle(ctx, p.x, p.y, p.size * (1.3 - k));
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.fillStyle = p.color;
        circle(ctx, p.x, p.y, p.size * (0.4 + 0.6 * k));
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      drawText(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, align: 'center', alpha: Math.min(1, (t.life / t.max) * 2) });
    }
  }
}
