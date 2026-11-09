import { PAL } from '../render/palette';

/**
 * Термитная матка и королева для спрайт-листов: вид сверху, смотрят вдоль +x, центр тела
 * в начале координат. Огромное раздутое брюшко с сегментами и пятнами, маленькая грудь с
 * ногами, рыжая голова с клещами. Королева темнее, с медовыми кольцами и короной из шипов.
 * Рисунок плотно заполняет кадр, поэтому в игре лист берётся с собственным масштабом.
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

function leg(ctx: Ctx, pts: number[], lift: number, legs: string, legsDark: string): void {
  const k = 1 - lift * 0.1;
  const [x0, y0] = pts;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x0 + (pts[i] - x0) * k, y0 + (pts[i + 1] - y0) * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? legs : legsDark;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function drawQueenHD(ctx: Ctx, phase: number, royal: boolean): void {
  const body = royal ? '#d9c7a6' : PAL.termite;
  const light = royal ? '#efe2c8' : PAL.termiteLight;
  const dark = royal ? '#a98a5e' : '#c9a86a';
  const head = royal ? '#7a3f10' : '#a85a1f';
  const headLight = royal ? '#a8652a' : '#d2823c';
  const headDark = royal ? '#4a2408' : '#6a3410';
  const legs = royal ? '#c9b48c' : '#dcbd90';
  const legsDark = royal ? '#8a7050' : '#a8845a';
  const pulse = 1 + 0.03 * Math.sin(phase);

  // Ноги у груди: короткие относительно тела, трипод-походка.
  const shapes: number[][] = [
    [36, 8, 48, 22, 54, 36, 57, 41],
    [27, 10, 28, 26, 28, 40, 31, 44],
    [18, 9, 8, 24, 0, 38, -4, 42],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const groupA = (i === 1) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 6;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.15, s[7] * side,
      ], lift, legs, legsDark);
    }
  }

  // Брюшко: огромное, дышит, с сегментами, пятнами и длинным бликом.
  const gx = -30;
  const grx = 48 * pulse;
  const gry = 25 * pulse;
  ellipsePath(ctx, gx, 0, grx, gry);
  fillOutline(ctx, shade(ctx, gx, 0, grx, light, body, dark), 5);
  ctx.save();
  ellipsePath(ctx, gx, 0, grx, gry);
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,100,40,0.42)';
  ctx.lineWidth = 2.6;
  for (let k = -0.75; k <= 0.75; k += 0.25) {
    const sx = gx + grx * k;
    ctx.beginPath();
    ctx.moveTo(sx, -gry - 1);
    ctx.quadraticCurveTo(sx - 4, 0, sx, gry + 1);
    ctx.stroke();
  }
  if (royal) {
    ctx.strokeStyle = PAL.honey;
    ctx.lineWidth = 3.4;
    for (const k of [-0.5, 0]) {
      const sx = gx + grx * k;
      ctx.beginPath();
      ctx.moveTo(sx, -gry * 0.85);
      ctx.quadraticCurveTo(sx - 4, 0, sx, gry * 0.85);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(180,130,60,0.3)';
  for (const [dx, dy] of [[-60, 6], [-42, 13], [-22, -9], [-8, 11], [-50, -10], [-30, 2]] as const) {
    ellipsePath(ctx, dx, dy, 5, 3.2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipsePath(ctx, gx - 4, -10, 26, 5);
  ctx.fill();
  ctx.restore();

  // Грудь.
  ellipsePath(ctx, 26, 0, 12, 10);
  fillOutline(ctx, shade(ctx, 26, 0, 12, light, body, dark));
  if (royal) {
    ctx.fillStyle = PAL.honey;
    ellipsePath(ctx, 26, 0, 4.5, 8.5);
    ctx.fill();
  }

  // Клещи: мощные, сходятся впереди.
  const hx = 44;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(hx + 8, 5 * side);
    ctx.quadraticCurveTo(hx + 19, 8 * side, hx + 21, 1.5 * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = '#5a3012';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  // Голова: рыжая, у королевы тёмно-бурая.
  ellipsePath(ctx, hx, 0, 12, 10.5);
  fillOutline(ctx, shade(ctx, hx, 0, 12, headLight, head, headDark));
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipsePath(ctx, hx - 2, 0, 2, 1.6);
  ctx.fill();

  if (royal) {
    // Корона: пять хитиновых шипов веером назад от затылка.
    for (let k = -2; k <= 2; k++) {
      const a = Math.PI + k * 0.42;
      const bx = hx + Math.cos(a) * 9;
      const by = Math.sin(a) * 9;
      const tx = hx + Math.cos(a) * 20;
      const ty = Math.sin(a) * 20;
      const nx = -Math.sin(a) * 3;
      const ny = Math.cos(a) * 3;
      ctx.beginPath();
      ctx.moveTo(bx + nx, by + ny);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx - nx, by - ny);
      ctx.closePath();
      fillOutline(ctx, PAL.honey, 3);
    }
  }

  // Усики-бусины и глаза-бусинки.
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side * 1.1) * 1.8;
    const x0 = hx + 7;
    const y0 = 5 * side;
    const x1 = hx + 22;
    const y1 = (16 + sway) * side;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    for (const t of [0.35, 0.65, 1]) {
      ellipsePath(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2.4, 2.4);
      ctx.fillStyle = headLight;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ellipsePath(ctx, hx + 4, 6 * side, 2.6, 2.6);
    ctx.fillStyle = OUT;
    ctx.fill();
    ellipsePath(ctx, hx + 3.3, 5.2 * side, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
