/**
 * Сколопендра для спрайт-листов: вид сверху, смотрит вдоль +x, середина тела в начале координат.
 * Тёмно-бордовые пластины-сегменты нахлёстом (передние поверх задних), красная голова с ядовитыми
 * челюстями-крючьями и длинными усами, жёлто-оранжевые ноги по паре на сегмент, сзади две длинные
 * хвостовые ноги. Кадры листа — волна по телу: сегменты уходят вбок по синусоиде, ноги шагают
 * вслед за волной. Половинка — та же сколопендра из пяти сегментов вместо одиннадцати.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#7e2c20';
const LIGHT = '#c8604a';
const DARK = '#3a100a';
const HEAD = '#d0442c';
const HEAD_LIGHT = '#f28a66';
const LEG = '#f0b030';
const LEG_DARK = '#b0741a';

/** Шаг сегментов вдоль тела. */
const STEP = 10;

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

/** Нога: два отрезка, контур и жёлтое тело, тёмный кончик. */
function leg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, lift: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? '#ffd870' : LEG;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = LEG_DARK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x1 + (x2 - x1) * 0.7, y1 + (y2 - y1) * 0.7);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawCentipedeHD(ctx: Ctx, phase: number, half = false): void {
  const n = half ? 5 : 11;
  const front = ((n - 1) * STEP) / 2 - (half ? 2 : 5);
  // Положение сегмента i (0 — у головы): волна бежит от головы к хвосту.
  const seg = (i: number): { x: number; y: number; rot: number } => {
    const amp = half ? 2.6 : 3.6;
    const a = phase - i * 0.8;
    return { x: front - i * STEP, y: Math.sin(a) * amp, rot: -Math.cos(a) * amp * 0.07 };
  };
  const hw = 8.5;

  // Хвостовые ноги: длинные, назад.
  const last = seg(n - 1);
  for (const side of [-1, 1]) {
    leg(ctx, last.x - 3, last.y + 4 * side, last.x - 12, last.y + 9 * side, last.x - 23, last.y + 7 * side, 0);
  }
  // Ходильные ноги: по паре на сегмент, шаг вслед за волной тела.
  for (let i = 0; i < n; i++) {
    const s = seg(i);
    for (const side of [-1, 1]) {
      const ph = phase - i * 0.8 + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph) * 4;
      const lift = Math.max(0, Math.cos(ph));
      leg(ctx, s.x, s.y + (hw - 3) * side, s.x - 1 + swing * 0.5, s.y + (hw + 7) * side, s.x - 4 + swing, s.y + (hw + 14) * side, lift);
    }
  }

  // Усы: длинные, из коротких члеников, расходятся вперёд.
  const head = { x: front + STEP * 0.95, y: Math.sin(phase + 0.8) * (half ? 2.6 : 3.6) };
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2.5;
    ctx.beginPath();
    ctx.moveTo(head.x + 5, head.y + 4 * side);
    ctx.quadraticCurveTo(head.x + 15, head.y + (9 + sw) * side, head.x + 24, head.y + (17 + sw) * side);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Сегменты: от хвоста к голове, чтобы передние ложились поверх задних.
  for (let i = n - 1; i >= 0; i--) {
    const s = seg(i);
    const k = i === n - 1 ? 0.82 : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.beginPath();
    ctx.moveTo(STEP * 0.62, -hw * 0.82 * k);
    ctx.quadraticCurveTo(STEP * 0.78, 0, STEP * 0.62, hw * 0.82 * k);
    ctx.quadraticCurveTo(0, hw * 1.08 * k, -STEP * 0.6, hw * 0.9 * k);
    ctx.quadraticCurveTo(-STEP * 0.72, 0, -STEP * 0.6, -hw * 0.9 * k);
    ctx.quadraticCurveTo(0, -hw * 1.08 * k, STEP * 0.62, -hw * 0.82 * k);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, LIGHT);
    g.addColorStop(0.4, BODY);
    g.addColorStop(1, DARK);
    fillOutline(ctx, g, 3.8);
    // Блик у переднего края пластины и тёмная кайма у заднего.
    ctx.strokeStyle = 'rgba(255,200,170,0.4)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(STEP * 0.3, -hw * 0.55 * k);
    ctx.quadraticCurveTo(STEP * 0.42, -hw * 0.1, STEP * 0.32, hw * 0.2 * k);
    ctx.stroke();
    ctx.restore();
  }

  // Голова: красная округлая пластина, ядовитые челюсти-крючья по бокам спереди.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(head.x + 2, head.y + 7 * side);
    ctx.quadraticCurveTo(head.x + 13, head.y + 9 * side, head.x + 12.5, head.y + 1.2 * side);
    ctx.quadraticCurveTo(head.x + 9, head.y + 5 * side, head.x + 2, head.y + 3.5 * side);
    ctx.closePath();
    fillOutline(ctx, '#2a100a', 2.6);
  }
  ellipsePath(ctx, head.x, head.y, 8.5, 9);
  const hg = ctx.createRadialGradient(head.x - 2, head.y - 4, 1, head.x, head.y, 10);
  hg.addColorStop(0, HEAD_LIGHT);
  hg.addColorStop(0.6, HEAD);
  hg.addColorStop(1, '#7a1c10');
  fillOutline(ctx, hg, 4);
  for (const side of [-1, 1]) {
    ellipsePath(ctx, head.x + 3.5, head.y + 6 * side, 2, 1.6, side * 0.4);
    ctx.fillStyle = '#1a0a06';
    ctx.fill();
  }
}
