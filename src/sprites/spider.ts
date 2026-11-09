import { PAL } from '../render/palette';

/**
 * Паук для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Большое фиолетовое брюшко с ромбом, тёмная головогрудь, красные глаза, тёмные клыки
 * и восемь длинных дугообразных ног с походкой «по четыре».
 */
type Ctx = CanvasRenderingContext2D;

export interface SpiderLook {
  body: string;
  light: string;
  dark: string;
  mark: string;
  eye: string;
  eyeSmall: string;
}

export const SPIDER: SpiderLook = {
  body: PAL.spider, light: PAL.spiderLight, dark: PAL.spiderDark,
  mark: '#a08ac0', eye: '#ff5a4a', eyeSmall: '#ffb0a0',
};

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

/** Нога из трёх сегментов: высокое колено далеко в стороне, лапка возвращается к оси. */
function leg(ctx: Ctx, pts: number[], lift: number, look: SpiderLook): void {
  const k = 1 - lift * 0.08;
  const [x0, y0] = pts;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x0 + (pts[i] - x0) * k, y0 + (pts[i + 1] - y0) * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? look.body : look.dark;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Восемь ног: группа А — чётные слева и нечётные справа, группа Б — остальные. */
function legs(ctx: Ctx, phase: number, look: SpiderLook): void {
  const base = [14, 9, 4, -1];
  const knee = [34, 20, 2, -16];
  const foot = [48, 28, -4, -30];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const groupA = (i % 2 === 0) === (side < 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 10;
      const lift = Math.max(0, Math.cos(ph));
      leg(ctx, [
        base[i], 10 * side,
        knee[i] + swing * 0.5, 31 * side,
        foot[i] + swing, 44 * side,
      ], lift, look);
    }
  }
}

export function drawSpiderHD(ctx: Ctx, phase: number, look: SpiderLook = SPIDER): void {
  const bob = Math.sin(phase * 2) * 0.8;
  legs(ctx, phase, look);

  // Брюшко: крупное, с ромбом и парой пятен.
  const gx = -26;
  ellipsePath(ctx, gx, bob, 27, 22);
  fillOutline(ctx, shade(ctx, gx, bob, 27, look.light, look.body, look.dark));
  ctx.save();
  ellipsePath(ctx, gx, bob, 27, 22);
  ctx.clip();
  ctx.fillStyle = look.mark;
  ctx.beginPath();
  ctx.moveTo(gx + 16, bob);
  ctx.lineTo(gx + 2, bob - 10);
  ctx.lineTo(gx - 16, bob);
  ctx.lineTo(gx + 2, bob + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ellipsePath(ctx, gx + 2, bob - 1, 7, 4);
  ctx.fill();
  ctx.fillStyle = look.dark;
  for (const [dx, dy] of [[-8, -14], [-8, 14], [-20, -8], [-20, 8]] as const) {
    ellipsePath(ctx, gx + dx, bob + dy, 2.6, 2.6);
    ctx.fill();
  }
  ctx.restore();

  // Головогрудь: тёмная, плотная.
  ellipsePath(ctx, 10, 0, 17, 15);
  fillOutline(ctx, shade(ctx, 10, 0, 17, '#6a5a80', '#3f3356', look.dark));
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ellipsePath(ctx, 6, -4, 7, 4);
  ctx.fill();

  // Клыки: тёмные, загнутые внутрь.
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(24, 6 * side);
    ctx.quadraticCurveTo(34, 7 * side, 37, 1.5 * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#1c1428';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  // Глаза: два больших красных с бликом и четыре малых.
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, 20, 6 * side, 4.6, 4.6);
    ctx.fillStyle = look.eye;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipsePath(ctx, 19, 5 * side, 1.5, 1.5);
    ctx.fillStyle = '#fff1ee';
    ctx.fill();
    for (const [dx, dy] of [[15, 11.5], [24, 11], [12, 4]] as const) {
      ellipsePath(ctx, dx, dy * side, 2.1, 2.1);
      ctx.fillStyle = look.eyeSmall;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
