/**
 * Муравейник в разрезе: большой купол из хвои с камерами внутри и сеть светлых ходов под землёй.
 * Камеры: солярий с куколками под макушкой, ясли и лаборатория в куполе, кладовая зерна, грибной
 * сад и ангар стрекозы под землёй, глубже — завалы после налёта и забой, где строители роют дальше.
 * Мир больше экрана: его двигает камера. Статичное печётся один раз (bakeColony), живое рисуется
 * каждый кадр (drawColonyLife): муравьи с ношей по ходам, свет фонарей, лаборант, механики,
 * вылет стрекозы через люк в дёрне.
 */
import { TAU } from '../engine/math';
import { Rng } from '../engine/rng';
import { drawBeetle } from './art';
import {
  GREY, OUT, PINK, RIM, SLATE, WARM, acornBowl, along, brokenRoot, clod, cocoon, drawAntSide, drawDragonflySide, drawGrub,
  drawPlaque, egg, ell, flask, glow, glowShroom, grain, honeyLamp, leafBit, leafTray, ribbon, root, sampleSmooth, stone, stroked,
  wing, type Carry, type Ctx, type P, type Sample, type Soil, type Tone,
} from './colonyKit';
import { PAL } from './palette';
import type { RoomId } from '../game/chambers';

// ───────────────────────── план мира ─────────────────────────

export const WORLD_W = 2400;
export const WORLD_H = 1500;
export const SURFACE = 470;

export type RoomKind = 'solar' | 'nursery' | 'lab' | 'granary' | 'fungus' | 'hangar' | 'ruin';

export interface Chamber { kind: RoomKind; cx: number; cy: number; rx: number; ry: number; seed: number; fill?: number; side?: 1 | -1 }

export const SOLAR: Chamber = { kind: 'solar', cx: 1200, cy: 262, rx: 140, ry: 50, seed: 3 };
export const NURSERY: Chamber = { kind: 'nursery', cx: 990, cy: 392, rx: 180, ry: 64, seed: 11 };
export const LAB: Chamber = { kind: 'lab', cx: 1410, cy: 392, rx: 180, ry: 64, seed: 13 };
export const GRANARY: Chamber = { kind: 'granary', cx: 520, cy: 660, rx: 190, ry: 66, seed: 17 };
export const FUNGUS: Chamber = { kind: 'fungus', cx: 1200, cy: 660, rx: 220, ry: 74, seed: 19 };
export const HANGAR: Chamber = { kind: 'hangar', cx: 1960, cy: 650, rx: 270, ry: 96, seed: 23 };
export const RUINS: readonly Chamber[] = [
  { kind: 'ruin', cx: 760, cy: 940, rx: 190, ry: 70, seed: 31, fill: 0.88, side: -1 },
  { kind: 'ruin', cx: 1650, cy: 930, rx: 200, ry: 72, seed: 41, fill: 0.84, side: 1 },
  { kind: 'ruin', cx: 1200, cy: 1160, rx: 250, ry: 86, seed: 51, fill: 0.95, side: 1 },
  { kind: 'ruin', cx: 420, cy: 1210, rx: 150, ry: 60, seed: 61, fill: 0.92, side: -1 },
];
const ALL: readonly Chamber[] = [SOLAR, NURSERY, LAB, GRANARY, FUNGUS, HANGAR, ...RUINS];

interface Tunnel { pts: readonly P[]; w: number }
/** Ходы: начинаются в небе (обрезаются по земле — так получаются входы) или в камере. */
const TUNNELS: readonly Tunnel[] = [
  { pts: [[1200, 112], [1203, 160], [1196, 196], [1200, 226]], w: 40 },
  { pts: [[836, 218], [866, 262], [862, 312], [846, 352]], w: 38 },
  { pts: [[1564, 218], [1534, 262], [1538, 312], [1554, 352]], w: 38 },
  { pts: [[1086, 272], [1052, 302], [1036, 340]], w: 36 },
  { pts: [[1314, 272], [1348, 302], [1364, 340]], w: 36 },
  { pts: [[1200, 300], [1186, 352], [1214, 420], [1194, 500], [1206, 594]], w: 46 },
  { pts: [[1150, 428], [1178, 422], [1204, 430]], w: 34 },
  { pts: [[1252, 428], [1224, 422], [1198, 430]], w: 34 },
  { pts: [[372, 440], [384, 490], [404, 540], [436, 602]], w: 40 },
  { pts: [[700, 670], [810, 636], [900, 648], [994, 666]], w: 40 },
  { pts: [[1408, 666], [1512, 640], [1610, 650], [1702, 672]], w: 44 },
  { pts: [[1960, 440], [1960, 500], [1960, 570]], w: 150 },
  { pts: [[1334, 712], [1322, 790], [1236, 860], [1200, 960], [1200, 1078]], w: 42 },
  { pts: [[1232, 864], [1100, 886], [946, 928]], w: 38 },
  { pts: [[1240, 858], [1340, 882], [1456, 918]], w: 38 },
  { pts: [[730, 990], [630, 1080], [548, 1170]], w: 36 },
  { pts: [[1206, 990], [1370, 1010], [1530, 1022], [1700, 1012]], w: 38 },
];
const SAMPLES: readonly Sample[][] = TUNNELS.map((t) => sampleSmooth(t.pts, 4));
/** Ширина хода чуть гуляет по длине: ход вырыт, а не выточен. */
const tubeW = (base: number) => (_t: number, d: number): number => base * (1 + 0.09 * Math.sin(d * 0.045 + base) + 0.05 * Math.sin(d * 0.13));

/** Пол камеры: на нём стоят муравьи и лежит всё убранство. */
export function floorY(c: Chamber): number {
  return c.cy + c.ry * 0.78;
}

// ───────────────────────── земля ─────────────────────────

function surf(x: number): number { return SURFACE + 4 * Math.sin(x * 0.013) + 2 * Math.sin(x * 0.041 + 1); }

/** Верх купола: широкий, с плоской макушкой; вне купола — уровень земли. */
function moundTop(x: number): number {
  const u = (x - 1200) / 460;
  if (Math.abs(u) >= 1) return surf(x);
  const h = 330 * Math.pow(1 - Math.pow(Math.abs(u), 2.1), 0.62) + 5 * Math.sin(x * 0.05) * (1 - Math.abs(u));
  return surf(x) - h;
}
function groundTop(x: number): number { return Math.min(surf(x), moundTop(x)); }

function band1(x: number): number { return 600 + 10 * Math.sin(x * 0.009 + 1) + 6 * Math.sin(x * 0.027); }
function band2(x: number): number { return 850 + 15 * Math.sin(x * 0.007 + 2) + 7 * Math.sin(x * 0.029); }
function band3(x: number): number { return 1120 + 14 * Math.sin(x * 0.008 + 4) + 8 * Math.sin(x * 0.021 + 1); }

interface Layer extends Soil { top: (x: number) => number; bot: (x: number) => number }
const LAYERS: readonly Layer[] = [
  { top: surf, bot: band1, hi: '#7a4f2d', base: '#5e3b22', lo: '#4a2d1a', speck: ['#8c6040', '#3a2414'] },
  { top: band1, bot: band2, hi: '#94643b', base: '#7d5232', lo: '#664026', speck: ['#a8794a', '#523320'] },
  { top: band2, bot: band3, hi: '#ad7a45', base: '#9a6a3a', lo: '#7c5330', speck: ['#c48f55', '#6e4828'] },
  { top: band3, bot: () => WORLD_H + 40, hi: '#7d6f60', base: '#6a5c4e', lo: '#4c4137', speck: ['#958676', '#3c332b'] },
];
function layerAt(x: number, y: number): Layer {
  return y > band3(x) ? LAYERS[3] : y > band2(x) ? LAYERS[2] : y > band1(x) ? LAYERS[1] : LAYERS[0];
}

function layerPath(ctx: Ctx, L: Layer): void {
  ctx.beginPath();
  ctx.moveTo(-20, L.top(-20));
  for (let x = -20; x <= WORLD_W + 20; x += 12) ctx.lineTo(x, L.top(x));
  ctx.lineTo(WORLD_W + 20, L.bot(WORLD_W + 20));
  for (let x = WORLD_W + 20; x >= -20; x -= 12) ctx.lineTo(x, L.bot(x));
  ctx.closePath();
}

function sky(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 0, SURFACE);
  g.addColorStop(0, '#86c4e6');
  g.addColorStop(1, '#e2f2e6');
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, WORLD_W + 40, SURFACE + 40);
  const cloud = (x: number, y: number, k: number): void => {
    const puffs: [number, number, number][] = [[-30, 6, 16], [-12, -6, 20], [10, -10, 24], [32, -2, 18], [48, 8, 13], [8, 10, 20], [-20, 12, 14]];
    ctx.fillStyle = 'rgba(150,190,215,0.55)';
    for (const [dx, dy, r] of puffs) { ell(ctx, x + dx * k + 3, y + dy * k + 5, r * k, r * k * 0.85); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy, r] of puffs) { ell(ctx, x + dx * k, y + dy * k, r * k, r * k * 0.85); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,225,240,0.7)';
    ell(ctx, x + 8 * k, y + 14 * k, 44 * k, 7 * k);
    ctx.fill();
  };
  for (const [x, y, k] of [[560, 90, 1.3], [1760, 60, 1.1], [2180, 170, 0.9], [980, 40, 0.8], [1460, 120, 0.7]] as const) cloud(x, y, k);
  for (const [base, amp, col, f] of [[SURFACE - 22, 12, '#a9d48a', 0.005], [SURFACE - 8, 7, '#93c672', 0.011]] as const) {
    ctx.beginPath();
    ctx.moveTo(-20, SURFACE + 4);
    for (let x = -20; x <= WORLD_W + 20; x += 20) ctx.lineTo(x, base - amp * Math.sin(x * f + 0.5) - amp * 0.4 * Math.sin(x * f * 3.1));
    ctx.lineTo(WORLD_W + 20, SURFACE + 4);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }
}

