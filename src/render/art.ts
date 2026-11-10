/**
 * «Ассет-пак» нарисованный кодом в стиле Kingdom Rush: толстый тёмный контур,
 * сочные цвета, мультяшные пропорции. Каждая функция = один спрайт.
 * Когда появятся нарисованные вручную спрайты, они заменяются здесь по одной.
 */
import { TAU, type Vec } from '../engine/math';
import { Rng } from '../engine/rng';
import type { Path } from '../game/path';
import { CELL, type TowerKind } from '../game/config';
import type { Biome, LevelTheme } from '../game/levels';
import { PAL } from './palette';
import { biomeBlob, biomeCluster, biomeDecor, biomeGround, biomeTuft, crossings, drawIce, drawRavine, koiStream, redBridge, ropeBridge } from './biomes';

type Ctx = CanvasRenderingContext2D;
type Fill = string | CanvasGradient;
const OUT = PAL.outline;

// ───────────────────────── базовые примитивы ─────────────────────────

export function outline(ctx: Ctx, w = 3): void {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
}
export function fs(ctx: Ctx, fill: Fill, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}
export function drawShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28): void {
  ctx.fillStyle = `rgba(20,10,0,${alpha})`;
  ell(ctx, x, y, rx, ry);
  ctx.fill();
}
export function twig(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w = 4): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 2.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = PAL.twig;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
export function pennant(ctx: Ctx, x: number, y: number, len: number, h: number, color: string, wave = 0): void {
  outline(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.55, y + h * 0.1 + wave, x + len, y + h * 0.45 + wave);
  ctx.quadraticCurveTo(x + len * 0.55, y + h * 0.7 + wave, x, y + h);
  ctx.closePath();
  fs(ctx, color);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + len * 0.5, y + h * 0.28 + wave);
  ctx.lineTo(x + 2, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
}
export function leaf(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, color: string = PAL.leaf, rib: string = PAL.leafDark): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  outline(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-rx, 0);
  ctx.quadraticCurveTo(0, -ry * 1.7, rx, 0);
  ctx.quadraticCurveTo(0, ry * 1.7, -rx, 0);
  ctx.closePath();
  fs(ctx, color);
  ctx.strokeStyle = rib;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-rx * 0.8, 0); ctx.lineTo(rx * 0.8, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ell(ctx, -rx * 0.3, -ry * 0.45, rx * 0.3, ry * 0.25, 0.2);
  ctx.fill();
  ctx.restore();
}
export function pebble(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  outline(ctx, 2);
  ell(ctx, x, y, rx, ry);
  fs(ctx, PAL.stone);
  ctx.fillStyle = PAL.stoneLight;
  ell(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.35);
  ctx.fill();
}

function legs6(ctx: Ctx, phase: number, ax: readonly number[], spread: number, len: number, w: number): void {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const dir = i === 0 ? 1 : i === 1 ? 0.15 : -1;
      const sw = Math.sin(phase + i * 2.1 + (side > 0 ? Math.PI : 0)) * 4;
      const x0 = ax[i];
      ctx.beginPath();
      ctx.moveTo(x0, side * 3);
      ctx.lineTo(x0 + dir * spread * 0.55 + sw * 0.5, side * len * 0.6);
      ctx.lineTo(x0 + dir * spread + sw, side * len);
      ctx.stroke();
    }
  }
}

// ───────────────────────── существа ─────────────────────────

export interface AntColors { body: string; light: string; dark: string }
export const ANT_WORKER: AntColors = { body: PAL.antBody, light: PAL.antLight, dark: PAL.antDark };
export const ANT_SOLDIER: AntColors = { body: PAL.soldierBody, light: PAL.soldierLight, dark: PAL.soldierDark };

/**
 * Спрайт-листы подключаются снаружи (render/sprites.ts, только браузер): функция рисует
 * кадр нужного направления и возвращает true, иначе существо рисуется векторно.
 * Симуляция в Node рисовальщик не ставит и импортирует art.ts без картинок.
 */
export type SpriteKind = 'antWorker' | 'antSoldier' | 'antHero' | 'antBlack' | 'termite' | 'termiteSoldier' | 'termiteBomber' | 'spider' | 'beetle' | 'rhino' | 'wasp' | 'hornet' | 'slug' | 'leech' | 'dragonfly' | 'queen' | 'empress';
export type SpriteDrawer = (kind: SpriteKind, ctx: Ctx, x: number, y: number, angle: number, s: number, phase: number) => boolean;
let spriteDrawer: SpriteDrawer | null = null;
export function setSpriteDrawer(d: SpriteDrawer | null): void {
  spriteDrawer = d;
}
/** Во сколько раз спрайт крупнее векторного рисунка при том же масштабе (см. sprites/layout.ts). */
const SPRITE_PER_VECTOR = 1.2;
/** Крупные существа нарисованы в листе плотнее, поэтому в игре берутся с собственным множителем. */
const SPRITE_SCALE: Partial<Record<SpriteKind, number>> = { queen: 1.95, empress: 1.95 };
function spriteScale(kind: SpriteKind): number {
  return SPRITE_SCALE[kind] ?? SPRITE_PER_VECTOR;
}
function antSpriteKind(c: AntColors): SpriteKind | null {
  return c === ANT_WORKER ? 'antWorker' : c === ANT_SOLDIER ? 'antSoldier' : c === ANT_HERO ? 'antHero' : c === ANT_BLACK ? 'antBlack' : null;
}

/** Муравей (вид сверху, смотрит вдоль +x). Длина ~36 px при s = 1. */
export function drawAnt(ctx: Ctx, x: number, y: number, angle: number, s: number, c: AntColors, legPhase: number, soldier = false): void {
  const kind = antSpriteKind(c);
  if (kind && spriteDrawer && spriteDrawer(kind, ctx, x, y, angle, s * SPRITE_PER_VECTOR, legPhase)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  legs6(ctx, legPhase, [7, 1, -5], 11, 17, 2.6);
  outline(ctx, 2.4);
  // брюшко
  ell(ctx, -13, 0, 11, 8);
  fs(ctx, c.body);
  ctx.fillStyle = c.light;
  ell(ctx, -15, -3, 5, 2.4);
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-11, 0, -9, 6); ctx.stroke();
  outline(ctx, 2.4);
  // стебелёк и грудь
  ell(ctx, -2, 0, 3.2, 2.6);
  fs(ctx, c.dark);
  ell(ctx, 4, 0, 6.5, 5);
  fs(ctx, c.body);
  // голова
  const hs = soldier ? 1.35 : 1;
  const hx = 14 + (hs - 1) * 5;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx + 5 * hs, -3 * hs); ctx.quadraticCurveTo(hx + 12 * hs, -5 * hs, hx + 13 * hs, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 5 * hs, 3 * hs); ctx.quadraticCurveTo(hx + 12 * hs, 5 * hs, hx + 13 * hs, 0); ctx.stroke();
  outline(ctx, 2.4);
  ell(ctx, hx, 0, 7 * hs, 6 * hs);
  fs(ctx, c.body);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx + 4 * hs, -4 * hs); ctx.quadraticCurveTo(hx + 10 * hs, -12 * hs, hx + 16 * hs, -11 * hs); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 4 * hs, 4 * hs); ctx.quadraticCurveTo(hx + 10 * hs, 12 * hs, hx + 16 * hs, 11 * hs); ctx.stroke();
  ctx.fillStyle = '#fff';
  circle(ctx, hx + 2 * hs, -3.2 * hs, 2.2 * hs); ctx.fill();
  circle(ctx, hx + 2 * hs, 3.2 * hs, 2.2 * hs); ctx.fill();
  ctx.fillStyle = OUT;
  circle(ctx, hx + 2.8 * hs, -3.2 * hs, 1.1 * hs); ctx.fill();
  circle(ctx, hx + 2.8 * hs, 3.2 * hs, 1.1 * hs); ctx.fill();
  ctx.restore();
}

export const ANT_HERO: AntColors = { body: '#8f2a1a', light: '#d4573c', dark: '#4a120a' };
/** Чужая колония: чёрные муравьи-налётчики. */
export const ANT_BLACK: AntColors = { body: '#2f2f3a', light: '#6a6a7a', dark: '#121218' };

/** Герой «Жвал»: муравей-воевода в шлеме из шляпки жёлудя, с листом-щитом и копьём-шипом. */
export function drawHero(ctx: Ctx, x: number, y: number, angle: number, legPhase: number): void {
  // В спрайте доспех уже нарисован; векторный путь дорисовывает его поверх муравья.
  if (spriteDrawer && spriteDrawer('antHero', ctx, x, y, angle, 1.05 * SPRITE_PER_VECTOR, legPhase)) return;
  drawAnt(ctx, x, y, angle, 1.05, ANT_HERO, legPhase, true);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1.05, 1.05);
  ctx.strokeStyle = PAL.honey;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -6.5); ctx.quadraticCurveTo(-14, 0, -12, 6.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -5); ctx.quadraticCurveTo(-20, 0, -18, 5); ctx.stroke();
  twig(ctx, -10, 11, 24, 11, 3);
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.moveTo(23, 8); ctx.lineTo(36, 11); ctx.lineTo(23, 14); ctx.closePath(); ctx.fill();
  leaf(ctx, 3, -14, 10, 5, 0.15);
  outline(ctx, 2.4);
  ctx.beginPath();
  ctx.ellipse(14, 0, 10.5, 9.5, 0, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  fs(ctx, '#8a5a2b');
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (const [dx, dy] of [[8, -4], [6, 1], [9, 4.5], [11, -1]] as const) {
    circle(ctx, dx, dy, 1.3);
    ctx.fill();
  }
  twig(ctx, 4, 0, -1, -4, 2.2);
  ctx.restore();
}

/** Иконка способности героя: раскрытые жвалы. */
export function drawMandiblesIcon(ctx: Ctx, x: number, y: number, s: number, color: string = PAL.uiLight): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-15, 12); ctx.quadraticCurveTo(-19, -8, -3, -13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15, 12); ctx.quadraticCurveTo(19, -8, 3, -13); ctx.stroke();
  ctx.fillStyle = PAL.uiGold;
  circle(ctx, 0, 0, 2.5);
  ctx.fill();
  ctx.restore();
}

