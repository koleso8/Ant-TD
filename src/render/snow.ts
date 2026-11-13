/**
 * Постройки Снегов (акт 6): лагерь северных охотников — голубой лёд блоками, тёмное дерево,
 * бурые меха и шкуры, красно-синий орнамент, снежные шапки и сосульки, тёплый свет фонарей.
 * Белого на белой земле избегаем: всё, что должно читаться, — синее, бурое или красное с контуром.
 * Детализация на уровне утверждённых наборов: объём, фактура, мелочи.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, anthillMound, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, beam, jit, woodPole, type WoodTone } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

/** Оттенки ледяных блоков: от светлой бирюзы до глубокой синевы. */
const ICE = ['#a6d8f0', '#8ccbeb', '#b8e2f4', '#7dbde2', '#98d0ec'] as const;
const DARK_WOOD: WoodTone = { hi: '#a07650', base: '#5e4028', lo: '#36240f' };
interface Fur { hi: string; base: string; lo: string }
const FUR: Fur = { hi: '#d2a878', base: '#8e6440', lo: '#553820' };

/**
 * Кладка из ледяных блоков внутри клипа: прямоугольные блоки рядами вразбежку на снежных швах,
 * у каждого глянцевая косая полоса. cyl — полуширина цилиндра (блоки у краёв уже), 0 — плоская стена.
 */
function iceBricks(ctx: Ctx, cx: number, x0: number, y0: number, x1: number, y1: number, seed: number, cyl: number, rowH = 7.5): void {
  ctx.fillStyle = '#e6f2fa';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const span = cyl ? (cyl * Math.PI) / 2 : (x1 - x0) / 2;
  let row = 0;
  for (let yy = y1 - rowH * 0.5; yy > y0 - rowH; yy -= rowH, row++) {
    let u = -span - (row % 2) * 6 - jit(seed + row) * 3;
    let i = 0;
    while (u < span + 2) {
      const w = 10 + jit(seed + row * 31 + i) * 5;
      let sx: number;
      let sw: number;
      if (cyl) {
        const a0 = Math.max(-Math.PI / 2, (u + 0.7) / cyl);
        const a1 = Math.min(Math.PI / 2, (u + w - 0.7) / cyl);
        const xa = cx + Math.sin(a0) * cyl;
        const xb = cx + Math.sin(a1) * cyl;
        sx = (xa + xb) / 2;
        sw = xb - xa;
      } else {
        sx = cx + u + w / 2;
        sw = w - 1.4;
      }
      const k = cyl ? (sx - cx) / cyl : 0;
      const sag = cyl ? 2.6 * (1 - k * k) : 0;
      const h = rowH - 1.4;
      const sy = yy + sag;
      if (sw > 1.4) {
        ctx.beginPath();
        ctx.roundRect(sx - sw / 2, sy - h / 2, sw, h, 1.2);
        ctx.fillStyle = ICE[Math.floor(jit(seed + row * 5 + i * 11) * ICE.length)];
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(sx - sw * 0.35, sy + h * 0.3);
        ctx.lineTo(sx - sw * 0.15, sy - h * 0.38);
        ctx.lineTo(sx - sw * 0.02, sy - h * 0.38);
        ctx.lineTo(sx - sw * 0.22, sy + h * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(30,80,130,0.22)';
        ctx.fillRect(sx - sw / 2, sy + h * 0.25, sw, h * 0.25);
      }
      u += w;
      i++;
    }
  }
}

/** Объём цилиндра поверх кладки: светлее слева, синяя тень справа. */
function iceShade(ctx: Ctx, x0: number, x1: number, y0: number, y1: number): void {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(30,70,120,0.12)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.6, 'rgba(30,70,120,0)');
  g.addColorStop(1, 'rgba(30,70,120,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** Сосулька от (x, y) вниз: голубая, с бликом и острым кончиком. */
function icicle(ctx: Ctx, x: number, y: number, len: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.25, y + len * 0.6, x, y + len);
  ctx.quadraticCurveTo(x + w * 0.25, y + len * 0.6, x + w / 2, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#b4e2f6');
  g.addColorStop(1, '#5a9ac8');
  outline(ctx, 1.1);
  fs(ctx, g);
}

/** Ряд сосулек вдоль кромки: y(x) задаёт кромку, длины разные, шаг сбит. */
function icicleRow(ctx: Ctx, x0: number, x1: number, edge: (x: number) => number, seed: number, maxLen: number): void {
  let i = 0;
  for (let x = x0 + 2; x < x1 - 1; x += 3.6 + jit(seed + i) * 2.4, i++) {
    const len = maxLen * (0.35 + jit(seed + i + 50) * 0.65);
    icicle(ctx, x, edge(x) - 0.5, len, 2.2 + len * 0.12);
  }
}

/** Снежная шапка-валик: белый холмик с голубой тенью снизу. */
function snowCap(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - rx, y + ry * 0.3);
  ctx.quadraticCurveTo(x - rx * 0.9, y - ry, x - rx * 0.1, y - ry * 0.9);
  ctx.quadraticCurveTo(x + rx * 0.8, y - ry * 1.05, x + rx, y + ry * 0.2);
  ctx.quadraticCurveTo(x, y + ry * 0.7, x - rx, y + ry * 0.3);
  ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = 'rgba(140,175,215,0.45)';
  ell(ctx, x + rx * 0.2, y + ry * 0.2, rx * 0.65, ry * 0.3);
  ctx.fill();
}

/** Сугроб у подножия: белые валы с голубой тенью и искрами. */
function snowDrift(ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number): void {
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - rx, y + ry * 0.4);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const px = x - rx + 2 * rx * t;
    const py = y - ry * (0.55 + 0.45 * Math.sin(t * Math.PI)) + (jit(seed + i) - 0.5) * ry * 0.4;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + rx, y + ry * 0.4);
  ctx.quadraticCurveTo(x, y + ry, x - rx, y + ry * 0.4);
  ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = 'rgba(140,175,215,0.5)';
  ell(ctx, x + rx * 0.15, y + ry * 0.35, rx * 0.75, ry * 0.4);
  ctx.fill();
  ctx.fillStyle = '#9fd6f2';
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + (jit(seed + i + 20) - 0.5) * rx * 1.4, y - ry * 0.2 + (jit(seed + i + 30) - 0.5) * ry, 0.8);
    ctx.fill();
  }
}

/** Снежинка: шесть лучей с веточками. */
function snowflake(ctx: Ctx, x: number, y: number, r: number, col: string, lw = 1.2): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    const bx = x + Math.cos(a) * r * 0.58;
    const by = y + Math.sin(a) * r * 0.58;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + s * 0.8) * r * 0.32, by + Math.sin(a + s * 0.8) * r * 0.32);
      ctx.stroke();
    }
  }
}