/** Слои почвы: крошка, комья, прожилки осадка и кромки между слоями («грунт» из первого эталона). */
function soil(ctx: Ctx, rng: Rng): void {
  for (const L of LAYERS) {
    layerPath(ctx, L);
    const top = L.top(1200);
    const bot = Math.min(L.bot(1200), WORLD_H);
    const g = ctx.createLinearGradient(0, top, 0, Math.max(top + 40, bot));
    g.addColorStop(0, L.hi);
    g.addColorStop(0.35, L.base);
    g.addColorStop(1, L.lo);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    layerPath(ctx, L);
    ctx.clip();
    const n = Math.floor((WORLD_W * Math.max(60, bot - top)) / 160);
    for (let i = 0; i < n; i++) {
      const x = rng.range(-10, WORLD_W + 10);
      const y = rng.range(L.top(x) - 2, Math.min(L.bot(x), WORLD_H) + 2);
      const r = rng.next() < 0.85 ? rng.range(0.7, 1.9) : rng.range(2.2, 4.2);
      ctx.fillStyle = rng.next() < 0.5 ? L.speck[0] : L.speck[1];
      ctx.globalAlpha = rng.range(0.35, 0.75);
      ell(ctx, x, y, r * rng.range(0.9, 1.5), r, rng.range(0, TAU));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < n / 30; i++) {
      const x = rng.range(0, WORLD_W);
      const y = rng.range(L.top(x), Math.min(L.bot(x), WORLD_H));
      const r = rng.range(14, 46);
      const cg = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, 1, x, y, r);
      cg.addColorStop(0, rng.next() < 0.6 ? 'rgba(255,220,170,0.13)' : 'rgba(30,15,5,0.14)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ell(ctx, x, y, r * 1.5, r, rng.range(-0.3, 0.3));
      ctx.fill();
    }
    for (let i = 0; i < 9; i++) {
      const x0 = rng.range(-100, WORLD_W);
      const len = rng.range(180, 520);
      const y0 = rng.range(L.top(x0) + 10, Math.min(L.bot(x0), WORLD_H) - 6);
      const tilt = rng.range(-0.05, 0.05);
      ctx.beginPath();
      for (let x = 0; x <= len; x += 10) {
        const y = y0 + x * tilt + 3 * Math.sin((x0 + x) * 0.035 + i);
        if (x === 0) ctx.moveTo(x0 + x, y); else ctx.lineTo(x0 + x, y);
      }
      ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(255,225,180,0.12)' : 'rgba(30,15,5,0.16)';
      ctx.lineWidth = rng.range(1.5, 4);
      ctx.stroke();
    }
    ctx.restore();
    if (L.top !== surf) {
      const edge = (dy: number): void => {
        ctx.beginPath();
        for (let x = -20; x <= WORLD_W + 20; x += 12) {
          if (x === -20) ctx.moveTo(x, L.top(x) + dy); else ctx.lineTo(x, L.top(x) + dy);
        }
      };
      edge(0);
      ctx.strokeStyle = 'rgba(30,16,6,0.35)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      edge(3);
      ctx.strokeStyle = 'rgba(255,220,170,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function stones(ctx: Ctx, rng: Rng): void {
  for (let i = 0; i < 300; i++) {
    const x = rng.range(0, WORLD_W);
    const y = rng.range(SURFACE + 14, WORLD_H + 10);
    const deep = y > band3(x);
    const clay = y > band2(x);
    if (!deep && rng.next() < 0.35) continue;
    const r = deep ? rng.range(3, 9) : rng.range(2, 6);
    stone(ctx, x, y, r, rng, rng.pick(deep ? [GREY, SLATE, GREY] : clay ? [WARM, PINK, GREY] : [WARM, GREY]), r > 5 ? 1.8 : 1.4);
  }
  for (let i = 0; i < 46; i++) {
    const x = rng.range(0, WORLD_W);
    const deep = rng.next() < 0.7;
    const y = deep ? rng.range(band3(x) + 18, WORLD_H + 30) : rng.range(band2(x) + 14, band3(x) - 6);
    stone(ctx, x, y, deep ? rng.range(12, 32) : rng.range(9, 17), rng, rng.pick([GREY, WARM, PINK, SLATE]), 2.2);
  }
}

/** Мочки травы под дёрном и корни: дерева слева, куста справа. */
function roots(ctx: Ctx, rng: Rng): void {
  ctx.lineCap = 'round';
  for (let x = 300 + rng.range(0, 20); x < WORLD_W; x += rng.range(14, 34)) {
    if (x > 720 && x < 1680) continue;
    const y = surf(x) + 3;
    for (let i = 0, n = rng.int(3, 7); i < n; i++) {
      const len = rng.range(10, 34);
      const dx = rng.range(-8, 8);
      ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(214,186,140,0.5)' : 'rgba(170,130,85,0.55)';
      ctx.lineWidth = rng.range(0.8, 1.5);
      ctx.beginPath();
      ctx.moveTo(x + rng.range(-3, 3), y);
      ctx.bezierCurveTo(x + dx * 0.3, y + len * 0.35, x + dx * 1.2, y + len * 0.6, x + dx, y + len);
      ctx.stroke();
    }
  }
  // Корни дерева: толстые у ствола, ветвятся и уходят мочками.
  root(ctx, [[250, 470], [310, 540], [336, 646], [310, 770], [250, 880], [210, 960]], 40, 3, rng, { branch: 2 });
  root(ctx, [[120, 476], [80, 600], [40, 720], [10, 840]], 34, 3, rng, { branch: 2 });
  root(ctx, [[282, 474], [380, 506], [480, 528], [580, 552], [660, 560]], 22, 2, rng, { branch: 1 });
  root(ctx, [[180, 480], [200, 600], [160, 700], [130, 800]], 20, 2, rng, { branch: 1 });
  // Корни куста справа.
  root(ctx, [[2300, 470], [2290, 540], [2250, 600], [2236, 680]], 13, 1.5, rng, { branch: 1 });
  root(ctx, [[2330, 472], [2370, 540], [2390, 620]], 11, 1.5, rng, { branch: 1 });
}

/** Ствол старого дуба у левого края: кора с бороздами, мох у комля. */
function tree(ctx: Ctx, rng: Rng): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(-40, -20);
    ctx.lineTo(196, -20);
    ctx.bezierCurveTo(200, 200, 214, 360, 250, 420);
    ctx.bezierCurveTo(280, 455, 330, 468, 352, 476);
    ctx.lineTo(-40, 480);
    ctx.closePath();
  };
  path();
  const g = ctx.createLinearGradient(-40, 0, 260, 0);
  g.addColorStop(0, '#4a2e18');
  g.addColorStop(0.55, '#7a5230');
  g.addColorStop(0.85, '#9a6a3e');
  g.addColorStop(1, '#5e3b20');
  stroked(ctx, g, 3);
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    let x = rng.range(-30, 230);
    let y = rng.range(-20, 200);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = rng.range(80, 260);
    for (let k = 0; k < len; k += 14) {
      x += rng.range(-3, 3) + (y > 300 ? 2.4 : 0.2);
      y += 14;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(30,15,5,0.55)';
    ctx.lineWidth = rng.range(1.6, 3.4);
    ctx.stroke();
    ctx.translate(2, 0);
    ctx.strokeStyle = 'rgba(255,220,170,0.16)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.translate(-2, 0);
  }
  // Мох кочками у комля и пятнами на северной стороне ствола.
  for (const [cx, cy, r] of [[30, 456, 26], [110, 466, 22], [196, 462, 18], [-4, 380, 20], [40, 300, 14], [262, 460, 14]] as const) {
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, TAU);
      const d = Math.sqrt(rng.next()) * r;
      const x = cx + Math.cos(a) * d * 1.3;
      const y = cy + Math.sin(a) * d * 0.6;
      const rr = rng.range(4, 8);
      ell(ctx, x, y, rr, rr * 0.75);
      ctx.fillStyle = rng.pick(['#5f9e34', '#4f8a2a', '#76b444']);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,60,15,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,240,140,0.6)';
      ell(ctx, x - rr * 0.3, y - rr * 0.3, rr * 0.3, rr * 0.2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Купол: тело из земли с хвоёй, слоистое, сверху толстая кровля из хвоинок и веточек. */
function mound(ctx: Ctx, rng: Rng): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(732, surf(732) + 2);
    for (let x = 740; x <= 1660; x += 8) ctx.lineTo(x, moundTop(x));
    ctx.lineTo(1668, surf(1668) + 2);
    ctx.lineTo(1668, surf(1668) + 30);
    ctx.lineTo(732, surf(732) + 30);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(30,16,4,0.22)';
  ell(ctx, 1230, SURFACE + 2, 500, 10);
  ctx.fill();
  path();
  const g = ctx.createLinearGradient(0, 140, 0, SURFACE + 20);
  g.addColorStop(0, '#b98a55');
  g.addColorStop(1, '#86592f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Слои, как муравьи насыпали купол: дуги параллельно верху.
  for (const depth of [70, 132, 196, 256]) {
    ctx.beginPath();
    for (let x = 760; x <= 1640; x += 10) {
      const y = moundTop(x) + depth;
      if (x === 760) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(60,32,12,0.22)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (let i = 0; i < 1400; i++) {
    const x = rng.range(740, 1660);
    const y = rng.range(moundTop(x) + 30, SURFACE + 20);
    const a = rng.range(0, TAU);
    const len = rng.range(4, 11);
    ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(232,190,130,0.45)' : 'rgba(70,38,14,0.4)';
    ctx.lineWidth = rng.range(0.8, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // Кровля: толстый слой хвои вдоль верха, хвоинки лежат по склону.
  const tan = (x: number): number => Math.atan2(moundTop(x + 4) - moundTop(x - 4), 8);
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(740, 1660);
    const y = moundTop(x) + Math.pow(rng.next(), 0.7) * 40;
    const a = tan(x) + rng.range(-0.5, 0.5) + (rng.next() < 0.5 ? 0 : Math.PI);
    const len = rng.range(8, 20);
    const c = rng.next();
    ctx.strokeStyle = c < 0.35 ? '#ecc48a' : c < 0.7 ? '#b67c40' : c < 0.9 ? '#7a4a22' : '#4a2a12';
    ctx.lineWidth = rng.range(1.2, 2.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let x = 740; x <= 1660; x += 8) {
    const y = moundTop(x) + 42;
    if (x === 740) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(40,20,6,0.3)';
  ctx.lineWidth = 6;
  ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const x = rng.range(760, 1640);
    const y = moundTop(x) + rng.range(4, 30);
    const a = tan(x) + rng.range(-0.35, 0.35);
    const len = rng.range(26, 54);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
    ctx.strokeStyle = rng.next() < 0.5 ? PAL.twig : '#a87a4a';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  for (let x = 740; x <= 1660; x += 8) {
    if (x === 740) ctx.moveTo(x, moundTop(x)); else ctx.lineTo(x, moundTop(x));
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  for (const [x, a, len] of [[900, -2.3, 34], [1050, -1.9, 28], [1290, -1.2, 30], [1430, -0.9, 36], [1560, -0.6, 26], [1130, -1.7, 22]] as const) {
    const y = moundTop(x) + 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    ctx.strokeStyle = PAL.twig;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  for (const [x, r, a, hue] of [[960, 9, 0.4, 1], [1110, 7, -0.6, 0], [1350, 8, 2.2, 1], [1480, 7, 1.1, 0], [1600, 6, -0.3, 1]] as const) {
    leafBit(ctx, x, moundTop(x) + 4, r, a, hue);
  }
}

/** Дёрн по кромке земли (вне купола и люка), кустики травы, цветы и куст справа. */
function turf(ctx: Ctx, rng: Rng): void {
  const skip = (x: number): boolean => (x > 734 && x < 1666) || (x > 1872 && x < 2048);
  for (const [a, b] of [[260, 734], [1666, 1872], [2048, WORLD_W + 20]] as const) {
    ctx.beginPath();
    ctx.moveTo(a, surf(a) - 3);
    for (let x = a; x <= b; x += 8) ctx.lineTo(x, surf(x) - 3);
    for (let x = b; x >= a; x -= 8) ctx.lineTo(x, surf(x) + 8);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, SURFACE - 4, 0, SURFACE + 8);
    g.addColorStop(0, PAL.grassLight);
    g.addColorStop(0.6, PAL.grass);
    g.addColorStop(1, PAL.grassDark);
    stroked(ctx, g, 2.2);
  }
  for (let x = 262 + rng.range(0, 12); x < WORLD_W; x += rng.range(9, 26)) {
    if (skip(x)) continue;
    const by = surf(x) - 1;
    for (let i = 0, n = rng.int(3, 6); i < n; i++) {
      const bx = x + rng.range(-5, 5);
      const h = rng.range(7, 20);
      const lean = rng.range(-6, 6);
      const w = rng.range(2, 3.4);
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(bx + lean * 0.3 - w * 0.2, by - h * 0.6, bx + lean, by - h);
      ctx.quadraticCurveTo(bx + lean * 0.3 + w * 0.6, by - h * 0.5, bx + w, by);
      ctx.closePath();
      const c = rng.next();
      ctx.fillStyle = c < 0.4 ? PAL.grassLight : c < 0.8 ? PAL.grass : PAL.grassDark;
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,22,8,0.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  const daisy = (x: number, h: number): void => {
    const by = surf(x) - 1;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + 3, by - h * 0.5, x + 1, by - h); ctx.stroke();
    ctx.strokeStyle = PAL.leafDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const cy = by - h;
    ctx.fillStyle = '#fffaf0';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ell(ctx, x + 1 + Math.cos(a) * 5.4, cy + Math.sin(a) * 2.2, 3.4, 1.5, a);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(42,22,8,0.7)';
    ctx.lineWidth = 1;
    ell(ctx, x + 1, cy, 8.4, 3.6);
    ctx.stroke();
    ell(ctx, x + 1, cy - 0.8, 2.8, 1.8);
    stroked(ctx, '#ffc72e', 1);
  };
  for (const [x, h] of [[470, 24], [612, 18], [1720, 26], [1800, 20], [2110, 22], [2240, 18]] as const) daisy(x, h);
  const puff = (x: number, h: number): void => {
    const by = surf(x) - 1;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x - 4, by - h * 0.5, x - 1, by - h); ctx.stroke();
    ctx.strokeStyle = '#7fae55';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const cy = by - h - 9;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      ctx.beginPath();
      ctx.moveTo(x - 1, cy);
      ctx.lineTo(x - 1 + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ell(ctx, x - 1 + Math.cos(a) * 10, cy + Math.sin(a) * 10, 1.2, 1.2);
      ctx.fill();
    }
    ell(ctx, x - 1, cy, 2.2, 2.2);
    stroked(ctx, '#c9b98a', 1);
  };
  puff(540, 32);
  puff(2180, 36);
  for (const [x, h] of [[2300, 70], [2330, 84], [2360, 64]] as const) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, surf(x)); ctx.quadraticCurveTo(x - 6, surf(x) - h * 0.5, x + 2, surf(x) - h); ctx.stroke();
    ctx.strokeStyle = '#6a4a28';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    leafBit(ctx, 2330 + rng.range(-60, 60), surf(2330) - 80 + rng.range(-34, 26), rng.range(9, 15), rng.range(0, TAU), rng.next() < 0.2 ? 1 : 0);
  }
}

// ───────────────────────── ходы и камеры ─────────────────────────

/** Камера: свод дугой, пол почти ровный. grow — на сколько раздуть контур (для кромки). */
function chamberPath(ctx: Ctx, c: Chamber, grow = 0): void {
  const rx = c.rx + grow;
  const ry = c.ry + grow;
  const { cx, cy } = c;
  const fl = floorY(c) + grow * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy + ry * 0.25);
  ctx.bezierCurveTo(cx - rx, cy - ry * 0.85, cx - rx * 0.48, cy - ry * 1.06, cx + rx * 0.04, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.58, cy - ry * 0.96, cx + rx, cy - ry * 0.66, cx + rx, cy + ry * 0.18);
  ctx.bezierCurveTo(cx + rx, cy + ry * 0.6, cx + rx * 0.82, fl, cx + rx * 0.46, fl);
  ctx.bezierCurveTo(cx + rx * 0.1, fl + 3, cx - rx * 0.42, fl + 2, cx - rx * 0.64, fl);
  ctx.bezierCurveTo(cx - rx * 0.92, fl - 3, cx - rx, cy + ry * 0.62, cx - rx, cy + ry * 0.25);
  ctx.closePath();
}

function groundClip(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-20, groundTop(-20));
  for (let x = -20; x <= WORLD_W + 20; x += 6) ctx.lineTo(x, groundTop(x) + 1);
  ctx.lineTo(WORLD_W + 20, WORLD_H + 40);
  ctx.lineTo(-20, WORLD_H + 40);
  ctx.closePath();
  ctx.clip();
}

/** Ход с круглыми концами: так открытый конец забоя не обрывается срезом. */
function tube(ctx: Ctx, i: number, extra: number, fill: string): void {
  const s = SAMPLES[i];
  ribbon(ctx, s, tubeW(TUNNELS[i].w), -1, 1, extra);
  ctx.fillStyle = fill;
  ctx.fill();
  for (const p of [s[0], s[s.length - 1]]) {
    ell(ctx, p.x, p.y, TUNNELS[i].w / 2 + extra, TUNNELS[i].w / 2 + extra);
    ctx.fill();
  }
}

const TUNNEL_FILL = '#c38d55';
const TUNNEL_FLOOR = '#ddb47e';

function carve(ctx: Ctx, lv: RoomLevels): void {
  ctx.save();
  groundClip(ctx);
  // Тёмный контур и светлая утоптанная кромка у всех ходов и камер разом: стыки сливаются.
  for (const [extra, color] of [[3, OUT], [1.3, RIM]] as const) {
    TUNNELS.forEach((_, i) => tube(ctx, i, extra, color));
    for (const c of ALL) {
      chamberPath(ctx, c, extra + 1);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  TUNNELS.forEach((t, i) => {
    tube(ctx, i, 0, TUNNEL_FILL);
    const s = SAMPLES[i];
    const dx = s[s.length - 1].x - s[0].x;
    const dy = s[s.length - 1].y - s[0].y;
    ctx.save();
    ribbon(ctx, s, tubeW(t.w));
    ctx.clip();
    if (Math.abs(dx) > Math.abs(dy) * 0.6) {
      // Пологий ход: светлый пол снизу, тень под сводом сверху.
      const down = dx > 0 ? 1 : -1;
      ribbon(ctx, s, tubeW(t.w), down * 0.15, down * 1.05);
      ctx.fillStyle = TUNNEL_FLOOR;
      ctx.fill();
      ribbon(ctx, s, tubeW(t.w), -down * 0.5, -down * 1.05);
      ctx.fillStyle = 'rgba(110,64,28,0.45)';
      ctx.fill();
    } else {
      // Крутой ход: светлее середина.
      ribbon(ctx, s, tubeW(t.w), -0.35, 0.45);
      ctx.fillStyle = 'rgba(232,196,140,0.45)';
      ctx.fill();
    }
    ctx.restore();
  });
  for (const c of ALL) {
    chamberPath(ctx, c);
    const ruin = buried(lv, c);
    const g = ctx.createLinearGradient(0, c.cy - c.ry, 0, floorY(c) + 6);
    g.addColorStop(0, ruin ? '#1e1008' : '#93603a');
    g.addColorStop(0.6, ruin ? '#2e1a0c' : '#bd8752');
    g.addColorStop(1, ruin ? '#3a2213' : '#d4a068');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

/** Утоптанный пол и тень под сводом внутри камеры. */
function chamberInner(ctx: Ctx, c: Chamber, lit: boolean): void {
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  const fl = floorY(c);
  const floorLine = (): void => {
    ctx.moveTo(c.cx - c.rx - 10, fl - 8);
    ctx.bezierCurveTo(c.cx - c.rx * 0.3, fl - 13, c.cx + c.rx * 0.3, fl - 12, c.cx + c.rx + 10, fl - 7);
  };
  ctx.beginPath();
  floorLine();
  ctx.lineTo(c.cx + c.rx + 10, fl + 20);
  ctx.lineTo(c.cx - c.rx - 10, fl + 20);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, fl - 12, 0, fl + 6);
  fg.addColorStop(0, lit ? '#e6be88' : '#4c2f18');
  fg.addColorStop(1, lit ? '#b98450' : '#33200f');
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.beginPath();
  floorLine();
  ctx.strokeStyle = lit ? 'rgba(255,240,200,0.5)' : 'rgba(255,225,170,0.12)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  chamberPath(ctx, c);
  ctx.strokeStyle = lit ? 'rgba(60,30,10,0.35)' : 'rgba(15,7,2,0.45)';
  ctx.lineWidth = 22;
  ctx.stroke();
  ctx.restore();
}

/**
 * Угловатый обломок с гранями: острые углы, светлая верхняя грань и тёмная боковая, ребро между
 * ними. top — цвет верхней грани (у осколков свода — светлая утоптанная кромка потолка).
 */
function chunk(ctx: Ctx, x: number, y: number, r: number, rot: number, rng: Rng, L: Soil, squash = 0.8, top: string = L.hi, faint = false): void {
  const n = rng.int(5, 7);
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU + rng.range(-0.22, 0.22);
    const rr = r * rng.range(0.74, 1.08);
    pts.push([x + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr * squash]);
  }
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
  };
  path();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, L.base);
  g.addColorStop(1, L.lo);
  if (faint) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  stroked(ctx, g, r > 12 ? 2.2 : 1.6);
  // Верхняя грань: всё, что выше ребра, светлее.
  const rx0 = x - r * rng.range(0.9, 1.2);
  const rx1 = x + r * rng.range(0.9, 1.2);
  const ry0 = y + r * squash * rng.range(-0.1, 0.25);
  const ry1 = y + r * squash * rng.range(-0.25, 0.1);
  const mx = x + r * rng.range(-0.3, 0.3);
  const my = y + r * squash * rng.range(0.05, 0.3);
  ctx.save();
  path();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(rx0, ry0);
  ctx.lineTo(mx, my);
  ctx.lineTo(rx1, ry1);
  ctx.lineTo(rx1, y - r * 2);
  ctx.lineTo(rx0, y - r * 2);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(rx0, ry0);
  ctx.lineTo(mx, my);
  ctx.lineTo(rx1, ry1);
  ctx.strokeStyle = 'rgba(40,20,8,0.55)';
  ctx.lineWidth = r > 12 ? 1.6 : 1.1;
  ctx.stroke();
  for (let i = 0; i < Math.round(r / 2.5); i++) {
    ctx.fillStyle = rng.next() < 0.5 ? L.speck[1] : 'rgba(255,230,190,0.35)';
    ell(ctx, x + rng.range(-r * 0.8, r * 0.8), y + rng.range(-r * 0.5, r * 0.6) * squash, rng.range(0.7, 1.6), rng.range(0.6, 1.3));
    ctx.fill();
  }
  ctx.restore();
}

/** Загородка из двух скрещённых веточек с перекладиной и красным флажком-листом: «закрыто». */
function barrier(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  const stick = (x1: number, y1: number, x2: number, y2: number, w: number): void => {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = w + 2.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = PAL.twig;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1 - 0.8, y1 - 0.8); ctx.lineTo(x2 - 0.8, y2 - 0.8); ctx.stroke();
  };
  stick(-18, 0, 14, -34, 4);
  stick(18, 0, -14, -34, 4);
  stick(-24, -20, 24, -22, 3.4);
  // Обвязка травинкой на перекрестье.
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -21); ctx.lineTo(4, -15);
  ctx.moveTo(4, -21); ctx.lineTo(-4, -15);
  ctx.stroke();
  // Флажок-лист на верхнем конце.
  ctx.beginPath();
  ctx.moveTo(14, -34);
  ctx.bezierCurveTo(24, -44, 38, -40, 40, -30);
  ctx.bezierCurveTo(32, -26, 22, -27, 14, -34);
  ctx.closePath();
  const g = ctx.createLinearGradient(14, -44, 40, -26);
  g.addColorStop(0, '#f06a4a');
  g.addColorStop(1, '#a3261a');
  stroked(ctx, g, 1.6);
  ctx.strokeStyle = 'rgba(80,10,0,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, -33); ctx.quadraticCurveTo(28, -34, 38, -31); ctx.stroke();
  ctx.restore();
}

/** Лопата: черенок-веточка и ковш из половинки семечки, прислонена к горе. */
function shovel(ctx: Ctx, x: number, y: number, lean: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.6;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -58); ctx.stroke();
  ctx.strokeStyle = PAL.twig;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -60); ctx.lineTo(7, -60);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = PAL.twig;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.bezierCurveTo(-9, -2, -4, 6, 0, 7);
  ctx.bezierCurveTo(4, 6, 9, -2, 8, -12);
  ctx.closePath();
  const g = ctx.createLinearGradient(-8, 0, 8, 0);
  g.addColorStop(0, '#5a524c');
  g.addColorStop(0.5, '#3a3330');
  g.addColorStop(1, '#221d1a');
  stroked(ctx, g, 1.6);
  ctx.strokeStyle = 'rgba(235,228,210,0.8)';
  ctx.lineWidth = 1.4;
  for (const dx of [-3.5, 0, 3.5]) {
    ctx.beginPath(); ctx.moveTo(dx, -10); ctx.lineTo(dx * 0.6, 4); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Завал: свод рухнул и лёг горой почти под потолок. Гора светлее пустоты и вся в комьях; на ней
 * плиты бывшего свода со светлой кромкой и валуны; на своде рваный тёмный шрам, откуда упало,
 * с него свисают оборванные корни; над горой стоит пыль. Перед горой загородка с флажком
 * (и иногда лопата): место ждёт расчистки.
 */
function rubble(ctx: Ctx, c: Chamber, rng: Rng, tools: boolean): void {
  const fill = c.fill ?? 0.8;
  const side = c.side ?? 1;
  const fl = floorY(c);
  const top = c.cy - c.ry;
  const span = 2 * c.rx;
  const k01 = (v: number): number => Math.max(0, Math.min(1, v));
  const u = (x: number): number => (side > 0 ? (x - (c.cx - c.rx)) / span : ((c.cx + c.rx) - x) / span);
  const start = (1 - fill) * 0.9 + 0.1;
  const heap = (x: number): number => {
    const k = k01((u(x) - start) / Math.max(0.2, 1 - start));
    const lump = (Math.sin(x * 0.07 + c.seed) * 5 + Math.sin(x * 0.19 + c.seed * 2) * 3) * k * (1 - k) * 2;
    return fl - Math.pow(k, 0.55) * (fl - top) * 1.04 - lump;
  };
  const ceil = (x: number): number => c.cy - c.ry * 0.97 * Math.sqrt(Math.max(0, 1 - Math.pow((x - c.cx) / c.rx, 2)));
  const footX = side > 0 ? c.cx - c.rx + span * start : c.cx + c.rx - span * start;
  const wallX = side > 0 ? c.cx + c.rx : c.cx - c.rx;
  const along = (f: number): number => footX + (wallX - footX) * f;
  const L = layerAt(c.cx, c.cy);
  const up = LAYERS[Math.max(0, LAYERS.indexOf(L) - 1)];
  const sc = c.rx / 190;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  // Тусклый свет со стороны входа: гора видна, а не тонет в темноте.
  const lg = ctx.createRadialGradient(footX - side * c.rx * 0.35, fl - 30, 4, footX - side * c.rx * 0.2, fl - 30, c.rx * 0.9);
  lg.addColorStop(0, 'rgba(255,200,130,0.22)');
  lg.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(c.cx - c.rx - 10, top - 10, span + 20, c.ry * 2 + 20);
  // Шрам на своде над горой: рваная тёмная кромка, откуда обрушилось.
  ctx.beginPath();
  const sx0 = along(0.25);
  const sx1 = wallX + side * 10;
  ctx.moveTo(sx0, ceil(sx0) - 20);
  for (let i = 0; i <= 14; i++) {
    const x = sx0 + ((sx1 - sx0) * i) / 14;
    ctx.lineTo(x, ceil(x) + 6 + (i % 2 ? 9 : 2) + rng.range(-2, 3));
  }
  ctx.lineTo(sx1, ceil(sx1) - 20);
  ctx.closePath();
  ctx.fillStyle = 'rgba(18,9,3,0.75)';
  ctx.fill();
  // Гора — плотная груда угловатых обломков с тёмными щелями между ними.
  const heapPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(c.cx - c.rx - 6, fl + 12);
    for (let x = c.cx - c.rx - 6; x <= c.cx + c.rx + 6; x += 5) ctx.lineTo(x, heap(x));
    ctx.lineTo(c.cx + c.rx + 6, fl + 12);
    ctx.closePath();
  };
  heapPath();
  ctx.fillStyle = '#2b190d';
  ctx.fill();
  const rock = (t: Tone): Soil => ({ ...t, speck: [t.hi, t.lo] });
  const tones: Soil[] = [up, up, up, L, L, rock(GREY), rock(WARM)];
  const pieces: [number, number, number][] = [];
  const cell = 19 * sc;
  for (let y = fl + 4; y > top - cell; y -= cell * 0.78) {
    for (let x = Math.min(footX, wallX) - cell; x < Math.max(footX, wallX) + cell; x += cell * rng.range(0.8, 1.05)) {
      const px = x + rng.range(-cell * 0.3, cell * 0.3);
      const py = y + rng.range(-cell * 0.25, cell * 0.25);
      if (py < heap(px) + 3) continue;
      const big = rng.next();
      const r = (big < 0.14 ? rng.range(16, 23) : big < 0.78 ? rng.range(9.5, 13.5) : rng.range(5.5, 8.5)) * sc;
      pieces.push([px, py, r]);
    }
  }
  // Сверху вниз: нижние обломки лежат поверх верхних, груда читается объёмной.
  pieces.sort((p, q) => p[1] - q[1]);
  for (const [px, py, r] of pieces) chunk(ctx, px, py, r, rng.range(0, TAU), rng, rng.pick(tones), rng.range(0.6, 0.85));
  // Тень к стене: дальше от входа темнее.
  ctx.save();
  heapPath();
  ctx.clip();
  const sg = ctx.createLinearGradient(footX, 0, wallX, 0);
  sg.addColorStop(0, 'rgba(255,225,180,0.06)');
  sg.addColorStop(1, 'rgba(10,5,2,0.4)');
  ctx.fillStyle = sg;
  ctx.fillRect(c.cx - c.rx - 10, top - 10, span + 20, c.ry * 2 + 20);
  ctx.restore();
  // Осколки свода со светлой гранью и валуны на склоне.
  const slope = (x: number): number => Math.atan2(heap(x + 12) - heap(x - 12), 24);
  for (const f of [0.3, 0.62]) {
    const x = along(f) + rng.range(-10, 10);
    const r = rng.range(24, 30) * sc;
    chunk(ctx, x, heap(x) + r * 0.3, r, slope(x) + rng.range(-0.3, 0.3), rng, up, 0.62, RIM);
  }
  for (const f of [0.46, 0.8]) {
    const x = along(f) + rng.range(-12, 12);
    stone(ctx, x, heap(x) + 4, rng.range(13, 18) * sc, rng, rng.pick([GREY, WARM, SLATE]), 2.2);
  }
  // Оборванные корни торчат из горы.
  for (const f of [0.36, 0.66]) {
    const x = along(f) + rng.range(-8, 8);
    brokenRoot(ctx, x, heap(x) + 12, side > 0 ? rng.range(-2.5, -2.0) : rng.range(-1.1, -0.6), rng.range(26, 38) * sc, rng.range(7, 10), rng);
  }
  // Осыпь у подножия.
  for (let i = 0; i < 12; i++) {
    const x = footX - side * rng.range(-10, 70);
    if (rng.next() < 0.3) stone(ctx, x, fl - rng.range(2, 6), rng.range(3, 6), rng, rng.pick([GREY, WARM]), 1.3);
    else chunk(ctx, x, fl - rng.range(3, 7), rng.range(4, 8), rng.range(0, TAU), rng, rng.next() < 0.5 ? up : L);
  }
  // С шрама свисают оборванные корешки.
  for (const f of [0.45, 0.75]) {
    const x = along(f);
    brokenRoot(ctx, x, ceil(x) - 2, Math.PI / 2 + rng.range(-0.3, 0.3), rng.range(18, 28), rng.range(5, 7), rng);
  }
  // Пыль над горой.
  const dx = along(0.45);
  const dg = ctx.createRadialGradient(dx, heap(dx) - 10, 4, dx, heap(dx) - 10, c.rx * 0.6);
  dg.addColorStop(0, 'rgba(230,200,150,0.22)');
  dg.addColorStop(1, 'rgba(230,200,150,0)');
  ctx.fillStyle = dg;
  ctx.fillRect(c.cx - c.rx, top - 10, span, c.ry * 2);
  // Пустота под сводом темнеет кверху.
  const vg = ctx.createLinearGradient(0, top, 0, fl);
  vg.addColorStop(0, 'rgba(10,5,2,0.35)');
  vg.addColorStop(0.5, 'rgba(10,5,2,0)');
  ctx.fillStyle = vg;
  ctx.fillRect(c.cx - c.rx - 10, top - 10, span + 20, c.ry);
  // Загородка с флажком и лопата у подножия.
  barrier(ctx, footX - side * 46 * sc, fl - 5, 0.95 * Math.min(1.1, sc + 0.1));
  if (tools) shovel(ctx, footX + side * 8, fl - 4, -side * 0.42);
  ctx.restore();
  // Трещины от шрама в толщу земли.
  for (const f of [0.35, 0.6, 0.85]) {
    let x = along(f);
    let y = ceil(x) - 2;
    const a = -Math.PI / 2 + side * rng.range(0.1, 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0, segs = rng.int(3, 5); k < segs; k++) {
      x += Math.cos(a) * rng.range(6, 12) + rng.range(-5, 5);
      y += Math.sin(a) * rng.range(6, 12) + rng.range(-3, 3);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(25,12,4,0.7)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}

/** Забой: конец хода, где строители роют дальше, — свежая тёмная земля и россыпь комьев. */
function frontier(ctx: Ctx, rng: Rng): void {
  const s = SAMPLES[16];
  const end = s[s.length - 1];
  const g = ctx.createRadialGradient(end.x + 8, end.y, 2, end.x, end.y, 40);
  g.addColorStop(0, 'rgba(40,20,8,0.55)');
  g.addColorStop(1, 'rgba(40,20,8,0)');
  ctx.fillStyle = g;
  ctx.fillRect(end.x - 40, end.y - 40, 80, 80);
  for (let i = 0; i < 10; i++) clod(ctx, end.x - rng.range(10, 70), end.y + 14 - rng.range(0, 6), rng.range(3, 6), rng, LAYERS[2]);
}

// ───────────────────────── убранство камер ─────────────────────────

/** x по доле ширины камеры: −1 — левая стена, 1 — правая. */
const at = (c: Chamber, f: number): number => c.cx + f * c.rx;

function hangRoot(ctx: Ctx, c: Chamber, f: number, len: number, rng: Rng): void {
  const x = at(c, f);
  const y = c.cy - c.ry * 0.98;
  root(ctx, [[x, y - 6], [x + rng.range(-4, 4), y + len * 0.5], [x + rng.range(-3, 3), y + len]], 7, 1.6, rng, { branch: 0, hairs: false });
}

function nurseryDecor(ctx: Ctx, rng: Rng): void {
  const c = NURSERY;
  const fl = floorY(c) - 7;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  hangRoot(ctx, c, -0.6, 22, rng);
  hangRoot(ctx, c, 0.55, 26, rng);
  hangRoot(ctx, c, 0.1, 28, rng);
  const b0 = at(c, -0.3);
  const b1 = at(c, 0.55);
  ctx.beginPath();
  ctx.moveTo(b0, fl + 6);
  ctx.bezierCurveTo(b0 + 10, fl - 15, b1 - 10, fl - 16, b1, fl + 6);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, fl - 16, 0, fl + 6);
  bg.addColorStop(0, '#d9c27f');
  bg.addColorStop(1, '#8f7440');
  stroked(ctx, bg, 2);
  for (let i = 0; i < 100; i++) {
    const x = rng.range(b0 + 4, b1 - 4);
    const y = rng.range(fl - 12, fl + 4);
    const a = rng.range(-0.5, 0.5);
    const len = rng.range(8, 20);
    ctx.strokeStyle = rng.pick(['#e8d79c', '#c4ab64', '#a6a95a', '#f2e6b8', '#9a7c42']);
    ctx.lineWidth = rng.range(1, 2.1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 2, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const ex = at(c, -0.62);
  leafTray(ctx, ex + 8, fl + 3, 74, -0.04);
  for (const [n, dx, dy] of [[5, -24, -4], [4, -19, -12], [3, -13, -20], [1, -6, -27]] as const) {
    for (let i = 0; i < n; i++) egg(ctx, ex + dx + i * 10 + rng.range(-2, 2), fl + dy + rng.range(-1.5, 1.5), rng.range(5, 5.8), rng.range(-0.7, 0.7));
  }
  acornBowl(ctx, at(c, -0.38), fl + 1, 1.1);
  cocoon(ctx, at(c, 0.66), fl - 13, 0.12, 1.1, 1);
  cocoon(ctx, at(c, 0.75), fl - 26, -0.4, 1.05, 2);
  cocoon(ctx, at(c, 0.72), fl - 2, 1.45, 1.05, 3);
  for (const [x, h, r] of [[at(c, -0.84), 26, 11], [at(c, -0.94), 14, 6.5], [at(c, -0.76), 16, 8]] as const) glowShroom(ctx, x, fl + 3, h, r);
  honeyLamp(ctx, at(c, 0.1), c.cy - c.ry * 0.98 + 34);
  ctx.restore();
}

function solarDecor(ctx: Ctx): void {
  const c = SOLAR;
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  // Куколки греются под макушкой купола: лежат и стоят вразнобой.
  const spots: [number, number, number][] = [
    [-0.72, 1.5, 0], [-0.55, 1.35, 0], [-0.38, 0.1, -12], [-0.22, 1.6, 0], [-0.05, -0.15, -12],
    [0.3, 1.4, 0], [0.47, 0.2, -12], [0.62, 1.55, 0], [0.78, -0.3, -11],
  ];
  spots.forEach(([f, rot, dy], i) => cocoon(ctx, at(c, f), fl - 4 + dy, rot, 0.95, i));
  ctx.restore();
}

function labDecor(ctx: Ctx, rng: Rng): void {
  const c = LAB;
  const fl = floorY(c) - 7;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  // Доска из коры для коллекции (жук приколот поверх, рисуется каждый кадр).
  const bx = at(c, -0.62);
  const by = c.cy - 26;
  ctx.beginPath();
  ctx.rect(bx - 30, by - 22, 60, 44);
  const bg = ctx.createLinearGradient(bx - 30, by - 22, bx + 30, by + 22);
  bg.addColorStop(0, '#a87a4a');
  bg.addColorStop(1, '#5e3c1e');
  stroked(ctx, bg, 2);
  ctx.strokeStyle = 'rgba(40,20,8,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(bx - 28, by - 18 + i * 9 + rng.range(-1, 1));
    ctx.lineTo(bx + 28, by - 16 + i * 9 + rng.range(-1, 1));
    ctx.stroke();
  }
  // Сланцевая доска с мелом: башня, стрелка и столбики «формул».
  const sx = at(c, 0.1);
  const sy = c.cy - 30;
  ctx.beginPath();
  ctx.moveTo(sx - 44, sy - 22);
  ctx.lineTo(sx + 42, sy - 25);
  ctx.lineTo(sx + 46, sy + 21);
  ctx.lineTo(sx - 46, sy + 24);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, sy - 25, 0, sy + 24);
  sg.addColorStop(0, '#5a6066');
  sg.addColorStop(1, '#33383c');
  stroked(ctx, sg, 2.2);
  ctx.strokeStyle = 'rgba(245,245,235,0.85)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - 34, sy + 14); ctx.lineTo(sx - 30, sy - 8); ctx.lineTo(sx - 20, sy - 8); ctx.lineTo(sx - 16, sy + 14);
  ctx.moveTo(sx - 36, sy - 8); ctx.lineTo(sx - 14, sy - 8);
  ctx.moveTo(sx - 25, sy - 8); ctx.lineTo(sx - 25, sy - 16);
  ctx.moveTo(sx - 8, sy + 2); ctx.quadraticCurveTo(sx + 4, sy - 10, sx + 14, sy - 2);
  ctx.moveTo(sx + 10, sy - 6); ctx.lineTo(sx + 14, sy - 2); ctx.lineTo(sx + 9, sy + 1);
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(sx + 20, sy - 14 + i * 9);
    ctx.lineTo(sx + 36 - i * 3, sy - 15 + i * 9);
  }
  ctx.stroke();
  // Стол: каменная плита на двух голышах.
  const tx0 = at(c, -0.42);
  const tx1 = at(c, 0.28);
  const ty = fl - 28;
  stone(ctx, tx0 + 16, fl - 12, 13, rng, GREY, 1.8);
  stone(ctx, tx1 - 16, fl - 12, 13, rng, GREY, 1.8);
  ctx.beginPath();
  ctx.moveTo(tx0 - 6, ty);
  ctx.lineTo(tx1 + 6, ty - 2);
  ctx.lineTo(tx1 + 2, ty + 9);
  ctx.lineTo(tx0 - 2, ty + 10);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, ty - 2, 0, ty + 10);
  tg.addColorStop(0, '#b9b2a6');
  tg.addColorStop(1, '#6e685e');
  stroked(ctx, tg, 2);
  // Полка с банками у правой стены.
  const shx = at(c, 0.62);
  const shy = c.cy - 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(shx - 34, shy); ctx.lineTo(shx + 34, shy - 2); ctx.stroke();
  ctx.strokeStyle = PAL.twig;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  flask(ctx, shx - 20, shy - 11, 8, 'rgba(240,190,60,0.9)', 0.6, 0.5);
  flask(ctx, shx + 2, shy - 12, 9, 'rgba(120,200,90,0.85)', 0.45, 0.5);
  flask(ctx, shx + 22, shy - 10, 7, 'rgba(200,140,230,0.85)', 0.7, 0.5);
  honeyLamp(ctx, at(c, -0.1), c.cy - c.ry * 0.98 + 24, 6);
  ctx.restore();
}

