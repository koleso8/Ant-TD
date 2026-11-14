/**
 * Скорпион для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Янтарно-бурый, чтобы читаться на песке: головогрудь с парой глазков, брюшко из поперечных
 * пластин, крупные клешни впереди (пальцы чуть разводятся в такт шагу), восемь тонких ног.
 * Хвост уходит назад, сегменты к концу крупнее — он поднимается к камере, — и загибается
 * вперёд: вздутие с тёмным жалом остриём вперёд. Всё симметрично по оси хода.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#a35a1e';
const LIGHT = '#e3a456';
const DARK = '#4a2408';
const TAIL_END = '#6e340c';
const STING = '#2a160a';
const LEG = '#7a4518';

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

/** Тонкая нога из трёх отрезков: контур, тело, светлая кромка у поднятой. */
function leg(ctx: Ctx, pts: readonly number[], lift: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? LIGHT : LEG;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

/** Четыре пары ног: первая вперёд-вбок, остальные всё сильнее назад; волновая походка. */
function legs(ctx: Ctx, phase: number): void {
  const shapes: number[][] = [
    [22, 14, 30, 30, 36, 42, 40, 48],
    [15, 16, 18, 34, 18, 46, 16, 52],
    [8, 17, 4, 36, -2, 48, -6, 54],
    [0, 17, -10, 34, -20, 46, -26, 50],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const ph = phase + i * (Math.PI / 2) + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph) * 6;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.1, s[7] * side,
      ], lift);
    }
  }
}

/** Клешня: плечо из двух члеников, кисть-вздутие и два пальца, верхний подвижный. */
function claw(ctx: Ctx, side: number, open: number): void {
  // Членики руки.
  ctx.beginPath();
  ctx.moveTo(26, 9 * side);
  ctx.lineTo(36, 22 * side);
  ctx.lineTo(46, 28 * side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 9.5;
  ctx.stroke();
  ctx.strokeStyle = BODY;
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,170,0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(28, 9.5 * side);
  ctx.lineTo(37, 21 * side);
  ctx.stroke();
  // Пальцы: неподвижный ближе к оси, подвижный снаружи, разводится на open.
  const hx = 58;
  const hy = 29 * side;
  const finger = (ang: number, len: number, w: number): void => {
    ctx.save();
    ctx.translate(hx + 6, hy);
    ctx.rotate(ang * side);
    ctx.beginPath();
    ctx.moveTo(0, -w * side);
    ctx.quadraticCurveTo(len * 0.6, -w * 0.9 * side, len, w * 0.6 * side);
    ctx.quadraticCurveTo(len * 0.55, w * 0.6 * side, 0, w * side);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, BODY);
    g.addColorStop(1, DARK);
    fillOutline(ctx, g, 3.2);
    ctx.restore();
  };
  finger(-0.18 - open * 0.5, 17, 3.4);
  finger(0.16 + open, 16, 3.2);
  // Кисть.
  ellipsePath(ctx, hx, hy, 11.5, 8, 0.12 * side);
  fillOutline(ctx, shade(ctx, hx - 3, hy - 3 * side - 2, 13, LIGHT, BODY, DARK), 4);
  ctx.fillStyle = 'rgba(255,240,200,0.4)';
  ellipsePath(ctx, hx - 3, hy - 3 * side, 4.5, 2.2, 0.12 * side);
  ctx.fill();
}

/**
 * Хвост: пять тонких члеников прямо назад, каждый чуть крупнее, на конце вздутие с ядом
 * и тёмное жало, загнутое кончиком вниз-назад (сверху видно как шип назад).
 */
