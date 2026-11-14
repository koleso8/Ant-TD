/**
 * Светлячок для спрайт-листа: вид сверху, летит вдоль +x, середина тела в начале координат.
 * Летающий: кадры листа — взмахи прозрачных задних крыльев (фаза 0..2π на цикл) с призрачным
 * следом; тёмные надкрылья со светлой каймой подняты и разведены в стороны. Спереди рыжий щиток
 * с тёмной полосой по оси (пятно посередине читалось бы глазом), из-под него торчат усики.
 * Брюшко тёмное в поясках, а три последних сегмента — фонарик: жёлто-зелёный, с белым
 * ядром и мягким ореолом. Мерцание света вокруг дорисовывает игра (`drawFirefly`).
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const SHELL = '#4a342a';
const SHELL_LIGHT = '#8a6650';
const SHELL_DARK = '#1e120e';
const EDGE = '#f0d27a';
const SHIELD = '#ee7438';
const SHIELD_LIGHT = '#ffb878';
const SHIELD_DARK = '#9c3a14';
const BELLY = '#56423a';
const BELLY_DARK = '#261814';

function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function fillOutline(ctx: Ctx, fill: string | CanvasGradient, w = 4.2): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Заднее крыло: длинное прозрачное, с жилками; angle — насколько отведено от оси тела. */
function hindWing(ctx: Ctx, side: number, angle: number, alpha: number): void {
  ctx.save();
  ctx.translate(4, 5 * side);
  ctx.rotate(-side * angle);
  ctx.globalAlpha = alpha;
  ellipsePath(ctx, -23, 0, 23, 8);
  ctx.fillStyle = 'rgba(232,244,255,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,140,170,0.5)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-44, 0);
  ctx.moveTo(-8, 0);
  ctx.lineTo(-36, -6 * side);
  ctx.moveTo(-8, 0);
  ctx.lineTo(-38, 5 * side);
  ctx.stroke();
  ctx.restore();
}

/** Надкрылье: тёмная вытянутая пластина со светлой каймой, отведена от тела на spread. */
function elytron(ctx: Ctx, side: number, spread: number): void {
  const y = (v: number): number => v * side;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(3, y(-5));
    ctx.quadraticCurveTo(-18, y(-8.5), -34, y(-3.5));
    ctx.quadraticCurveTo(-38, y(0.8), -33, y(4.6));
    ctx.quadraticCurveTo(-16, y(7.4), 3, y(5));
    ctx.quadraticCurveTo(5.5, 0, 3, y(-5));
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(9, y(5));
  ctx.rotate(-side * spread);
  path();
  const g = ctx.createLinearGradient(0, y(-8), 0, y(7));
  g.addColorStop(0, SHELL_DARK);
  g.addColorStop(0.45, SHELL_LIGHT);
  g.addColorStop(1, SHELL);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Светлая кайма по краю: внутрь от контура.
  path();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 4.4;
  ctx.stroke();
  // Продольные бороздки.
  ctx.strokeStyle = 'rgba(20,10,6,0.55)';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const f of [-0.28, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(0, y(f * 8));
    ctx.quadraticCurveTo(-18, y(f * 12), -31, y(f * 5));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,236,210,0.28)';
  ellipsePath(ctx, -14, y(-1), 13, 1.5, side * 0.05);
  ctx.fill();
  ctx.restore();
  path();
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.6;
  ctx.stroke();
}

