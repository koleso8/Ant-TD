import { PAL } from '../render/palette';

/**
 * Ползающие для спрайт-листов: слизень и пиявка. Вид сверху, смотрят вдоль +x,
 * центр тела в начале координат. Кадры листа — волна по телу: у слизня подошва
 * сокращается и тянется, у пиявки сегменты извиваются.
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

/**
 * Слизень строго сверху: симметричная подошва-капля с волнистыми краями по обе стороны,
 * мантия по центру оси, глаза на стебельках вперёд. Тянется и сжимается по кадрам,
 * позади полупрозрачный след слизи.
 */
export function drawSlugHD(ctx: Ctx, phase: number): void {
  const stretch = Math.sin(phase);
  // След слизи позади, по оси.
  ctx.fillStyle = 'rgba(210,230,160,0.32)';
  ellipsePath(ctx, -66, 0, 30, 11);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,245,190,0.25)';
  ellipsePath(ctx, -44, 0, 22, 8);
  ctx.fill();

  ctx.save();
  ctx.scale(1 + 0.06 * stretch, 1 - 0.05 * stretch);

  // Подошва: капля, широкая спереди, к хвосту сужается; волна бежит по обоим краям.
  const halfWidth = (x: number): number => {
    const u = (x + 8) / 56;
    const base = Math.sqrt(Math.max(0, 1 - u * u)) * 19;
    const taper = 0.6 + 0.4 * Math.min(1, (x + 64) / 70);
    return base * taper;
  };
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const x = -64 + (112 * i) / 48;
    const w = halfWidth(x) + Math.sin(phase + x * 0.15) * 2;
    ctx.lineTo(x, -w);
  }
  for (let i = 48; i >= 0; i--) {
    const x = -64 + (112 * i) / 48;
    const w = halfWidth(x) + Math.sin(phase + x * 0.15 + Math.PI) * 2;
    ctx.lineTo(x, w);
  }
  ctx.closePath();
  fillOutline(ctx, shade(ctx, -4, 0, 56, '#c4b27a', '#9c8a52', '#7a6a3c'), 4.5);

  // Мантия: оливковый овал по центру, чуть ближе к голове.
  ellipsePath(ctx, 4, 0, 33, 13.5);
  fillOutline(ctx, shade(ctx, 4, 0, 33, '#9db05a', '#7d8a3a', '#56622a'), 4.5);
  ctx.save();
  ellipsePath(ctx, 4, 0, 33, 13.5);
  ctx.clip();
  // Пятна парами по обе стороны оси и дыхальце на правом боку.
  ctx.fillStyle = '#5e6b2a';
  for (const [dx, dy, r] of [[-18, -6, 4.5], [-16, 7, 4], [-2, -8, 3.8], [0, 6.5, 4.2], [14, -5, 3.4], [16, 6, 3.2], [-8, 0, 2.6], [26, 0, 2.4]] as const) {
    ellipsePath(ctx, dx, dy, r, r * 0.85);
    ctx.fill();
  }
  ctx.fillStyle = '#3f4a1c';
  ellipsePath(ctx, 20, 9, 3, 2.4);
  ctx.fill();
  // Гребень по оси: влажный блик.
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ellipsePath(ctx, 2, -2.5, 24, 3);
  ctx.fill();
  ctx.restore();

  // Хвост: тёмная полоска по оси, где подошва сужается.
  ctx.strokeStyle = 'rgba(90,75,40,0.45)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-32, 0);
  ctx.lineTo(-58, 0);
  ctx.stroke();

  // Нижние щупальца: короткие, вперёд.
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(42, 5 * side);
    ctx.quadraticCurveTo(50, 7 * side, 55, 11 * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#8a9a48';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  // Глаза на стебельках: симметрично вперёд и в стороны, покачиваются.
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side * 1.1) * 3;
    const ex = 60 + sway * 0.4;
    const ey = (20 + sway) * side;
    ctx.beginPath();
    ctx.moveTo(36, 4 * side);
    ctx.quadraticCurveTo(50, 8 * side, ex, ey);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = '#8a9a48';
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ellipsePath(ctx, ex, ey, 6.5, 6.5);
    fillOutline(ctx, '#e8e0c0', 3.5);
    ellipsePath(ctx, ex + 1.5, ey, 2.8, 2.8);
    ctx.fillStyle = OUT;
    ctx.fill();
    ellipsePath(ctx, ex + 0.6, ey - 1.2 * side, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

/** Пиявка: цепочка сегментов с бегущей волной, присоска-голова спереди и диск сзади. */
export function drawLeechHD(ctx: Ctx, phase: number): void {
  const N = 9;
  const seg = (i: number) => {
    const t = i / (N - 1);
    const x = 36 - 92 * t;
    const y = Math.sin(phase + i * 0.75) * 5.5 * (0.4 + t);
    const r = 12 - 5 * t + Math.sin(i * 1.1) * 1.2;
    return { x, y, r };
  };
  // Задняя присоска.
  const tail = seg(N - 1);
  ellipsePath(ctx, tail.x - 6, tail.y, 9, 7.5);
  fillOutline(ctx, '#4a1a1a', 4);
  // Сегменты от хвоста к голове, чтобы передние лежали сверху.
  for (let i = N - 1; i >= 0; i--) {
    const { x, y, r } = seg(i);
    ellipsePath(ctx, x, y, r + 4, r);
    fillOutline(ctx, shade(ctx, x, y, r + 4, i % 2 === 0 ? '#9a4a44' : '#b05850', i % 2 === 0 ? '#6e2a2a' : '#8a3a36', '#4a1a1a'), 4.5);
    ctx.fillStyle = 'rgba(255,200,180,0.28)';
    ellipsePath(ctx, x, y - r * 0.5, r * 0.6, r * 0.25);
    ctx.fill();
  }
  // Передняя присоска со ртом из трёх челюстей и глазами-точками.
  const head = seg(0);
  const hx = head.x + 10;
  ellipsePath(ctx, hx, head.y, 11, 10);
  fillOutline(ctx, shade(ctx, hx, head.y, 11, '#7a3030', '#4a1a1a', '#2a0a0a'), 4.5);
  ctx.strokeStyle = '#2a0a0a';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI;
    ctx.beginPath();
    ctx.moveTo(hx + 3, head.y);
    ctx.lineTo(hx + 3 + Math.cos(a) * 5.5, head.y + Math.sin(a) * 5.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd9d0';
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, hx - 4, head.y + 6 * side, 1.6, 1.6);
    ctx.fill();
  }
}
