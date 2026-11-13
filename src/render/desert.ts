/**
 * Постройки Пустыни (акт 3): глинобитная архитектура Сахеля и касб — сужающиеся стены из сырца,
 * торчащие пальмовые жерди-тороны, глиняные конусы со страусиными яйцами, индиговые знамёна,
 * медные фонари, расписные кувшины, финиковые пальмы. Уровень детализации равен утверждённым
 * бамбуковым стрелкам Азии: объём градиентами (свет слева сверху), фактура, мелкие детали.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, anthillMound, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, brass, cylGrad, jit, woodPole, type Tone } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

/** Сырец: охра с красниной, темнее песка вокруг, чтобы постройка не сливалась с землёй. */
const ADOBE: Tone = { hi: '#f2c690', base: '#d69c5e', lo: '#a46836', deep: '#7c4a24' };
/** Белёная глина ворот муравейника: светлее холма, чтобы ворота не сливались с ним. */
const LIMEWASH: Tone = { hi: '#fff3dc', base: '#f0d6a8', lo: '#c9a06a', deep: '#8f6a3c' };
/** Песчаник цоколей и основания катапульты. */
const SANDSTONE: Tone = { hi: '#f3dfb0', base: '#d8b97e', lo: '#a98a52', deep: '#7d6436' };

/** Штукатурка по глине внутри текущего клипа: ряды сырца, светлые мазки, тёмные пятна, трещинки. */
function plaster(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  const w = x1 - x0;
  const h = y1 - y0;
  ctx.strokeStyle = 'rgba(110,60,25,0.15)';
  ctx.lineWidth = 1;
  for (let yy = y1 - 5; yy > y0; yy -= 7) {
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.quadraticCurveTo((x0 + x1) / 2, yy + 3, x1, yy);
    ctx.stroke();
  }
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) {
    const px = x0 + jit(seed + i) * w;
    const py = y0 + jit(seed + i + 97) * h;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(100,50,20,0.16)' : 'rgba(255,235,200,0.22)';
    ell(ctx, px, py, 2 + jit(seed + i + 31) * 4, 1.2 + jit(seed + i + 61) * 1.6, (jit(seed + i + 7) - 0.5) * 0.6);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(80,40,15,0.45)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 2; i++) {
    let px = x0 + w * (0.2 + 0.55 * jit(seed + 400 + i));
    let py = y0 + h * (0.3 + 0.45 * jit(seed + 500 + i));
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let k = 0; k < 3; k++) {
      px += (jit(seed + 600 + i * 5 + k) - 0.5) * 5;
      py += 2.5 + jit(seed + 700 + i * 5 + k) * 2;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/** Конец пальмовой жерди, торчащей из стены к зрителю; k — положение по ширине (−1..1), края смотрят вбок. */
function toronStub(ctx: Ctx, sx: number, y: number, k: number): void {
  const dx = k * 2.2;
  const dy = 2 * (1 - Math.abs(k)) + 0.8;
  ctx.fillStyle = 'rgba(70,35,10,0.32)';
  ell(ctx, sx + dx + 1.4, y + dy + 2.4, 2.2, 1.2);
  ctx.fill();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(sx, y - 0.6);
  ctx.lineTo(sx + dx, y + dy);
  ctx.stroke();
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.lineCap = 'round';
  outline(ctx, 1);
  ell(ctx, sx + dx, y + dy + 0.4, 1.9, 1.5);
  fs(ctx, '#d9b07a');
}

/** Ряд торонов поперёк стены; шаг чуть сбит, чтобы ряд не выглядел линейкой. */
function toronRow(ctx: Ctx, cx: number, y: number, half: number, step: number, seed: number): void {
  let i = 0;
  for (let sx = cx - half + step * (0.4 + 0.4 * jit(seed)); sx < cx + half - 2; sx += step + (jit(seed + i) - 0.5) * 2) {
    toronStub(ctx, sx, y + (jit(seed + 40 + i) - 0.5) * 1.6, (sx - cx) / half);
    i++;
  }
}

/** Глиняный конус-пинакл с жердью; egg — страусиное яйцо на макушке, как на мечетях Сахеля. */
function pinnacle(ctx: Ctx, px: number, base: number, h: number, w: number, egg: boolean): void {
  ctx.beginPath();
  ctx.moveTo(px - w, base);
  ctx.quadraticCurveTo(px - w * 0.95, base - h * 0.55, px - w * 0.32, base - h);
  ctx.quadraticCurveTo(px, base - h - w * 0.35, px + w * 0.32, base - h);
  ctx.quadraticCurveTo(px + w * 0.95, base - h * 0.55, px + w, base);
  ctx.closePath();
  outline(ctx, 2);
  fs(ctx, cylGrad(ctx, px - w, px + w, ADOBE));
  ctx.fillStyle = 'rgba(255,235,200,0.35)';
  ell(ctx, px - w * 0.4, base - h * 0.45, w * 0.18, h * 0.25);
  ctx.fill();
  if (h > 11) toronStub(ctx, px, base - h * 0.5, 0);
  if (egg) {
    outline(ctx, 1.4);
    ell(ctx, px, base - h - w * 0.35 - 2.6, 2.3, 3);
    fs(ctx, '#fbf6ea');
    ctx.fillStyle = 'rgba(190,175,150,0.6)';
    ell(ctx, px + 0.8, base - h - w * 0.35 - 2, 1.2, 1.8);
    ctx.fill();
  }
}

/** Индиговое знамя на древке: латунное навершие, перекладина с кистями, хвост-ласточка, золотые каймы, герб. */
function desertBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  woodPole(ctx, px, ground, topY + 2, 4.2);
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(px, topY - 10); ctx.lineTo(px + 2.6, topY - 3.5); ctx.lineTo(px - 2.6, topY - 3.5);
  ctx.closePath();
  fs(ctx, brass(ctx, px - 3, topY - 10, px + 3, topY - 3));
  circle(ctx, px, topY - 1, 3);
  fs(ctx, brass(ctx, px - 3, topY - 4, px + 3, topY + 2));
  const bw = 7.5;
  const y0 = topY + 5;
  const y1 = topY + 37;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px - bw - 3, y0); ctx.lineTo(px + bw + 3, y0); ctx.stroke();
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px - bw, y0);
  ctx.lineTo(px + bw, y0);
  ctx.quadraticCurveTo(px + bw + 1, (y0 + y1) / 2, px + bw, y1);
  ctx.lineTo(px, y1 - 7);
  ctx.lineTo(px - bw, y1);
  ctx.quadraticCurveTo(px - bw + 1, (y0 + y1) / 2, px - bw, y0);
  ctx.closePath();
  const g = ctx.createLinearGradient(px - bw, 0, px + bw, 0);
  g.addColorStop(0, '#26357a');
  g.addColorStop(0.35, '#4361b4');
  g.addColorStop(0.7, '#2c3f88');
  g.addColorStop(1, '#1b275c');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.fillStyle = '#e0b13c';
  ctx.fillRect(px - bw + 1, y0 + 2, 2 * bw - 2, 2);
  ctx.strokeStyle = '#e0b13c';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(px - bw + 1.5, y1 - 4); ctx.lineTo(px, y1 - 10.5); ctx.lineTo(px + bw - 1.5, y1 - 4); ctx.stroke();
  antCrest(ctx, px, y0 + 13, 4.4, '#1b275c');
  for (const s of [-1, 1]) {
    const tx = px + s * (bw + 3);
    ctx.strokeStyle = '#c8452f';
    ctx.lineWidth = 1.3;
    for (const d of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(tx, y0 + 1); ctx.lineTo(tx + d, y0 + 7); ctx.stroke(); }
    outline(ctx, 1);
    circle(ctx, tx, y0 + 1.5, 1.5);
    fs(ctx, '#e0b13c');
  }
}

