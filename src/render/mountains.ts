/**
 * Постройки Гор (акт 4): альпийский стиль с горняцким духом — бутовая кладка из гранита на тёмном
 * растворе, бревенчатые шале под дранкой с камнями на крыше, герань в ящиках, кованое железо,
 * горняцкие фонари, кристаллы горного хрусталя, вход в штольню у муравейника. Детализация
 * на уровне утверждённых наборов Азии и Пустыни: объём градиентами (свет слева сверху), фактура.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, anthillMound, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, brass, jit, woodPole } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

/** Оттенки гранитных камней кладки: тёплые и холодные серые вперемешку. */
const GRANITE = ['#b8b5ad', '#a4a29b', '#c6c2b8', '#999890', '#adb0ab', '#bfb9ac'] as const;
const MORTAR = '#5d5950';
interface WoodTone { hi: string; base: string; lo: string }
const WOOD: WoodTone = { hi: '#d6a26a', base: '#9a6636', lo: '#5e3a1c' };
const IRON = '#4b4f57';

/**
 * Бутовая кладка внутри текущего клипа: округлые гранитные камни рядами вразбежку на растворе.
 * cyl — полуширина цилиндра (камни у краёв сужаются, ряды прогибаются книзу), 0 — плоская стена.
 */
function masonry(ctx: Ctx, cx: number, x0: number, y0: number, x1: number, y1: number, seed: number, cyl: number, rowH = 7): void {
  ctx.fillStyle = MORTAR;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const span = cyl ? (cyl * Math.PI) / 2 : (x1 - x0) / 2;
  let row = 0;
  for (let yy = y1 - rowH * 0.5; yy > y0 - rowH; yy -= rowH, row++) {
    let u = -span - jit(seed + row * 7) * 9;
    let i = 0;
    while (u < span + 2) {
      const w = 7.5 + jit(seed + row * 31 + i) * 6;
      let sx: number;
      let sw: number;
      if (cyl) {
        const a0 = Math.max(-Math.PI / 2, (u + 0.6) / cyl);
        const a1 = Math.min(Math.PI / 2, (u + w - 0.6) / cyl);
        const xa = cx + Math.sin(a0) * cyl;
        const xb = cx + Math.sin(a1) * cyl;
        sx = (xa + xb) / 2;
        sw = xb - xa;
      } else {
        sx = cx + u + w / 2;
        sw = w - 1.2;
      }
      const k = cyl ? (sx - cx) / cyl : 0;
      const sag = cyl ? 3 * (1 - k * k) : 0;
      const h = rowH * (0.74 + jit(seed + row * 17 + i) * 0.2);
      const sy = yy + sag + (jit(seed + row * 13 + i * 3) - 0.5) * 1.2;
      if (sw > 1.4) {
        ctx.beginPath();
        ctx.roundRect(sx - sw / 2, sy - h / 2, sw, h, Math.min(sw, h) * 0.45);
        ctx.fillStyle = GRANITE[Math.floor(jit(seed + row * 5 + i * 11) * GRANITE.length)];
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,250,0.3)';
        ell(ctx, sx - sw * 0.15, sy - h * 0.22, sw * 0.3, h * 0.15);
        ctx.fill();
        ctx.fillStyle = 'rgba(30,30,35,0.2)';
        ell(ctx, sx + sw * 0.1, sy + h * 0.26, sw * 0.38, h * 0.13);
        ctx.fill();
      }
      u += w;
      i++;
    }
  }
}

/** Объём цилиндра поверх кладки: светлее слева, тень справа. */
function cylShade(ctx: Ctx, x0: number, x1: number, y0: number, y1: number): void {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(20,20,30,0.15)');
  g.addColorStop(0.25, 'rgba(255,255,240,0.14)');
  g.addColorStop(0.6, 'rgba(20,20,30,0)');
  g.addColorStop(1, 'rgba(20,20,30,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** Затенение у земли (снизу) или под навесом (сверху) внутри клипа. */
function band(ctx: Ctx, x0: number, x1: number, ya: number, yb: number, a: number): void {
  const g = ctx.createLinearGradient(0, ya, 0, yb);
  g.addColorStop(0, `rgba(25,25,20,${a})`);
  g.addColorStop(1, 'rgba(25,25,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, Math.min(ya, yb), x1 - x0, Math.abs(yb - ya));
}

/** Тёсаный брус между двумя точками: светлая грань со стороны света, волокна. */
function beam(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, tone: WoodTone = WOOD): void {
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
  if (len > 10) {
    ctx.strokeStyle = 'rgba(50,25,8,0.42)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * hw * 0.3 + ux * len * 0.15, y1 - ny * hw * 0.3 + uy * len * 0.15);
    ctx.lineTo(x1 - nx * hw * 0.3 + ux * len * 0.8, y1 - ny * hw * 0.3 + uy * len * 0.8);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
}

/** Гранитный валун: неровный контур, блик слева сверху, трещинка; seed меняет форму. */
function rock(ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number): void {
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const k = 0.86 + jit(seed * 9 + i) * 0.22;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.85 : 1);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry);
  g.addColorStop(0, '#d2cec4');
  g.addColorStop(0.5, GRANITE[seed % GRANITE.length]);
  g.addColorStop(1, '#7c7a72');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(255,255,250,0.4)';
  ell(ctx, x - rx * 0.32, y - ry * 0.4, rx * 0.34, ry * 0.2, -0.2);
  ctx.fill();
  if (rx > 6) {
    ctx.strokeStyle = 'rgba(50,50,45,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + rx * 0.1, y - ry * 0.6);
    ctx.lineTo(x + rx * 0.25, y - ry * 0.1);
    ctx.lineTo(x + rx * 0.12, y + ry * 0.35);
    ctx.stroke();
  }
}

/** Пятна мха на камнях у земли. */
function mossPatch(ctx: Ctx, x: number, y: number, w: number, seed: number): void {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(96,140,56,0.85)' : 'rgba(126,170,72,0.85)';
    circle(ctx, x + (jit(seed + i) - 0.5) * w, y + (jit(seed + i + 9) - 0.5) * 3, 1.6 + jit(seed + i + 19) * 1.6);
    ctx.fill();
  }
}

/** Ящик с геранью: дощатый короб, тёмная листва, красные шапки соцветий. */
function geraniumBox(ctx: Ctx, x: number, y: number, w: number): void {
  for (let i = 0; i < 4; i++) {
    const lx = x - w * 0.42 + (i * w * 0.84) / 3;
    ctx.fillStyle = '#3f7a2a';
    circle(ctx, lx, y + 4.5, 2.4);
    ctx.fill();
  }
  ctx.fillStyle = '#4f8f32';
  for (let i = 0; i < 5; i++) {
    circle(ctx, x - w * 0.45 + (i * w * 0.9) / 4, y - 1, 2.6);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const fx = x - w * 0.3 + (i * w * 0.6) / 2;
    const fy = y - 3.2 - (i % 2) * 1.2;
    outline(ctx, 1);
    circle(ctx, fx, fy, 2.6);
    fs(ctx, '#d8322a');
    ctx.fillStyle = '#ff7a62';
    circle(ctx, fx - 0.8, fy - 0.8, 1);
    ctx.fill();
  }
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(x - w / 2, y, w, 5.5);
  fs(ctx, '#a8703c');
  ctx.strokeStyle = 'rgba(60,30,10,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 1, y + 2.7); ctx.lineTo(x + w / 2 - 1, y + 2.7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,190,0.35)';
  ctx.fillRect(x - w / 2 + 1, y + 0.8, w - 2, 1);
}

/**
 * Альпийская фетровая шляпа (вид сверху) смотрит по angle: поля чуть вытянуты вперёд-назад,
 * гладкая тулья-купол без меток в центре (иначе читается как глаз), сбоку назад торчит крупное
 * белое перо с тёмным кончиком — по нему шляпа и узнаётся.
 */
function alpineHat(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const sx = -fy;
  const sy = fx;
  // Перо: лист с очином, растёт от ленты сбоку и уходит назад.
  ctx.save();
  ctx.translate(x - fx * r * 0.2 + sx * r * 0.62, y - fy * r * 0.2 + sy * r * 0.62);
  ctx.rotate(angle + Math.PI - 0.45);
  const fl = r * 2.5;
  const fw = r * 0.52;
  const feather = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(fl * 0.45, -fw * 1.2, fl, -fw * 0.2);
    ctx.quadraticCurveTo(fl * 0.5, fw * 0.9, 0, 0);
    ctx.closePath();
  };
  feather();
  outline(ctx, 1.4);
  fs(ctx, '#e9e2d2');
  ctx.save();
  feather();
  ctx.clip();
  ctx.fillStyle = '#3a3128';
  ctx.fillRect(fl * 0.74, -fw * 2, fl, fw * 4);
  ctx.fillStyle = '#9a8468';
  ctx.fillRect(fl * 0.5, -fw * 2, fl * 0.07, fw * 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,55,40,0.7)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(fl * 0.5, -fw * 0.15, fl * 0.95, -fw * 0.2); ctx.stroke();
  ctx.restore();
  // Поля.
  let g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, '#6f9a52');
  g.addColorStop(0.6, '#44703a');
  g.addColorStop(1, '#2a4620');
  outline(ctx, 1.8);
  ell(ctx, x, y, r * 1.06, r * 0.92, angle);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(210,235,190,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.98, r * 0.84, angle, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
  // Тулья: гладкий купол, блик слева сверху, тень справа снизу; красная лента видна сбоку у пера.
  outline(ctx, 1.4);
  ell(ctx, x - 0.3, y - 0.3, r * 0.68, r * 0.56, angle);
  g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.05, x, y, r * 0.75);
  g.addColorStop(0, '#9cc47a');
  g.addColorStop(0.6, '#5c8842');
  g.addColorStop(1, '#3e6630');
  fs(ctx, g);
  ctx.strokeStyle = '#c8452f';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x - 0.3, y - 0.3, r * 0.66, r * 0.54, angle, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
}