/** Пушистая кисточка из белого меха на шнурке. */
function furTassel(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 0.9);
  ctx.beginPath(); ctx.moveTo(x, y - r - 3); ctx.lineTo(x, y - r); ctx.stroke();
  outline(ctx, 1.2);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU;
    const rr = r * (i % 2 ? 1 : 0.78);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  fs(ctx, '#f6f2ea');
  ctx.fillStyle = 'rgba(150,170,200,0.5)';
  circle(ctx, x + r * 0.25, y + r * 0.25, r * 0.4);
  ctx.fill();
}

/** Северное знамя: тёмное древко, ледяной наконечник, синий войлок с гербом и снежинкой, красный пояс с зигзагом, меховые кисти. */
function snowBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  woodPole(ctx, px, ground, topY + 2, 4.4);
  ctx.beginPath();
  ctx.moveTo(px, topY - 12); ctx.lineTo(px + 3, topY - 4); ctx.lineTo(px, topY - 0.5); ctx.lineTo(px - 3, topY - 4);
  ctx.closePath();
  const ig = ctx.createLinearGradient(px - 3, 0, px + 3, 0);
  ig.addColorStop(0, '#ffffff');
  ig.addColorStop(0.5, '#a6d8f0');
  ig.addColorStop(1, '#4f8ec0');
  outline(ctx, 1.5);
  fs(ctx, ig);
  const bw = 7.5;
  const y0 = topY + 5;
  const y1 = topY + 38;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px - bw - 3, y0); ctx.lineTo(px + bw + 3, y0); ctx.stroke();
  ctx.strokeStyle = DARK_WOOD.base;
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
  g.addColorStop(0, '#1c3266');
  g.addColorStop(0.35, '#33529e');
  g.addColorStop(1, '#16284f');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  cloth();
  ctx.clip();
  ctx.fillStyle = '#c8352a';
  ctx.fillRect(px - bw, y1 - 7, 2 * bw, 7);
  ctx.strokeStyle = '#f6efe0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(px - bw + (i * 2 * bw) / 6, y1 - 3.5 + (i % 2 ? -2 : 1.5));
  ctx.stroke();
  ctx.restore();
  antCrest(ctx, px, y0 + 9.5, 4.2, '#16284f');
  snowflake(ctx, px, y0 + 21, 4.2, '#eef6ff', 1);
  for (const dx of [-bw + 1.5, 0, bw - 1.5]) furTassel(ctx, px + dx, y1 + 5, 2.2);
}

/** Ледяной фонарь: полупрозрачный блок льда, внутри свеча с тёплым светом. */
function iceLantern(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, 'rgba(255,190,90,0.55)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 20);
  ctx.fill();
  const g = ctx.createRadialGradient(x, y + 1, 0.5, x, y, 8);
  g.addColorStop(0, '#fff2c0');
  g.addColorStop(0.45, '#f6c878');
  g.addColorStop(1, '#8cc6e6');
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.roundRect(x - 5.5, y - 7, 11, 13, 2.4);
  fs(ctx, g);
  ctx.fillStyle = '#fff6d0';
  ell(ctx, x, y - 0.5, 1.3, 2.4);
  ctx.fill();
  ctx.fillStyle = '#ff9a3a';
  ell(ctx, x, y + 0.2, 0.7, 1.3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(x - 4, y - 5.5, 1.3, 9);
  ctx.strokeStyle = 'rgba(60,110,160,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x + 2.5, y - 7); ctx.lineTo(x + 1.2, y - 2); ctx.lineTo(x + 3, y + 2); ctx.stroke();
  snowCap(ctx, x, y - 7.2, 6.2, 2.4);
}

/**
 * Меховая ушанка (вид сверху) смотрит по angle: круглая кожаная макушка, по бокам опущенные
 * уши-клапаны, спереди отвёрнутый светлый меховой козырёк; мех короткими штрихами.
 */
function furHat(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const sx = -fy;
  const sy = fx;
  const furStrokes = (cx: number, cy: number, rr: number, n: number, seed: number): void => {
    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < n; i++) {
      const a = jit(seed + i) * TAU;
      const d = jit(seed + i + 40) * rr * 0.8;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 1.2, py + Math.sin(a) * 1.2); ctx.stroke();
    }
  };
  for (const s of [-1, 1]) {
    const cx = x + sx * s * r * 0.82 - fx * r * 0.15;
    const cy = y + sy * s * r * 0.82 - fy * r * 0.15;
    outline(ctx, 1.4);
    ell(ctx, cx, cy, r * 0.48, r * 0.38, angle);
    fs(ctx, FUR.base);
    furStrokes(cx, cy, r * 0.4, 5, 10 + s);
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.9);
  g.addColorStop(0, '#9a7450');
  g.addColorStop(0.6, '#6a4a30');
  g.addColorStop(1, '#45301c');
  outline(ctx, 1.7);
  circle(ctx, x, y, r * 0.82);
  fs(ctx, g);
  const bx = x + fx * r * 0.5;
  const by = y + fy * r * 0.5;
  outline(ctx, 1.5);
  ell(ctx, bx, by, r * 0.36, r * 0.82, angle);
  const fg = ctx.createRadialGradient(bx - r * 0.2, by - r * 0.2, 0.5, bx, by, r * 0.8);
  fg.addColorStop(0, FUR.hi);
  fg.addColorStop(1, FUR.base);
  fs(ctx, fg);
  furStrokes(bx, by, r * 0.6, 8, 30);
  ctx.fillStyle = 'rgba(255,245,225,0.4)';
  ell(ctx, x - r * 0.3 - fx * r * 0.1, y - r * 0.35 - fy * r * 0.1, r * 0.22, r * 0.12, -0.4);
  ctx.fill();
}

/**
 * Ледяные стрелки (Снега): башня из голубых ледяных блоков на сугробе, в стене светится тёплое
 * окошко, наверху тёмный дощатый настил со шкурой и снегом, по краю сосульки, позади столбики
 * со снежными шапками; стрелки в меховых ушанках. 2-й уровень — северное знамя и друза льда,
 * 3-й — ледяной фонарь со свечой. Снайперы — шест с вымпелом, залп — широкая башня и четверо.
 */