/** Медный фонарь с прорезным узором: купол, тёмный корпус со светящимися дырочками, поддон с каплей. */
function brassLantern(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 21);
  glow.addColorStop(0, 'rgba(255,200,90,0.55)');
  glow.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 21);
  ctx.fill();
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6);
  ctx.quadraticCurveTo(x - 5.5, y - 12, x, y - 13);
  ctx.quadraticCurveTo(x + 5.5, y - 12, x + 6, y - 6);
  ctx.closePath();
  fs(ctx, brass(ctx, x - 6, y - 13, x + 6, y - 6));
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 4.6, y + 6); ctx.lineTo(x - 4.6, y + 6);
  ctx.closePath();
  fs(ctx, '#4a3010');
  ctx.fillStyle = '#ffe28a';
  for (const [dy, n] of [[-3.3, 4], [0, 3], [3.2, 4]] as const) {
    for (let i = 0; i < n; i++) {
      circle(ctx, x + (i - (n - 1) / 2) * 2.5, y + dy, dy === 0 ? 1.1 : 0.8);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#d8a83e';
  ctx.lineWidth = 0.9;
  for (const k of [-2.4, 2.4]) { ctx.beginPath(); ctx.moveTo(x + k * 1.25, y - 6); ctx.lineTo(x + k, y + 6); ctx.stroke(); }
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 4.6, y + 6); ctx.lineTo(x + 4.6, y + 6); ctx.lineTo(x, y + 11.5);
  ctx.closePath();
  fs(ctx, brass(ctx, x - 5, y + 6, x + 5, y + 12));
  outline(ctx, 1);
  circle(ctx, x, y + 13, 1.3);
  fs(ctx, '#f2c94c');
  ctx.strokeStyle = 'rgba(255,250,220,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 4, y - 8); ctx.quadraticCurveTo(x - 3.5, y - 11, x - 1, y - 11.8); ctx.stroke();
}

/**
 * Индиговый тюрбан (вид сверху): край неровный от складок, витки ткани спиралью к узлу на макушке,
 * свободный конец ткани спадает за голову; смотрит по angle.
 */
function turban(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const sx = -fy;
  const sy = fx;
  // Свободный конец: широкая полоса ткани назад и чуть вбок.
  const tail = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - fx * r * 0.3 + sx * r * 0.45, y - fy * r * 0.3 + sy * r * 0.45);
    ctx.quadraticCurveTo(x - fx * r * 1.5 + sx * r * 0.9, y - fy * r * 1.5 + sy * r * 0.9, x - fx * r * 2.3 + sx * r * 0.5, y - fy * r * 2.3 + sy * r * 0.5 + 1.5);
    ctx.lineTo(x - fx * r * 2.1 - sx * r * 0.1, y - fy * r * 2.1 - sy * r * 0.1 + 1.5);
    ctx.quadraticCurveTo(x - fx * r * 1.3 + sx * r * 0.2, y - fy * r * 1.3 + sy * r * 0.2, x - fx * r * 0.3 - sx * r * 0.3, y - fy * r * 0.3 - sy * r * 0.3);
    ctx.closePath();
  };
  tail();
  outline(ctx, 1.5);
  fs(ctx, '#5a78c8');
  ctx.strokeStyle = 'rgba(20,30,70,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - fx * r * 0.9 + sx * r * 0.35, y - fy * r * 0.9 + sy * r * 0.35);
  ctx.lineTo(x - fx * r * 2 + sx * r * 0.25, y - fy * r * 2 + sy * r * 0.25 + 1.2);
  ctx.stroke();
  const rim = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * TAU;
      const rr = r * (1 + 0.07 * Math.sin(a * 6 + angle * 6));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  rim();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, '#7f9be0');
  g.addColorStop(0.5, '#3c56a8');
  g.addColorStop(1, '#1f2c66');
  outline(ctx, 1.8);
  fs(ctx, g);
  // Витки спиралью: тёмная складка и светлая кромка рядом.
  for (let j = 0; j < 5; j++) {
    const a0 = angle + (j / 5) * TAU;
    const p0x = x + Math.cos(a0) * r * 0.22;
    const p0y = y + Math.sin(a0) * r * 0.22;
    const cx = x + Math.cos(a0 + 0.5) * r * 0.75;
    const cy = y + Math.sin(a0 + 0.5) * r * 0.75;
    const p1x = x + Math.cos(a0 + 1.25) * r * 0.95;
    const p1y = y + Math.sin(a0 + 1.25) * r * 0.95;
    ctx.strokeStyle = 'rgba(12,18,48,0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.quadraticCurveTo(cx, cy, p1x, p1y); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,210,255,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(p0x - 0.6, p0y - 0.6); ctx.quadraticCurveTo(cx - 0.9, cy - 0.9, p1x - 0.8, p1y - 0.8); ctx.stroke();
  }
  outline(ctx, 1);
  circle(ctx, x, y, r * 0.24);
  fs(ctx, '#2a3a86');
}

/** Терракотовый кувшин с ручками: роспись зигзагом или пояс бирюзовой глазури, блик слева. */
function clayPot(ctx: Ctx, x: number, y: number, s: number, glaze: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawShadow(ctx, 3, 1, 11, 3.8, 0.25);
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(-3.6, -17);
    ctx.lineTo(-3.6, -14);
    ctx.bezierCurveTo(-11, -12, -11.5, -2.5, -5, 0);
    ctx.lineTo(5, 0);
    ctx.bezierCurveTo(11.5, -2.5, 11, -12, 3.6, -14);
    ctx.lineTo(3.6, -17);
    ctx.closePath();
  };
  for (const sd of [-1, 1]) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(sd * 3.6, -15.5); ctx.quadraticCurveTo(sd * 9.5, -16, sd * 8.6, -10); ctx.stroke();
    ctx.strokeStyle = '#b4603a';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  body();
  const g = ctx.createLinearGradient(-10, 0, 10, 0);
  g.addColorStop(0, '#c9784a');
  g.addColorStop(0.3, '#eba06a');
  g.addColorStop(0.62, '#b8653c');
  g.addColorStop(1, '#7e3c22');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  body();
  ctx.clip();
  if (glaze) {
    ctx.fillStyle = '#2aa3a0';
    ctx.fillRect(-12, -17, 24, 6.5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-6, -16.5, 2, 5);
    ctx.strokeStyle = '#1d6f73';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) ctx.lineTo(-11 + k * 2.75, -10.5 + (k % 2) * 1.6);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#5e2a14';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) ctx.lineTo(-11 + k * 2.75, -8 + (k % 2 ? -2.6 : 0));
    ctx.stroke();
    ctx.fillStyle = '#f4e4c8';
    for (let k = 0; k < 4; k++) { circle(ctx, -7 + k * 4.6, -4.6, 0.8); ctx.fill(); }
  }
  ctx.restore();
  outline(ctx, 1.6);
  ell(ctx, 0, -17, 4.8, 1.9);
  fs(ctx, '#d88a58');
  ctx.fillStyle = '#3a1a0a';
  ell(ctx, 0, -16.8, 3.2, 1.1);
  ctx.fill();
  ctx.restore();
}

/**
 * Глинобитные стрелки (Пустыня): сужающаяся башня из сырца на песчаниковом цоколе, пилястра,
 * ряды пальмовых жердей, площадка с циновкой, позади глиняные зубцы, по краям конусы со страусиными
 * яйцами; стрелки в тюрбанах. 2-й уровень — индиговое знамя и кувшин у подножия, 3-й — медный фонарь
 * на кронштейне и второй кувшин. Снайперы — высокий шест с вымпелом, залп — широкая башня и четверо.
 */
