/**
 * Постройки родного луга (акты 1–2, учебный плац и бесконечная осада): всё в масштабе самих
 * муравьёв и собрано из найденного — веточки на паутинной обвязке, чашечки желудей, живые и
 * сухие листья, лепестки шиповника и его шипы, семечки, камешки, мухоморы, фонарики физалиса.
 * Земля у этих актов разная (яркий луг, ночь, рыжий термитник, тёмная пещера), поэтому
 * цвета тёплые и пёстрые, с контуром: веточка, жёлудь, красный лепесток, оранжевый лист.
 * Детализация на уровне утверждённых наборов: объём, фактура, мелочи.
 */
import { TAU } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, anthillMound, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, beam, jit, type WoodTone } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

const TWIG: WoodTone = { hi: '#d4a870', base: '#8e5e32', lo: '#4e2e14' };
const SILK = '#f6f4ef';

/** Цвета листа: блик, основной, тень. */
interface Tone3 { hi: string; base: string; lo: string }
const GREEN: Tone3 = { hi: '#b8e07a', base: '#5fae45', lo: '#2f6f22' };
const LIME: Tone3 = { hi: '#eef7a4', base: '#b4d040', lo: '#5e7e16' };
const AUTUMN: Tone3 = { hi: '#ffd27a', base: '#e8902e', lo: '#9a4a10' };
const DRY: Tone3 = { hi: '#f2dca6', base: '#c89a5a', lo: '#7a5428' };
const CAP: Tone3 = { hi: '#d8a468', base: '#9a6632', lo: '#5a3616' };

/** Цвета гриба: блик, шляпка, тень, хлопья. */
interface Shroom { hi: string; base: string; lo: string; wart: string }

// ───────────────────────── материалы ─────────────────────────

/** Веточка: брус с корой, почкой-сучком сбоку и тёмной крапиной. */
function twig2(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, seed: number): void {
  beam(ctx, x1, y1, x2, y2, w, TWIG);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 16) return;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const s = jit(seed) < 0.5 ? -1 : 1;
  const nx = -uy * s;
  const ny = ux * s;
  const t = 0.35 + jit(seed + 1) * 0.35;
  const px = x1 + (x2 - x1) * t + nx * w * 0.35;
  const py = y1 + (y2 - y1) * t + ny * w * 0.35;
  const bx = px + nx * w * 0.9 + ux * w * 0.8;
  const by = py + ny * w * 0.9 + uy * w * 0.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w * 0.5 + 1.8;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = TWIG.base;
  ctx.lineWidth = w * 0.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,20,5,0.4)';
  const t2 = 0.15 + jit(seed + 2) * 0.6;
  ell(ctx, x1 + (x2 - x1) * t2, y1 + (y2 - y1) * t2, w * 0.22, w * 0.14, Math.atan2(uy, ux));
  ctx.fill();
}

/** Паутинная обвязка поперёк палки: несколько белых витков с тенью. */
function silk(ctx: Ctx, x: number, y: number, a: number, w: number): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  ctx.lineCap = 'round';
  for (const [col, lw] of [['rgba(50,30,20,0.55)', 2.1], [SILK, 1.05]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    for (let k = -1; k <= 1; k++) {
      const cx = x + ux * k * 1.7;
      const cy = y + uy * k * 1.7;
      ctx.beginPath();
      ctx.moveTo(cx - nx * w * 0.72 - ux * 0.7, cy - ny * w * 0.72 - uy * 0.7);
      ctx.lineTo(cx + nx * w * 0.72 + ux * 0.7, cy + ny * w * 0.72 + uy * 0.7);
      ctx.stroke();
    }
  }
}

/** Чешуйки чашечки жёлудя ромбами внутри текущего клипа. */
function capScales(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, st: number): void {
  let row = 0;
  for (let v = y0; v < y1 + st; v += st * 0.68, row++) {
    for (let u = x0 - st; u < x1 + st; u += st) {
      const uu = u + (row % 2 ? st / 2 : 0);
      ctx.beginPath();
      ctx.moveTo(uu - st * 0.5, v);
      ctx.lineTo(uu, v - st * 0.42);
      ctx.lineTo(uu + st * 0.5, v);
      ctx.lineTo(uu, v + st * 0.42);
      ctx.closePath();
      ctx.fillStyle = 'rgba(230,180,120,0.42)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,8,0.5)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
}

/** Лист от черешка (x, y) к кончику по углу a: средняя жилка, боковые жилки, блик к свету. */
function leafBlade(ctx: Ctx, x: number, y: number, len: number, w: number, a: number, tone: Tone3, lw = 1.4): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.28, -w, len * 0.72, -w * 0.85, len, 0);
  ctx.bezierCurveTo(len * 0.72, w * 0.85, len * 0.28, w, 0, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.45, tone.base);
  g.addColorStop(1, tone.lo);
  outline(ctx, lw);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(40,30,5,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
  ctx.lineWidth = 0.6;
  for (const t of [0.26, 0.46, 0.66]) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.13), s * w * 0.55); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Камешек: неровный овал с бликом и крапом. */
function pebble(ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number): void {
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const k = 0.88 + jit(seed + i) * 0.2;
    ctx.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.5, 0.5, x, y, rx * 1.2);
  g.addColorStop(0, '#e2e0d6');
  g.addColorStop(0.6, '#a6a49a');
  g.addColorStop(1, '#6a6862');
  outline(ctx, 1.5);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(70,65,60,0.45)';
  for (let i = 0; i < 3; i++) {
    circle(ctx, x + (jit(seed + i + 20) - 0.5) * rx, y + (jit(seed + i + 30) - 0.3) * ry * 0.8, 0.55);
    ctx.fill();
  }
}

/** Жёлудь: гладкий орех с бликом и носиком, сверху чашечка с чешуйками и черешком. */
function acorn(ctx: Ctx, x: number, y: number, s: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-4.3, 0);
  ctx.bezierCurveTo(-4.6, 5, -1.6, 8.2, 0, 8.8);
  ctx.bezierCurveTo(1.6, 8.2, 4.6, 5, 4.3, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-4.5, 0, 4.5, 0);
  g.addColorStop(0, '#d8a050');
  g.addColorStop(0.3, '#f2d08a');
  g.addColorStop(1, '#8a5a1e');
  outline(ctx, 1.4);
  fs(ctx, g);
  ctx.fillStyle = '#5a3a14';
  ell(ctx, 0, 8.6, 0.9, 0.7);
  ctx.fill();
  const cap = (): void => {
    ctx.beginPath();
    ctx.moveTo(-5.2, 0.8);
    ctx.bezierCurveTo(-5.4, -4.6, 5.4, -4.6, 5.2, 0.8);
    ctx.quadraticCurveTo(0, 2.2, -5.2, 0.8);
    ctx.closePath();
  };
  cap();
  const cg = ctx.createLinearGradient(-5, -3, 5, 1);
  cg.addColorStop(0, CAP.hi);
  cg.addColorStop(0.5, CAP.base);
  cg.addColorStop(1, CAP.lo);
  outline(ctx, 1.4);
  fs(ctx, cg);
  ctx.save();
  cap();
  ctx.clip();
  capScales(ctx, -6, -4, 6, 2, 2.2);
  ctx.restore();
  cap();
  outline(ctx, 1.4);
  ctx.stroke();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.quadraticCurveTo(0.5, -5, 1.6, -5.6); ctx.stroke();
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
}