/** Горное знамя на древке: стальной наконечник, перекладина с кистями, полотнище с острым низом, белая зигзаг-кайма, герб. */
function alpineBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  woodPole(ctx, px, ground, topY + 2, 4.2);
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(px, topY - 11); ctx.lineTo(px + 2.8, topY - 4); ctx.lineTo(px, topY - 1.5); ctx.lineTo(px - 2.8, topY - 4);
  ctx.closePath();
  const sg = ctx.createLinearGradient(px - 3, 0, px + 3, 0);
  sg.addColorStop(0, '#f2f5f7');
  sg.addColorStop(1, '#7d8790');
  fs(ctx, sg);
  const bw = 7.5;
  const y0 = topY + 5;
  const y1 = topY + 39;
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
    ctx.lineTo(px + bw, y1 - 8);
    ctx.lineTo(px, y1);
    ctx.lineTo(px - bw, y1 - 8);
    ctx.closePath();
  };
  cloth();
  const g = ctx.createLinearGradient(px - bw, 0, px + bw, 0);
  g.addColorStop(0, '#8a1c14');
  g.addColorStop(0.35, '#d23c2a');
  g.addColorStop(0.7, '#a8261a');
  g.addColorStop(1, '#6e140e');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  cloth();
  ctx.clip();
  const yb = y1 - 13;
  for (const [dy, lw] of [[0, 1.9], [3.4, 1]] as const) {
    ctx.strokeStyle = '#f6f2ea';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(px - bw + (i * 2 * bw) / 6, yb + dy + (i % 2 ? -3 : 0));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,240,220,0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px - bw + 1.6, y0 + 1.6, 2 * bw - 3.2, 2);
  antCrest(ctx, px, y0 + 11, 4.3, '#6e140e');
  for (const s of [-1, 1]) {
    const tx = px + s * (bw + 3);
    ctx.strokeStyle = '#e0b13c';
    ctx.lineWidth = 1.3;
    for (const d of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(tx, y0 + 1); ctx.lineTo(tx + d, y0 + 7); ctx.stroke(); }
    outline(ctx, 1);
    circle(ctx, tx, y0 + 1.5, 1.5);
    fs(ctx, '#e0b13c');
  }
}

/** Горняцкий фонарь: дужка, железная крышка, стекло с огоньком в железной клетке. */
function minerLantern(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, 'rgba(255,205,110,0.55)');
  glow.addColorStop(1, 'rgba(255,205,110,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 20);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y - 9.5, 3, Math.PI, 0); ctx.stroke();
  const gl = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 6);
  gl.addColorStop(0, '#fffbd8');
  gl.addColorStop(0.6, '#ffd76a');
  gl.addColorStop(1, '#e89a30');
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(x - 4.2, y - 6, 8.4, 10);
  fs(ctx, gl);
  ctx.fillStyle = '#ff9a3a';
  ell(ctx, x, y + 0.5, 1.4, 2.6);
  ctx.fill();
  ctx.strokeStyle = IRON;
  ctx.lineWidth = 1.2;
  for (const k of [-2.1, 2.1]) { ctx.beginPath(); ctx.moveTo(x + k, y - 6); ctx.lineTo(x + k, y + 4); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 4.2, y - 1); ctx.lineTo(x + 4.2, y - 1); ctx.stroke();
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 5.2, y - 6); ctx.lineTo(x + 5.2, y - 6); ctx.lineTo(x + 3, y - 9.5); ctx.lineTo(x - 3, y - 9.5);
  ctx.closePath();
  fs(ctx, '#5c626b');
  ctx.beginPath();
  ctx.rect(x - 5, y + 4, 10, 2.6);
  fs(ctx, '#5c626b');
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - 3.4, y - 5.2, 1.2, 8);
}

/** Цвета кристалла: светлая грань, основная, теневая. */
interface Gem { hi: string; base: string; lo: string }
const QUARTZ: Gem = { hi: '#f6fcff', base: '#b6dcf2', lo: '#628fb2' };
const ACID_GEM: Gem = { hi: '#f2ffd8', base: '#9ee45a', lo: '#4a8a22' };

/** Кристалл-призма: две видимые грани, пирамидка верхушки, блик; tilt — наклон. */
function crystal(ctx: Ctx, x: number, y: number, w: number, h: number, tilt: number, gem: Gem): void {
  const hw = w / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const face = (pts: ReadonlyArray<readonly [number, number]>, col: string | CanvasGradient): void => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  const g = ctx.createLinearGradient(-hw, -h, 0, 0);
  g.addColorStop(0, gem.hi);
  g.addColorStop(1, gem.base);
  face([[-hw, 0], [0, 1.5], [0, -h + 1.5], [-hw, -h]], g);
  face([[0, 1.5], [hw, 0], [hw, -h], [0, -h + 1.5]], gem.lo);
  face([[-hw, -h], [0, -h + 1.5], [0, -h - w * 0.9]], '#ffffff');
  face([[0, -h + 1.5], [hw, -h], [0, -h - w * 0.9]], gem.base);
  ctx.beginPath();
  ctx.moveTo(-hw, 0); ctx.lineTo(0, 1.5); ctx.lineTo(hw, 0); ctx.lineTo(hw, -h); ctx.lineTo(0, -h - w * 0.9); ctx.lineTo(-hw, -h);
  ctx.closePath();
  outline(ctx, 1.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,60,80,0.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(0, -h + 1.5); ctx.lineTo(-hw, -h); ctx.moveTo(0, -h + 1.5); ctx.lineTo(hw, -h); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-hw * 0.55, -h * 0.25); ctx.lineTo(-hw * 0.55, -h * 0.75); ctx.stroke();
  ctx.restore();
}