/** Кладовая: горка зерна — пшеничные зёрна, семечки, просо. */
function granaryDecor(ctx: Ctx, rng: Rng): void {
  const c = GRANARY;
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  const hx0 = at(c, -0.42);
  const hx1 = at(c, 0.82);
  const peak = at(c, 0.25);
  const heapY = (x: number): number => fl - 62 * Math.pow(Math.max(0, 1 - Math.pow((x - peak) / ((hx1 - hx0) / 2), 2)), 0.8);
  ctx.beginPath();
  ctx.moveTo(hx0, fl + 4);
  for (let x = hx0; x <= hx1; x += 6) ctx.lineTo(x, heapY(x) + 6);
  ctx.lineTo(hx1, fl + 4);
  ctx.closePath();
  ctx.fillStyle = '#b5833a';
  ctx.fill();
  for (let i = 0; i < 260; i++) {
    const x = rng.range(hx0 + 6, hx1 - 6);
    const top = heapY(x);
    if (top > fl - 2) continue;
    const k = rng.next();
    grain(ctx, x, rng.range(top, fl), rng.range(4.2, 6.2), rng.range(0, TAU), k < 0.6 ? 0 : k < 0.82 ? 1 : 2);
  }
  for (let i = 0; i < 16; i++) grain(ctx, rng.range(at(c, -0.8), hx0), fl - rng.range(0, 3), rng.range(4, 5.5), rng.range(0, TAU), rng.int(0, 2));
  honeyLamp(ctx, at(c, -0.2), c.cy - c.ry * 0.98 + 28, 6.5);
  hangRoot(ctx, c, 0.6, 30, rng);
  ctx.restore();
}