/** Шип шиповника: широкое основание, загнутый острый кончик. */
function thorn(ctx: Ctx, x: number, base: number, h: number, lean: number): void {
  const w = h * 0.6;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.quadraticCurveTo(x - w * 0.12, base - h * 0.5, x + lean * h * 0.38, base - h);
  ctx.quadraticCurveTo(x + w * 0.12, base - h * 0.42, x + w / 2, base);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#e07a58');
  g.addColorStop(0.45, '#b84a2c');
  g.addColorStop(1, '#6a1e10');
  outline(ctx, 1.3);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(255,220,190,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - w * 0.32, base - 1); ctx.quadraticCurveTo(x - w * 0.1, base - h * 0.45, x + lean * h * 0.3, base - h * 0.88); ctx.stroke();
}

/** Цветок одуванчика: жёлтый пушистый шарик из коротких лепестков. */
function dandelionHead(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 1.3);
  circle(ctx, x, y, r);
  fs(ctx, '#f2c014');
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + jit(i + 77) * 0.3;
    const r0 = r * (0.2 + jit(i + 90) * 0.3);
    ctx.strokeStyle = i % 2 ? '#ffe56a' : '#d89a10';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); ctx.stroke();
  }
}

/** Одуванчик на стебельке с парой зубчатых листьев у земли. */
function dandelion(ctx: Ctx, x: number, y: number, h: number): void {
  leafBlade(ctx, x, y, h * 0.7, 2.6, -2.7, GREEN, 1.1);
  leafBlade(ctx, x, y, h * 0.6, 2.4, -0.45, GREEN, 1.1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 1, y - h * 0.5, x + 1, y - h); ctx.stroke();
  ctx.strokeStyle = '#6aa83e';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  dandelionHead(ctx, x + 1, y - h - 2, 4.2);
}

/** Ромашка: тонкие белые лепестки в лёгкой перспективе и жёлтая серединка. */
function daisy(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.4); ctx.lineTo(x + 0.6, y + r * 1.9); ctx.stroke();
  ctx.strokeStyle = '#5fa040';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    ctx.fillStyle = 'rgba(110,90,70,0.55)';
    ell(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.5 + 0.4, r * 0.5, r * 0.19, a);
    ctx.fill();
    ctx.fillStyle = '#fffdf6';
    ell(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.5, r * 0.46, r * 0.15, a);
    ctx.fill();
  }
  outline(ctx, 1);
  ell(ctx, x, y, r * 0.32, r * 0.27);
  const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0.3, x, y, r * 0.32);
  g.addColorStop(0, '#ffe46a');
  g.addColorStop(1, '#d8920e');
  fs(ctx, g);
}

/** Клевер: три листочка-сердечка со светлой «галочкой». */
function clover(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + r * 2); ctx.stroke();
  ctx.strokeStyle = '#4f8f34';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
    const cx = x + Math.cos(a) * r * 0.85;
    const cy = y + Math.sin(a) * r * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.75);
    ctx.bezierCurveTo(-r * 1.1, r * 0.1, -r * 0.7, -r * 0.85, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.7, -r * 0.85, r * 1.1, r * 0.1, 0, r * 0.75);
    ctx.closePath();
    outline(ctx, 1.2);
    fs(ctx, '#4a9a38');
    ctx.strokeStyle = 'rgba(200,240,170,0.75)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.05); ctx.lineTo(0, r * 0.25); ctx.lineTo(r * 0.35, -r * 0.05); ctx.stroke();
    ctx.restore();
  }
}

/** Фонарик физалиса: оранжевая бумажная коробочка с рёбрами, внутри светится ягодка. */
function physalis(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, 'rgba(255,170,70,0.55)');
  glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 20);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.quadraticCurveTo(x + 0.5, y - 11, x + 2, y - 12.5); ctx.stroke();
  ctx.strokeStyle = '#6a8a3a';
  ctx.lineWidth = 1;
  ctx.stroke();
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(x, y - 8.5);
    ctx.bezierCurveTo(x + 8, y - 7, x + 7.5, y + 3.5, x, y + 9);
    ctx.bezierCurveTo(x - 7.5, y + 3.5, x - 8, y - 7, x, y - 8.5);
    ctx.closePath();
  };
  shape();
  const g = ctx.createRadialGradient(x - 0.5, y + 0.5, 0.5, x, y, 8.5);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(0.45, '#ffb040');
  g.addColorStop(1, '#cc5a18');
  outline(ctx, 1.5);
  fs(ctx, g);
  ctx.save();
  shape();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,55,10,0.55)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.55, 0, 0.55]) {
    ctx.beginPath(); ctx.moveTo(x, y - 8.5); ctx.quadraticCurveTo(x + k * 11, y, x, y + 9); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,55,10,0.25)';
  for (const dy of [-3, 1.5, 5]) { ctx.beginPath(); ctx.moveTo(x - 7, dy + y); ctx.quadraticCurveTo(x, y + dy + 1.2, x + 7, y + dy); ctx.stroke(); }
  ctx.restore();
}

/**
 * Знамя родного луга: древко-веточка с жёлтым одуванчиком наверху, на перекладине за черешок
 * подвязан паутиной красный осенний лист — жилки, острый кончик внизу, золотой герб.
 */
function leafBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  twig2(ctx, px, ground, px, topY + 2, 4.2, Math.round(px));
  beam(ctx, px - 11.5, topY + 5, px + 11.5, topY + 5, 3, TWIG);
  const y0 = topY + 10;
  const y1 = topY + 46;
  const bw = 10.5;
  // Черешок к перекладине.
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(px, topY + 4); ctx.lineTo(px, y0 + 1); ctx.stroke();
  ctx.strokeStyle = '#8a3a1a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  silk(ctx, px, topY + 5, 0, 3.4);
  const blade = (): void => {
    ctx.beginPath();
    ctx.moveTo(px, y0);
    ctx.bezierCurveTo(px + bw * 0.9, y0 - 1, px + bw * 1.15, y0 + 13, px + bw * 0.62, y0 + 24);
    ctx.quadraticCurveTo(px + bw * 0.3, y1 - 5, px, y1);
    ctx.quadraticCurveTo(px - bw * 0.3, y1 - 5, px - bw * 0.62, y0 + 24);
    ctx.bezierCurveTo(px - bw * 1.15, y0 + 13, px - bw * 0.9, y0 - 1, px, y0);
    ctx.closePath();
  };
  blade();
  const g = ctx.createLinearGradient(px - bw, y0, px + bw, y1);
  g.addColorStop(0, '#ff7a4a');
  g.addColorStop(0.45, '#d8372a');
  g.addColorStop(1, '#8a1a12');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  blade();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,200,90,0.35)';
  ell(ctx, px + bw * 0.35, y1 - 9, bw * 0.5, 5, -0.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,15,5,0.5)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(px, y0 + 1); ctx.lineTo(px, y1 - 1); ctx.stroke();
  ctx.lineWidth = 0.7;
  for (const t of [0.38, 0.55, 0.72]) {
    const vy = y0 + (y1 - y0) * t;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px, vy); ctx.quadraticCurveTo(px + sd * bw * 0.35, vy - 3, px + sd * bw * 0.72, vy - 7); ctx.stroke(); }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,215,190,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px - 2, y0 + 1.2); ctx.bezierCurveTo(px - bw * 0.8, y0 + 0.5, px - bw * 1.02, y0 + 12, px - bw * 0.62, y0 + 22); ctx.stroke();
  antCrest(ctx, px, y0 + 10, 4.4, '#7a1a12');
  dandelionHead(ctx, px, topY - 2, 4.6);
}

