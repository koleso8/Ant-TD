import { PAL } from '../render/palette';

/**
 * Жуки для спрайт-листов: вид сверху, смотрят вдоль +x, центр тела в начале координат.
 * Широкие надкрылья со швом и бликами, тёмная переднеспинка, маленькая голова.
 * Щитоносец синий с булавовидными усиками, носорог бурый с рогом и шипом на спине.
 */
type Ctx = CanvasRenderingContext2D;

export interface BeetleLook {
  body: string;
  light: string;
  dark: string;
  /** Рог вперёд и шип на переднеспинке вместо усиков. */
  rhino: boolean;
}

export const BEETLE: BeetleLook = { body: PAL.beetle, light: PAL.beetleLight, dark: PAL.beetleDark, rhino: false };
export const RHINO: BeetleLook = { body: PAL.rhino, light: PAL.rhinoLight, dark: PAL.rhinoDark, rhino: true };

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

function leg(ctx: Ctx, pts: number[], lift: number, look: BeetleLook): void {
  const k = 1 - lift * 0.1;
  const [x0, y0] = pts;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x0 + (pts[i] - x0) * k, y0 + (pts[i + 1] - y0) * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7.5;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? look.light : look.dark;
  ctx.lineWidth = 3.4;
  ctx.stroke();
}

/** Короткие толстые ноги, трипод-походка. */
function legs(ctx: Ctx, phase: number, look: BeetleLook): void {
  const shapes: number[][] = [
    [22, 12, 38, 28, 44, 42, 46, 46],
    [8, 14, 8, 32, 6, 44, 6, 48],
    [-10, 12, -24, 28, -34, 40, -38, 44],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const groupA = (i === 1) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 8;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.15, s[7] * side,
      ], lift, look);
    }
  }
}

export function drawBeetleHD(ctx: Ctx, phase: number, look: BeetleLook = BEETLE): void {
  const bob = Math.sin(phase * 2) * 0.6;
  legs(ctx, phase, look);

  // Надкрылья: широкие, со швом посередине, бликами и точками.
  const ex = -10;
  ellipsePath(ctx, ex, bob, 42, 30);
  fillOutline(ctx, shade(ctx, ex, bob, 42, look.light, look.body, look.dark), 5);
  ctx.save();
  ellipsePath(ctx, ex, bob, 42, 30);
  ctx.clip();
  ctx.strokeStyle = look.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ex + 34, bob);
  ctx.lineTo(ex - 44, bob);
  ctx.stroke();
  if (look.rhino) {
    // Продольные рёбра на надкрыльях.
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for (const dy of [-12, 12, -22, 22]) {
      ctx.beginPath();
      ctx.moveTo(ex + 26, bob + dy);
      ctx.lineTo(ex - 40, bob + dy * 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = look.dark;
    ctx.globalAlpha = 0.55;
    for (const [dx, dy] of [[8, -14], [8, 14], [-8, -20], [-8, 20], [-24, -12], [-24, 12]] as const) {
      ellipsePath(ctx, ex + dx, bob + dy, 2.6, 2.6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = look.light;
  ctx.globalAlpha = 0.6;
  ellipsePath(ctx, ex - 4, bob - 15, 16, 5, 0.18);
  ctx.fill();
  ellipsePath(ctx, ex - 4, bob + 15, 16, 5, -0.18);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Переднеспинка: тёмная, с бликом.
  ellipsePath(ctx, 26, 0, 15, 20);
  fillOutline(ctx, shade(ctx, 26, 0, 18, look.body, look.dark, look.dark), 5);
  ctx.fillStyle = look.light;
  ctx.globalAlpha = 0.45;
  ellipsePath(ctx, 24, -8, 6, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Голова.
  ellipsePath(ctx, 44, 0, 10, 9);
  fillOutline(ctx, look.dark, 4.5);

  if (look.rhino) {
    // Рог: длинный, загнут вверх, с подсветкой на верхней кромке.
    ctx.beginPath();
    ctx.moveTo(48, -6);
    ctx.quadraticCurveTo(66, -14, 78, -4);
    ctx.quadraticCurveTo(66, -3, 48, 6);
    ctx.closePath();
    fillOutline(ctx, look.dark, 4);
    ctx.strokeStyle = look.light;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(52, -5);
    ctx.quadraticCurveTo(66, -11, 75, -4.5);
    ctx.stroke();
    // Шип на переднеспинке.
    ctx.beginPath();
    ctx.moveTo(22, -14);
    ctx.lineTo(32, -30);
    ctx.lineTo(32, -12);
    ctx.closePath();
    fillOutline(ctx, look.dark, 3.5);
  } else {
    // Булавовидные усики.
    for (let side = -1; side <= 1; side += 2) {
      const sway = Math.sin(phase * 0.5 + side) * 1.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(50, 5 * side);
      ctx.lineTo(62, (16 + sway) * side);
      ctx.stroke();
      ellipsePath(ctx, 64, (18 + sway) * side, 3.6, 3.6);
      fillOutline(ctx, look.dark, 2.5);
    }
  }

  // Глаза с бликом.
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, 47, 6 * side, 3.8, 3.4, side * 0.3);
    ctx.fillStyle = '#fff6ea';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipsePath(ctx, 48.2, 6 * side, 1.8, 1.8);
    ctx.fillStyle = OUT;
    ctx.fill();
    ellipsePath(ctx, 47.4, 5.2 * side, 0.8, 0.8);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
