/**
 * Ледяной клоп для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Клоп-щитник: широкая переднеспинка с острыми «плечами», тело сужается назад, посередине
 * светлый треугольный щиток остриём назад, по бокам надкрылья, сзади тёмная перепонка.
 * Синий (на почти белой земле Снегов белое не читается), в инее: неровные светлые прожилки
 * на щитке, ледяные шипы на плечах, по краю брюшка светлые и тёмные пятна. Усы длинные,
 * полосатые; ноги тёмно-синие.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#3a7ec2';
const LIGHT = '#a8dcf8';
const DARK = '#173a66';
const ICE = '#dff4ff';
const LEG = '#1f3f6e';

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

function leg(ctx: Ctx, pts: readonly number[], lift: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.6;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? '#4f86c8' : LEG;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function legs(ctx: Ctx, phase: number): void {
  const shapes: number[][] = [
    [18, 12, 30, 28, 38, 40, 42, 44],
    [4, 16, 6, 34, 4, 46, 2, 50],
    [-10, 15, -22, 31, -34, 42, -40, 45],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const groupA = (i === 1) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 7;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [s[0], s[1] * side, s[2] + swing * 0.5, s[3] * side, s[4] + swing, s[5] * side, s[6] + swing * 1.1, s[7] * side], lift);
    }
  }
}

/** Ледяной шип: узкий кристалл с бликом. */
function shard(ctx: Ctx, x: number, y: number, len: number, w: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -w);
  ctx.lineTo(len, 0);
  ctx.lineTo(0, w);
  ctx.lineTo(-len * 0.18, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#8fc8ee');
  fillOutline(ctx, g, 2.6);
  ctx.strokeStyle = 'rgba(60,120,190,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-len * 0.1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawIceBugHD(ctx: Ctx, phase: number): void {
  legs(ctx, phase);

  // Усы: длинные, из члеников, полосатые.
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2.5;
    const pts = [40, 5 * side, 52, 13 * side, 64 + sw, 17 * side, 74 + sw, 25 * side + sw * side];
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = ICE;
    ctx.lineWidth = 2.2;
    for (let i = 2; i < 6; i += 2) {
      ctx.beginPath();
      ctx.moveTo(pts[i] - 1.5, pts[i + 1] - 0.8 * side);
      ctx.lineTo(pts[i] + 2, pts[i + 1] + 0.6 * side);
      ctx.stroke();
    }
  }

  // Брюшко с надкрыльями: от плеч сужается к округлому концу; по краю пятна.
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(16, -27);
    ctx.quadraticCurveTo(-12, -30, -34, -16);
    ctx.quadraticCurveTo(-46, 0, -34, 16);
    ctx.quadraticCurveTo(-12, 30, 16, 27);
    ctx.closePath();
  };
  body();
  const bg = ctx.createRadialGradient(-2, -10, 4, -8, 0, 44);
  bg.addColorStop(0, LIGHT);
  bg.addColorStop(0.45, BODY);
  bg.addColorStop(1, DARK);
  fillOutline(ctx, bg, 5);
  ctx.save();
  body();
  ctx.clip();
  // Перепонка сзади: темнее, с жилками.
  ctx.fillStyle = 'rgba(16,40,80,0.55)';
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.quadraticCurveTo(-30, -18, -46, -8);
  ctx.lineTo(-46, 8);
  ctx.quadraticCurveTo(-30, 18, -14, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(170,215,250,0.35)';
  ctx.lineWidth = 1;
  for (const f of [-0.6, -0.2, 0.2, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(-16, f * 8);
    ctx.lineTo(-44, f * 13);
    ctx.stroke();
  }
  // Край брюшка: чередование светлых и тёмных пятен разной ширины.
  for (const side of [-1, 1]) {
    for (const [x, w, tone] of [[8, 7, 1], [-2, 5, 0], [-11, 8, 1], [-22, 5, 0], [-30, 6, 1]] as const) {
      ctx.fillStyle = tone ? 'rgba(225,245,255,0.75)' : 'rgba(14,34,70,0.6)';
      ellipsePath(ctx, x, side * (28 - Math.abs(x + 8) * 0.25), w * 0.5, 3.4);
      ctx.fill();
    }
  }
  ctx.restore();

  // Щиток: светлый треугольник остриём назад, в инее.
  const scut = (): void => {
    ctx.beginPath();
    ctx.moveTo(16, -15);
    ctx.quadraticCurveTo(-4, -9, -22, 0);
    ctx.quadraticCurveTo(-4, 9, 16, 15);
    ctx.closePath();
  };
  scut();
  const sg = ctx.createLinearGradient(16, -15, -10, 12);
  sg.addColorStop(0, '#e2f5ff');
  sg.addColorStop(0.5, '#8fd0f2');
  sg.addColorStop(1, '#4f95d0');
  fillOutline(ctx, sg, 3.6);
  ctx.save();
  scut();
  ctx.clip();
  // Иней: неровные светлые прожилки-кристаллы.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const px = 12 - jit(i) * 28;
    const py = (jit(i + 20) * 2 - 1) * 9 * (1 - (12 - px) / 40);
    const a = jit(i + 40) * TAU;
    const l = 2 + jit(i + 60) * 3;
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l);
    ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    ctx.moveTo(px - Math.cos(a + 1.1) * l * 0.6, py - Math.sin(a + 1.1) * l * 0.6);
    ctx.lineTo(px + Math.cos(a + 1.1) * l * 0.6, py + Math.sin(a + 1.1) * l * 0.6);
    ctx.stroke();
  }
  ctx.restore();

  // Переднеспинка: широкая, с острыми плечами.
  ctx.beginPath();
  ctx.moveTo(34, -9);
  ctx.quadraticCurveTo(30, -20, 22, -31);
  ctx.lineTo(12, -28);
  ctx.quadraticCurveTo(15, 0, 12, 28);
  ctx.lineTo(22, 31);
  ctx.quadraticCurveTo(30, 20, 34, 9);
  ctx.quadraticCurveTo(36, 0, 34, -9);
  ctx.closePath();
  const pg = ctx.createRadialGradient(24, -10, 3, 22, 0, 34);
  pg.addColorStop(0, '#7fbcea');
  pg.addColorStop(0.5, BODY);
  pg.addColorStop(1, DARK);
  fillOutline(ctx, pg, 5);
  ctx.strokeStyle = 'rgba(225,245,255,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(30, -17);
  ctx.quadraticCurveTo(24, -24, 20, -27);
  ctx.stroke();

  // Ледяные шипы на плечах: по три, разной длины.
  for (const side of [-1, 1]) {
    shard(ctx, 21, 30 * side, 13, 3.2, side * 1.25);
    shard(ctx, 27, 24 * side, 9, 2.6, side * 0.8);
    shard(ctx, 15, 29 * side, 8, 2.4, side * 1.75);
  }

  // Голова: маленькая, тёмно-синяя, глаза по бокам.
  ellipsePath(ctx, 40, 0, 8, 8.5);
  fillOutline(ctx, '#2c5e98', 4.4);
  ctx.fillStyle = 'rgba(190,225,250,0.45)';
  ellipsePath(ctx, 39, -3, 3.5, 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 41, 7 * side, 2.6, 2.1, side * 0.4);
    ctx.fillStyle = '#5a1c14';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}