/**
 * Шлем из семечки подсолнуха (вид сверху) смотрит по angle: тёмная лузга острым носом вперёд,
 * светлые полоски вдоль, блик слева сверху.
 */
function seedHelmet(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(r * 1.1, 0);
    ctx.bezierCurveTo(r * 0.5, -r * 0.95, -r * 0.95, -r * 0.85, -r * 0.9, 0);
    ctx.bezierCurveTo(-r * 0.95, r * 0.85, r * 0.5, r * 0.95, r * 1.1, 0);
    ctx.closePath();
  };
  shape();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#4a4a52');
  g.addColorStop(1, '#16161a');
  outline(ctx, 1.6);
  fs(ctx, g);
  ctx.save();
  shape();
  ctx.clip();
  ctx.strokeStyle = 'rgba(232,232,222,0.8)';
  ctx.lineWidth = Math.max(0.6, r * 0.13);
  for (const k of [-0.58, -0.2, 0.18, 0.56]) {
    ctx.beginPath(); ctx.moveTo(-r * 0.95, k * r); ctx.quadraticCurveTo(r * 0.1, k * r * 0.95, r * 1.05, k * r * 0.12); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ell(ctx, -r * 0.15, -r * 0.42, r * 0.42, r * 0.12, -0.05);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────── стрелки ─────────────────────────

/**
 * Дозорная вышка луга: каркас из веточек на паутинной обвязке, низ обёрнут сухим дубовым
 * листом, наверху «гнездо» — чашечка жёлудя, по заднему краю шипы шиповника; стрелки в шлемах
 * из семечек. 2-й уровень — знамя-лепесток, клевер и одуванчик у подножия; 3-й — фонарик
 * физалиса. Снайперы — шест с вымпелом, залп — широкая чашечка и четверо.
 */
export function drawTowerAcidMeadow(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 18 + lv + (variant === 2 ? 5 : 0);
  const rt = rb - 3;
  const dr = rt + 9;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15, 0.2);
  if (level >= 2 && variant !== 1) leafBanner(ctx, x + dr + 2, y + 2, top - 32);
  const bot = y + 3;
  const legTop = top + 9;
  // Задние ножки и раскосы.
  twig2(ctx, x - rb * 0.32, bot - 3, x - rt * 0.3, legTop, 3.8, 11);
  twig2(ctx, x + rb * 0.32, bot - 3, x + rt * 0.3, legTop, 3.8, 12);
  const midY = legTop + (bot - legTop) * 0.42;
  twig2(ctx, x - rb * 0.7, midY + 4, x + rt * 0.72, legTop + 3, 3.2, 13);
  twig2(ctx, x + rb * 0.7, midY + 4, x - rt * 0.72, legTop + 3, 3.2, 14);
  // Сухой дубовый лист обёрнут вокруг низа.
  const sTop = bot - (bot - legTop) * 0.46;
  const sw0 = rb * 0.92;
  const sw1 = rb * 0.84;
  const skirt = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - sw0, bot);
    ctx.lineTo(x - sw1, sTop + 2);
    const lobes = 4;
    for (let i = 0; i < lobes; i++) {
      const xa = x - sw1 + (2 * sw1 * i) / lobes;
      const xb = x - sw1 + (2 * sw1 * (i + 1)) / lobes;
      const up = 3.5 + jit(i + lv * 9) * 2;
      ctx.bezierCurveTo(xa + (xb - xa) * 0.05, sTop - up, xb - (xb - xa) * 0.05, sTop - up, xb, sTop + 2);
    }
    ctx.lineTo(x + sw0, bot);
    ctx.ellipse(x, bot, sw0, 5, 0, 0, Math.PI);
    ctx.closePath();
  };
  skirt();
  const sg = ctx.createLinearGradient(x - sw0, 0, x + sw0, 0);
  sg.addColorStop(0, '#b8844a');
  sg.addColorStop(0.28, DRY.hi);
  sg.addColorStop(0.62, DRY.base);
  sg.addColorStop(1, '#6a4420');
  outline(ctx, 2.2);
  fs(ctx, sg);
  ctx.save();
  skirt();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90,55,20,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x - sw0 * 0.6, bot + 4); ctx.quadraticCurveTo(x, (bot + sTop) / 2, x + sw1 * 0.5, sTop - 2); ctx.stroke();
  ctx.lineWidth = 0.6;
  for (const t of [0.25, 0.5, 0.72]) {
    const px = x - sw0 * 0.6 + (sw0 * 0.6 + sw1 * 0.5) * t;
    const py = bot + 4 + (sTop - 2 - bot - 4) * t;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 4); ctx.moveTo(px, py); ctx.lineTo(px + 3, py + 4); ctx.stroke();
  }
  ctx.restore();
  // Подвёрнутый край листа справа.
  ctx.beginPath();
  ctx.moveTo(x + sw0 - 1, bot + 2);
  ctx.quadraticCurveTo(x + sw0 + 3, (bot + sTop) / 2, x + sw1 - 1, sTop + 1);
  ctx.quadraticCurveTo(x + sw1 - 4, (bot + sTop) / 2, x + sw0 - 5, bot + 3);
  ctx.closePath();
  outline(ctx, 1.4);
  fs(ctx, '#e8c88a');
  // Передние ножки и кольцо под гнездом.
  twig2(ctx, x - rb * 0.78, bot, x - rt * 0.74, legTop, 5, 15);
  twig2(ctx, x + rb * 0.78, bot, x + rt * 0.74, legTop, 5, 16);
  beam(ctx, x - rt * 0.8, legTop + 1, x + rt * 0.8, legTop + 1, 3.4, TWIG);
  silk(ctx, x - rt * 0.74, legTop + 1, Math.PI / 2, 5);
  silk(ctx, x + rt * 0.74, legTop + 1, Math.PI / 2, 5);
  silk(ctx, x - rb * 0.77, sTop - 4, Math.PI / 2, 5);
  silk(ctx, x + rb * 0.77, sTop - 4, Math.PI / 2, 5);
  pebble(ctx, x - rb * 0.55, y + 7, 5.5, 3.6, 3);
  pebble(ctx, x + rb * 0.7, y + 8, 4.2, 3, 7);
  if (lv >= 2) {
    clover(ctx, x - rb - 5, y + 5, 3.4);
    dandelion(ctx, x + rb + 6, y + 9, 13);
  }
  // Гнездо — чашечка жёлудя.
  const ry = 9;
  const cupH = 9;
  const band = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, top, dr, ry, 0, Math.PI, 0, true);
    ctx.ellipse(x, top + cupH, dr * 0.86, ry * 0.9, 0, 0, Math.PI);
    ctx.closePath();
  };
  band();
  const bg = ctx.createLinearGradient(x - dr, 0, x + dr, 0);
  bg.addColorStop(0, CAP.base);
  bg.addColorStop(0.25, CAP.hi);
  bg.addColorStop(0.6, CAP.base);
  bg.addColorStop(1, CAP.lo);
  outline(ctx, 2.5);
  fs(ctx, bg);
  ctx.save();
  band();
  ctx.clip();
  capScales(ctx, x - dr, top, x + dr, top + cupH + ry, 4.6);
  const shade = ctx.createLinearGradient(0, top, 0, top + cupH + ry);
  shade.addColorStop(0, 'rgba(30,15,0,0.05)');
  shade.addColorStop(1, 'rgba(30,15,0,0.4)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - dr, top, 2 * dr, cupH + ry + 2);
  ctx.restore();
  band();
  outline(ctx, 2.5);
  ctx.stroke();
  ell(ctx, x, top, dr, ry);
  const ig = ctx.createRadialGradient(x - dr * 0.25, top - 2, 2, x, top, dr);
  ig.addColorStop(0, '#9a6a3c');
  ig.addColorStop(1, '#5a3418');
  fs(ctx, ig, false);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = '#c89058';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, top + 0.6, dr - 0.5, ry - 0.3, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  // Шипы шиповника по заднему краю.
  const n = 5 + lv;
  for (let i = 0; i < n; i++) {
    const th = Math.PI * 1.06 + ((Math.PI * 0.88) * i) / (n - 1);
    const px = x + Math.cos(th) * dr * 0.9;
    const py = top + Math.sin(th) * ry * 0.9 + 1;
    thorn(ctx, px, py + 1, 9 + jit(i + 40) * 3, Math.cos(th) < 0 ? -1 : 1);
  }
  if (level >= 3 && variant !== 1) {
    const lx = x - rb - 6;
    const ly = legTop + 6;
    twig2(ctx, x - rt * 0.7, ly + 1.5, lx - 1, ly - 1, 2.8, 17);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 0.5, ly + 5); ctx.stroke();
    physalis(ctx, lx + 0.5, ly + 14);
  }
  if (variant === 1) {
    twig2(ctx, x + 8, top + 2, x + 8, top - 46, 3.6, 18);
    pennant(ctx, x + 8, top - 44, 24, 13, PAL.flag);
    dandelionHead(ctx, x + 8, top - 48, 3.6);
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
    seedHelmet(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.6 * as / 0.6, angle);
  }
}