export function drawTowerAcidDesert(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 19 + lv + (variant === 2 ? 5 : 0);
  const rt = rb - 4;
  const dr = rt + 8;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15);
  if (level >= 2 && variant !== 1) desertBanner(ctx, x + dr + 2, y + 2, top - 30);
  // Цоколь из песчаника.
  outline(ctx, 2.5);
  ell(ctx, x, y + 5, rb + 6, 8);
  fs(ctx, SANDSTONE.lo);
  ell(ctx, x, y + 1, rb + 6, 8);
  let g: CanvasGradient = ctx.createRadialGradient(x - rb * 0.4, y - 3, 2, x, y + 1, rb + 6);
  g.addColorStop(0, SANDSTONE.hi);
  g.addColorStop(1, SANDSTONE.base);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(90,65,25,0.45)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 7; i++) {
    const a = 0.2 + (i / 6) * (Math.PI - 0.4);
    const ex = x + Math.cos(a) * (rb + 6);
    ctx.beginPath();
    ctx.moveTo(ex, y + 1 + Math.sin(a) * 8);
    ctx.lineTo(ex, y + 5 + Math.sin(a) * 8);
    ctx.stroke();
  }
  // Корпус башни: бока чуть выпуклые, как у глиняных мечетей.
  const bot = y + 1;
  const bt = top + 3;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - rt, bt);
    ctx.lineTo(x + rt, bt);
    ctx.quadraticCurveTo(x + rb - 0.5, (bt + bot) / 2, x + rb, bot);
    ctx.ellipse(x, bot, rb, 6, 0, 0, Math.PI);
    ctx.quadraticCurveTo(x - rb + 0.5, (bt + bot) / 2, x - rt, bt);
    ctx.closePath();
  };
  body();
  outline(ctx, 2.5);
  fs(ctx, cylGrad(ctx, x - rb, x + rb, ADOBE));
  ctx.save();
  body();
  ctx.clip();
  plaster(ctx, x - rb, bt, x + rb, bot + 6, 11 + lv * 7 + variant * 3);
  // Пилястра по центру.
  ctx.beginPath();
  ctx.moveTo(x - 5, bot + 7); ctx.lineTo(x - 4, bt); ctx.lineTo(x + 4, bt); ctx.lineTo(x + 5, bot + 7);
  ctx.closePath();
  const pg = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
  pg.addColorStop(0, ADOBE.hi);
  pg.addColorStop(0.5, ADOBE.base);
  pg.addColorStop(1, ADOBE.lo);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,45,15,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  g = ctx.createLinearGradient(0, y - 14, 0, bot + 6);
  g.addColorStop(0, 'rgba(70,35,10,0)');
  g.addColorStop(1, 'rgba(70,35,10,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(x - rb, y - 14, 2 * rb, 22);
  g = ctx.createLinearGradient(0, bt, 0, bt + 13);
  g.addColorStop(0, 'rgba(70,35,10,0.45)');
  g.addColorStop(1, 'rgba(70,35,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - rb, bt, 2 * rb, 13);
  ctx.restore();
  // Окошки-бойницы со стрельчатым верхом и деревянной перемычкой.
  const wy = bt + (bot - bt) * 0.48;
  for (const s of lv >= 2 ? [-1, 1] : [-1]) {
    const wx = x + s * (rt + rb) * 0.27;
    outline(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(wx - 2.6, wy + 4); ctx.lineTo(wx - 2.6, wy - 1); ctx.quadraticCurveTo(wx, wy - 5.5, wx + 2.6, wy - 1); ctx.lineTo(wx + 2.6, wy + 4);
    ctx.closePath();
    fs(ctx, '#2a1408');
    ctx.beginPath();
    ctx.rect(wx - 4.5, wy + 4, 9, 2.2);
    fs(ctx, '#7a5230');
  }
  const rows = lv >= 3 ? [0.18, 0.67, 0.88] : [0.24, 0.76];
  rows.forEach((r, i) => toronRow(ctx, x, bt + (bot - bt) * r, rt + (rb - rt) * r - 2, 8, 50 + i * 13 + lv));
  if (lv >= 2) clayPot(ctx, x - rb - 3, y + 10, 0.78, false);
  if (lv >= 3) clayPot(ctx, x + rb + 2, y + 12, 0.62, true);
  // 3-й уровень: фонарь на деревянном кронштейне слева.
  if (level >= 3 && variant !== 1) {
    const lx = x - rb - 5;
    const ly = bt + 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(x - rt + 2, ly + 1); ctx.lineTo(lx - 1, ly - 1.5); ctx.stroke();
    ctx.strokeStyle = '#8a5a2c';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(lx, ly - 1); ctx.lineTo(lx, ly + 6); ctx.stroke();
    brassLantern(ctx, lx, ly + 19);
  }
  // Площадка: толщина, утоптанная глина, циновка, парапет со светлой кромкой.
  const ry = 9;
  outline(ctx, 2.5);
  ell(ctx, x, top + 4, dr, ry);
  fs(ctx, ADOBE.deep);
  ell(ctx, x, top, dr, ry);
  g = ctx.createRadialGradient(x - dr * 0.3, top - 3, 2, x, top, dr);
  g.addColorStop(0, '#f6d8a8');
  g.addColorStop(0.65, '#dcaa6c');
  g.addColorStop(1, '#b57c44');
  fs(ctx, g, false);
  ctx.fillStyle = '#cfae66';
  ell(ctx, x, top + 0.5, dr * 0.6, ry * 0.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,30,0.45)';
  ctx.lineWidth = 0.9;
  for (const k of [0.2, 0.36, 0.5]) {
    ell(ctx, x, top + 0.5, dr * k, ry * k);
    ctx.stroke();
  }
  ctx.strokeStyle = '#a33a24';
  ctx.lineWidth = 1.6;
  ell(ctx, x, top + 0.5, dr * 0.56, ry * 0.56);
  ctx.stroke();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = ADOBE.base;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, top - 0.8, dr, ry, 0, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  // Зубцы позади, конусы с яйцами по краям.
  const posts = 2 + lv;
  for (let i = 0; i < posts; i++) {
    const th = Math.PI * 1.25 + ((Math.PI * 0.5) * i) / (posts - 1);
    pinnacle(ctx, x + Math.cos(th) * dr * 0.86, top + Math.sin(th) * ry * 0.86 + 1, 8 + ((i * 5) % 3) * 1.6, 4.2, false);
  }
  for (const s of [-1, 1]) pinnacle(ctx, x + s * (dr - 2.5), top + 3, 15 + lv * 2, 5.4, true);
  // Снайперы: высокий шест с вымпелом за стрелком и фонарь сбоку.
  if (variant === 1) {
    woodPole(ctx, x + 8, top + 2, top - 46, 3.6);
    pennant(ctx, x + 8, top - 44, 24, 13, '#c8452f');
    outline(ctx, 1.2);
    circle(ctx, x + 8, top - 47, 2.6);
    fs(ctx, '#f2c94c');
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
    turban(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.6 * as / 0.6, angle);
  }
}

/** Ятаган: рукоять с навершием, золотая гарда, изогнутый клинок с долом; bend — изгиб влево от направления. */
function scimitar(ctx: Ctx, hx: number, hy: number, tx: number, ty: number, bend: number): void {
  const dx = tx - hx;
  const dy = ty - hy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = uy;
  const ny = -ux;
  const gx = hx + ux * len * 0.2;
  const gy = hy + uy * len * 0.2;
  const mx = (gx + tx) / 2;
  const my = (gy + ty) / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4.4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx, gy); ctx.stroke();
  ctx.strokeStyle = '#6b3f1f';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - nx * 2.2, gy - ny * 2.2);
  ctx.quadraticCurveTo(mx + nx * bend * 1.5, my + ny * bend * 1.5, tx, ty);
  ctx.quadraticCurveTo(mx + nx * bend * 0.35, my + ny * bend * 0.35, gx + nx * 2.4, gy + ny * 2.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(gx - nx * 4, gy - ny * 4, gx + nx * 4, gy + ny * 4);
  g.addColorStop(0, '#f6fafc');
  g.addColorStop(1, '#93a3ae');
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(80,95,110,0.6)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(gx + ux * 3, gy + uy * 3);
  ctx.quadraticCurveTo(mx + nx * bend * 0.85, my + ny * bend * 0.85, tx - ux * 6 + nx * 1.5, ty - uy * 6 + ny * 1.5);
  ctx.stroke();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(gx - nx * 5, gy - ny * 5); ctx.lineTo(gx + nx * 5, gy + ny * 5); ctx.stroke();
  ctx.strokeStyle = '#e0b13c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  outline(ctx, 1.2);
  circle(ctx, hx, hy, 2.4);
  fs(ctx, '#e0b13c');
}

/** Ступенчатые зубцы касбы вдоль верха стены от x0 до x1. */
function merlons(ctx: Ctx, x0: number, x1: number, y: number, seed: number): void {
  const n = Math.max(1, Math.round((x1 - x0) / 9));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    const w = step * 0.36;
    const chip = jit(seed + i) < 0.25 ? 1.2 : 0;
    ctx.beginPath();
    ctx.moveTo(cx - w, y);
    ctx.lineTo(cx - w, y - 3);
    ctx.lineTo(cx - w * 0.5, y - 3);
    ctx.lineTo(cx - w * 0.5, y - 6 + chip);
    ctx.lineTo(cx + w * 0.5, y - 6);
    ctx.lineTo(cx + w * 0.5, y - 3);
    ctx.lineTo(cx + w, y - 3);
    ctx.lineTo(cx + w, y);
    ctx.closePath();
    outline(ctx, 1.6);
    fs(ctx, cylGrad(ctx, cx - w, cx + w, ADOBE));
  }
}

