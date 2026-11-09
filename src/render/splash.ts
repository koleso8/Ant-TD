import type { Rng } from '../engine/rng';
import { drawAnthill, drawShadow, drawTowerAcid, drawTowerBarracks, leaf, pebble, twig } from './art';
import { PAL } from './palette';
import { HERO, SOLDIER, WORKER, drawAntHD, type AntLook } from '../sprites/ant';
import { TERMITE_BOMBER, TERMITE_SOLDIER, TERMITE_WORKER, drawTermiteHD, type TermiteLook } from '../sprites/termite';
import { RHINO, drawBeetleHD } from '../sprites/beetle';
import { SPIDER, drawSpiderHD } from '../sprites/spider';
import { WASP, drawWaspHD } from '../sprites/wasp';

/**
 * Заставка главного меню: диорама в духе Kingdom Rush. Закат, павший дуб на горизонте,
 * муравейник с башнями слева, Жвал с солдатами в центре, колонна термитов справа.
 * Рисуется один раз в offscreen-канвас; текст и кнопки поверх кладёт UI.
 * Существа берутся из тех же векторных рисунков, что и спрайт-листы, поэтому они
 * чёткие в любом размере и совпадают по стилю с игрой.
 */
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const TILT = 0.86;

/** Существо из рисунка спрайт-листа: тень, поворот на плоскости, наклон камеры. */
function creature(ctx: Ctx, x: number, y: number, angle: number, u: number, draw: (c: Ctx) => void): void {
  drawShadow(ctx, x, y + 9 * u, 44 * u, 15 * u, 0.26);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u * TILT);
  ctx.rotate(angle);
  draw(ctx);
  ctx.restore();
}

function ant(ctx: Ctx, x: number, y: number, angle: number, u: number, look: AntLook, phase: number): void {
  creature(ctx, x, y, angle, u, (c) => drawAntHD(c, phase, look));
}

function termite(ctx: Ctx, x: number, y: number, angle: number, u: number, look: TermiteLook, phase: number): void {
  creature(ctx, x, y, angle, u, (c) => drawTermiteHD(c, phase, look));
}

function grassBlade(ctx: Ctx, x: number, y: number, h: number, lean: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.09, y);
  ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.55, x + lean, y - h);
  ctx.quadraticCurveTo(x + lean * 0.45, y - h * 0.5, x + h * 0.09, y);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx: Ctx, x: number, y: number, w: number, alpha: number): void {
  ctx.fillStyle = `rgba(255,236,214,${alpha})`;
  for (const [dx, dy, r] of [[0, 0, 0.3], [-0.28, 0.08, 0.2], [0.28, 0.06, 0.22], [0.1, -0.1, 0.24]] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx * w, y + dy * w, r * w, r * w * 0.55, 0, 0, TAU);
    ctx.fill();
  }
}