/** Друза кристаллов со свечением; s — масштаб. */
function crystalCluster(ctx: Ctx, x: number, y: number, s: number, gem: Gem, glowRgb: string | null): void {
  if (glowRgb) {
    const g = ctx.createRadialGradient(x, y - 6 * s, 1, x, y - 6 * s, 18 * s);
    g.addColorStop(0, `rgba(${glowRgb},0.45)`);
    g.addColorStop(1, `rgba(${glowRgb},0)`);
    ctx.fillStyle = g;
    circle(ctx, x, y - 6 * s, 18 * s);
    ctx.fill();
  }
  rock(ctx, x, y + 1.5 * s, 8 * s, 3.5 * s, 3);
  const parts: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-5, 0, 4.4, 8, -0.4], [5, 0.5, 4, 7, 0.45], [0, 1, 5.4, 13, 0.06], [-1.5, 2.5, 3.4, 5, -0.75], [3, 2.6, 3, 4, 0.8],
  ];
  for (const [dx, dy, w, h, t] of parts) crystal(ctx, x + dx * s, y + dy * s, w * s, h * s, t, gem);
}

/**
 * Каменные стрелки (Горы): круглая башня из гранитного бута, бойница, деревянные подкосы держат
 * дощатую галерею с перилами, стрелки в альпийских шляпах с пером. 2-й уровень — горное знамя,
 * ящик с геранью и друза кислотных кристаллов у подножия, 3-й — горняцкий фонарь на кронштейне.
 * Снайперы — высокий шест с вымпелом, залп — широкая башня и четверо.
 */
export function drawTowerAcidMountains(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 18 + lv + (variant === 2 ? 5 : 0);
  const rt = rb - 2;
  const dr = rt + 9;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15);
  if (level >= 2 && variant !== 1) alpineBanner(ctx, x + dr + 2, y + 2, top - 30);
  rock(ctx, x - rb - 2, y - 1, 6.5, 4.6, 1);
  rock(ctx, x + rb + 1, y - 2, 5.6, 4, 2);
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
  masonry(ctx, x, x - rb, bt, x + rb, bot + 7, 20 + lv * 7 + variant * 3, rb);
  cylShade(ctx, x - rb, x + rb, bt, bot + 7);
  band(ctx, x - rb, x + rb, bot + 7, y - 12, 0.4);
  band(ctx, x - rb, x + rb, bt, bt + 14, 0.5);
  mossPatch(ctx, x - rb * 0.55, bot + 3, 12, 7 + lv);
  ctx.restore();
  body();
  outline(ctx, 2.5);
  ctx.stroke();
  // Бойница: тёмная щель между тёсаными камнями, сверху перемычка, снизу подоконный камень.
  const wy = bt + (bot - bt) * 0.5;
  outline(ctx, 1.4);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + s * 3.4 - 2, wy - 5.5 + (s > 0 ? 0.6 : 0), 4, s > 0 ? 5 : 6.2, 1);
    fs(ctx, '#cfcac0');
    ctx.beginPath();
    ctx.roundRect(x + s * 3.4 - 2, wy + (s > 0 ? 0.4 : 1.4), 4, s > 0 ? 6.2 : 5, 1);
    fs(ctx, '#c2bdb2');
  }
  ctx.beginPath();
  ctx.rect(x - 1.4, wy - 5.5, 2.8, 12);
  ctx.fillStyle = '#1e1a16';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 6.5, wy - 9.5, 13, 4.2, 1.2);
  fs(ctx, '#dad5ca');
  ctx.beginPath();
  ctx.roundRect(x - 5.5, wy + 6.5, 11, 3, 1);
  fs(ctx, '#b9b4a8');
  // Подкосы под галереей и ящик с геранью.
  for (const k of [-0.66, 0.66]) beam(ctx, x + k * rt * 0.82, bt + 14, x + k * dr * 0.9, top + 6, 3.4);
  if (lv >= 2) geraniumBox(ctx, x, top + 9, 16);
  // Галерея: доски поперёк, гвозди, брус по краю.
  const ry = 9;
  outline(ctx, 2.5);
  ell(ctx, x, top + 4, dr, ry);
  fs(ctx, WOOD.lo);
  ell(ctx, x, top, dr, ry);
  const dg = ctx.createRadialGradient(x - dr * 0.3, top - 3, 2, x, top, dr);
  dg.addColorStop(0, '#e6bc84');
  dg.addColorStop(0.65, '#b98450');
  dg.addColorStop(1, '#8e5e32');
  fs(ctx, dg, false);
  ctx.save();
  ell(ctx, x, top, dr, ry);
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,40,15,0.45)';
  ctx.lineWidth = 1;
  for (let k = -dr + 5; k < dr; k += 5.2) {
    ctx.beginPath(); ctx.moveTo(x + k, top - ry); ctx.lineTo(x + k, top + ry); ctx.stroke();
    const sy = top + (jit(k * 3) - 0.5) * 10;
    ctx.beginPath(); ctx.moveTo(x + k, sy); ctx.lineTo(x + k + 5.2, sy); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = WOOD.base;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,235,200,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, top - 0.8, dr, ry, 0, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  // Перила по заднему краю: столбики, две жерди, шишечки.
  const posts = 3 + lv;
  const pts: Vec[] = [];
  for (let i = 0; i < posts; i++) {
    const th = Math.PI * 1.06 + ((Math.PI * 0.88) * i) / (posts - 1);
    pts.push({ x: x + Math.cos(th) * dr * 0.9, y: top + Math.sin(th) * ry * 0.9 + 1 });
  }
  for (const p of pts) beam(ctx, p.x, p.y + 1, p.x, p.y - 11, 3.2);
  for (const dy of [-5, -10]) {
    for (const [col, lw] of [[OUT, 3.6], [WOOD.base, 2], ['rgba(255,225,180,0.6)', 0.7]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + dy) : ctx.moveTo(p.x, p.y + dy)));
      ctx.stroke();
    }
  }
  for (const p of pts) {
    outline(ctx, 1.2);
    circle(ctx, p.x, p.y - 12, 2);
    fs(ctx, WOOD.hi);
  }
  rock(ctx, x + rb - 4, y + 10, 6, 4.2, 4);
  if (lv >= 2) crystalCluster(ctx, x - rb - 1, y + 9, 0.85, ACID_GEM, '150,255,90');
  // 3-й уровень: фонарь на кованом кронштейне слева.
  if (level >= 3 && variant !== 1) {
    const lx = x - rb - 5;
    const ly = bt + 9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(x - rt + 2, ly + 2); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(lx + 4, ly + 4.5, 4, Math.PI, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 7); ctx.stroke();
    minerLantern(ctx, lx, ly + 17);
  }
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
    alpineHat(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.6 * as / 0.6, angle);
  }
}

/** Алебарда: древко, топор-полумесяц, пика и обратный крюк из стали. */
function halberd(ctx: Ctx, hx: number, hy: number, tx: number, ty: number): void {
  const len = Math.hypot(tx - hx, ty - hy) || 1;
  const ux = (tx - hx) / len;
  const uy = (ty - hy) / len;
  const nx = uy;
  const ny = -ux;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  const steel = ctx.createLinearGradient(tx - nx * 8, ty - ny * 8, tx + nx * 8, ty + ny * 8);
  steel.addColorStop(0, '#f2f5f7');
  steel.addColorStop(1, '#7d8790');
  const at = (a: number, b: number): [number, number] => [tx + ux * a + nx * b, ty + uy * a + ny * b];
  ctx.beginPath();
  ctx.moveTo(...at(-12, 1));
  ctx.lineTo(...at(-12, 4));
  ctx.quadraticCurveTo(...at(-11, 9.5), ...at(-6, 10));
  ctx.quadraticCurveTo(...at(-4.5, 6), ...at(-3, 1));
  ctx.closePath();
  outline(ctx, 1.6);
  fs(ctx, steel);
  ctx.beginPath();
  ctx.moveTo(...at(-9.5, -1)); ctx.lineTo(...at(-7, -6)); ctx.lineTo(...at(-6, -1));
  ctx.closePath();
  fs(ctx, steel);
  ctx.beginPath();
  ctx.moveTo(...at(-2, -1.6)); ctx.lineTo(...at(8, 0)); ctx.lineTo(...at(-2, 1.6));
  ctx.closePath();
  fs(ctx, steel);
}

