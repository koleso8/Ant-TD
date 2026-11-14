/**
 * Горный кузнечик для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Зелёные голова и переднеспинка-седло, охристые надкрылья с жилками сходятся к острию сзади,
 * большие задние ноги: толстое зелёное бедро «ёлочкой» уходит назад-вбок к колену, от колена
 * вперёд-вбок красная голень с шипами. Длинные тонкие усы, крупные тёмные глаза по бокам головы.
 * В прыжке игра рисует тот же лист выше над тенью и чуть крупнее.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#6fa63a';
const LIGHT = '#bfe274';
const DARK = '#2f5216';
const WING = '#b89a56';
const WING_LIGHT = '#e6d096';
const WING_DARK = '#6e5626';
const SHIN = '#c8452f';

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
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  return g;
}

/** Тонкая ходильная нога из трёх отрезков. */
function leg(ctx: Ctx, pts: readonly number[], lift: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? LIGHT : '#4f8028';
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

/** Задняя нога: голень (красная, с шипами) под бедром, бедро — толстая капля с «ёлочкой». */
function hindLeg(ctx: Ctx, side: number, swing: number): void {
  const hip = [0, 9 * side] as const;
  const knee = [-34 + swing * 0.6, 25 * side] as const;
  const foot = [-14 + swing, 38 * side] as const;
  // Голень и лапка.
  ctx.beginPath();
  ctx.moveTo(knee[0], knee[1]);
  ctx.lineTo(foot[0], foot[1]);
  ctx.lineTo(foot[0] + 7, foot[1] + 2 * side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.4;
  ctx.stroke();
  ctx.strokeStyle = SHIN;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  for (const t of [0.3, 0.55, 0.8]) {
    const px = knee[0] + (foot[0] - knee[0]) * t;
    const py = knee[1] + (foot[1] - knee[1]) * t;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 3.5, py + 2.5 * side);
    ctx.stroke();
  }
  // Бедро: широкое у тела, сужается к колену.
  const dx = knee[0] - hip[0];
  const dy = knee[1] - hip[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  ctx.beginPath();
  ctx.moveTo(hip[0] + nx * 7, hip[1] + ny * 7);
  ctx.quadraticCurveTo(hip[0] + dx * 0.5 + nx * 7.5, hip[1] + dy * 0.5 + ny * 7.5, knee[0] + nx * 2.4, knee[1] + ny * 2.4);
  ctx.quadraticCurveTo(knee[0] + ux * 4, knee[1] + uy * 4, knee[0] - nx * 2.4, knee[1] - ny * 2.4);
  ctx.quadraticCurveTo(hip[0] + dx * 0.5 - nx * 7.5, hip[1] + dy * 0.5 - ny * 7.5, hip[0] - nx * 7, hip[1] - ny * 7);
  ctx.closePath();
  const g = ctx.createLinearGradient(hip[0] - nx * 7, hip[1] - ny * 7, hip[0] + nx * 7, hip[1] + ny * 7);
  g.addColorStop(0, side > 0 ? DARK : LIGHT);
  g.addColorStop(0.5, BODY);
  g.addColorStop(1, side > 0 ? LIGHT : DARK);
  fillOutline(ctx, g, 4);
  // «Ёлочка» на бедре.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,60,14,0.55)';
  ctx.lineWidth = 1.4;
  for (const t of [0.2, 0.36, 0.52, 0.68]) {
    const cx = hip[0] + dx * t;
    const cy = hip[1] + dy * t;
    ctx.beginPath();
    ctx.moveTo(cx + nx * 7 - ux * 3, cy + ny * 7 - uy * 3);
    ctx.lineTo(cx + ux * 3, cy + uy * 3);
    ctx.lineTo(cx - nx * 7 - ux * 3, cy - ny * 7 - uy * 3);
    ctx.stroke();
  }
  ctx.restore();
  // Колено.
  ellipsePath(ctx, knee[0], knee[1], 3.4, 3.4);
  fillOutline(ctx, DARK, 2.4);
}

export function drawGrasshopperHD(ctx: Ctx, phase: number): void {
  // Передние и средние ноги.
  const shapes: number[][] = [
    [24, 9, 32, 22, 40, 27, 45, 28],
    [12, 10, 12, 25, 6, 33, 2, 35],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 2; i++) {
      const groupA = (i === 0) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 5;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [s[0], s[1] * side, s[2] + swing * 0.5, s[3] * side, s[4] + swing, s[5] * side, s[6] + swing * 1.1, s[7] * side], lift);
    }
    hindLeg(ctx, side, Math.sin(phase + (side > 0 ? Math.PI : 0)) * 4);
  }

  // Усы: длинные, тонкие, расходятся вперёд.
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2.5;
    ctx.beginPath();
    ctx.moveTo(42, 4 * side);
    ctx.quadraticCurveTo(58, (9 + sw) * side, 74, (20 + sw) * side);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Надкрылья: от седла назад, сходятся к острию; жилки вдоль и редкие поперечные.
  const wing = (): void => {
    ctx.beginPath();
    ctx.moveTo(20, -10.5);
    ctx.quadraticCurveTo(-18, -13, -56, 0);
    ctx.quadraticCurveTo(-18, 13, 20, 10.5);
    ctx.closePath();
  };
  wing();
  const wg = ctx.createLinearGradient(0, -13, 0, 13);
  wg.addColorStop(0, WING_LIGHT);
  wg.addColorStop(0.45, WING);
  wg.addColorStop(1, WING_DARK);
  fillOutline(ctx, wg, 4.6);
  ctx.save();
  wing();
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,58,20,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-56, 0);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const f of [-0.55, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(18, f * 10);
    ctx.quadraticCurveTo(-16, f * 12.5, -50, f * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(80,58,20,0.4)';
  for (const [x, a, b] of [[6, -9, -1], [-8, 1, 9], [-20, -8, -1], [-32, 1, 6], [-42, -4, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, a);
    ctx.lineTo(x - 3, b);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,245,210,0.3)';
  ellipsePath(ctx, -8, -6.5, 20, 2.4, 0.06);
  ctx.fill();
  ctx.restore();

  // Переднеспинка-седло.
  ctx.beginPath();
  ctx.moveTo(14, -11.5);
  ctx.quadraticCurveTo(24, -13, 32, -9.5);
  ctx.quadraticCurveTo(34, 0, 32, 9.5);
  ctx.quadraticCurveTo(24, 13, 14, 11.5);
  ctx.quadraticCurveTo(11, 0, 14, -11.5);
  ctx.closePath();
  fillOutline(ctx, shade(ctx, 22, -6, 16, LIGHT, BODY, DARK), 4.6);
  ctx.strokeStyle = 'rgba(30,60,14,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(20, -12);
  ctx.quadraticCurveTo(18, 0, 20, 12);
  ctx.stroke();

  // Голова и глаза.
  ellipsePath(ctx, 38, 0, 9, 10);
  fillOutline(ctx, shade(ctx, 36, -4, 11, LIGHT, BODY, DARK), 4.4);
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 39, 8.2 * side, 4, 3.2, side * 0.35);
    fillOutline(ctx, '#2a1c12', 1.8);
    ellipsePath(ctx, 38, 7.4 * side - 0.6, 1.2, 0.9);
    ctx.fillStyle = 'rgba(255,240,210,0.75)';
    ctx.fill();
  }
}
