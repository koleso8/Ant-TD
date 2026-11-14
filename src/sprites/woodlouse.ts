/**
 * Мокрица для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Сизо-серая, как горный камень: овальное тело из поперечных пластин, края пластин по бокам
 * зубцами назад, светлая кромка спереди каждой пластины и неровные бледные пятна, маленькая
 * голова с глазами по бокам и длинными коленчатыми усами, сзади два коротких хвостовых отростка.
 * Ноги короткие, из-под краёв видны только кончики. Свёрнутую в шар мокрицу игра рисует кодом.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#7d8790';
const LIGHT = '#c8d0d6';
const DARK = '#38404a';
const LEG = '#5a636c';

function jit(i: number): number {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

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

/** Полуширина тела на продольной координате x (овал, к хвосту уже). */
function halfW(x: number): number {
  const cx = -3;
  const ax = 45;
  const t = Math.max(-1, Math.min(1, (x - cx) / ax));
  return 26 * Math.sqrt(Math.max(0, 1 - t * t)) * (x < cx ? 1 - (cx - x) / 160 : 1);
}

/** Границы пластин: голова, семь грудных, пять брюшных, хвостовой щиток. */
const BOUNDS = [41, 30, 22.3, 14.6, 6.9, -0.8, -8.5, -16.2, -24, -27.5, -31, -34.5, -38, -41.5];

/** Контур тела с зубцами пластин по бокам. */
function bodyPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(BOUNDS[0] + 2, 0);
  for (const side of [1, -1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i < BOUNDS.length - 1; i++) {
      const xa = BOUNDS[i];
      const xb = BOUNDS[i + 1];
      const wa = halfW(xa);
      const wb = halfW(xb);
      // Пластина: от переднего края наружу и назад к зубцу, затем зарубка к следующей.
      pts.push([xa, (wa - 1.5) * side]);
      pts.push([xb + (xa - xb) * 0.15, (Math.max(wa, wb) + 1.2) * side]);
    }
    pts.push([-46, 6 * side]);
    pts.push([-48.5, 0]);
    if (side === 1) {
      for (const [px, py] of pts) ctx.lineTo(px, py);
    } else {
      // Вторая сторона — обратно от хвоста к голове.
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    }
  }
  ctx.closePath();
}

/** Ноги: семь пар коротких, из-под края видны кончики; волна шага от головы к хвосту. */
function legs(ctx: Ctx, phase: number): void {
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const bx = 26 - i * 7.7;
      const ph = phase - i * 0.9 + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph) * 3.5;
      const w = halfW(bx);
      ctx.beginPath();
      ctx.moveTo(bx, (w - 6) * side);
      ctx.lineTo(bx - 2 + swing, (w + 5) * side);
      ctx.lineTo(bx - 5 + swing * 1.3, (w + 8) * side);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = LEG;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Коленчатые усы: толстый стебелёк вбок-вперёд, тонкий жгутик загнут наружу. */
function antennae(ctx: Ctx, phase: number): void {
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2;
    const pts = [40, 7 * side, 50, 16 * side, 60 + sw, 18 * side, 70 + sw, 24 * side + sw * side];
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    for (let i = 2; i < 6; i += 2) {
      ellipsePath(ctx, pts[i], pts[i + 1], 1.8, 1.8);
      ctx.fillStyle = DARK;
      ctx.fill();
    }
  }
}

export function drawWoodlouseHD(ctx: Ctx, phase: number): void {
  legs(ctx, phase);
  antennae(ctx, phase);
  // Хвостовые отростки.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-42, 4 * side);
    ctx.lineTo(-52, 8.5 * side);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  bodyPath(ctx);
  const g = ctx.createRadialGradient(4, -10, 4, -3, 0, 50);
  g.addColorStop(0, LIGHT);
  g.addColorStop(0.45, BODY);
  g.addColorStop(1, DARK);
  fillOutline(ctx, g, 4.6);

  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  // Неровные бледные пятна — не рядами.
  for (let i = 0; i < 34; i++) {
    const px = -38 + jit(i) * 70;
    const w = halfW(px);
    const py = (jit(i + 50) * 2 - 1) * w * 0.85;
    ctx.fillStyle = jit(i + 40) < 0.65 ? `rgba(225,228,222,${(0.22 + jit(i + 90) * 0.2).toFixed(2)})` : 'rgba(40,46,54,0.3)';
    ellipsePath(ctx, px, py, 1.8 + jit(i + 7) * 2.6, 1.3 + jit(i + 9) * 1.6, jit(i + 3) * 3);
    ctx.fill();
  }
  // Пластины: тёмный задний край и светлая кромка спереди следующей.
  for (let i = 1; i < BOUNDS.length - 1; i++) {
    const x = BOUNDS[i];
    const w = halfW(x) + 2;
    ctx.strokeStyle = 'rgba(30,36,44,0.6)';
    ctx.lineWidth = i < 8 ? 1.8 : 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, -w);
    ctx.quadraticCurveTo(x + 2.5, 0, x - 1.5, w);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235,240,245,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3.2, -w * 0.92);
    ctx.quadraticCurveTo(x + 0.8, 0, x - 3.2, w * 0.92);
    ctx.stroke();
  }
  ctx.restore();

  // Глаза по бокам головы.
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 35, 9.5 * side, 2.6, 2, side * 0.3);
    ctx.fillStyle = '#1c2026';
    ctx.fill();
  }
}