export function drawTermite(ctx: Ctx, x: number, y: number, angle: number, s: number, legPhase: number, soldier = false, bomber = false, time = 0): void {
  if (bomber) {
    // Пульсирующее свечение под подрывником: в мировых координатах, чтобы лежало и под спрайтом.
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    glowSpot(ctx, x - Math.cos(angle) * 9 * s, y - Math.sin(angle) * 9 * s, 28 * s, '255,210,80', 0.25 + 0.3 * pulse);
  }
  const kind: SpriteKind = soldier ? 'termiteSoldier' : bomber ? 'termiteBomber' : 'termite';
  if (spriteDrawer && spriteDrawer(kind, ctx, x, y, angle, s * SPRITE_PER_VECTOR, legPhase)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  legs6(ctx, legPhase, [6, 0, -6], 9, 14, 2.4);
  outline(ctx, 2.4);
  ell(ctx, -9, 0, bomber ? 14 : 12, bomber ? 10 : 7.5);
  fs(ctx, bomber ? '#f2c84b' : PAL.termite);
  ctx.strokeStyle = 'rgba(150,100,40,0.45)';
  ctx.lineWidth = 1.5;
  for (const sx of [-14, -9, -4]) {
    ctx.beginPath(); ctx.moveTo(sx, -6.5); ctx.quadraticCurveTo(sx - 1.5, 0, sx, 6.5); ctx.stroke();
  }
  ctx.fillStyle = PAL.termiteLight;
  ell(ctx, -11, -3, 5, 2);
  ctx.fill();
  outline(ctx, 2.4);
  ell(ctx, 4, 0, 5.5, 5);
  fs(ctx, PAL.termite);
  const hs = soldier ? 1.3 : 1;
  ell(ctx, 12 + (hs - 1) * 4, 0, 7.5 * hs, 6.5 * hs);
  fs(ctx, soldier ? '#a85a1f' : PAL.termiteHead);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = soldier ? 4 : 3;
  const mx = 17 + (hs - 1) * 8;
  ctx.beginPath(); ctx.moveTo(mx, -3 * hs); ctx.quadraticCurveTo(mx + 7 * hs, -5 * hs, mx + 8 * hs, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, 3 * hs); ctx.quadraticCurveTo(mx + 7 * hs, 5 * hs, mx + 8 * hs, 0); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(15, -5); ctx.lineTo(21, -11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15, 5); ctx.lineTo(21, 11); ctx.stroke();
  ctx.fillStyle = OUT;
  circle(ctx, 13, -3.5, 1.4); ctx.fill();
  circle(ctx, 13, 3.5, 1.4); ctx.fill();
  ctx.restore();
}

export function drawSpider(ctx: Ctx, x: number, y: number, angle: number, s: number, legPhase: number): void {
  if (spriteDrawer && spriteDrawer('spider', ctx, x, y, angle, s * SPRITE_PER_VECTOR, legPhase)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  const kx = [15, 8, 0, -8];
  const fx = [24, 13, -3, -16];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const sw = Math.sin(legPhase + i * 1.6 + (side > 0 ? Math.PI : 0)) * 4;
      ctx.beginPath();
      ctx.moveTo(6 - i * 1.5, side * 4);
      ctx.lineTo(kx[i] + sw * 0.4, side * 14);
      ctx.lineTo(fx[i] + sw, side * 24);
      ctx.stroke();
    }
  }
  outline(ctx, 2.6);
  ell(ctx, -11, 0, 13, 11);
  fs(ctx, PAL.spider);
  ctx.fillStyle = PAL.spiderLight;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-11, -5); ctx.lineTo(-20, 0); ctx.lineTo(-11, 5); ctx.closePath(); ctx.fill();
  ell(ctx, 6, 0, 8.5, 7.5);
  fs(ctx, PAL.spiderDark);
  ctx.fillStyle = '#ff5a4a';
  circle(ctx, 11, -3, 2); ctx.fill();
  circle(ctx, 11, 3, 2); ctx.fill();
  ctx.fillStyle = '#ffb0a0';
  circle(ctx, 9, -5.5, 1.1); ctx.fill();
  circle(ctx, 9, 5.5, 1.1); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.moveTo(13, -3); ctx.lineTo(18.5, -1.5); ctx.lineTo(13.5, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, 3); ctx.lineTo(18.5, 1.5); ctx.lineTo(13.5, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawBeetle(ctx: Ctx, x: number, y: number, angle: number, s: number, legPhase: number, rhino: boolean): void {
  if (spriteDrawer && spriteDrawer(rhino ? 'rhino' : 'beetle', ctx, x, y, angle, s * SPRITE_PER_VECTOR, legPhase)) return;
  const body = rhino ? PAL.rhino : PAL.beetle;
  const light = rhino ? PAL.rhinoLight : PAL.beetleLight;
  const dark = rhino ? PAL.rhinoDark : PAL.beetleDark;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  legs6(ctx, legPhase, [10, 2, -7], 10, 19, 2.8);
  outline(ctx, 2.8);
  ell(ctx, -5, 0, 20, 15);
  fs(ctx, body);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-24, 0); ctx.stroke();
  ctx.fillStyle = light;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * 0.85;
  ell(ctx, -6, -8, 8, 3, 0.15); ctx.fill();
  ell(ctx, -6, 8, 8, 3, -0.15); ctx.fill();
  ctx.globalAlpha = a0;
  outline(ctx, 2.8);
  ell(ctx, 13, 0, 8, 10);
  fs(ctx, dark);
  ctx.fillStyle = light;
  ctx.globalAlpha = a0 * 0.5;
  ell(ctx, 12, -4, 3, 2.5); ctx.fill();
  ctx.globalAlpha = a0;
  ell(ctx, 22, 0, 5.5, 5);
  fs(ctx, dark);
  if (rhino) {
    ctx.beginPath();
    ctx.moveTo(24, -3.5); ctx.quadraticCurveTo(38, -8, 46, -2); ctx.quadraticCurveTo(38, -1, 24, 3.5); ctx.closePath();
    fs(ctx, dark);
    ctx.beginPath(); ctx.moveTo(14, -9); ctx.lineTo(20, -17); ctx.lineTo(18, -8); ctx.closePath();
    fs(ctx, dark);
  } else {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(25, -3); ctx.lineTo(31, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, 3); ctx.lineTo(31, 8); ctx.stroke();
    ctx.fillStyle = OUT;
    circle(ctx, 32, -9, 1.8); ctx.fill();
    circle(ctx, 32, 9, 1.8); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  circle(ctx, 24, -3.2, 1.9); ctx.fill();
  circle(ctx, 24, 3.2, 1.9); ctx.fill();
  ctx.fillStyle = OUT;
  circle(ctx, 24.7, -3.2, 1); ctx.fill();
  circle(ctx, 24.7, 3.2, 1); ctx.fill();
  ctx.restore();
}

export function drawWasp(ctx: Ctx, x: number, y: number, angle: number, s: number, time: number, hornet = false): void {
  // У летающих кадры листа — взмахи крыльев, поэтому фаза идёт от времени.
  if (spriteDrawer && spriteDrawer(hornet ? 'hornet' : 'wasp', ctx, x, y, angle, s * SPRITE_PER_VECTOR, time * 16)) return;
  const body = hornet ? '#d98a1f' : PAL.wasp;
  const dark = hornet ? '#3a2410' : PAL.waspDark;
  const light = hornet ? '#f5c06a' : PAL.waspLight;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const flap = Math.abs(Math.sin(time * 38));
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(1, side * 3);
    ctx.rotate(side * (0.35 + flap * 0.5));
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ell(ctx, -9, 0, 14, 4.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // ножки
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const lx = 4 - i * 4;
      ctx.beginPath(); ctx.moveTo(lx, side * 4); ctx.lineTo(lx - 3, side * 9); ctx.lineTo(lx - 1, side * 13); ctx.stroke();
    }
  }
  outline(ctx, 2.4);
  // брюшко с полосами
  ell(ctx, -11, 0, 12.5, 7.5);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = dark;
  for (const sx of [-18, -11.5, -5]) ctx.fillRect(sx - 1.8, -10, 3.6, 20);
  ctx.restore();
  ell(ctx, -11, 0, 12.5, 7.5);
  ctx.stroke();
  ctx.fillStyle = light;
  ell(ctx, -8.5, -3.5, 2.6, 1.3);
  ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(-29, 0); ctx.lineTo(-22, 2); ctx.closePath(); ctx.fill();
  outline(ctx, 2.4);
  ell(ctx, 1, 0, 6.5, 6);
  fs(ctx, dark);
  ctx.fillStyle = '#5a5a5a';
  ell(ctx, 0, -2, 2.5, 1.4);
  ctx.fill();
  ell(ctx, 11, 0, 5.5, 5.5);
  fs(ctx, dark);
  ctx.fillStyle = '#6a4a2a';
  ell(ctx, 12, -3.5, 2.4, 3.2); ctx.fill();
  ell(ctx, 12, 3.5, 2.4, 3.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  circle(ctx, 12.8, -4.2, 0.9); ctx.fill();
  circle(ctx, 12.8, 2.8, 0.9); ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, -3); ctx.quadraticCurveTo(20, -8, 24, -7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 3); ctx.quadraticCurveTo(20, 8, 24, 7); ctx.stroke();
  ctx.restore();
}

