import { PAL } from '../render/palette';

/**
 * Стрекоза для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Летающая: кадры листа — взмахи двух пар длинных прозрачных крыльев с призрачным следом.
 * Длинное сегментированное бирюзовое брюшко, зелёная грудь, огромные салатовые глаза.
 */
type Ctx = CanvasRenderingContext2D;

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

/** Одно крыло: длинное узкое, с прожилками и тёмным пятном у кончика. */
function wing(ctx: Ctx, rootX: number, side: number, angle: number, len: number, wid: number, alpha: number): void {
  ctx.save();
  ctx.translate(rootX, 5 * side);
  ctx.rotate(side * angle);
  ctx.globalAlpha = alpha;
  ellipsePath(ctx, -len / 2, 0, len / 2, wid);
  ctx.fillStyle = 'rgba(220,245,255,0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,150,170,0.5)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-len + 4, 0);
  for (let k = 1; k <= 4; k++) {
    const x = (-len * k) / 5;
    ctx.moveTo(x, -wid * 0.85);
    ctx.lineTo(x + 3, wid * 0.85);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,70,90,0.7)';
  ellipsePath(ctx, -len + 8, -wid * 0.45 * side, 3.5, 1.6);
  ctx.fill();
  ctx.restore();
}

export function drawDragonflyHD(ctx: Ctx, phase: number): void {
  // Крылья: передняя пара ближе к голове, задняя шире разведена; след предыдущего положения.
  const sw = Math.sin(phase) * 0.3;
  const prev = Math.sin(phase - 1.2) * 0.3;
  for (let side = -1; side <= 1; side += 2) {
    wing(ctx, 6, side, 0.95 + prev, 58, 7, 0.35);
    wing(ctx, -6, side, 1.3 + prev, 54, 6.5, 0.35);
    wing(ctx, 6, side, 0.95 + sw, 58, 7, 1);
    wing(ctx, -6, side, 1.3 + sw, 54, 6.5, 1);
  }

  // Поджатые ноги.
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const lx = 16 - i * 7;
      ctx.beginPath();
      ctx.moveTo(lx, 7 * side);
      ctx.lineTo(lx + 4, 15 * side);
      ctx.lineTo(lx + 2, 21 * side);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = '#2a6f55';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Брюшко: длинное, из сегментов, к хвосту тоньше, на конце пара церок.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-74, -2);
  ctx.lineTo(-82, -5);
  ctx.moveTo(-74, 2);
  ctx.lineTo(-82, 5);
  ctx.stroke();
  for (let i = 8; i >= 0; i--) {
    const x = -14 - i * 7.5;
    const ry = 6.5 - i * 0.35;
    ellipsePath(ctx, x, 0, 4.6, ry);
    fillOutline(ctx, shade(ctx, x, 0, 6, i % 2 === 0 ? '#7fd9e6' : '#5fc0d2', i % 2 === 0 ? '#3fb9c9' : '#2a8ea0', '#1f6f7e'), 3.6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipsePath(ctx, -40, -2.5, 28, 1.6);
  ctx.fill();

  // Грудь: зелёная, с косыми светлыми полосами.
  ellipsePath(ctx, 4, 0, 15, 12);
  fillOutline(ctx, shade(ctx, 4, 0, 15, '#5fb995', '#2f8f6f', '#1f6650'));
  ctx.save();
  ellipsePath(ctx, 4, 0, 15, 12);
  ctx.clip();
  ctx.strokeStyle = 'rgba(190,240,170,0.55)';
  ctx.lineWidth = 2.4;
  for (const dx of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(dx - 4, -12);
    ctx.lineTo(dx + 4, 12);
    ctx.stroke();
  }
  ctx.restore();

  // Голова: почти вся из двух огромных глаз.
  ellipsePath(ctx, 24, 0, 11, 10);
  fillOutline(ctx, '#2a6f55', 4.2);
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, 27, 6.5 * side, 7.5, 6.8, side * 0.3);
    fillOutline(ctx, shade(ctx, 27, 6.5 * side, 7.5, '#d3f7a4', '#9be36a', '#5d9e3a'), 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ellipsePath(ctx, 30, 6.5 * side, 2.4, 2.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ellipsePath(ctx, 28.5, 4.8 * side, 1.4, 1.4);
    ctx.fill();
  }
  // Короткие усики-щетинки.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(33, 1.5 * side);
    ctx.lineTo(40, 5 * side);
    ctx.stroke();
  }
}