export function drawTowerAcidSnow(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 18 + lv + (variant === 2 ? 5 : 0);
  const rt = rb - 3;
  const dr = rt + 9;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15, 0.2);
  if (level >= 2 && variant !== 1) snowBanner(ctx, x + dr + 2, y + 2, top - 30);
  const bot = y + 2;
  const bt = top + 4;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - rt, bt);
    ctx.lineTo(x + rt, bt);
    ctx.lineTo(x + rb, bot);
    ctx.ellipse(x, bot, rb, 6, 0, 0, Math.PI);
    ctx.closePath();
  };
  ctx.save();
  body();
  ctx.clip();
  iceBricks(ctx, x, x - rb, bt, x + rb, bot + 7, 30 + lv * 7 + variant * 3, rb);
  iceShade(ctx, x - rb, x + rb, bt, bot + 7);
  const ug = ctx.createLinearGradient(0, bt, 0, bt + 14);
  ug.addColorStop(0, 'rgba(20,50,90,0.5)');
  ug.addColorStop(1, 'rgba(20,50,90,0)');
  ctx.fillStyle = ug;
  ctx.fillRect(x - rb, bt, 2 * rb, 14);
  ctx.restore();
  body();
  outline(ctx, 2.5);
  ctx.stroke();
  // Тёплое окошко сквозь лёд.
  const wy = bt + (bot - bt) * 0.5;
  const wg = ctx.createRadialGradient(x, wy, 1, x, wy, 13);
  wg.addColorStop(0, 'rgba(255,190,90,0.6)');
  wg.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = wg;
  circle(ctx, x, wy, 13);
  ctx.fill();
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 3.8, wy + 6); ctx.lineTo(x - 3.8, wy - 2); ctx.arc(x, wy - 2, 3.8, Math.PI, 0); ctx.lineTo(x + 3.8, wy + 6);
  ctx.closePath();
  const og = ctx.createLinearGradient(0, wy - 6, 0, wy + 6);
  og.addColorStop(0, '#ffe7a0');
  og.addColorStop(1, '#f08a30');
  fs(ctx, og);
  ctx.strokeStyle = DARK_WOOD.base;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(x, wy - 5.8); ctx.lineTo(x, wy + 6); ctx.moveTo(x - 3.8, wy + 1); ctx.lineTo(x + 3.8, wy + 1); ctx.stroke();
  snowDrift(ctx, x - rb * 0.55, y + 7, 13, 6, 3 + lv);
  snowDrift(ctx, x + rb * 0.6, y + 8, 11, 5, 9 + lv);
  if (lv >= 2) {
    const gem: ReadonlyArray<readonly [number, number, number, number, number]> = [[-4, 0, 4, 9, -0.35], [4, 1, 3.6, 7, 0.4], [0, 1.5, 4.6, 13, 0.05]];
    for (const [dx, dy, w, hh, t] of gem) iceShard(ctx, x - rb - 3 + dx, y + 9 + dy, w, hh, t);
  }
  // Настил: тёмные доски, шкура посередине, снег по краю.
  const ry = 9;
  outline(ctx, 2.5);
  ell(ctx, x, top + 4, dr, ry);
  fs(ctx, DARK_WOOD.lo);
  ell(ctx, x, top, dr, ry);
  const dg = ctx.createRadialGradient(x - dr * 0.3, top - 3, 2, x, top, dr);
  dg.addColorStop(0, '#8a6644');
  dg.addColorStop(1, '#4e3420');
  fs(ctx, dg, false);
  ctx.save();
  ell(ctx, x, top, dr, ry);
  ctx.clip();
  ctx.strokeStyle = 'rgba(25,12,4,0.5)';
  ctx.lineWidth = 1;
  for (let k = -dr + 5; k < dr; k += 5.2) { ctx.beginPath(); ctx.moveTo(x + k, top - ry); ctx.lineTo(x + k, top + ry); ctx.stroke(); }
  ctx.restore();
  outline(ctx, 1.4);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU;
    const rr = (i % 2 ? 1 : 0.9);
    ctx.lineTo(x + Math.cos(a) * dr * 0.58 * rr, top + 0.5 + Math.sin(a) * ry * 0.58 * rr);
  }
  ctx.closePath();
  fs(ctx, FUR.base);
  ctx.fillStyle = 'rgba(230,200,160,0.4)';
  ell(ctx, x - dr * 0.15, top - 1, dr * 0.3, ry * 0.25);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = DARK_WOOD.base;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Снег на краю настила и сосульки спереди.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.ellipse(x, top - 1.2, dr - 1, ry - 0.5, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
  icicleRow(ctx, x - dr + 3, x + dr - 3, (px) => top + 4 + ry * Math.sqrt(Math.max(0, 1 - ((px - x) / dr) ** 2)) + 1.5, 70 + lv, 7 + lv);
  // Столбики позади с жердями и снежными шапками.
  const posts = 3 + lv;
  const pts: Vec[] = [];
  for (let i = 0; i < posts; i++) {
    const th = Math.PI * 1.06 + ((Math.PI * 0.88) * i) / (posts - 1);
    pts.push({ x: x + Math.cos(th) * dr * 0.9, y: top + Math.sin(th) * ry * 0.9 + 1 });
  }
  for (const p of pts) beam(ctx, p.x, p.y + 1, p.x, p.y - 11, 3.2, DARK_WOOD);
  for (const [col, lw] of [[OUT, 3.6], [DARK_WOOD.base, 2], ['rgba(255,255,255,0.9)', 0.9]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - 8) : ctx.moveTo(p.x, p.y - 8)));
    ctx.stroke();
  }
  for (const p of pts) snowCap(ctx, p.x, p.y - 12, 3, 1.8);
  if (level >= 3 && variant !== 1) {
    const lx = x - rb - 5;
    const ly = bt + 9;
    beam(ctx, x - rt + 2, ly + 1.5, lx - 1, ly - 0.5, 2.8, DARK_WOOD);
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 7); ctx.stroke();
    iceLantern(ctx, lx, ly + 15);
  }
  if (variant === 1) {
    woodPole(ctx, x + 8, top + 2, top - 46, 3.6);
    pennant(ctx, x + 8, top - 44, 24, 13, '#c8352a');
    snowCap(ctx, x + 8, top - 46, 3, 1.8);
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
    furHat(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.8 * as / 0.6, angle);
  }
}

/** Ледяной осколок-призма: светлая и тёмная грани, верхушка, блик. */
function iceShard(ctx: Ctx, x: number, y: number, w: number, h: number, tilt: number): void {
  const hw = w / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const face = (pts: ReadonlyArray<readonly [number, number]>, col: string): void => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  face([[-hw, 0], [0, 1.4], [0, -h + 1.4], [-hw, -h]], '#c8ecfa');
  face([[0, 1.4], [hw, 0], [hw, -h], [0, -h + 1.4]], '#5a9ac8');
  face([[-hw, -h], [0, -h + 1.4], [0, -h - w * 0.9]], '#ffffff');
  face([[0, -h + 1.4], [hw, -h], [0, -h - w * 0.9]], '#8cc6e6');
  ctx.beginPath();
  ctx.moveTo(-hw, 0); ctx.lineTo(0, 1.4); ctx.lineTo(hw, 0); ctx.lineTo(hw, -h); ctx.lineTo(0, -h - w * 0.9); ctx.lineTo(-hw, -h);
  ctx.closePath();
  outline(ctx, 1.4);
  ctx.stroke();
  ctx.restore();
}

