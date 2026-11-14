/**
 * Гусеница шелкопряда для спрайт-листа: вид сверху, смотрит вдоль +x, середина тела в начале координат.
 * Пухлое кремовое тело из девяти крупных валиков: за бурой головой вздутая грудь с тёмной перевязью,
 * дальше брюшко, сужающееся к хвосту, на предпоследнем валике рожок. По бокам ряд тёмных дыхалец,
 * на спине бурые серпики и пунктир сердечной трубки, у груди три пары острых ножек, под брюшком
 * три пары ложных ножек-присосок и пара хвостовых. Кадры листа — волна сжатия от хвоста к голове:
 * валики сходятся и раздаются, как у ползущей гусеницы, присоски цепляются за землю вслед за волной.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const SKIN = '#f1e6c4';
const SKIN_LIGHT = '#fffbee';
const SKIN_SHADE = '#b4965a';
const CREASE = 'rgba(112,84,40,0.7)';
const MARK = 'rgba(118,78,34,0.8)';
const HEAD = '#a8642a';
const HEAD_LIGHT = '#e2a85e';
const HEAD_DARK = '#58300e';
const LEG = '#d09a46';
const FOOT = '#e6d6a4';
const SPOT = '#4e3a1c';

/** Шаг валиков вдоль тела, их полудлина и полуширина от головы к хвосту. */
const STEP = 9.4;
const RX = 7.6;
const HW = [12, 16.5, 17.5, 15.2, 14.4, 14.6, 14.4, 12.8, 10];

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

