/**
 * Постройки Джунглей (акт 5): живое дерево и древний камень — серая сейба с корнями-досками,
 * плетёный ротанг, лианы с листьями-сердечками, крутые крыши из пальмовой соломы, листья монстеры,
 * орхидеи, перья попугаев, замшелые блоки руин со ступенчатым орнаментом (без лиц и масок),
 * кокосы и грибы-чашечки. Детализация на уровне утверждённых наборов: объём, фактура, мелочи.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, anthillMound, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, jit, woodPole } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

interface Tri { hi: string; base: string; lo: string }
/** Серая кора сейбы с лишайником. */
const BARK: Tri = { hi: '#c2ad8c', base: '#8f7a5c', lo: '#54452f' };
/** Тёмные брёвна рам и свай. */
const LOG: Tri = { hi: '#a87c50', base: '#6e4c2e', lo: '#3e2a18' };
const STRAW: Tri = { hi: '#f4d88e', base: '#cfa452', lo: '#86602a' };
const WICKER: Tri = { hi: '#efd6a0', base: '#c9a25e', lo: '#8a6a34' };
const STONE: Tri = { hi: '#c4cab6', base: '#8f9a84', lo: '#56604e' };
const VINE = '#5f8a2c';
const FEATHERS = ['#d8322a', '#2f6fd0', '#f2c230'] as const;

/** Точка и касательная на квадратичной кривой. */
function quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number): { p: Vec; u: Vec } {
  const u = 1 - t;
  const p = { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
  const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
  const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
  const l = Math.hypot(dx, dy) || 1;
  return { p, u: { x: dx / l, y: dy / l } };
}

/** Листок-сердечко на лиане. */
function vineLeaf(ctx: Ctx, x: number, y: number, a: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.5, -s * 0.9, s * 1.6, -s * 0.7, s * 1.9, 0);
  ctx.bezierCurveTo(s * 1.6, s * 0.7, s * 0.5, s * 0.9, 0, 0);
  ctx.closePath();
  outline(ctx, 1);
  fs(ctx, '#72bc42');
  ctx.strokeStyle = 'rgba(40,80,20,0.7)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0.4, 0); ctx.lineTo(s * 1.6, 0); ctx.stroke();
  ctx.restore();
}

/** Лиана по квадратичной кривой: перекрученный стебель со светлыми витками и листьями-сердечками. */
function liana(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, leaves: number): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
  };
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 2.2;
  ctx.stroke();
  ctx.strokeStyle = VINE;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(225,245,170,0.55)';
  ctx.lineWidth = 0.8;
  for (let t = 0.05; t < 0.97; t += 0.07) {
    const { p, u } = quad(x0, y0, cx, cy, x1, y1, t);
    ctx.beginPath();
    ctx.moveTo(p.x - u.y * w * 0.45 - u.x, p.y + u.x * w * 0.45 - u.y);
    ctx.lineTo(p.x + u.y * w * 0.45 + u.x, p.y - u.x * w * 0.45 + u.y);
    ctx.stroke();
  }
  for (let k = 0; k < leaves; k++) {
    const { p, u } = quad(x0, y0, cx, cy, x1, y1, (k + 0.6) / (leaves + 0.4));
    const side = k % 2 ? 1 : -1;
    vineLeaf(ctx, p.x, p.y, Math.atan2(u.x * side, -u.y * side) - side * 0.6, 3.2);
  }
}

/** Лист монстеры: сердцевидный, с прорезями от края к жилке и светлой средней жилкой; a — куда смотрит кончик. */
function monstera(ctx: Ctx, x: number, y: number, len: number, a: number, col = '#4fa83e'): void {
  const w = len * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.05, -w * 1.15, len * 0.75, -w * 1.1, len, 0);
  ctx.bezierCurveTo(len * 0.75, w * 1.1, len * 0.05, w * 1.15, 0, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, '#86d460');
  g.addColorStop(0.5, col);
  g.addColorStop(1, '#2c7228');
  outline(ctx, 1.8);
  fs(ctx, g);
  if (len > 16) {
    ctx.fillStyle = 'rgba(18,48,14,0.9)';
    for (const side of [-1, 1]) {
      for (const t of [0.3, 0.5, 0.7]) {
        const ex = len * (t + 0.08);
        const ey = side * w * (1.02 - Math.abs(t - 0.45) * 0.6);
        ctx.beginPath();
        ctx.moveTo(ex - len * 0.035, ey * 0.98);
        ctx.lineTo(len * t, side * w * 0.22);
        ctx.lineTo(ex + len * 0.035, ey * 0.98);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = 'rgba(20,60,15,0.4)';
  ctx.lineWidth = 0.8;
  for (const t of [0.2, 0.42, 0.64, 0.84]) {
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(len * t, 0); ctx.quadraticCurveTo(len * (t + 0.06), side * w * 0.4, len * (t + 0.12), side * w * 0.75); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#d6f0a0';
  ctx.lineWidth = Math.max(0.9, len * 0.04);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.03, len * 0.95, 0); ctx.stroke();
  ctx.restore();
}

/** Орхидея: пять лепестков, губа темнее, жёлтая серединка. */
function orchidFlower(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * TAU;
    outline(ctx, 1);
    ell(ctx, x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 2.2 * s, 2.4 * s, 1.3 * s, a);
    fs(ctx, i === 2 ? '#ffd0ec' : col);
  }
  outline(ctx, 0.9);
  ell(ctx, x, y + 1.6 * s, 1.7 * s, 1.4 * s);
  fs(ctx, '#a0206a');
  ctx.fillStyle = '#f2d04a';
  circle(ctx, x, y - 0.2 * s, 0.9 * s);
  ctx.fill();
}

/** Перо попугая: лист с очином, тёмный кончик; a — направление кончика. */
function feather(ctx: Ctx, x: number, y: number, len: number, a: number, col: string): void {
  const w = len * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -w * 1.3, len, 0);
    ctx.quadraticCurveTo(len * 0.5, w * 1.3, 0, 0);
    ctx.closePath();
  };
  shape();
  outline(ctx, 1.1);
  fs(ctx, col);
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = 'rgba(20,20,40,0.45)';
  ctx.fillRect(len * 0.78, -w * 2, len, w * 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,240,0.75)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
  ctx.restore();
}

/** Плетение из ротанга внутри клипа: шахматка коротких полос, светлые вдоль и тёмные поперёк. */
function weave(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cell: number): void {
  let r = 0;
  for (let yy = y0; yy < y1; yy += cell, r++) {
    let c = 0;
    for (let xx = x0; xx < x1; xx += cell, c++) {
      if ((r + c) % 2) {
        ctx.fillStyle = 'rgba(255,240,200,0.32)';
        ctx.fillRect(xx, yy + cell * 0.2, cell, cell * 0.6);
      } else {
        ctx.fillStyle = 'rgba(90,60,20,0.3)';
        ctx.fillRect(xx + cell * 0.2, yy, cell * 0.6, cell);
      }
    }
  }
}

/** Бревно с корой между двумя точками: тёмный контур, светлая грань, продольные трещины коры. */
function log(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, tone: Tri = LOG): void {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = uy;
  const ny = -ux;
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * hw, y1 + ny * hw);
  ctx.lineTo(x2 + nx * hw, y2 + ny * hw);
  ctx.lineTo(x2 - nx * hw, y2 - ny * hw);
  ctx.lineTo(x1 - nx * hw, y1 - ny * hw);
  ctx.closePath();
  outline(ctx, 1.8);
  fs(ctx, tone.base);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = tone.hi;
  ctx.lineWidth = Math.max(0.8, w * 0.24);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * hw * 0.5 + ux, y1 + ny * hw * 0.5 + uy);
  ctx.lineTo(x2 + nx * hw * 0.5 - ux, y2 + ny * hw * 0.5 - uy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,18,6,0.5)';
  ctx.lineWidth = 0.8;
  for (let d = 3; d < len - 3; d += 6) {
    const o = ((d * 7) % 5) / 5 - 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 + ux * d - nx * hw * o, y1 + uy * d - ny * hw * o);
    ctx.lineTo(x1 + ux * (d + 3.5) - nx * hw * o, y1 + uy * (d + 3.5) - ny * hw * o);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
}