/** Круглый деревянный щит: доски, железный обод с заклёпками, умбон, красная полоса. */
function woodShield(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2);
  circle(ctx, x, y, r);
  fs(ctx, '#b07a44');
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = '#c8452f';
  ctx.fillRect(x - r, y - 1.6, 2 * r, 3.2);
  ctx.strokeStyle = 'rgba(60,30,10,0.45)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(x + k * r, y - r); ctx.lineTo(x + k * r, y + r); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.4;
  circle(ctx, x, y, r - 1);
  ctx.stroke();
  ctx.strokeStyle = '#6a7079';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  outline(ctx, 1.3);
  circle(ctx, x, y, r * 0.3);
  fs(ctx, '#8a9099');
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ell(ctx, x - r * 0.4, y - r * 0.45, r * 0.25, r * 0.13, -0.5);
  ctx.fill();
}

/** Окно со ставнями: стекло с переплётом и зелёные ставни с косой доской. */
function shutteredWindow(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  fs(ctx, '#3a3226');
  ctx.fillStyle = 'rgba(255,225,150,0.5)';
  ctx.fillRect(x - w / 2 + 1, y - h / 2 + 1, w / 2 - 1.5, h / 2 - 1.5);
  ctx.strokeStyle = '#d6c2a0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
  for (const s of [-1, 1]) {
    const sx = x + s * (w / 2 + w * 0.3);
    outline(ctx, 1.3);
    ctx.beginPath();
    ctx.rect(sx - w * 0.3, y - h / 2 - 0.5, w * 0.6, h + 1);
    fs(ctx, '#3f7a4a');
    ctx.strokeStyle = 'rgba(15,40,20,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(sx - w * 0.3, y + h / 2); ctx.lineTo(sx + w * 0.3, y - h / 2); ctx.stroke();
  }
  ctx.fillStyle = '#b8b2a6';
  ctx.fillRect(x - w / 2 - 1, y + h / 2, w + 2, 1.6);
}

/** Бревенчатая стена: брёвна с бликом и торцы с годовыми кольцами на углах (через ряд выступают). */
function logWall(ctx: Ctx, x: number, top: number, bottom: number, half: number): void {
  const n = Math.max(2, Math.round((bottom - top) / 3.4));
  const lh = (bottom - top) / n;
  for (let i = 0; i < n; i++) {
    const ly = top + i * lh;
    outline(ctx, 1.4);
    ctx.beginPath();
    ctx.roundRect(x - half, ly, 2 * half, lh, lh / 2);
    const g = ctx.createLinearGradient(0, ly, 0, ly + lh);
    g.addColorStop(0, WOOD.hi);
    g.addColorStop(0.45, '#a8703c');
    g.addColorStop(1, WOOD.lo);
    fs(ctx, g);
  }
  for (let i = 0; i < n; i++) {
    const ly = top + (i + 0.5) * lh;
    const out = i % 2 ? 1.5 : 3;
    for (const s of [-1, 1]) {
      const ex = x + s * (half + out - 1);
      outline(ctx, 1.2);
      ell(ctx, ex, ly, lh * 0.52, lh * 0.5);
      fs(ctx, '#e2bc86');
      ctx.strokeStyle = 'rgba(110,70,30,0.6)';
      ctx.lineWidth = 0.6;
      ell(ctx, ex, ly, lh * 0.26, lh * 0.25);
      ctx.stroke();
    }
  }
}

/**
 * Казарма Гор: шале — каменный первый этаж из бута с угловыми блоками, арочная дубовая дверь с
 * коваными петлями, окна со ставнями; бревенчатый второй этаж с балконом; крыша из дранки с камнями
 * и резным крестом коньковых досок. 2-й уровень — ящики с геранью и каменная труба с дымком,
 * 3-й — смотровая башенка на коньке с флюгером. Броненосцы — деревянные щиты, жнецы — алебарды.
 */