/** Рога северного оленя: две изогнутые ветви с отростками, цвет кости. */
function antlers(ctx: Ctx, x: number, y: number, s: number): void {
  for (const side of [-1, 1]) {
    const pts: ReadonlyArray<readonly [number, number, number, number]> = [
      [0, 0, side * 9, -9], [side * 9, -9, side * 11, -19],
    ];
    const tines: ReadonlyArray<readonly [number, number, number, number]> = [
      [side * 4, -4, side * 2, -10], [side * 9, -9, side * 15, -12], [side * 10.5, -15, side * 6.5, -19],
    ];
    for (const [col, lw] of [[OUT, 3.6 * s], ['#efe4c8', 2 * s]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      for (const [ax, ay, bx, by] of [...pts, ...tines]) {
        ctx.beginPath(); ctx.moveTo(x + ax * s, y + ay * s); ctx.lineTo(x + bx * s, y + by * s); ctx.stroke();
      }
    }
  }
  outline(ctx, 1.2);
  ell(ctx, x, y + 0.5 * s, 3 * s, 2 * s);
  fs(ctx, '#d8c8a0');
}

/** Гарпун с зазубренным костяным наконечником и обмоткой. */
function harpoon(ctx: Ctx, hx: number, hy: number, tx: number, ty: number): void {
  const len = Math.hypot(tx - hx, ty - hy) || 1;
  const ux = (tx - hx) / len;
  const uy = (ty - hy) / len;
  const nx = uy;
  const ny = -ux;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = DARK_WOOD.base;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const bx = tx - ux * 9;
  const by = ty - uy * 9;
  ctx.beginPath();
  ctx.moveTo(bx + nx * 1.8, by + ny * 1.8);
  ctx.lineTo(tx + ux * 4, ty + uy * 4);
  ctx.lineTo(bx - nx * 1.8, by - ny * 1.8);
  ctx.lineTo(bx + ux * 2 - nx * 3.6, by + uy * 2 - ny * 3.6);
  ctx.lineTo(bx - ux * 2, by - uy * 2);
  ctx.closePath();
  outline(ctx, 1.4);
  fs(ctx, '#efe4c8');
  ctx.strokeStyle = '#c8352a';
  ctx.lineWidth = 1.6;
  for (const d of [11, 13]) {
    ctx.beginPath(); ctx.moveTo(tx - ux * d + nx * 1.8, ty - uy * d + ny * 1.8); ctx.lineTo(tx - ux * d - nx * 1.8, ty - uy * d - ny * 1.8); ctx.stroke();
  }
}

/** Круглый щит: доски, меховая опушка по краю, железный умбон, синий пояс. */
function furShield(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2);
  circle(ctx, x, y, r);
  fs(ctx, '#7a5434');
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = '#2c4a8e';
  ctx.fillRect(x - r, y - 1.6, 2 * r, 3.2);
  ctx.strokeStyle = 'rgba(30,15,5,0.5)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(x + k * r, y - r); ctx.lineTo(x + k * r, y + r); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.6;
  circle(ctx, x, y, r - 0.8);
  ctx.stroke();
  ctx.strokeStyle = '#efe6d6';
  ctx.lineWidth = 2;
  ctx.setLineDash([1.2, 1.1]);
  ctx.stroke();
  ctx.setLineDash([]);
  outline(ctx, 1.3);
  circle(ctx, x, y, r * 0.3);
  fs(ctx, '#8a9099');
  snowCap(ctx, x, y - r + 0.8, r * 0.55, 1.8);
}

/** Сани: загнутые полозья, перекладины, тюк шкур и ящик, обвязка. */
function sled(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawShadow(ctx, 2, 3, 18, 4, 0.18);
  for (const dy of [0, 4]) {
    for (const [col, lw] of [[OUT, 3.2], [DARK_WOOD.hi, 1.6]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(-15, dy);
      ctx.lineTo(10, dy);
      ctx.quadraticCurveTo(16, dy, 15, dy - 6);
      ctx.stroke();
    }
  }
  for (const k of [-11, -3, 5]) beam(ctx, k, -2, k + 1.2, 5, 2.2, DARK_WOOD);
  beam(ctx, -15, -3, 11, -3, 3, DARK_WOOD);
  outline(ctx, 1.6);
  ctx.beginPath(); ctx.rect(1, -11, 9, 8); fs(ctx, '#9a6a3a');
  ctx.strokeStyle = 'rgba(40,20,5,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(10, -7); ctx.stroke();
  outline(ctx, 1.6);
  ell(ctx, -6, -7, 8, 4.6);
  fs(ctx, FUR.base);
  ctx.fillStyle = 'rgba(230,200,160,0.45)';
  ell(ctx, -8, -9, 4, 1.6);
  ctx.fill();
  ctx.strokeStyle = '#c8352a';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-6, -11.6); ctx.lineTo(-6, -2.4); ctx.stroke();
  snowCap(ctx, 5.5, -11, 4.6, 1.8);
  ctx.restore();
}

/** Вешала со шкурой: два столба, перекладина, распяленная шкура. */
function dryingRack(ctx: Ctx, x: number, y: number): void {
  for (const s of [-1, 1]) beam(ctx, x + s * 9, y + 1, x + s * 8, y - 24, 2.8, DARK_WOOD);
  beam(ctx, x - 11, y - 22, x + 11, y - 22, 2.6, DARK_WOOD);
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 21);
  ctx.quadraticCurveTo(x - 9, y - 12, x - 6, y - 5);
  ctx.lineTo(x - 2, y - 7);
  ctx.lineTo(x + 2, y - 7);
  ctx.lineTo(x + 6, y - 5);
  ctx.quadraticCurveTo(x + 9, y - 12, x + 7, y - 21);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
  g.addColorStop(0, FUR.hi);
  g.addColorStop(1, FUR.lo);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(60,35,15,0.5)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 8; i++) {
    const px = x - 5 + jit(i + 900) * 10;
    const py = y - 19 + jit(i + 910) * 12;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 0.5, py + 1.6); ctx.stroke();
  }
  snowCap(ctx, x, y - 22.5, 11, 1.8);
}

/**
 * Чум из шкур: тёмные жерди веером над макушкой, клинья шкур с прошитыми швами, пояс орнамента
 * по низу, откинутый полог с тёплым светом, снег на верхних клиньях. Возвращает y макушки.
 */