/** Обвязка лианой поверх стыка: зелёный узел с витками. */
function vineKnot(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 1.3);
  circle(ctx, x, y, r);
  fs(ctx, VINE);
  ctx.strokeStyle = 'rgba(225,245,170,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.5); ctx.lineTo(x + r * 0.7, y + r * 0.1); ctx.moveTo(x - r * 0.7, y + 0.1 * r); ctx.lineTo(x + r * 0.7, y + r * 0.6); ctx.stroke();
}

/** Знамя джунглей: древко, обмотанное лианой, гребень из перьев, тканое полотнище с полосами и зигзагом, перья на шнурах. */
function jungleBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  woodPole(ctx, px, ground, topY + 2, 4.4);
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 1.6;
  for (let yy = topY + 44; yy < ground - 8; yy += 7) {
    ctx.beginPath(); ctx.moveTo(px - 2.4, yy + 2); ctx.lineTo(px + 2.4, yy - 2); ctx.stroke();
  }
  [-0.5, 0, 0.5].forEach((da, i) => feather(ctx, px, topY + 1, 10, -Math.PI / 2 + da, FEATHERS[i]));
  outline(ctx, 1.3);
  circle(ctx, px, topY + 1.5, 2.6);
  fs(ctx, '#8a5a2c');
  const bw = 7.5;
  const y0 = topY + 5;
  const y1 = topY + 34;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px - bw - 3, y0); ctx.lineTo(px + bw + 3, y0); ctx.stroke();
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const cloth = (): void => {
    ctx.beginPath();
    ctx.moveTo(px - bw, y0);
    ctx.lineTo(px + bw, y0);
    ctx.quadraticCurveTo(px + bw + 1, (y0 + y1) / 2, px + bw, y1);
    ctx.lineTo(px - bw, y1);
    ctx.quadraticCurveTo(px - bw + 1, (y0 + y1) / 2, px - bw, y0);
    ctx.closePath();
  };
  cloth();
  const g = ctx.createLinearGradient(px - bw, 0, px + bw, 0);
  g.addColorStop(0, '#c45a1c');
  g.addColorStop(0.35, '#f0842e');
  g.addColorStop(1, '#a8481a');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  cloth();
  ctx.clip();
  ctx.fillStyle = '#1f9a8a';
  ctx.fillRect(px - bw, y1 - 10, 2 * bw, 5);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(px - bw, y1 - 4, 2 * bw, 4);
  ctx.strokeStyle = '#f6efe0';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(px - bw + (i * 2 * bw) / 6, y1 - 7.5 + (i % 2 ? -1.8 : 1.8));
  ctx.stroke();
  ctx.restore();
  antCrest(ctx, px, y0 + 10, 4.3, '#7a2a0a');
  for (let i = 0; i < 3; i++) {
    const fx = px + (i - 1) * 5;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(fx, y1); ctx.lineTo(fx, y1 + 3); ctx.stroke();
    feather(ctx, fx, y1 + 3, 8, Math.PI / 2 + (i - 1) * 0.2, FEATHERS[i]);
  }
}

/** Фонарь со светлячками: светящийся изнутри кокон из редких прутьев, ободки сверху и снизу, вокруг огоньки. */
function fireflyBasket(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 22);
  glow.addColorStop(0, 'rgba(220,255,120,0.55)');
  glow.addColorStop(1, 'rgba(220,255,120,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 22);
  ctx.fill();
  const inner = ctx.createRadialGradient(x - 1, y, 0.5, x, y, 7);
  inner.addColorStop(0, '#fbffd8');
  inner.addColorStop(0.6, '#d8f070');
  inner.addColorStop(1, '#8ab830');
  outline(ctx, 1.8);
  ell(ctx, x, y, 6, 7);
  fs(ctx, inner);
  ctx.save();
  ell(ctx, x, y, 6, 7);
  ctx.clip();
  ctx.lineCap = 'butt';
  for (const k of [-4.4, -1.5, 1.5, 4.4]) {
    ctx.strokeStyle = WICKER.lo;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x + k, y - 8); ctx.quadraticCurveTo(x + k * 1.25, y, x + k, y + 8); ctx.stroke();
    ctx.strokeStyle = WICKER.hi;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.restore();
  outline(ctx, 1.8);
  ell(ctx, x, y, 6, 7);
  ctx.stroke();
  outline(ctx, 1.2);
  ctx.beginPath(); ctx.rect(x - 4.5, y + 5.6, 9, 2.4); fs(ctx, WICKER.base);
  outline(ctx, 1.2);
  ctx.beginPath(); ctx.rect(x - 4, y - 8, 8, 2.4); fs(ctx, WICKER.base);
  for (const [dx, dy] of [[-10, -6], [9, -9], [11, 4], [-8, 8]] as const) {
    ctx.fillStyle = 'rgba(230,255,120,0.4)';
    circle(ctx, x + dx, y + dy, 2.6);
    ctx.fill();
    ctx.fillStyle = '#f6ffb0';
    circle(ctx, x + dx, y + dy, 0.9);
    ctx.fill();
  }
}

/** Шляпа-лист: лист монстеры лежит на голове кончиком назад, черешок торчит вперёд. */
function leafHat(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x + fx * r * 0.6, y + fy * r * 0.6); ctx.lineTo(x + fx * r * 1.25, y + fy * r * 1.25); ctx.stroke();
  ctx.strokeStyle = '#8ab84a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  monstera(ctx, x + fx * r * 0.7, y + fy * r * 0.7, r * 2.7, angle + Math.PI, '#5cb84a');
}

/**
 * Корень-доска сейбы: широкий у ствола (ax, ay — где отходит), плавно стекает к кончику на земле
 * (gx, gy); цвет коры, светлое ребро по верху. side — в какую сторону расходится.
 */
