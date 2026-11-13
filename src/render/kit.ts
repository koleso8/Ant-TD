/**
 * Общие мелочи для построек по актам: детерминированный разброс, градиенты объёма, латунь,
 * деревянное древко и герб колонии. Всё рисуется кодом, свет слева сверху.
 */
import { circle, ell, fs, outline } from './art';

type Ctx = CanvasRenderingContext2D;

/** Четыре тона материала: блик, основной, тень, глубокая тень. */
export interface Tone { hi: string; base: string; lo: string; deep: string }

/** Псевдослучайное 0..1 по номеру: неровности штукатурки без генератора, кадр к кадру одинаковые. */
export function jit(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Градиент цилиндра при свете слева: светлая полоса ближе к левому краю, правый край в тени. */
export function cylGrad(ctx: Ctx, x0: number, x1: number, t: Tone): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, t.base);
  g.addColorStop(0.24, t.hi);
  g.addColorStop(0.58, t.base);
  g.addColorStop(1, t.lo);
  return g;
}

/** Латунь: тёплый блик слева сверху, тёмная бронза в тени. */
export function brass(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff0a8');
  g.addColorStop(0.35, '#e7b84a');
  g.addColorStop(1, '#8a5f1a');
  return g;
}

/** Вертикальное древко из пальмового дерева. */
export function woodPole(ctx: Ctx, px: number, bottom: number, top: number, w: number): void {
  ctx.beginPath();
  ctx.rect(px - w / 2, top, w, bottom - top);
  const g = ctx.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
  g.addColorStop(0, '#a0703e');
  g.addColorStop(0.35, '#cf9c66');
  g.addColorStop(1, '#5e3a1c');
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 0.8;
  for (let yy = top + 6; yy < bottom - 3; yy += 9) {
    ctx.beginPath();
    ctx.moveTo(px - w / 2 + 0.6, yy);
    ctx.lineTo(px + w / 2 - 0.6, yy + 1.4);
    ctx.stroke();
  }
}

/** Герб колонии: голова муравья с усиками в золотом круге. */
export function antCrest(ctx: Ctx, cx: number, cy: number, r: number, ink: string): void {
  outline(ctx, 1.4);
  circle(ctx, cx, cy, r);
  fs(ctx, brass(ctx, cx - r, cy - r, cx + r, cy + r));
  ctx.fillStyle = ink;
  circle(ctx, cx, cy + r * 0.18, r * 0.43);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.18, cy - r * 0.14); ctx.quadraticCurveTo(cx - r * 0.45, cy - r * 0.7, cx - r * 0.73, cy - r * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + r * 0.18, cy - r * 0.14); ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 0.7, cx + r * 0.73, cy - r * 0.6); ctx.stroke();
}

/** Три тона дерева: светлая грань, основной, тень. */
export interface WoodTone { hi: string; base: string; lo: string }

/** Тёсаный брус или бревно между двумя точками: контур, светлая грань со стороны света, волокна. */
export function beam(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, tone: WoodTone): void {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = uy;
  const ny = -ux;
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * hw, y1 + ny * hw);
  ctx.lineTo(x2 + nx * hw, y2 + ny * hw);
  ctx.lineTo(x2 - nx * hw, y2 - ny * hw);
  ctx.lineTo(x1 - nx * hw, y1 - ny * hw);
  ctx.closePath();
  outline(ctx, 1.8);
  fs(ctx, tone.base);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = tone.hi;
  ctx.lineWidth = Math.max(0.8, w * 0.24);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * hw * 0.5 + ux, y1 + ny * hw * 0.5 + uy);
  ctx.lineTo(x2 + nx * hw * 0.5 - ux, y2 + ny * hw * 0.5 - uy);
  ctx.stroke();
  if (len > 10) {
    ctx.strokeStyle = 'rgba(40,20,6,0.42)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * hw * 0.3 + ux * len * 0.15, y1 - ny * hw * 0.3 + uy * len * 0.15);
    ctx.lineTo(x1 - nx * hw * 0.3 + ux * len * 0.8, y1 - ny * hw * 0.3 + uy * len * 0.8);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
}