/** Термитная матка: огромное бледное брюхо, маленькая голова, еле ползёт. */
export function drawTermiteQueen(ctx: Ctx, x: number, y: number, angle: number, s: number, legPhase: number, time: number, royal = false): void {
  const kind: SpriteKind = royal ? 'empress' : 'queen';
  if (spriteDrawer && spriteDrawer(kind, ctx, x, y, angle, s * spriteScale(kind), legPhase)) return;
  const body = royal ? '#d9c7a6' : PAL.termite;
  const head = royal ? '#7a3f10' : '#a85a1f';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const pulse = 1 + 0.03 * Math.sin(time * 3);
  legs6(ctx, legPhase, [22, 14, 6], 11, 20, 3);
  outline(ctx, 3);
  ell(ctx, -22, 0, 40 * pulse, 19 * pulse);
  fs(ctx, body);
  ctx.strokeStyle = 'rgba(150,100,40,0.45)';
  ctx.lineWidth = 2;
  for (const sx of [-50, -40, -30, -20, -10, 0]) {
    ctx.beginPath(); ctx.moveTo(sx, -17 * pulse); ctx.quadraticCurveTo(sx - 2, 0, sx, 17 * pulse); ctx.stroke();
  }
  ctx.fillStyle = PAL.termiteLight;
  ell(ctx, -28, -8, 16, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,130,60,0.35)';
  for (const [dx, dy] of [[-45, 4], [-30, 9], [-14, -6], [-5, 8]] as const) {
    ell(ctx, dx, dy, 4, 2.5);
    ctx.fill();
  }
  outline(ctx, 3);
  ell(ctx, 16, 0, 10, 8);
  fs(ctx, body);
  if (royal) {
    ctx.fillStyle = PAL.honey;
    ell(ctx, 16, 0, 4, 7);
    ctx.fill();
  }
  ell(ctx, 30, 0, 10, 8.5);
  fs(ctx, head);
  if (royal) {
    // корона из хитиновых шипов
    for (const [dx, dy] of [[24, -7], [29, -9], [34, -7]] as const) {
      ctx.beginPath(); ctx.moveTo(dx - 3, dy); ctx.lineTo(dx, dy - 9); ctx.lineTo(dx + 3, dy); ctx.closePath();
      fs(ctx, PAL.honey);
    }
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(37, -4); ctx.quadraticCurveTo(46, -7, 48, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(37, 4); ctx.quadraticCurveTo(46, 7, 48, 0); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(34, -7); ctx.lineTo(42, -15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, 7); ctx.lineTo(42, 15); ctx.stroke();
  ctx.fillStyle = OUT;
  circle(ctx, 32, -4, 1.8); ctx.fill();
  circle(ctx, 32, 4, 1.8); ctx.fill();
  ctx.restore();
}

/** Стрекоза: длинное тело, четыре прозрачных крыла, огромные глаза. Летает быстро. */
export function drawDragonfly(ctx: Ctx, x: number, y: number, angle: number, s: number, time: number): void {
  if (spriteDrawer && spriteDrawer('dragonfly', ctx, x, y, angle, s * SPRITE_PER_VECTOR, time * 16)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const flap = Math.abs(Math.sin(time * 42));
  ctx.fillStyle = 'rgba(220,245,255,0.5)';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.2;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(2, side * 3);
    ctx.rotate(side * (0.25 + flap * 0.35));
    ell(ctx, -8, 0, 22, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(-4, side * 3);
    ctx.rotate(side * (0.55 + flap * 0.35));
    ell(ctx, -10, 0, 20, 4.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  outline(ctx, 2.4);
  for (let i = 0; i < 6; i++) {
    ell(ctx, -8 - i * 6, 0, 4.2, 3 - i * 0.2);
    fs(ctx, i % 2 === 0 ? '#3fb9c9' : '#2a8ea0');
  }
  ell(ctx, 2, 0, 7, 6);
  fs(ctx, '#2f8f6f');
  ell(ctx, 12, 0, 6, 6);
  fs(ctx, '#2a6f55');
  ctx.fillStyle = '#9be36a';
  ell(ctx, 14, -4, 3.6, 3.2); ctx.fill();
  ell(ctx, 14, 4, 3.6, 3.2); ctx.fill();
  ctx.fillStyle = OUT;
  circle(ctx, 15, -4, 1.3); ctx.fill();
  circle(ctx, 15, 4, 1.3); ctx.fill();
  ctx.restore();
}

/** Пиявка: тёмно-красный сегментированный червь с присоской, извивается на ходу. */
export function drawLeech(ctx: Ctx, x: number, y: number, angle: number, s: number, phase: number): void {
  if (spriteDrawer && spriteDrawer('leech', ctx, x, y, angle, s * SPRITE_PER_VECTOR, phase)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  outline(ctx, 2.6);
  for (let i = 7; i >= 0; i--) {
    const px = 16 - i * 6;
    const py = Math.sin(phase * 0.6 + i * 0.8) * 3;
    const r = 7 + Math.sin(i * 0.9) * 2.5;
    ell(ctx, px, py, r + 2, r);
    fs(ctx, i % 2 === 0 ? '#6e2a2a' : '#8a3a36');
    ctx.fillStyle = 'rgba(255,200,180,0.25)';
    ell(ctx, px, py - r * 0.5, r * 0.6, r * 0.25);
    ctx.fill();
    outline(ctx, 2.6);
  }
  circle(ctx, 22, 0, 5.5);
  fs(ctx, '#4a1a1a');
  ctx.fillStyle = '#2a0a0a';
  circle(ctx, 23, 0, 2.6);
  ctx.fill();
  ctx.restore();
}

/** Слизень: медленный толстяк, тянет за собой блестящий след. */
export function drawSlug(ctx: Ctx, x: number, y: number, angle: number, s: number, phase: number): void {
  if (spriteDrawer && spriteDrawer('slug', ctx, x, y, angle, s * SPRITE_PER_VECTOR, phase)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s * (1 + 0.05 * Math.sin(phase)), s * (1 - 0.04 * Math.sin(phase)));
  ctx.fillStyle = 'rgba(210,230,160,0.35)';
  ell(ctx, -30, 3, 14, 6);
  ctx.fill();
  outline(ctx, 2.8);
  ell(ctx, -2, 5, 24, 8);
  fs(ctx, '#9c8a52');
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.quadraticCurveTo(-26, -14, -6, -14);
  ctx.quadraticCurveTo(14, -16, 22, -2);
  ctx.quadraticCurveTo(24, 6, 16, 6);
  ctx.lineTo(-20, 7);
  ctx.closePath();
  fs(ctx, '#7d8a3a');
  ctx.fillStyle = '#5e6b2a';
  for (const [dx, dy, r] of [[-14, -5, 3.5], [-4, -9, 2.8], [6, -6, 3.2], [-9, 1, 2.2]] as const) {
    circle(ctx, dx, dy, r);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ell(ctx, -6, -10, 9, 2.5, 0.1);
  ctx.fill();
  outline(ctx, 2.4);
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(16, side * 3); ctx.quadraticCurveTo(22, side * 8, 27, side * 12); ctx.stroke();
    circle(ctx, 27, side * 12, 3.2);
    fs(ctx, '#e8e0c0');
    ctx.fillStyle = OUT;
    circle(ctx, 28, side * 12, 1.4);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHealthBar(ctx: Ctx, x: number, y: number, w: number, frac: number): void {
  const h = 5;
  ctx.fillStyle = OUT;
  ctx.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = frac > 0.5 ? PAL.uiGreen : frac > 0.25 ? PAL.honey : PAL.uiRed;
  ctx.fillRect(x - w / 2, y, Math.max(0, w * frac), h);
}

// ───────────────────────── постройки ─────────────────────────

export function drawMound(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 3);
  ell(ctx, x, y + r * 0.12, r, r * 0.55);
  fs(ctx, PAL.mound);
  ctx.fillStyle = PAL.moundLight;
  ell(ctx, x - r * 0.15, y - r * 0.02, r * 0.6, r * 0.25);
  ctx.fill();
}

/**
 * Стиль построек по ландшафту акта: в Азии бамбук, в горах камень и т.п. Пока готов эталон —
 * бамбуковые стрелки; остальные башни и стили рисуются по-прежнему, пока эталон не утверждён.
 */
let towerStyle: Biome | null = null;
export function setTowerStyle(style: Biome | null): void {
  towerStyle = style;
}

/** Соломенная шляпа-каса на голове муравья (вид сверху): круг с лучами плетения. */
function kasa(ctx: Ctx, x: number, y: number, r: number): void {
  drawShadow(ctx, x + 1.5, y + 2, r, r * 0.8, 0.22);
  outline(ctx, 1.8);
  circle(ctx, x, y, r);
  fs(ctx, '#e3bf72');
  ctx.strokeStyle = 'rgba(150,105,40,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = '#c99a4a';
  circle(ctx, x, y, r * 0.22);
  ctx.fill();
}

/** Бумажный фонарь: красный шар с золотыми крышками и тёплым светом. */
function paperLantern(ctx: Ctx, x: number, y: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
  g.addColorStop(0, 'rgba(255,200,90,0.5)');
  g.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = g;
  circle(ctx, x, y, 16);
  ctx.fill();
  outline(ctx, 2);
  ell(ctx, x, y, 6.5, 8);
  fs(ctx, '#d8452f');
  ctx.strokeStyle = 'rgba(120,30,10,0.5)';
  ctx.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) { ell(ctx, x, y, 6.5 * Math.cos(k), 8); ctx.stroke(); }
  outline(ctx, 1.6);
  ctx.beginPath(); ctx.rect(x - 3.5, y - 10, 7, 3); fs(ctx, '#f2c94c');
  ctx.beginPath(); ctx.rect(x - 3.5, y + 7, 7, 3); fs(ctx, '#f2c94c');
}

/**
 * Бамбуковые стрелки (Азия): связка стеблей бамбука на каменном основании, плетёный настил,
 * на нём муравьи в соломенных шляпах. 2-й уровень — красное знамя-нобори, 3-й — бумажный фонарь.
 * Специализации: снайперы — высокий шест с вымпелом, залп — широкий настил и четверо стрелков.
 */
function drawTowerAcidBamboo(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  drawShadow(ctx, x, y + 10, 38, 14);
  const lv = Math.min(level, 3);
  const h = 32 + lv * 8 + (level >= 4 ? 6 : 0);
  const rw = 17 + lv + (variant === 2 ? 6 : 0);
  const top = y - h;
  // Каменное основание.
  outline(ctx, 2.5);
  ell(ctx, x, y + 2, rw + 12, 11);
  fs(ctx, '#9d998f');
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ell(ctx, x - 8, y - 1, rw * 0.6, 4);
  ctx.fill();
  // Стебли: задний ряд выше, у каждого узлы.
  const n = 5 + Math.min(lv - 1, 2) + (variant === 2 ? 1 : 0);
  const stalk = (sx: number, sTop: number, col: string): void => {
    outline(ctx, 2.2);
    ctx.beginPath();
    ctx.rect(sx - 3.6, sTop, 7.2, y - sTop);
    fs(ctx, col);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(sx - 2.4, sTop + 2, 1.6, y - sTop - 4);
    ctx.strokeStyle = '#4f7a24';
    ctx.lineWidth = 1.6;
    for (let ny = y - 10; ny > sTop + 4; ny -= 12) {
      ctx.beginPath(); ctx.moveTo(sx - 3.6, ny); ctx.lineTo(sx + 3.6, ny); ctx.stroke();
    }
    outline(ctx, 1.6);
    ell(ctx, sx, sTop, 3.6, 1.6);
    fs(ctx, '#e9e2b8');
  };
  for (let i = 0; i < n; i++) {
    const sx = x - rw + 3 + (i * (2 * rw - 6)) / (n - 1);
    stalk(sx, top - (i % 2 ? 0 : 5), i % 2 ? '#8fbf4a' : '#a3cd58');
  }
  // Верёвочные обвязки.
  for (const k of [0.3, 0.68]) {
    const by = y - h * k;
    outline(ctx, 2);
    ctx.beginPath();
    ctx.rect(x - rw - 1, by - 2.5, 2 * rw + 2, 5);
    fs(ctx, '#d8c08a');
    ctx.strokeStyle = 'rgba(120,90,40,0.6)';
    ctx.lineWidth = 1;
    for (let rx = x - rw; rx < x + rw; rx += 5) { ctx.beginPath(); ctx.moveTo(rx, by - 2.5); ctx.lineTo(rx + 3, by + 2.5); ctx.stroke(); }
  }
  // Плетёный настил наверху.
  outline(ctx, 2.5);
  ell(ctx, x, top, rw + 6, 8.5);
  fs(ctx, '#d9b98a');
  ctx.save();
  ell(ctx, x, top, rw + 6, 8.5);
  ctx.clip();
  ctx.strokeStyle = 'rgba(140,100,50,0.55)';
  ctx.lineWidth = 1.2;
  for (let k = -rw - 6; k < rw + 6; k += 5) {
    ctx.beginPath(); ctx.moveTo(x + k, top - 9); ctx.lineTo(x + k + 8, top + 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + k + 8, top - 9); ctx.lineTo(x + k, top + 9); ctx.stroke();
  }
  ctx.restore();
  // 2-й уровень: красное знамя на бамбуковом шесте справа.
  if (level >= 2 && variant !== 1) {
    const px = x + rw + 6;
    twig(ctx, px, y - 4, px, top - 34, 3);
    outline(ctx, 2);
    ctx.beginPath(); ctx.rect(px - 13, top - 32, 11, 26); fs(ctx, '#c8452f');
    circle(ctx, px - 7.5, top - 21, 3.2);
    fs(ctx, '#f2c94c');
  }
  // 3-й уровень: бумажный фонарь на изогнутом шесте слева.
  if (level >= 3 && variant !== 1) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - rw + 2, top + 6); ctx.quadraticCurveTo(x - rw - 10, top - 18, x - rw - 16, top - 14); ctx.stroke();
    ctx.strokeStyle = '#8fbf4a';
    ctx.lineWidth = 3;
    ctx.stroke();
    paperLantern(ctx, x - rw - 16, top - 2);
  }
  // Снайперы: высокий шест с вымпелом за стрелком.
  if (variant === 1) {
    twig(ctx, x + 6, top + 2, x + 6, top - 46, 3);
    pennant(ctx, x + 6, top - 46, 24, 13, '#c8452f');
    paperLantern(ctx, x - rw - 6, top + 10);
  }
  const offs: ReadonlyArray<readonly [number, number]> =
    variant === 1 ? [[0, -1]]
      : variant === 2 ? [[-14, -3], [-5, 0], [5, 0], [14, -3]]
        : level === 1 ? [[0, -1]] : level === 2 ? [[-7, 0], [7, -2]] : [[-9, -2], [0, 1], [9, -3]];
  const as = variant === 1 ? 0.78 : 0.6;
  const rx = Math.cos(angle) * recoil * 3;
  const ry = Math.sin(angle) * recoil * 3;
  for (const [ox, oy] of offs) {
    const ax = x + ox - rx;
    const ay = top + oy - ry;
    drawAnt(ctx, ax, ay, angle, as, ANT_WORKER, 0, false);
    kasa(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 8.5 * as / 0.6);
  }
}

/** Стрелки: пень-башня, на срезе стоят муравьи-плевальщики. */
export function drawTowerAcid(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant = 0): void {
  if (towerStyle === 'asia') {
    drawTowerAcidBamboo(ctx, x, y, level, angle, recoil, variant);
    return;
  }
  drawShadow(ctx, x, y + 10, 36, 14);
  drawMound(ctx, x, y, 32);
  const h = 30 + Math.min(level, 3) * 7 + (level >= 4 ? 4 : 0);
  const rw = 17 + Math.min(level, 3) + (variant === 2 ? 5 : 0);
  const top = y - h;
  outline(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(x - rw, y);
  ctx.lineTo(x - rw + 1.5, top);
  ctx.lineTo(x + rw - 1.5, top);
  ctx.lineTo(x + rw, y);
  ctx.closePath();
  fs(ctx, PAL.twig);
  ctx.strokeStyle = 'rgba(40,20,5,0.35)';
  ctx.lineWidth = 2;
  for (const k of [-0.55, -0.15, 0.3]) {
    ctx.beginPath(); ctx.moveTo(x + k * rw, y - 4); ctx.lineTo(x + k * rw + 1, top + 6); ctx.stroke();
  }
  ctx.fillStyle = PAL.twigLight;
  ctx.fillRect(x - rw * 0.75, top + 6, 3.5, h - 12);
  outline(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x, y, rw, 7, 0, 0, Math.PI);
  fs(ctx, PAL.moundDark);
  ell(ctx, x, top, rw, 7.5);
  fs(ctx, '#d9b27a');
  ctx.strokeStyle = '#b08a55';
  ctx.lineWidth = 1.5;
  ell(ctx, x, top, rw * 0.65, 4.5);
  ctx.stroke();
  ell(ctx, x, top, rw * 0.3, 2);
  ctx.stroke();
  if (level >= 2) {
    twig(ctx, x + rw - 4, top + 4, x + rw + 10, top - 26, 3);
    leaf(ctx, x + rw + 12, top - 30, 20, 8, -0.5);
  }
  if (level >= 3) {
    twig(ctx, x - rw + 4, top + 4, x - rw - 8, top - 22, 3);
    leaf(ctx, x - rw - 10, top - 26, 17, 7, 0.5);
  }
  if (variant === 1) {
    twig(ctx, x, top + 2, x - 3, top - 36, 3);
    pennant(ctx, x - 3, top - 36, 20, 12, PAL.honey);
  }
  const offs: ReadonlyArray<readonly [number, number]> =
    variant === 1 ? [[0, -1]]
      : variant === 2 ? [[-13, -3], [-4, 0], [4, 0], [13, -3]]
        : level === 1 ? [[0, -1]] : level === 2 ? [[-7, 0], [7, -2]] : [[-9, -2], [0, 1], [9, -3]];
  const as = variant === 1 ? 0.78 : 0.6;
  const rx = Math.cos(angle) * recoil * 3;
  const ry = Math.sin(angle) * recoil * 3;
  for (const [ox, oy] of offs) drawAnt(ctx, x + ox - rx, top + oy - ry, angle, as, ANT_WORKER, 0, false);
}

export function drawTowerBarracks(ctx: Ctx, x: number, y: number, level: number, variant = 0): void {
  drawShadow(ctx, x, y + 12, 44, 16);
  outline(ctx, 3);
  const lv = Math.min(level, 3);
  const rx = 36 + lv * 2;
  const ryTop = 32 + lv * 3;
  const ryBase = 15;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, rx, ryTop, 0, Math.PI, TAU);
  ctx.ellipse(x, y + 4, rx, ryBase, 0, 0, Math.PI);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - ryTop, 0, y + 20);
  g.addColorStop(0, PAL.moundLight);
  g.addColorStop(1, PAL.moundDark);
  fs(ctx, g);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ell(ctx, x - 12, y - 16, 12, 7, -0.3);
  ctx.fill();
  if (level >= 2) {
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      pebble(ctx, x + Math.cos(a) * rx * 0.95, y + 4 + Math.sin(a) * ryBase * 0.95, 4.5, 3.2);
    }
  }
  outline(ctx, 2.5);
  ell(ctx, x, y + 4, 12, 9);
  fs(ctx, '#3a2412');
  ctx.fillStyle = '#120803';
  ell(ctx, x, y + 2, 8, 5);
  ctx.fill();
  if (variant === 1) {
    outline(ctx, 2.5);
    ell(ctx, x - 15, y - 12, 9, 11);
    fs(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneLight;
    ell(ctx, x - 17, y - 15, 4, 5);
    ctx.fill();
  }
  if (variant === 2) {
    twig(ctx, x - 22, y - 30, x + 8, y - 62, 3);
    twig(ctx, x + 4, y - 30, x - 26, y - 62, 3);
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 60); ctx.lineTo(x + 14, y - 70); ctx.lineTo(x + 11, y - 58); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 24, y - 60); ctx.lineTo(x - 32, y - 70); ctx.lineTo(x - 29, y - 58); ctx.closePath(); ctx.fill();
  }
  const fx = x + 18;
  const fy = y - ryTop + 12;
  twig(ctx, fx, fy, fx, fy - 34 - lv * 6, 3.5);
  pennant(ctx, fx, fy - 34 - lv * 6, 26, 14, variant === 2 ? PAL.honey : PAL.flag);
  if (level >= 3) pennant(ctx, fx, fy - 16 - lv * 6, 20, 11, variant === 1 ? PAL.stoneLight : PAL.honey);
}

export function drawTowerCatapult(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant = 0): void {
  drawShadow(ctx, x, y + 10, 38, 14);
  drawMound(ctx, x, y, 32);
  outline(ctx, 3);
  ell(ctx, x, y - 6, variant === 1 ? 34 : 28, variant === 1 ? 16 : 13);
  fs(ctx, PAL.stone);
  ctx.fillStyle = PAL.stoneLight;
  ell(ctx, x - 8, y - 10, 12, 4);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 12);
  ctx.rotate(angle);
  twig(ctx, -14, -10, 14, -10, 3.5);
  twig(ctx, -14, 10, 14, 10, 3.5);
  twig(ctx, -14, -10, -14, 10, 3.5);
  twig(ctx, 14, -10, 14, 10, 3.5);
  if (level >= 2) {
    ctx.strokeStyle = PAL.honeyDark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-13 + i * 3, 0, 4 - i * 0.6, 0, TAU); ctx.stroke(); }
  }
  const len = 30 + Math.min(level, 3) * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  twig(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5);
  outline(ctx, 2.5);
  ell(ctx, tx, ty, variant === 2 ? 13 : 9, variant === 2 ? 8 : 6);
  fs(ctx, PAL.leaf);
  if (p < 0.5) {
    if (variant === 1) {
      circle(ctx, tx, ty, 7.5);
      fs(ctx, PAL.stone);
      ctx.fillStyle = PAL.stoneLight;
      circle(ctx, tx - 2.5, ty - 2.5, 2.5);
      ctx.fill();
    } else {
      circle(ctx, tx, ty, 5);
      fs(ctx, '#8b5a2b');
      if (level >= 3) { circle(ctx, tx + 5, ty - 3, 3.5); fs(ctx, '#8b5a2b'); }
      if (variant === 2) {
        circle(ctx, tx - 6, ty - 3, 3.5); fs(ctx, '#8b5a2b');
        circle(ctx, tx, ty - 6, 3); fs(ctx, '#8b5a2b');
      }
    }
  }
  circle(ctx, 0, 0, 5.5);
  fs(ctx, PAL.stoneDark);
  ctx.restore();
}