function buttress(ctx: Ctx, ax: number, ay: number, gx: number, gy: number, side: number): void {
  const ix = ax - side * 3;
  const iy = gy + 2.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.bezierCurveTo(ax + (gx - ax) * 0.12, ay + (gy - ay) * 0.65, gx - (gx - ax) * 0.4, gy - 2.5, gx, gy);
  ctx.quadraticCurveTo(gx + side * 1.5, gy + 2.5, gx - (gx - ax) * 0.2, gy + 2.6);
  ctx.lineTo(ix, iy);
  ctx.closePath();
  const g = ctx.createLinearGradient(ax, ay, gx, gy + 2);
  g.addColorStop(0, side < 0 ? BARK.hi : BARK.base);
  g.addColorStop(1, side < 0 ? BARK.base : BARK.lo);
  outline(ctx, 2);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(255,245,220,0.45)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(ax + side * 0.6, ay + 2);
  ctx.bezierCurveTo(ax + (gx - ax) * 0.15, ay + (gy - ay) * 0.66, gx - (gx - ax) * 0.42, gy - 1.5, gx - side * 1.5, gy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(45,35,20,0.35)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(ax - side * 1.5, ay + 6); ctx.quadraticCurveTo((ax + gx) / 2, gy - 1, gx - (gx - ax) * 0.3, gy + 1.5); ctx.stroke();
}

/**
 * Стрелки Джунглей: серая сейба с корнями-досками и лишайником, по стволу лианы, сверху плетёная
 * площадка с частоколом из ротанга; стрелки под листьями монстеры. 2-й уровень — тканое знамя
 * с перьями, орхидеи на стволе и вторая лиана, 3-й — корзинка со светлячками. Снайперы — шест с
 * вымпелом, залп — широкая площадка и четверо.
 */
export function drawTowerAcidJungle(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 15 + lv + (variant === 2 ? 4 : 0);
  const rt = rb - 4;
  const dr = rb + 11;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15);
  if (level >= 2 && variant !== 1) jungleBanner(ctx, x + dr + 2, y + 2, top - 30);
  const bt = top + 4;
  const bot = y + 2;
  buttress(ctx, x - rb * 0.55, bot - 20, x - rb - 11, bot - 3, -1);
  buttress(ctx, x + rb * 0.55, bot - 19, x + rb + 10, bot - 4, 1);
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - rt, bt);
    ctx.lineTo(x + rt, bt);
    ctx.quadraticCurveTo(x + rt + 1, bot - 9, x + rb, bot);
    ctx.ellipse(x, bot, rb, 5, 0, 0, Math.PI);
    ctx.quadraticCurveTo(x - rt - 1, bot - 9, x - rt, bt);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(x - rb, 0, x + rb, 0);
  g.addColorStop(0, BARK.base);
  g.addColorStop(0.25, BARK.hi);
  g.addColorStop(0.6, BARK.base);
  g.addColorStop(1, BARK.lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  ctx.strokeStyle = 'rgba(45,35,20,0.42)';
  ctx.lineWidth = 1.1;
  for (let k = -0.85; k <= 0.86; k += 0.28) {
    ctx.beginPath();
    ctx.moveTo(x + k * rb, bot + 4);
    ctx.quadraticCurveTo(x + k * (rb + rt) * 0.5 + 1.5, (bt + bot) / 2, x + k * rt, bt);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 3 ? 'rgba(210,220,180,0.5)' : 'rgba(150,190,110,0.5)';
    ell(ctx, x + (jit(i + 30) - 0.5) * rb * 1.6, bt + jit(i + 50) * (bot - bt), 1.6 + jit(i + 70) * 2.2, 1 + jit(i + 90), 0.3);
    ctx.fill();
  }
  const sg = ctx.createLinearGradient(0, bt, 0, bt + 14);
  sg.addColorStop(0, 'rgba(25,20,10,0.5)');
  sg.addColorStop(1, 'rgba(25,20,10,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(x - rb, bt, 2 * rb, 14);
  ctx.fillStyle = 'rgba(80,140,50,0.75)';
  for (let i = 0; i < 5; i++) {
    circle(ctx, x - rb * 0.6 + jit(i + 110) * 6, bot - 2 - jit(i + 120) * 8, 1.6 + jit(i + 130) * 1.6);
    ctx.fill();
  }
  ctx.restore();
  body();
  outline(ctx, 2.5);
  ctx.stroke();
  buttress(ctx, x - rb * 0.7, bot - 16, x - rb - 9, y + 8, -1);
  buttress(ctx, x + rb * 0.65, bot - 15, x + rb + 8, y + 9, 1);
  // Лианы со стола вниз по стволу; орхидеи.
  liana(ctx, x - dr * 0.72, top + 6, x - dr * 0.85, top + 24, x - rt * 0.3, bt + 32, 2.2, 3);
  if (lv >= 2) {
    liana(ctx, x + dr * 0.7, top + 6, x + dr * 0.6, top + 30, x + rt * 0.5, bot - 8, 2, 3);
    orchidFlower(ctx, x + rt * 0.2, bt + 18, 1, '#ff5fa2');
    orchidFlower(ctx, x - rt * 0.55, bt + 38, 0.85, '#c45cff');
  }
  monstera(ctx, x - rb - 3, y + 10, 21, -2.75);
  // Плетёная площадка.
  const ry = 9;
  outline(ctx, 2.5);
  ell(ctx, x, top + 4, dr, ry);
  fs(ctx, WICKER.lo);
  ell(ctx, x, top, dr, ry);
  const dg = ctx.createRadialGradient(x - dr * 0.3, top - 3, 2, x, top, dr);
  dg.addColorStop(0, WICKER.hi);
  dg.addColorStop(0.7, WICKER.base);
  dg.addColorStop(1, '#a8823e');
  fs(ctx, dg, false);
  ctx.save();
  ell(ctx, x, top, dr, ry);
  ctx.clip();
  weave(ctx, x - dr, top - ry, x + dr, top + ry, 3.4);
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = WICKER.base;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,60,20,0.6)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const px = x + Math.cos(a) * dr;
    const py = top + Math.sin(a) * ry;
    ctx.beginPath(); ctx.moveTo(px - 1, py - 1.2); ctx.lineTo(px + 1, py + 1.2); ctx.stroke();
  }
  // Частокол из ротанга позади: колья и две плетёные полосы, на крайних кольях перья.
  const posts = 3 + lv;
  const pts: Vec[] = [];
  for (let i = 0; i < posts; i++) {
    const th = Math.PI * 1.06 + ((Math.PI * 0.88) * i) / (posts - 1);
    pts.push({ x: x + Math.cos(th) * dr * 0.9, y: top + Math.sin(th) * ry * 0.9 + 1 });
  }
  for (const p of pts) log(ctx, p.x, p.y + 1, p.x, p.y - 12 - (jit(p.x) - 0.5) * 3, 2.8, WICKER);
  for (const dy of [-4, -9]) {
    for (const [col, lw] of [[OUT, 4.2], [WICKER.base, 2.6]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + dy) : ctx.moveTo(p.x, p.y + dy)));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,60,20,0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < pts.length - 1; i++) {
      for (let t = 0.2; t < 1; t += 0.3) {
        const px = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
        const py = pts[i].y + (pts[i + 1].y - pts[i].y) * t + dy;
        ctx.beginPath(); ctx.moveTo(px - 0.8, py - 1.3); ctx.lineTo(px + 0.8, py + 1.3); ctx.stroke();
      }
    }
  }
  for (const [p, a, i] of [[pts[0], -Math.PI / 2 - 0.5, 0], [pts[pts.length - 1], -Math.PI / 2 + 0.5, 1]] as const) {
    feather(ctx, p.x, p.y - 12, 9, a, FEATHERS[i]);
  }
  // 3-й уровень: корзинка со светлячками на лиане слева.
  if (level >= 3 && variant !== 1) {
    const lx = x - dr - 2;
    liana(ctx, x - dr * 0.8, top + 5, x - dr - 4, top + 6, lx, top + 19, 1.6, 1);
    fireflyBasket(ctx, lx, top + 26);
  }
  if (variant === 1) {
    woodPole(ctx, x + 8, top + 2, top - 46, 3.6);
    pennant(ctx, x + 8, top - 44, 24, 13, '#e8742a');
    feather(ctx, x + 8, top - 46, 9, -Math.PI / 2, FEATHERS[0]);
  }
  const offs: ReadonlyArray<readonly [number, number]> =
    variant === 1 ? [[0, -1]]
      : variant === 2 ? [[-14, -2], [-5, 1], [5, 1], [14, -2]]
        : level === 1 ? [[0, 0]] : level === 2 ? [[-8, 1], [8, -1]] : [[-10, 0], [0, 2], [10, -1]];
  const as = variant === 1 ? 0.78 : 0.6;
  const rx = Math.cos(angle) * recoil * 3;
  const ryk = Math.sin(angle) * recoil * 3;
  for (const [ox, oy] of offs) {
    const ax = x + ox - rx;
    const ay = top + oy - ryk;
    drawAnt(ctx, ax, ay, angle, as, ANT_WORKER, 0, false);
    leafHat(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.4 * as / 0.6, angle);
  }
}