/** Ромбовый узор из углублённого кирпича — орнамент верха башен касбы. */
function diamondRelief(ctx: Ctx, cx: number, y: number, half: number, rows: number): void {
  ctx.strokeStyle = 'rgba(95,45,15,0.55)';
  ctx.lineWidth = 1.2;
  const n = Math.max(2, Math.round(half / 3.2));
  const step = (2 * half) / n;
  for (let r = 0; r < rows; r++) {
    const yy = y + r * 5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) ctx.lineTo(cx - half + i * step, yy + (i % 2 ? -2.2 : 2.2));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(95,45,15,0.5)';
  for (let r = 0; r < rows - 1; r++) {
    for (let i = 1; i < n; i += 2) {
      circle(ctx, cx - half + i * step, y + r * 5 + 2.5, 0.9);
      ctx.fill();
    }
  }
}

/** Угловая башня касбы: сужается кверху, ромбовый узор, зубцы; окно с решёткой или бронзовый щит. */
function kasbahTower(ctx: Ctx, cx: number, bottom: number, top: number, wb: number, lattice: boolean, shield: boolean, seed: number): void {
  const wt = wb - 2;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - wb, bottom);
    ctx.lineTo(cx - wt, top);
    ctx.lineTo(cx + wt, top);
    ctx.lineTo(cx + wb, bottom);
    ctx.closePath();
  };
  path();
  outline(ctx, 2.4);
  fs(ctx, cylGrad(ctx, cx - wb, cx + wb, ADOBE));
  ctx.save();
  path();
  ctx.clip();
  plaster(ctx, cx - wb, top, cx + wb, bottom, seed);
  const g = ctx.createLinearGradient(0, bottom - 10, 0, bottom);
  g.addColorStop(0, 'rgba(70,35,10,0)');
  g.addColorStop(1, 'rgba(70,35,10,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - wb, bottom - 10, 2 * wb, 10);
  ctx.restore();
  if (bottom - top > 40) diamondRelief(ctx, cx, top + 6, wt - 1.5, 2);
  if (shield) bronzeShield(ctx, cx, top + (bottom - top) * 0.55, 6.5);
  else if (lattice) {
    const wy = top + (bottom - top) * 0.5;
    outline(ctx, 1.6);
    ctx.beginPath();
    ctx.rect(cx - 3.6, wy - 4, 7.2, 9);
    fs(ctx, '#8a5a2c');
    ctx.fillStyle = '#2a1408';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) ctx.fillRect(cx - 2.8 + i * 2.2, wy - 3.2 + j * 2.1, 1.3, 1.3);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(cx - 4.6, wy + 5, 9.2, 1.8);
  } else {
    outline(ctx, 1.4);
    ctx.beginPath();
    ctx.rect(cx - 1.4, top + (bottom - top) * 0.45, 2.8, 6);
    fs(ctx, '#2a1408');
  }
  toronStub(ctx, cx - wt * 0.5, top + 4, -0.4);
  toronStub(ctx, cx + wt * 0.5, top + 4, 0.4);
  merlons(ctx, cx - wt - 0.5, cx + wt + 0.5, top, seed + 3);
}

/** Круглый бронзовый щит с заклёпками и умбоном. */
function bronzeShield(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2);
  circle(ctx, x, y, r);
  fs(ctx, brass(ctx, x - r, y - r, x + r, y + r));
  ctx.strokeStyle = 'rgba(90,55,10,0.7)';
  ctx.lineWidth = 1.2;
  circle(ctx, x, y, r * 0.68);
  ctx.stroke();
  ctx.fillStyle = '#7a4e12';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    circle(ctx, x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84, 0.8);
    ctx.fill();
  }
  outline(ctx, 1.4);
  circle(ctx, x, y, r * 0.3);
  fs(ctx, '#f2d27a');
  ctx.fillStyle = 'rgba(255,255,240,0.6)';
  ell(ctx, x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.15, -0.5);
  ctx.fill();
}

/** Полосатый шатёр каравана на крыше: конус из индиговых и кремовых клиньев, красная бахрома, вымпел на шесте. */
function caravanTent(ctx: Ctx, cx: number, base: number, r: number, h: number): void {
  const ry = r * 0.34;
  const apx = cx;
  const apy = base - h;
  ctx.fillStyle = 'rgba(60,30,10,0.3)';
  ell(ctx, cx + 2, base + 1.5, r + 1, ry + 1);
  ctx.fill();
  woodPole(ctx, apx, apy + 4, apy - 15, 2.6);
  pennant(ctx, apx, apy - 15, 15, 8, '#c8452f');
  const cone = (): void => {
    ctx.beginPath();
    ctx.moveTo(apx, apy);
    ctx.lineTo(cx + r, base);
    ctx.ellipse(cx, base, r, ry, 0, 0, Math.PI);
    ctx.closePath();
  };
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI;
    const a1 = ((i + 1) / n) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(apx, apy);
    ctx.lineTo(cx + Math.cos(a0) * r, base + Math.sin(a0) * ry);
    ctx.ellipse(cx, base, r, ry, 0, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#f4ead2' : '#2f4796';
    ctx.fill();
  }
  ctx.save();
  cone();
  ctx.clip();
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, 'rgba(255,250,235,0.25)');
  g.addColorStop(0.45, 'rgba(255,250,235,0)');
  g.addColorStop(1, 'rgba(30,15,5,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, apy, 2 * r, h + ry + 2);
  ctx.restore();
  cone();
  outline(ctx, 2.2);
  ctx.stroke();
  // Бахрома: зубчики по нижнему краю и золотые точки.
  for (let i = 0; i < 9; i++) {
    const a = ((i + 0.5) / 9) * Math.PI;
    const px = cx + Math.cos(a) * r;
    const py = base + Math.sin(a) * ry;
    outline(ctx, 1.2);
    ctx.beginPath();
    ctx.moveTo(px - 1.9, py - 0.6);
    ctx.quadraticCurveTo(px, py + 4.2, px + 1.9, py - 0.6);
    ctx.closePath();
    fs(ctx, '#c8452f');
    ctx.fillStyle = '#f2c94c';
    circle(ctx, px, py + 1.2, 0.6);
    ctx.fill();
  }
}

/**
 * Казарма Пустыни: касба из сырца — стена с подковообразной аркой и окованной створкой ворот,
 * ступенчатые зубцы, угловые башни. 2-й уровень — башни выше с ромбовым узором и решётчатыми окнами,
 * полосатый навес над входом; 3-й — полосатый шатёр каравана с вымпелом на крыше.
 * Броненосцы — бронзовые щиты на башнях, жнецы — скрещённые ятаганы над стеной.
 */
