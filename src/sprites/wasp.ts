import { PAL } from '../render/palette';

/**
 * Оса и шершень для спрайт-листов: вид сверху, смотрят вдоль +x, центр тела в начале координат.
 * Летающие: кадры листа — фазы взмаха крыльев (фаза 0..2π на один цикл), ноги поджаты.
 * Полосатое брюшко с жалом, тёмная грудь, крупные глаза, коленчатые усики, две пары
 * полупрозрачных крыльев с призрачным следом предыдущего положения.
 */
type Ctx = CanvasRenderingContext2D;

export interface WaspLook {
  body: string;
  light: string;
  dark: string;
  stripes: string;
  eye: string;
  /** Масштаб головы и груди: шершень массивнее. */
  bulk: number;
}

export const WASP: WaspLook = { body: PAL.wasp, light: PAL.waspLight, dark: PAL.waspDark, stripes: '#2b2b2b', eye: '#6a4a2a', bulk: 1 };
export const HORNET: WaspLook = { body: '#d98a1f', light: '#f5c06a', dark: '#3a2410', stripes: '#4a2a10', eye: '#3a1e08', bulk: 1.15 };

const OUT = PAL.outline;
const TAU = Math.PI * 2;

function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function fillOutline(ctx: Ctx, fill: string | CanvasGradient, w = 4.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.stroke();
}

function shade(ctx: Ctx, x: number, y: number, r: number, light: string, mid: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r * 1.08);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  return g;
}

/** Пара крыльев одной стороны: переднее и заднее, с прожилками. */
function wingPair(ctx: Ctx, side: number, angle: number, alpha: number): void {
  ctx.save();
  ctx.translate(4, 6 * side);
  ctx.rotate(side * angle);
  ctx.globalAlpha = alpha;
  // Заднее крыло: короче и ближе к телу.
  ellipsePath(ctx, -14, 4 * side, 16, 6, 0);
  ctx.fillStyle = 'rgba(214,232,255,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Переднее крыло: длинное.
  ellipsePath(ctx, -20, -2 * side, 24, 7.5, 0);
  ctx.fillStyle = 'rgba(224,238,255,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Прожилки.
  ctx.strokeStyle = 'rgba(120,140,170,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -1 * side);
  ctx.lineTo(-42, -3 * side);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-34, -8 * side);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-36, 4 * side);
  ctx.stroke();
  ctx.restore();
}

export function drawWaspHD(ctx: Ctx, phase: number, look: WaspLook = WASP): void {
  const b = look.bulk;
  // Крылья качаются вперёд-назад; призрачный след предыдущего положения даёт жужжание.
  const base = 0.55;
  const swing = Math.sin(phase) * 0.35;
  for (let side = -1; side <= 1; side += 2) {
    wingPair(ctx, side, base + Math.sin(phase - 1.2) * 0.35, 0.35);
    wingPair(ctx, side, base + swing, 1);
  }

  // Поджатые ноги: короткие, тёмные, слегка покачиваются.
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const lx = 8 - i * 8;
      const sway = Math.sin(phase + i) * 1.2;
      ctx.beginPath();
      ctx.moveTo(lx, 9 * side);
      ctx.lineTo(lx - 6 + sway, 19 * side);
      ctx.lineTo(lx - 2 + sway, 27 * side);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = look.dark;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  // Жало.
  ctx.beginPath();
  ctx.moveTo(-48, -4);
  ctx.lineTo(-62, 0);
  ctx.lineTo(-48, 4);
  ctx.closePath();
  fillOutline(ctx, OUT, 3);

  // Брюшко с полосами.
  const gx = -24;
  ellipsePath(ctx, gx, 0, 27, 16);
  fillOutline(ctx, shade(ctx, gx, 0, 27, look.light, look.body, look.body));
  ctx.save();
  ellipsePath(ctx, gx, 0, 27, 16);
  ctx.clip();
  ctx.fillStyle = look.stripes;
  for (const sx of [-40, -28, -16]) {
    ctx.beginPath();
    ctx.moveTo(sx + 2, -18);
    ctx.quadraticCurveTo(sx - 4, 0, sx + 2, 18);
    ctx.lineTo(sx + 8, 18);
    ctx.quadraticCurveTo(sx + 2, 0, sx + 8, -18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipsePath(ctx, gx + 2, -6, 12, 3.5);
  ctx.fill();
  ctx.restore();

  // Талия.
  ellipsePath(ctx, -3, 0, 5, 4);
  fillOutline(ctx, look.dark, 3.5);

  // Грудь: тёмная, с серым бликом.
  ellipsePath(ctx, 4, 0, 14 * b, 12.5 * b);
  fillOutline(ctx, shade(ctx, 4, 0, 14 * b, '#5a5a5a', look.dark, look.dark));
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ellipsePath(ctx, 2, -5 * b, 6 * b, 3 * b);
  ctx.fill();

  // Голова: тёмная, с крупными глазами.
  const hx = 24 * b;
  ellipsePath(ctx, hx, 0, 11.5 * b, 11 * b);
  fillOutline(ctx, shade(ctx, hx, 0, 11.5 * b, '#4a4a4a', look.dark, look.dark));
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, hx + 2 * b, 6.5 * b * side, 4.6 * b, 6.2 * b, side * 0.25);
    ctx.fillStyle = look.eye;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipsePath(ctx, hx + 3.4 * b, 4.6 * b * side, 1.5 * b, 1.9 * b);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }
  // Жвалы.
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(hx + 9 * b, 3.5 * b * side);
    ctx.quadraticCurveTo(hx + 15 * b, 4 * b * side, hx + 16 * b, 1 * b * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  // Коленчатые усики.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.2;
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side) * 1.5;
    ctx.beginPath();
    ctx.moveTo(hx + 6 * b, 5 * b * side);
    ctx.lineTo(hx + 20 * b, (14 + sway) * side);
    ctx.lineTo(hx + 30 * b, (12 + sway) * side);
    ctx.stroke();
  }
}