/** Грибной сад: губчатая грибница на подстилке из листьев, по углам грибы-светляки. */
function fungusDecor(ctx: Ctx, rng: Rng): void {
  const c = FUNGUS;
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  const gx0 = at(c, -0.45);
  const gx1 = at(c, 0.4);
  for (let i = 0; i < 30; i++) leafBit(ctx, rng.range(gx0 - 10, gx1 + 10), fl - rng.range(0, 8), rng.range(7, 11), rng.range(0, TAU), rng.next() < 0.3 ? 1 : 0);
  for (let i = 0; i < 140; i++) {
    const x = rng.range(gx0, gx1);
    const u = (x - (gx0 + gx1) / 2) / ((gx1 - gx0) / 2);
    const top = fl - 58 * Math.sqrt(Math.max(0, 1 - u * u));
    const y = rng.range(top + 6, fl - 4);
    const r = rng.range(7, 13);
    ell(ctx, x, y, r, r * 0.85);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.5, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#e4ddcf');
    g.addColorStop(1, '#b2a690');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,50,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ell(ctx, rng.range(gx0 + 6, gx1 - 6), rng.range(fl - 54, fl - 10), 1.3, 1.3);
    ctx.fill();
  }
  for (const [f, h, r] of [[-0.86, 24, 10], [-0.76, 14, 7], [0.82, 22, 9.5], [0.9, 13, 6]] as const) glowShroom(ctx, at(c, f), fl + 3, h, r);
  hangRoot(ctx, c, -0.3, 24, rng);
  hangRoot(ctx, c, 0.45, 20, rng);
  ctx.restore();
}

