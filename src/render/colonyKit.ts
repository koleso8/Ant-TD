/**
 * Рисунки для муравейника в разрезе: вид сбоку. Муравей сбоку (с ношей, каской, лётной шапкой,
 * халатом), личинки, яйца, коконы, стрекоза в обвесах, колбы, семена, корни, комья и плиты завала.
 * Свет сверху слева, толстый тёмный контур — как во всей игре. Модуль без DOM, только Canvas.
 */
import { TAU } from '../engine/math';
import { Rng } from '../engine/rng';
import { WORKER_SKIN, type AntSkin } from '../sprites/ant';
import { PAL } from './palette';
import { drawText } from './text';

export type Ctx = CanvasRenderingContext2D;
export type P = [number, number];
export const OUT = PAL.outline;

// ───────────────────────── примитивы ─────────────────────────

export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

export function stroked(ctx: Ctx, fill: string | CanvasGradient, w: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Ломаная, сглаженная квадратичными кривыми через середины отрезков. */
export function smoothPath(ctx: Ctx, pts: readonly P[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

export interface Sample { x: number; y: number; d: number }

/** Та же сглаженная ломаная, разбитая на частые точки с пройденным расстоянием. */
export function sampleSmooth(pts: readonly P[], step = 4): Sample[] {
  const out: Sample[] = [{ x: pts[0][0], y: pts[0][1], d: 0 }];
  let px = pts[0][0];
  let py = pts[0][1];
  let d = 0;
  const push = (x: number, y: number): void => {
    d += Math.hypot(x - px, y - py);
    px = x;
    py = y;
    out.push({ x, y, d });
  };
  let sx = pts[0][0];
  let sy = pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i];
    const ex = (pts[i][0] + pts[i + 1][0]) / 2;
    const ey = (pts[i][1] + pts[i + 1][1]) / 2;
    const n = Math.max(2, Math.ceil((Math.hypot(cx - sx, cy - sy) + Math.hypot(ex - cx, ey - cy)) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      push(u * u * sx + 2 * u * t * cx + t * t * ex, u * u * sy + 2 * u * t * cy + t * t * ey);
    }
    sx = ex;
    sy = ey;
  }
  const l = pts[pts.length - 1];
  const n = Math.max(1, Math.ceil(Math.hypot(l[0] - sx, l[1] - sy) / step));
  for (let k = 1; k <= n; k++) push(sx + ((l[0] - sx) * k) / n, sy + ((l[1] - sy) * k) / n);
  return out;
}

/** Точка и направление на расстоянии d от начала. */
export function along(s: readonly Sample[], d: number): { x: number; y: number; a: number } {
  const dd = Math.max(0, Math.min(d, s[s.length - 1].d));
  let lo = 1;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].d < dd) lo = mid + 1; else hi = mid;
  }
  const a = s[lo - 1];
  const b = s[lo];
  const k = b.d > a.d ? (dd - a.d) / (b.d - a.d) : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

/**
 * Лента вдоль сглаженной ломаной: от края from до края to (доли полуширины, −1..1; минус — слева
 * по ходу). w(t) — полная ширина в доле пути t. Из неё собраны и корни, и ходы.
 */
export function ribbon(ctx: Ctx, s: readonly Sample[], w: (t: number, d: number) => number, from = -1, to = 1, extra = 0): void {
  const total = s[s.length - 1].d || 1;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.min(i + 1, s.length - 1)];
    const b = s[Math.max(i - 1, 0)];
    const ang = Math.atan2(a.y - b.y, a.x - b.x);
    const half = w(s[i].d / total, s[i].d) / 2 + extra;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    left.push([s[i].x + nx * half * from, s[i].y + ny * half * from]);
    right.push([s[i].x + nx * half * to, s[i].y + ny * half * to]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

export interface Tone { hi: string; base: string; lo: string }
export const GREY: Tone = { hi: '#d8d2c6', base: '#a29a8e', lo: '#5f584f' };
export const WARM: Tone = { hi: '#e0c39a', base: '#ad8a60', lo: '#6a4e33' };
export const PINK: Tone = { hi: '#e6c2b2', base: '#b48a7a', lo: '#6e4c42' };
export const SLATE: Tone = { hi: '#b9c0c4', base: '#7f878c', lo: '#454b50' };

/** Неровный скруглённый многоугольник вокруг точки. */
function lump(ctx: Ctx, x: number, y: number, r: number, rng: Rng, squash: number, rot: number, jag = 0.22): void {
  const n = 7 + rng.int(0, 3);
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-jag, jag);
    const rr = r * rng.range(0.8, 1.1);
    const lx = Math.cos(a) * rr * 1.12;
    const ly = Math.sin(a) * rr * squash;
    pts.push([x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot)]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

/** Камень с объёмом: свет слева сверху, блик и иногда трещина. */
export function stone(ctx: Ctx, x: number, y: number, r: number, rng: Rng, tone: Tone, lw = 2): void {
  const squash = rng.range(0.68, 0.92);
  lump(ctx, x, y, r, rng, squash, rng.range(-0.4, 0.4));
  const g = ctx.createLinearGradient(x - r, y - r, x + r * 0.8, y + r);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.45, tone.base);
  g.addColorStop(1, tone.lo);
  stroked(ctx, g, lw);
  if (r > 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ell(ctx, x - r * 0.38, y - r * 0.32 * squash, r * 0.34, r * 0.16, -0.45);
    ctx.fill();
  }
  if (r > 11 && rng.next() < 0.45) {
    ctx.strokeStyle = 'rgba(40,24,10,0.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const a = rng.range(0, TAU);
    ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.6);
    ctx.lineTo(x + Math.cos(a) * r * 0.3 + rng.range(-3, 3), y + Math.sin(a) * r * 0.2 + rng.range(-3, 3));
    ctx.lineTo(x + rng.range(-r * 0.2, r * 0.2), y + rng.range(-r * 0.2, r * 0.2));
    ctx.stroke();
  }
}

/** Цвета слоя земли: для комьев и плит завала. */
export interface Soil { hi: string; base: string; lo: string; speck: [string, string] }

/** Ком земли: неровный, с крошкой на боку. В толще горки — без чёрного контура. */
export function clod(ctx: Ctx, x: number, y: number, r: number, rng: Rng, L: Soil, inner = false): void {
  lump(ctx, x, y, r, rng, rng.range(0.68, 0.9), rng.range(-0.3, 0.3), 0.25);
  const g = ctx.createLinearGradient(x - r, y - r, x + r * 0.7, y + r);
  g.addColorStop(0, L.speck[0]);
  g.addColorStop(0.5, L.base);
  g.addColorStop(1, L.lo);
  if (inner) {
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,5,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else stroked(ctx, g, r > 9 ? 2 : 1.6);
  for (let i = 0; i < Math.round(r / 3); i++) {
    ctx.fillStyle = rng.next() < 0.55 ? L.speck[1] : 'rgba(255,225,180,0.35)';
    ell(ctx, x + rng.range(-r * 0.6, r * 0.6), y + rng.range(-r * 0.35, r * 0.5), rng.range(0.8, 1.8), rng.range(0.7, 1.4));
    ctx.fill();
  }
}

export const RIM = '#d9ae76';

/** Обломок свода: угловатая плита, сверху светлая кромка бывшего потолка, поперёк слои. */
export function slab(ctx: Ctx, x: number, y: number, w: number, h: number, rot: number, L: Soil): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.35);
  ctx.lineTo(-w * 0.18, -h / 2);
  ctx.lineTo(w * 0.32, -h * 0.46);
  ctx.lineTo(w / 2, -h * 0.1);
  ctx.lineTo(w * 0.42, h / 2);
  ctx.lineTo(-w * 0.3, h * 0.42);
  ctx.lineTo(-w * 0.52, h * 0.12);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, L.hi);
  g.addColorStop(1, L.lo);
  stroked(ctx, g, 2.2);
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, -h * 0.34);
  ctx.lineTo(-w * 0.18, -h * 0.44);
  ctx.lineTo(w * 0.3, -h * 0.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,15,5,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, h * 0.05);
  ctx.lineTo(w * 0.4, h * 0.1);
  ctx.moveTo(-w * 0.28, h * 0.27);
  ctx.lineTo(w * 0.3, h * 0.3);
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────── корни ─────────────────────────