export function mushroom(ctx: Ctx, cx: number, cy: number, r: number, seed: number, cap: string = PAL.mushroomCap, dot = '#fff3e6'): void {
  outline(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.38, cy - r * 0.2);
  ctx.lineTo(cx - r * 0.45, cy + r * 0.75);
  ctx.quadraticCurveTo(cx, cy + r * 0.95, cx + r * 0.45, cy + r * 0.75);
  ctx.lineTo(cx + r * 0.38, cy - r * 0.2);
  ctx.closePath();
  fs(ctx, PAL.mushroomStem);
  const capY = cy - r * 0.25;
  ctx.beginPath();
  ctx.ellipse(cx, capY, r, r * 0.78, 0, Math.PI, TAU);
  ctx.ellipse(cx, capY, r, r * 0.28, 0, 0, Math.PI);
  ctx.closePath();
  fs(ctx, cap);
  ctx.fillStyle = dot;
  const dots: ReadonlyArray<readonly [number, number, number]> = [[-0.45, -0.25, 0.16], [0.1, -0.5, 0.2], [0.5, -0.15, 0.13], [-0.1, -0.05, 0.1]];
  for (let i = 0; i < dots.length; i++) {
    const [dx, dy, dr] = dots[(i + seed) % dots.length];
    ell(ctx, cx + dx * r, capY + dy * r * 0.7, dr * r, dr * r * 0.8);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ell(ctx, cx - r * 0.35, capY - r * 0.45, r * 0.3, r * 0.12, -0.4);
  ctx.fill();
}

export function drawTowerSpore(ctx: Ctx, x: number, y: number, level: number, time: number, variant = 0): void {
  drawShadow(ctx, x, y + 10, 36, 14);
  drawMound(ctx, x, y, 30);
  const cap = variant === 1 ? '#8a6a2a' : variant === 2 ? '#7a3fb0' : PAL.mushroomCap;
  const dot = variant === 1 ? '#c9b26a' : variant === 2 ? '#e6c8ff' : '#fff3e6';
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  const g = ctx.createRadialGradient(x, y - 4, 2, x, y - 4, 40);
  g.addColorStop(0, `rgba(${glow},${0.45 * pulse})`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  ell(ctx, x, y - 2, 42, 22);
  ctx.fill();
  const lv = Math.min(level, 3);
  const small: ReadonlyArray<readonly [number, number, number]> = [[x - 21, y + 2, 11], [x + 22, y - 1, 13], [x + 6, y + 10, 9]];
  for (let i = 0; i < lv; i++) mushroom(ctx, small[i][0], small[i][1], small[i][2], i, cap, dot);
  mushroom(ctx, x, y - 12, 22 + lv * 2 + (variant ? 4 : 0), 7, cap, dot);
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 16;
    const sy = y - 20 - t * 46;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.8})`;
    circle(ctx, sx, sy, 2.5 + (1 - t) * 1.5);
    ctx.fill();
  }
}

export function drawTowerIcon(ctx: Ctx, kind: TowerKind, x: number, y: number, s: number, level = 1, variant = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const dy = level >= 4 ? 22 : 12;
  switch (kind) {
    case 'acid': drawTowerAcid(ctx, 0, dy + 2, level, -Math.PI / 2, 0, variant); break;
    case 'barracks': drawTowerBarracks(ctx, 0, dy, level, variant); break;
    case 'catapult': drawTowerCatapult(ctx, 0, dy, level, -Math.PI / 2, 0, variant); break;
    case 'spore': drawTowerSpore(ctx, 0, dy, level, 0, variant); break;
  }
  ctx.restore();
}

export function drawRange(ctx: Ctx, x: number, y: number, r: number, rgb = '255,255,255'): void {
  ctx.fillStyle = `rgba(${rgb},0.10)`;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.6)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawAnthill(ctx: Ctx, x: number, y: number, rng: Rng): void {
  drawShadow(ctx, x, y + 40, 105, 22, 0.22);
  outline(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(x - 100, y + 32);
  ctx.bezierCurveTo(x - 75, y - 15, x - 45, y - 72, x, y - 78);
  ctx.bezierCurveTo(x + 45, y - 72, x + 75, y - 15, x + 100, y + 32);
  ctx.quadraticCurveTo(x, y + 66, x - 100, y + 32);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - 78, 0, y + 50);
  g.addColorStop(0, PAL.moundLight);
  g.addColorStop(0.55, PAL.mound);
  g.addColorStop(1, PAL.moundDark);
  fs(ctx, g);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    const px = x + rng.range(-95, 95);
    const py = y + rng.range(-70, 45);
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
    ell(ctx, px, py, rng.range(3, 8), rng.range(2, 5));
    ctx.fill();
  }
  ctx.restore();
  outline(ctx, 2.5);
  ell(ctx, x - 52, y + 24, 11, 6);
  fs(ctx, '#3a2412');
  outline(ctx, 3);
  ell(ctx, x, y + 8, 26, 14);
  fs(ctx, '#3a2412');
  ctx.fillStyle = '#140903';
  ell(ctx, x, y + 5, 17, 8);
  ctx.fill();
  twig(ctx, x + 40, y - 30, x + 78, y - 52, 4);
  twig(ctx, x - 70, y - 10, x - 96, y - 30, 3.5);
  for (let i = 0; i < 7; i++) grassTuft(ctx, x - 90 + i * 30 + rng.range(-6, 6), y + 36 + rng.range(-4, 6), rng);
  twig(ctx, x + 28, y - 44, x + 28, y - 125, 4);
  pennant(ctx, x + 28, y - 125, 46, 26, PAL.flag);
  ctx.fillStyle = PAL.honey;
  circle(ctx, x + 44, y - 113, 5);
  ctx.fill();
}

// ───────────────────────── декор и террейн ─────────────────────────

export function grassTuft(ctx: Ctx, x: number, y: number, rng: Rng, dark: string = PAL.grassDark, light: string = PAL.grassLight): void {
  ctx.strokeStyle = rng.next() < 0.5 ? dark : light;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.5, y - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 8); ctx.stroke();
}
export function flower(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.strokeStyle = PAL.grassDark;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 12); ctx.stroke();
  outline(ctx, 1.5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    circle(ctx, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.8);
    fs(ctx, color);
  }
  circle(ctx, x, y, 3);
  fs(ctx, PAL.honey);
}
function clover(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = PAL.grassDark;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + r * 2); ctx.stroke();
  outline(ctx, 1.5);
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
    circle(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r);
    fs(ctx, PAL.grassDark);
  }
}
function twigDecor(ctx: Ctx, x: number, y: number, rng: Rng): void {
  const a = rng.range(0, TAU);
  const len = rng.range(16, 30);
  const x2 = x + Math.cos(a) * len;
  const y2 = y + Math.sin(a) * len;
  twig(ctx, x, y, x2, y2, 3);
  const bx = x + Math.cos(a) * len * 0.6;
  const by = y + Math.sin(a) * len * 0.6;
  twig(ctx, bx, by, bx + Math.cos(a + 0.9) * 9, by + Math.sin(a + 0.9) * 9, 2.2);
}

export interface TerrainInput {
  w: number;
  h: number;
  paths: readonly Path[];
  plots: readonly Vec[];
  anthill: Vec;
  rng: Rng;
  theme: LevelTheme;
  /** Прямоугольники, где декор не нужен (под HUD). */
  reserved: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
  /** Видимая область: на широких и высоких экранах мир дорисовывается на полях вокруг кадра. */
  view?: ViewBox;
  /** Генератор для полей: декор самого кадра не перетасовывается от того, широкий ли экран. */
  marginRng?: Rng;
}

/** Видимая часть мира в логических координатах (кадр 1280x720 плюс поля). */
export interface ViewBox { x0: number; y0: number; x1: number; y1: number }

/** Тропа начинается за краем кадра: откуда она приходит (точка начала и направление вдоль тропы). */
export interface PathLead { x: number; y: number; dx: number; dy: number }

/** Длина продолжения тропы на полях: с запасом до края любого экрана. */
const LEAD_LEN = 600;

export function pathLead(path: Path, w: number, h: number): PathLead | null {
  const s = path.pts[0];
  if (s.x >= 0 && s.x <= w && s.y >= 0 && s.y <= h) return null;
  const a = path.at(0).angle;
  return { x: s.x, y: s.y, dx: Math.cos(a), dy: Math.sin(a) };
}

/** Сколько продолжения тропы видно от её начала до края видимой области; 0, если начало за краем экрана. */
export function leadRoom(l: PathLead, v: ViewBox): number {
  let t = Infinity;
  if (l.dx > 1e-6) t = Math.min(t, (l.x - v.x0) / l.dx);
  if (l.dx < -1e-6) t = Math.min(t, (v.x1 - l.x) / -l.dx);
  if (l.dy > 1e-6) t = Math.min(t, (l.y - v.y0) / l.dy);
  if (l.dy < -1e-6) t = Math.min(t, (v.y1 - l.y) / -l.dy);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - (ax + vx * k), py - (ay + vy * k));
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Сдвиг цвета к белому (k > 0) или к чёрному (k < 0) на долю |k|: заметен и на тёмных темах. */
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = k > 0 ? 255 : 0;
  const f = Math.abs(k);
  const ch = (v: number) => Math.round(v + (target - v) * f);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function puddle(ctx: Ctx, x: number, y: number, rng: Rng): void {
  const rx = rng.range(14, 26);
  const ry = rx * rng.range(0.45, 0.65);
  ctx.fillStyle = 'rgba(60,110,160,0.35)';
  ell(ctx, x, y, rx + 3, ry + 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,180,220,0.55)';
  ell(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ell(ctx, x - rx * 0.3, y - ry * 0.3, rx * 0.35, ry * 0.3, -0.3);
  ctx.fill();
}

function glowSpot(ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
}

/** Гнилой пень: отсюда выходят термиты. Нора у подножия, спереди. */
export function drawStump(ctx: Ctx, x: number, y: number, rng: Rng): void {
  drawShadow(ctx, x, y + 50, 90, 24, 0.3);
  outline(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(x - 70, y - 20);
  ctx.lineTo(x - 66, y + 40);
  ctx.quadraticCurveTo(x, y + 62, x + 66, y + 40);
  ctx.lineTo(x + 70, y - 20);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
  g.addColorStop(0, '#3e2816');
  g.addColorStop(0.5, '#5a3b22');
  g.addColorStop(1, '#35210f');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const bx = x - 60 + i * 15 + rng.range(-3, 3);
    ctx.beginPath(); ctx.moveTo(bx, y - 14); ctx.lineTo(bx + rng.range(-4, 4), y + 36 + rng.range(-6, 6)); ctx.stroke();
  }
  outline(ctx, 4);
  ctx.beginPath();
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const jag = i % 2 === 0 ? 1 : 0.9 + rng.range(-0.04, 0.08);
    const px = x + Math.cos(a) * 70 * jag;
    const py = y - 20 + Math.sin(a) * 34 * jag;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fs(ctx, '#8a6a3c');
  ctx.strokeStyle = 'rgba(70,45,20,0.5)';
  ctx.lineWidth = 2;
  for (const k of [0.75, 0.55, 0.35, 0.18]) {
    ell(ctx, x - 4, y - 20, 66 * k, 31 * k);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(60,35,15,0.55)';
  ell(ctx, x + 18, y - 26, 16, 8, 0.3);
  ctx.fill();
  ell(ctx, x - 30, y - 12, 10, 5, -0.4);
  ctx.fill();
  ctx.fillStyle = '#5f8f3b';
  for (const [dx, dy, r] of [[-62, -8, 9], [-48, 28, 7], [58, 10, 8], [40, -34, 6]] as const) {
    circle(ctx, x + dx, y + dy, r);
    ctx.fill();
  }
  outline(ctx, 2.5);
  for (const [dx, dy, w] of [[-70, 12, 14], [-66, 26, 11], [68, 2, 12]] as const) {
    ell(ctx, x + dx, y + dy, w, w * 0.4);
    fs(ctx, '#c9a06a');
  }
  outline(ctx, 3);
  ell(ctx, x, y + 22, 26, 15);
  fs(ctx, '#2a1608');
  ctx.fillStyle = '#0d0603';
  ell(ctx, x, y + 20, 17, 9);
  ctx.fill();
}

/** Ручей поперёк карты: берега, вода с бликами, камни. */
function drawWater(ctx: Ctx, w: number, band: { y: number; h: number }, rng: Rng, v: ViewBox, mr: Rng): void {
  const { y, h } = band;
  const edgeTop = (x: number) => y + Math.sin(x * 0.03) * 4;
  const edgeBottom = (x: number) => y + h + Math.cos(x * 0.025) * 4;
  // Точки берега с шагом 40 от нуля: в кадре те же вершины, что и раньше, на полях продолжение.
  const a = Math.min(0, Math.floor(v.x0 / 40) * 40 - 40);
  const b = Math.max(w, Math.ceil(v.x1 / 40) * 40 + 40);
  const shape = (off: number): void => {
    ctx.beginPath();
    ctx.moveTo(a, edgeTop(a) - off);
    for (let x = a; x <= b; x += 40) ctx.lineTo(x, edgeTop(x) - off);
    for (let x = b; x >= a; x -= 40) ctx.lineTo(x, edgeBottom(x) + off);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#9c7f55';
  shape(14);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#4f8fc0');
  g.addColorStop(1, '#3a6f9c');
  ctx.fillStyle = g;
  shape(0);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const ripple = (rx: number, ry: number): void => {
    ctx.beginPath(); ctx.moveTo(rx - 10, ry); ctx.quadraticCurveTo(rx, ry - 3, rx + 10, ry); ctx.stroke();
  };
  for (let i = 0; i < 44; i++) ripple(rng.range(10, w - 10), rng.range(y + 10, y + h - 10));
  // Поля: та же плотность ряби и камней, что в кадре.
  const left = Math.max(0, -v.x0);
  const right = Math.max(0, v.x1 - w);
  const sideX = (pad: number): number => (mr.next() * (left + right) < left ? mr.range(v.x0 + pad, -pad) : mr.range(w + pad, v.x1 - pad));
  if (left + right > 20) for (let i = 0; i < Math.round((44 * (left + right)) / w); i++) ripple(sideX(10), mr.range(y + 10, y + h - 10));
  for (let i = 0; i < 7; i++) pebble(ctx, rng.range(40, w - 40), rng.range(y + 16, y + h - 16), rng.range(8, 14), rng.range(5, 9));
  if (left + right > 80) {
    for (let i = 0; i < Math.round((7 * (left + right)) / w); i++) pebble(ctx, sideX(40), mr.range(y + 16, y + h - 16), mr.range(8, 14), mr.range(5, 9));
  }
}

/** Бревно-мост там, где тропа пересекает воду. */
function drawBridge(ctx: Ctx, path: Path, band: { y: number; h: number }): void {
  for (const pts of crossings(path, band, 14)) logSpan(ctx, pts);
}

/** Бревно-мост на одной переправе. */
function logSpan(ctx: Ctx, pts: Vec[]): void {
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  const stroke = (wd: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = wd;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };
  stroke(80, OUT);
  stroke(72, '#6b4423');
  stroke(58, '#8d5e34');
  ctx.strokeStyle = 'rgba(40,20,5,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    const n = i + 1 < pts.length ? pts[i + 1] : pts[i - 1];
    const a = Math.atan2(n.y - p.y, n.x - p.x);
    const nx = -Math.sin(a) * 27;
    const ny = Math.cos(a) * 27;
    ctx.beginPath(); ctx.moveTo(p.x - nx, p.y - ny); ctx.lineTo(p.x + nx, p.y + ny); ctx.stroke();
  }
  ctx.lineCap = 'round';
}

/** Стена термитника вдоль верхнего края и норы в начале каждой тропы. */
function drawWall(ctx: Ctx, w: number, h: number, paths: readonly Path[], rng: Rng, v: ViewBox, mr: Rng): void {
  const L = Math.min(-10, v.x0 - 10);
  const R = Math.max(w + 10, v.x1 + 10);
  const T = Math.min(-10, v.y0 - 10);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6b4f32');
  g.addColorStop(1, '#8a6a45');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(L, T);
  ctx.lineTo(R, T);
  ctx.lineTo(R, h - 20);
  for (let x = R; x > w; x -= 30) ctx.lineTo(x, h - 20 + Math.sin(x * 0.05) * 10 + mr.range(-4, 4));
  for (let x = w; x >= 0; x -= 30) ctx.lineTo(x, h - 20 + Math.sin(x * 0.05) * 10 + rng.range(-4, 4));
  for (let x = -30; x >= L; x -= 30) ctx.lineTo(x, h - 20 + Math.sin(x * 0.05) * 10 + mr.range(-4, 4));
  ctx.lineTo(L, h - 20);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  const crack = (r: Rng, x: number, y: number): void => {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-30, 30), y + r.range(5, 25)); ctx.stroke();
  };
  for (let i = 0; i < 24; i++) crack(rng, rng.range(0, w), rng.range(10, h - 40));
  // Поля: трещины и блики с той же плотностью, что в кадре; кадр они не трогают.
  const outside = (x: number, y: number): boolean => x < 0 || x > w || y < 0;
  const extra = ((R - L) * (h - 20 - T)) / (w * (h - 20)) - 1;
  const spot = (pad: number): Vec | null => {
    for (let i = 0; i < 16; i++) {
      const x = mr.range(L + pad, R - pad);
      const y = mr.range(T + pad, h - 40);
      if (outside(x, y)) return { x, y };
    }
    return null;
  };
  for (let i = 0; i < Math.round(24 * extra); i++) {
    const p = spot(10);
    if (p) crack(mr, p.x, p.y);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 30; i++) {
    ell(ctx, rng.range(0, w), rng.range(0, h - 30), rng.range(10, 30), rng.range(5, 12));
    ctx.fill();
  }
  for (let i = 0; i < Math.round(30 * extra); i++) {
    const p = spot(0);
    if (!p) continue;
    ell(ctx, p.x, p.y, mr.range(10, 30), mr.range(5, 12));
    ctx.fill();
  }
  const sh = ctx.createLinearGradient(0, h - 20, 0, h + 30);
  sh.addColorStop(0, 'rgba(0,0,0,0.35)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(L, h - 20, R - L, 50);
  for (const p of paths) {
    const st = p.pts[0];
    outline(ctx, 3);
    ell(ctx, st.x, st.y - 6, 34, 26);
    fs(ctx, '#3a2412');
    ctx.fillStyle = '#120803';
    ell(ctx, st.x, st.y - 4, 24, 17);
    ctx.fill();
  }
}

/** Пещера: виньетка и камни по краям. */
function drawCaveWalls(ctx: Ctx, w: number, h: number, rng: Rng, v: ViewBox, mr: Rng): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  outline(ctx, 3);
  for (let i = 0; i < 26; i++) {
    const top = i % 2 === 0;
    const x = rng.range(-20, w + 20);
    const y = top ? rng.range(-20, 30) : rng.range(h - 30, h + 20);
    ell(ctx, x, y, rng.range(30, 70), rng.range(18, 40), rng.range(-0.4, 0.4));
    fs(ctx, rng.next() < 0.5 ? '#3a2d24' : '#4a3a2e');
  }
  const rock = (x: number, y: number, rx: number, ry: number): void => {
    ell(ctx, x, y, rx, ry, mr.range(-0.4, 0.4));
    fs(ctx, mr.next() < 0.5 ? '#3a2d24' : '#4a3a2e');
  };
  // Боковые поля: та же кромка скал сверху и снизу.
  for (const [xa, xb] of [[v.x0 - 20, -20], [w + 20, v.x1 + 20]]) {
    if (xb - xa < 10) continue;
    const n = Math.round((26 * (xb - xa)) / w) + 2;
    for (let i = 0; i < n; i++) {
      const top = i % 2 === 0;
      rock(mr.range(xa, xb), top ? mr.range(-20, 30) : mr.range(h - 30, h + 20), mr.range(30, 70), mr.range(18, 40));
    }
  }
  // Высокий экран: над и под кадром сплошная скала.
  const band = (ya: number, yb: number): void => {
    for (let y = ya; y < yb; y += 32) {
      for (let x = v.x0 - 40; x < v.x1 + 40; x += 52) rock(x + mr.range(-14, 14), y + mr.range(-8, 8), mr.range(30, 56), mr.range(20, 34));
    }
  };
  if (v.y0 < -12) band(v.y0 - 16, -12);
  if (v.y1 > h + 12) band(h + 24, v.y1 + 24);
}

/** Павший дуб: ствол вдоль верхнего края и корни, уходящие в землю. */
/** Павший дуб; возвращает точки корней, чтобы декор и трава на них не ложились. */
function drawOak(ctx: Ctx, w: number, rng: Rng, v: ViewBox, mr: Rng): Vec[] {
  const roots: Vec[] = [];
  /** Корень: кривая с изгибом, толстая у ствола и тонкая к кончику, с корешками по бокам и тенью на земле. */
  const limb = (r: Rng, x0: number, y0: number, ang: number, len: number, w0: number, depth: number): void => {
    const n = 16;
    const curl = r.range(-0.9, 0.9);
    const wob = r.range(0, TAU);
    const pts: Vec[] = [];
    let x = x0;
    let y = y0;
    let a = ang;
    for (let k = 0; k <= n; k++) {
      pts.push({ x, y });
      a += (curl / n) + Math.sin(k * 0.9 + wob) * 0.07;
      x += Math.cos(a) * (len / n);
      y += Math.sin(a) * (len / n);
    }
    const wAt = (k: number): number => w0 * (1 - (k / n) * 0.8);
    // Боковые корешки рисуются раньше, чтобы их основание пряталось под родительский корень.
    for (const p of pts) roots.push(p);
    if (depth > 0) {
      const branches = r.int(1, 3);
      for (let b = 0; b < branches; b++) {
        const k = r.int(5, n - 3);
        const p = pts[k];
        const t = Math.atan2(pts[k + 1].y - pts[k - 1].y, pts[k + 1].x - pts[k - 1].x);
        limb(r, p.x, p.y, t + r.pick([-1, 1]) * r.range(0.5, 1), len * r.range(0.28, 0.45), wAt(k) * 0.55, depth - 1);
      }
    }
    const outlineOf = (dx: number, dy: number, grow: number): void => {
      const left: Vec[] = [];
      const right: Vec[] = [];
      pts.forEach((p, k) => {
        const q = pts[Math.min(k + 1, n)];
        const o = pts[Math.max(k - 1, 0)];
        const t = Math.atan2(q.y - o.y, q.x - o.x);
        const hw = wAt(k) / 2 + grow;
        left.push({ x: p.x + dx - Math.sin(t) * hw, y: p.y + dy + Math.cos(t) * hw });
        right.push({ x: p.x + dx + Math.sin(t) * hw, y: p.y + dy - Math.cos(t) * hw });
      });
      ctx.beginPath();
      left.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k].x, right[k].y);
      ctx.closePath();
    };
    outlineOf(5, 7, 0);
    ctx.fillStyle = 'rgba(30,20,5,0.22)';
    ctx.fill();
    outlineOf(0, 0, 2.5);
    ctx.fillStyle = OUT;
    ctx.fill();
    outlineOf(0, 0, 0);
    const g = ctx.createLinearGradient(x0 - w0, y0, x0 + w0, y0);
    g.addColorStop(0, '#6e4826');
    g.addColorStop(1, '#4e321a');
    ctx.fillStyle = g;
    ctx.fill();
    // Кора: светлая полоса сверху и тёмные волокна вдоль корня.
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,230,190,0.16)';
    ctx.lineWidth = Math.max(1.5, w0 * 0.22);
    ctx.beginPath();
    pts.slice(0, n - 3).forEach((p, k) => (k === 0 ? ctx.moveTo(p.x - w0 * 0.15, p.y) : ctx.lineTo(p.x - wAt(k) * 0.15, p.y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.4;
    for (let s = -1; s <= 1; s += 2) {
      const from = r.int(1, 5);
      const to = from + r.int(4, 8);
      ctx.beginPath();
      for (let k = from; k <= Math.min(to, n - 2); k++) {
        const p = pts[k];
        const off = s * wAt(k) * 0.22;
        if (k === from) ctx.moveTo(p.x + off, p.y); else ctx.lineTo(p.x + off, p.y);
      }
      ctx.stroke();
    }
  };
  const root = (r: Rng, x0: number): void => {
    const len = r.range(130, 270);
    limb(r, x0, 50, Math.PI / 2 + r.range(-0.45, 0.45), len, r.range(26, 34), 1);
  };
  for (let i = 0; i < 6; i++) root(rng, 80 + i * 220 + rng.range(-40, 40));
  for (let x = -140; x > v.x0 - 60; x -= 220) root(mr, x + mr.range(-40, 40));
  for (let x = w + 120; x < v.x1 + 60; x += 220) root(mr, x + mr.range(-40, 40));
  const L = Math.min(-20, v.x0 - 20);
  const R = Math.max(w + 20, v.x1 + 20);
  outline(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(L, -30);
  ctx.lineTo(R, -30);
  ctx.lineTo(R, 62);
  ctx.quadraticCurveTo(w / 2, 84, L, 62);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -30, 0, 80);
  g.addColorStop(0, '#6b4424');
  g.addColorStop(1, '#4a2c15');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 2 + i * 7 + rng.range(-2, 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    let fy = y;
    let lx = 0;
    let ly = y;
    for (let x = 0; x <= w; x += 60) {
      ly = y + rng.range(-3, 3);
      lx = x;
      if (x === 0) fy = ly;
      ctx.lineTo(x, ly);
    }
    ctx.stroke();
    // Кора на полях продолжает ту же линию.
    if (L < -20) {
      ctx.beginPath();
      ctx.moveTo(0, fy);
      for (let x = -60; x >= L; x -= 60) ctx.lineTo(x, y + mr.range(-3, 3));
      ctx.stroke();
    }
    if (R > w + 20) {
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      for (let x = lx + 60; x <= R; x += 60) ctx.lineTo(x, y + mr.range(-3, 3));
      ctx.stroke();
    }
  }
  return roots;
}

/** Статичный фон: рисуется один раз в offscreen-канвас. */
export function drawTerrain(ctx: Ctx, t: TerrainInput): void {
  const { w, h, paths, plots, anthill, rng, theme } = t;
  const v = t.view ?? { x0: 0, y0: 0, x1: w, y1: h };
  // Поля вокруг кадра рисуются своим генератором: так декор самого кадра не сбивается от ширины экрана.
  const mr = t.marginRng ?? rng;
  const leads = paths.map((p) => pathLead(p, w, h));
  const inCore = (x: number, y: number) => x >= 0 && x <= w && y >= 0 && y <= h;
  // Во сколько раз поля больше кадра: столько же декора на ту же площадь.
  const extra = Math.max(0, ((v.x1 - v.x0) * (v.y1 - v.y0)) / (w * h) - 1);
  // Карта больше кадра 1280x720: декора больше, но реже, чем на обычной карте: её чаще смотрят
  // издалека, и мелкий декор сливался бы в рябь. У обычных карт ровно 1.
  const dens = Math.pow(Math.max(1, (w * h) / (1280 * 720)), 0.7);
  const core = (n: number) => Math.round(n * dens);
  const marginCount = (n: number) => Math.round(n * extra);
  const marginPoint = (pad: number): Vec | null => {
    for (let i = 0; i < 16; i++) {
      const x = mr.range(v.x0 + pad, v.x1 - pad);
      const y = mr.range(v.y0 + pad, v.y1 - pad);
      if (!inCore(x, y)) return { x, y };
    }
    return null;
  };

  // ── земля: основной цвет, мягкие пятна светлее и темнее, мелкая фактура травинок ──
  ctx.fillStyle = theme.grass;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  const softPatch = (r: Rng, x: number, y: number): void => {
    const rad = r.range(60, 170);
    const col = r.next() < 0.5 ? theme.grassLight : theme.grassDark;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, hexA(col, 0.6));
    g.addColorStop(1, hexA(col, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, r.range(0.45, 0.8));
    ctx.fillStyle = g;
    circle(ctx, 0, 0, rad);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < marginCount(45); i++) {
    const p = marginPoint(-80);
    if (p) softPatch(mr, p.x, p.y);
  }
  for (let i = 0; i < core(45); i++) softPatch(rng, rng.range(0, w), rng.range(0, h));
  // Крупный рисунок местности: несколько больших светлых полян и тёмных низин на весь кадр.
  // Свой генератор от зерна карты: рисунок не зависит от ширины экрана.
  const macro = new Rng(Math.floor(rng.next() * 1e9));
  for (let i = 0; i < 7; i++) {
    const x = macro.range(-100, w + 100);
    const y = macro.range(-60, h + 60);
    const rad = macro.range(220, 400);
    const col = i % 2 === 0 ? theme.grassLight : theme.grassDark;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, hexA(col, 0.5));
    g.addColorStop(0.6, hexA(col, 0.22));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Фактура: травинки там, где трава, крапинки на песке, снегу и в пещере.
  const blades = !theme.cave && theme.biome !== 'desert' && theme.biome !== 'snow';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < Math.round(900 * dens * (1 + extra)); i++) {
    const x = mr.range(v.x0, v.x1);
    const y = mr.range(v.y0, v.y1);
    if (blades) {
      // Пучок из двух-трёх травинок веером: одиночные штрихи на телефоне сливаются в шум.
      ctx.strokeStyle = mr.next() < 0.55 ? hexA(theme.grassDark, 0.7) : hexA(theme.grassLight, 0.75);
      const n = mr.int(2, 4);
      const lean = mr.range(-0.3, 0.3);
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + lean + (k - (n - 1) / 2) * 0.42;
        const l = mr.range(4.5, 8.5);
        const bx = x + (k - (n - 1) / 2) * 1.6;
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.6, bx + Math.cos(a + lean * 0.6) * l, y + Math.sin(a) * l);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = mr.next() < 0.5 ? hexA(theme.grassDark, 0.55) : hexA(theme.grassLight, 0.7);
      circle(ctx, x, y, mr.range(0.7, 1.6));
      ctx.fill();
    }
  }
  // Клетки, где можно строить: лёгкая подкраска в шахматку поверх фактуры, а не сплошная заливка.
  // На тёмной земле той же прозрачности хватает на заметную шахматку, поэтому там слабее.
  const cellTint = theme.cave || theme.night ? 0.4 : 1;
  const cellLight = `rgba(255,255,240,${0.03 * cellTint})`;
  const cellDark = `rgba(20,30,0,${0.028 * cellTint})`;
  for (const p of plots) {
    const c = Math.floor(p.x / CELL);
    const r = Math.floor(p.y / CELL);
    ctx.fillStyle = (c + r) % 2 === 0 ? cellLight : cellDark;
    ctx.fillRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
  }
  // Фактура ландшафта новых актов: рябь песка, блёстки снега, щебень, хвоя.
  if (theme.biome) biomeGround(ctx, theme.biome, theme, v, mr, Math.round(60 * dens * (1 + extra)));
  const leadDist = (x: number, y: number): number => {
    let d = Infinity;
    for (const l of leads) if (l) d = Math.min(d, segDist(x, y, l.x, l.y, l.x - l.dx * LEAD_LEN, l.y - l.dy * LEAD_LEN));
    return d;
  };
  const nearestPath = (x: number, y: number) => Math.min(leadDist(x, y), ...paths.map((p) => p.nearest(x, y).dist));
  const farFromPath = (x: number, y: number, d: number) => nearestPath(x, y) > d;
  const inReserved = (x: number, y: number) => t.reserved.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  const inWater = (y: number) => !!theme.water && y > theme.water.y - 26 && y < theme.water.y + theme.water.h + 26;
  const inWall = (y: number) => !!theme.wall && y < theme.wall.h + 30;
  const inBlob = (x: number, y: number) => !!theme.blobs?.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + 12);
  const bandKind = theme.bandKind ?? 'water';
  if (theme.water) {
    const x0 = Math.min(0, v.x0) - 40;
    const x1 = Math.max(w, v.x1) + 40;
    if (bandKind === 'ice') drawIce(ctx, theme.water, rng, x0, x1);
    else if (bandKind === 'ravine') drawRavine(ctx, theme.water, rng, x0, x1);
    else {
      drawWater(ctx, w, theme.water, rng, v, mr);
      if (bandKind === 'koi') koiStream(ctx, theme.water, rng, x0, x1);
    }
  }
  const roots = theme.oak ? drawOak(ctx, w, rng, v, mr) : [];
  // Ствол дуба и его корни: ни травы, ни декора поверх.
  const onOak = (x: number, y: number): boolean => !!theme.oak && (y < 82 || roots.some((q) => Math.hypot(q.x - x, q.y - y) < 18));
  const blocked = (x: number, y: number): boolean => inWater(y) || inWall(y) || inBlob(x, y) || onOak(x, y);
  const tuft = (r: Rng, x: number, y: number): void => {
    if (theme.cave) pebble(ctx, x, y, r.range(3, 6), r.range(2, 4));
    else if (theme.biome) biomeTuft(ctx, theme.biome, theme, x, y, r);
    else grassTuft(ctx, x, y, r, theme.grassDark, theme.grassLight);
  };
  for (let i = 0; i < core(150); i++) {
    const x = rng.range(10, w - 10);
    const y = rng.range(90, h - 10);
    if (!farFromPath(x, y, 42) || blocked(x, y)) continue;
    tuft(rng, x, y);
  }
  for (let i = 0; i < marginCount(150); i++) {
    const p = marginPoint(10);
    if (!p || !farFromPath(p.x, p.y, 42) || inReserved(p.x, p.y) || blocked(p.x, p.y)) continue;
    tuft(mr, p.x, p.y);
  }

  // ── тропы: неровная полоса, вытоптанная трава по краям, колеи, травинки на кромке ──
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const dense = (pts: readonly Vec[]): Vec[] => {
    const out: Vec[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    return out;
  };
  /** Сдвиг поперёк тропы на плавную «волну»: края перестают быть идеальной линией. */
  const shifted = (pts: readonly Vec[], amp: number, p1: number, p2: number, offset = 0): Vec[] => {
    let d = 0;
    return pts.map((p, i) => {
      if (i > 0) d += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const o = pts[Math.max(i - 1, 0)];
      const a = Math.atan2(q.y - o.y, q.x - o.x);
      const k = offset + amp * (0.6 * Math.sin(d * 0.021 + p1) + 0.4 * Math.sin(d * 0.053 + p2));
      return { x: p.x - Math.sin(a) * k, y: p.y + Math.cos(a) * k };
    });
  };
  /** Скруглить повороты: прямые углы сразу выдают сетку, а муравьи на изгибе срезают всего несколько пикселей. */
  const rounded = (pts: readonly Vec[], rad: number): Vec[] => {
    const out: Vec[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const p = pts[i];
      const b = pts[i + 1];
      const la = Math.hypot(p.x - a.x, p.y - a.y);
      const lb = Math.hypot(b.x - p.x, b.y - p.y);
      const r = Math.min(rad, la * 0.45, lb * 0.45);
      if (r < 4) {
        out.push(p);
        continue;
      }
      const s0 = { x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r };
      const s1 = { x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r };
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const u = 1 - t;
        out.push({ x: u * u * s0.x + 2 * u * t * p.x + t * t * s1.x, y: u * u * s0.y + 2 * u * t * p.y + t * t * s1.y });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const lines = paths.map((p, i) => {
    const l = leads[i];
    return dense(rounded(l ? [{ x: l.x - l.dx * LEAD_LEN, y: l.y - l.dy * LEAD_LEN }, ...p.pts] : p.pts, 46));
  });
  const phases = lines.map(() => [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)] as const);
  const strokeLine = (pts: readonly Vec[], width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };
  const body = lines.map((pts, i) => shifted(pts, 4.5, phases[i][0], phases[i][1]));
  // Вытоптанная трава вокруг тропы.
  for (const pts of body) strokeLine(pts, 96, hexA(theme.dirtDark, 0.14));
  for (const pts of body) strokeLine(pts, 82, hexA(theme.dirtDark, 0.12));
  for (const pts of body) strokeLine(pts, 72, theme.dirtDark);
  for (const pts of body) strokeLine(pts, 60, theme.dirt);
  // Колеи и светлая середина.
  lines.forEach((pts, i) => {
    for (const side of [-1, 1]) strokeLine(shifted(pts, 3, phases[i][2], phases[i][3], side * 12), 4, hexA(theme.dirtDark, 0.22));
    strokeLine(shifted(pts, 6, phases[i][3], phases[i][2]), 24, 'rgba(255,236,200,0.14)');
  });
  if (theme.water) {
    // Мост по виду полосы: бревно над водой, красный мостик над ручьём с карпами, подвесной над ущельем; лёд переходят так.
    for (const path of paths) {
      if (bandKind === 'water') drawBridge(ctx, path, theme.water);
      else if (bandKind === 'koi') redBridge(ctx, path, theme.water);
      else if (bandKind === 'ravine') ropeBridge(ctx, path, theme.water);
    }
  }
  for (const path of paths) {
    for (let d = 10; d < path.length; d += 18) {
      const p = path.at(d);
      if (inWater(p.y) && theme.water) continue;
      const nx = -Math.sin(p.angle);
      const ny = Math.cos(p.angle);
      const off = rng.range(-20, 20);
      ctx.fillStyle = rng.next() < 0.7 ? 'rgba(60,30,5,0.13)' : 'rgba(255,240,210,0.16)';
      ell(ctx, p.x + nx * off, p.y + ny * off, rng.range(2, 5), rng.range(1.5, 3.2), p.angle);
      ctx.fill();
    }
    for (let d = 20; d < path.length - 60; d += rng.range(16, 44)) {
      const p = path.at(d);
      const nx = -Math.sin(p.angle);
      const ny = Math.cos(p.angle);
      for (let side = -1; side <= 1; side += 2) {
        // В пещере «травинка» тоже камешек, и кромка превращалась в бусы: там реже.
        if (rng.next() < (theme.cave ? 0.7 : 0.35)) continue;
        const k = side * rng.range(28, 38);
        const px = p.x + nx * k;
        const py = p.y + ny * k;
        if (nearestPath(px, py) < 26 || (theme.water && inWater(py))) continue;
        const roll = rng.next();
        // Кромка: камешки и травинки, свисающие на край тропы.
        if (roll < 0.3) pebble(ctx, px, py, rng.range(2.5, 5), rng.range(1.8, 3.4));
        else if (roll < 0.9 && !onOak(px, py)) tuft(rng, px, py);
      }
    }
  }
  for (const l of leads) {
    if (!l) continue;
    const a = Math.atan2(l.dy, l.dx);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    for (let d = 12; d < LEAD_LEN; d += 22) {
      const x = l.x - l.dx * d;
      const y = l.y - l.dy * d;
      if (x < v.x0 - 40 || x > v.x1 + 40 || y < v.y0 - 40 || y > v.y1 + 40) break;
      const off = mr.range(-18, 18);
      ctx.fillStyle = 'rgba(60,30,5,0.12)';
      ell(ctx, x + nx * off, y + ny * off, mr.range(3, 6), mr.range(2, 3.5), a);
      ctx.fill();
      for (let side = -1; side <= 1; side += 2) {
        if (mr.next() < 0.45) {
          const k = side * mr.range(31, 36);
          pebble(ctx, x + nx * k, y + ny * k, mr.range(2.5, 4.5), mr.range(1.8, 3.2));
        }
      }
    }
  }

  // ── декор: группы (клумбы, кольца грибов, груды камней) и одиночки ──
  const colors = ['#ff8fb1', '#fff1f1', '#ffd54f', '#c89bff', '#ff7a59'];
  const pP = theme.puddles;
  const pM = pP + theme.mushrooms;
  const pF = pM + theme.flowers;
  const decorOk = (x: number, y: number, gap = 54): boolean => {
    if (!farFromPath(x, y, gap)) return false;
    if (inReserved(x, y) || blocked(x, y)) return false;
    if (Math.hypot(anthill.x - x, anthill.y - y) < 130) return false;
    if (theme.stump && Math.hypot(theme.stump.x - x, theme.stump.y - y) < 115) return false;
    return true;
  };
  const nightCap = theme.night ? '#6fd3a0' : PAL.mushroomCap;
  const nightDot = theme.night ? '#eafff3' : '#fff3e6';
  const decorAt = (r: Rng, x: number, y: number): void => {
    const roll = r.next();
    if (roll < pP) puddle(ctx, x, y, r);
    else if (roll < pM) {
      if (theme.night) glowSpot(ctx, x, y - 6, 26, '140,255,170', 0.35);
      mushroom(ctx, x, y, r.range(6, 10), r.int(0, 3), nightCap, nightDot);
    } else if (roll < pF) flower(ctx, x, y, r.pick(colors));
    else {
      const k = r.next();
      if (k < 0.38) pebble(ctx, x, y, r.range(4, 9), r.range(3, 6));
      else if (k < 0.66) clover(ctx, x, y, r.range(4, 6));
      else if (k < 0.84) twigDecor(ctx, x, y, r);
      else leaf(ctx, x, y, r.range(9, 14), r.range(4, 6), r.range(0, TAU), r.pick(['#c77f3a', '#d9a24a', '#9bbf3f']), 'rgba(60,30,5,0.5)');
    }
  };
  /** Группа одинакового декора: клумба одного цвета, кольцо грибов, груда камней, клевер, опавшие листья. */
  const cluster = (r: Rng, x: number, y: number): void => {
    if (theme.biome) {
      biomeCluster(ctx, theme, x, y, r);
      return;
    }
    const kind = r.next();
    const n = r.int(4, 7);
    const pts: Vec[] = [];
    for (let i = 0; i < n; i++) pts.push({ x: x + r.range(-26, 26), y: y + r.range(-15, 15) });
    pts.sort((a, b) => a.y - b.y);
    if (kind < 0.32 && !theme.cave) {
      const col = r.pick(colors);
      for (const p of pts) flower(ctx, p.x, p.y, col);
    } else if (kind < 0.52) {
      if (theme.night) glowSpot(ctx, x, y, 40, '140,255,170', 0.3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        mushroom(ctx, x + Math.cos(a) * 20, y + Math.sin(a) * 11, r.range(5, 8), r.int(0, 3), nightCap, nightDot);
      }
    } else if (kind < 0.7) {
      for (const p of pts) pebble(ctx, p.x, p.y, r.range(4, 8), r.range(3, 5));
    } else if (kind < 0.86 && !theme.cave) {
      for (const p of pts) clover(ctx, p.x, p.y, r.range(4, 6));
    } else {
      for (const p of pts) leaf(ctx, p.x, p.y, r.range(8, 12), r.range(3.5, 5), r.range(0, TAU), r.pick(['#c77f3a', '#d9a24a', '#b5532a']), 'rgba(60,30,5,0.5)');
    }
  };
  const decor = (r: Rng, x: number, y: number): void => {
    if (theme.biome) biomeDecor(ctx, theme.biome, theme, x, y, r);
    else decorAt(r, x, y);
  };
  for (let i = 0; i < core(12); i++) {
    const x = rng.range(40, w - 40);
    const y = rng.range(100, h - 40);
    if (decorOk(x, y, 74)) cluster(rng, x, y);
  }
  for (let i = 0; i < marginCount(12); i++) {
    const p = marginPoint(40);
    if (p && decorOk(p.x, p.y, 74)) cluster(mr, p.x, p.y);
  }
  for (let i = 0; i < core(85); i++) {
    const x = rng.range(16, w - 16);
    const y = rng.range(16, h - 16);
    if (decorOk(x, y)) decor(rng, x, y);
  }
  for (let i = 0; i < marginCount(85); i++) {
    const p = marginPoint(16);
    if (p && decorOk(p.x, p.y)) decor(mr, p.x, p.y);
  }
  // Крупные акценты местности: кусты, камыши, скалы, пруды, стволы, бамбук, сугробы.
  for (const b of [...(theme.blobs ?? [])].sort((a, b2) => a.y - b2.y)) biomeBlob(ctx, theme, b, rng);

  if (theme.stump) drawStump(ctx, theme.stump.x, theme.stump.y, rng);
  if (theme.wall) drawWall(ctx, w, theme.wall.h, paths, rng, v, mr);
  if (theme.cave) drawCaveWalls(ctx, w, h, rng, v, mr);
  drawAnthill(ctx, anthill.x, anthill.y, rng);
  // Лёгкая виньетка: края экрана чуть темнее, середина поля светлее.
  if (!theme.cave) {
    const cx = (v.x0 + v.x1) / 2;
    const cy = (v.y0 + v.y1) / 2;
    const R = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) / 2;
    const g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
    g.addColorStop(0, 'rgba(25,15,0,0)');
    g.addColorStop(1, 'rgba(25,15,0,0.24)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }
}

/** Пятиконечная звезда для экрана победы и карточек уровней. */
export function drawStar(ctx: Ctx, x: number, y: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  outline(ctx, 2.5);
  fs(ctx, filled ? PAL.honey : 'rgba(0,0,0,0.35)');
  if (filled) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    circle(ctx, x - r * 0.25, y - r * 0.3, r * 0.15);
    ctx.fill();
  }
}

// ───────────────────────── иконки, снаряды, эффекты ─────────────────────────

export function drawHoney(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.35);
  ctx.bezierCurveTo(x + r * 0.2, y - r * 0.6, x + r, y - r * 0.3, x + r, y + r * 0.3);
  ctx.arc(x, y + r * 0.3, r, 0, Math.PI, false);
  ctx.bezierCurveTo(x - r, y - r * 0.3, x - r * 0.2, y - r * 0.6, x, y - r * 1.35);
  ctx.closePath();
  fs(ctx, PAL.honey);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ell(ctx, x - r * 0.35, y + r * 0.1, r * 0.22, r * 0.4, 0.3);
  ctx.fill();
}

export function drawLarva(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2.5);
  ell(ctx, x, y, r * 1.35, r * 0.85, -0.35);
  fs(ctx, '#f8f0dc');
  ctx.strokeStyle = 'rgba(120,90,60,0.45)';
  ctx.lineWidth = 1.5;
  for (const k of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(x + k * r - 2, y - r * 0.7 - k * r * 0.35);
    ctx.quadraticCurveTo(x + k * r - 5, y - k * r * 0.35, x + k * r - 2, y + r * 0.7 - k * r * 0.35);
    ctx.stroke();
  }
  ctx.fillStyle = OUT;
  circle(ctx, x + r * 0.95, y - r * 0.5, 1.4); ctx.fill();
  circle(ctx, x + r * 1.15, y - r * 0.15, 1.4); ctx.fill();
}

export function drawFlagIcon(ctx: Ctx, x: number, y: number, h: number, color: string): void {
  twig(ctx, x, y + h / 2, x, y - h / 2, 3);
  pennant(ctx, x, y - h / 2, h * 0.9, h * 0.5, color);
}

export function drawAcidGlob(ctx: Ctx, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(155,229,58,0.35)';
  circle(ctx, -10, 0, 3); ctx.fill();
  circle(ctx, -17, 0, 2); ctx.fill();
  outline(ctx, 2);
  ell(ctx, 0, 0, 7, 4.5);
  fs(ctx, PAL.acid);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ell(ctx, -1, -1.5, 2.5, 1.2);
  ctx.fill();
  ctx.restore();
}

export function drawSeed(ctx: Ctx, x: number, y: number, r = 7, boulder = false): void {
  outline(ctx, 2.5);
  ell(ctx, x, y, r, r * 0.8, 0.4);
  fs(ctx, boulder ? PAL.stone : '#8b5a2b');
  ctx.fillStyle = boulder ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.3)';
  ell(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.2, 0.4);
  ctx.fill();
}

export function drawSporeCloud(ctx: Ctx, x: number, y: number, r: number, life01: number, time: number, variant = 0): void {
  const a = Math.min(1, life01 * 3) * 0.55;
  const inner = variant === 1 ? '170,185,80' : variant === 2 ? '215,150,255' : '190,140,225';
  const outer = variant === 1 ? '120,135,50' : variant === 2 ? '170,100,230' : '150,100,190';
  const dots = variant === 1 ? '225,235,170' : variant === 2 ? '245,225,255' : '235,210,250';
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(${inner},${a})`);
  g.addColorStop(0.7, `rgba(${outer},${a * 0.6})`);
  g.addColorStop(1, `rgba(${outer},0)`);
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.fillStyle = `rgba(${dots},${a * 0.9})`;
  for (let i = 0; i < 7; i++) {
    const ang = time * 0.8 + i * (TAU / 7);
    const rr = r * (0.35 + 0.4 * Math.abs(Math.sin(time * 1.1 + i)));
    circle(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.7, 2.5 + (i % 3));
    ctx.fill();
  }
}