/** Деревянная табличка под заголовок: два столбика и доска с волокнами. */
function sign(ctx: Ctx, cx: number, top: number, w: number, h: number): void {
  for (const px of [cx - w * 0.36, cx + w * 0.36]) twig(ctx, px, top + h - 10, px, top + h + 46, 9);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const x = cx - w / 2;
  const r = 18;
  ctx.moveTo(x + r, top);
  ctx.lineTo(x + w - r, top + 4);
  ctx.quadraticCurveTo(x + w, top + 4, x + w, top + r);
  ctx.lineTo(x + w - 3, top + h - r);
  ctx.quadraticCurveTo(x + w - 3, top + h, x + w - r, top + h);
  ctx.lineTo(x + r, top + h - 5);
  ctx.quadraticCurveTo(x, top + h - 5, x, top + h - r);
  ctx.lineTo(x + 2, top + r);
  ctx.quadraticCurveTo(x + 2, top, x + r, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#a46c37');
  g.addColorStop(1, '#7a4a22');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = top + 12 + i * (h - 20) / 6;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.bezierCurveTo(x + w * 0.3, yy - 6, x + w * 0.6, yy + 7, x + w, yy - 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const [nx, ny] of [[x + 22, top + 20], [x + w - 22, top + 22], [x + 22, top + h - 20], [x + w - 22, top + h - 22]] as const) {
    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  leaf(ctx, cx - w / 2 + 14, top + h - 8, 26, 11, -0.6);
  leaf(ctx, cx + w / 2 - 20, top + 10, 22, 9, 2.5);
}

export function drawSplash(ctx: Ctx, w: number, h: number, rng: Rng): void {
  // Небо на закате.
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#22406e');
  sky.addColorStop(0.45, '#8a5878');
  sky.addColorStop(0.8, '#e98f5a');
  sky.addColorStop(1, '#f7d07c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, 400);
  const glow = ctx.createRadialGradient(1010, 330, 20, 1010, 330, 220);
  glow.addColorStop(0, 'rgba(255,236,160,0.9)');
  glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(760, 100, 500, 300);
  ctx.fillStyle = '#ffe28c';
  ctx.beginPath();
  ctx.arc(1010, 330, 62, 0, TAU);
  ctx.fill();
  cloud(ctx, 260, 170, 260, 0.55);
  cloud(ctx, 760, 120, 200, 0.4);
  cloud(ctx, 1160, 200, 180, 0.35);

  // Дальняя трава силуэтом и павший дуб на горизонте.
  ctx.fillStyle = '#35602c';
  ctx.beginPath();
  ctx.moveTo(0, 400);
  for (let x = 0; x <= w; x += 14) ctx.lineTo(x, 372 + Math.sin(x * 0.07) * 9 + Math.sin(x * 0.023) * 14);
  ctx.lineTo(w, 400);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 60; i++) {
    const x = rng.range(0, w);
    grassBlade(ctx, x, 392, rng.range(30, 70), rng.range(-14, 14), 'rgba(47,86,40,0.9)');
  }
  // Ствол дуба слева.
  ctx.fillStyle = '#5a3a1e';
  ctx.beginPath();
  ctx.moveTo(0, 318);
  ctx.lineTo(440, 326);
  ctx.quadraticCurveTo(470, 350, 436, 392);
  ctx.lineTo(0, 400);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,15,5,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const yy = 334 + i * 11;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(140, yy + 4, 300, yy - 5, 430, yy + 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#c9a06a';
  ctx.beginPath();
  ctx.ellipse(440, 358, 22, 34, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,60,30,0.5)';
  ctx.lineWidth = 2;
  for (let r = 6; r < 30; r += 7) {
    ctx.beginPath();
    ctx.ellipse(440, 358, r * 0.65, r, 0, 0, TAU);
    ctx.stroke();
  }

  // Земля с тропой к муравейнику.
  const ground = ctx.createLinearGradient(0, 400, 0, h);
  ground.addColorStop(0, '#74b84e');
  ground.addColorStop(1, '#4b8533');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 395, w, h - 395);
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.dirtDark;
  ctx.lineWidth = 94;
  ctx.beginPath();
  ctx.moveTo(w + 40, 520);
  ctx.quadraticCurveTo(900, 560, 700, 548);
  ctx.quadraticCurveTo(560, 540, 470, 520);
  ctx.stroke();
  ctx.strokeStyle = PAL.dirt;
  ctx.lineWidth = 78;
  ctx.stroke();
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, w);
    const y = rng.range(405, h);
    if (y > 470 && y < 600 && x > 440) continue;
    grassBlade(ctx, x, y, rng.range(12, 26), rng.range(-6, 6), rng.next() < 0.5 ? 'rgba(60,120,40,0.7)' : 'rgba(130,200,90,0.6)');
  }
  for (let i = 0; i < 16; i++) pebble(ctx, rng.range(40, w - 40), rng.range(420, h - 30), rng.range(4, 9), rng.range(3, 6));

  // Муравейник и башни.
  ctx.save();
  ctx.translate(360, 480);
  ctx.scale(1.9, 1.9);
  ctx.translate(-360, -480);
  drawAnthill(ctx, 360, 480, rng);
  ctx.restore();
  ctx.save();
  ctx.translate(150, 600);
  ctx.scale(1.5, 1.5);
  ctx.translate(-150, -600);
  drawTowerAcid(ctx, 150, 600, 3, 0.2, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(330, 650);
  ctx.scale(1.5, 1.5);
  ctx.translate(-330, -650);
  drawTowerBarracks(ctx, 330, 650, 2, 0);
  ctx.restore();

  // Колонна термитника справа: от дальних к ближним.
  creature(ctx, 940, 405, Math.PI + 0.2, 1, (c) => drawWaspHD(c, 1.2, WASP));
  creature(ctx, 1170, 488, Math.PI, 1.35, (c) => drawBeetleHD(c, 0.6, RHINO));
  termite(ctx, 1000, 520, Math.PI + 0.1, 1, TERMITE_WORKER, 0.4);
  termite(ctx, 1110, 548, Math.PI, 1, TERMITE_WORKER, 2.6);
  termite(ctx, 1240, 565, Math.PI - 0.1, 1, TERMITE_WORKER, 4.1);
  termite(ctx, 905, 595, Math.PI + 0.15, 1.1, TERMITE_SOLDIER, 1.5);
  termite(ctx, 1060, 650, Math.PI, 1, TERMITE_BOMBER, 3.3);
  creature(ctx, 1200, 668, Math.PI - 0.2, 1, (c) => drawSpiderHD(c, 2, SPIDER));

  // Защитники: солдаты впереди муравейника, Жвал крупно в центре.
  ant(ctx, 470, 548, 0.15, 1, SOLDIER, 0.8);
  ant(ctx, 520, 606, -0.1, 1, SOLDIER, 3.2);
  ant(ctx, 250, 540, 0.9, 0.85, WORKER, 1.1);
  ant(ctx, 620, 530, 0.05, 1.7, HERO, 2.2);

  // Передний план: крупные травинки по углам и виньетка.
  for (let i = 0; i < 14; i++) {
    const left = i < 7;
    const x = left ? rng.range(-10, 220) : rng.range(w - 220, w + 10);
    grassBlade(ctx, x, h + 10, rng.range(90, 180), rng.range(-30, 30), i % 2 ? '#2e5a26' : '#3a6f2e');
  }
  leaf(ctx, 70, 690, 34, 14, -0.4, '#8fbf4a', '#4e7a28');
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.5, w / 2, h / 2, h * 1.05);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(10,5,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  drawSplashSign(ctx);
}

/** Деревянная табличка под заголовок: кладётся и поверх картины, и поверх векторной диорамы. */
export function drawSplashSign(ctx: Ctx): void {
  sign(ctx, 640, 42, 640, 150);
}