function hideTent(ctx: Ctx, x: number, base: number, r: number, h: number, ribbons: boolean): number {
  const apex = base - h;
  for (const [dx, dh] of [[-9, 14], [-4, 18], [2, 16], [7, 13], [-1, 20]] as const) {
    beam(ctx, x + dx * 0.3, apex + 6, x + dx, apex - dh, 2.6, DARK_WOOD);
  }
  if (ribbons) {
    FEATHER_RIBBONS.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.8;
      const px = x + (i - 1) * 4;
      ctx.beginPath(); ctx.moveTo(px, apex - 10); ctx.quadraticCurveTo(px + 5, apex - 6, px + 3 + i, apex + 2); ctx.stroke();
    });
  }
  const ry = r * 0.32;
  const cone = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - 3, apex);
    ctx.lineTo(x + 3, apex);
    ctx.lineTo(x + r, base);
    ctx.ellipse(x, base, r, ry, 0, 0, Math.PI);
    ctx.closePath();
  };
  cone();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, '#a87a50');
  g.addColorStop(0.3, '#c9a070');
  g.addColorStop(0.65, '#8e6440');
  g.addColorStop(1, '#5a3c22');
  outline(ctx, 2.5);
  fs(ctx, g);
  ctx.save();
  cone();
  ctx.clip();
  // Швы между клиньями шкур.
  ctx.setLineDash([1.6, 1.6]);
  ctx.strokeStyle = 'rgba(40,20,5,0.6)';
  ctx.lineWidth = 0.9;
  for (const k of [-0.7, -0.35, 0.35, 0.7]) {
    ctx.beginPath(); ctx.moveTo(x + k * 3, apex); ctx.lineTo(x + k * r, base + ry * Math.sqrt(1 - k * k)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Пояс орнамента.
  const bandY = base - 9;
  ctx.fillStyle = '#c8352a';
  ctx.fillRect(x - r, bandY, 2 * r, 6);
  ctx.fillStyle = '#2c4a8e';
  ctx.fillRect(x - r, bandY + 6, 2 * r, 2.6);
  ctx.fillStyle = '#f6efe0';
  for (let k = -r; k < r; k += 6) {
    ctx.beginPath(); ctx.moveTo(k + x, bandY + 5); ctx.lineTo(k + x + 3, bandY + 1); ctx.lineTo(k + x + 6, bandY + 5); ctx.closePath(); ctx.fill();
  }
  // Снег налип полосками вдоль швов у макушки.
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (const k of [-0.7, -0.35, 0.35, 0.7]) {
    const len = 0.22 + Math.abs(k) * 0.08;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + k * 3, apex + 2);
    ctx.lineTo(x + k * 3 + (k * r - k * 3) * len, apex + 2 + (h - 2) * len);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ell(ctx, x, apex + 3, 4.5, 2.2);
  ctx.fill();
  const sh = ctx.createLinearGradient(0, base - 12, 0, base + ry);
  sh.addColorStop(0, 'rgba(30,20,10,0)');
  sh.addColorStop(1, 'rgba(30,20,10,0.35)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - r, base - 12, 2 * r, 12 + ry);
  ctx.restore();
  cone();
  outline(ctx, 2.5);
  ctx.stroke();
  // Полог: тёплый свет внутри, откинутый светлый край.
  const dw = r * 0.32;
  const dTop = base - h * 0.5;
  const glow = ctx.createRadialGradient(x, base - 6, 1, x, base - 6, 20);
  glow.addColorStop(0, 'rgba(255,180,80,0.5)');
  glow.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, base - 6, 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, dTop);
  ctx.lineTo(x + dw, base + ry * 0.9);
  ctx.lineTo(x - dw, base + ry * 0.9);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, dTop, 0, base);
  dg.addColorStop(0, '#5a2a10');
  dg.addColorStop(1, '#f0a050');
  outline(ctx, 2);
  fs(ctx, dg);
  ctx.beginPath();
  ctx.moveTo(x, dTop);
  ctx.lineTo(x + dw, base + ry * 0.9);
  ctx.quadraticCurveTo(x + dw + 5, base - 2, x + dw + 3, dTop + 10);
  ctx.closePath();
  outline(ctx, 1.8);
  fs(ctx, '#d8b080');
  return apex;
}

const FEATHER_RIBBONS = ['#c8352a', '#2c4a8e', '#f2c230'] as const;

/**
 * Казарма Снегов: большой чум из шкур с поясом орнамента, над пологом оленьи рога, из макушки
 * дымок, у подножия сугробы. 2-й уровень — вешала со шкурой и сани с поклажей, 3-й — чум выше,
 * на жердях цветные ленты. Броненосцы — круглые щиты с меховой опушкой, жнецы — гарпуны.
 */