export function drawTowerBarracksMountains(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const ww = 26;
  const pw = 39;
  const wallBot = y - 4;
  const sTop = wallBot - 18;
  const uTop = sTop - 13;
  const ew = ww + 13;
  const rBase = uTop + 4;
  const rTop = uTop - 21;
  const d = 13;
  drawShadow(ctx, x + 4, y + 12, 50, 17);
  alpineBanner(ctx, x + 33, y - 8, uTop - 50 - (lv - 1) * 8);
  if (variant === 2) {
    halberd(ctx, x - 30, uTop - 6, x + 16, uTop - 64);
    halberd(ctx, x + 30, uTop - 6, x - 16, uTop - 64);
  }
  // Цоколь: плита и бут спереди.
  const plinth = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - pw, y - 2); ctx.lineTo(x + pw, y - 2); ctx.lineTo(x + pw - 2, y + 10); ctx.lineTo(x - pw + 2, y + 10);
    ctx.closePath();
  };
  outline(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - pw, y - 2); ctx.lineTo(x - pw + 8, y - 9); ctx.lineTo(x + pw - 8, y - 9); ctx.lineTo(x + pw, y - 2);
  ctx.closePath();
  fs(ctx, '#bdb8ad');
  ctx.save();
  plinth();
  ctx.clip();
  masonry(ctx, x, x - pw, y - 2, x + pw, y + 10, 500, 0, 6);
  band(ctx, x - pw, x + pw, y + 10, y + 2, 0.3);
  ctx.restore();
  plinth();
  outline(ctx, 2.5);
  ctx.stroke();
  // Каменный этаж.
  const wall = (): void => {
    ctx.beginPath();
    ctx.rect(x - ww, sTop, 2 * ww, wallBot - sTop);
  };
  ctx.save();
  wall();
  ctx.clip();
  masonry(ctx, x, x - ww, sTop, x + ww, wallBot, 520 + lv, 0, 6.5);
  const sh = ctx.createLinearGradient(x - ww, 0, x + ww, 0);
  sh.addColorStop(0, 'rgba(255,255,240,0.1)');
  sh.addColorStop(1, 'rgba(20,20,30,0.28)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - ww, sTop, 2 * ww, wallBot - sTop);
  band(ctx, x - ww, x + ww, sTop, sTop + 6, 0.45);
  mossPatch(ctx, x - ww + 6, wallBot - 1.5, 10, 530);
  ctx.restore();
  wall();
  outline(ctx, 2.5);
  ctx.stroke();
  // Угловые блоки через ряд.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const bw = i % 2 ? 5 : 8;
      const by = sTop + 1 + i * 5.8;
      const bx = s < 0 ? x - ww : x + ww - bw;
      outline(ctx, 1.3);
      ctx.beginPath();
      ctx.rect(bx, by, bw, 5.2);
      fs(ctx, i % 2 ? '#c9c4b8' : '#d8d3c8');
    }
  }
  // Дверь: каменная арка, доски, кованые петли, кольцо.
  const door = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - 7, wallBot);
    ctx.lineTo(x - 7, wallBot - 10);
    ctx.arc(x, wallBot - 10, 7, Math.PI, 0);
    ctx.lineTo(x + 7, wallBot);
    ctx.closePath();
  };
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(x, wallBot - 10, 9, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#d8d3c8';
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,65,55,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (Math.PI * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 7, wallBot - 10 + Math.sin(a) * 7);
    ctx.lineTo(x + Math.cos(a) * 11, wallBot - 10 + Math.sin(a) * 11);
    ctx.stroke();
  }
  door();
  const dg = ctx.createLinearGradient(x - 7, 0, x + 7, 0);
  dg.addColorStop(0, '#9a6636');
  dg.addColorStop(1, '#5e3a1c');
  outline(ctx, 2);
  fs(ctx, dg);
  ctx.save();
  door();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,20,5,0.6)';
  ctx.lineWidth = 0.9;
  for (const k of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.moveTo(x + k, wallBot - 18); ctx.lineTo(x + k, wallBot); ctx.stroke(); }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  for (const hy of [wallBot - 12, wallBot - 4]) { ctx.beginPath(); ctx.moveTo(x - 7, hy); ctx.lineTo(x + 2, hy); ctx.stroke(); }
  ctx.strokeStyle = '#8a9099';
  ctx.lineWidth = 1;
  for (const hy of [wallBot - 12, wallBot - 4]) { ctx.beginPath(); ctx.moveTo(x - 7, hy); ctx.lineTo(x + 2, hy); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#d2b04a';
  ctx.lineWidth = 1.1;
  circle(ctx, x + 3.5, wallBot - 7, 1.4);
  ctx.stroke();
  for (const s of [-1, 1]) shutteredWindow(ctx, x + s * 16.5, sTop + 8, 5.5, 6.5);
  if (lv >= 2) for (const s of [-1, 1]) geraniumBox(ctx, x + s * 16.5, sTop + 12.5, 11);
  if (variant === 1) for (const s of [-1, 1]) woodShield(ctx, x + s * 33, y - 6, 7.2);
  // Ступени к двери.
  outline(ctx, 1.8);
  ctx.beginPath(); ctx.rect(x - 10, y - 3, 20, 4); fs(ctx, '#c9c4b8');
  ctx.beginPath(); ctx.rect(x - 12, y + 1, 24, 4); fs(ctx, '#b4afa4');
  // Бревенчатый этаж и балкон.
  logWall(ctx, x, uTop, sTop, ww - 1);
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(x - ww - 4, sTop - 1, 2 * ww + 8, 3);
  fs(ctx, WOOD.lo);
  const nb = 13;
  for (let i = 0; i < nb; i++) {
    const bx = x - ww - 2 + (i * (2 * ww + 4)) / (nb - 1);
    ctx.beginPath();
    ctx.moveTo(bx - 1.7, sTop - 1);
    ctx.lineTo(bx - 1.7, sTop - 3);
    ctx.quadraticCurveTo(bx - 0.6, sTop - 4.5, bx - 1.7, sTop - 6);
    ctx.lineTo(bx - 1.7, sTop - 8);
    ctx.lineTo(bx + 1.7, sTop - 8);
    ctx.lineTo(bx + 1.7, sTop - 6);
    ctx.quadraticCurveTo(bx + 0.6, sTop - 4.5, bx + 1.7, sTop - 3);
    ctx.lineTo(bx + 1.7, sTop - 1);
    ctx.closePath();
    outline(ctx, 1);
    fs(ctx, i % 2 ? '#c48c52' : '#b07a44');
  }
  beam(ctx, x - ww - 4, sTop - 8.5, x + ww + 4, sTop - 8.5, 2.6);
  // Крыша: скаты из дранки уходят назад, на них камни; фронтон из досок; резные коньковые доски.
  for (const s of [-1, 1]) {
    const slope = (): void => {
      ctx.beginPath();
      ctx.moveTo(x, rTop);
      ctx.lineTo(x + s * ew, rBase);
      ctx.lineTo(x + s * ew, rBase - d);
      ctx.lineTo(x, rTop - d);
      ctx.closePath();
    };
    slope();
    const rg = ctx.createLinearGradient(x, rTop - d, x + s * ew, rBase);
    rg.addColorStop(0, s < 0 ? '#9a8a74' : '#7a6c5a');
    rg.addColorStop(1, s < 0 ? '#7e6e58' : '#5e5244');
    outline(ctx, 2.4);
    fs(ctx, rg);
    ctx.save();
    slope();
    ctx.clip();
    for (let k = 1; k < 6; k++) {
      const off = -k * (d / 5.5);
      ctx.strokeStyle = 'rgba(35,28,20,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, rTop + off); ctx.lineTo(x + s * ew, rBase + off); ctx.stroke();
      for (let t = 0.08 + (k % 2) * 0.06; t < 1; t += 0.13) {
        const px = x + s * ew * t;
        const py = rTop + (rBase - rTop) * t + off;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + d / 5.5); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,240,215,0.2)';
      ctx.beginPath(); ctx.moveTo(x, rTop + off + 1); ctx.lineTo(x + s * ew, rBase + off + 1); ctx.stroke();
    }
    ctx.restore();
    for (const [t, k] of [[0.35, 0.45], [0.72, 0.55]] as const) {
      rock(ctx, x + s * ew * t, rTop + (rBase - rTop) * t - d * k, 3.6, 2.6, 5 + (s > 0 ? 2 : 0) + Math.round(t * 10));
    }
  }
  // Труба на правом скате (2-й уровень).
  if (lv >= 2) {
    const cx = x + ew * 0.55;
    const cb = rTop + (rBase - rTop) * 0.55 - d * 0.5;
    const chim = (): void => {
      ctx.beginPath();
      ctx.rect(cx - 4.5, cb - 13, 9, 13);
    };
    ctx.save();
    chim();
    ctx.clip();
    masonry(ctx, cx, cx - 5, cb - 14, cx + 5, cb, 560, 0, 4.4);
    ctx.restore();
    chim();
    outline(ctx, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(cx - 6, cb - 15.5, 12, 3);
    fs(ctx, '#8f8a80');
    for (const [px, py, r, a] of [[0, -20, 3.2, 0.55], [2.5, -26, 4.2, 0.4], [6, -33, 5, 0.25]] as const) {
      ctx.fillStyle = `rgba(235,235,230,${a})`;
      circle(ctx, cx + px, cb + py, r);
      ctx.fill();
    }
  }
  // Фронтон.
  const gable = (): void => {
    ctx.beginPath();
    ctx.moveTo(x, rTop + 3);
    ctx.lineTo(x + ww + 1, uTop + 1);
    ctx.lineTo(x - ww - 1, uTop + 1);
    ctx.closePath();
  };
  gable();
  outline(ctx, 2);
  fs(ctx, '#b07a44');
  ctx.save();
  gable();
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,30,10,0.45)';
  ctx.lineWidth = 0.9;
  for (let k = -ww; k <= ww; k += 4) { ctx.beginPath(); ctx.moveTo(x + k, rTop); ctx.lineTo(x + k, uTop + 1); ctx.stroke(); }
  band(ctx, x - ww, x + ww, rTop + 3, rTop + 12, 0.4);
  ctx.restore();
  outline(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(x, uTop - 13); ctx.lineTo(x + 3.2, uTop - 8.5); ctx.lineTo(x, uTop - 4); ctx.lineTo(x - 3.2, uTop - 8.5);
  ctx.closePath();
  fs(ctx, '#2e2418');
  // Коньковые доски крест-накрест.
  for (const s of [-1, 1]) {
    const x0 = x - s * 5;
    const y0 = rTop - 5 * ((rBase - rTop) / ew);
    for (const [col, lw] of [[OUT, 5.6], ['#8a5a2c', 3.4], ['rgba(255,225,180,0.5)', 1]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x + s * (ew + 1), rBase + 0.5); ctx.stroke();
    }
  }
  // Смотровая башенка на коньке (3-й уровень).
  if (lv >= 3) {
    const tx = x;
    const tb = rTop - d * 0.45;
    outline(ctx, 1.8);
    ctx.beginPath();
    ctx.rect(tx - 5.5, tb - 10, 11, 10);
    fs(ctx, '#a8703c');
    ctx.fillStyle = '#2e2418';
    ctx.fillRect(tx - 3.5, tb - 8, 7, 5);
    ctx.strokeStyle = '#8a5a2c';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, tb - 8); ctx.lineTo(tx, tb - 3); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - 8, tb - 9); ctx.lineTo(tx, tb - 21); ctx.lineTo(tx + 8, tb - 9);
    ctx.closePath();
    const tg = ctx.createLinearGradient(tx - 8, 0, tx + 8, 0);
    tg.addColorStop(0, '#9a8a74');
    tg.addColorStop(1, '#5e5244');
    outline(ctx, 2);
    fs(ctx, tg);
    ctx.strokeStyle = 'rgba(35,28,20,0.45)';
    ctx.lineWidth = 0.9;
    for (const k of [0.35, 0.65]) {
      ctx.beginPath(); ctx.moveTo(tx - 8 * (1 - k) - 0.5, tb - 9 - 12 * k); ctx.lineTo(tx + 8 * (1 - k) + 0.5, tb - 9 - 12 * k); ctx.stroke();
    }
    outline(ctx, 1.2);
    ctx.beginPath(); ctx.moveTo(tx, tb - 21); ctx.lineTo(tx, tb - 29); ctx.stroke();
    pennant(ctx, tx, tb - 30, 11, 6, '#c8452f');
    circle(ctx, tx, tb - 30.5, 1.8);
    fs(ctx, '#f2c94c');
  }
}