export function drawTowerBarracksDesert(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const pw = 40;
  const ww = 26;
  const wallBot = y - 6;
  const wallTop = wallBot - 26;
  drawShadow(ctx, x + 4, y + 12, 50, 17);
  desertBanner(ctx, x + 32, y - 8, wallTop - 52 - (lv - 1) * 8);
  if (variant === 2) {
    scimitar(ctx, x - 26, wallTop - 10, x + 18, wallTop - 58, 7);
    scimitar(ctx, x + 26, wallTop - 10, x - 18, wallTop - 58, -7);
  }
  // Цоколь из песчаника.
  outline(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - pw, y - 2); ctx.lineTo(x - pw + 8, y - 10); ctx.lineTo(x + pw - 8, y - 10); ctx.lineTo(x + pw, y - 2);
  ctx.closePath();
  fs(ctx, SANDSTONE.hi);
  ctx.beginPath();
  ctx.moveTo(x - pw, y - 2); ctx.lineTo(x + pw, y - 2); ctx.lineTo(x + pw - 2, y + 11); ctx.lineTo(x - pw + 2, y + 11);
  ctx.closePath();
  let g: CanvasGradient = ctx.createLinearGradient(0, y - 2, 0, y + 11);
  g.addColorStop(0, SANDSTONE.base);
  g.addColorStop(1, SANDSTONE.lo);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(90,65,25,0.45)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(x - pw + 1, y + 4.5); ctx.lineTo(x + pw - 1, y + 4.5); ctx.stroke();
  for (const [jx, j0, j1] of [[-29, -2, 4.5], [-11, -2, 4.5], [8, -2, 4.5], [27, -2, 4.5], [-21, 4.5, 11], [-1, 4.5, 11], [18, 4.5, 11]] as const) {
    ctx.beginPath(); ctx.moveTo(x + jx, y + j0); ctx.lineTo(x + jx, y + j1); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,245,215,0.45)';
  ctx.fillRect(x - pw + 3, y - 1, 2 * pw - 6, 1.4);
  // Шатёр стоит на крыше за стеной и рисуется раньше неё.
  if (lv >= 3) caravanTent(ctx, x, wallTop - 1, 16, 24);
  // Стена с арочным входом.
  const wall = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - ww, wallBot);
    ctx.lineTo(x - ww + 1.5, wallTop);
    ctx.lineTo(x + ww - 1.5, wallTop);
    ctx.lineTo(x + ww, wallBot);
    ctx.closePath();
  };
  wall();
  outline(ctx, 2.5);
  fs(ctx, cylGrad(ctx, x - ww, x + ww, ADOBE));
  ctx.save();
  wall();
  ctx.clip();
  plaster(ctx, x - ww, wallTop, x + ww, wallBot, 200 + lv);
  g = ctx.createLinearGradient(0, wallBot - 9, 0, wallBot);
  g.addColorStop(0, 'rgba(70,35,10,0)');
  g.addColorStop(1, 'rgba(70,35,10,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(x - ww, wallBot - 9, 2 * ww, 9);
  ctx.restore();
  merlons(ctx, x - 17, x + 17, wallTop, 300);
  for (const s of [-1, 1]) toronStub(ctx, x + s * 13.5, wallTop + 7, s * 0.5);
  // Подковообразная арка: светлое обрамление с клиньями, тёмный проём, левая створка с заклёпками.
  const ar = 7.5;
  const acy = wallBot - 10.5;
  const arch = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - ar * 0.81, wallBot);
    ctx.lineTo(x - ar * 0.81, acy + ar * 0.59);
    ctx.arc(x, acy, ar, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(x + ar * 0.81, wallBot);
    ctx.closePath();
  };
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(x, acy, ar + 2, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
  ctx.strokeStyle = SANDSTONE.hi;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,80,35,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (0.8 + (1.4 * i) / 8);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (ar + 0.2), acy + Math.sin(a) * (ar + 0.2));
    ctx.lineTo(x + Math.cos(a) * (ar + 4.2), acy + Math.sin(a) * (ar + 4.2));
    ctx.stroke();
  }
  arch();
  outline(ctx, 2);
  fs(ctx, '#1a0e06');
  ctx.save();
  arch();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x - ar, acy - ar - 1, ar + 0.5, 30);
  g = ctx.createLinearGradient(x - ar, 0, x, 0);
  g.addColorStop(0, '#9a6232');
  g.addColorStop(1, '#6b3f1f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,5,0.6)';
  ctx.lineWidth = 1;
  for (const k of [-5.6, -2.8]) { ctx.beginPath(); ctx.moveTo(x + k, acy - ar); ctx.lineTo(x + k, wallBot); ctx.stroke(); }
  ctx.fillStyle = '#f2c94c';
  for (const [sx, sy] of [[-6.8, -4], [-4.2, -4], [-1.4, -4], [-6.8, 3], [-4.2, 3], [-1.4, 3]] as const) {
    circle(ctx, x + sx, acy + sy, 0.8);
    ctx.fill();
  }
  ctx.restore();
  // Полосатый навес над аркой (2-й уровень).
  if (lv >= 2) {
    const ay0 = wallTop + 2;
    const ay1 = ay0 + 5;
    const aw0 = 11;
    const aw1 = 14;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      ctx.beginPath();
      ctx.moveTo(x - aw0 + 2 * aw0 * t0, ay0);
      ctx.lineTo(x - aw0 + 2 * aw0 * t1, ay0);
      ctx.lineTo(x - aw1 + 2 * aw1 * t1, ay1);
      ctx.quadraticCurveTo(x - aw1 + 2 * aw1 * (t0 + t1) / 2, ay1 + 3, x - aw1 + 2 * aw1 * t0, ay1);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#f4ead2' : '#c8452f';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x - aw0, ay0); ctx.lineTo(x + aw0, ay0); ctx.lineTo(x + aw1, ay1);
    for (let i = n; i > 0; i--) {
      const t0 = (i - 1) / n;
      const t1 = i / n;
      ctx.quadraticCurveTo(x - aw1 + 2 * aw1 * (t0 + t1) / 2, ay1 + 3, x - aw1 + 2 * aw1 * t0, ay1);
    }
    ctx.closePath();
    outline(ctx, 1.8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,20,5,0.25)';
    ctx.fillRect(x - aw0, ay0, 2 * aw0, 1.6);
  }
  // Угловые башни.
  const tTop = wallTop - 8 - (lv - 1) * 9;
  for (const s of [-1, 1]) kasbahTower(ctx, x + s * (ww + 1), wallBot + 1, tTop, 10, lv >= 2, variant === 1, 400 + s * 17 + lv);
  // Кувшины у входа.
  clayPot(ctx, x - 17, y + 4, 0.62, false);
  if (lv >= 2) clayPot(ctx, x + 17, y + 5, 0.55, true);
}

/** Цвета колпака: светлая макушка, тёмный низ, чешуйки и чернильная бахрома по краю. */
interface CapTone { hi: string; lo: string; scale: string; ink: string }

/**
 * Лохматый пустынный гриб: тонкая ножка с колечком и колокольчатый колпак с редкими чешуйками
 * и чернильной рваной бахромой по краю (как у навозника).
 */
function shaggyCap(ctx: Ctx, bx: number, by: number, len: number, lean: number, crx: number, cry: number, tone: CapTone): void {
  const tx = bx + Math.sin(lean) * len;
  const ty = by - Math.cos(lean) * len;
  const mx = bx + (tx - bx) * 0.4;
  ctx.beginPath();
  ctx.moveTo(bx - 2.3, by);
  ctx.quadraticCurveTo(mx - 1.5, by - len * 0.5, tx - 1.3, ty);
  ctx.lineTo(tx + 1.3, ty);
  ctx.quadraticCurveTo(mx + 1.5, by - len * 0.5, bx + 2.3, by);
  ctx.closePath();
  const sg = ctx.createLinearGradient(bx - 2.5, 0, bx + 2.5, 0);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, '#cdbb98');
  outline(ctx, 1.6);
  fs(ctx, sg);
  const rx = bx + (tx - bx) * 0.72;
  const ryy = by - len * 0.72;
  outline(ctx, 1.1);
  ell(ctx, rx, ryy, 2.8, 1.1, lean);
  fs(ctx, '#f6efe0');
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(lean);
  const cap = (): void => {
    ctx.beginPath();
    ctx.moveTo(-crx, 1.5);
    ctx.bezierCurveTo(-crx * 0.95, -cry * 0.5, -crx * 0.72, -cry * 1.28, 0, -cry * 1.38);
    ctx.bezierCurveTo(crx * 0.72, -cry * 1.28, crx * 0.95, -cry * 0.5, crx, 1.5);
    for (let i = 7; i >= 0; i--) ctx.lineTo(-crx + (2 * crx * i) / 7, 1.5 + (i % 2 ? 2.4 : 0));
    ctx.closePath();
  };
  cap();
  const g = ctx.createRadialGradient(-crx * 0.4, -cry * 1.05, 0.5, 0, -cry * 0.4, cry * 1.6);
  g.addColorStop(0, tone.hi);
  g.addColorStop(1, tone.lo);
  outline(ctx, 1.8);
  fs(ctx, g);
  ctx.save();
  cap();
  ctx.clip();
  const ig = ctx.createLinearGradient(0, -0.5, 0, 4);
  ig.addColorStop(0, 'rgba(0,0,0,0)');
  ig.addColorStop(0.6, tone.ink);
  ctx.fillStyle = ig;
  ctx.fillRect(-crx - 1, -0.5, 2 * crx + 2, 6);
  ctx.restore();
  ctx.strokeStyle = tone.scale;
  ctx.lineWidth = 1.1;
  for (const [sx, sy] of [[-0.42, -0.95], [0.22, -1.08], [0.5, -0.62], [-0.12, -0.6], [-0.6, -0.35], [0.3, -0.28]] as const) {
    const px = sx * crx;
    const py = sy * cry;
    ctx.beginPath();
    ctx.moveTo(px - 1.3, py);
    ctx.quadraticCurveTo(px, py + 2.1, px + 1.3, py + 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,245,0.55)';
  ell(ctx, -crx * 0.42, -cry * 0.95, crx * 0.17, cry * 0.32, 0.25);
  ctx.fill();
  ctx.restore();
}