// ───────────────────────── казарма ─────────────────────────

/** Копьё с шипом шиповника на конце и паутинной обмоткой. */
function thornSpear(ctx: Ctx, hx: number, hy: number, tx: number, ty: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = TWIG.base;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const a = Math.atan2(ty - hy, tx - hx);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-1, -3);
  ctx.quadraticCurveTo(5, -2.6, 11, 1.2);
  ctx.quadraticCurveTo(5, 1.2, -1, 3);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -3, 0, 3);
  g.addColorStop(0, '#e07a58');
  g.addColorStop(1, '#6a1e10');
  outline(ctx, 1.3);
  fs(ctx, g);
  ctx.restore();
  silk(ctx, tx - Math.cos(a) * 2.5, ty - Math.sin(a) * 2.5, a, 4);
}

/** Щит из осеннего листа: лист кончиком вниз, яркая кромка, веточка-рукоять за ним. */
function leafShield(ctx: Ctx, x: number, y: number, w: number, h: number, tilt: number): void {
  twig2(ctx, x - w * 0.55, y + h * 0.1, x + w * 0.55, y - h * 0.05, 2.6, 21);
  leafBlade(ctx, x + Math.sin(tilt) * h * 0.5, y - h * 0.5, h, w * 0.5, Math.PI / 2 - tilt, AUTUMN, 1.8);
  ctx.strokeStyle = 'rgba(255,240,180,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h * 0.4); ctx.quadraticCurveTo(x - w * 0.42, y, x - w * 0.12, y + h * 0.32); ctx.stroke();
}

/** Вязанка хвороста на паутинной обвязке. */
function twigBundle(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 1, y + 3, 14, 4, 0.2);
  for (const [dy, dx, s] of [[0, 0, 31], [-3.5, 1.5, 32], [-1.5, -1.5, 33], [-6, 0.5, 34]] as const) {
    twig2(ctx, x - 13 + dx, y + dy + 2, x + 12 + dx, y + dy - 2, 3.6, s);
  }
  silk(ctx, x - 4, y - 2, -0.16, 9);
  silk(ctx, x + 5, y - 3.5, -0.16, 9);
}

/**
 * Шалаш из листьев: веточки-жерди скрещены над макушкой, листья черепицей рядами снизу вверх
 * (живые, жёлто-зелёные, сухие и рыжие вперемешку), арка входа из гнутых веточек с тёплым
 * светом и подвязанной занавесью из лепестка. Возвращает y макушки.
 */
function leafHut(ctx: Ctx, x: number, base: number, r: number, h: number, seed: number): number {
  const apex = base - h;
  for (const [dx0, dx1, up] of [[-5, 9, 14], [5, -10, 12], [0, 1.5, 16]] as const) {
    twig2(ctx, x + dx0, apex + 10, x + dx1, apex - up, 3.2, seed + up);
  }
  const wAt = (t: number): number => r * (1 - Math.pow(t, 1.7));
  const dome = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - r, base + 2);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x - wAt(i / 10), base - (i / 10) * h);
    for (let i = 10; i >= 0; i--) ctx.lineTo(x + wAt(i / 10), base - (i / 10) * h);
    ctx.closePath();
  };
  dome();
  const ug = ctx.createLinearGradient(0, base - h, 0, base);
  ug.addColorStop(0, '#3e5a22');
  ug.addColorStop(1, '#2a3414');
  outline(ctx, 2.5);
  fs(ctx, ug);
  const rows = 6;
  const rowH = (h - 4) / rows;
  const tones = [GREEN, GREEN, LIME, DRY, AUTUMN, GREEN, DRY];
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    const yRow = base - i * rowH;
    const w = wAt(t + 0.5 / rows) + 3;
    const n = Math.max(2, Math.round((2 * w) / 8));
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
      const lx = x + u * w * 0.88 + (jit(seed + i * 11 + k) - 0.5) * 2.5;
      const tilt = u * 0.35;
      const tone = tones[Math.floor(jit(seed + i * 7 + k * 3) * tones.length)];
      const len = rowH * 1.75 + jit(seed + k + i) * 2;
      leafBlade(ctx, lx - Math.sin(tilt) * len * 0.2, yRow - len + 3, len, 6, Math.PI / 2 - tilt, tone, 1.3);
    }
  }
  // Тень справа по всему куполу.
  dome();
  const shade = ctx.createLinearGradient(x - r, 0, x + r, 0);
  shade.addColorStop(0, 'rgba(255,250,210,0.1)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(20,30,10,0.3)');
  ctx.fillStyle = shade;
  ctx.fill();
  silk(ctx, x, apex + 1, Math.PI / 2, 6);
  // Вход: тёплый свет, арка из гнутых веточек, занавесь-лепесток подвязана справа.
  const dw = r * 0.34;
  const dTop = base - h * 0.44;
  const glow = ctx.createRadialGradient(x, base - 6, 1, x, base - 6, 20);
  glow.addColorStop(0, 'rgba(255,180,80,0.5)');
  glow.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, base - 6, 20);
  ctx.fill();
  const arch = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - dw, base + 3);
    ctx.lineTo(x - dw, dTop + dw);
    ctx.quadraticCurveTo(x - dw, dTop, x, dTop);
    ctx.quadraticCurveTo(x + dw, dTop, x + dw, dTop + dw);
    ctx.lineTo(x + dw, base + 3);
    ctx.closePath();
  };
  arch();
  const dg = ctx.createLinearGradient(0, dTop, 0, base);
  dg.addColorStop(0, '#5a2a10');
  dg.addColorStop(1, '#f0a050');
  outline(ctx, 2);
  fs(ctx, dg);
  for (const [col, lw] of [[OUT, 5.2], [TWIG.base, 3], [TWIG.hi, 0.9]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - dw - 1, base + 4);
    ctx.lineTo(x - dw - 1, dTop + dw);
    ctx.quadraticCurveTo(x - dw - 1, dTop - 1.5, x, dTop - 1.5);
    ctx.quadraticCurveTo(x + dw + 1, dTop - 1.5, x + dw + 1, dTop + dw);
    ctx.lineTo(x + dw + 1, base + 4);
    ctx.stroke();
  }
  silk(ctx, x, dTop - 1.5, 0, 4);
  ctx.beginPath();
  ctx.moveTo(x + 1, dTop + 1);
  ctx.quadraticCurveTo(x + dw * 0.4, dTop + (base - dTop) * 0.5, x + dw - 0.5, base - 4);
  ctx.lineTo(x + dw, base + 3);
  ctx.lineTo(x + dw * 0.55, base + 3);
  ctx.quadraticCurveTo(x + dw * 0.6, base - 5, x + dw * 0.75, base - 5.5);
  ctx.quadraticCurveTo(x - 1, dTop + (base - dTop) * 0.55, x - 2.5, dTop + 2);
  ctx.closePath();
  const pg = ctx.createLinearGradient(x, dTop, x + dw, base);
  pg.addColorStop(0, '#ff6e5c');
  pg.addColorStop(1, '#a8241a');
  outline(ctx, 1.5);
  fs(ctx, pg);
  silk(ctx, x + dw * 0.72, base - 5, 0.4, 3.2);
  return apex;
}