export function drawSilkwormHD(ctx: Ctx, phase: number): void {
  const n = HW.length;
  const front = ((n - 1) * STEP) / 2 - 8;
  // Волна сжатия бежит от хвоста к голове: гребень там, где phase + i·0.9 = π/2.
  const wave = (i: number): number => phase + i * 0.9;
  const segs = HW.map((hw, i) => ({
    x: front - i * STEP + Math.sin(wave(i)) * 2.8,
    // Передняя треть слегка водит из стороны в сторону: гусеница ощупывает дорогу.
    y: Math.sin(phase) * 1.4 * Math.max(0, 1 - i / 3),
    // Где валики сошлись, они толще; где растянулись — тоньше.
    hw: hw * (1 + 0.08 * Math.cos(wave(i))),
  }));

  // Грудные ножки: три пары острых, перебирают по очереди.
  for (const i of [0, 1, 2]) {
    const s = segs[i];
    for (const side of [-1, 1]) {
      const wig = Math.sin(wave(i) * 2 + (side > 0 ? 0 : Math.PI)) * 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x - 5, s.y + (s.hw - 3) * side);
      ctx.quadraticCurveTo(s.x - 1 + wig, s.y + (s.hw + 5) * side, s.x + 2.5 + wig, s.y + (s.hw + 6.5) * side);
      ctx.quadraticCurveTo(s.x + 5.5 + wig * 0.5, s.y + (s.hw + 4) * side, s.x + 5, s.y + (s.hw - 3) * side);
      ctx.closePath();
      fillOutline(ctx, LEG, 2);
    }
  }
  // Ложные ножки-присоски под брюшком: выдвигаются, когда валик прижат к земле.
  for (const i of [4, 5, 6]) {
    const s = segs[i];
    const ext = 1.8 * Math.cos(wave(i));
    for (const side of [-1, 1]) {
      const fy = s.y + (s.hw + 2 + ext) * side;
      ellipsePath(ctx, s.x, fy, 4.8, 5.6);
      fillOutline(ctx, FOOT, 2.6);
      ctx.strokeStyle = 'rgba(92,64,24,0.8)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x - 2.8, fy + 3.2 * side);
      ctx.lineTo(s.x + 2.8, fy + 3.2 * side);
      ctx.stroke();
    }
  }
  // Хвостовые ножки: пара назад и в стороны.
  const tail = segs[n - 1];
  for (const side of [-1, 1]) {
    ellipsePath(ctx, tail.x - 5.6, tail.y + (tail.hw - 2.5) * side, 5.6, 3.8, side * -0.55);
    fillOutline(ctx, FOOT, 2.6);
  }

  // Общий контур тела: тёмная обводка всех валиков разом, заливки лягут поверх.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.5;
  for (const s of segs) {
    ellipsePath(ctx, s.x, s.y, RX, s.hw);
    ctx.stroke();
  }

  // Голова: бурая капсула с челюстями, затылком под первым валиком груди.
  const hx = segs[0].x + STEP + 3.6;
  const hy = segs[0].y * 1.3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy + 5.2 * side);
    ctx.quadraticCurveTo(hx + 13.5, hy + 5 * side, hx + 12, hy + 0.8 * side);
    ctx.quadraticCurveTo(hx + 9, hy + 2.6 * side, hx + 6, hy + 1.6 * side);
    ctx.closePath();
    fillOutline(ctx, '#3a200a', 2);
  }
  ellipsePath(ctx, hx, hy, 9.6, 10.4);
  const hg = ctx.createRadialGradient(hx + 1.5, hy, 1, hx, hy, 12);
  hg.addColorStop(0, HEAD_LIGHT);
  hg.addColorStop(0.55, HEAD);
  hg.addColorStop(1, HEAD_DARK);
  fillOutline(ctx, hg, 4);
  // Лобный шов «ёлочкой» и по тёмному глазку с каждого бока.
  ctx.strokeStyle = 'rgba(70,36,10,0.7)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 3, hy);
  ctx.lineTo(hx + 1.5, hy);
  ctx.lineTo(hx + 7, hy - 4);
  ctx.moveTo(hx + 1.5, hy);
  ctx.lineTo(hx + 7, hy + 4);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ellipsePath(ctx, hx + 3.4, hy + 7.4 * side, 2.1, 1.6, side * 0.4);
    ctx.fillStyle = '#1e1208';
    ctx.fill();
  }

  // Валики: от хвоста к голове, передние ложатся поверх задних.
  for (let i = n - 1; i >= 0; i--) {
    const s = segs[i];
    // Тень переднего валика на заднем.
    ellipsePath(ctx, s.x - 3, s.y, RX, s.hw * 0.95);
    ctx.fillStyle = 'rgba(100,74,34,0.34)';
    ctx.fill();
    ellipsePath(ctx, s.x, s.y, RX, s.hw);
    const g = ctx.createRadialGradient(s.x + 1.2, s.y, 1.5, s.x, s.y, s.hw * 1.04);
    g.addColorStop(0, SKIN_LIGHT);
    g.addColorStop(0.45, SKIN);
    g.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = CREASE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.lineCap = 'round';
    // Дыхальца по бокам.
    if (i >= 1 && i <= n - 2) {
      ctx.fillStyle = SPOT;
      for (const side of [-1, 1]) {
        ellipsePath(ctx, s.x - 1.2, s.y + s.hw * 0.62 * side, 2, 1.7);
        ctx.fill();
      }
    }
    if (i === 2) {
      // Бурая перевязь поперёк горба груди.
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(s.x + 1.4, s.y, RX * 0.5, s.hw * 0.5, 0, Math.PI / 2 + 0.15, Math.PI * 1.5 - 0.15);
      ctx.stroke();
    } else if (i === 4 || i === 6) {
      // Серпики на спине: по паре на валик, рожками вперёд.
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 1.9;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s.x + 0.6, s.y + s.hw * 0.33 * side, 2.7, Math.PI * 0.55, Math.PI * 1.45);
        ctx.stroke();
      }
    } else if (i === 3 || i === 5) {
      // Пунктир сердечной трубки вдоль спины.
      ctx.fillStyle = 'rgba(112,124,98,0.6)';
      ellipsePath(ctx, s.x - 1.8, s.y, 3, 1.6);
      ctx.fill();
    }
    // Блик на макушке валика.
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ellipsePath(ctx, s.x + 3, s.y, 1.5, s.hw * 0.26);
    ctx.fill();
  }
  // Тёмная кромка там, где грудь нависает над головой.
  const s0 = segs[0];
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(s0.x, s0.y, RX, s0.hw, 0, -Math.PI / 2 + 0.3, Math.PI / 2 - 0.3);
  ctx.stroke();

  // Рожок на предпоследнем валике: смотрит назад, к кончику темнеет.
  const h = segs[n - 2];
  ctx.beginPath();
  ctx.moveTo(h.x - 0.5, h.y - 3.8);
  ctx.quadraticCurveTo(h.x - 8, h.y - 2, h.x - 14, h.y);
  ctx.quadraticCurveTo(h.x - 8, h.y + 2, h.x - 0.5, h.y + 3.8);
  ctx.quadraticCurveTo(h.x + 1.5, h.y, h.x - 0.5, h.y - 3.8);
  ctx.closePath();
  const kg = ctx.createLinearGradient(h.x, 0, h.x - 14, 0);
  kg.addColorStop(0, '#ecd08e');
  kg.addColorStop(0.55, '#c08a44');
  kg.addColorStop(1, '#4a2c10');
  fillOutline(ctx, kg, 1.8);
}