/** Большой расписной кувшин с широким горлом: берберский пояс треугольников, точки; glaze — бирюзовое горло. */
function bigJar(ctx: Ctx, x: number, y: number, w: number, h: number, glaze: boolean): number {
  const rimY = y - h;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, rimY + 1);
    ctx.lineTo(x - w * 0.6, rimY + 5);
    ctx.bezierCurveTo(x - w * 1.15, rimY + h * 0.3, x - w * 1.1, y - h * 0.15, x - w * 0.58, y);
    ctx.lineTo(x + w * 0.58, y);
    ctx.bezierCurveTo(x + w * 1.1, y - h * 0.15, x + w * 1.15, rimY + h * 0.3, x + w * 0.6, rimY + 5);
    ctx.lineTo(x + w * 0.62, rimY + 1);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, '#c9784a');
  g.addColorStop(0.28, '#f0a872');
  g.addColorStop(0.62, '#bd6a40');
  g.addColorStop(1, '#7a3a20');
  outline(ctx, 2.5);
  fs(ctx, g);
  ctx.save();
  body();
  ctx.clip();
  const by = rimY + h * 0.42;
  ctx.fillStyle = '#f2dcc0';
  ctx.fillRect(x - w * 1.2, by - 4, w * 2.4, 9);
  ctx.fillStyle = '#5e2a14';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const px = x - w * 1.05 + (i * w * 2.1) / (n - 1);
    ctx.beginPath();
    ctx.moveTo(px - 3, by + 5); ctx.lineTo(px, by - 4); ctx.lineTo(px + 3, by + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#5e2a14';
  ctx.lineWidth = 1.4;
  for (const yy of [by - 5, by + 6]) {
    ctx.beginPath(); ctx.moveTo(x - w * 1.2, yy); ctx.quadraticCurveTo(x, yy + 2.5, x + w * 1.2, yy); ctx.stroke();
  }
  ctx.fillStyle = '#5e2a14';
  for (let i = 0; i < 6; i++) {
    circle(ctx, x - w * 0.75 + (i * w * 1.5) / 5, y - h * 0.18, 1);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,240,215,0.35)';
  ell(ctx, x - w * 0.55, rimY + h * 0.62, w * 0.12, h * 0.16);
  ctx.fill();
  ctx.restore();
  outline(ctx, 2.2);
  ell(ctx, x, rimY + 1, w * 0.72, 4.4);
  fs(ctx, glaze ? '#2aa3a0' : '#e09868');
  if (glaze) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, rimY + 0.4, w * 0.62, 3.2, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  }
  ctx.fillStyle = '#3a1a0a';
  ell(ctx, x, rimY + 1.6, w * 0.55, 2.6);
  ctx.fill();
  return rimY + 1;
}

/** Медная курильница: ножка, чаша с тлеющими углями и дымок цвета спор. */
function censer(ctx: Ctx, x: number, y: number, time: number, rgb: string): void {
  drawShadow(ctx, x + 2, y + 1, 9, 3, 0.25);
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + 3.6, y - 4); ctx.lineTo(x - 3.6, y - 4);
  ctx.closePath();
  fs(ctx, brass(ctx, x - 6, y - 4, x + 6, y));
  ctx.beginPath();
  ctx.rect(x - 1.8, y - 9, 3.6, 5);
  fs(ctx, brass(ctx, x - 2, y - 9, x + 2, y - 4));
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 11);
  ctx.quadraticCurveTo(x - 6, y - 7, x, y - 7);
  ctx.quadraticCurveTo(x + 6, y - 7, x + 8, y - 11);
  ctx.closePath();
  fs(ctx, brass(ctx, x - 8, y - 12, x + 8, y - 7));
  ell(ctx, x, y - 11, 8, 2.4);
  fs(ctx, '#3a1a0a');
  ctx.fillStyle = '#ff9a3a';
  for (const [cx, r] of [[-3, 1.1], [0.5, 1.4], [3.5, 1]] as const) {
    circle(ctx, x + cx, y - 11.2, r);
    ctx.fill();
  }
  for (let k = 0; k < 3; k++) {
    const t = (time * 0.4 + k / 3) % 1;
    ctx.fillStyle = `rgba(${rgb},${0.38 * (1 - t)})`;
    circle(ctx, x + Math.sin(time * 1.5 + k * 2.1) * 4 * t, y - 14 - t * 30, 2.6 + t * 4);
    ctx.fill();
  }
}

/**
 * Грибница Пустыни: большой расписной кувшин, из горла растут лохматые пустынные грибы (тонкая
 * ножка с колечком, колокольчатый колпак с чернильной бахромой), вокруг светятся споры. 2-й уровень — плетёная циновка и малый
 * кувшин с грибком, 3-й — бирюзовое горло и медная курильница с дымком. Гниль — болотный, дурман — лиловый.
 */
export function drawTowerSporeDesert(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: CapTone = variant === 1
    ? { hi: '#e6e0a0', lo: '#7a7428', scale: '#45410e', ink: '#2e2c0a' }
    : variant === 2 ? { hi: '#f2e0ff', lo: '#8a4cc0', scale: '#3c1460', ink: '#2a0c40' } : { hi: '#fdf6e8', lo: '#c49a68', scale: '#7a5230', ink: '#2c2230' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 32, 12);
  if (lv >= 2) {
    outline(ctx, 2);
    ell(ctx, x, y + 6, 30, 9);
    fs(ctx, '#c9a35c');
    ctx.strokeStyle = 'rgba(120,80,30,0.5)';
    ctx.lineWidth = 1;
    for (const k of [0.3, 0.5, 0.7]) { ell(ctx, x, y + 6, 30 * k, 9 * k); ctx.stroke(); }
    for (const [k, col] of [[0.88, '#a33a24'], [0.8, '#2c3f88']] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ell(ctx, x, y + 6, 30 * k, 9 * k);
      ctx.stroke();
    }
  }
  if (lv >= 2) {
    clayPot(ctx, x + 23, y + 10, 0.6, true);
    shaggyCap(ctx, x + 23, y - 0.5, 9, 0.35, 3.8, 3.8, tone);
  }
  if (lv >= 3) censer(ctx, x - 24, y + 12, time, glow);
  const rimY = bigJar(ctx, x, y + 6, 21, 26, lv >= 3);
  const g = ctx.createRadialGradient(x, rimY - 22, 2, x, rimY - 22, 38);
  g.addColorStop(0, `rgba(${glow},${0.38 * pulse})`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  circle(ctx, x, rimY - 22, 38);
  ctx.fill();
  // Грибы: [сдвиг по горлу, наклон, высота ножки, ширина и высота колпака]; дальние раньше.
  const caps: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-2, -0.08, 30, 7.2, 7.4], [6, 0.42, 22, 6.2, 6.4], [-8, -0.48, 20, 6, 6.1], [2, 0.16, 13, 5.2, 5.4], [-4, -0.24, 9, 4.6, 4.8],
  ];
  const grow = variant ? 1.12 : 1;
  for (const [dx, lean, len, crx, cry] of caps.slice(0, 2 + lv)) {
    shaggyCap(ctx, x + dx, rimY + 1, (len + lv * 2) * grow, lean, crx * grow, cry * grow, tone);
  }
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 20;
    const sy = rimY - 30 - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.4 + (1 - t) * 1.6);
    ctx.fill();
  }
}

/** Бревно финиковой пальмы: ромбы от черешков листьев, блик со стороны света. */
function palmLog(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number): void {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = uy;
  const ny = -ux;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 2.4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#9a6a3a';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,170,0.45)';
  ctx.lineWidth = Math.max(1, w * 0.28);
  const o = w * 0.22;
  ctx.beginPath(); ctx.moveTo(x1 + nx * o, y1 + ny * o); ctx.lineTo(x2 + nx * o, y2 + ny * o); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,15,0.55)';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'butt';
  const hw = w * 0.42;
  for (let d = 2; d < len - 3; d += 3.4) {
    const px = x1 + ux * d;
    const py = y1 + uy * d;
    ctx.beginPath();
    ctx.moveTo(px - nx * hw, py - ny * hw);
    ctx.lineTo(px + ux * 3 + nx * hw, py + uy * 3 + ny * hw);
    ctx.moveTo(px + nx * hw, py + ny * hw);
    ctx.lineTo(px + ux * 3 - nx * hw, py + uy * 3 - ny * hw);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
}

/** Финик в корзине катапульты: вытянутый, тёмно-бурый, с бликом. */
function date(ctx: Ctx, x: number, y: number, rot: number): void {
  outline(ctx, 1.5);
  ell(ctx, x, y, 4.6, 2.8, rot);
  fs(ctx, '#7a3a1a');
  ctx.fillStyle = 'rgba(255,200,150,0.5)';
  ell(ctx, x - 1.2, y - 1, 1.8, 0.8, rot);
  ctx.fill();
}