/**
 * Казарма луга: шалаш из листьев на каркасе из веточек, арка входа, занавесь-лепесток, у
 * подножия камешки. 2-й уровень — вязанка хвороста и клевер, 3-й — шалаш выше, ромашка на
 * макушке и фонарик физалиса у входа. Броненосцы — щиты из осенних листьев, жнецы — копья с шипами.
 */
export function drawTowerBarracksMeadow(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const r = 30 + (lv >= 3 ? 2 : 0);
  const h = 50 + (lv - 1) * 4;
  drawShadow(ctx, x + 4, y + 12, 48, 16, 0.2);
  leafBanner(ctx, x + 37, y - 2, y - h - 20);
  if (variant === 2) {
    thornSpear(ctx, x - 33, y - 6, x + 12, y - h - 16);
    thornSpear(ctx, x + 33, y - 6, x - 12, y - h - 16);
  }
  if (lv >= 2) twigBundle(ctx, x - 33, y + 7);
  const apex = leafHut(ctx, x, y + 3, r, h, 50 + lv * 13);
  pebble(ctx, x - r + 3, y + 8, 5.5, 3.6, 51);
  pebble(ctx, x + r - 7, y + 10, 4.2, 3, 57);
  if (lv >= 2) clover(ctx, x + r - 1, y + 9, 3.2);
  if (lv >= 3) {
    daisy(ctx, x + 1, apex - 9, 6.5);
    twig2(ctx, x + 9, y - 19, x + 19, y - 22, 2.6, 61);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + 18.5, y - 21.5); ctx.lineTo(x + 18.5, y - 17); ctx.stroke();
    physalis(ctx, x + 18.5, y - 8);
  }
  if (variant === 1) {
    leafShield(ctx, x - 36, y - 2, 13, 20, -0.15);
    leafShield(ctx, x + 36, y, 13, 20, 0.15);
  }
}

// ───────────────────────── грибница ─────────────────────────

/**
 * Мухомор: клубень-вольва в чешуйках, ножка с юбочкой, под шляпкой светлые пластинки,
 * шляпка с бликом и неровными белыми хлопьями.
 */