/** Оглушение защитника: три капли мёда кружат над головой. */
export function drawDaze(ctx: Ctx, x: number, y: number, t: number, r = 9): void {
  ctx.fillStyle = PAL.honey;
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * (TAU / 3);
    circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * 3, 2.6);
    ctx.fill();
  }
}

// ───────────────────────── стройка ─────────────────────────

/** Каска строителя на голове муравья (голова примерно в 15·s px впереди центра). */
export function drawHardHat(ctx: Ctx, x: number, y: number, angle: number, s: number): void {
  const hx = x + Math.cos(angle) * 15 * s;
  const hy = y + Math.sin(angle) * 15 * s * 0.9;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  outline(ctx, 2);
  ell(ctx, 0, 0, 8.5 * s, 7.5 * s);
  fs(ctx, '#d9a21b');
  ell(ctx, -0.5 * s, 0, 5.8 * s, 5.6 * s);
  fs(ctx, '#f7c948');
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ell(ctx, -2 * s, -1.8 * s, 2.2 * s, 1.3 * s, -0.5);
  ctx.fill();
  ctx.restore();
}

/** Молоток в жвалах: ручка вперёд, боёк поперёк; `swing` наклоняет его при ударе. */
export function drawHammer(ctx: Ctx, x: number, y: number, angle: number, s: number, swing = 0): void {
  const gx = x + Math.cos(angle) * 22 * s;
  const gy = y + Math.sin(angle) * 22 * s * 0.9;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(angle + swing);
  ctx.scale(s, s);
  twig(ctx, -4, 0, 12, 0, 3);
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.rect(9, -6.5, 7, 13);
  fs(ctx, '#7d7f8a');
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(10, -5, 2, 10);
  ctx.restore();
}