/** Глыба песчаника: верхняя грань светлее, скол, слои. */
function sandBlock(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.2);
  ctx.lineTo(x - r * 0.6, y - r * 0.8);
  ctx.lineTo(x + r * 0.7, y - r * 0.75);
  ctx.lineTo(x + r, y - r * 0.1);
  ctx.lineTo(x + r * 0.8, y + r * 0.7);
  ctx.lineTo(x - r * 0.75, y + r * 0.75);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, SANDSTONE.hi);
  g.addColorStop(0.5, SANDSTONE.base);
  g.addColorStop(1, SANDSTONE.lo);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(120,85,35,0.5)';
  ctx.lineWidth = 1;
  for (const k of [0.05, 0.4]) {
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y + r * k); ctx.lineTo(x + r * 0.9, y + r * k - 0.8); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,250,225,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y - r * 0.68); ctx.lineTo(x + r * 0.6, y - r * 0.64); ctx.lineTo(x + r * 0.2, y - r * 0.35); ctx.lineTo(x - r * 0.6, y - r * 0.3);
  ctx.closePath();
  ctx.fill();
}

/** Медный колокольчик на раме. */
function bell(ctx: Ctx, x: number, y: number): void {
  outline(ctx, 1);
  ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 1); ctx.stroke();
  outline(ctx, 1.3);
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 3);
  ctx.quadraticCurveTo(x - 2.6, y - 2.2, x, y - 2.2);
  ctx.quadraticCurveTo(x + 2.6, y - 2.2, x + 3, y + 3);
  ctx.closePath();
  fs(ctx, brass(ctx, x - 3, y - 2, x + 3, y + 3));
  ctx.fillStyle = '#5a3c14';
  circle(ctx, x, y + 3.4, 0.9);
  ctx.fill();
}

/**
 * Катапульта Пустыни: основание из песчаника, деревянный поворотный круг с поясом бирюзовой плитки,
 * рама из пальмовых брёвен на стойках, кожаные обвязки, кожаная праща. 2-й уровень — бухта верёвки,
 * 3-й — медные колокольчики. Снаряды — финики, камнемёт — глыба песчаника, дождь — три финика.
 */
export function drawTowerCatapultDesert(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15);
  outline(ctx, 2.5);
  ell(ctx, x, y + 2, 36, 15);
  fs(ctx, SANDSTONE.lo);
  ell(ctx, x, y - 2, 36, 15);
  let g: CanvasGradient = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 36);
  g.addColorStop(0, SANDSTONE.hi);
  g.addColorStop(1, SANDSTONE.base);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(100,70,30,0.42)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.35;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 29, y - 2 + Math.sin(a) * 11.5);
    ctx.lineTo(x + Math.cos(a) * 36, y - 2 + Math.sin(a) * 15);
    ctx.stroke();
  }
  for (const jx of [-26, -9, 7, 25]) {
    ctx.beginPath(); ctx.moveTo(x + jx, y + 9); ctx.lineTo(x + jx, y + 16); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(100,70,30,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 5, 35, 13.5, 0, 0.15, Math.PI - 0.15); ctx.stroke();
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#5e3a1c');
  ell(ctx, x, ty0, tr, tr * 0.46);
  g = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  g.addColorStop(0, '#c98e4e');
  g.addColorStop(1, '#87582b');
  fs(ctx, g);
  ctx.save();
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,40,15,0.4)';
  ctx.lineWidth = 1;
  for (let k = -tr; k <= tr; k += 6) {
    ctx.beginPath(); ctx.moveTo(x + k, ty0 - tr); ctx.lineTo(x + k, ty0 + tr); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.stroke();
  ctx.strokeStyle = '#2aa3a0';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x + c * (tr - 1.6), ty0 + s * (tr - 1.6) * 0.46);
    ctx.lineTo(x + c * (tr + 1.6), ty0 + s * (tr + 1.6) * 0.46);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, ty0 - 0.6, tr, tr * 0.46, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  // Рама на стойках из пальмовых брёвен.
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
    palmLog(ctx, px, py, px, py - lift, 4);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  palmLog(ctx, -15, -11, 15, -11, 4.6);
  palmLog(ctx, -15, 11, 15, 11, 4.6);
  palmLog(ctx, -15, -11, -15, 11, 4.6);
  palmLog(ctx, 15, -11, 15, 11, 4.6);
  for (const [cx, cy] of corners) {
    outline(ctx, 1.4);
    circle(ctx, cx, cy, 3.5);
    fs(ctx, '#6b3f1f');
    ctx.strokeStyle = 'rgba(240,210,160,0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(cx - 2, cy - 2); ctx.lineTo(cx + 2, cy + 2); ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx - 2, cy + 2); ctx.stroke();
  }
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-2.5, -12.5, 5, 25);
  fs(ctx, '#6b4423');
  if (lv >= 2) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(-10 + i * 2.6, 0, 4.6 - i * 0.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#dcc38a';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  if (lv >= 3) for (const s of [-1, 1]) bell(ctx, -19, s * 11 + s * 1.5);
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  palmLog(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5);
  // Кожаная праща с прострочкой.
  const bw = variant === 2 ? 13 : 9;
  const bh = variant === 2 ? 8 : 6.5;
  outline(ctx, 2.2);
  ell(ctx, tx, ty, bw, bh);
  const lg = ctx.createRadialGradient(tx - bw * 0.3, ty - bh * 0.4, 1, tx, ty, bw);
  lg.addColorStop(0, '#a8703e');
  lg.addColorStop(1, '#5e3418');
  fs(ctx, lg);
  ctx.setLineDash([1.6, 1.8]);
  ctx.strokeStyle = 'rgba(245,220,170,0.85)';
  ctx.lineWidth = 0.9;
  ell(ctx, tx, ty, bw - 2, bh - 1.8);
  ctx.stroke();
  ctx.setLineDash([]);
  if (p < 0.5) {
    if (variant === 1) sandBlock(ctx, tx, ty, 7.5);
    else {
      const ds: ReadonlyArray<readonly [number, number, number]> = variant === 2 ? [[-5, -1, 0.4], [4, -2.5, -0.3], [0, 2, 0.1]] : lv >= 3 ? [[-2.5, 0.5, 0.5], [3.5, -1.5, -0.2]] : [[0, 0, 0.3]];
      for (const [sx, sy, r] of ds) date(ctx, tx + sx, ty + sy, r);
    }
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.5);
  fs(ctx, brass(ctx, -5, -5, 5, 5));
  ctx.restore();
}