function agaric(ctx: Ctx, x: number, y: number, h: number, cr: number, lean: number, tone: Shroom, seed: number, ring: boolean): void {
  const tx = x + Math.sin(lean) * h;
  const ty = y - Math.cos(lean) * h;
  const sw = cr * 0.3;
  // Клубень.
  outline(ctx, 1.5);
  ell(ctx, x, y - sw * 0.4, sw * 1.35, sw * 0.8);
  fs(ctx, '#f2ead6');
  ctx.strokeStyle = 'rgba(120,100,70,0.5)';
  ctx.lineWidth = 0.7;
  for (const k of [-0.7, -0.2, 0.35, 0.8]) {
    ctx.beginPath(); ctx.moveTo(x + k * sw * 1.2, y - sw * 0.9); ctx.lineTo(x + k * sw * 1.2 + 0.8, y - sw * 0.2); ctx.stroke();
  }
  // Ножка.
  const nx = Math.cos(lean);
  const ny = Math.sin(lean);
  ctx.beginPath();
  ctx.moveTo(x - sw * nx, y - sw * 0.5 - sw * ny);
  ctx.quadraticCurveTo((x + tx) / 2 - sw * 0.85 * nx, (y + ty) / 2, tx - sw * 0.7 * nx, ty);
  ctx.lineTo(tx + sw * 0.7 * nx, ty);
  ctx.quadraticCurveTo((x + tx) / 2 + sw * 0.85 * nx, (y + ty) / 2, x + sw * nx, y - sw * 0.5 + sw * ny);
  ctx.closePath();
  const sg = ctx.createLinearGradient(x - sw, 0, x + sw, 0);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, '#cdbf9e');
  outline(ctx, 1.6);
  fs(ctx, sg);
  if (ring) {
    const rx = x + (tx - x) * 0.72;
    const ry = y + (ty - y) * 0.72;
    ctx.beginPath();
    ctx.moveTo(rx - sw * 1.25, ry + 2.8);
    ctx.quadraticCurveTo(rx - sw * 1.1, ry - 1, rx - sw * 0.5, ry - 1.2);
    ctx.lineTo(rx + sw * 0.5, ry - 1.2);
    ctx.quadraticCurveTo(rx + sw * 1.1, ry - 1, rx + sw * 1.25, ry + 2.8);
    for (let i = 4; i >= 0; i--) ctx.lineTo(rx - sw * 1.25 + (i * 2.5 * sw) / 4, ry + 2.8 + (i % 2 ? 1.4 : 0));
    ctx.closePath();
    outline(ctx, 1.2);
    fs(ctx, '#fbf6ea');
  }
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(lean);
  // Пластинки под шляпкой.
  outline(ctx, 1.4);
  ell(ctx, 0, 0.6, cr * 0.95, cr * 0.22);
  fs(ctx, '#f4ead2');
  ctx.strokeStyle = 'rgba(150,120,80,0.45)';
  ctx.lineWidth = 0.6;
  for (let k = -0.8; k <= 0.81; k += 0.2) { ctx.beginPath(); ctx.moveTo(k * cr * 0.25, 0.6); ctx.lineTo(k * cr * 0.92, 0.6 + cr * 0.16 * (1 - Math.abs(k))); ctx.stroke(); }
  // Шляпка.
  const capPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-cr, 0.4);
    ctx.bezierCurveTo(-cr * 1.02, -cr * 0.95, cr * 1.02, -cr * 0.95, cr, 0.4);
    ctx.quadraticCurveTo(0, cr * 0.2, -cr, 0.4);
    ctx.closePath();
  };
  capPath();
  const g = ctx.createRadialGradient(-cr * 0.35, -cr * 0.55, 0.5, 0, -cr * 0.2, cr * 1.1);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.45, tone.base);
  g.addColorStop(1, tone.lo);
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.save();
  capPath();
  ctx.clip();
  const nW = Math.round(5 + cr * 0.35);
  for (let i = 0; i < nW; i++) {
    const u = (jit(seed + i) * 2 - 1) * cr * 0.85;
    const v = -cr * (0.08 + jit(seed + i + 40) * 0.6) * (1 - (u / cr) ** 2 * 0.5);
    const s = cr * (0.05 + jit(seed + i + 80) * 0.07);
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + jit(seed + i + k) * 0.8;
      ctx.lineTo(u + Math.cos(a) * s * (0.7 + jit(seed + k * 3 + i) * 0.5), v + Math.sin(a) * s * 0.7);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(60,10,5,0.25)';
    ctx.save();
    ctx.translate(0.5, 0.7);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = tone.wart;
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ell(ctx, -cr * 0.4, -cr * 0.5, cr * 0.26, cr * 0.1, -0.5);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Веточка земляники: тройчатые листья и спелая ягода с семечками и зелёной звёздочкой. */
function strawberry(ctx: Ctx, x: number, y: number): void {
  leafBlade(ctx, x, y, 9, 3.6, -2.4, GREEN, 1.1);
  leafBlade(ctx, x, y, 9, 3.6, -1.6, GREEN, 1.1);
  leafBlade(ctx, x, y, 9, 3.6, -0.8, GREEN, 1.1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 7, y - 12, x + 12, y - 7); ctx.stroke();
  ctx.strokeStyle = '#6aa83e';
  ctx.lineWidth = 1;
  ctx.stroke();
  const bx = x + 12.5;
  const by = y - 2;
  ctx.beginPath();
  ctx.moveTo(bx - 3.6, by - 3.5);
  ctx.quadraticCurveTo(bx, by - 5.2, bx + 3.6, by - 3.5);
  ctx.quadraticCurveTo(bx + 3.4, by + 1.5, bx, by + 4.6);
  ctx.quadraticCurveTo(bx - 3.4, by + 1.5, bx - 3.6, by - 3.5);
  ctx.closePath();
  const g = ctx.createRadialGradient(bx - 1.2, by - 1.5, 0.3, bx, by, 5);
  g.addColorStop(0, '#ff8a7a');
  g.addColorStop(0.5, '#e0302a');
  g.addColorStop(1, '#8a1410');
  outline(ctx, 1.2);
  fs(ctx, g);
  ctx.fillStyle = '#ffe07a';
  for (const [dx, dy] of [[-1.6, -1.6], [1, -2], [-0.4, 0.4], [1.6, 0.6], [-1.4, 2], [0.4, 2.8]] as const) {
    ell(ctx, bx + dx, by + dy, 0.35, 0.5);
    ctx.fill();
  }
  ctx.strokeStyle = '#4f8f34';
  ctx.lineWidth = 1.2;
  for (const a of [-2.6, -2, -1.2, -0.5]) {
    ctx.beginPath(); ctx.moveTo(bx, by - 4.2); ctx.lineTo(bx + Math.cos(a) * 3, by - 4.2 + Math.sin(a) * 1.4 + 1); ctx.stroke();
  }
}

/**
 * Грибница луга: земляной бугорок в опавших листьях и мху, семейка мухоморов — большой с
 * юбочкой и клубнем, малыши вокруг. 2-й уровень — больше малышей, одуванчик и клевер; 3-й —
 * второй высокий мухомор и веточка земляники. Гниль — болотные, дурман — лиловые.
 */
export function drawTowerSporeMeadow(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: Shroom = variant === 1
    ? { hi: '#eef0a8', base: '#a8b03a', lo: '#4f5a14', wart: '#f6f2c8' }
    : variant === 2 ? { hi: '#ffe0ff', base: '#b45ad8', lo: '#521a78', wart: '#fbeaff' } : { hi: '#ffa070', base: '#e4442a', lo: '#8a1a10', wart: '#fbf6ea' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 32, 12, 0.2);
  const gl = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 42);
  gl.addColorStop(0, `rgba(${glow},${0.42 * pulse})`);
  gl.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = gl;
  circle(ctx, x, y - 30, 42);
  ctx.fill();
  // Бугорок земли в опавших листьях.
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 27, y + 6);
  ctx.quadraticCurveTo(x - 22, y - 6, x, y - 7);
  ctx.quadraticCurveTo(x + 22, y - 6, x + 27, y + 6);
  ctx.quadraticCurveTo(x, y + 13, x - 27, y + 6);
  ctx.closePath();
  const mg = ctx.createLinearGradient(0, y - 7, 0, y + 12);
  mg.addColorStop(0, '#8a5a32');
  mg.addColorStop(1, '#4e2e14');
  fs(ctx, mg);
  ctx.fillStyle = 'rgba(255,220,170,0.18)';
  for (let i = 0; i < 9; i++) {
    ell(ctx, x - 20 + jit(i + 200) * 40, y - 3 + jit(i + 210) * 10, 1.4, 0.9);
    ctx.fill();
  }
  leafBlade(ctx, x - 26, y + 6, 15, 4.6, -0.25, AUTUMN, 1.3);
  leafBlade(ctx, x + 27, y + 8, 14, 4.4, Math.PI + 0.35, DRY, 1.3);
  leafBlade(ctx, x - 6, y + 11, 12, 4, 0.15, DRY, 1.2);
  ctx.fillStyle = '#7aa83e';
  ell(ctx, x + 10, y - 4, 7, 2.4, -0.1);
  ctx.fill();
  ctx.fillStyle = '#9cc85a';
  ell(ctx, x + 8, y - 4.6, 3.5, 1.1, -0.1);
  ctx.fill();
  if (lv >= 3) agaric(ctx, x - 13, y + 1, 22, 11, -0.22, tone, 301, true);
  agaric(ctx, x + 1, y - 1, 25 + lv * 2, 16 + lv * 1.5 + (variant ? 2 : 0), 0.06, tone, 311, true);
  const small: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [16, 7, 11, 7.5, 0.3], [-17, 8, 9, 6.5, -0.35], [9, 11, 6, 4.6, 0.12], [-7, 12, 5.5, 4.2, -0.18],
  ];
  const nS = [1, 3, 4][lv - 1];
  small.slice(0, nS).forEach(([dx, dy, hh, cr, lean], i) => agaric(ctx, x + dx, y + dy, hh, cr, lean, tone, 330 + i * 17, false));
  if (lv >= 2) {
    dandelion(ctx, x - 27, y + 12, 12);
    clover(ctx, x + 27, y + 10, 3.2);
  }
  if (lv >= 3) strawberry(ctx, x + 18, y + 14);
  const capTop = y - 1 - (25 + lv * 2) - 14;
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 18;
    const sy = capTop - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.4 + (1 - t) * 1.6);
    ctx.fill();
  }
}

// ───────────────────────── катапульта ─────────────────────────