export function drawFireflyHD(ctx: Ctx, phase: number): void {
  // Ореол фонарика под всем остальным.
  const halo = ctx.createRadialGradient(-22, 0, 2, -22, 0, 30);
  halo.addColorStop(0, 'rgba(236,255,120,0.75)');
  halo.addColorStop(0.45, 'rgba(226,255,100,0.32)');
  halo.addColorStop(1, 'rgba(226,255,100,0)');
  ctx.fillStyle = halo;
  ellipsePath(ctx, -22, 0, 30, 30);
  ctx.fill();

  // Задние крылья: машут вперёд-назад, призрачный след предыдущего положения.
  const swing = Math.sin(phase) * 0.34;
  const prev = Math.sin(phase - 1.2) * 0.34;
  for (const side of [-1, 1]) {
    hindWing(ctx, side, 1.02 + prev, 0.35);
    hindWing(ctx, side, 1.02 + swing, 1);
  }

  // Поджатые ноги.
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const lx = 10 - i * 8;
      const sway = Math.sin(phase + i) * 1.1;
      ctx.beginPath();
      ctx.moveTo(lx, 8 * side);
      ctx.lineTo(lx - 5 + sway, 15 * side);
      ctx.lineTo(lx - 2 + sway, 21 * side);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = SHELL;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Брюшко: тёмное в поясках, три последних сегмента светятся.
  const belly = (): void => {
    ctx.beginPath();
    ctx.moveTo(12, -8.5);
    ctx.bezierCurveTo(0, -11, -20, -10.5, -31, 0);
    ctx.bezierCurveTo(-20, 10.5, 0, 11, 12, 8.5);
    ctx.closePath();
  };
  belly();
  const bg = ctx.createLinearGradient(0, -11, 0, 11);
  bg.addColorStop(0, BELLY_DARK);
  bg.addColorStop(0.5, BELLY);
  bg.addColorStop(1, BELLY_DARK);
  fillOutline(ctx, bg);
  ctx.save();
  belly();
  ctx.clip();
  const lamp = ctx.createLinearGradient(-12, 0, -31, 0);
  lamp.addColorStop(0, '#c6e83a');
  lamp.addColorStop(0.5, '#f2ff7a');
  lamp.addColorStop(1, '#fdffd0');
  ctx.fillStyle = lamp;
  ctx.fillRect(-33, -12, 20.5, 24);
  // Белое ядро фонарика.
  const core = ctx.createRadialGradient(-22, 0, 0.5, -22, 0, 8);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-33, -12, 21, 24);
  ctx.lineWidth = 1.4;
  for (const bx of [4, -4, -12.5, -19, -25]) {
    ctx.strokeStyle = bx > -12 ? 'rgba(20,10,6,0.6)' : 'rgba(120,150,20,0.7)';
    ctx.beginPath();
    ctx.moveTo(bx + 1.5, -12);
    ctx.quadraticCurveTo(bx - 2, 0, bx + 1.5, 12);
    ctx.stroke();
  }
  ctx.restore();

  // Надкрылья: подняты и разведены, чуть дрожат в такт взмахам.
  const spread = 0.6 + Math.sin(phase * 2) * 0.04;
  for (const side of [-1, 1]) elytron(ctx, side, spread);

  // Усики из-под щитка.
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2;
    ctx.beginPath();
    ctx.moveTo(26, 3 * side);
    ctx.quadraticCurveTo(36, (6 + sw * 0.4) * side, 45, (13 + sw) * side);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = SHELL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Щиток: рыжий полукруглый козырёк над головой, тёмная полоса по оси.
  const shield = (): void => {
    ctx.beginPath();
    ctx.moveTo(10, -11.5);
    ctx.quadraticCurveTo(23, -13, 28.5, -5.5);
    ctx.quadraticCurveTo(31, 0, 28.5, 5.5);
    ctx.quadraticCurveTo(23, 13, 10, 11.5);
    ctx.quadraticCurveTo(7.5, 0, 10, -11.5);
    ctx.closePath();
  };
  shield();
  const sg = ctx.createLinearGradient(0, -12, 0, 12);
  sg.addColorStop(0, SHIELD_DARK);
  sg.addColorStop(0.3, SHIELD);
  sg.addColorStop(0.5, SHIELD_LIGHT);
  sg.addColorStop(0.7, SHIELD);
  sg.addColorStop(1, SHIELD_DARK);
  fillOutline(ctx, sg, 4);
  ctx.save();
  shield();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(8, -3.6);
  ctx.quadraticCurveTo(20, -3.4, 30, -1.2);
  ctx.lineTo(30, 1.2);
  ctx.quadraticCurveTo(20, 3.4, 8, 3.6);
  ctx.closePath();
  ctx.fillStyle = '#2c160c';
  ctx.fill();
  // Светлая прозрачная кромка козырька спереди.
  shield();
  ctx.strokeStyle = 'rgba(255,236,190,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