/** Копьё с листовидным наконечником из обсидиана и кисточкой перьев. */
function spear(ctx: Ctx, hx: number, hy: number, tx: number, ty: number): void {
  const len = Math.hypot(tx - hx, ty - hy) || 1;
  const ux = (tx - hx) / len;
  const uy = (ty - hy) / len;
  const nx = uy;
  const ny = -ux;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx - ux * 6, ty - uy * 6); ctx.stroke();
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const bx = tx - ux * 6;
  const by = ty - uy * 6;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + ux * 5 + nx * 4, by + uy * 5 + ny * 4, tx + ux * 7, ty + uy * 7);
  ctx.quadraticCurveTo(bx + ux * 5 - nx * 4, by + uy * 5 - ny * 4, bx, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(bx + nx * 4, by + ny * 4, bx - nx * 4, by - ny * 4);
  g.addColorStop(0, '#6a6a80');
  g.addColorStop(1, '#1e1e2a');
  outline(ctx, 1.5);
  fs(ctx, g);
  vineKnot(ctx, bx - ux * 1.5, by - uy * 1.5, 2.2);
  FEATHERS.forEach((c, i) => feather(ctx, bx - ux * 2, by - uy * 2, 9, Math.atan2(-uy, -ux) + (i - 1) * 0.45 + 0.5, c));
}

/** Щит из надкрылья жука: вытянутый, один край ровнее, переливается от бирюзы к синему, ряды точек. */
function elytraShield(ctx: Ctx, x: number, y: number, s: number, flip: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * s, s);
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(-2, -9);
    ctx.quadraticCurveTo(5.5, -8.5, 5.5, 0);
    ctx.quadraticCurveTo(5, 7, -1, 10);
    ctx.quadraticCurveTo(-2.5, 0, -2, -9);
    ctx.closePath();
  };
  shape();
  const g = ctx.createLinearGradient(-3, -9, 6, 10);
  g.addColorStop(0, '#8ff0d0');
  g.addColorStop(0.45, '#1f9a8a');
  g.addColorStop(1, '#1c3a7a');
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(10,30,40,0.55)';
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 5; k++) {
      circle(ctx, -0.4 + r * 1.8, -5.5 + k * 3 + r * 0.5, 0.5);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ell(ctx, 2.6, -4.5, 0.9, 2.6, 0.2);
  ctx.fill();
  ctx.restore();
}