/** Ангар: пол из плоских камней, кран из веточек, запасное крыло на стене, ящик, фонари, рама люка. */
function hangarDecor(ctx: Ctx, rng: Rng): void {
  const c = HANGAR;
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  for (let x = at(c, -0.7); x < at(c, 0.75); x += rng.range(34, 46)) {
    ctx.beginPath();
    ctx.moveTo(x, fl - 2);
    ctx.lineTo(x + 34, fl - 3);
    ctx.lineTo(x + 32, fl + 5);
    ctx.lineTo(x + 2, fl + 6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, fl - 3, 0, fl + 6);
    g.addColorStop(0, '#c9c2b4');
    g.addColorStop(1, '#7c766a');
    stroked(ctx, g, 1.6);
  }
  // Запасное крыло висит на стене на двух колышках.
  ctx.save();
  ctx.translate(at(c, -0.86), c.cy - 34);
  ctx.rotate(-0.12);
  wing(ctx, 120, 20, 1.3);
  ctx.restore();
  for (const dx of [30, 92]) {
    ell(ctx, at(c, -0.86) + dx, c.cy - 40 - dx * 0.12, 2.8, 2.8);
    stroked(ctx, PAL.twig, 1.2);
  }
  const kx = at(c, 0.68);
  const ky = c.cy - 52;
  ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2, w] of [[kx - 30, fl, kx - 18, ky, 5], [kx + 30, fl, kx + 18, ky, 5], [kx - 26, ky, kx + 26, ky, 4.4], [kx - 26, fl - 30, kx + 14, ky + 6, 2.6]] as const) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = w + 2.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = PAL.twig;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  const bx = MECH_X;
  ctx.beginPath();
  ctx.rect(bx - 18, fl - 22, 36, 22);
  const bg = ctx.createLinearGradient(bx - 18, 0, bx + 18, 0);
  bg.addColorStop(0, '#b07a46');
  bg.addColorStop(1, '#6a4422');
  stroked(ctx, bg, 1.8);
  for (const dx of [-8, 6]) {
    ctx.beginPath();
    ctx.arc(bx + dx, fl - 22, 9, Math.PI * 1.1, Math.PI * 1.9);
    stroked(ctx, '#9a6a36', 1.4);
  }
  honeyLamp(ctx, at(c, -0.3), c.cy - c.ry * 0.95 + 26, 6.5);
  honeyLamp(ctx, at(c, 0.42), c.cy - c.ry * 0.95 + 30, 6.5);
  ctx.restore();
  for (const x of [1878, 2042]) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x, surf(x) - 2); ctx.lineTo(x, surf(x) + 30); ctx.stroke();
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 5.6;
    ctx.stroke();
  }
}

// ───────────────────────── отстройка: камеры за зерно ─────────────────────────

/** Камеры, которые отстраиваются за зерно; мастерская и тропа фуражиров лежат под первыми двумя завалами. */
const ROOM_CH: Record<RoomId, Chamber> = {
  solar: SOLAR, nursery: NURSERY, lab: LAB, granary: GRANARY, fungus: FUNGUS, hangar: HANGAR, workshop: RUINS[0], forage: RUINS[1],
};
const ROOM_IDS = Object.keys(ROOM_CH) as RoomId[];
/** Где висит табличка камеры: доля ширины от середины. */
const PLAQUE_F: Record<RoomId, number> = { solar: 0.62, nursery: -0.32, lab: 0.55, granary: 0.4, fungus: 0.55, hangar: -0.42, workshop: 0, forage: -0.42 };

/** Уровни камер: 0 — камера пустует или ещё под завалом. */
export type RoomLevels = Record<RoomId, number>;

/** Камера ещё под завалом: оба глубоких завала всегда, мастерская и тропа — до расчистки. */
function buried(lv: RoomLevels, c: Chamber): boolean {
  if (c === RUINS[0]) return lv.workshop <= 0;
  if (c === RUINS[1]) return lv.forage <= 0;
  return c.kind === 'ruin';
}

/** Какая камера под точкой мира: тап по разрезу. Глубокие завалы не выбираются. */
export function roomAt(x: number, y: number): RoomId | null {
  for (const id of ROOM_IDS) {
    const c = ROOM_CH[id];
    const dx = (x - c.cx) / (c.rx + 16);
    const dy = (y - c.cy) / (c.ry + 16);
    if (dx * dx + dy * dy <= 1) return id;
  }
  return null;
}

/** Паутина в углу: лучи из точки у стены и провисшие нити между ними. dir — куда раскрывается. */
function web(ctx: Ctx, x: number, y: number, r: number, dir: 1 | -1): void {
  const spokes = [0.05, 0.42, 0.8, 1.18, 1.5].map((a) => (dir > 0 ? a : Math.PI - a));
  ctx.strokeStyle = 'rgba(235,225,205,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const a of spokes) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  for (const k of [0.34, 0.6, 0.86]) {
    for (let i = 0; i + 1 < spokes.length; i++) {
      const a = spokes[i];
      const b = spokes[i + 1];
      const m = (a + b) / 2;
      ctx.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
      ctx.quadraticCurveTo(x + Math.cos(m) * r * k * 0.8, y + Math.sin(m) * r * k * 0.8 + 2, x + Math.cos(b) * r * k, y + Math.sin(b) * r * k);
    }
  }
  ctx.stroke();
}

/** Камера пустует: свет погашен, со свода осыпались комья, в углах паутина. Отстройка её зажигает. */
function abandoned(ctx: Ctx, c: Chamber): void {
  const rng = new Rng(c.seed * 7 + 3);
  const fl = floorY(c);
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  const g = ctx.createLinearGradient(0, c.cy - c.ry, 0, fl);
  g.addColorStop(0, 'rgba(12,6,2,0.8)');
  g.addColorStop(1, 'rgba(12,6,2,0.58)');
  ctx.fillStyle = g;
  ctx.fillRect(c.cx - c.rx - 10, c.cy - c.ry - 10, c.rx * 2 + 20, c.ry * 2 + 30);
  const L = layerAt(c.cx, c.cy);
  for (let i = 0; i < 9; i++) clod(ctx, c.cx + rng.range(-0.8, 0.8) * c.rx, fl - rng.range(4, 9), rng.range(4, 9), rng, L);
  web(ctx, c.cx - c.rx * 0.9, c.cy - c.ry * 0.62, c.ry * 0.62, 1);
  web(ctx, c.cx + c.rx * 0.92, c.cy - c.ry * 0.5, c.ry * 0.45, -1);
  ctx.restore();
}

/** Доска из коры на стене: на ней мелом или углём рисуют, что нужно камере. */
function barkBoard(ctx: Ctx, x: number, y: number, w: number, h: number, rng: Rng): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2 + 2);
  ctx.lineTo(x + w / 2 - 2, y - h / 2);
  ctx.lineTo(x + w / 2, y + h / 2 - 1);
  ctx.lineTo(x - w / 2 + 2, y + h / 2);
  ctx.closePath();
  const bg = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  bg.addColorStop(0, '#b4875a');
  bg.addColorStop(1, '#6a4524');
  stroked(ctx, bg, 2);
  ctx.strokeStyle = 'rgba(40,20,8,0.3)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 3, y - h / 2 + (i * h) / 5 + rng.range(-1, 1));
    ctx.lineTo(x + w / 2 - 3, y - h / 2 + (i * h) / 5 + rng.range(-1, 1));
    ctx.stroke();
  }
}

/** Жёлудь: снаряд потяжелее семечки. */
function acorn(ctx: Ctx, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ell(ctx, 0, r * 0.25, r * 0.78, r);
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, '#e2a656');
  g.addColorStop(0.5, '#b8742e');
  g.addColorStop(1, '#6e3e16');
  stroked(ctx, g, 1.6);
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, -r * 0.18);
  ctx.bezierCurveTo(-r * 0.9, -r * 0.95, r * 0.9, -r * 0.95, r * 0.86, -r * 0.18);
  ctx.closePath();
  stroked(ctx, '#7a5634', 1.6);
  ctx.strokeStyle = 'rgba(40,24,10,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const k of [-0.5, 0, 0.5]) {
    ctx.moveTo(-r * 0.7 + k * r * 0.4, -r * 0.25);
    ctx.lineTo(k * r * 0.4 + r * 0.1, -r * 0.75);
  }
  ctx.stroke();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  ctx.lineTo(r * 0.12, -r * 1.05);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ell(ctx, -r * 0.3, r * 0.1, r * 0.16, r * 0.4, 0.2);
  ctx.fill();
  ctx.restore();
}

/** Палка из веточки с тёмным контуром: рама катапульты, верстак. */
function stick(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 2.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = PAL.twig;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Спил веточки: колесо катапульты с годовыми кольцами. */
function woodDisc(ctx: Ctx, x: number, y: number, r: number): void {
  ell(ctx, x, y, r, r);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r);
  g.addColorStop(0, '#e8c48c');
  g.addColorStop(1, '#a8743e');
  stroked(ctx, g, 1.8);
  ctx.strokeStyle = 'rgba(110,64,26,0.6)';
  ctx.lineWidth = 0.9;
  for (const k of [0.35, 0.65]) {
    ell(ctx, x, y, r * k, r * k);
    ctx.stroke();
  }
}

const WORKSHOP = RUINS[0];
const FORAGE = RUINS[1];
/** Катапульта в мастерской: середина рамы и ось рычага. */
const CAT_X = 712;
const CAT_PIVOT: P = [CAT_X + 4, floorY(RUINS[0]) - 52];

