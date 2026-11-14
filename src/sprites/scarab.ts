/**
 * Скарабей для спрайт-листа: вид сверху, смотрит вдоль +x, центр тела в начале координат.
 * Чёрный с бронзовым отливом: широкие надкрылья в продольных бороздках, широкая зернистая
 * переднеспинка, голова-«грабли» с шестью зубцами спереди, рыжие пластинчатые усики.
 * Передние ноги копательные — плоские голени с зубцами по наружному краю, тянутся вперёд к шару;
 * средние и задние длинные, с шипами. Шар игра рисует отдельно (он катится и разбивается).
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const BODY = '#302c2a';
const LIGHT = '#8e8572';
const DARK = '#141110';
const BRONZE = '#b08f52';
const LEG = '#262220';

/** Псевдослучайное 0..1 по номеру: зернистость без закономерных колец и рядов. */
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

function shade(ctx: Ctx, x: number, y: number, r: number, light: string, mid: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, light);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, dark);
  return g;
}

/** Нога ломаной: тёмный контур, тело ноги, светлая кромка у поднятой; шипы на голени. */
function leg(ctx: Ctx, pts: readonly number[], lift: number, spines: boolean): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? '#4e463c' : LEG;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  if (!spines) return;
  // Шипы на голени (последний отрезок): короткие штрихи наружу.
  const n = pts.length;
  const ax = pts[n - 4];
  const ay = pts[n - 3];
  const bx = pts[n - 2];
  const by = pts[n - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const side = ay >= 0 ? 1 : -1;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  for (const t of [0.3, 0.55, 0.8]) {
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + nx * side * 4 + (bx - ax) / len * 2, py + ny * side * 4 + (by - ay) / len * 2);
    ctx.stroke();
  }
}

/** Копательная передняя нога: бедро и плоская голень с четырьмя зубцами по наружному краю. */
function digLeg(ctx: Ctx, side: number, swing: number): void {
  const hip = [24, 16 * side] as const;
  const knee = [36 + swing * 0.4, 33 * side] as const;
  const tip = [62 + swing, 27 * side] as const;
  ctx.beginPath();
  ctx.moveTo(...hip);
  ctx.lineTo(...knee);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = LEG;
  ctx.lineWidth = 4;
  ctx.stroke();
  // Голень: плоская лопатка от колена к кончику, зубцы наружу.
  const dx = tip[0] - knee[0];
  const dy = tip[1] - knee[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Нормаль наружу, от оси тела.
  const nx = -uy * side;
  const ny = ux * side;
  ctx.beginPath();
  ctx.moveTo(knee[0] - nx * 3, knee[1] - ny * 3);
  // Внутренний край ровный.
  ctx.lineTo(tip[0] - nx * 2, tip[1] - ny * 2);
  // Зубцы по наружному краю — от кончика назад.
  const teeth = [1, 0.78, 0.56, 0.34];
  for (const t of teeth) {
    const bx = knee[0] + dx * t;
    const by = knee[1] + dy * t;
    ctx.lineTo(bx + nx * 7 + ux * 2, by + ny * 7 + uy * 2);
    ctx.lineTo(bx + nx * 3.5 - ux * 4, by + ny * 3.5 - uy * 4);
  }
  ctx.lineTo(knee[0] + nx * 3, knee[1] + ny * 3);
  ctx.closePath();
  fillOutline(ctx, LEG, 3.2);
  ctx.strokeStyle = 'rgba(180,165,135,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(knee[0] - nx * 1.5 + ux * 3, knee[1] - ny * 1.5 + uy * 3);
  ctx.lineTo(tip[0] - nx * 0.5 - ux * 2, tip[1] - ny * 0.5 - uy * 2);
  ctx.stroke();
}

/** Средние и задние ноги — трипод-походка; передние гребут вперёд к шару. */
function legs(ctx: Ctx, phase: number): void {
  const shapes: number[][] = [
    [2, 18, 8, 40, -4, 54, -10, 58],
    [-14, 16, -30, 36, -48, 46, -56, 48],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 2; i++) {
      const groupA = (i === 0) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 7;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.1, s[7] * side,
      ], lift, true);
    }
    const front = Math.sin(phase + (side > 0 ? Math.PI : 0)) * 4;
    digLeg(ctx, side, front);
  }
}

