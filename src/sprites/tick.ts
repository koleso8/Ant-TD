/**
 * Клещ для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела чуть позади начала координат.
 * Плоское каплевидное тело цвета тёмного вина: по заднему краю зубчики-фестоны и краевая бороздка,
 * на спине пара продольных борозд и мелкие ямки. Спереди светлый костяной щиток с бурой каймой
 * по заднему краю, из-под него торчит хоботок: два щупика и тёмное остриё между ними. Восемь
 * коротких ног с костяными перевязями на суставах собраны у передней половины тела; передняя пара
 * тянется вперёд и ощупывает дорогу. Голодный клещ плоский; напившегося игра дорисовывает сама
 * (красное брюшко поверх спрайта, `drawTick` в art.ts).
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#521a2c';
const LIGHT = '#8e4054';
const DARK = '#200810';
const GROOVE = 'rgba(30,8,14,0.6)';
const SHIELD = '#dcc79c';
const SHIELD_LIGHT = '#f8eed2';
const SHIELD_DARK = '#9c7c4c';
const SHIELD_MARK = '#6a3a22';
const LEG = '#3e1622';
const LEG_BAND = '#dcbe90';

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

/** Нога: два коротких толстых членика, на колене и у лапки костяные перевязи. */
function leg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, lift: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.8;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? '#6a2a3a' : LEG;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = LEG_BAND;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'butt';
  for (const [ax, ay, bx, by, t] of [[x0, y0, x1, y1, 0.86], [x1, y1, x2, y2, 0.62]] as const) {
    ctx.beginPath();
    ctx.moveTo(ax + (bx - ax) * (t - 0.09), ay + (by - ay) * (t - 0.09));
    ctx.lineTo(ax + (bx - ax) * (t + 0.09), ay + (by - ay) * (t + 0.09));
    ctx.stroke();
  }
}

/** Очертание тела: узкое спереди, шире всего в задней трети. */
function bodyPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(17, -7);
  ctx.bezierCurveTo(8, -17, -6, -21.5, -17, -20.5);
  ctx.bezierCurveTo(-29, -19, -34, -9, -34, 0);
  ctx.bezierCurveTo(-34, 9, -29, 19, -17, 20.5);
  ctx.bezierCurveTo(-6, 21.5, 8, 17, 17, 7);
  ctx.quadraticCurveTo(19.5, 0, 17, -7);
  ctx.closePath();
}

/** Щиток: щит остриём назад. */
function shieldPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(19, -6);
  ctx.bezierCurveTo(14, -13.5, 4, -14.5, -1, -10.5);
  ctx.quadraticCurveTo(-7.5, -5, -8.5, 0);
  ctx.quadraticCurveTo(-7.5, 5, -1, 10.5);
  ctx.bezierCurveTo(4, 14.5, 14, 13.5, 19, 6);
  ctx.quadraticCurveTo(20.5, 0, 19, -6);
  ctx.closePath();
}

export function drawTickHD(ctx: Ctx, phase: number): void {
  // Ноги: четыре пары у передней половины тела, шагают через одну.
  const shapes: ReadonlyArray<readonly number[]> = [
    [13, 9, 22, 17, 31, 20],
    [6, 13, 12, 24, 17, 31],
    [-2, 15, -5, 26, -11, 33],
    [-10, 14, -19, 24, -28, 28],
  ];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const groupA = (i % 2 === 0) === (side < 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 5;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      // Передняя пара ещё и ощупывает дорогу.
      const quest = i === 0 ? Math.sin(phase * 2 + side) * 1.8 : 0;
      leg(ctx, s[0], s[1] * side, s[2] + swing * 0.5, (s[3] + quest * 0.5) * side, s[4] + swing, (s[5] + quest) * side, lift);
    }
  }

  // Хоботок: основание, два щупика и тёмное остриё между ними.
  const nod = Math.sin(phase * 2) * 0.06;
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 28.5, 3.7 * side, 6, 2.5, side * (0.2 + nod));
    fillOutline(ctx, '#8c4a34', 2.4);
  }
  ctx.beginPath();
  ctx.moveTo(23, -1.5);
  ctx.lineTo(37, 0);
  ctx.lineTo(23, 1.5);
  ctx.closePath();
  fillOutline(ctx, '#2a0e08', 2);
  ctx.beginPath();
  ctx.roundRect(16, -5.6, 9, 11.2, 3);
  fillOutline(ctx, '#7c3c2c', 3);

  // Тело.
  bodyPath(ctx);
  const bg = ctx.createRadialGradient(-6, 0, 3, -9, 0, 30);
  bg.addColorStop(0, LIGHT);
  bg.addColorStop(0.5, BODY);
  bg.addColorStop(1, DARK);
  fillOutline(ctx, bg);
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  ctx.lineCap = 'round';
  // Краевая бороздка: то же очертание, поменьше.
  ctx.save();
  ctx.translate(-9, 0);
  ctx.scale(0.85, 0.82);
  ctx.translate(9, 0);
  bodyPath(ctx);
  ctx.restore();
  ctx.strokeStyle = GROOVE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Фестоны по заднему краю.
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let k = -4; k <= 4; k++) {
    const a = Math.PI + k * 0.25;
    ctx.moveTo(-9 + Math.cos(a) * 26, Math.sin(a) * 21.5);
    ctx.lineTo(-9 + Math.cos(a) * 21.4, Math.sin(a) * 17.2);
  }
  ctx.stroke();
  // Пара продольных борозд на спине.
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-9, 5 * side);
    ctx.quadraticCurveTo(-17, 11 * side, -26, 8 * side);
    ctx.stroke();
  }
  // Ямки: беспорядочно.
  ctx.fillStyle = 'rgba(30,8,14,0.5)';
  for (let i = 0; i < 18; i++) {
    const px = -30 + jit(i) * 24;
    const py = (jit(i + 50) - 0.5) * 30;
    ellipsePath(ctx, px, py, 0.9 + jit(i + 90) * 0.5, 0.9);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,214,222,0.24)';
  ellipsePath(ctx, -16, 0, 8, 3.2);
  ctx.fill();
  ctx.restore();

  // Щиток: костяной, с бурой каймой по заднему краю и шейными бороздками.
  shieldPath(ctx);
  const sg = ctx.createRadialGradient(9, 0, 1.5, 6, 0, 16);
  sg.addColorStop(0, SHIELD_LIGHT);
  sg.addColorStop(0.55, SHIELD);
  sg.addColorStop(1, SHIELD_DARK);
  fillOutline(ctx, sg, 3.4);
  ctx.save();
  shieldPath(ctx);
  ctx.clip();
  // Бурая кайма по заднему краю: ровной дугой, без зубцов (зубцы на светлом читались оскалом).
  ctx.beginPath();
  ctx.moveTo(2, -14);
  ctx.quadraticCurveTo(6.5, 0, 2, 14);
  ctx.lineTo(-12, 14);
  ctx.lineTo(-12, -14);
  ctx.closePath();
  ctx.fillStyle = SHIELD_MARK;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,214,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(3.4, -13);
  ctx.quadraticCurveTo(7.9, 0, 3.4, 13);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(106,58,34,0.55)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(17.5, 3 * side);
    ctx.quadraticCurveTo(13, 6 * side, 9.5, 10.5 * side);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(106,58,34,0.5)';
  for (let i = 0; i < 9; i++) {
    ellipsePath(ctx, 8 + jit(i + 20) * 10, (jit(i + 70) - 0.5) * 16, 0.8, 0.8);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ellipsePath(ctx, 14, 0, 3.4, 1.8);
  ctx.fill();
  ctx.restore();
}