export function drawTowerBarracksSnow(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const r = 31 + (lv >= 3 ? 2 : 0);
  const th = 52 + (lv - 1) * 5;
  drawShadow(ctx, x + 4, y + 12, 48, 16, 0.2);
  snowBanner(ctx, x + 35, y - 2, y - th - 26 - (lv - 1) * 4);
  if (variant === 2) {
    harpoon(ctx, x - 30, y - 10, x + 14, y - th - 14);
    harpoon(ctx, x + 30, y - 10, x - 14, y - th - 14);
  }
  if (lv >= 2) dryingRack(ctx, x - 30, y - 2);
  const apex = hideTent(ctx, x, y + 2, r, th, lv >= 3);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(225,230,238,${0.6 - i * 0.15})`;
    circle(ctx, x + 2 + i * 3, apex - 22 - i * 7, 3 + i * 1.6);
    ctx.fill();
  }
  antlers(ctx, x, y + 2 - th * 0.5 - 1, 0.72);
  snowDrift(ctx, x - r + 4, y + 9, 13, 5.5, 41);
  snowDrift(ctx, x + r - 2, y + 10, 12, 5, 47);
  if (lv >= 2) sled(ctx, x + 26, y + 12, 0.85);
  if (variant === 1) {
    furShield(ctx, x - 35, y - 1, 7.5);
    furShield(ctx, x + 36, y + 1, 7.5);
  }
}

/** Цвета зимних опят: светлая макушка, основной, тень. */
interface CapTone { hi: string; base: string; lo: string }

/** Зимний опёнок (бархатоногий): тёмная бархатная ножка, глянцевая рыжая шляпка, иногда шапочка снега. */
function winterCap(ctx: Ctx, x: number, y: number, len: number, lean: number, cr: number, tone: CapTone, snow: boolean): void {
  const tx = x + Math.sin(lean) * len;
  const ty = y - Math.cos(lean) * len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (tx - x) * 0.3, y - len * 0.55, tx, ty); ctx.stroke();
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = '#c89a5a';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x + (tx - x) * 0.75, y - len * 0.78); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(lean);
  ctx.beginPath();
  ctx.moveTo(-cr, 0.5);
  ctx.bezierCurveTo(-cr, -cr * 0.75, cr, -cr * 0.75, cr, 0.5);
  ctx.quadraticCurveTo(0, cr * 0.32, -cr, 0.5);
  ctx.closePath();
  const g = ctx.createRadialGradient(-cr * 0.35, -cr * 0.45, 0.5, 0, -cr * 0.15, cr);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.55, tone.base);
  g.addColorStop(1, tone.lo);
  outline(ctx, 1.7);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(255,255,240,0.6)';
  ell(ctx, -cr * 0.35, -cr * 0.35, cr * 0.28, cr * 0.13, -0.3);
  ctx.fill();
  if (snow) {
    outline(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(-cr * 0.55, -cr * 0.45);
    ctx.quadraticCurveTo(-cr * 0.1, -cr * 0.95, cr * 0.5, -cr * 0.5);
    ctx.quadraticCurveTo(cr * 0.1, -cr * 0.35, -cr * 0.55, -cr * 0.45);
    ctx.closePath();
    fs(ctx, '#ffffff');
  }
  ctx.restore();
}

/** Снегирь: серая спинка, чёрная шапочка и хвост, красная грудка; сидит, смотрит влево. */
function bullfinch(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  outline(ctx, 1.3);
  ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(10, 0); ctx.lineTo(9, 2.6); ctx.lineTo(3, 1); ctx.closePath(); fs(ctx, '#26262c');
  outline(ctx, 1.5);
  ell(ctx, 0, -1, 5.6, 4.4);
  fs(ctx, '#7c8490');
  ctx.save();
  ell(ctx, 0, -1, 5.6, 4.4);
  ctx.clip();
  ctx.fillStyle = '#e04a3a';
  ell(ctx, -2.5, 1.2, 4.4, 3.6);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#26262c';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(1, -2); ctx.quadraticCurveTo(3.5, -3, 5, -1); ctx.stroke();
  outline(ctx, 1.4);
  circle(ctx, -4.5, -4.5, 2.8);
  fs(ctx, '#26262c');
  ctx.fillStyle = '#f2f2f2';
  circle(ctx, -5.3, -5.1, 0.5);
  ctx.fill();
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath(); ctx.moveTo(-7, -4.4); ctx.lineTo(-8.6, -3.8); ctx.lineTo(-7, -3.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(-1.5, 5); ctx.moveTo(1, 3); ctx.lineTo(1.2, 5); ctx.stroke();
  ctx.restore();
}

/**
 * Грибница Снегов: тёмный пень под снежной шапкой, снег свисает с края, под ним сосульки; на пне
 * гроздья зимних опят — бархатная тёмная ножка и глянцевая рыжая шляпка, на некоторых снег.
 * 2-й уровень — ледяные осколки у корней, 3-й — снегирь на снежной шапке. Гниль — болотные, дурман — лиловые.
 */
export function drawTowerSporeSnow(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: CapTone = variant === 1
    ? { hi: '#eef0a8', base: '#a8b03a', lo: '#4f5a14' }
    : variant === 2 ? { hi: '#ffe0ff', base: '#b45ad8', lo: '#521a78' } : { hi: '#ffd090', base: '#e07a2a', lo: '#8a3a10' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 32, 12, 0.2);
  const R = 17;
  const top = y - 22;
  // Корни и пень.
  for (const [dx, ex] of [[-0.8, -27], [0.75, 26], [-0.2, -8]] as const) {
    beam(ctx, x + dx * R, y - 2, x + ex, y + 8, 6, DARK_WOOD);
  }
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - R, top);
    ctx.lineTo(x - R - 1.5, y + 2);
    ctx.ellipse(x, y + 2, R + 1.5, 6, 0, Math.PI, 0, true);
    ctx.lineTo(x + R, top);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
  g.addColorStop(0, '#6e4c30');
  g.addColorStop(0.3, '#8e6a48');
  g.addColorStop(1, '#3a2614');
  outline(ctx, 2.5);
  fs(ctx, g);
  ctx.save();
  body();
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,10,2,0.5)';
  ctx.lineWidth = 1.1;
  for (let k = -0.8; k <= 0.85; k += 0.32) {
    ctx.beginPath(); ctx.moveTo(x + k * R, y + 8); ctx.quadraticCurveTo(x + k * R + 1.5, (top + y) / 2, x + k * R - 0.5, top); ctx.stroke();
  }
  ctx.restore();
  snowDrift(ctx, x - 12, y + 9, 12, 5, 61);
  snowDrift(ctx, x + 14, y + 10, 10, 4.5, 67);
  // Снежная шапка на срезе, свисает с края.
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - R - 3, top + 2);
  ctx.quadraticCurveTo(x - R - 2, top - 9, x - 4, top - 10);
  ctx.quadraticCurveTo(x + R, top - 11, x + R + 3, top + 1);
  ctx.quadraticCurveTo(x + R - 2, top + 6, x + R - 5, top + 4);
  ctx.quadraticCurveTo(x + 6, top + 9, x - 2, top + 5);
  ctx.quadraticCurveTo(x - 9, top + 8, x - R + 1, top + 6);
  ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = 'rgba(140,175,215,0.45)';
  ell(ctx, x + 4, top + 1.5, R * 0.75, 3);
  ctx.fill();
  icicleRow(ctx, x - R + 2, x + R - 4, (px) => top + 5 + Math.sin((px - x) * 0.3) * 1.5, 80 + lv, 6 + lv);
  if (lv >= 2) {
    iceShard(ctx, x - R - 7, y + 10, 4, 9, -0.4);
    iceShard(ctx, x - R - 2, y + 11, 4.6, 12, 0.08);
    iceShard(ctx, x + R + 6, y + 10, 3.6, 7, 0.45);
  }
  const gl = ctx.createRadialGradient(x, top - 16, 2, x, top - 16, 38);
  gl.addColorStop(0, `rgba(${glow},${0.32 * pulse})`);
  gl.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = gl;
  circle(ctx, x, top - 16, 38);
  ctx.fill();
  // Гроздья опят: [x, y основания, наклон, длина, радиус, снег]; дальние раньше.
  const caps: ReadonlyArray<readonly [number, number, number, number, number, boolean]> = [
    [-4, top - 4, -0.15, 16, 7.5, true], [3, top - 5, 0.3, 13, 6.5, false], [-10, top - 2, -0.5, 10, 5.8, false],
    [9, top - 3, 0.6, 9, 5.4, true], [-R + 1, top + 12, -1.1, 7, 4.8, false], [R - 1, top + 14, 1.05, 7, 4.6, true],
    [0, top - 3, 0.05, 7, 5, false],
  ];
  const n = [4, 5, 7][lv - 1];
  const grow = variant ? 1.1 : 1;
  for (const [cx, cy, lean, len, cr, snow] of caps.slice(0, n)) {
    winterCap(ctx, x + cx, cy, len * grow + lv, lean, cr * grow, tone, snow);
  }
  if (lv >= 3) bullfinch(ctx, x + 13, top - 10, 0.95);
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 18;
    const sy = top - 22 - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.4 + (1 - t) * 1.6);
    ctx.fill();
  }
}

/** Снежок: белый шар с голубой тенью и искрой. */
function snowball(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 1.6);
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.5, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#e6f0fa');
  g.addColorStop(1, '#a8c4e2');
  fs(ctx, g);
  ctx.fillStyle = 'rgba(150,180,215,0.6)';
  circle(ctx, x + r * 0.25, y + r * 0.1, r * 0.18);
  ctx.fill();
}

/**
 * Катапульта Снегов: платформа из ледяных блоков со снегом и сосульками по краю, тёмный круг в
 * железном ободе с инеем, рама из тёмных брёвен на стойках, снег на стыках, кожаная праща.
 * 2-й уровень — бухта верёвки, 3-й — шкура, перекинутая через раму. Снаряды — снежки,
 * камнемёт — глыба льда, дождь — три снежка.
 */
export function drawTowerCatapultSnow(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15, 0.2);
  const side = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 36, 15, 0, 0, Math.PI);
    ctx.lineTo(x - 36, y + 4);
    ctx.ellipse(x, y + 4, 36, 15, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  ctx.save();
  side();
  ctx.clip();
  iceBricks(ctx, x, x - 36, y - 4, x + 36, y + 20, 600, 0, 6.5);
  iceShade(ctx, x - 36, x + 36, y - 4, y + 20);
  ctx.restore();
  outline(ctx, 2.5);
  ell(ctx, x, y + 4, 36, 15);
  ctx.stroke();
  ell(ctx, x, y - 2, 36, 15);
  const tg0 = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 36);
  tg0.addColorStop(0, '#f2fbff');
  tg0.addColorStop(1, '#a6d4ee');
  fs(ctx, tg0);
  ctx.save();
  ell(ctx, x, y - 2, 36, 15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,110,160,0.45)';
  ctx.lineWidth = 1;
  for (const [ax, ay, bx, by] of [[-36, -6, -14, 0], [-14, 0, -20, 13], [-14, 0, 6, -10], [6, -10, 22, 2], [22, 2, 36, -2], [22, 2, 14, 13]] as const) {
    ctx.beginPath(); ctx.moveTo(x + ax, y - 2 + ay); ctx.lineTo(x + bx, y - 2 + by); ctx.stroke();
  }
  ctx.restore();
  icicleRow(ctx, x - 30, x + 30, (px) => y + 4 + 15 * Math.sqrt(Math.max(0, 1 - ((px - x) / 36) ** 2)) - 0.5, 620 + lv, 6);
  snowDrift(ctx, x - 30, y + 12, 10, 4.5, 630);
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#36240f');
  ell(ctx, x, ty0, tr, tr * 0.46);
  const tg = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  tg.addColorStop(0, '#8a6644');
  tg.addColorStop(1, '#4e3420');
  fs(ctx, tg);
  ctx.save();
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,10,2,0.45)';
  ctx.lineWidth = 1;
  for (let k = -tr; k <= tr; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, ty0 - tr); ctx.lineTo(x + k, ty0 + tr); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.stroke();
  ctx.strokeStyle = '#5c626b';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.fillStyle = '#eef6ff';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + jit(i + 640) * 0.2;
    circle(ctx, x + Math.cos(a) * tr, ty0 + Math.sin(a) * tr * 0.46 - 0.6, 0.6 + jit(i + 650) * 0.7);
    ctx.fill();
  }
  // Рама на стойках из тёмных брёвен.
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
    beam(ctx, px, py + 1, px, py - lift, 4.2, DARK_WOOD);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  beam(ctx, -17, -11, 17, -11, 4.6, DARK_WOOD);
  beam(ctx, -17, 11, 17, 11, 4.6, DARK_WOOD);
  beam(ctx, -15, 13, -15, -13, 4.6, DARK_WOOD);
  beam(ctx, 15, 13, 15, -13, 4.6, DARK_WOOD);
  for (const [cx, cy] of corners) {
    outline(ctx, 1.2);
    circle(ctx, cx, cy, 3.6);
    fs(ctx, '#ffffff');
    ctx.fillStyle = 'rgba(140,175,215,0.5)';
    circle(ctx, cx + 0.8, cy + 0.8, 1.6);
    ctx.fill();
  }
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-2.5, -12.5, 5, 25);
  fs(ctx, DARK_WOOD.lo);
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
  if (lv >= 3) {
    outline(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(4, -14); ctx.quadraticCurveTo(14, -15, 15, -9); ctx.lineTo(13, -6); ctx.quadraticCurveTo(8, -8, 5, -6); ctx.closePath();
    fs(ctx, FUR.base);
    ctx.beginPath();
    ctx.moveTo(4, 14); ctx.quadraticCurveTo(14, 15, 15, 9); ctx.lineTo(13, 6); ctx.quadraticCurveTo(8, 8, 5, 6); ctx.closePath();
    fs(ctx, FUR.hi);
  }
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  beam(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5, DARK_WOOD);
  const bw = variant === 2 ? 13 : 9;
  const bh = variant === 2 ? 8 : 6.5;
  outline(ctx, 2.2);
  ell(ctx, tx, ty, bw, bh);
  const lg = ctx.createRadialGradient(tx - bw * 0.3, ty - bh * 0.4, 1, tx, ty, bw);
  lg.addColorStop(0, '#8a5a32');
  lg.addColorStop(1, '#3e2410');
  fs(ctx, lg);
  ctx.setLineDash([1.6, 1.8]);
  ctx.strokeStyle = 'rgba(245,220,170,0.8)';
  ctx.lineWidth = 0.9;
  ell(ctx, tx, ty, bw - 2, bh - 1.8);
  ctx.stroke();
  ctx.setLineDash([]);
  if (p < 0.5) {
    if (variant === 1) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(-angle);
      iceShard(ctx, -3, 5, 8, 6, -0.15);
      iceShard(ctx, 3, 5.5, 7, 8, 0.2);
      ctx.restore();
    } else {
      const bs: ReadonlyArray<readonly [number, number, number]> = variant === 2 ? [[-5, -0.5, 3.8], [4, -2, 3.8], [0, 2.4, 3.8]] : lv >= 3 ? [[-2.8, 0.4, 4.4], [3.4, -1.4, 4.4]] : [[0, 0, 5]];
      for (const [sx, sy, r] of bs) snowball(ctx, tx + sx, ty + sy, r);
    }
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.5);
  fs(ctx, '#6d737c');
  ctx.fillStyle = 'rgba(240,244,248,0.7)';
  circle(ctx, -1.5, -1.5, 1.7);
  ctx.fill();
  ctx.restore();
}

/** Точка на верхней кривой холма муравейника: левая половина от подножия (t=0) к макушке (t=1). */
function moundTop(x: number, y: number, t: number, side: number): Vec {
  const u = 1 - t;
  const px = u * u * u * -100 + 3 * u * u * t * -75 + 3 * u * t * t * -45;
  const py = u * u * u * 32 + 3 * u * u * t * -15 + 3 * u * t * t * -72 + t * t * t * -78;
  return { x: x + side * px, y: y + py };
}

/** Арка из ледяных блоков вокруг входа, с сосульками и снегом поверху. */
function iceArch(ctx: Ctx, x: number, base: number, r: number): void {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    const ri = r;
    const ro = r + 9;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a0) * ri, base + Math.sin(a0) * ri * 0.9);
    ctx.lineTo(x + Math.cos(a0) * ro, base + Math.sin(a0) * ro * 0.9);
    ctx.lineTo(x + Math.cos(a1) * ro, base + Math.sin(a1) * ro * 0.9);
    ctx.lineTo(x + Math.cos(a1) * ri, base + Math.sin(a1) * ri * 0.9);
    ctx.closePath();
    const am = (a0 + a1) / 2;
    const g = ctx.createLinearGradient(x + Math.cos(am) * ri, base + Math.sin(am) * ri, x + Math.cos(am) * ro, base + Math.sin(am) * ro);
    g.addColorStop(0, ICE[i % ICE.length]);
    g.addColorStop(1, '#e8f6fd');
    outline(ctx, 1.8);
    fs(ctx, g);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a0 + 0.05) * (ri + 2), base + Math.sin(a0 + 0.05) * (ri + 2) * 0.9);
    ctx.lineTo(x + Math.cos(a0 + 0.12) * (ro - 2), base + Math.sin(a0 + 0.12) * (ro - 2) * 0.9);
    ctx.lineTo(x + Math.cos(a0 + 0.17) * (ro - 2), base + Math.sin(a0 + 0.17) * (ro - 2) * 0.9);
    ctx.lineTo(x + Math.cos(a0 + 0.1) * (ri + 2), base + Math.sin(a0 + 0.1) * (ri + 2) * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  for (const s of [-1, 1]) {
    const bx = x + s * (r + 4.5);
    outline(ctx, 1.8);
    ctx.beginPath();
    ctx.roundRect(bx - 5, base - 1, 10, 9, 1.5);
    fs(ctx, ICE[(s + 2) % ICE.length]);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.ellipse(x, base, r + 9, (r + 9) * 0.9, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.2 + (i / 6) * 0.6);
    const ix = x + Math.cos(a) * r;
    const iy = base + Math.sin(a) * r * 0.9;
    icicle(ctx, ix, iy - 0.5, 4 + jit(i + 960) * 5, 2.2);
  }
}

/**
 * Муравейник Снегов: тот же холм под снежной шапкой, у подножия ледяные блоки со снегом
 * (расступаются у троп), вход в арку из ледяных блоков с сосульками, рядом маленький чум, сани
 * и ледяные фонари на столбиках, на холме северные знамёна, вокруг сугробы.
 */
export function drawAnthillSnow(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  if (!onPath?.(x - 92, y + 20)) {
    ctx.save();
    ctx.translate(x - 96, y + 22);
    ctx.scale(0.62, 0.62);
    hideTent(ctx, 0, 0, 30, 50, false);
    ctx.restore();
  }
  anthillMound(ctx, x, y, rng);
  // Снежная шапка по верху холма.
  const t0 = 0.42;
  outline(ctx, 3.5);
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const p = moundTop(x, y, t0 + ((1 - t0) * i) / 12, -1);
    if (i === 0) ctx.moveTo(p.x - 1.5, p.y); else ctx.lineTo(p.x, p.y - 1);
  }
  for (let i = 12; i >= 0; i--) {
    const p = moundTop(x, y, t0 + ((1 - t0) * i) / 12, 1);
    ctx.lineTo(p.x, p.y - 1);
  }
  const ex = moundTop(x, y, t0, 1);
  const half = ex.x - x;
  for (let i = 0; i <= 14; i++) {
    const px = ex.x - (2 * half * i) / 14;
    const k = (px - x) / half;
    ctx.lineTo(px, ex.y + 12 * (1 - k * k) + (i % 2 ? 3.5 : -1) + (jit(i + 980) - 0.5) * 2);
  }
  ctx.closePath();
  const sg = ctx.createLinearGradient(x - half, y - 78, x + half, y - 20);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(0.6, '#f0f6fc');
  sg.addColorStop(1, '#c4d6ea');
  fs(ctx, sg);
  ctx.fillStyle = 'rgba(150,180,215,0.35)';
  ell(ctx, x + 18, y - 40, 34, 9, -0.15);
  ctx.fill();
  // Ледяные блоки у подножия.
  const at = (t: number): Vec => {
    const u = 1 - t;
    return { x: u * u * (x - 100) + 2 * u * t * x + t * t * (x + 100), y: u * u * (y + 32) + 2 * u * t * (y + 66) + t * t * (y + 32) };
  };
  let t = 0.03;
  for (let i = 0; t < 0.98; i++) {
    const p = at(t);
    const w = 13 + jit(i + 1000) * 5;
    t += (w + 1.5) / 215;
    if (onPath?.(p.x, p.y - 5)) continue;
    outline(ctx, 1.8);
    ctx.beginPath();
    ctx.roundRect(p.x - w / 2, p.y - 11, w, 10, 1.6);
    const bg = ctx.createLinearGradient(p.x - w / 2, p.y - 11, p.x + w / 2, p.y - 1);
    bg.addColorStop(0, '#d6f0fb');
    bg.addColorStop(0.5, ICE[i % ICE.length]);
    bg.addColorStop(1, '#5a9ac8');
    fs(ctx, bg);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(p.x - w / 2 + 2, p.y - 9, 2, 6);
    snowCap(ctx, p.x, p.y - 11, w * 0.5, 2.2);
  }
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    snowBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  iceArch(ctx, x, y + 14, 27);
  for (const s of [-1, 1]) {
    const px = x + s * 50;
    if (onPath?.(px, y + 36)) continue;
    beam(ctx, px, y + 42, px, y + 18, 3.4, DARK_WOOD);
    iceLantern(ctx, px, y + 10);
  }
  if (!onPath?.(x + 80, y + 46)) sled(ctx, x + 82, y + 50, 1.1);
  for (const [px, py, rx, ry] of [[x - 74, y + 54, 16, 6], [x + 36, y + 64, 12, 5], [x - 20, y + 68, 10, 4]] as const) {
    if (!onPath?.(px, py)) snowDrift(ctx, px, py, rx, ry, Math.round(px + py));
  }
  for (let i = 0; i < 6; i++) {
    const px = x + rng.range(-120, 120);
    const py = y + rng.range(48, 74);
    if (onPath?.(px, py)) continue;
    snowflake(ctx, px, py, rng.range(2.2, 3.2), '#8ac6ea', 0.9);
  }
}