/** Лестница между двумя точками: две тетивы и перекладины. */
export function drawLadder(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / L;
  const ny = (x1 - x0) / L;
  const w = 5;
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? OUT : '#c48a45';
    ctx.lineWidth = pass === 0 ? 5 : 2.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w * side, y0 + ny * w * side);
      ctx.lineTo(x1 + nx * w * side, y1 + ny * w * side);
      ctx.stroke();
    }
    ctx.strokeStyle = pass === 0 ? OUT : '#dfa960';
    ctx.lineWidth = pass === 0 ? 4 : 1.8;
    for (let d = 6; d < L - 4; d += 8) {
      const px = x0 + ((x1 - x0) * d) / L;
      const py = y0 + ((y1 - y0) * d) / L;
      ctx.beginPath();
      ctx.moveTo(px + nx * w, py + ny * w);
      ctx.lineTo(px - nx * w, py - ny * w);
      ctx.stroke();
    }
  }
}

/** Стройплощадка: утоптанная земля, кучка материалов и стойки лесов, растущие с прогрессом. */
export function drawScaffold(ctx: Ctx, x: number, y: number, p: number): void {
  outline(ctx, 2.5);
  ell(ctx, x, y + 16, 36, 14);
  fs(ctx, PAL.dirt);
  ctx.fillStyle = PAL.dirtDark;
  ell(ctx, x + 6, y + 18, 16, 6);
  ctx.fill();
  pebble(ctx, x + 28, y + 20, 5, 3.5);
  pebble(ctx, x + 36, y + 16, 4, 3);
  pebble(ctx, x + 31, y + 12, 3.5, 2.5);
  leaf(ctx, x - 30, y + 18, 9, 4, -0.4);
  const h = 22 + 52 * p;
  for (const sx of [-34, 34]) twig(ctx, x + sx, y + 12, x + sx, y + 12 - h, 3);
  for (let k = 1; k <= 3; k++) {
    const yy = y + 12 - (h * k) / 3.2;
    twig(ctx, x - 34, yy, x + 34, yy - 1.5, 2.2);
  }
}