export interface Bark { hi: string; base: string; lo: string }
export const BARK: Bark = { hi: '#c08a58', base: '#86592f', lo: '#3e2412' };

export interface RootOpts {
  /** Боковые корешки: сколько уровней ветвления (0 — без них). */
  branch?: number;
  /** Мочки-волоски на кончиках. */
  hairs?: boolean;
  bark?: Bark;
}

/**
 * Корень как цилиндр: заливка поперёк с тенью снизу и бликом сверху, кольца и трещинки коры,
 * наплывы-узлы, боковые корешки (тоньше, сужаются в нить) и мочки на кончиках.
 */
export function root(ctx: Ctx, pts: readonly P[], w0: number, w1: number, rng: Rng, o: RootOpts = {}): void {
  const bark = o.bark ?? BARK;
  const s = sampleSmooth(pts, 4);
  const total = s[s.length - 1].d;
  const width = (t: number, d: number): number => (w0 + (w1 - w0) * Math.pow(t, 0.75)) * (1 + Math.sin(d * 0.07 + w0) * 0.05);
  // Сначала корешки: они уходят из-под основного корня.
  if ((o.branch ?? 1) > 0 && w0 > 5) {
    let d = rng.range(30, 60);
    while (d < total * 0.85) {
      const p = along(s, d);
      const t = d / total;
      const wl = width(t, d);
      const side = rng.next() < 0.5 ? -1 : 1;
      const a = p.a + side * rng.range(0.55, 1.25);
      const len = rng.range(26, 70) * Math.min(1.4, wl / 10);
      const mx = p.x + Math.cos(a) * len * 0.5 + rng.range(-6, 6);
      const my = p.y + Math.sin(a) * len * 0.5 + rng.range(-6, 6);
      const a2 = a + rng.range(-0.5, 0.5);
      root(ctx, [[p.x, p.y], [mx, my], [mx + Math.cos(a2) * len * 0.5, my + Math.sin(a2) * len * 0.5]], Math.max(2, wl * 0.36), 1, rng,
        { branch: (o.branch ?? 1) - 1, hairs: o.hairs ?? true, bark });
      d += rng.range(40, 90);
    }
  }
  ribbon(ctx, s, width);
  const mid = s[Math.floor(s.length / 2)];
  const g = ctx.createLinearGradient(mid.x - w0, mid.y - w0, mid.x + w0, mid.y + w0);
  g.addColorStop(0, bark.base);
  g.addColorStop(1, bark.lo);
  stroked(ctx, g, w0 > 12 ? 2.4 : w0 > 5 ? 1.8 : 1.2);
  ctx.save();
  ribbon(ctx, s, width);
  ctx.clip();
  // Светлая сторона — та, что смотрит вверх; тень — снизу.
  const up = Math.sin(mid.y > 0 ? along(s, total / 2).a + Math.PI / 2 : 0) > 0 ? -1 : 1;
  ctx.globalAlpha = 0.55;
  ribbon(ctx, s, width, up * 0.95, up * 0.15);
  ctx.fillStyle = bark.hi;
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ribbon(ctx, s, width, -up * 0.2, -up * 1);
  ctx.fillStyle = '#1e1008';
  ctx.fill();
  ctx.globalAlpha = 1;
  if (w0 > 5) {
    // Кольца и трещинки коры поперёк, неровно.
    let d = rng.range(4, 10);
    while (d < total) {
      const p = along(s, d);
      const hw = width(d / total, d) / 2;
      const nx = -Math.sin(p.a);
      const ny = Math.cos(p.a);
      const a0 = rng.range(-0.9, -0.2);
      const a1 = rng.range(0.2, 0.9);
      ctx.strokeStyle = 'rgba(35,18,6,0.5)';
      ctx.lineWidth = Math.max(0.8, hw * 0.12);
      ctx.beginPath();
      ctx.moveTo(p.x + nx * hw * a0, p.y + ny * hw * a0);
      ctx.quadraticCurveTo(p.x + Math.cos(p.a) * 2 + nx * hw * (a0 + a1) / 2, p.y + Math.sin(p.a) * 2 + ny * hw * (a0 + a1) / 2, p.x + nx * hw * a1, p.y + ny * hw * a1);
      ctx.stroke();
      if (rng.next() < 0.35) {
        ctx.strokeStyle = 'rgba(255,225,180,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const o2 = rng.range(-0.6, 0.6);
        ctx.moveTo(p.x + nx * hw * o2, p.y + ny * hw * o2);
        ctx.lineTo(p.x + nx * hw * o2 + Math.cos(p.a) * rng.range(5, 10), p.y + ny * hw * o2 + Math.sin(p.a) * rng.range(5, 10));
        ctx.stroke();
      }
      d += rng.range(6, 13) * Math.max(0.7, hw / 8);
    }
  }
  ctx.restore();
  // Наплывы-узлы на толстых корнях.
  if (w0 > 14) {
    for (let k = 0; k < Math.floor(total / 160); k++) {
      const p = along(s, rng.range(total * 0.1, total * 0.7));
      const hw = width(0.4, 0) / 2;
      ell(ctx, p.x, p.y, hw * 0.45, hw * 0.3, p.a);
      const kg = ctx.createRadialGradient(p.x - 2, p.y - 2, 0.5, p.x, p.y, hw * 0.5);
      kg.addColorStop(0, bark.hi);
      kg.addColorStop(1, bark.lo);
      stroked(ctx, kg, 1.4);
    }
  }
  if (!(o.hairs ?? true)) return;
  // Мочки на кончике: тонкие светлые волоски.
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const at = s[Math.max(0, s.length - 1 - rng.int(0, 10))];
    const a = rng.range(0, TAU);
    const len = rng.range(5, 12);
    ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(232,206,160,0.6)' : 'rgba(190,150,100,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.quadraticCurveTo(at.x + Math.cos(a) * len * 0.6 + rng.range(-2, 2), at.y + Math.sin(a) * len * 0.6, at.x + Math.cos(a) * len, at.y + Math.sin(a) * len);
    ctx.stroke();
  }
}

/** Обломок корня со светлым свежим сломом на конце. */
export function brokenRoot(ctx: Ctx, x: number, y: number, a: number, len: number, w: number, rng: Rng): void {
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  root(ctx, [[x, y], [x + Math.cos(a) * len * 0.5 + rng.range(-3, 3), y + Math.sin(a) * len * 0.5], [ex, ey]], w, w * 0.8, rng, { branch: 0, hairs: false });
  ell(ctx, ex, ey, w * 0.42, w * 0.32, a + Math.PI / 2);
  stroked(ctx, '#e8cb98', 1.4);
  ctx.strokeStyle = 'rgba(150,100,50,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(ex - Math.cos(a + Math.PI / 2) * w * 0.25, ey - Math.sin(a + Math.PI / 2) * w * 0.25);
  ctx.lineTo(ex + Math.cos(a + Math.PI / 2) * w * 0.2, ey + Math.sin(a + Math.PI / 2) * w * 0.2);
  ctx.stroke();
}