/** Соломенная крыша из пальмовых листьев: крутой купол, рваный низ, ряды пучков, перевязка у конька. */
function thatchRoof(ctx: Ctx, cx: number, rBase: number, rTop: number, ew: number): void {
  const H = rBase - rTop;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - ew, rBase);
    const n = 14;
    for (let i = 1; i <= n; i++) ctx.lineTo(cx - ew + (2 * ew * i) / n, rBase + (i % 2 ? 3.4 : 0.6) + (i === n ? -0.6 : 0));
    ctx.quadraticCurveTo(cx + ew * 0.62, rTop + H * 0.25, cx + 3, rTop);
    ctx.quadraticCurveTo(cx, rTop - 2, cx - 3, rTop);
    ctx.quadraticCurveTo(cx - ew * 0.62, rTop + H * 0.25, cx - ew, rBase);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(30,20,5,0.35)';
  ell(ctx, cx, rBase + 4, ew * 0.8, 5);
  ctx.fill();
  path();
  const g = ctx.createLinearGradient(cx - ew, rTop, cx + ew, rBase);
  g.addColorStop(0, STRAW.hi);
  g.addColorStop(0.5, STRAW.base);
  g.addColorStop(1, STRAW.lo);
  outline(ctx, 2.6);
  fs(ctx, g);
  ctx.save();
  path();
  ctx.clip();
  const rows = 6;
  for (let k = 0; k < rows; k++) {
    const yy = rBase + 2 - (k * H) / (rows - 0.4);
    ctx.lineWidth = 1;
    for (let sx = cx - ew; sx < cx + ew; sx += 2.2) {
      const j = jit(sx * 3 + k * 17);
      ctx.strokeStyle = j < 0.5 ? 'rgba(110,75,25,0.45)' : 'rgba(255,240,190,0.4)';
      ctx.beginPath(); ctx.moveTo(sx, yy - 7 - j * 2); ctx.lineTo(sx + 0.6, yy + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80,50,15,0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let sx = cx - ew; sx <= cx + ew; sx += 6) {
      ctx.moveTo(sx, yy);
      ctx.quadraticCurveTo(sx + 3, yy + 2.4, sx + 6, yy);
    }
    ctx.stroke();
  }
  const sh = ctx.createLinearGradient(cx - ew, 0, cx + ew, 0);
  sh.addColorStop(0, 'rgba(255,250,220,0.15)');
  sh.addColorStop(1, 'rgba(40,25,5,0.3)');
  ctx.fillStyle = sh;
  ctx.fillRect(cx - ew, rTop - 2, 2 * ew, H + 8);
  ctx.restore();
  // Перевязанный пучок на макушке.
  outline(ctx, 1.8);
  ell(ctx, cx, rTop + 3, 6.5, 4.4);
  fs(ctx, STRAW.hi);
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 1.6;
  for (const dy of [1.4, 4.4]) { ctx.beginPath(); ctx.moveTo(cx - 6, rTop + dy); ctx.quadraticCurveTo(cx, rTop + dy + 1.8, cx + 6, rTop + dy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(110,75,25,0.6)';
  ctx.lineWidth = 0.9;
  for (const k of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(cx + k, rTop - 1); ctx.lineTo(cx + k * 1.2, rTop - 4); ctx.stroke(); }
}

/** Тыква-горлянка на шнурке. */
function gourd(ctx: Ctx, x: number, y: number, s: number): void {
  outline(ctx, 1);
  ctx.beginPath(); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x, y - 5 * s); ctx.stroke();
  const g = ctx.createRadialGradient(x - 1.5 * s, y - 1 * s, 0.5, x, y, 5 * s);
  g.addColorStop(0, '#f6c060');
  g.addColorStop(1, '#a8601e');
  outline(ctx, 1.5);
  circle(ctx, x, y - 4 * s, 2.2 * s);
  fs(ctx, g);
  ell(ctx, x, y + 0.5 * s, 3.8 * s, 3.4 * s);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(120,60,10,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(x, y + 0.5 * s, 3.8 * s, 1.4 * s, 0, 0, Math.PI); ctx.stroke();
}

/**
 * Казарма Джунглей: хижина на сваях над илистой лужей — плетёные стены из ротанга между тёмными
 * столбами, проём с занавесью из листьев, лестница, крутая крыша из пальмовой соломы, лианы и
 * монстера у свай. 2-й уровень — перила веранды, горлянки под стрехой, орхидеи; 3-й — крыша выше,
 * на коньке столб с веером перьев. Броненосцы — щиты из надкрыльев жука, жнецы — копья с перьями.
 */
export function drawTowerBarracksJungle(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const fy = y - 12;
  const ww = 25;
  const wTop = fy - 22;
  const ew = 35 + (lv >= 3 ? 2 : 0);
  const rBase = wTop + 2;
  const rTop = wTop - 21 - (lv - 1) * 3;
  drawShadow(ctx, x + 4, y + 12, 48, 16);
  jungleBanner(ctx, x + 33, y - 6, rTop - 18 - (lv - 1) * 4);
  if (variant === 2) {
    spear(ctx, x - 30, wTop + 4, x + 15, rTop - 26);
    spear(ctx, x + 30, wTop + 4, x - 15, rTop - 26);
  }
  // Илистая лужа под домом.
  ctx.fillStyle = 'rgba(70,45,20,0.6)';
  ell(ctx, x, y + 4, 34, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,185,170,0.35)';
  ell(ctx, x - 8, y + 3, 14, 3.2);
  ctx.fill();
  // Задние сваи, пол, стены.
  for (const s of [-1, 1]) log(ctx, x + s * 18, y - 1, x + s * 18, fy - 2, 4.2);
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - ww - 6, fy); ctx.lineTo(x - ww, fy - 6); ctx.lineTo(x + ww, fy - 6); ctx.lineTo(x + ww + 6, fy);
  ctx.closePath();
  fs(ctx, '#b58a52');
  const wall = (): void => {
    ctx.beginPath();
    ctx.rect(x - ww, wTop, 2 * ww, fy - wTop);
  };
  wall();
  fs(ctx, WICKER.base, false);
  ctx.save();
  wall();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90,60,20,0.45)';
  ctx.lineWidth = 1;
  for (let k = -2 * ww; k < 2 * ww; k += 3.6) {
    ctx.beginPath(); ctx.moveTo(x + k, fy); ctx.lineTo(x + k + 20, wTop); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,240,200,0.3)';
  for (let k = -2 * ww; k < 2 * ww; k += 3.6) {
    ctx.beginPath(); ctx.moveTo(x + k, wTop); ctx.lineTo(x + k + 20, fy); ctx.stroke();
  }
  const ws = ctx.createLinearGradient(x - ww, 0, x + ww, 0);
  ws.addColorStop(0, 'rgba(255,250,220,0.12)');
  ws.addColorStop(1, 'rgba(40,25,5,0.3)');
  ctx.fillStyle = ws;
  ctx.fillRect(x - ww, wTop, 2 * ww, fy - wTop);
  ctx.restore();
  wall();
  outline(ctx, 2.4);
  ctx.stroke();
  for (const s of [-1, 1]) log(ctx, x + s * (ww - 1), fy, x + s * (ww - 1), wTop - 1, 4.4);
  // Окна с прутьями.
  for (const s of [-1, 1]) {
    const wx = x + s * 14.5;
    outline(ctx, 1.4);
    ctx.beginPath();
    ctx.rect(wx - 4, wTop + 7, 8, 7);
    fs(ctx, '#2a1c0c');
    ctx.strokeStyle = LOG.base;
    ctx.lineWidth = 1.2;
    for (const k of [-1.8, 1.8]) { ctx.beginPath(); ctx.moveTo(wx + k, wTop + 7); ctx.lineTo(wx + k, wTop + 14); ctx.stroke(); }
  }
  // Проём с занавесью из листьев.
  outline(ctx, 1.8);
  ctx.beginPath();
  ctx.rect(x - 6.5, fy - 16, 13, 16);
  fs(ctx, '#1e1408');
  for (let i = 0; i < 5; i++) {
    const sx = x - 5.2 + i * 2.6;
    ctx.strokeStyle = i % 2 ? '#4f9a36' : '#6cb83e';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx, fy - 15.5); ctx.quadraticCurveTo(sx + 0.8, fy - 10, sx - 0.3, fy - 6 - (i % 2) * 2); ctx.stroke();
  }
  log(ctx, x - 8, fy - 16.5, x + 8, fy - 16.5, 3, LOG);
  // Пол спереди, передние сваи с обвязкой, лестница.
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.rect(x - ww - 6, fy, 2 * ww + 12, 4.5);
  fs(ctx, LOG.base);
  ctx.strokeStyle = 'rgba(255,220,170,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - ww - 5, fy + 1); ctx.lineTo(x + ww + 5, fy + 1); ctx.stroke();
  for (const s of [-1, 1]) {
    log(ctx, x + s * 24, y + 6, x + s * 24, fy + 4, 5);
    vineKnot(ctx, x + s * 24, fy + 7, 2.6);
  }
  for (const s of [-1, 1]) log(ctx, x - 1 + s * 4.5, y + 9, x + s * 4, fy + 3, 2.4);
  for (let k = 0; k < 4; k++) {
    const ry = y + 6 - k * 4.4;
    log(ctx, x - 5.5, ry, x + 5, ry, 1.8);
  }
  monstera(ctx, x - 34, y + 9, 22, -2.5);
  monstera(ctx, x + 33, y + 10, 19, -0.55, '#3f9a3a');
  if (lv >= 2) {
    // Перила веранды с проходом к двери.
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const px = x + s * (9 + k * 6.3);
        log(ctx, px, fy + 0.5, px, fy - 6, 1.8, WICKER);
      }
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(x + s * 8, fy - 5.5); ctx.lineTo(x + s * (ww + 4), fy - 5.5); ctx.stroke();
      ctx.strokeStyle = VINE;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    orchidFlower(ctx, x - 24, fy + 13, 0.9, '#ff5fa2');
    orchidFlower(ctx, x + 24, fy + 15, 0.8, '#ff8a3c');
  }
  thatchRoof(ctx, x, rBase, rTop, ew);
  if (lv >= 2) for (const s of [-1, 1]) gourd(ctx, x + s * (ew - 7), rBase + 11, 0.9);
  if (lv >= 3) {
    log(ctx, x, rTop + 1, x, rTop - 10, 3.2);
    [-0.9, -0.45, 0, 0.45, 0.9].forEach((da, i) => feather(ctx, x, rTop - 9, 11, -Math.PI / 2 + da, FEATHERS[i % 3]));
    outline(ctx, 1.2);
    circle(ctx, x, rTop - 9, 2.2);
    fs(ctx, '#f2c230');
  }
  if (variant === 1) {
    elytraShield(ctx, x - 34, y - 4, 1.05, 1);
    elytraShield(ctx, x + 34, y - 4, 1.05, -1);
  }
}

/** Цвета грибов-чашечек: светлая внутренность, насыщенный край, тёмный низ чаши. */
interface CupTone { hi: string; base: string; lo: string }

/** Гриб-чашечка (как тропическая куокея): короткая ножка, глубокая чаша с ворсистым краем. */
function cupFungus(ctx: Ctx, x: number, y: number, r: number, stalk: number, tone: CupTone): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.6, y - stalk); ctx.stroke();
  ctx.strokeStyle = tone.base;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  const cy = y - stalk - r * 0.35;
  const ry = r * 0.42;
  // Наружная сторона чаши.
  ctx.beginPath();
  ctx.moveTo(x - r, cy);
  ctx.quadraticCurveTo(x - r * 0.75, cy + r * 0.9, x, cy + r * 0.95);
  ctx.quadraticCurveTo(x + r * 0.75, cy + r * 0.9, x + r, cy);
  ctx.closePath();
  const og = ctx.createLinearGradient(x - r, cy, x + r, cy);
  og.addColorStop(0, tone.base);
  og.addColorStop(1, tone.lo);
  outline(ctx, 1.6);
  fs(ctx, og);
  // Внутренность.
  outline(ctx, 1.6);
  ell(ctx, x, cy, r, ry);
  const ig = ctx.createRadialGradient(x - r * 0.2, cy + ry * 0.2, 0.5, x, cy, r);
  ig.addColorStop(0, tone.lo);
  ig.addColorStop(0.55, tone.base);
  ig.addColorStop(1, tone.hi);
  fs(ctx, ig);
  ctx.strokeStyle = 'rgba(255,240,220,0.75)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const px = x + Math.cos(a) * r;
    const py = cy + Math.sin(a) * ry;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 1.4, py + Math.sin(a) * 1.1 - 0.4); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ell(ctx, x - r * 0.45, cy - ry * 0.2, r * 0.18, ry * 0.25, -0.3);
  ctx.fill();
}