/** Мастерская метателей: катапульта на испытаниях, горка снарядов, доска с дугой полёта, остатки завала. */
function workshopDecor(ctx: Ctx): void {
  const c = WORKSHOP;
  const rng = new Rng(91);
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  // Остатки завала у дальней стены.
  stone(ctx, at(c, -0.88), fl - 12, 18, rng, GREY, 2.2);
  stone(ctx, at(c, -0.74), fl - 6, 10, rng, WARM, 1.8);
  for (let i = 0; i < 6; i++) clod(ctx, at(c, -0.8) + rng.range(-20, 40), fl - rng.range(2, 6), rng.range(3, 6), rng, layerAt(c.cx, c.cy));
  // Доска с мелом над снарядами: катапульта, дуга полёта и мишень.
  const bx = at(c, 0.62);
  const by = c.cy - 22;
  barkBoard(ctx, bx, by, 96, 46, rng);
  ctx.strokeStyle = 'rgba(250,245,230,0.9)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx - 40, by + 14); ctx.lineTo(bx - 26, by + 14);
  ctx.moveTo(bx - 33, by + 14); ctx.lineTo(bx - 30, by + 4); ctx.lineTo(bx - 37, by - 2);
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(bx - 36, by - 4);
  ctx.quadraticCurveTo(bx - 2, by - 34, bx + 30, by + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const r of [9, 5.5, 2]) {
    ctx.beginPath();
    ctx.arc(bx + 32, by + 9, r, 0, TAU);
    ctx.stroke();
  }
  // Снаряды у правой стены: семечки и жёлуди горкой.
  const px = at(c, 0.62);
  for (let i = 0; i < 46; i++) {
    const u = rng.range(-1, 1);
    const h = 30 * Math.sqrt(Math.max(0, 1 - u * u));
    grain(ctx, px + u * 46, fl - rng.range(0, h), rng.range(5, 6.5), rng.range(0, TAU), 1);
  }
  for (const [dx, dy, rot] of [[-30, -6, -0.3], [-12, -24, 0.4], [10, -12, -0.1], [30, -4, 0.5], [-44, -2, 0.2]] as const) acorn(ctx, px + dx, fl + dy - 6, 8, rot);
  // Верстак: чурбак с молотком и веточками.
  const wx = at(c, 0.3);
  ell(ctx, wx, fl - 10, 20, 11);
  const wg = ctx.createLinearGradient(0, fl - 21, 0, fl);
  wg.addColorStop(0, '#c08a58');
  wg.addColorStop(1, '#6a4422');
  stroked(ctx, wg, 1.8);
  ell(ctx, wx, fl - 18, 18, 4.5);
  stroked(ctx, '#e0b884', 1.4);
  stick(ctx, wx - 14, fl - 22, wx + 4, fl - 26, 2.2);
  // Рама катапульты; рычаг качается и рисуется отдельно.
  const fy = fl - 4;
  stick(ctx, CAT_X - 44, fy - 10, CAT_X + 44, fy - 10, 5);
  woodDisc(ctx, CAT_X - 30, fy - 6, 10);
  woodDisc(ctx, CAT_X + 30, fy - 6, 10);
  stick(ctx, CAT_X - 16, fy - 12, CAT_PIVOT[0], CAT_PIVOT[1], 4);
  stick(ctx, CAT_X + 24, fy - 12, CAT_PIVOT[0], CAT_PIVOT[1], 4);
  stick(ctx, CAT_X + 18, fy - 44, CAT_X + 34, fy - 56, 3.4);
  honeyLamp(ctx, at(c, -0.55), c.cy - c.ry * 0.98 + 26, 6.5);
  hangRoot(ctx, c, 0.3, 22, rng);
  ctx.restore();
}

/** Тропа фуражиров: сюда сносят добычу — карта троп на коре, подносы-листья с семенами, мёд, свёрток. */
function forageDecor(ctx: Ctx): void {
  const c = FORAGE;
  const rng = new Rng(97);
  const fl = floorY(c) - 6;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  stone(ctx, at(c, 0.9), fl - 12, 17, rng, SLATE, 2.2);
  stone(ctx, at(c, 0.78), fl - 6, 9, rng, WARM, 1.8);
  // Карта троп: от муравейника извилистая тропа к крестику, по пути листья.
  const bx = at(c, 0.1);
  const by = c.cy - 26;
  barkBoard(ctx, bx, by, 108, 48, rng);
  ctx.strokeStyle = 'rgba(40,20,8,0.85)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(bx - 40, by + 12);
  ctx.bezierCurveTo(bx - 20, by - 18, bx + 0, by + 22, bx + 18, by - 2);
  ctx.quadraticCurveTo(bx + 28, by - 14, bx + 38, by - 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(bx - 46, by + 16); ctx.lineTo(bx - 40, by + 7); ctx.lineTo(bx - 34, by + 16); ctx.closePath();
  stroked(ctx, '#8a5a30', 1.2);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(bx + 34, by - 13); ctx.lineTo(bx + 42, by - 4);
  ctx.moveTo(bx + 42, by - 13); ctx.lineTo(bx + 34, by - 4);
  ctx.stroke();
  leafBit(ctx, bx - 14, by - 10, 5, 0.6);
  leafBit(ctx, bx + 6, by + 14, 4.5, -0.4);
  // Подносы с добычей.
  const t0 = at(c, -0.42);
  leafTray(ctx, t0, fl + 2, 76, -0.03);
  for (let i = 0; i < 14; i++) grain(ctx, t0 + rng.range(-26, 26), fl - 4 - rng.range(0, 6), rng.range(4.2, 5.4), rng.range(0, TAU), rng.int(0, 2));
  const t1 = at(c, 0.42);
  leafTray(ctx, t1, fl + 2, 64, 0.04);
  for (let i = 0; i < 6; i++) leafBit(ctx, t1 + rng.range(-20, 20), fl - 5 - rng.range(0, 6), rng.range(7, 10), rng.range(0, TAU), rng.next() < 0.4 ? 1 : 0);
  acornBowl(ctx, at(c, 0.66), fl + 1, 1.1);
  // Свёрток из листа, перевязанный травинкой.
  const sx = at(c, 0.14);
  ctx.save();
  ctx.translate(sx, fl - 10);
  ctx.rotate(-0.08);
  ell(ctx, 0, 0, 20, 11);
  const sg = ctx.createLinearGradient(0, -11, 0, 11);
  sg.addColorStop(0, PAL.leafLight);
  sg.addColorStop(1, PAL.leafDark);
  stroked(ctx, sg, 2);
  ctx.strokeStyle = '#d8c27a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -11); ctx.quadraticCurveTo(-7, 0, -4, 11);
  ctx.moveTo(6, -10.5); ctx.quadraticCurveTo(3, 0, 6, 10.5);
  ctx.stroke();
  ctx.restore();
  honeyLamp(ctx, at(c, -0.1), c.cy - c.ry * 0.98 + 26, 6.5);
  hangRoot(ctx, c, -0.62, 20, rng);
  ctx.restore();
}

/** Печёт весь мир разреза (в координатах мира) с камерами на их нынешних уровнях. */
export function bakeColony(ctx: Ctx, lv: RoomLevels): void {
  const rng = new Rng(4242);
  sky(ctx);
  soil(ctx, rng);
  stones(ctx, rng);
  roots(ctx, rng);
  tree(ctx, rng);
  mound(ctx, rng);
  turf(ctx, rng);
  carve(ctx, lv);
  for (const c of ALL) chamberInner(ctx, c, !buried(lv, c));
  RUINS.forEach((c, i) => {
    if (buried(lv, c)) rubble(ctx, c, new Rng(c.seed), i % 2 === 0);
  });
  frontier(ctx, rng);
  nurseryDecor(ctx, rng);
  solarDecor(ctx);
  labDecor(ctx, rng);
  granaryDecor(ctx, rng);
  fungusDecor(ctx, rng);
  hangarDecor(ctx, rng);
  if (lv.workshop > 0) workshopDecor(ctx);
  if (lv.forage > 0) forageDecor(ctx);
  for (const id of ROOM_IDS) if (lv[id] <= 0 && ROOM_CH[id].kind !== 'ruin') abandoned(ctx, ROOM_CH[id]);
}

// ───────────────────────── живое ─────────────────────────

const lampY = (c: Chamber, dy: number): number => c.cy - c.ry * 0.98 + dy;

/** Свет камер: тёплые фонари, бирюзовые грибы, кислотная зелень в лаборатории. */
function lights(ctx: Ctx, t: number, lv: RoomLevels): void {
  const pulse = (k: number): number => 0.88 + 0.12 * Math.sin(t * 1.7 + k) + 0.04 * Math.sin(t * 4.3 + k);
  const on = (c: Chamber): boolean => ROOM_IDS.some((id) => ROOM_CH[id] === c && lv[id] > 0);
  const room = (c: Chamber, draw: () => void): void => {
    if (!on(c)) return;
    ctx.save();
    chamberPath(ctx, c);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    draw();
    ctx.restore();
  };
  room(NURSERY, () => {
    glow(ctx, at(NURSERY, 0.1), lampY(NURSERY, 64), 230, '255,190,90', 0.3 * pulse(0));
    glow(ctx, at(NURSERY, -0.85), floorY(NURSERY) - 30, 90, '120,255,210', 0.3 * pulse(1));
  });
  room(SOLAR, () => glow(ctx, SOLAR.cx, SOLAR.cy - SOLAR.ry, 200, '255,170,70', 0.32 * pulse(2)));
  room(LAB, () => {
    glow(ctx, at(LAB, -0.1), lampY(LAB, 44), 200, '255,190,90', 0.24 * pulse(3));
    glow(ctx, at(LAB, -0.3), floorY(LAB) - 50, 110, '150,255,90', 0.3 * pulse(4));
  });
  room(GRANARY, () => glow(ctx, at(GRANARY, -0.2), lampY(GRANARY, 58), 220, '255,190,90', 0.28 * pulse(5)));
  room(FUNGUS, () => {
    glow(ctx, at(FUNGUS, -0.82), floorY(FUNGUS) - 30, 110, '120,255,210', 0.3 * pulse(6));
    glow(ctx, at(FUNGUS, 0.86), floorY(FUNGUS) - 30, 100, '120,255,210', 0.28 * pulse(7));
  });
  room(HANGAR, () => {
    glow(ctx, at(HANGAR, -0.3), lampY(HANGAR, 56), 210, '255,190,90', 0.26 * pulse(8));
    glow(ctx, at(HANGAR, 0.42), lampY(HANGAR, 60), 210, '255,190,90', 0.26 * pulse(9));
  });
  room(WORKSHOP, () => glow(ctx, at(WORKSHOP, -0.4), lampY(WORKSHOP, 56), 210, '255,190,90', 0.28 * pulse(10)));
  room(FORAGE, () => glow(ctx, at(FORAGE, -0.1), lampY(FORAGE, 56), 210, '255,190,90', 0.28 * pulse(11)));
  const lamps: [Chamber, number, number][] = [
    [NURSERY, at(NURSERY, 0.1), lampY(NURSERY, 34)], [LAB, at(LAB, -0.1), lampY(LAB, 24)], [GRANARY, at(GRANARY, -0.2), lampY(GRANARY, 28)],
    [HANGAR, at(HANGAR, -0.3), HANGAR.cy - HANGAR.ry * 0.95 + 26], [HANGAR, at(HANGAR, 0.42), HANGAR.cy - HANGAR.ry * 0.95 + 30],
    [WORKSHOP, at(WORKSHOP, -0.55), lampY(WORKSHOP, 26)], [FORAGE, at(FORAGE, -0.1), lampY(FORAGE, 26)],
  ];
  for (const [c, x, y] of lamps) if (on(c)) glow(ctx, x, y, 24, '255,240,170', 0.5 * pulse(x));
}

function nurseryLife(ctx: Ctx, t: number): void {
  const c = NURSERY;
  const fl = floorY(c) - 7;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  const ph = (t % 12) / 12;
  const xa = at(c, -0.48);
  const xb = at(c, 0.36);
  let x: number;
  let dir: 1 | -1;
  let moving = true;
  if (ph < 0.42) { x = xa + (xb - xa) * (ph / 0.42); dir = 1; } else if (ph < 0.5) { x = xb; dir = 1; moving = false; } else if (ph < 0.92) { x = xb - (xb - xa) * ((ph - 0.5) / 0.42); dir = -1; } else { x = xa; dir = -1; moving = false; }
  drawAntSide(ctx, x, fl - 8, 1.0, dir, { walk: moving ? t * 8 : null, t, carry: ph < 0.46 || ph > 0.96 ? 'larva' : null, nod: moving ? 0 : 0.55 });
  const grubs: [number, number, number][] = [[-0.15, 11, 0.15], [0.02, 13.5, -0.12], [0.18, 11.5, 0.3], [0.34, 14, 0.05], [0.49, 10, -0.25]];
  grubs.forEach(([f, r, rot], i) => drawGrub(ctx, at(c, f), fl - 5 - r * 0.5, r, rot, Math.sin(t * (1.5 + i * 0.13) + i * 1.7) * 0.045));
  const feed = Math.max(0, Math.sin(t * 1.5));
  drawAntSide(ctx, at(c, 0.42), fl + 5, 1.15, -1, { walk: null, t: t + 3, carry: feed > 0.3 ? 'honey' : null, nod: 0.3 + feed * 0.55 });
  ctx.restore();
}

function solarLife(ctx: Ctx, t: number): void {
  // Нянька переворачивает куколку, чтобы прогревалась ровно.
  drawAntSide(ctx, at(SOLAR, 0.12), floorY(SOLAR) - 3, 0.95, -1, { walk: null, t, nod: 0.35 + 0.25 * Math.max(0, Math.sin(t * 1.2)), fidget: 0.6 });
}

function labLife(ctx: Ctx, t: number): void {
  const c = LAB;
  const fl = floorY(c) - 7;
  const ty = fl - 28;
  const bx = at(c, -0.62);
  const by = c.cy - 26;
  drawBeetle(ctx, bx, by + 2, -Math.PI / 2, 0.62, 0, false);
  ell(ctx, bx, by - 3, 2.2, 2.2);
  stroked(ctx, '#d84a3a', 1);
  const fx = [at(c, -0.32), at(c, -0.12), at(c, 0.1)];
  flask(ctx, fx[0], ty - 13, 12, 'rgba(155,229,58,0.92)', 0.55);
  flask(ctx, fx[1], ty - 11, 10, 'rgba(181,123,214,0.9)', 0.5 + 0.08 * Math.sin(t * 0.8));
  flask(ctx, fx[2], ty - 12, 11, 'rgba(255,200,80,0.9)', 0.4);
  for (let i = 0; i < 6; i++) {
    const u = (t * 0.6 + i / 6) % 1;
    const x = fx[0] + Math.sin(i * 2.1 + u * 6) * 3;
    const y = ty - 8 - u * 46;
    ctx.fillStyle = `rgba(200,255,140,${0.8 * (1 - u)})`;
    ell(ctx, x, y, 2 + u * 2, 2 + u * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(40,80,10,${0.5 * (1 - u)})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  drawAntSide(ctx, at(c, 0.45), fl + 4, 1.05, -1, { walk: null, t, lab: true, nod: 0.2 + 0.3 * Math.max(0, Math.sin(t * 0.9)), fidget: 0.4 });
}

function granaryLife(ctx: Ctx, t: number): void {
  const c = GRANARY;
  const ph = (t % 7) / 7;
  const x = at(c, -0.62) + Math.min(1, ph * 3) * 50 - Math.max(0, ph - 0.6) * 125;
  const busy = ph >= 0.33 && ph < 0.6;
  drawAntSide(ctx, x, floorY(c) - 3, 1.0, ph < 0.6 ? 1 : -1, { walk: busy ? null : t * 8, t, carry: ph < 0.33 ? 'seed' : null, nod: busy ? 0.6 : 0 });
}

function fungusLife(ctx: Ctx, t: number): void {
  const c = FUNGUS;
  const fl = floorY(c) - 6;
  const put = Math.max(0, Math.sin(t * 1.1));
  drawAntSide(ctx, at(c, -0.6), fl + 4, 1.0, 1, { walk: null, t, carry: put < 0.5 ? 'leaf' : null, nod: 0.2 + put * 0.5 });
  drawAntSide(ctx, at(c, 0.58), fl + 4, 1.0, -1, { walk: null, t: t + 2, nod: 0.45 + 0.2 * Math.sin(t * 2.2), fidget: 0.8 });
}

// ── ангар: техобслуживание, взлёт через люк, полёт и посадка ──

const FLY_P = 33;
/** Где стоит механик с молотком: на ящике у брони стрекозы. */
const MECH_X = 1892;
const DF_S = 1.25;
const HATCH_X = 1878;
const SHAFT_X = 1960;
const PARK_X = 1990;
const RIDER_X = 2104;

interface Flight { x: number; y: number; pitch: number; flap: number; hatch: number; rider: boolean; away: boolean }

/** Где стрекоза и насколько открыт люк в момент t цикла. */
function flight(t: number): Flight {
  const fl = floorY(HANGAR) - 2;
  const top = SURFACE - 150;
  const u = t % FLY_P;
  const k01 = (v: number): number => Math.max(0, Math.min(1, v));
  const ease = (v: number): number => v * v * (3 - 2 * v);
  const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
  // Нос задирается по мере подъёма: хвост длиной ~250 не должен уходить под пол ангара.
  const pitchAt = (y: number): number => -Math.min(1.35, Math.asin(k01((fl - y - 8) / 250)));
  let hatch = 0;
  if (u >= 16 && u < 17.5) hatch = ease(k01((u - 16) / 1.5));
  else if (u >= 17.5 && u < 23) hatch = 1;
  else if (u >= 23 && u < 24.5) hatch = 1 - ease(k01((u - 23) / 1.5));
  else if (u >= 26 && u < 27) hatch = ease(k01(u - 26));
  else if (u >= 27 && u < 30.8) hatch = 1;
  else if (u >= 30.8 && u < 32) hatch = 1 - ease(k01((u - 30.8) / 1.2));
  const park = { x: PARK_X, y: fl, pitch: 0, hatch, away: false };
  if (u < 16) return { ...park, flap: 0, rider: u >= 15.9 };
  if (u < 17.5) return { ...park, flap: k01(u - 16.6), rider: true };
  if (u < 20.6) {
    // Взлёт: вертикально вверх по шахте, по пути встаёт носом к небу.
    const k = ease(k01((u - 17.5) / 3.1));
    const y = lerp(fl, top, k);
    return { x: lerp(PARK_X, SHAFT_X, k01(k * 2.5)), y, pitch: pitchAt(y), flap: 1, hatch, rider: true, away: false };
  }
  if (u < 24) {
    const k = k01((u - 20.6) / 3.4);
    return { x: lerp(SHAFT_X, 2900, k * k), y: lerp(top, -260, k), pitch: lerp(-1.35, -0.3, ease(k01(k * 2))), flap: 1, hatch, rider: true, away: k >= 1 };
  }
  if (u < 26.5) return { x: 2900, y: -260, pitch: -0.3, flap: 1, hatch, rider: true, away: true };
  if (u < 28.5) {
    const k = ease(k01((u - 26.5) / 2));
    return { x: lerp(2900, SHAFT_X, k), y: lerp(-260, top, k), pitch: lerp(-0.3, -1.35, k), flap: 1, hatch, rider: true, away: false };
  }
  if (u < 30.8) {
    // Посадка: вниз по шахте, у пола выравнивается.
    const k = ease(k01((u - 28.5) / 2.3));
    const y = lerp(top, fl, k);
    return { x: lerp(SHAFT_X, PARK_X, k01(k * 2.5 - 1.5)), y, pitch: pitchAt(y), flap: 1 - k * 0.5, hatch, rider: true, away: false };
  }
  return { ...park, flap: 0, rider: u < 31.2 };
}

/** Люк: пласт дёрна на петле у левого края шахты, откидывается вверх. */
function drawHatch(ctx: Ctx, open: number): void {
  const rng = new Rng(77);
  const w = 2042 - HATCH_X;
  ctx.save();
  ctx.translate(HATCH_X, surf(HATCH_X) - 2);
  ctx.rotate(-open * 1.95);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w - 2, 18);
  ctx.lineTo(2, 18);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 18);
  g.addColorStop(0, '#6e4a2a');
  g.addColorStop(1, '#4a2d1a');
  stroked(ctx, g, 2);
  ctx.strokeStyle = '#a0703c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(4, 15); ctx.lineTo(w - 4, 15); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, 6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  const gg = ctx.createLinearGradient(0, -2, 0, 6);
  gg.addColorStop(0, PAL.grassLight);
  gg.addColorStop(1, PAL.grassDark);
  stroked(ctx, gg, 1.6);
  for (let x = 6; x < w - 4; x += rng.range(8, 14)) {
    const h = rng.range(7, 15);
    const lean = rng.range(-4, 4);
    ctx.beginPath();
    ctx.moveTo(x - 2.5, 0);
    ctx.quadraticCurveTo(x + lean * 0.3, -h * 0.6, x + lean, -h);
    ctx.quadraticCurveTo(x + lean * 0.3 + 1.5, -h * 0.5, x + 2.5, 0);
    ctx.closePath();
    ctx.fillStyle = rng.next() < 0.5 ? PAL.grassLight : PAL.grass;
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,22,8,0.85)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.restore();
  ell(ctx, HATCH_X + 2, surf(HATCH_X) + 4, 4.5, 4.5);
  stroked(ctx, '#c8923a', 1.6);
}

function hangarLife(ctx: Ctx, t: number): void {
  const c = HANGAR;
  const fl = floorY(c) - 6;
  const f = flight(t);
  const u = t % FLY_P;
  if (f.hatch > 0.05) {
    // Дневной свет льётся в шахту, пока люк открыт.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, SURFACE, 0, fl);
    g.addColorStop(0, `rgba(255,250,210,${0.4 * f.hatch})`);
    g.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(SHAFT_X - 70, SURFACE);
    ctx.lineTo(SHAFT_X + 70, SURFACE);
    ctx.lineTo(SHAFT_X + 140, fl);
    ctx.lineTo(SHAFT_X - 120, fl);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  // Кран: трос с крюком и бак-капля качаются.
  const kx = at(c, 0.68);
  const ky = c.cy - 52;
  const swing = Math.sin(t * 1.3) * 0.12;
  const hx = kx + Math.sin(swing) * 56;
  const hy = ky + Math.cos(swing) * 56;
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hx - 12, hy + 12);
  ctx.bezierCurveTo(hx - 12, hy + 2, hx + 12, hy + 2, hx + 12, hy + 12);
  ctx.bezierCurveTo(hx + 10, hy + 20, hx - 10, hy + 20, hx - 12, hy + 12);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, hy + 2, 0, hy + 20);
  bg.addColorStop(0, '#ffe08a');
  bg.addColorStop(1, '#c9821a');
  stroked(ctx, bg, 1.6);
  // Механик с молотком у брони, второй носит пластины из ящика.
  const parked = u < 16;
  const ph = (t % 9) / 9;
  const wx = ph < 0.45 ? 1756 + (ph / 0.45) * 100 : ph < 0.55 ? 1856 : 1856 - ((ph - 0.55) / 0.45) * 100;
  drawAntSide(ctx, wx, fl + 4, 0.95, ph < 0.55 ? 1 : -1, { walk: ph < 0.45 || ph >= 0.55 ? t * 8 : null, t, helmet: true, carry: ph < 0.5 ? 'plate' : null });
  if (u < 15 || u >= 31.2) {
    drawAntSide(ctx, RIDER_X, fl + 4, 1.0, -1, { walk: null, t, aviator: true, fidget: 0.3 });
  } else if (u < 15.9) {
    // Пилот запрыгивает в седло.
    const k = (u - 15) / 0.9;
    const sx = PARK_X + 3 * DF_S;
    const sy = floorY(c) - 2 - 56 * DF_S;
    drawAntSide(ctx, RIDER_X + (sx - RIDER_X) * k, fl + 4 + (sy - fl - 4) * k - Math.sin(k * Math.PI) * 40, 1.0, -1, { walk: null, t, aviator: true });
  }
  ctx.restore();
  // Стрекоза: в ангаре, в шахте и в небе — без обрезки по камере.
  if (!f.away) drawDragonflySide(ctx, f.x, f.y, DF_S, { t, flap: f.flap, gear: 3, rider: f.rider, pitch: f.pitch });
  // Механик на ящике перед стрекозой стучит по заклёпкам брони.
  const hit = Math.sin(t * 7);
  drawAntSide(ctx, MECH_X, fl - 18, 1.0, 1, { walk: null, t, helmet: true, hammer: parked ? t * 7 : null, nod: parked ? 0.1 + 0.25 * Math.max(0, hit) : -0.2 });
  if (parked && hit > 0.9) {
    const sx = MECH_X + 42;
    const sy = fl - 46;
    ctx.strokeStyle = 'rgba(255,230,120,0.95)';
    ctx.lineWidth = 1.6;
    for (const a of [-2.6, -2.0, -1.3, -0.6]) {
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5);
      ctx.lineTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 13);
      ctx.stroke();
    }
  }
  drawHatch(ctx, f.hatch);
}