/** Бухта паутинной нити. */
function silkCoil(ctx: Ctx, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(50,30,20,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + i * 2.4, y, 4.4 - i * 0.7, 0, TAU); ctx.stroke();
    ctx.strokeStyle = SILK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

/** Горка желудей у помоста. */
function acornPile(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 1, y + 5, 12, 3.5, 0.2);
  acorn(ctx, x - 5, y - 1, 0.9, -0.5);
  acorn(ctx, x + 5, y, 0.9, 0.6);
  acorn(ctx, x, y - 6, 0.85, 0.1);
}

/**
 * Катапульта луга: помост — плоская речная галька с мхом и лишайником, поворотный круг из
 * коры в ободе из скрученной травинки, рама из веточек на паутинной обвязке, ковш — чашечка
 * жёлудя. 2-й уровень — бухта паутины, 3-й — горка желудей у помоста. Снаряды — жёлуди,
 * камнемёт — галька, дождь — три жёлудя.
 */
export function drawTowerCatapultMeadow(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15, 0.2);
  const side = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 36, 15, 0, 0, Math.PI);
    ctx.lineTo(x - 36, y + 5);
    ctx.ellipse(x, y + 5, 36, 15, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  side();
  const sg = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
  sg.addColorStop(0, '#8e8c84');
  sg.addColorStop(0.3, '#b4b2a8');
  sg.addColorStop(1, '#5a5852');
  outline(ctx, 2.5);
  fs(ctx, sg);
  ell(ctx, x, y - 2, 36, 15);
  const tg0 = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 38);
  tg0.addColorStop(0, '#f0eee6');
  tg0.addColorStop(0.6, '#c2c0b6');
  tg0.addColorStop(1, '#8e8c84');
  fs(ctx, tg0);
  ctx.save();
  ell(ctx, x, y - 2, 36, 15);
  ctx.clip();
  ctx.fillStyle = 'rgba(80,75,70,0.4)';
  for (let i = 0; i < 26; i++) {
    circle(ctx, x - 34 + jit(i + 700) * 68, y - 16 + jit(i + 720) * 28, 0.5 + jit(i + 740) * 0.6);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ell(ctx, x - 16, y - 9, 12, 2.6, -0.12);
  ctx.fill();
  ctx.restore();
  // Мох и лишайник по краю гальки.
  ctx.fillStyle = '#7aa83e';
  ell(ctx, x - 25, y + 7, 9, 3, 0.2);
  ctx.fill();
  ctx.fillStyle = '#9cc85a';
  ell(ctx, x - 27, y + 6, 4, 1.2, 0.2);
  ctx.fill();
  for (const [dx, dy, r] of [[22, 8, 2.2], [27, 5, 1.5], [18, 11, 1.4]] as const) {
    ctx.fillStyle = '#e8b030';
    circle(ctx, x + dx, y + dy, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.7)';
    circle(ctx, x + dx - r * 0.3, y + dy - r * 0.3, r * 0.4);
    ctx.fill();
  }
  clover(ctx, x - 38, y + 9, 3.4);
  if (lv >= 3) acornPile(ctx, x + 38, y + 9);
  else acorn(ctx, x + 34, y + 12, 0.95, 0.9);
  // Поворотный круг из коры.
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#3e2410');
  ell(ctx, x, ty0, tr, tr * 0.46);
  const tg = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  tg.addColorStop(0, '#a4703e');
  tg.addColorStop(1, '#5e3a1c');
  fs(ctx, tg);
  ctx.save();
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.clip();
  for (let k = -tr; k <= tr; k += 5) {
    ctx.strokeStyle = 'rgba(30,15,2,0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let v = -tr * 0.5; v <= tr * 0.5; v += 2) ctx.lineTo(x + k + Math.sin(v * 0.35 + k) * 1.4, ty0 + v);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,190,140,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let v = -tr * 0.5; v <= tr * 0.5; v += 2) ctx.lineTo(x + k + 2 + Math.sin(v * 0.35 + k) * 1.4, ty0 + v);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.stroke();
  ctx.strokeStyle = '#a8b84a';
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = '#6a7a26';
  ctx.setLineDash([2.2, 2.6]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Рама на стойках из веточек.
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
    beam(ctx, px, py + 1, px, py - lift, 4.2, TWIG);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  twig2(ctx, -17, -11, 17, -11, 4.6, 81);
  twig2(ctx, -17, 11, 17, 11, 4.6, 82);
  twig2(ctx, -15, 13, -15, -13, 4.6, 83);
  twig2(ctx, 15, 13, 15, -13, 4.6, 84);
  for (const [cx, cy] of corners) silk(ctx, cx, cy, cx * cy > 0 ? Math.PI / 4 : -Math.PI / 4, 5);
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-2.5, -12.5, 5, 25);
  fs(ctx, TWIG.lo);
  if (lv >= 2) silkCoil(ctx, -12, 0);
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  twig2(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5, 85);
  // Ковш — чашечка жёлудя.
  const bw = variant === 2 ? 13 : 9.5;
  const bh = variant === 2 ? 8 : 6.5;
  outline(ctx, 2.2);
  ell(ctx, tx, ty, bw, bh);
  const cg = ctx.createRadialGradient(tx - bw * 0.3, ty - bh * 0.4, 1, tx, ty, bw);
  cg.addColorStop(0, CAP.hi);
  cg.addColorStop(1, CAP.lo);
  fs(ctx, cg);
  ctx.save();
  ell(ctx, tx, ty, bw, bh);
  ctx.clip();
  capScales(ctx, tx - bw, ty - bh, tx + bw, ty + bh, 3.4);
  ctx.restore();
  ell(ctx, tx, ty, bw, bh);
  outline(ctx, 2.2);
  ctx.stroke();
  ctx.fillStyle = '#4a2a10';
  ell(ctx, tx, ty - 0.6, bw * 0.72, bh * 0.62);
  ctx.fill();
  if (p < 0.5) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-angle);
    if (variant === 1) {
      pebble(ctx, 0, -1, 7, 5.5, 91);
    } else {
      const nuts: ReadonlyArray<readonly [number, number, number]> = variant === 2
        ? [[-5, -3, -0.4], [4.5, -4, 0.4], [0, 0, 0.1]]
        : lv >= 3 ? [[-3, -3, -0.3], [3.5, -3.5, 0.35]] : [[0, -3.5, 0.15]];
      const s = variant === 2 ? 0.72 : lv >= 3 ? 0.8 : 0.95;
      for (const [sx, sy, a] of nuts) acorn(ctx, sx, sy, s, a);
    }
    ctx.restore();
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.2);
  fs(ctx, '#7a4a24');
  ctx.fillStyle = 'rgba(255,230,190,0.55)';
  circle(ctx, -1.5, -1.5, 1.6);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────── муравейник ─────────────────────────

/** Травинка: длинный сужающийся лист с изгибом, со светлой полоской. */
function grassBlade(ctx: Ctx, x: number, base: number, h: number, lean: number, col: string): void {
  const tx = x + lean * h * 0.45;
  const ty = base - h;
  ctx.beginPath();
  ctx.moveTo(x - 2.6, base);
  ctx.quadraticCurveTo(x - 2 + lean * h * 0.05, base - h * 0.6, tx, ty);
  ctx.quadraticCurveTo(x + 2 + lean * h * 0.12, base - h * 0.55, x + 2.6, base);
  ctx.closePath();
  outline(ctx, 1.5);
  fs(ctx, col);
  ctx.strokeStyle = 'rgba(220,255,180,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 0.8, base - 2); ctx.quadraticCurveTo(x - 0.6 + lean * h * 0.06, base - h * 0.55, tx - lean, ty + h * 0.12); ctx.stroke();
}