/** Цвета светящихся грибов: светлая макушка, основной, тёмный край. */
interface GlowTone { hi: string; base: string; lo: string }

/** Тонкий светящийся гриб-колокольчик: волосяная ножка, прозрачная шляпка с пластинками и ореолом. */
function glowCap(ctx: Ctx, bx: number, by: number, len: number, lean: number, cr: number, tone: GlowTone, glow: string, pulse: number): void {
  const tx = bx + Math.sin(lean) * len;
  const ty = by - Math.cos(lean) * len;
  const halo = ctx.createRadialGradient(tx, ty - cr * 0.4, 0.5, tx, ty - cr * 0.4, cr * 2.4);
  halo.addColorStop(0, `rgba(${glow},${0.5 * pulse})`);
  halo.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = halo;
  circle(ctx, tx, ty - cr * 0.4, cr * 2.4);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (tx - bx) * 0.3, by - len * 0.55, tx, ty); ctx.stroke();
  ctx.strokeStyle = '#eef0e2';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(lean);
  const cap = (): void => {
    ctx.beginPath();
    ctx.moveTo(-cr, 1);
    ctx.bezierCurveTo(-cr * 0.95, -cr * 0.55, -cr * 0.45, -cr * 1.3, 0, -cr * 1.38);
    ctx.bezierCurveTo(cr * 0.45, -cr * 1.3, cr * 0.95, -cr * 0.55, cr, 1);
    ctx.quadraticCurveTo(0, 2.6, -cr, 1);
    ctx.closePath();
  };
  cap();
  const g = ctx.createRadialGradient(-cr * 0.3, -cr * 1, 0.4, 0, -cr * 0.4, cr * 1.5);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.55, tone.base);
  g.addColorStop(1, tone.lo);
  outline(ctx, 1.7);
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(40,20,60,0.3)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.6, -0.2, 0.2, 0.6]) {
    ctx.beginPath(); ctx.moveTo(k * cr * 0.3, -cr * 1.05); ctx.quadraticCurveTo(k * cr * 0.85, -cr * 0.4, k * cr, 1.2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ell(ctx, -cr * 0.35, -cr * 0.85, cr * 0.15, cr * 0.32, 0.3);
  ctx.fill();
  ctx.restore();
}

/**
 * Расколотая жеода: неровная гранитная скорлупа, белые полосы агата по краю, внутри плотная щётка
 * аметиста — светлая у края, темнее к середине, с искрами. Возвращает центр полости.
 */
function geode(ctx: Ctx, x: number, y: number, rx: number, ry: number): Vec {
  const cy = y - ry * 0.3;
  const oy = ry * 0.6;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (i / 16);
    const k = 1 + (jit(i + 300) - 0.5) * 0.14;
    ctx.lineTo(x + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * 1.05 * k);
  }
  ctx.ellipse(x, cy, rx, oy, 0, Math.PI, TAU);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rx, cy, x + rx * 0.7, y + ry);
  g.addColorStop(0, '#c4bdb0');
  g.addColorStop(0.5, '#9a9286');
  g.addColorStop(1, '#645e56');
  outline(ctx, 2.5);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(40,36,30,0.2)';
  for (const [px, py, pr] of [[-0.6, 0.55, 1.6], [-0.2, 0.8, 1.2], [0.62, 0.4, 1.5], [0.15, 0.6, 1], [-0.75, 0.2, 1.1]] as const) {
    circle(ctx, x + px * rx, cy + py * ry, pr);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,250,240,0.25)';
  ell(ctx, x - rx * 0.6, cy + ry * 0.3, rx * 0.18, ry * 0.25, 0.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,46,40,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + rx * 0.35, cy + oy * 0.9); ctx.lineTo(x + rx * 0.45, cy + ry * 0.55); ctx.lineTo(x + rx * 0.3, cy + ry * 0.9); ctx.stroke();
  // Агат: белый край с голубоватыми полосами.
  outline(ctx, 1.8);
  ell(ctx, x, cy, rx * 0.95, oy * 0.95);
  fs(ctx, '#eef3f6');
  for (const [k, col] of [[0.88, '#a9bfd0'], [0.82, '#d2dee6']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ell(ctx, x, cy, rx * k, oy * k);
    ctx.stroke();
  }
  // Аметистовая щётка.
  const irx = rx * 0.76;
  const iry = oy * 0.74;
  const cg = ctx.createRadialGradient(x, cy + iry * 0.2, 1, x, cy, irx);
  cg.addColorStop(0, '#4a1f7a');
  cg.addColorStop(0.55, '#8a52c8');
  cg.addColorStop(1, '#c9a6ee');
  ctx.fillStyle = cg;
  ell(ctx, x, cy, irx, iry);
  ctx.fill();
  ctx.save();
  ell(ctx, x, cy, irx, iry);
  ctx.clip();
  const tips: Vec[] = [];
  for (let i = 0; i < 30; i++) {
    const t = Math.sqrt(jit(i * 3 + 401));
    const a = jit(i * 3 + 402) * TAU;
    tips.push({ x: x + Math.cos(a) * irx * t * 0.95, y: cy + Math.sin(a) * iry * t * 0.95 });
  }
  tips.sort((p, q) => p.y - q.y);
  tips.forEach((p, i) => {
    const r = Math.hypot((p.x - x) / irx, (p.y - cy) / iry);
    const sz = 1.4 + r * 1.8 + jit(i + 470) * 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - sz * 1.5); ctx.lineTo(p.x - sz * 0.7, p.y); ctx.lineTo(p.x, p.y + sz * 0.45);
    ctx.closePath();
    ctx.fillStyle = r > 0.5 ? '#ecdcff' : '#b48ae8';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - sz * 1.5); ctx.lineTo(p.x + sz * 0.7, p.y); ctx.lineTo(p.x, p.y + sz * 0.45);
    ctx.closePath();
    ctx.fillStyle = r > 0.5 ? '#9a66d4' : '#5e2e96';
    ctx.fill();
  });
  ctx.fillStyle = '#ffffff';
  for (const [px, py] of [[-0.45, -0.3], [0.3, -0.45], [0.55, 0.1], [-0.15, 0.25]] as const) {
    const sx = x + px * irx;
    const sy = cy + py * iry;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 2); ctx.lineTo(sx + 0.5, sy - 0.5); ctx.lineTo(sx + 2, sy); ctx.lineTo(sx + 0.5, sy + 0.5);
    ctx.lineTo(sx, sy + 2); ctx.lineTo(sx - 0.5, sy + 0.5); ctx.lineTo(sx - 2, sy); ctx.lineTo(sx - 0.5, sy - 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  return { x, y: cy };
}

/**
 * Грибница Гор: расколотая жеода — гранитная скорлупа, полосы агата, щётка аметиста, из
 * полости тянутся тонкие светящиеся голубые грибы-колокольчики. 2-й уровень — друза хрусталя и мох у
 * подножия, 3-й — кирка, воткнутая в камень, и горняцкий фонарь. Гниль — болотный, дурман — розовый.
 */