/** Кувшинчик непентеса: трубка в красных крапинах, ребристый край, крышечка и усик. */
function pitcherPlant(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-8, -6, -4, -4); ctx.stroke();
  ctx.strokeStyle = '#5a9a2e';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -15);
  ctx.quadraticCurveTo(-6.5, -6, -5, -1);
  ctx.quadraticCurveTo(0, 3, 5, -1);
  ctx.quadraticCurveTo(6.5, -6, 4, -15);
  ctx.closePath();
  const g = ctx.createLinearGradient(-6, 0, 6, 0);
  g.addColorStop(0, '#b8e070');
  g.addColorStop(0.4, '#8ac040');
  g.addColorStop(1, '#4f7a22');
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(170,30,40,0.7)';
  for (const [dx, dy, r] of [[-2.5, -10, 1], [1.5, -7, 1.2], [-1, -4, 0.9], [3, -11, 0.8], [2.6, -3, 0.9]] as const) {
    circle(ctx, dx, dy, r);
    ctx.fill();
  }
  outline(ctx, 1.5);
  ell(ctx, 0, -15, 4.4, 1.9);
  fs(ctx, '#c83a3a');
  ctx.strokeStyle = 'rgba(255,200,190,0.8)';
  ctx.lineWidth = 0.6;
  for (let k = -3; k <= 3; k += 1.5) { ctx.beginPath(); ctx.moveTo(k, -16.6); ctx.lineTo(k * 1.05, -13.6); ctx.stroke(); }
  ctx.fillStyle = '#3a1210';
  ell(ctx, 0, -15, 2.6, 0.9);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1, -16.5);
  ctx.quadraticCurveTo(-3, -22, 2, -23);
  ctx.quadraticCurveTo(6, -21, 3, -16.8);
  ctx.closePath();
  outline(ctx, 1.4);
  fs(ctx, '#8ac040');
  ctx.restore();
}

/** Бабочка морфо: синие переливчатые крылья с чёрной каймой и белыми точками; flap 0..1 — взмах. */
function morpho(ctx: Ctx, x: number, y: number, s: number, flap: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  const k = 0.3 + 0.7 * Math.abs(Math.cos(flap * Math.PI));
  for (const side of [-1, 1]) {
    for (const [ry, len, w] of [[-1, 7, 5], [1.5, 5, 3.8]] as const) {
      ctx.save();
      ctx.scale(1, k);
      ctx.beginPath();
      ctx.ellipse(side * len * 0.55, ry * 2, len * 0.6, w * 0.6, side * (ry < 0 ? -0.5 : 0.45), 0, TAU);
      const g = ctx.createRadialGradient(side * len * 0.3, ry * 2, 0.5, side * len * 0.55, ry * 2, len * 0.65);
      g.addColorStop(0, '#9ef0ff');
      g.addColorStop(0.6, '#2f72e0');
      g.addColorStop(1, '#152040');
      outline(ctx, 1);
      fs(ctx, g);
      ctx.restore();
    }
  }
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) {
    circle(ctx, side * 6.6, -2.2 * k, 0.5);
    ctx.fill();
  }
  outline(ctx, 0.8);
  ell(ctx, 0, 0, 0.9, 3.6);
  fs(ctx, '#2a2420');
  ctx.restore();
}

/**
 * Грибница Джунглей: поваленное замшелое бревно с пустым надломленным концом и спилом с кольцами,
 * на нём рыжие грибы-чашечки, из чашечек поднимаются споры. 2-й уровень — кувшинчик непентеса и
 * папоротник, 3-й — порхающие синие морфо и орхидея. Гниль — болотные чашечки, дурман — лиловые.
 */
export function drawTowerSporeJungle(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: CupTone = variant === 1
    ? { hi: '#e8ec9a', base: '#a8b03a', lo: '#4f5a14' }
    : variant === 2 ? { hi: '#ffd8ff', base: '#c05ae0', lo: '#5a1a80' } : { hi: '#ffd08a', base: '#f0642a', lo: '#8a2010' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 34, 12);
  if (lv >= 2) pitcherPlant(ctx, x + 25, y + 11, 0.95);
  // Бревно.
  const L = 27;
  const R = 11.5;
  const ly = y - 3;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - L, ly - R);
    ctx.lineTo(x + L - 4, ly - R);
    for (const [dx, dy] of [[0, -R + 2], [-3, -R * 0.4], [2, 0], [-2, R * 0.45], [1, R]] as const) ctx.lineTo(x + L + dx, ly + dy);
    ctx.lineTo(x - L, ly + R);
    ctx.closePath();
  };
  body();
  const bg = ctx.createLinearGradient(0, ly - R, 0, ly + R);
  bg.addColorStop(0, '#9a7a52');
  bg.addColorStop(0.35, '#7a5a38');
  bg.addColorStop(1, '#3e2a18');
  outline(ctx, 2.4);
  fs(ctx, bg);
  ctx.save();
  body();
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,18,6,0.5)';
  ctx.lineWidth = 1;
  for (const k of [-0.6, -0.2, 0.25, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x - L, ly + R * k);
    ctx.bezierCurveTo(x - 10, ly + R * k + 2, x + 8, ly + R * k - 2, x + L, ly + R * k + 1);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(96,160,56,0.9)';
  for (let i = 0; i < 16; i++) {
    circle(ctx, x - L + jit(i + 200) * 2 * L, ly - R + 1 + jit(i + 220) * 4.5, 2 + jit(i + 240) * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(140,200,80,0.8)';
  for (let i = 0; i < 8; i++) {
    circle(ctx, x - L + jit(i + 260) * 2 * L, ly - R + 1 + jit(i + 280) * 2.5, 1.2 + jit(i + 300));
    ctx.fill();
  }
  ctx.restore();
  // Пустой надломленный конец справа.
  ctx.fillStyle = '#1e1408';
  ell(ctx, x + L - 1, ly + 0.5, 3.2, R * 0.65);
  ctx.fill();
  // Спил слева с кольцами.
  outline(ctx, 2);
  ell(ctx, x - L, ly, 5.5, R);
  fs(ctx, '#d8b07a');
  ctx.strokeStyle = 'rgba(120,80,35,0.6)';
  ctx.lineWidth = 0.8;
  for (const k of [0.3, 0.55, 0.8]) { ell(ctx, x - L - 0.3, ly, 5.5 * k, R * k); ctx.stroke(); }
  ctx.fillStyle = 'rgba(96,160,56,0.9)';
  circle(ctx, x - L + 1, ly - R + 1.5, 2.2);
  ctx.fill();
  if (lv >= 2) {
    for (const [a, l] of [[-2.3, 12], [-2.0, 14], [-1.7, 11]] as const) {
      const ex = x - L - 2 + Math.cos(a) * l;
      const ey = ly + R + Math.sin(a) * l * 0.6;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - L + 2, ly + R + 2); ctx.quadraticCurveTo((x - L + ex) / 2, ey - 4, ex, ey); ctx.stroke();
      ctx.strokeStyle = '#4fa544';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  const g = ctx.createRadialGradient(x, ly - 18, 2, x, ly - 18, 40);
  g.addColorStop(0, `rgba(${glow},${0.32 * pulse})`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  circle(ctx, x, ly - 18, 40);
  ctx.fill();
  // Чашечки: [сдвиг по бревну, высота ножки, радиус]; дальние раньше.
  const cups: ReadonlyArray<readonly [number, number, number]> = [[-12, 13, 9], [5, 18, 10.5], [17, 9, 7.5], [-3, 6, 6.8], [-20, 5, 5.6]];
  const grow = variant ? 1.1 : 1;
  const use = cups.slice(0, 2 + lv).sort((a, b) => b[1] - a[1]);
  for (const [dx, st, r] of use) cupFungus(ctx, x + dx, ly - R + 3, r * grow + lv * 0.4, st + lv, tone);
  if (lv >= 3) {
    orchidFlower(ctx, x + 9, ly + 3, 0.95, '#ff5fa2');
    for (let i = 0; i < 2; i++) {
      const t = time * 0.6 + i * 3.1;
      morpho(ctx, x + Math.sin(t) * 22, ly - 30 + Math.cos(t * 1.3) * 8 - i * 10, 0.85, time * 3 + i * 0.5, Math.sin(t) * 0.4);
    }
  }
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const c = use[i % use.length];
    const sx = x + c[0] + Math.sin(time * 1.3 + i * 1.7) * 6 * t;
    const sy = ly - R - c[1] - 4 - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.2 + (1 - t) * 1.6);
    ctx.fill();
  }
}

/** Кокос: волокнистая бурая скорлупа, блик; без «глазков», чтобы не складывалось лицо. */
function coconut(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 1.6);
  ell(ctx, x, y, r, r * 0.9);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.5, x, y, r);
  g.addColorStop(0, '#b8885a');
  g.addColorStop(0.6, '#7a4a24');
  g.addColorStop(1, '#4a2a12');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(40,20,5,0.5)';
  ctx.lineWidth = 0.7;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath(); ctx.moveTo(x + k * r - r * 0.2, y - r * 0.7); ctx.quadraticCurveTo(x + k * r * 1.3, y, x + k * r + r * 0.2, y + r * 0.7); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,190,0.4)';
  ell(ctx, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.17, -0.4);
  ctx.fill();
}