function tail(ctx: Ctx, phase: number): void {
  const segs: ReadonlyArray<readonly [number, number, number]> = [
    [-33, 6, 4.6], [-44, 6.2, 5], [-55, 6.4, 5.4], [-66, 6.6, 5.8], [-77, 6.8, 6.2],
  ];
  const sway = (i: number): number => Math.sin(phase * 0.5) * i * 0.3;
  // Жало под вздутием: длинный изогнутый шип назад.
  const tx = -91;
  const ty = sway(6);
  ctx.beginPath();
  ctx.moveTo(tx - 4, ty - 3.4);
  ctx.quadraticCurveTo(tx - 14, ty - 3.4, tx - 22, ty);
  ctx.quadraticCurveTo(tx - 14, ty + 3.4, tx - 4, ty + 3.4);
  ctx.closePath();
  fillOutline(ctx, STING, 3);
  ctx.strokeStyle = 'rgba(255,220,170,0.4)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(tx - 6, ty - 1.6);
  ctx.quadraticCurveTo(tx - 13, ty - 1.8, tx - 19, ty - 0.3);
  ctx.stroke();
  segs.forEach(([x, rx, ry], i) => {
    ellipsePath(ctx, x, sway(i), rx, ry);
    const tone = i < 3 ? BODY : TAIL_END;
    fillOutline(ctx, shade(ctx, x - 1.5, sway(i) - ry * 0.45, ry * 1.4, LIGHT, tone, DARK), 3.6);
  });
  // Вздутие с ядом.
  ellipsePath(ctx, tx, ty, 9.5, 7.6);
  fillOutline(ctx, shade(ctx, tx + 1, ty - 3, 10.5, '#e09a50', TAIL_END, DARK), 4);
  ctx.fillStyle = 'rgba(255,235,190,0.45)';
  ellipsePath(ctx, tx + 1, ty - 3, 4, 1.8);
  ctx.fill();
}

export function drawScorpionHD(ctx: Ctx, phase: number): void {
  // Скорпион длинный (клешни и хвост с жалом): ужат, чтобы влезть в кадр листа во всех направлениях.
  ctx.save();
  ctx.translate(6, 0);
  ctx.scale(0.74, 0.74);
  const open = 0.08 + 0.08 * Math.sin(phase);
  legs(ctx, phase);
  tail(ctx, phase);
  claw(ctx, -1, open);
  claw(ctx, 1, open);

  // Брюшко: поперечные пластины, у заднего края уже.
  const mx = -10;
  ctx.beginPath();
  ctx.moveTo(8, -17);
  ctx.quadraticCurveTo(-14, -21, -28, -11);
  ctx.quadraticCurveTo(-34, 0, -28, 11);
  ctx.quadraticCurveTo(-14, 21, 8, 17);
  ctx.closePath();
  fillOutline(ctx, shade(ctx, mx + 4, -8, 26, LIGHT, BODY, DARK), 5);
  ctx.save();
  ctx.clip();
  for (const x of [2, -5, -12, -19, -25]) {
    ctx.strokeStyle = 'rgba(70,35,8,0.6)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + 2, -22);
    ctx.quadraticCurveTo(x - 2, 0, x + 2, 22);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,170,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3.6, -22);
    ctx.quadraticCurveTo(x - 0.4, 0, x + 3.6, 22);
    ctx.stroke();
  }
  ctx.restore();

  // Головогрудь: скруглённая трапеция, к голове уже; глазки на бугорке посередине.
  ctx.beginPath();
  ctx.moveTo(4, -17);
  ctx.quadraticCurveTo(22, -17, 31, -9);
  ctx.quadraticCurveTo(35, 0, 31, 9);
  ctx.quadraticCurveTo(22, 17, 4, 17);
  ctx.quadraticCurveTo(1, 0, 4, -17);
  ctx.closePath();
  fillOutline(ctx, shade(ctx, 16, -7, 20, LIGHT, BODY, DARK), 5);
  ctx.strokeStyle = 'rgba(70,35,8,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  // Пара срединных глазков — просто тёмные точки, без бликов и обводки бугорка.
  ctx.fillStyle = DARK;
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 23, 2.2 * side, 1.8, 1.6);
    ctx.fill();
  }
  ctx.restore();
}