export function drawTowerSporeMountains(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: GlowTone = variant === 1
    ? { hi: '#f6fad0', base: '#c2cc56', lo: '#66721a' }
    : variant === 2 ? { hi: '#fff0fa', base: '#e88ad0', lo: '#9a2a80' } : { hi: '#f4fbff', base: '#9fd2f0', lo: '#3f72b0' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 32, 12);
  if (lv >= 3) {
    rock(ctx, x + 25, y + 5, 7, 5, 6);
    beam(ctx, x + 23, y + 2, x + 31, y - 20, 2.8);
    const steel = ctx.createLinearGradient(x + 22, y - 26, x + 40, y - 18);
    steel.addColorStop(0, '#f2f5f7');
    steel.addColorStop(1, '#6d7780');
    ctx.beginPath();
    ctx.moveTo(x + 21, y - 19);
    ctx.quadraticCurveTo(x + 30, y - 27, x + 41, y - 21);
    ctx.quadraticCurveTo(x + 31, y - 23, x + 22, y - 16.5);
    ctx.closePath();
    outline(ctx, 1.6);
    fs(ctx, steel);
  }
  const c = geode(ctx, x, y + 2, 24, 22);
  const g = ctx.createRadialGradient(c.x, c.y - 18, 2, c.x, c.y - 18, 40);
  g.addColorStop(0, `rgba(${glow},${0.32 * pulse})`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  circle(ctx, c.x, c.y - 18, 40);
  ctx.fill();
  const caps: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [0, -0.05, 30, 7, 0], [-7, -0.38, 22, 6, 1], [7, 0.42, 20, 5.8, 2], [3, 0.14, 12, 4.8, 3], [-3, -0.22, 9, 4.2, 4],
  ];
  const grow = variant ? 1.1 : 1;
  for (const [dx, lean, len, cr, i] of caps.slice(0, 2 + lv)) {
    const p = 0.6 + 0.4 * Math.sin(time * 2.2 + i * 1.3);
    glowCap(ctx, c.x + dx, c.y + 1, (len + lv * 2) * grow, lean, cr * grow, tone, glow, p);
  }
  if (lv >= 2) {
    crystalCluster(ctx, x - 21, y + 12, 0.7, QUARTZ, null);
    mossPatch(ctx, x + 14, y + 15, 12, 41);
  }
  if (lv >= 3) minerLantern(ctx, x + 22, y + 13);
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 20;
    const sy = c.y - 30 - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.4 + (1 - t) * 1.6);
    ctx.fill();
  }
}

/** Деревянная чаша метателя с двумя железными обручами. */
function ironBowl(ctx: Ctx, x: number, y: number, bw: number, bh: number): void {
  outline(ctx, 2.2);
  ell(ctx, x, y, bw, bh);
  const g = ctx.createRadialGradient(x - bw * 0.3, y - bh * 0.4, 1, x, y, bw);
  g.addColorStop(0, '#b07a44');
  g.addColorStop(1, '#5e3a1c');
  fs(ctx, g);
  ctx.fillStyle = '#3a2412';
  ell(ctx, x, y, bw * 0.68, bh * 0.62);
  ctx.fill();
  ctx.strokeStyle = IRON;
  ctx.lineWidth = 1.6;
  ell(ctx, x, y, bw - 1.2, bh - 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,205,212,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(x, y, bw - 1.2, bh - 1, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
}

/**
 * Катапульта Гор: гранитное основание с плитами, дощатый поворотный круг в железном ободе с
 * заклёпками, рама из тёсаного бруса на стойках с коваными уголками, чаша в железных обручах.
 * 2-й уровень — бухта верёвки, 3-й — ворот с барабаном и рукоятью. Снаряды — камни,
 * камнемёт — замшелый валун, дождь — три камня.
 */
export function drawTowerCatapultMountains(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15);
  // Основание: бут сбоку, плиты сверху.
  const side = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 36, 15, 0, 0, Math.PI);
    ctx.lineTo(x - 36, y + 3);
    ctx.ellipse(x, y + 3, 36, 15, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  ctx.save();
  side();
  ctx.clip();
  masonry(ctx, x, x - 36, y - 4, x + 36, y + 19, 600, 0, 5.5);
  band(ctx, x - 36, x + 36, y + 19, y + 6, 0.35);
  ctx.restore();
  outline(ctx, 2.5);
  ell(ctx, x, y + 3, 36, 15);
  ctx.stroke();
  ell(ctx, x, y - 2, 36, 15);
  const tg0 = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 36);
  tg0.addColorStop(0, '#d8d4ca');
  tg0.addColorStop(1, '#a29e95');
  fs(ctx, tg0);
  ctx.save();
  ell(ctx, x, y - 2, 36, 15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,58,52,0.5)';
  ctx.lineWidth = 1.1;
  for (const [ax, ay, bx, by] of [[-36, -6, -14, 0], [-14, 0, -20, 13], [-14, 0, 6, -10], [6, -10, 4, -17], [6, -10, 22, 2], [22, 2, 36, -2], [22, 2, 14, 13], [-36, 8, -20, 13]] as const) {
    ctx.beginPath(); ctx.moveTo(x + ax, y - 2 + ay); ctx.lineTo(x + bx, y - 2 + by); ctx.stroke();
  }
  ctx.restore();
  mossPatch(ctx, x - 26, y + 9, 10, 610);
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#5e3a1c');
  ell(ctx, x, ty0, tr, tr * 0.46);
  const tg = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  tg.addColorStop(0, '#c98e4e');
  tg.addColorStop(1, '#87582b');
  fs(ctx, tg);
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
  ctx.strokeStyle = '#5c626b';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.fillStyle = '#c4c9d0';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    circle(ctx, x + Math.cos(a) * tr, ty0 + Math.sin(a) * tr * 0.46, 1.1);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(220,225,232,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, ty0 - 0.6, tr, tr * 0.46, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  // Рама на стойках из бруса.
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
    beam(ctx, px, py + 1, px, py - lift, 4.2);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  beam(ctx, -17, -11, 17, -11, 4.6);
  beam(ctx, -17, 11, 17, 11, 4.6);
  beam(ctx, -15, 13, -15, -13, 4.6);
  beam(ctx, 15, 13, 15, -13, 4.6);
  for (const [cx, cy] of corners) {
    outline(ctx, 1.3);
    ctx.beginPath();
    ctx.rect(cx - 3.4, cy - 3.4, 6.8, 6.8);
    fs(ctx, '#5c626b');
    ctx.fillStyle = '#c4c9d0';
    circle(ctx, cx - 1.5, cy - 1.5, 0.8); ctx.fill();
    circle(ctx, cx + 1.5, cy + 1.5, 0.8); ctx.fill();
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
  if (lv >= 3) {
    outline(ctx, 1.6);
    ctx.beginPath();
    ctx.rect(7, -9, 5.5, 18);
    fs(ctx, '#8a5a2c');
    ctx.strokeStyle = '#dcc38a';
    ctx.lineWidth = 1.2;
    for (let k = -7; k <= 7; k += 2.4) { ctx.beginPath(); ctx.moveTo(7.4, k); ctx.lineTo(12.1, k + 0.8); ctx.stroke(); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(9.75, 11); ctx.lineTo(9.75, 16); ctx.lineTo(13.5, 16); ctx.stroke();
    ctx.strokeStyle = '#8a9099';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    outline(ctx, 1);
    circle(ctx, 13.5, 16, 1.8);
    fs(ctx, '#6b4423');
  }
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  beam(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5);
  const bw = variant === 2 ? 13 : 9;
  const bh = variant === 2 ? 8 : 6.5;
  ironBowl(ctx, tx, ty, bw, bh);
  if (p < 0.5) {
    if (variant === 1) {
      rock(ctx, tx, ty, 7.8, 6.6, 3);
      mossPatch(ctx, tx - 2, ty - 3.5, 6, 620);
    } else {
      const rs: ReadonlyArray<readonly [number, number]> = variant === 2 ? [[-5, -0.5], [4, -2], [0, 2.4]] : lv >= 3 ? [[-2.8, 0.4], [3.4, -1.4]] : [[0, 0]];
      rs.forEach(([sx, sy], i) => rock(ctx, tx + sx, ty + sy, 4.6, 3.8, i + 1));
    }
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.5);
  fs(ctx, '#6d737c');
  ctx.fillStyle = 'rgba(240,244,248,0.6)';
  circle(ctx, -1.5, -1.5, 1.7);
  ctx.fill();
  ctx.restore();
}

/** Эдельвейс: войлочные белые лепестки звездой, жёлтая серединка из точек. */
function edelweiss(ctx: Ctx, x: number, y: number, s: number): void {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    outline(ctx, 1.1);
    ell(ctx, x + Math.cos(a) * 3.4 * s, y + Math.sin(a) * 2.6 * s, 2.8 * s, 1.3 * s, a);
    fs(ctx, '#f6f4ea');
  }
  ctx.fillStyle = '#e7c84a';
  for (const [dx, dy] of [[0, 0], [-1.2, -0.6], [1.1, -0.5], [0.2, 1]] as const) {
    circle(ctx, x + dx * s, y + dy * s, 0.9 * s);
    ctx.fill();
  }
}

/** Скрещённые кирки на доске над входом в штольню. */
function pickaxes(ctx: Ctx, x: number, y: number): void {
  for (const s of [-1, 1]) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(x - s * 7, y + 5); ctx.lineTo(x + s * 6, y - 5); ctx.stroke();
    ctx.strokeStyle = '#a8703c';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 1.5, y - 7.5);
    ctx.quadraticCurveTo(x + s * 6, y - 8, x + s * 10, y - 2.5);
    ctx.quadraticCurveTo(x + s * 6, y - 5.5, x + s * 2.5, y - 4.5);
    ctx.closePath();
    outline(ctx, 1.3);
    fs(ctx, '#aab2ba');
  }
}