/** Колокольчик: дугой изогнутый стебель и три синих колокольца с фестонами. */
function bluebell(ctx: Ctx, x: number, base: number, h: number, lean: number): void {
  const tx = x + lean * h * 0.35;
  const ty = base - h;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x - lean * 4, base - h * 0.7, tx, ty); ctx.stroke();
  ctx.strokeStyle = '#5a9a3a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (const [t, dx] of [[1, 3], [0.82, -3], [0.64, 3.5]] as const) {
    const px = x + (tx - x) * t + lean * 2;
    const py = base - h * t;
    const bx = px + dx * lean;
    const by = py + 5;
    ctx.strokeStyle = '#5a9a3a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(bx, py, bx, by - 3.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 1.5, by - 3.8);
    ctx.quadraticCurveTo(bx - 3.8, by - 2, bx - 3.6, by + 2.8);
    ctx.lineTo(bx - 2, by + 2);
    ctx.lineTo(bx - 0.6, by + 3.2);
    ctx.lineTo(bx + 0.8, by + 2);
    ctx.lineTo(bx + 2.2, by + 3.2);
    ctx.lineTo(bx + 3.6, by + 2.8);
    ctx.quadraticCurveTo(bx + 3.8, by - 2, bx + 1.5, by - 3.8);
    ctx.closePath();
    const g = ctx.createLinearGradient(bx - 3.6, 0, bx + 3.6, 0);
    g.addColorStop(0, '#b8c8ff');
    g.addColorStop(0.4, '#7a8ef0');
    g.addColorStop(1, '#3a44a8');
    outline(ctx, 1.1);
    fs(ctx, g);
  }
}

/** Зерно пшеницы: золотистый овал с бороздкой. */
function grain(ctx: Ctx, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  outline(ctx, 1.1);
  ell(ctx, 0, 0, 4.4, 2.5);
  const g = ctx.createLinearGradient(0, -2.5, 0, 2.5);
  g.addColorStop(0, '#f6dc96');
  g.addColorStop(1, '#b88a36');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(120,80,20,0.6)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-3.2, 0.3); ctx.quadraticCurveTo(0, 1, 3.2, 0.3); ctx.stroke();
  ctx.restore();
}

/** Кладовая: горка зерна на сухом листе. */
function grainStore(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 1, y + 4, 18, 5, 0.2);
  leafBlade(ctx, x - 17, y + 2, 34, 8, -0.06, DRY, 1.5);
  const pts: ReadonlyArray<readonly [number, number, number]> = [
    [-9, 1, 0.3], [-3, 2, -0.2], [3, 1.5, 0.5], [9, 1, -0.4], [-6, -2.5, -0.5], [0, -2, 0.2], [6, -2.5, -0.1], [-3, -6, 0.6], [3, -6, -0.4], [0, -9.5, 0.1],
  ];
  for (const [dx, dy, a] of pts) grain(ctx, x + dx, y + dy, a);
}

/**
 * Муравейник родного луга: прежний земляной холм с крошками, камешками и сухими травинками,
 * над главным входом арка из гнутых веточек под навесом-листом, на холме знамёна-лепестки,
 * позади травы и колокольчики, у подножия кладовая с зерном, горка желудей, фонарик физалиса
 * на веточке, ромашки, одуванчики и клевер.
 */
export function drawAnthillMeadow(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  if (!onPath?.(x - 100, y + 14)) {
    grassBlade(ctx, x - 112, y + 30, 64, -0.3, '#4f9a3a');
    bluebell(ctx, x - 98, y + 26, 58, 0.6);
    grassBlade(ctx, x - 102, y + 30, 80, 0.15, '#5fae45');
    grassBlade(ctx, x - 92, y + 30, 50, 0.45, '#3f8a30');
  }
  if (!onPath?.(x + 102, y + 8)) {
    grassBlade(ctx, x + 96, y + 30, 70, -0.25, '#5fae45');
    grassBlade(ctx, x + 108, y + 32, 52, 0.4, '#4f9a3a');
    bluebell(ctx, x + 112, y + 30, 48, -0.7);
  }
  anthillMound(ctx, x, y, rng);
  // Крошки, камешки и сухие травинки на холме.
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - 100, y + 32);
    ctx.bezierCurveTo(x - 75, y - 15, x - 45, y - 72, x, y - 78);
    ctx.bezierCurveTo(x + 45, y - 72, x + 75, y - 15, x + 100, y + 32);
    ctx.quadraticCurveTo(x, y + 66, x - 100, y + 32);
    ctx.closePath();
  };
  ctx.save();
  shape();
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const px = x + rng.range(-85, 85);
    const py = y + rng.range(-66, 36);
    const a = rng.range(-0.9, 0.9) + (rng.next() < 0.5 ? 0 : Math.PI);
    const l = rng.range(5, 11);
    ctx.strokeStyle = i % 3 ? 'rgba(240,215,150,0.6)' : 'rgba(80,45,15,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l * 0.5); ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const px = x + rng.range(-70, 70);
    const py = y + rng.range(-50, 30);
    if (Math.abs(px - x) < 34 && py > y - 22) continue;
    pebble(ctx, px, py, rng.range(2.4, 4.2), rng.range(1.8, 2.8), i * 7 + 400);
  }
  ctx.restore();
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    leafBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  // Арка из гнутых веточек над входом и навес-лист.
  for (const [col, lw] of [[OUT, 8], [TWIG.base, 5.4], [TWIG.hi, 1.6]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 30, y + 18);
    ctx.quadraticCurveTo(x - 32, y - 18, x, y - 18);
    ctx.quadraticCurveTo(x + 32, y - 18, x + 30, y + 18);
    ctx.stroke();
  }
  silk(ctx, x, y - 18, 0, 6);
  silk(ctx, x - 26, y - 6, -1.1, 6);
  silk(ctx, x + 26, y - 6, 1.1, 6);
  leafBlade(ctx, x - 36, y - 10, 76, 15, -0.2, GREEN, 2);
  // Фонарик физалиса на веточке справа от входа.
  if (!onPath?.(x + 56, y + 36)) {
    twig2(ctx, x + 50, y + 44, x + 50, y + 12, 3.6, 501);
    twig2(ctx, x + 50, y + 14, x + 61, y + 10, 2.6, 502);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + 60, y + 10.5); ctx.lineTo(x + 60, y + 16); ctx.stroke();
    physalis(ctx, x + 60, y + 25);
  }
  if (!onPath?.(x - 72, y + 46)) grainStore(ctx, x - 74, y + 50);
  if (!onPath?.(x + 84, y + 48)) acornPile(ctx, x + 86, y + 50);
  const flowers: ReadonlyArray<readonly [number, number, number]> = [
    [x - 30, y + 64, 0], [x + 28, y + 68, 0], [x - 104, y + 52, 1], [x + 110, y + 58, 2], [x + 4, y + 74, 2], [x - 52, y + 70, 1],
  ];
  for (const [px, py, kind] of flowers) {
    if (onPath?.(px, py)) continue;
    if (kind === 0) daisy(ctx, px, py, 6);
    else if (kind === 1) dandelion(ctx, px, py + 6, 11);
    else clover(ctx, px, py, 3.6);
  }
}