/** Ступенчатый орнамент: сплошная волна из ступенек в полосе шириной w и высотой h (не крючки — те читаются как буквы). */
function stepFret(ctx: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  const s = h * 2.4;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let k = x; k < x + w - 0.5; k += s) {
    const e = Math.min(s, x + w - k);
    const pts: ReadonlyArray<readonly [number, number]> = [
      [0, h * 0.5], [0.25, h * 0.5], [0.25, 0], [0.5, 0], [0.5, h * 0.5], [0.75, h * 0.5], [0.75, h], [1, h],
    ];
    for (const [fx, fy] of pts) ctx.lineTo(k + Math.min(fx * s, e), y + fy);
  }
  ctx.stroke();
}

/** Замшелый блок руин: передняя грань, светлый верх, мох с подтёками, по желанию орнамент. */
function mossyBlock(ctx: Ctx, x: number, y: number, w: number, h: number, tilt: number, seed: number, carved: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2 + 2.5, -h / 2 - 3.5);
  ctx.lineTo(w / 2 + 2.5, -h / 2 - 3.5);
  ctx.lineTo(w / 2, -h / 2);
  ctx.closePath();
  fs(ctx, STONE.hi);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 2);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, STONE.base);
  g.addColorStop(1, STONE.lo);
  fs(ctx, g);
  if (carved) stepFret(ctx, -w / 2 + 2, -h / 2 + 2.5, w - 4, Math.min(5, h * 0.4), 'rgba(30,40,25,0.6)');
  ctx.strokeStyle = 'rgba(30,40,25,0.5)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(w * 0.15, h / 2); ctx.lineTo(w * 0.22, h * 0.1); ctx.lineTo(w * 0.1, -h * 0.1); ctx.stroke();
  ctx.fillStyle = 'rgba(96,160,56,0.95)';
  for (let i = 0; i < 6; i++) {
    const mx = -w / 2 + jit(seed + i) * w;
    circle(ctx, mx, -h / 2 - 1.5, 1.6 + jit(seed + i + 9) * 1.8);
    ctx.fill();
    if (jit(seed + i + 19) < 0.4) {
      ctx.fillRect(mx - 0.8, -h / 2, 1.6, 2 + jit(seed + i + 29) * h * 0.4);
    }
  }
  ctx.restore();
}

/**
 * Катапульта Джунглей: древняя каменная платформа со ступенчатым орнаментом, мох и папоротник;
 * деревянный круг, обвитый лианой; рама из тёмных брёвен на сваях, обвязки лианой; плечо-бревно
 * и чаша из половинки кокоса. 2-й уровень — моток лианы, 3-й — кисти из перьев попугая.
 * Снаряды — кокосы, камнемёт — каменный шар руин, дождь — три кокоса поменьше.
 */