// ───────────────────────── мелочи колонии ─────────────────────────

/** Личинка: пухлая «запятая», шейка загибается к янтарной голове. Глаз у личинок нет. */
export function drawGrub(ctx: Ctx, x: number, y: number, r: number, rot: number, squash = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1 + squash, 1 - squash);
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.86);
    ctx.bezierCurveTo(r * 0.38, -r * 0.96, r * 0.98, -r * 0.56, r * 1.06, r * 0.04);
    ctx.bezierCurveTo(r * 1.1, r * 0.36, r * 0.94, r * 0.56, r * 0.7, r * 0.56);
    ctx.bezierCurveTo(r * 0.46, r * 0.56, r * 0.36, r * 0.32, r * 0.14, r * 0.46);
    ctx.bezierCurveTo(-r * 0.12, r * 0.86, -r * 0.92, r * 0.96, -r * 1.2, r * 0.36);
    ctx.bezierCurveTo(-r * 1.46, -r * 0.2, -r * 1.02, -r * 0.8, -r * 0.3, -r * 0.86);
    ctx.closePath();
  };
  body();
  const g = ctx.createRadialGradient(-r * 0.45, -r * 0.42, r * 0.1, -r * 0.1, 0, r * 1.5);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#f6efdf');
  g.addColorStop(1, '#cdbf9f');
  stroked(ctx, g, Math.max(1.3, r * 0.14));
  ctx.save();
  body();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,112,66,0.42)';
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  for (let i = 0; i < 6; i++) {
    const sx = -r * 0.95 + i * r * 0.33;
    ctx.beginPath();
    ctx.moveTo(sx + r * 0.12, -r);
    ctx.quadraticCurveTo(sx - r * 0.1, 0, sx + r * 0.1 + i * r * 0.04, r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ell(ctx, -r * 0.42, -r * 0.5, r * 0.36, r * 0.14, -0.25);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ell(ctx, r * 0.45, -r * 0.5, r * 0.14, r * 0.08, 0.5);
  ctx.fill();
  const hx = r * 0.88;
  const hy = r * 0.5;
  ell(ctx, hx, hy, r * 0.33, r * 0.28, 0.6);
  const hg = ctx.createRadialGradient(hx - r * 0.08, hy - r * 0.08, 0.3, hx, hy, r * 0.3);
  hg.addColorStop(0, '#f6c77a');
  hg.addColorStop(1, '#a8682a');
  stroked(ctx, hg, Math.max(1.1, r * 0.11));
  ctx.restore();
}

export function egg(ctx: Ctx, x: number, y: number, r: number, rot: number): void {
  ell(ctx, x, y, r * 0.78, r, rot);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.3, x, y, r * 1.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#f6eedb');
  g.addColorStop(1, '#d6c8a6');
  stroked(ctx, g, 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ell(ctx, x - r * 0.25, y - r * 0.4, r * 0.18, r * 0.22);
  ctx.fill();
}

/** Кокон-куколка: золотистый шёлк в косую намотку. */
export function cocoon(ctx: Ctx, x: number, y: number, rot: number, k = 1, seed = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ell(ctx, 0, 0, 7.6, 15);
  const g = ctx.createLinearGradient(-8, 0, 8, 0);
  g.addColorStop(0, '#f2d9a2');
  g.addColorStop(0.5, '#d3aa66');
  g.addColorStop(1, '#93693a');
  stroked(ctx, g, 2);
  ctx.save();
  ell(ctx, 0, 0, 7.6, 15);
  ctx.clip();
  for (let i = -6; i < 7; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.32)' : 'rgba(120,90,50,0.22)';
    ctx.lineWidth = 1 + ((i * 7 + seed) % 3) * 0.2;
    ctx.beginPath();
    ctx.moveTo(-9, i * 4.4 - 3);
    ctx.quadraticCurveTo(0, i * 4.4 + ((i + seed) % 3) - 1, 9, i * 4.4 + 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ell(ctx, -3, -7, 1.8, 4.5, 0.1);
  ctx.fill();
  ctx.restore();
}

/** Зерно: пшеничное (с бороздкой), семечка (полосатая), просо (круглое). */
export function grain(ctx: Ctx, x: number, y: number, r: number, rot: number, kind: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (kind === 1) {
    // Семечка подсолнуха: капля с полосками.
    ctx.beginPath();
    ctx.moveTo(-r * 1.3, 0);
    ctx.bezierCurveTo(-r * 0.6, -r * 0.9, r * 0.9, -r * 0.7, r * 1.2, 0);
    ctx.bezierCurveTo(r * 0.9, r * 0.7, -r * 0.6, r * 0.9, -r * 1.3, 0);
    ctx.closePath();
    stroked(ctx, '#3a3330', 1.4);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(235,228,210,0.85)';
    ctx.lineWidth = r * 0.22;
    for (const k of [-0.45, 0.05, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, k * r);
      ctx.quadraticCurveTo(0, k * r * 1.3, r * 1.2, k * r * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  } else if (kind === 2) {
    ell(ctx, 0, 0, r * 0.8, r * 0.75);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0.3, 0, 0, r);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(1, '#d9a531');
    stroked(ctx, g, 1.2);
  } else {
    ell(ctx, 0, 0, r * 1.25, r * 0.7);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ffe6a0');
    g.addColorStop(0.55, '#e3ad4c');
    g.addColorStop(1, '#a96f1e');
    stroked(ctx, g, 1.3);
    ctx.strokeStyle = 'rgba(120,70,10,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.05);
    ctx.quadraticCurveTo(0, r * 0.25, r * 0.9, r * 0.05);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ell(ctx, -r * 0.35, -r * 0.3, r * 0.3, r * 0.12, -0.2);
  ctx.fill();
  ctx.restore();
}

/** Значок зерна — валюты колонии: три пшеничных зерна веером, (x, y) — середина. */
export function grainIcon(ctx: Ctx, x: number, y: number, r: number): void {
  grain(ctx, x - r * 0.62, y + r * 0.3, r * 0.6, -0.95, 0);
  grain(ctx, x + r * 0.62, y + r * 0.3, r * 0.6, 0.95, 0);
  grain(ctx, x, y - r * 0.22, r * 0.64, -1.57, 0);
}

/**
 * Кучка из n пшеничных зёрен: внизу ряд пошире, выше всё уже. (x, y) — середина основания.
 * Нижние зёрна ближе к глазу и перекрывают верхние.
 */
export function grainHeap(ctx: Ctx, x: number, y: number, n: number, r: number, seed = 1): void {
  const rng = new Rng(seed);
  let b = 1;
  while ((b * (b + 1)) / 2 < n) b++;
  const rows: { x: number; y: number; a: number }[][] = [];
  for (let row = 0, left = n; left > 0 && row < b; row++) {
    const k = Math.min(left, b - row);
    const pts: { x: number; y: number; a: number }[] = [];
    for (let i = 0; i < k; i++) {
      pts.push({
        x: x + (i - (k - 1) / 2) * r * 1.95 + rng.range(-0.25, 0.25) * r,
        y: y - r * 0.55 - row * r * 1.0 + rng.range(-0.12, 0.12) * r,
        a: rng.range(-0.45, 0.45) + (rng.next() < 0.25 ? 1.3 : 0),
      });
    }
    rows.push(pts);
    left -= k;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ell(ctx, x, y + r * 0.1, b * r * 1.05 + r * 0.6, r * 0.45);
  ctx.fill();
  for (let row = rows.length - 1; row >= 0; row--) for (const p of rows[row]) grain(ctx, p.x, p.y, r, p.a, 0);
}

/** Плошка из чашечки жёлудя с горкой зерна: большой дар седьмого дня. (x, y) — дно плошки. */
export function grainCup(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  grainHeap(ctx, 0, -14, 15, 4.2, 7);
  ctx.beginPath();
  ctx.moveTo(-20, -15);
  ctx.bezierCurveTo(-20, -2, -10, 1, 0, 1);
  ctx.bezierCurveTo(10, 1, 20, -2, 20, -15);
  ctx.closePath();
  const g = ctx.createLinearGradient(-20, -15, 20, 1);
  g.addColorStop(0, '#c9a06a');
  g.addColorStop(0.5, '#9a7040');
  g.addColorStop(1, '#5e3d1c');
  stroked(ctx, g, 2);
  ctx.strokeStyle = 'rgba(60,35,12,0.6)';
  ctx.lineWidth = 1;
  for (const [dx, dy] of [[-14, -10], [-7, -9], [0, -10], [7, -9], [14, -10], [-10, -5], [-3, -4], [4, -4.5], [11, -5], [-5, 0], [3, 0]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e0bf86';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18.5, -15);
  ctx.quadraticCurveTo(0, -12.5, 18.5, -15);
  ctx.stroke();
  ctx.restore();
}

/** Кусочек листа: неровный зелёный обрывок с жилкой. */
export function leafBit(ctx: Ctx, x: number, y: number, r: number, rot: number, hue = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.2);
  ctx.lineTo(-r * 0.5, -r * 0.8);
  ctx.lineTo(r * 0.2, -r * 0.6);
  ctx.lineTo(r * 0.95, -r);
  ctx.lineTo(r * 0.8, r * 0.3);
  ctx.lineTo(r * 0.1, r * 0.7);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, hue ? '#c6d65c' : PAL.leafLight);
  g.addColorStop(1, hue ? '#7d8a2a' : PAL.leafDark);
  stroked(ctx, g, 1.3);
  ctx.strokeStyle = 'rgba(30,70,20,0.6)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.1);
  ctx.lineTo(r * 0.7, -r * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Чашечка жёлудя с мёдом. */
export function acornBowl(ctx: Ctx, x0: number, y0: number, k = 1.3): void {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(-15, -9);
  ctx.bezierCurveTo(-15, 3, -7, 6, 0, 6);
  ctx.bezierCurveTo(7, 6, 15, 3, 15, -9);
  ctx.closePath();
  const g = ctx.createLinearGradient(-15, -9, 15, 6);
  g.addColorStop(0, '#c9a06a');
  g.addColorStop(0.5, '#9a7040');
  g.addColorStop(1, '#5e3d1c');
  stroked(ctx, g, 2);
  ctx.strokeStyle = 'rgba(60,35,12,0.6)';
  ctx.lineWidth = 1;
  for (const [dx, dy] of [[-10, -4], [-4, -3], [3, -4], [9, -3], [-7, 1], [0, 1.5], [7, 0.5], [-2, 4]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 2.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ell(ctx, 0, -9, 14, 3.4);
  const hg = ctx.createLinearGradient(-14, -12, 14, -6);
  hg.addColorStop(0, '#ffe08a');
  hg.addColorStop(1, '#e09a1c');
  stroked(ctx, hg, 1.6);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ell(ctx, -5, -10, 4, 1, -0.1);
  ctx.fill();
  ctx.restore();
}

/** Лист-подстилка. */
export function leafTray(ctx: Ctx, x: number, y: number, len: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len * 0.2, -9, len * 0.25, -8, len / 2, -1);
  ctx.bezierCurveTo(len * 0.2, 6, -len * 0.25, 5, -len / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -8, 0, 6);
  g.addColorStop(0, PAL.leafLight);
  g.addColorStop(1, PAL.leafDark);
  stroked(ctx, g, 2);
  ctx.strokeStyle = 'rgba(30,70,20,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-len / 2 + 3, 0);
  ctx.quadraticCurveTo(0, -2.5, len / 2 - 3, -1);
  ctx.stroke();
  ctx.restore();
}

/** Гриб-светляк: бледная ножка, светящаяся бирюзовая шляпка (свет рисуется отдельно). */
export function glowShroom(ctx: Ctx, x: number, y: number, h: number, r: number): void {
  const sw = r * 0.4;
  ctx.beginPath();
  ctx.moveTo(x - sw, y);
  ctx.quadraticCurveTo(x - sw * 1.1, y - h * 0.5, x - sw * 0.75, y - h);
  ctx.lineTo(x + sw * 0.75, y - h);
  ctx.quadraticCurveTo(x + sw * 0.9, y - h * 0.5, x + sw * 1.15, y);
  ctx.closePath();
  const sg = ctx.createLinearGradient(x - sw, 0, x + sw, 0);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, '#cfc2a4');
  stroked(ctx, sg, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - r, y - h + 1);
  ctx.bezierCurveTo(x - r, y - h - r * 1.15, x + r, y - h - r * 1.15, x + r, y - h + 1);
  ctx.quadraticCurveTo(x, y - h + r * 0.38, x - r, y - h + 1);
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - h - r * 0.45, 0.5, x, y - h, r * 1.2);
  g.addColorStop(0, '#effff8');
  g.addColorStop(0.5, '#8ff0cc');
  g.addColorStop(1, '#2f9c80');
  stroked(ctx, g, 1.8);
  ctx.strokeStyle = 'rgba(30,110,90,0.6)';
  ctx.lineWidth = 0.9;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * r * 0.24, y - h + 1);
    ctx.lineTo(x + k * r * 0.14, y - h + r * 0.28);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ell(ctx, x - r * 0.35, y - h - r * 0.55, r * 0.14, r * 0.1);
  ctx.fill();
  ell(ctx, x + r * 0.28, y - h - r * 0.38, r * 0.1, r * 0.08);
  ctx.fill();
}

/** Капельный фонарь: мёд светится на кончике корешка (ореол рисуется каждый кадр). */
export function honeyLamp(ctx: Ctx, x: number, y: number, r = 7): void {
  ell(ctx, x, y, r, r * 1.2);
  const lg = ctx.createRadialGradient(x - 2, y - 3, 0.5, x, y, r * 1.3);
  lg.addColorStop(0, '#fff6c8');
  lg.addColorStop(0.5, '#ffcc4a');
  lg.addColorStop(1, '#d98a12');
  stroked(ctx, lg, 1.8);
}

/** Ореол света: мягкое пятно, складывается со светом сцены. */
export function glow(ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Колба из стекла: шар с горлышком, жидкость с бликом; светится, если glowRgb задан. */
export function flask(ctx: Ctx, x: number, y: number, r: number, liquid: string, level: number, neck = 1): void {
  const nw = r * 0.38;
  const nh = r * 0.9 * neck;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - nw, y - r * 0.85 - nh);
    ctx.lineTo(x - nw, y - r * 0.82);
    ctx.arc(x, y, r, -Math.PI / 2 - 0.38, -Math.PI / 2 + 0.38 - TAU, true);
    ctx.lineTo(x + nw, y - r * 0.85 - nh);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = 'rgba(220,240,255,0.22)';
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  const ly = y + r - level * r * 1.9;
  ctx.fillStyle = liquid;
  ctx.fillRect(x - r - 2, ly, r * 2 + 4, r * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ell(ctx, x, ly, r * 0.9, r * 0.12);
  ctx.fill();
  ctx.restore();
  body();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Блик на стекле и пробка.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 1.05, Math.PI * 1.4);
  ctx.stroke();
  ctx.fillStyle = '#9a6a3a';
  ctx.beginPath();
  ctx.rect(x - nw - 1, y - r * 0.85 - nh - 5, nw * 2 + 2, 6);
  stroked(ctx, '#a8763f', 1.4);
}

/** Табличка на двух верёвочках: висит у входа в камеру. Возвращает ширину. */
export function drawPlaque(ctx: Ctx, x: number, y: number, text: string, lit: boolean): number {
  ctx.font = 'bold 15px "Trebuchet MS", "Segoe UI", Tahoma, Arial, sans-serif';
  const w = ctx.measureText(text).width + 26;
  const h = 26;
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.32, y - h / 2);
  ctx.lineTo(x - w * 0.22, y - h / 2 - 14);
  ctx.moveTo(x + w * 0.32, y - h / 2);
  ctx.lineTo(x + w * 0.22, y - h / 2 - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 4, y - h / 2);
  ctx.lineTo(x + w / 2 - 2, y - h / 2 + 1.5);
  ctx.lineTo(x + w / 2, y + h / 2 - 2);
  ctx.lineTo(x - w / 2 + 1, y + h / 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  g.addColorStop(0, lit ? '#d6a46a' : '#9c7448');
  g.addColorStop(1, lit ? '#9a6a3a' : '#6a4a2a');
  stroked(ctx, g, 2);
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 6, y - 3);
  ctx.quadraticCurveTo(x, y - 6, x + w / 2 - 6, y - 2);
  ctx.stroke();
  ctx.fillStyle = '#4a2c12';
  for (const dx of [-w / 2 + 6, w / 2 - 6]) {
    ell(ctx, x + dx, y - h / 2 + 5, 1.6, 1.6);
    ctx.fill();
  }
  drawText(ctx, text, x, y + 1, { size: 15, align: 'center', color: lit ? '#fff3d6' : '#e6d2b0', strokeWidth: 3 });
  return w;
}

// ───────────────────────── муравей сбоку ─────────────────────────

export type Carry = 'larva' | 'honey' | 'seed' | 'leaf' | 'cocoon' | 'crumb' | 'needle' | 'plate';

export interface SideAntOpts {
  /** Фаза шага (0..2π на шаг); null — стоит на месте. */
  walk: number | null;
  /** Время для покачивания усиков и одежды. */
  t: number;
  /** Что несёт в жвалах. */
  carry?: Carry | null;
  /** Каска строителя. */
  helmet?: boolean;
  /** Лётная шапка с очками и шарф: пилот стрекозы. */
  aviator?: boolean;
  /** Насколько сильно треплет шарф (в полёте). */
  wind?: number;
  /** Защитные очки и белый халат: лаборант. */
  lab?: boolean;
  /** Молоток в жвалах; фаза замаха. */
  hammer?: number | null;
  /** Наклон головы вниз (кормит, копает): 0..1. */
  nod?: number;
  /** Насколько быстро шевелятся усики. */
  fidget?: number;
  /** Поворот всего муравья (идёт по стене хода). */
  rot?: number;
  /** Сидит верхом: ноги поджаты. */
  seated?: boolean;
  skin?: AntSkin;
  /** Прозрачность (появляется из камеры). */
  alpha?: number;
}

function sideLeg(ctx: Ctx, pts: readonly number[], far: boolean, skin: AntSkin): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  ctx.lineTo(pts[2], pts[3]);
  ctx.lineTo(pts[4], pts[5]);
  ctx.lineTo(pts[4] + 2.6, pts[5] + 0.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = far ? 3.2 : 3.8;
  ctx.stroke();
  ctx.strokeStyle = far ? skin.dark : skin.body;
  ctx.lineWidth = far ? 1.3 : 1.7;
  ctx.stroke();
}

/** Трипод: передняя и задняя ноги ближней стороны идут вместе со средней дальней. */
function sideLegs(ctx: Ctx, walk: number | null, skin: AntSkin, far: boolean, seated: boolean): void {
  const shapes: number[][] = seated
    ? [[6, -12, 14, -6, 18, -2], [1, -11.5, 6, -5, 2, -1], [-4, -12, -12, -6, -15, -1]]
    : [[6, -12, 15, -10, 20, 0], [1, -11.5, 6, -8, 3, 0], [-4, -12, -13, -10, -19, 0]];
  for (let i = 0; i < 3; i++) {
    const groupA = (i === 1) === far;
    const ph = (walk ?? 0) + (groupA ? 0 : Math.PI);
    const swing = walk === null ? 0 : Math.sin(ph) * 4.6;
    const lift = walk === null ? 0 : Math.max(0, Math.cos(ph)) * 3.4;
    const s = shapes[i];
    const fx = far ? 2.2 : 0;
    const fy = far ? -1.6 : 0;
    sideLeg(ctx, [s[0] + fx, s[1] + fy, s[2] + fx + swing * 0.5, s[3] + fy - lift * 0.6, s[4] + fx + swing, s[5] + fy - lift], far, skin);
  }
}

/** Ноша в жвалах: рисуется у кончика жвал (x ≈ 31, y ≈ −12). */
function carried(ctx: Ctx, c: Carry, t: number): void {
  switch (c) {
    case 'larva': drawGrub(ctx, 32, -11.5, 5.2, 0.5); break;
    case 'honey':
      ell(ctx, 31.2, -12.8, 2.8, 3.2);
      stroked(ctx, PAL.honey, 1.3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ell(ctx, 30.4, -13.8, 0.9, 1.1);
      ctx.fill();
      break;
    case 'seed': grain(ctx, 33, -12, 5, 0.3, 0); break;
    case 'cocoon': cocoon(ctx, 33, -12, 1.4, 0.55, 3); break;
    case 'crumb':
      ell(ctx, 32.5, -12, 4.2, 3.4, 0.4);
      stroked(ctx, '#8a5c34', 1.4);
      break;
    case 'needle':
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(18, -16); ctx.lineTo(44, -8); ctx.stroke();
      ctx.strokeStyle = '#b07a3a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      break;
    case 'plate': {
      ctx.save();
      ctx.translate(33, -13);
      ctx.rotate(0.2);
      ctx.beginPath();
      ctx.arc(0, 4, 9, Math.PI * 1.1, Math.PI * 1.9);
      ctx.quadraticCurveTo(0, -2, -8.5, 1.2);
      ctx.closePath();
      stroked(ctx, '#9a6a36', 1.4);
      ctx.restore();
      break;
    }
    case 'leaf': {
      // Листорез несёт обрывок листа парусом над головой.
      ctx.save();
      ctx.translate(30, -14);
      ctx.rotate(-1.15 + Math.sin(t * 3) * 0.06);
      leafBit(ctx, 14, 0, 13, 0.1);
      ctx.restore();
      break;
    }
  }
}

/**
 * Муравей сбоку, смотрит вдоль +x (dir −1 — влево). Начало координат — точка на земле под грудью,
 * поэтому пол камеры передаётся как есть. Длина рабочего около 64 px при s = 1.
 */
export function drawAntSide(ctx: Ctx, x: number, y: number, s: number, dir: 1 | -1, o: SideAntOpts): void {
  const skin = o.skin ?? WORKER_SKIN;
  const walk = o.walk;
  const seated = !!o.seated;
  const bob = walk === null ? 0 : Math.abs(Math.sin(walk)) * -0.9;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(s * dir, s);
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
  sideLegs(ctx, walk, skin, true, seated);
  ctx.translate(0, bob);

  // Шарф пилота трепещет назад: рисуется под телом.
  if (o.aviator) {
    const wind = o.wind ?? 0;
    for (const [len, dy, ph] of [[22 + wind * 16, 0, 0], [18 + wind * 12, 3, 1.3]] as const) {
      ctx.beginPath();
      ctx.moveTo(10, -18 + dy);
      const wav = Math.sin(o.t * (6 + wind * 10) + ph) * (2 + wind * 3);
      ctx.bezierCurveTo(2, -22 + dy + wav, -len * 0.5, -16 + dy - wav, -len, -20 + dy + wav * 1.4);
      ctx.lineTo(-len + 1, -15 + dy + wav * 1.4);
      ctx.bezierCurveTo(-len * 0.5, -11 + dy - wav, 2, -15 + dy + wav, 10, -14 + dy);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, -22, 0, -12);
      sg.addColorStop(0, '#f2664a');
      sg.addColorStop(1, '#a8261a');
      stroked(ctx, sg, 1.6);
    }
  }

  // Брюшко: крупное, опущено назад, с поперечными полосами сегментов.
  const gx = -23;
  const gy = -16.5;
  ell(ctx, gx, gy, 13.5, 10.2, -0.3);
  const gg = ctx.createRadialGradient(gx - 4, gy - 5, 1.5, gx, gy, 15);
  gg.addColorStop(0, skin.light);
  gg.addColorStop(0.5, skin.body);
  gg.addColorStop(1, skin.dark);
  stroked(ctx, gg, 2.4);
  ctx.save();
  ell(ctx, gx, gy, 13.5, 10.2, -0.3);
  ctx.clip();
  ctx.strokeStyle = skin.dark;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha *= 0.8;
  for (const k of [6, 0.5, -5.5]) {
    ctx.beginPath();
    ctx.moveTo(gx + k + 2.5, gy - 11);
    ctx.quadraticCurveTo(gx + k - 2.2, gy, gx + k + 1.5, gy + 11);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ell(ctx, gx - 2, gy - 6, 6, 2.4, -0.35);
  ctx.fill();

  // Стебелёк с чешуйкой.
  ell(ctx, -8.6, -15.2, 2.9, 4.3, 0.25);
  stroked(ctx, skin.dark, 2);

  // Грудь: горбик спереди, к стебельку ниже.
  ctx.beginPath();
  ctx.moveTo(-6.2, -14);
  ctx.bezierCurveTo(-6.4, -19.5, -1.2, -22, 3, -21.6);
  ctx.bezierCurveTo(7.4, -21.2, 11.2, -19.4, 12.6, -16.2);
  ctx.bezierCurveTo(13.2, -13, 10.4, -11.4, 6, -11.4);
  ctx.bezierCurveTo(1, -11.1, -4.8, -11.1, -6.2, -14);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, -22, 2, -11);
  tg.addColorStop(0, skin.light);
  tg.addColorStop(0.45, skin.body);
  tg.addColorStop(1, skin.dark);
  stroked(ctx, tg, 2.2);
  ctx.strokeStyle = skin.dark;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(4.2, -21);
  ctx.quadraticCurveTo(2.6, -16.5, 4.6, -12);
  ctx.stroke();

  if (o.lab) {
    // Белый халат: накидка на груди и начале брюшка, с воротником и пуговицей.
    ctx.beginPath();
    ctx.moveTo(12, -19);
    ctx.bezierCurveTo(8, -24, -6, -24, -14, -21);
    ctx.bezierCurveTo(-20, -18, -22, -10, -17, -6);
    ctx.lineTo(-6, -9);
    ctx.bezierCurveTo(0, -10, 8, -10, 12.5, -13);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -24, 0, -6);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(1, '#cfc8b8');
    stroked(ctx, cg, 1.8);
    ctx.strokeStyle = 'rgba(120,110,95,0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(10, -20);
    ctx.lineTo(4, -15);
    ctx.lineTo(9, -12);
    ctx.stroke();
    ell(ctx, 1, -14, 1.2, 1.2);
    ctx.fillStyle = '#7a8a9a';
    ctx.fill();
  }

  // Голова на шее; кивок поворачивает её вокруг шеи.
  ctx.save();
  ctx.translate(12, -18);
  ctx.rotate((o.nod ?? 0) * 0.42);
  ctx.translate(-12, 18);
  const hx = 19.5;
  const hy = -23;
  ctx.beginPath();
  ctx.moveTo(25.5, -19.5);
  ctx.quadraticCurveTo(32.5, -19.2, 30.6, -14.2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  ctx.strokeStyle = skin.dark;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ell(ctx, hx, hy, 9.6, 8.4, 0.25);
  const hg = ctx.createRadialGradient(hx - 3, hy - 4, 1, hx, hy, 11);
  hg.addColorStop(0, skin.light);
  hg.addColorStop(0.5, skin.body);
  hg.addColorStop(1, skin.dark);
  stroked(ctx, hg, 2.3);
  ell(ctx, hx + 2.2, hy - 2.2, 3.7, 4.2, 0.1);
  ctx.fillStyle = '#fff8f0';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = OUT;
  ell(ctx, hx + 3.6, hy - 1.8, 1.9, 2.1);
  ctx.fill();
  ctx.fillStyle = skin.shine;
  ell(ctx, hx + 2.9, hy - 3.1, 0.8, 0.8);
  ctx.fill();
  if (o.lab) {
    // Защитные очки: латунный ободок со стеклом поверх глаза и ремешок назад.
    ctx.strokeStyle = '#5a3a1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 3);
    ctx.lineTo(hx - 1, hy - 3.5);
    ctx.stroke();
    ell(ctx, hx + 2.4, hy - 2.2, 5.2, 5.6, 0.1);
    ctx.fillStyle = 'rgba(190,230,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = '#e0b24a';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hx + 2.4, hy - 2.2, 3.8, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
  }
  if (o.carry) carried(ctx, o.carry, o.t);
  if (o.hammer !== undefined && o.hammer !== null) {
    // Молоток: черенок в жвалах, камешек на конце; замах вверх и удар вниз.
    ctx.save();
    ctx.translate(29, -15);
    ctx.rotate(-0.9 + Math.max(0, Math.sin(o.hammer)) * -0.8 + 0.6);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.strokeStyle = PAL.twig;
    ctx.lineWidth = 2;
    ctx.stroke();
    ell(ctx, 18, 0, 4.6, 6, 0);
    const pg = ctx.createLinearGradient(14, -6, 22, 6);
    pg.addColorStop(0, '#d8d2c6');
    pg.addColorStop(1, '#6a645a');
    stroked(ctx, pg, 1.6);
    ctx.restore();
  }
  if (o.helmet) {
    ctx.beginPath();
    ctx.moveTo(8.4, -24.5);
    ctx.bezierCurveTo(8.6, -35, 26, -36.5, 28.4, -26.6);
    ctx.lineTo(30.8, -25.6);
    ctx.quadraticCurveTo(19, -22.6, 8.4, -24.5);
    ctx.closePath();
    const kg = ctx.createLinearGradient(10, -35, 24, -24);
    kg.addColorStop(0, '#fff1a6');
    kg.addColorStop(0.45, '#f3c12a');
    kg.addColorStop(1, '#b07a10');
    stroked(ctx, kg, 2);
    ctx.strokeStyle = 'rgba(120,70,0,0.6)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(18, -34);
    ctx.quadraticCurveTo(19.5, -29, 19, -24.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ell(ctx, 14, -31, 3.4, 1.3, -0.5);
    ctx.fill();
  }
  if (o.aviator) {
    // Лётная шапка: кожаный шлем с ухом-клапаном, очки подняты на лоб (стекло видно сбоку).
    ctx.beginPath();
    ctx.moveTo(9, -22);
    ctx.bezierCurveTo(8, -34.5, 25.5, -36.5, 28.6, -26.4);
    ctx.quadraticCurveTo(19, -27.5, 13.5, -25);
    ctx.lineTo(14.2, -15.5);
    ctx.quadraticCurveTo(10.5, -14.5, 9.5, -17);
    ctx.closePath();
    const ag = ctx.createLinearGradient(10, -36, 22, -16);
    ag.addColorStop(0, '#c58a52');
    ag.addColorStop(0.5, '#8a5a30');
    ag.addColorStop(1, '#4e3016');
    stroked(ctx, ag, 2);
    ctx.strokeStyle = 'rgba(255,230,190,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(11.5, -24);
    ctx.bezierCurveTo(12, -32, 22, -33.5, 25.5, -28);
    ctx.stroke();
    ctx.setLineDash([]);
    // Ремешок и стекло очков.
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(10.5, -28.5);
    ctx.quadraticCurveTo(18, -33.5, 25.5, -32);
    ctx.stroke();
    ell(ctx, 26.2, -31.6, 2.4, 3.6, 0.5);
    const lgl = ctx.createLinearGradient(24, -35, 28, -28);
    lgl.addColorStop(0, '#d9f2ff');
    lgl.addColorStop(1, '#5aa0c8');
    stroked(ctx, lgl, 1.6);
    ctx.strokeStyle = '#e0b24a';
    ctx.lineWidth = 1;
    ell(ctx, 26.2, -31.6, 2.4, 3.6, 0.5);
    ctx.stroke();
  }
  // Усики: локтевые, кончик с булавой, покачиваются.
  const fid = o.fidget ?? 0;
  const sway = Math.sin(o.t * (2.6 + fid * 6)) * (1.6 + fid * 1.6);
  const sway2 = Math.sin(o.t * (2.1 + fid * 5) + 1.7) * 1.4;
  const capped = o.helmet || o.aviator;
  for (const [far, dx] of [[true, -1.6], [false, 0]] as const) {
    const bx = 25 + dx;
    const by = capped ? -25.5 : -28;
    const ex = 21.5 + dx;
    const ey = capped ? -36 : -37.5;
    const tx = 34.5 + dx + sway;
    const ty = -41 + (far ? sway2 : sway * 0.5);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.quadraticCurveTo(27.5 + dx, ey - 5.2, tx, ty);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = far ? 2.4 : 2.8;
    ctx.stroke();
    if (!far) {
      ctx.strokeStyle = skin.body;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ell(ctx, tx, ty, 1.9, 1.5, 0.4);
    ctx.fillStyle = far ? skin.dark : OUT;
    ctx.fill();
  }
  ctx.restore();

  sideLegs(ctx, walk, skin, false, seated);
  ctx.restore();
}

// ───────────────────────── стрекоза в обвесах ─────────────────────────

export interface DragonflyOpts {
  t: number;
  /** 0 — крылья сложены, 1 — машут в полную силу. */
  flap: number;
  /** Сколько обвесов уже стоит (0..3): седло, ореховая броня, бак с мёдом. */
  gear: number;
  /** Пилот в седле. */
  rider: boolean;
  /** Наклон корпуса (взлёт носом вверх). */
  pitch?: number;
}

/** Крыло сбоку: прозрачная лопасть с жилками и тёмным глазком-птеростигмой у кончика. */
export function wing(ctx: Ctx, len: number, wid: number, alpha: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 0.9, len, -wid * 0.2);
  ctx.bezierCurveTo(len * 0.95, wid * 0.3, len * 0.4, wid * 0.55, 0, 0);
  ctx.closePath();
  ctx.fillStyle = `rgba(225,245,255,${0.38 * alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(30,60,80,${0.75 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = `rgba(60,100,120,${0.4 * alpha})`;
  ctx.lineWidth = 0.8;
  for (const k of [-0.45, -0.1, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(len * 0.5, k * wid, len * 0.92, k * wid * 0.5 - wid * 0.15);
    ctx.stroke();
  }
  for (let i = 1; i < 9; i++) {
    const x = (len * i) / 9.5;
    ctx.beginPath();
    ctx.moveTo(x, -wid * 0.7 * Math.sin((Math.PI * i) / 9.5) - 1);
    ctx.lineTo(x + 3, wid * 0.4 * Math.sin((Math.PI * i) / 9.5));
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(120,70,20,${0.85 * alpha})`;
  ctx.beginPath();
  ctx.rect(len * 0.8, -wid * 0.62, len * 0.09, wid * 0.22);
  ctx.fill();
}

/**
 * Стрекоза-«самолёт» сбоку, смотрит вдоль +x. Начало координат — земля под грудью.
 * Длина около 240 px при s = 1: длинное синее брюшко в сегментах, зелёная грудь,
 * голова с огромным фасеточным глазом, две пары крыльев. Обвесы — седло, броня из скорлупы
 * лесного ореха на заклёпках, бак-капля с мёдом и флажок-лист на хвосте.
 */
export function drawDragonflySide(ctx: Ctx, x: number, y: number, s: number, o: DragonflyOpts): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(0, -34);
  ctx.rotate(o.pitch ?? 0);
  const flapA = o.flap > 0 ? Math.sin(o.t * 48) : 0;
  const drawWings = (far: boolean): void => {
    const pairs: [number, number, number, number][] = [[-2, -14, 128, 17], [-16, -12, 118, 21]];
    pairs.forEach(([wx, wy, len, wid], i) => {
      const rest = 0.42 + i * 0.16 + (far ? 0.12 : 0);
      const angles = o.flap > 0 ? [rest - 0.55 * o.flap + flapA * 0.75 * o.flap] : [rest];
      // Смазанные копии крыльев в полёте: крылья машут быстрее, чем видит глаз.
      if (o.flap > 0.3) angles.push(rest - 1.1 * o.flap, rest + 0.25 * o.flap);
      angles.forEach((a, k) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.scale(-1, 1);
        ctx.rotate(-a - (i === 0 ? 0 : 0.05));
        wing(ctx, len, wid, (far ? 0.6 : 1) * (k === 0 ? 1 : 0.35));
        ctx.restore();
      });
    });
  };
  drawWings(true);
  // Брюшко: одна длинная трубка, к хвосту тоньше и чуть опущена; кольца сегментов поперёк.
  const n = 24;
  const top: P[] = [];
  const bot: P[] = [];
  const spine: P[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = -12 - k * 182;
    const y = 2 + k * k * 9;
    const hw = 10.5 - 5 * k + (i === 0 ? 1.5 : 0);
    spine.push([x, y]);
    top.push([x, y - hw]);
    bot.push([x, y + hw]);
  }
  const tubePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    ctx.quadraticCurveTo(spine[n][0] - 7, spine[n][1], bot[n][0], bot[n][1]);
    for (let i = n; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
  };
  tubePath();
  const ag = ctx.createLinearGradient(0, -10, 0, 18);
  ag.addColorStop(0, '#a8ecff');
  ag.addColorStop(0.4, '#2f9fd0');
  ag.addColorStop(1, '#0f4566');
  stroked(ctx, ag, 2.2);
  ctx.save();
  tubePath();
  ctx.clip();
  for (let j = 1; j < 10; j++) {
    const i = Math.round((j / 10) * n);
    const [x, y] = spine[i];
    const hw = 10.5 - 5 * (i / n);
    // Светлое колечко и тёмный шов: как у настоящих стрекоз.
    ctx.strokeStyle = 'rgba(200,255,150,0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + 2.5, y - hw - 1);
    ctx.quadraticCurveTo(x + 0.5, y, x + 2.5, y + hw + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(8,28,48,0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - hw - 1);
    ctx.quadraticCurveTo(x - 2, y, x, y + hw + 1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n - 2; i++) {
    const [x, y] = spine[i];
    const hw = 10.5 - 5 * (i / n);
    if (i === 0) ctx.moveTo(x, y - hw * 0.55); else ctx.lineTo(x, y - hw * 0.55);
  }
  ctx.stroke();
  ctx.restore();
  // Хвостовые придатки.
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-192, 9);
  ctx.lineTo(-206, 5);
  ctx.moveTo(-192, 13);
  ctx.lineTo(-204, 18);
  ctx.stroke();
  if (o.gear >= 3) {
    // Флажок-лист на хвосте.
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-176, 6); ctx.lineTo(-176, -22); ctx.stroke();
    ctx.strokeStyle = PAL.twig;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    const fw = Math.sin(o.t * (o.flap > 0 ? 14 : 3)) * 2;
    ctx.moveTo(-176, -22);
    ctx.bezierCurveTo(-186, -30 + fw, -198, -26 + fw, -200, -18 + fw);
    ctx.bezierCurveTo(-192, -14, -184, -14, -176, -12);
    ctx.closePath();
    const lg = ctx.createLinearGradient(-200, -30, -176, -12);
    lg.addColorStop(0, '#f06a4a');
    lg.addColorStop(1, '#a3261a');
    stroked(ctx, lg, 1.6);
  }
  // Ноги: тонкие, поджаты под грудь (на земле стоят).
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [ax, kx, ky, fx, fy] of [[14, 24, 20, 28, 34], [2, 6, 22, 2, 34], [-10, -20, 20, -26, 34]] as const) {
    const lift = o.flap > 0 ? 12 * o.flap : 0;
    ctx.beginPath();
    ctx.moveTo(ax, 10);
    ctx.lineTo(kx, ky - lift * 0.4);
    ctx.lineTo(fx - (o.flap > 0 ? 6 : 0), fy - lift);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = '#2a3a40';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  // Грудь: зелёная, с тёмными косыми полосами.
  ell(ctx, 4, -2, 26, 19, -0.15);
  const tg = ctx.createRadialGradient(-4, -12, 2, 4, -2, 28);
  tg.addColorStop(0, '#c8f08a');
  tg.addColorStop(0.5, '#5fae3a');
  tg.addColorStop(1, '#25541a');
  stroked(ctx, tg, 2.4);
  ctx.save();
  ell(ctx, 4, -2, 26, 19, -0.15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,50,20,0.55)';
  ctx.lineWidth = 3.2;
  for (const k of [-10, 2, 13]) {
    ctx.beginPath();
    ctx.moveTo(k - 6, -20);
    ctx.lineTo(k + 6, 18);
    ctx.stroke();
  }
  ctx.restore();
  // Голова: круглая, почти вся — фасеточный глаз.
  ell(ctx, 36, -6, 15, 14);
  const hg = ctx.createRadialGradient(32, -12, 1, 36, -6, 16);
  hg.addColorStop(0, '#a6e06a');
  hg.addColorStop(1, '#3e7a22');
  stroked(ctx, hg, 2.2);
  ell(ctx, 39, -11, 12, 11.5, 0.2);
  const eg = ctx.createRadialGradient(35, -16, 1, 39, -11, 13);
  eg.addColorStop(0, '#9fe6ff');
  eg.addColorStop(0.45, '#2a7fb0');
  eg.addColorStop(1, '#0c2a40');
  stroked(ctx, eg, 2);
  ctx.save();
  ell(ctx, 39, -11, 12, 11.5, 0.2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,220,255,0.25)';
  ctx.lineWidth = 0.8;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(27, -11 + i * 4);
    ctx.quadraticCurveTo(39, -14 + i * 4.5, 51, -11 + i * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(39 + i * 4, -23);
    ctx.quadraticCurveTo(36 + i * 4.5, -11, 39 + i * 4, 1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ell(ctx, 34, -17, 4, 2.4, -0.5);
  ctx.fill();
  // Рот снизу.
  ell(ctx, 46, 5, 4, 3);
  stroked(ctx, '#3e7a22', 1.4);

  if (o.gear >= 2) {
    // Бак-капля с мёдом под грудью на ремне.
    ctx.strokeStyle = '#4a2c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(-2, 22);
    ctx.moveTo(14, 14);
    ctx.lineTo(10, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 26);
    ctx.bezierCurveTo(-10, 18, 18, 18, 20, 26);
    ctx.bezierCurveTo(18, 33, -8, 33, -10, 26);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, 18, 0, 33);
    bg.addColorStop(0, '#ffe08a');
    bg.addColorStop(1, '#c9821a');
    stroked(ctx, bg, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ell(ctx, -2, 22.5, 5, 1.4);
    ctx.fill();
  }
  if (o.gear >= 1) {
    // Броня: пластины скорлупы лесного ореха на передних сегментах брюшка, на заклёпках.
    for (const px of [-32, -54]) {
      ctx.beginPath();
      ctx.moveTo(px - 13, -8);
      ctx.bezierCurveTo(px - 12, -18, px + 12, -18, px + 13, -8);
      ctx.lineTo(px + 11, 4);
      ctx.bezierCurveTo(px + 4, 1, px - 4, 1, px - 11, 4);
      ctx.closePath();
      const ng = ctx.createLinearGradient(px, -18, px, 4);
      ng.addColorStop(0, '#d8a46a');
      ng.addColorStop(0.5, '#a06a34');
      ng.addColorStop(1, '#5e3a18');
      stroked(ctx, ng, 1.8);
      ctx.strokeStyle = 'rgba(60,30,10,0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(px - 9, -12);
      ctx.quadraticCurveTo(px, -15, px + 9, -12);
      ctx.stroke();
      ctx.fillStyle = '#e8c45a';
      for (const rx of [-8, 8]) {
        ell(ctx, px + rx, -3, 1.4, 1.4);
        ctx.fill();
      }
    }
  }
  // Седло на груди: кожаная подушка со строчкой, стремя вниз по боку.
  ctx.beginPath();
  ctx.moveTo(-14, -16);
  ctx.bezierCurveTo(-12, -26, 18, -28, 22, -18);
  ctx.bezierCurveTo(12, -14, -4, -13, -14, -16);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, -28, 0, -14);
  sg.addColorStop(0, '#b77a44');
  sg.addColorStop(1, '#6a4020');
  stroked(ctx, sg, 2);
  ctx.strokeStyle = 'rgba(255,225,180,0.45)';
  ctx.lineWidth = 0.9;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.bezierCurveTo(-6, -24, 14, -25, 18, -19);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(4, -16);
  ctx.lineTo(6, 6);
  ctx.stroke();
  drawWings(false);
  if (o.rider) {
    drawAntSide(ctx, 3, -22, 0.82, 1, { walk: null, t: o.t, aviator: true, wind: o.flap, seated: true, nod: -0.25 });
  }
  ctx.restore();
}