// ── муравьи в ходах ──

interface Walker { tunnel: number; carry: Carry | null; s: number; speed: number; phase: number; outside?: readonly [number, number] }

/** Кто ходит: номер хода, ноша туда (обратно налегке), размер, скорость; outside — путь по земле до входа. */
const WALKERS: readonly Walker[] = [
  { tunnel: 0, carry: 'needle', s: 0.78, speed: 34, phase: 0, outside: [1330, 1203] },
  { tunnel: 8, carry: 'seed', s: 0.8, speed: 40, phase: 3, outside: [250, 378] },
  { tunnel: 3, carry: 'cocoon', s: 0.74, speed: 30, phase: 1 },
  { tunnel: 4, carry: null, s: 0.74, speed: 36, phase: 5 },
  { tunnel: 5, carry: 'leaf', s: 0.8, speed: 32, phase: 2 },
  { tunnel: 5, carry: null, s: 0.8, speed: 40, phase: 12 },
  { tunnel: 9, carry: 'seed', s: 0.8, speed: 38, phase: 7 },
  { tunnel: 10, carry: 'plate', s: 0.82, speed: 34, phase: 4 },
  { tunnel: 12, carry: 'crumb', s: 0.8, speed: 30, phase: 6 },
  { tunnel: 1, carry: 'leaf', s: 0.78, speed: 30, phase: 8, outside: [700, 852] },
  { tunnel: 2, carry: 'seed', s: 0.78, speed: 32, phase: 9, outside: [1720, 1548] },
  { tunnel: 13, carry: 'crumb', s: 0.78, speed: 28, phase: 10 },
  { tunnel: 14, carry: null, s: 0.78, speed: 33, phase: 11 },
  { tunnel: 16, carry: 'crumb', s: 0.78, speed: 26, phase: 13 },
];

interface RoutePt { x: number; y: number; d: number; off: number }

/** Путь муравья: по земле или склону купола до входа, дальше по полу хода. */
function route(w: Walker): RoutePt[] {
  const t = TUNNELS[w.tunnel];
  const s = SAMPLES[w.tunnel];
  const pts: RoutePt[] = [];
  let d = 0;
  const push = (x: number, y: number, off: number): void => {
    if (pts.length) d += Math.hypot(x - pts[pts.length - 1].x, y - pts[pts.length - 1].y);
    pts.push({ x, y, d, off });
  };
  let i0 = 0;
  if (w.outside) {
    const [a, b] = w.outside;
    const step = a < b ? 8 : -8;
    for (let x = a; step > 0 ? x <= b : x >= b; x += step) push(x, groundTop(x), 0);
    // Вход: первая точка хода, что уже под землёй.
    while (i0 < s.length - 1 && s[i0].y < groundTop(s[i0].x) + 6) i0++;
  }
  for (let i = i0; i < s.length; i++) {
    const k = w.outside ? Math.min(1, (i - i0) / 6) : 1;
    push(s[i].x, s[i].y, (t.w / 2 - 1) * k);
  }
  return pts;
}
const ROUTES = WALKERS.map(route);