export function drawTowerCatapultJungle(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15);
  const side = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 36, 15, 0, 0, Math.PI);
    ctx.lineTo(x - 36, y + 3);
    ctx.ellipse(x, y + 3, 36, 15, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  side();
  const sg = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
  sg.addColorStop(0, STONE.base);
  sg.addColorStop(0.3, STONE.hi);
  sg.addColorStop(1, STONE.lo);
  outline(ctx, 2.5);
  fs(ctx, sg);
  ctx.save();
  side();
  ctx.clip();
  for (let k = -34; k < 34; k += 6.6) {
    const yy = y + 12 * Math.sqrt(Math.max(0, 1 - (k / 36) ** 2)) + 3;
    stepFret(ctx, x + k, yy - 3.5, 6, 3.2, 'rgba(30,40,25,0.55)');
  }
  ctx.restore();
  ell(ctx, x, y - 2, 36, 15);
  const tg0 = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 36);
  tg0.addColorStop(0, '#cdd3c0');
  tg0.addColorStop(1, STONE.base);
  fs(ctx, tg0);
  ctx.save();
  ell(ctx, x, y - 2, 36, 15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,50,35,0.5)';
  ctx.lineWidth = 1.1;
  for (const [ax, ay, bx, by] of [[-36, -4, -12, -2], [-12, -2, -16, 13], [-12, -2, 10, -12], [10, -12, 22, 4], [22, 4, 36, 0], [22, 4, 16, 14]] as const) {
    ctx.beginPath(); ctx.moveTo(x + ax, y - 2 + ay); ctx.lineTo(x + bx, y - 2 + by); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(96,160,56,0.8)';
  for (let i = 0; i < 10; i++) {
    circle(ctx, x - 32 + jit(i + 500) * 18, y - 2 + (jit(i + 520) - 0.3) * 18, 1.6 + jit(i + 540) * 2);
    ctx.fill();
  }
  ctx.restore();
  // Папоротник у подножия платформы.
  for (const [fx, fy, dir] of [[-31, 13, -1], [29, 12, 1]] as const) {
    for (const [a, l] of [[-2.4, 11], [-1.9, 13], [-1.4, 10]] as const) {
      const ang = dir > 0 ? -Math.PI - a : a;
      const ex = x + fx + Math.cos(ang) * l * 0.7;
      const ey = y + fy + Math.sin(ang) * l;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + fx, y + fy + 2); ctx.quadraticCurveTo(x + fx + dir * 2, ey + 3, ex, ey); ctx.stroke();
      ctx.strokeStyle = '#5cb04a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#5e3a1c');
  ell(ctx, x, ty0, tr, tr * 0.46);
  const tg = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  tg.addColorStop(0, '#b8824a');
  tg.addColorStop(1, '#7a4e26');
  fs(ctx, tg);
  ctx.save();
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,35,12,0.4)';
  ctx.lineWidth = 1;
  for (let k = -tr; k <= tr; k += 6) {
    ctx.beginPath(); ctx.moveTo(x + k, ty0 - tr); ctx.lineTo(x + k, ty0 + tr); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.stroke();
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(225,245,170,0.6)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const px = x + Math.cos(a) * tr;
    const py = ty0 + Math.sin(a) * tr * 0.46;
    ctx.beginPath(); ctx.moveTo(px - 1.2, py - 1.4); ctx.lineTo(px + 1.2, py + 1.4); ctx.stroke();
  }
  for (const a of [0.6, 2.4, 3.9]) vineLeaf(ctx, x + Math.cos(a) * tr, ty0 + Math.sin(a) * tr * 0.46, a, 3);
  // Рама на сваях.
  const lift = 9;
  const corners: ReadonlyArray<readonly [number, number]> = [[-15, -11], [15, -11], [-15, 11], [15, 11]];
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  ctx.save();
  ctx.translate(x + 3, y - 9);
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(30,15,0,0.3)';
  ctx.lineWidth = 6;
  ctx.strokeRect(-15, -11, 30, 22);
  ctx.restore();
  for (const [cx, cy] of [...corners].sort((a, b) => (a[0] * sn + a[1] * cs) - (b[0] * sn + b[1] * cs))) {
    const px = x + cx * cs - cy * sn;
    const py = y - 12 + cx * sn + cy * cs;
    log(ctx, px, py + 1, px, py - lift, 4.4);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  log(ctx, -17, -11, 17, -11, 4.8);
  log(ctx, -17, 11, 17, 11, 4.8);
  log(ctx, -15, 13, -15, -13, 4.8);
  log(ctx, 15, 13, 15, -13, 4.8);
  for (const [cx, cy] of corners) vineKnot(ctx, cx, cy, 3.4);
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-2.5, -12.5, 5, 25);
  fs(ctx, LOG.lo);
  if (lv >= 2) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(-10 + i * 2.6, 0, 4.6 - i * 0.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = VINE;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  if (lv >= 3) {
    for (const [cx, cy] of corners) {
      FEATHERS.forEach((c, i) => feather(ctx, cx, cy, 8, Math.atan2(cy, cx) + (i - 1) * 0.45, c));
    }
  }
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  log(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5);
  // Чаша из половинки кокоса.
  const bw = variant === 2 ? 13 : 9;
  const bh = variant === 2 ? 8 : 6.5;
  outline(ctx, 2.2);
  ell(ctx, tx, ty, bw, bh);
  fs(ctx, '#6a3e1c');
  ctx.strokeStyle = 'rgba(30,15,5,0.5)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(tx + k * bw, ty - bh); ctx.lineTo(tx + k * bw * 1.1, ty + bh); ctx.stroke(); }
  ctx.fillStyle = '#f4ead6';
  ell(ctx, tx, ty, bw * 0.78, bh * 0.72);
  ctx.fill();
  ctx.fillStyle = '#3a2412';
  ell(ctx, tx, ty + 0.4, bw * 0.6, bh * 0.52);
  ctx.fill();
  if (p < 0.5) {
    if (variant === 1) {
      outline(ctx, 2);
      circle(ctx, tx, ty, 7.5);
      const sb = ctx.createRadialGradient(tx - 2.5, ty - 2.5, 0.5, tx, ty, 7.5);
      sb.addColorStop(0, STONE.hi);
      sb.addColorStop(1, STONE.lo);
      fs(ctx, sb);
      ctx.strokeStyle = 'rgba(30,40,25,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(tx, ty, 7.5, 2.6, 0.3, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(96,160,56,0.9)';
      circle(ctx, tx - 2, ty - 5, 1.8); ctx.fill();
      circle(ctx, tx + 1, ty - 5.6, 1.4); ctx.fill();
    } else {
      const cs2: ReadonlyArray<readonly [number, number, number]> = variant === 2 ? [[-5, -0.5, 4], [4, -2, 4], [0, 2.4, 4]] : lv >= 3 ? [[-2.8, 0.4, 4.6], [3.4, -1.4, 4.6]] : [[0, 0, 5.2]];
      for (const [sx, sy, r] of cs2) coconut(ctx, tx + sx, ty + sy, r);
    }
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.5);
  fs(ctx, LOG.base);
  vineKnot(ctx, 0, 0, 3);
  ctx.restore();
}

/** Ворота руин у входа: два столба из блоков, перемычка с меандром, мох, свисающие лианы. */
function ruinGate(ctx: Ctx, x: number, base: number, w: number, h: number): void {
  for (const s of [-1, 1]) {
    const px = x + s * w;
    mossyBlock(ctx, px, base - 7, 13, 14, s * 0.03, 40 + s, false);
    mossyBlock(ctx, px, base - 21, 12, 13, -s * 0.02, 50 + s, false);
    mossyBlock(ctx, px, base - 35, 12.5, 13, s * 0.02, 60 + s, true);
  }
  mossyBlock(ctx, x, base - h + 1, 2 * w + 20, 12, -0.015, 70, true);
  mossyBlock(ctx, x - 3, base - h - 11, 26, 9, 0.02, 80, false);
  liana(ctx, x - w + 6, base - h + 7, x - w + 2, base - h + 18, x - w + 9, base - h + 26, 1.8, 2);
  liana(ctx, x + w - 4, base - h + 7, x + w + 3, base - h + 20, x + w - 7, base - h + 30, 1.8, 3);
  liana(ctx, x - 8, base - h + 7, x - 5, base - h + 14, x - 11, base - h + 17, 1.5, 1);
  orchidFlower(ctx, x + w + 5, base - h - 2, 1, '#ff5fa2');
}

/**
 * Муравейник Джунглей: тот же холм, позади огромные листья, у подножия замшелые блоки руин
 * вперемешку с папоротником, вход в ворота из древних камней с лианами, на холме тканые знамёна
 * с перьями, впереди монстера и орхидеи.
 */
export function drawAnthillJungle(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  monstera(ctx, x - 70, y + 10, 62, -2.25, '#3f9a3a');
  monstera(ctx, x + 66, y - 2, 56, -0.85, '#4fa83e');
  monstera(ctx, x - 92, y + 30, 44, -2.9, '#2f7f2f');
  anthillMound(ctx, x, y, rng);
  const at = (t: number): Vec => {
    const u = 1 - t;
    return { x: u * u * (x - 100) + 2 * u * t * x + t * t * (x + 100), y: u * u * (y + 32) + 2 * u * t * (y + 66) + t * t * (y + 32) };
  };
  let t = 0.03;
  for (let i = 0; t < 0.98; i++) {
    const p = at(t);
    const w = 13 + jit(i + 600) * 7;
    const step = (w + 3 + jit(i + 610) * 6) / 215;
    if (!onPath?.(p.x, p.y - 5)) {
      mossyBlock(ctx, p.x, p.y - 4, w, 8 + jit(i + 620) * 3, (jit(i + 630) - 0.5) * 0.18, 700 + i * 13, i % 3 === 1);
      if (jit(i + 640) < 0.45) {
        for (const [a, l] of [[-1.9, 9], [-1.4, 11], [-1.1, 8]] as const) {
          const ex = p.x + w / 2 + 1 + Math.cos(a) * l * 0.5;
          const ey = p.y - 2 + Math.sin(a) * l;
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(p.x + w / 2 + 1, p.y + 2); ctx.quadraticCurveTo(p.x + w / 2 + 3, ey + 3, ex, ey); ctx.stroke();
          ctx.strokeStyle = '#4fa544';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    }
    t += step;
  }
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    jungleBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  ruinGate(ctx, x, y + 26, 33, 50);
  for (const [px, py, len, a] of [[x - 78, y + 52, 30, -2.6], [x + 80, y + 50, 28, -0.45]] as const) {
    if (!onPath?.(px, py - 4)) monstera(ctx, px, py, len, a);
  }
  const cols = ['#ff5fa2', '#c45cff', '#ff8a3c'];
  for (let i = 0; i < 7; i++) {
    const px = x + rng.range(-120, 120);
    const py = y + rng.range(46, 74);
    if (onPath?.(px, py)) continue;
    orchidFlower(ctx, px, py, rng.range(0.8, 1.05), cols[i % cols.length]);
  }
}