/** Финиковая пальма: изогнутый ствол с ромбами, крона перистых листьев, гроздья фиников. */
function datePalm(ctx: Ctx, x: number, y: number, h: number, lean: number, seed: number): void {
  drawShadow(ctx, x + 18, y + 2, 26, 7, 0.22);
  const tx = x + lean;
  const ty = y - h;
  const cx = (t: number): number => x + lean * t * t;
  const hw = (t: number): number => 4 - 1.5 * t;
  const trunk = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) ctx.lineTo(cx(i / 12) - hw(i / 12), y - (h * i) / 12);
    for (let i = 12; i >= 0; i--) ctx.lineTo(cx(i / 12) + hw(i / 12), y - (h * i) / 12);
    ctx.closePath();
  };
  trunk();
  const tg = ctx.createLinearGradient(x - 5, 0, x + 5 + Math.abs(lean), 0);
  tg.addColorStop(0, '#b88a52');
  tg.addColorStop(0.3, '#d8aa6c');
  tg.addColorStop(1, '#6e4a24');
  outline(ctx, 2.2);
  fs(ctx, tg);
  ctx.save();
  trunk();
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,45,15,0.55)';
  ctx.lineWidth = 1.1;
  for (let k = 0; y - k * 4 > ty + 2; k++) {
    const t = (k * 4) / h;
    const c = cx(t) + (k % 2) * 0.8;
    const w = hw(t) + 1;
    ctx.beginPath();
    ctx.moveTo(c - w, y - k * 4 - 1.5);
    ctx.lineTo(c, y - k * 4 + 1.5);
    ctx.lineTo(c + w, y - k * 4 - 1.5);
    ctx.stroke();
  }
  ctx.restore();
  // Гроздья фиников под кроной.
  for (const s of [-1, 1]) {
    const cx = tx + s * 5;
    const cy = ty + 7;
    ctx.strokeStyle = '#c99a3a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, ty + 1); ctx.lineTo(cx, cy); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      outline(ctx, 1);
      ell(ctx, cx + (k % 3 - 1) * 2.6 + s * 0.6, cy + Math.floor(k / 3) * 2.8, 1.8, 2.3);
      fs(ctx, k % 2 ? '#d0782a' : '#b45a1e');
    }
  }
  // Листья: средняя жилка дугой и перья по обе стороны; задние темнее.
  const fronds: ReadonlyArray<readonly [number, number]> = [[-2.6, 34], [-0.4, 30], [-1.9, 36], [0.5, 32], [-1.2, 30], [2.9, 33], [-3.0, 28], [1.6, 35]];
  fronds.forEach(([a0, l], i) => {
    const a = a0 + (jit(seed + i) - 0.5) * 0.3;
    const ex = tx + Math.cos(a) * l;
    const ey = ty + Math.sin(a) * l * 0.55 + 10;
    const mx = tx + Math.cos(a) * l * 0.5;
    const my = ty + Math.sin(a) * l * 0.4 - 8;
    const back = i < 3;
    const dark = back ? '#3e6a22' : '#4f8a2a';
    const light = back ? '#5f8f34' : '#86c04a';
    const at = (t: number): Vec => {
      const u = 1 - t;
      return { x: u * u * tx + 2 * u * t * mx + t * t * ex, y: u * u * ty + 2 * u * t * my + t * t * ey };
    };
    ctx.lineCap = 'round';
    for (const [col, lw] of [[OUT, 3.4], [dark, 2.2], [light, 1]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      for (let k = 1; k <= 9; k++) {
        const t = k / 10;
        const p0 = at(t);
        const p1 = at(t + 0.04);
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dl = Math.hypot(dx, dy) || 1;
        const fl = 9 * (1 - t * 0.6);
        for (const sd of [-1, 1]) {
          const nx = (-dy / dl) * sd;
          const ny = (dx / dl) * sd;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p0.x + nx * fl + (dx / dl) * fl * 0.7, p0.y + ny * fl + (dy / dl) * fl * 0.7 + 2.5);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#c6b56a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  outline(ctx, 1.6);
  circle(ctx, tx, ty, 4);
  fs(ctx, '#7a5a2a');
}

/** Ворота Сахеля перед входом: глиняная стена с подковообразной аркой, фризом треугольников, зубцами, конусами с яйцами. */
function sahelGate(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const iw = w - 5;
  const r = iw * 1.03;
  const a = Math.acos(iw / r);
  const cy = y - h + 10 + r;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - w - 7, y);
    ctx.lineTo(x - w - 5, y - h);
    ctx.lineTo(x + w + 5, y - h);
    ctx.lineTo(x + w + 7, y);
    ctx.closePath();
    ctx.moveTo(x - iw, y);
    ctx.lineTo(x + iw, y);
    ctx.lineTo(x + iw, cy + r * Math.sin(a));
    ctx.arc(x, cy, r, a, Math.PI - a, true);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = cylGrad(ctx, x - w - 7, x + w + 7, LIMEWASH);
  ctx.fill('evenodd');
  outline(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(x - w - 7, y);
  ctx.lineTo(x - w - 5, y - h);
  ctx.lineTo(x + w + 5, y - h);
  ctx.lineTo(x + w + 7, y);
  ctx.moveTo(x - iw, y);
  ctx.lineTo(x - iw, cy + r * Math.sin(a));
  ctx.arc(x, cy, r, Math.PI - a, a);
  ctx.lineTo(x + iw, y);
  ctx.stroke();
  ctx.save();
  shape();
  ctx.clip('evenodd');
  plaster(ctx, x - w - 7, y - h, x + w + 7, y, 900);
  // Нижний пояс некрашеной глины: побелка не доходит до земли.
  ctx.fillStyle = 'rgba(190,120,60,0.55)';
  ctx.fillRect(x - w - 7, y - 9, 2 * w + 14, 9);
  const g = ctx.createLinearGradient(0, y - 12, 0, y);
  g.addColorStop(0, 'rgba(70,35,10,0)');
  g.addColorStop(1, 'rgba(70,35,10,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(x - w - 7, y - 12, 2 * w + 14, 12);
  // Фриз треугольников над аркой.
  ctx.fillStyle = '#b0422a';
  for (let i = 0; i < 9; i++) {
    const px = x - w + 2 + (i * (2 * w - 4)) / 8;
    ctx.beginPath();
    ctx.moveTo(px - 3, y - h + 8); ctx.lineTo(px, y - h + 3); ctx.lineTo(px + 3, y - h + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Светлое обрамление арки с клиньями.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(x, cy, r + 2.5, Math.PI + a * 0.5, -a * 0.5); ctx.stroke();
  ctx.strokeStyle = SANDSTONE.hi;
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,80,35,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI + a * 0.5 + ((Math.PI - a) * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(t) * (r + 0.4), cy + Math.sin(t) * (r + 0.4));
    ctx.lineTo(x + Math.cos(t) * (r + 4.6), cy + Math.sin(t) * (r + 4.6));
    ctx.stroke();
  }
  for (const s of [-1, 1]) {
    for (const k of [0.3, 0.62]) toronStub(ctx, x + s * (w + 1), y - h * k, s * 0.5);
  }
  toronRow(ctx, x, y - h + 12, w + 2, 10, 920);
  merlons(ctx, x - w + 6, x + w - 6, y - h, 930);
  for (const s of [-1, 1]) pinnacle(ctx, x + s * (w + 1), y - h + 1, 16, 6, true);
}

/**
 * Муравейник Пустыни: тот же холм, по низу кладка из сырцовых блоков, у входа глиняные ворота с
 * подковообразной аркой, на холме индиговые знамёна, по бокам финиковые пальмы и кувшины.
 */
export function drawAnthillDesert(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  // Пальма слева позади холма: крона выглядывает над склоном.
  datePalm(ctx, x - 82, y + 8, 104, 14, 11);
  anthillMound(ctx, x, y, rng);
  const at = (t: number): Vec => {
    const u = 1 - t;
    return { x: u * u * (x - 100) + 2 * u * t * x + t * t * (x + 100), y: u * u * (y + 32) + 2 * u * t * (y + 66) + t * t * (y + 32) };
  };
  for (let i = 0; i < 12; i++) {
    const p = at(0.04 + (i / 11) * 0.92);
    if (onPath?.(p.x, p.y - 4)) continue;
    const bw = 8.5 + jit(i + 1) * 2.5;
    const bh = 6 + jit(i + 21) * 1.5;
    const bx = p.x;
    const by = p.y - 4 - (i % 2) * 0.8;
    outline(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(bx - bw + 2, by + bh);
    ctx.quadraticCurveTo(bx - bw - 0.5, by + bh, bx - bw, by);
    ctx.quadraticCurveTo(bx - bw, by - bh, bx - bw + 3, by - bh);
    ctx.lineTo(bx + bw - 3, by - bh);
    ctx.quadraticCurveTo(bx + bw, by - bh, bx + bw, by);
    ctx.quadraticCurveTo(bx + bw + 0.5, by + bh, bx + bw - 2, by + bh);
    ctx.closePath();
    fs(ctx, cylGrad(ctx, bx - bw, bx + bw, ADOBE));
    ctx.fillStyle = 'rgba(255,240,210,0.4)';
    ell(ctx, bx - bw * 0.3, by - bh * 0.55, bw * 0.45, 1.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(100,50,20,0.25)';
    circle(ctx, bx + bw * 0.3, by + bh * 0.2, 1.1);
    ctx.fill();
  }
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    desertBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  sahelGate(ctx, x, y + 22, 35, 52);
  // Пальма справа впереди и кувшины у ворот, если там не тропа.
  if (!onPath?.(x + 92, y + 40)) datePalm(ctx, x + 92, y + 46, 92, -8, 23);
  for (const [px, py, s, gl] of [[x - 54, y + 32, 0.9, false], [x - 66, y + 40, 0.7, true], [x + 56, y + 34, 0.8, true]] as const) {
    if (!onPath?.(px, py - 6)) clayPot(ctx, px, py, s, gl);
  }
  // Мелочь у ворот: камешки и сухие пучки.
  for (let i = 0; i < 10; i++) {
    const px = x + rng.range(-120, 120);
    const py = y + rng.range(40, 72);
    if (onPath?.(px, py)) continue;
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(150,110,60,0.55)' : 'rgba(255,240,205,0.6)';
    ell(ctx, px, py, rng.range(1.6, 3), rng.range(1, 1.8), rng.range(0, TAU));
    ctx.fill();
  }
}