export function drawScarabHD(ctx: Ctx, phase: number): void {
  const bob = Math.sin(phase * 2) * 0.5;
  legs(ctx, phase);

  // Надкрылья: широкие, округлые сзади, продольные бороздки сходятся к концу.
  const ex = -16;
  const rx = 36;
  const ry = 31;
  ellipsePath(ctx, ex, bob, rx, ry);
  fillOutline(ctx, shade(ctx, ex + 6, bob - 10, 40, LIGHT, BODY, DARK), 5);
  ctx.save();
  ellipsePath(ctx, ex, bob, rx, ry);
  ctx.clip();
  for (const side of [-1, 1]) {
    for (const f of [0.16, 0.31, 0.46, 0.61, 0.76, 0.9]) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = -1 + (i / 12) * 1.9;
        const px = ex + rx * t;
        const py = bob + side * f * ry * Math.sqrt(Math.max(0, 1 - t * t * 0.92));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -0.9);
      ctx.strokeStyle = 'rgba(255,240,210,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  // Шов и бронзовый отлив на каждом надкрылье.
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ex + rx, bob);
  ctx.lineTo(ex - rx - 2, bob);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const g = ctx.createRadialGradient(ex + 4, bob + side * 15, 1, ex + 4, bob + side * 15, 18);
    g.addColorStop(0, 'rgba(190,160,100,0.5)');
    g.addColorStop(1, 'rgba(190,160,100,0)');
    ctx.fillStyle = g;
    ellipsePath(ctx, ex + 4, bob + side * 15, 20, 9, side * 0.1);
    ctx.fill();
  }
  ctx.restore();

  // Переднеспинка: широкая, зернистая, передний край выемкой под голову.
  const px = 16;
  ctx.beginPath();
  ctx.moveTo(px - 14, -30);
  ctx.quadraticCurveTo(px + 10, -33, px + 18, -20);
  ctx.quadraticCurveTo(px + 13, 0, px + 18, 20);
  ctx.quadraticCurveTo(px + 10, 33, px - 14, 30);
  ctx.quadraticCurveTo(px - 20, 0, px - 14, -30);
  ctx.closePath();
  fillOutline(ctx, shade(ctx, px - 2, -12, 30, '#5e574c', BODY, DARK), 5);
  ctx.save();
  ctx.clip();
  // Мелкая беспорядочная зернистость: тёмные ямки и редкие светлые крупинки.
  for (let i = 0; i < 70; i++) {
    const gx = px - 18 + jit(i) * 36;
    const gy = -30 + jit(i + 100) * 60;
    ctx.fillStyle = jit(i + 200) < 0.7 ? 'rgba(0,0,0,0.28)' : 'rgba(220,200,160,0.18)';
    ellipsePath(ctx, gx, gy, 0.9, 0.9);
    ctx.fill();
  }
  // Мягкий бронзовый отлив слева спереди.
  const sheen = ctx.createLinearGradient(px - 14, -30, px + 10, 10);
  sheen.addColorStop(0, 'rgba(190,160,100,0.32)');
  sheen.addColorStop(1, 'rgba(190,160,100,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(px - 22, -34, 44, 68);
  ctx.restore();

  // Пластинчатые усики: рыжие веера по бокам головы.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(38, 12 * side);
    ctx.lineTo(44, 22 * side);
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ellipsePath(ctx, 46 + k * 2.2, (24 + Math.abs(k) * 0.5) * side, 2.2, 4.2, k * 0.35 * side);
      fillOutline(ctx, '#a8692e', 1.6);
    }
  }

  // Голова-«грабли»: полукруг с шестью зубцами спереди, бронзовая кромка.
  const hx = 34;
  const hr = 19;
  ctx.beginPath();
  ctx.moveTo(hx, -hr);
  for (let i = 0; i <= 6; i++) {
    const a0 = -Math.PI / 2 + (i / 6) * Math.PI;
    if (i > 0) {
      const am = -Math.PI / 2 + ((i - 0.5) / 6) * Math.PI;
      ctx.lineTo(hx + Math.cos(am) * (hr + 6), Math.sin(am) * (hr + 6));
    }
    ctx.lineTo(hx + Math.cos(a0) * hr, Math.sin(a0) * hr);
  }
  ctx.closePath();
  fillOutline(ctx, shade(ctx, hx + 2, -6, 22, '#57503f', '#27231f', DARK), 4.5);
  ctx.strokeStyle = 'rgba(200,170,105,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(hx, 0, hr - 3, -Math.PI * 0.42, Math.PI * 0.05);
  ctx.stroke();

  // Глаза у края переднеспинки.
  for (const side of [-1, 1]) {
    ellipsePath(ctx, hx - 3, 15 * side, 3.2, 2.6, side * 0.4);
    ctx.fillStyle = '#3a2a1a';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ellipsePath(ctx, hx - 3.6, 14.2 * side, 0.9, 0.9);
    ctx.fillStyle = BRONZE;
    ctx.fill();
  }
}