/** Вход в штольню: крепь из двух стоек с подкосами и верхняка, доска с кирками, фонари по бокам. */
function minePortal(ctx: Ctx, x: number, base: number, w: number, h: number): void {
  for (const s of [-1, 1]) beam(ctx, x + s * w, base, x + s * (w - 3), base - h, 7.5);
  for (const s of [-1, 1]) beam(ctx, x + s * (w - 1.5), base - h + 18, x + s * (w - 14), base - h + 6, 3.8);
  beam(ctx, x - w - 7, base - h + 2, x + w + 7, base - h + 2, 8.5);
  outline(ctx, 1.8);
  ctx.beginPath();
  ctx.rect(x - 11, base - h - 14, 22, 12);
  fs(ctx, '#b07a44');
  ctx.strokeStyle = 'rgba(60,30,10,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 11, base - h - 8); ctx.lineTo(x + 11, base - h - 8); ctx.stroke();
  pickaxes(ctx, x, base - h - 7);
  for (const s of [-1, 1]) {
    const lx = x + s * (w + 8);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x + s * (w - 1), base - h + 16); ctx.lineTo(lx, base - h + 16); ctx.stroke();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(lx, base - h + 16); ctx.lineTo(lx, base - h + 20); ctx.stroke();
    minerLantern(ctx, lx, base - h + 30);
  }
}

/** Вагонетка на коротком отрезке рельсов, гружённая хрусталём. */
function minecart(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 3, y + 3, 22, 5, 0.25);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  for (const dy of [-1, 4]) { ctx.beginPath(); ctx.moveTo(x - 24, y + dy); ctx.lineTo(x + 24, y + dy); ctx.stroke(); }
  for (let k = -20; k <= 20; k += 8) beam(ctx, x + k, y - 3, x + k + 1.5, y + 7, 3, { hi: '#b88a5a', base: '#7a5230', lo: '#4a3018' });
  ctx.strokeStyle = '#9aa2ab';
  ctx.lineWidth = 1.6;
  for (const dy of [-1, 4]) { ctx.beginPath(); ctx.moveTo(x - 24, y + dy - 0.5); ctx.lineTo(x + 24, y + dy - 0.5); ctx.stroke(); }
  for (const s of [-1, 1]) {
    outline(ctx, 1.8);
    circle(ctx, x + s * 9, y + 1, 4.2);
    fs(ctx, '#3e434a');
    ctx.fillStyle = '#8a9099';
    circle(ctx, x + s * 9, y + 1, 1.4);
    ctx.fill();
  }
  crystalCluster(ctx, x - 4, y - 13, 0.7, QUARTZ, '170,215,255');
  rock(ctx, x + 6, y - 12, 5, 3.4, 2);
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 14); ctx.lineTo(x + 16, y - 14); ctx.lineTo(x + 13, y - 1); ctx.lineTo(x - 13, y - 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
  g.addColorStop(0, '#b07a44');
  g.addColorStop(1, '#6e4422');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(60,30,10,0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x - 14.5, y - 7.5); ctx.lineTo(x + 14.5, y - 7.5); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#5c626b';
    ctx.fillRect(x + s * 10 - 2, y - 13.5, 4, 12);
    ctx.fillStyle = '#c4c9d0';
    circle(ctx, x + s * 10, y - 11, 0.7); ctx.fill();
    circle(ctx, x + s * 10, y - 4, 0.7); ctx.fill();
  }
}

/**
 * Муравейник Гор: тот же холм, у подножия сухая кладка из гранитных валунов (расступается у троп),
 * вход оформлен крепью штольни с кирками и фонарями, рядом вагонетка с хрусталём и друза кристаллов,
 * на холме горные знамёна, вокруг эдельвейсы.
 */
export function drawAnthillMountains(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  rock(ctx, x - 96, y + 4, 22, 16, 2);
  mossPatch(ctx, x - 104, y - 6, 12, 700);
  anthillMound(ctx, x, y, rng);
  const at = (t: number): Vec => {
    const u = 1 - t;
    return { x: u * u * (x - 100) + 2 * u * t * x + t * t * (x + 100), y: u * u * (y + 32) + 2 * u * t * (y + 66) + t * t * (y + 32) };
  };
  // Сухая кладка: плоские камни разной величины внахлёст, верхний ряд вразбежку, местами мох.
  const rows: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [15, -3, 9.5, 4.4, 0], [13, -9, 8, 3.8, 0.5], [9, -14, 6.5, 3.2, 0.25],
  ];
  rows.forEach(([n, dy, rx, ry, shift], r) => {
    let t = 0.02 + (shift / n) * 0.9;
    for (let i = 0; i < n && t < 0.99; i++) {
      const p = at(t);
      const sx = p.x + (jit(r * 50 + i) - 0.5) * 3;
      const sy = p.y + dy + (jit(r * 50 + i + 21) - 0.5) * 1.6;
      const big = jit(r * 50 + i + 41);
      t += (0.94 / n) * (0.75 + big * 0.5);
      if (r === 2 && big < 0.3) continue;
      if (onPath?.(sx, sy - 2)) continue;
      rock(ctx, sx, sy, rx * (0.8 + big * 0.5), ry * (0.85 + jit(r * 50 + i + 61) * 0.35), r * 7 + i);
      if (jit(r * 50 + i + 81) < 0.22) mossPatch(ctx, sx - rx * 0.2, sy - ry * 0.5, rx * 0.8, r * 50 + i);
    }
  });
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    alpineBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  minePortal(ctx, x, y + 26, 34, 50);
  if (!onPath?.(x + 76, y + 40)) minecart(ctx, x + 78, y + 48);
  if (!onPath?.(x - 70, y + 40)) crystalCluster(ctx, x - 70, y + 46, 1.1, QUARTZ, '170,215,255');
  for (let i = 0; i < 9; i++) {
    const px = x + rng.range(-125, 125);
    const py = y + rng.range(46, 74);
    if (onPath?.(px, py)) continue;
    edelweiss(ctx, px, py, rng.range(0.8, 1.05));
  }
}