function alongRoute(r: readonly RoutePt[], d: number): { x: number; y: number; a: number; off: number } {
  const dd = Math.max(0, Math.min(d, r[r.length - 1].d));
  let lo = 1;
  let hi = r.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r[mid].d < dd) lo = mid + 1; else hi = mid;
  }
  const a = r[lo - 1];
  const b = r[lo];
  const k = b.d > a.d ? (dd - a.d) / (b.d - a.d) : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x), off: a.off + (b.off - a.off) * k };
}

export interface ViewBox { x0: number; y0: number; x1: number; y1: number }

/** Муравьи ходят туда и обратно: туда с ношей, в камере исчезают и через миг выходят налегке. */
function walkers(ctx: Ctx, t: number, vis: ViewBox): void {
  WALKERS.forEach((w, i) => {
    const r = ROUTES[i];
    const L = r[r.length - 1].d;
    const run = L / w.speed;
    const pause = 1.6;
    const period = 2 * (run + pause);
    const u = (t + w.phase * 3.7) % period;
    let d: number;
    let back = false;
    if (u < run) d = (u / run) * L;
    else if (u < run + pause) d = L;
    else if (u < 2 * run + pause) { d = L - ((u - run - pause) / run) * L; back = true; } else { d = 0; back = true; }
    // У конца в камере муравей тает; снаружи (на земле) тает в начале пути.
    let alpha = Math.min(1, (L - d) / 22);
    if (u >= run && u < run + pause) alpha = 0;
    alpha = Math.min(alpha, d / (w.outside ? 30 : 22));
    if (alpha <= 0.01) return;
    const p = alongRoute(r, d);
    if (p.x < vis.x0 - 60 || p.x > vis.x1 + 60 || p.y < vis.y0 - 60 || p.y > vis.y1 + 60) return;
    const a = back ? p.a + Math.PI : p.a;
    // Ноги всегда на нижней стене хода: зеркалим, если нормаль смотрит вверх.
    let nx = -Math.sin(a);
    let ny = Math.cos(a);
    let dir: 1 | -1 = 1;
    let rot = a;
    if (ny < -1e-6 || (Math.abs(ny) <= 1e-6 && nx < 0)) { nx = -nx; ny = -ny; dir = -1; rot = a + Math.PI; }
    drawAntSide(ctx, p.x + nx * p.off, p.y + ny * p.off, w.s, dir, { walk: t * 9 + i, t: t + i, rot, carry: back ? null : w.carry, alpha });
  });
}

/** Сыплется крошка со свода завалов; строитель в забое роет дальше. */
function ruinsLife(ctx: Ctx, t: number, lv: RoomLevels): void {
  RUINS.forEach((c, i) => {
    if (!buried(lv, c)) return;
    for (let k = 0; k < 2; k++) {
      const per = 2.6 + i * 0.7 + k * 1.1;
      const u = ((t + i * 1.3 + k * 0.9) % per) / per;
      if (u > 0.5) continue;
      const fall = u / 0.5;
      const x = c.cx + Math.sin(i * 3.1 + k * 2.3) * c.rx * 0.35;
      const y = c.cy - c.ry * 0.85 + fall * fall * c.ry * 1.1;
      ctx.fillStyle = `rgba(190,150,100,${0.7 * (1 - fall)})`;
      ell(ctx, x, y, 1.6, 1.6);
      ctx.fill();
      ell(ctx, x + 4, y - 6, 1.1, 1.1);
      ctx.fill();
    }
  });
  const s = SAMPLES[16];
  const p = along(s, s[s.length - 1].d - 26);
  const nx = -Math.sin(p.a);
  const ny = Math.cos(p.a);
  const off = TUNNELS[16].w / 2 - 1;
  const fx = p.x + nx * off;
  const fy = p.y + ny * off;
  const dig = (t * 1.4) % 1;
  drawAntSide(ctx, fx, fy, 0.85, 1, { walk: null, t, helmet: true, nod: 0.3 + Math.max(0, Math.sin(dig * TAU)) * 0.6, rot: p.a });
  for (let i = 0; i < 3; i++) {
    const k = (dig + i / 3) % 1;
    const px = fx + 20 - k * 56;
    const py = fy - 12 - Math.sin(k * Math.PI) * 20 + k * 14;
    ctx.fillStyle = OUT;
    ell(ctx, px, py, 3.2 - i * 0.5, 2.8 - i * 0.4, k * 4);
    ctx.fill();
    ctx.fillStyle = '#9a6a3a';
    ell(ctx, px - 0.4, py - 0.4, 2.2 - i * 0.4, 1.9 - i * 0.3, k * 4);
    ctx.fill();
  }
}

/** Пылинки в свете фонарей. */
function motes(ctx: Ctx, t: number, lv: RoomLevels): void {
  for (const [c, n] of [[NURSERY, lv.nursery], [GRANARY, lv.granary], [SOLAR, lv.solar]] as const) {
    if (n <= 0) continue;
    for (let i = 0; i < 10; i++) {
      const ph = i * 1.93 + c.seed;
      const x = c.cx + Math.sin(t * 0.21 + ph) * c.rx * 0.6 + Math.sin(t * 0.53 + ph * 2) * 14;
      const y = c.cy - 4 + Math.sin(t * 0.17 + ph * 1.3) * c.ry * 0.45;
      ctx.fillStyle = `rgba(255,236,180,${0.25 + 0.25 * Math.sin(t * 1.3 + ph)})`;
      ell(ctx, x, y, 1.3, 1.3);
      ctx.fill();
    }
  }
}

/** Мастерская: механик стучит по раме, рычаг катапульты время от времени швыряет семечку. */
function workshopLife(ctx: Ctx, t: number): void {
  const c = WORKSHOP;
  const fl = floorY(c) - 6;
  const per = 7;
  const u = t % per;
  // Рычаг: в покое отведён назад, на 4-й секунде бросок вперёд, потом медленно возвращается.
  const rest = Math.PI * 0.9;
  const shot = Math.PI * 0.38;
  const a = u < 4 ? rest + Math.sin(t * 3) * 0.015 : u < 4.15 ? rest + (shot - rest) * ((u - 4) / 0.15) : u < 4.6 ? shot : shot + (rest - shot) * Math.min(1, (u - 4.6) / 2.2);
  const [px, py] = CAT_PIVOT;
  const len = 58;
  const ex = px + Math.cos(a) * len;
  const ey = py - Math.sin(a) * len;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  stick(ctx, px - Math.cos(a) * 12, py + Math.sin(a) * 12, ex, ey, 4.2);
  ell(ctx, ex, ey, 9, 5.5, -a + Math.PI / 2);
  stroked(ctx, '#a8743e', 1.8);
  ell(ctx, px, py, 3.4, 3.4);
  stroked(ctx, '#e0b884', 1.4);
  if (u < 4.05 || u > 6.2) grain(ctx, ex, ey - 4, 5.5, 0.4, 1);
  else if (u < 5.2) {
    // Семечка летит дугой к мишени на дальней стене.
    const k = (u - 4.05) / 1.15;
    const sx = CAT_X + 30 + k * 170;
    const sy = py - 30 - Math.sin(k * Math.PI) * 30 + k * 30;
    grain(ctx, sx, sy, 5.5, k * 9, 1);
  }
  const hit = Math.sin(t * 6.5);
  drawAntSide(ctx, CAT_X - 62, fl + 4, 1.0, 1, { walk: null, t, helmet: true, hammer: t * 6.5, nod: 0.1 + 0.25 * Math.max(0, hit) });
  const ph = (t % 10) / 10;
  const x0 = at(c, 0.5);
  const x1 = CAT_X + 52;
  const x = ph < 0.4 ? x0 + (x1 - x0) * (ph / 0.4) : ph < 0.5 ? x1 : ph < 0.9 ? x1 + (x0 - x1) * ((ph - 0.5) / 0.4) : x0;
  drawAntSide(ctx, x, fl + 4, 0.95, ph < 0.5 ? -1 : 1, { walk: ph < 0.4 || (ph >= 0.5 && ph < 0.9) ? t * 8 : null, t, carry: ph < 0.45 ? 'seed' : null });
  ctx.restore();
}

/** Тропа фуражиров: фуражир сносит лист на поднос, сортировщик перебирает зерно. */
function forageLife(ctx: Ctx, t: number): void {
  const c = FORAGE;
  const fl = floorY(c) - 6;
  const ph = (t % 11) / 11;
  const x0 = at(c, -0.95);
  const x1 = at(c, 0.3);
  const x = ph < 0.42 ? x0 + (x1 - x0) * (ph / 0.42) : ph < 0.52 ? x1 : ph < 0.94 ? x1 + (x0 - x1) * ((ph - 0.52) / 0.42) : x0;
  ctx.save();
  chamberPath(ctx, c);
  ctx.clip();
  drawAntSide(ctx, x, fl + 4, 1.0, ph < 0.52 ? 1 : -1, { walk: ph < 0.42 || (ph >= 0.52 && ph < 0.94) ? t * 8 : null, t, carry: ph < 0.47 ? 'leaf' : null, nod: ph >= 0.42 && ph < 0.52 ? 0.5 : 0 });
  drawAntSide(ctx, at(c, -0.2), fl + 4, 1.0, -1, { walk: null, t: t + 4, nod: 0.35 + 0.3 * Math.max(0, Math.sin(t * 2.1)), fidget: 0.7 });
  ctx.restore();
}

/** Точки уровня под табличкой: залитые — отстроенные уровни. */
function pips(ctx: Ctx, x: number, y: number, level: number, max: number): void {
  for (let i = 0; i < max; i++) {
    const px = x + (i - (max - 1) / 2) * 14;
    ell(ctx, px, y, 5, 5);
    if (i < level) {
      const g = ctx.createRadialGradient(px - 1.5, y - 1.5, 0.5, px, y, 5);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(1, '#e0a020');
      stroked(ctx, g, 1.6);
    } else stroked(ctx, 'rgba(50,28,10,0.85)', 1.6);
  }
}

/** Зелёная стрелка на табличке: следующий уровень уже по карману. */
function upBadge(ctx: Ctx, x: number, y: number, t: number): void {
  const r = 10 + Math.sin(t * 4) * 1.2;
  ell(ctx, x, y, r, r);
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r);
  g.addColorStop(0, '#9be35a');
  g.addColorStop(1, '#3c8a2b');
  stroked(ctx, g, 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 5.5, y + 0.5);
  ctx.lineTo(x + 2, y + 0.5);
  ctx.lineTo(x + 2, y + 5.5);
  ctx.lineTo(x - 2, y + 5.5);
  ctx.lineTo(x - 2, y + 0.5);
  ctx.lineTo(x - 5.5, y + 0.5);
  ctx.closePath();
  ctx.fill();
}

/** Подписи камер на табличках. */
export type ColonyLabels = Record<RoomId | 'rubble', string>;

/** Что разрез показывает поверх печёного: уровни, подписи, выбранную камеру и только что отстроенную. */
export interface ColonyView {
  labels: ColonyLabels;
  level: RoomLevels;
  max: RoomLevels;
  /** Следующий уровень по карману: на табличке зелёная стрелка. */
  can: Partial<Record<RoomId, boolean>>;
  pick: RoomId | null;
  /** Только что отстроенная камера и сколько секунд назад: вспышка света. */
  built: { id: RoomId; age: number } | null;
}

/** Всё живое разреза за кадр. vis — видимая часть мира: дальние ходоки не рисуются. */
export function drawColonyLife(ctx: Ctx, t: number, vis: ViewBox, v: ColonyView): void {
  const lv = v.level;
  lights(ctx, t, lv);
  motes(ctx, t, lv);
  ruinsLife(ctx, t, lv);
  if (lv.solar > 0) solarLife(ctx, t);
  if (lv.nursery > 0) nurseryLife(ctx, t);
  if (lv.lab > 0) labLife(ctx, t);
  if (lv.granary > 0) granaryLife(ctx, t);
  if (lv.fungus > 0) fungusLife(ctx, t);
  if (lv.workshop > 0) workshopLife(ctx, t);
  if (lv.forage > 0) forageLife(ctx, t);
  walkers(ctx, t, vis);
  if (lv.hangar > 0) hangarLife(ctx, t);
  else drawHatch(ctx, 0);
  // Выбранная камера: золотой контур дышит; только что отстроенная вспыхивает светом.
  if (v.pick) {
    const c = ROOM_CH[v.pick];
    ctx.save();
    chamberPath(ctx, c, 2);
    ctx.strokeStyle = `rgba(255,214,90,${0.65 + 0.3 * Math.sin(t * 4)})`;
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255,200,80,0.9)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }
  if (v.built && v.built.age < 1.4) {
    const c = ROOM_CH[v.built.id];
    const k = v.built.age / 1.4;
    ctx.save();
    chamberPath(ctx, c);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, c.cx, c.cy, c.rx * (0.6 + k * 0.8), '255,220,130', 0.7 * (1 - k));
    ctx.restore();
  }
  for (const id of ROOM_IDS) {
    const c = ROOM_CH[id];
    const x = at(c, PLAQUE_F[id]);
    const y = c.cy - c.ry + 30;
    const under = buried(lv, c);
    const w = drawPlaque(ctx, x, y, under ? v.labels.rubble : v.labels[id], lv[id] > 0);
    pips(ctx, x, y + 22, lv[id], v.max[id]);
    if (v.can[id]) upBadge(ctx, x + w / 2 + 6, y - 12, t);
  }
  for (const c of RUINS.slice(2)) drawPlaque(ctx, at(c, -0.42 * (c.side ?? 1)), c.cy - c.ry + 30, v.labels.rubble, false);
}
