/**
 * Ландшафты новых актов: фактура земли, мелкий декор, крупные препятствия, полосы поперёк карты
 * (лёд, ущелье, ручей с карпами) и мостики через них. Стиль тот же, что в art.ts: толстый тёмный
 * контур и сочные цвета. drawTerrain зовёт отсюда всё, что зависит от ландшафта карты.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import type { Path } from '../game/path';
import type { Biome, LevelTheme } from '../game/levels';
import { circle, drawShadow, ell, flower, fs, grassTuft, hexA, leaf, mushroom, outline, pebble, puddle, twig } from './art';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
export interface Box { x0: number; y0: number; x1: number; y1: number }

// ───────────────────────── мелкие предметы ─────────────────────────

/** Кактус: столбик с двумя руками, колючки точками, иногда розовый цветок на макушке. */
function cactus(ctx: Ctx, x: number, y: number, s: number, rng: Rng): void {
  drawShadow(ctx, x + 2, y + 2, 9 * s, 3.5 * s, 0.22);
  const body = '#5f9e46';
  const arm = (side: number, h: number): void => {
    outline(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(x + side * 4 * s, y - h * s);
    ctx.lineTo(x + side * 9 * s, y - h * s);
    ctx.quadraticCurveTo(x + side * 11 * s, y - h * s, x + side * 11 * s, y - (h + 3) * s);
    ctx.lineTo(x + side * 11 * s, y - (h + 9) * s);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.lineWidth = 4.5 * s;
    ctx.stroke();
  };
  arm(-1, 8 + rng.range(0, 4));
  arm(1, 11 + rng.range(0, 4));
  outline(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y);
  ctx.lineTo(x - 4 * s, y - 20 * s);
  ctx.arc(x, y - 20 * s, 4 * s, Math.PI, 0);
  ctx.lineTo(x + 4 * s, y);
  ctx.closePath();
  fs(ctx, body);
  ctx.strokeStyle = 'rgba(30,70,20,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 21 * s); ctx.stroke();
  ctx.fillStyle = '#fff6d6';
  for (let i = 0; i < 5; i++) {
    circle(ctx, x + (i % 2 ? 2.5 : -2.5) * s, y - (4 + i * 3.6) * s, 0.9);
    ctx.fill();
  }
  if (rng.next() < 0.35) {
    outline(ctx, 1.5);
    circle(ctx, x, y - 24 * s, 2.6 * s);
    fs(ctx, '#ff7aa8');
  }
}

/** Выбеленная кость: стержень и по два шарика на концах. */
function bone(ctx: Ctx, x: number, y: number, a: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-8 * s, -1.6 * s, 16 * s, 3.2 * s);
  for (const ex of [-8, 8]) for (const ey of [-2, 2]) {
    ctx.moveTo(ex * s + 2.6 * s, ey * s);
    ctx.arc(ex * s, ey * s, 2.6 * s, 0, TAU);
  }
  ctx.stroke();
  ctx.fillStyle = '#f3ead6';
  ctx.fill();
  ctx.restore();
}

/** Перекати-поле: клубок сухих веток. */
function tumbleweed(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.7, r * 0.9, r * 0.3, 0.18);
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, TAU);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * rng.range(0.4, 0.75), a, a + rng.range(1.5, 3));
    ctx.stroke();
  }
}

/** Трещины в сухой земле. */
function crack(ctx: Ctx, x: number, y: number, rng: Rng): void {
  ctx.strokeStyle = 'rgba(120,85,40,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  for (let i = 0; i < 4; i++) {
    cx += rng.range(-9, 9);
    cy += rng.range(-6, 6);
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

/** Валун: округлый камень с бликом. */
function boulder(ctx: Ctx, x: number, y: number, r: number, color: string = PAL.stone, light: string = PAL.stoneLight): void {
  drawShadow(ctx, x + r * 0.15, y + r * 0.45, r * 1.05, r * 0.42, 0.25);
  outline(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.3);
  ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.55, x - r * 0.2, y - r * 0.75);
  ctx.quadraticCurveTo(x + r * 0.8, y - r * 0.85, x + r, y + r * 0.1);
  ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.5, x, y + r * 0.5);
  ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.55, x - r, y + r * 0.3);
  ctx.closePath();
  fs(ctx, color);
  ctx.fillStyle = light;
  ell(ctx, x - r * 0.3, y - r * 0.4, r * 0.4, r * 0.18, -0.2);
  ctx.fill();
}

/** Эдельвейс: белая звёздочка с жёлтой серединкой. */
function edelweiss(ctx: Ctx, x: number, y: number): void {
  outline(ctx, 1.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ell(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 3, 3.2, 1.6, a);
    fs(ctx, '#f6f4ea');
  }
  circle(ctx, x, y, 2);
  fs(ctx, '#f2c94c');
}

/** Пятно мха: несколько зелёных кружков. */
function moss(ctx: Ctx, x: number, y: number, rng: Rng, color = '#4f8f3a'): void {
  ctx.fillStyle = hexA(color, 0.75);
  for (let i = 0; i < 6; i++) {
    circle(ctx, x + rng.range(-8, 8), y + rng.range(-4, 4), rng.range(2.5, 5));
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  circle(ctx, x - 2, y - 2, 2);
  ctx.fill();
}

/** Папоротник: стебель и листочки ёлочкой. */
function fern(ctx: Ctx, x: number, y: number, len: number, a: number, color = '#3f8f3a'): void {
  // Без обводки: у мелких листочков контур толще самого листа, и папоротник превращался в тёмного жука.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(10,40,10,0.22)';
  ell(ctx, len * 0.5 + 2, 3, len * 0.55, len * 0.22, 0);
  ctx.fill();
  ctx.strokeStyle = '#2a5f27';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.08, len, 0); ctx.stroke();
  for (let i = 1; i < 7; i++) {
    const t = (i / 7) * len;
    const s = (1 - i / 8) * 7 + 2;
    for (const side of [-1, 1]) {
      ell(ctx, t - s * 0.2, side * s * 0.55, s * 0.62, s * 0.26, side * 0.85);
      ctx.fillStyle = color;
      ctx.fill();
      ell(ctx, t - s * 0.25, side * s * 0.5, s * 0.4, s * 0.1, side * 0.85);
      ctx.fillStyle = 'rgba(220,255,190,0.35)';
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Орхидея: пять ярких лепестков. */
function orchid(ctx: Ctx, x: number, y: number, color: string): void {
  outline(ctx, 1.5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ell(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.6, 2.6, a);
    fs(ctx, color);
  }
  circle(ctx, x, y, 2.4);
  fs(ctx, '#fff2a8');
}

/** Снежный холмик: белая шапка с голубой тенью снизу. */
function snowPile(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(120,150,190,0.35)';
  ell(ctx, x + 2, y + r * 0.35, r * 1.1, r * 0.4);
  ctx.fill();
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.25);
  ctx.quadraticCurveTo(x - r * 0.6, y - r * 0.7, x, y - r * 0.6);
  ctx.quadraticCurveTo(x + r * 0.7, y - r * 0.6, x + r, y + r * 0.25);
  ctx.quadraticCurveTo(x, y + r * 0.5, x - r, y + r * 0.25);
  ctx.closePath();
  fs(ctx, '#ffffff');
  ctx.fillStyle = 'rgba(150,180,220,0.45)';
  ell(ctx, x + r * 0.25, y + r * 0.1, r * 0.55, r * 0.22);
  ctx.fill();
}

/** Шишка: коричневый овал в чешуйках. */
function pineCone(ctx: Ctx, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  outline(ctx, 1.8);
  ell(ctx, 0, 0, 8, 5);
  fs(ctx, '#8a5a2e');
  ctx.strokeStyle = '#5a3818';
  ctx.lineWidth = 1.1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.arc(i * 3, 0, 3.4, -1.1, 1.1); ctx.stroke();
  }
  ctx.restore();
}

/** Льдинки: голубые острые осколки. */
function iceShards(ctx: Ctx, x: number, y: number, rng: Rng): void {
  outline(ctx, 1.6);
  for (let i = 0; i < 3; i++) {
    const ox = x + rng.range(-6, 6);
    const oy = y + rng.range(-3, 3);
    const h = rng.range(6, 11);
    ctx.beginPath();
    ctx.moveTo(ox - 3, oy);
    ctx.lineTo(ox, oy - h);
    ctx.lineTo(ox + 3, oy);
    ctx.closePath();
    fs(ctx, i === 1 ? '#bfe6ff' : '#9fd2f5');
  }
}

/** Пучок хвои на земле. */
function needles(ctx: Ctx, x: number, y: number, rng: Rng): void {
  ctx.strokeStyle = 'rgba(110,70,30,0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, TAU);
    const l = rng.range(4, 8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.6);
    ctx.stroke();
  }
}

/** Лепестки сакуры россыпью. */
function petals(ctx: Ctx, x: number, y: number, rng: Rng): void {
  for (let i = 0; i < 5; i++) {
    const px = x + rng.range(-9, 9);
    const py = y + rng.range(-5, 5);
    ctx.fillStyle = rng.next() < 0.5 ? '#ffc3d8' : '#ff9fbf';
    ell(ctx, px, py, 2.8, 1.7, rng.range(0, TAU));
    ctx.fill();
  }
}

/** Росток бамбука: зелёный конус с узлами. */
function bambooShoot(ctx: Ctx, x: number, y: number, h: number): void {
  drawShadow(ctx, x + 2, y + 2, 6, 2.5, 0.2);
  outline(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + 4, y);
  ctx.closePath();
  fs(ctx, '#8fbf4a');
  ctx.strokeStyle = '#5c8a2a';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 3; i++) {
    const yy = y - (h * i) / 3;
    const hw = 4 * (1 - i / 3);
    ctx.beginPath(); ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); ctx.stroke();
  }
}

/** Каменный фонарь: основание, столбик, домик с тёплым огоньком, крыша. */
function stoneLantern(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 3, y + 2, 11, 4, 0.25);
  const stone = '#a7a39a';
  outline(ctx, 2);
  ell(ctx, x, y, 8, 3.5);
  fs(ctx, stone);
  ctx.beginPath(); ctx.rect(x - 2.5, y - 12, 5, 12); fs(ctx, stone);
  ctx.beginPath(); ctx.rect(x - 6, y - 21, 12, 9); fs(ctx, stone);
  const g = ctx.createRadialGradient(x, y - 16.5, 0.5, x, y - 16.5, 9);
  g.addColorStop(0, 'rgba(255,220,120,0.9)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g;
  circle(ctx, x, y - 16.5, 9);
  ctx.fill();
  ctx.fillStyle = '#ffd86a';
  ctx.fillRect(x - 3, y - 19, 6, 5);
  outline(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 21);
  ctx.quadraticCurveTo(x, y - 27, x + 10, y - 21);
  ctx.lineTo(x + 6, y - 25);
  ctx.lineTo(x - 6, y - 25);
  ctx.closePath();
  fs(ctx, '#8d8981');
  circle(ctx, x, y - 27, 1.8);
  fs(ctx, '#8d8981');
}

/** Плоский камень дорожки. */
function steppingStone(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 2);
  ell(ctx, x, y, r, r * 0.6);
  fs(ctx, '#b9b5ab');
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ell(ctx, x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.2);
  ctx.fill();
}

/** Кленовый лист: пятиконечный красный. */
function mapleLeaf(ctx: Ctx, x: number, y: number, a: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  outline(ctx, 1.6);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 === 0 ? 7 : 3;
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fs(ctx, color);
  ctx.restore();
}

// ───────────────────────── земля и трава ─────────────────────────

/**
 * Фактура земли поверх основного цвета: рябь песка, блёстки снега, щебень, хвоя, мох.
 * n — сколько пятен на площадь кадра 1280x720 (масштаб уже учтён вызывающим).
 */
export function biomeGround(ctx: Ctx, biome: Biome, theme: LevelTheme, box: Box, rng: Rng, n: number): void {
  const rx = (): number => rng.range(box.x0, box.x1);
  const ry = (): number => rng.range(box.y0, box.y1);
  switch (biome) {
    case 'desert':
      ctx.strokeStyle = hexA(theme.grassDark, 0.55);
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const x = rx();
        const y = ry();
        const len = rng.range(40, 110);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y - 6, x + len * 0.6, y + 6, x + len, y);
        ctx.stroke();
      }
      break;
    case 'snow':
      for (let i = 0; i < n * 3; i++) {
        ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(170,210,255,0.8)';
        circle(ctx, rx(), ry(), rng.range(0.8, 1.8));
        ctx.fill();
      }
      break;
    case 'mountains':
      for (let i = 0; i < n * 0.5; i++) {
        const x = rx();
        const y = ry();
        ctx.fillStyle = 'rgba(120,120,110,0.25)';
        ell(ctx, x, y, rng.range(20, 45), rng.range(10, 20), rng.range(-0.3, 0.3));
        ctx.fill();
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = 'rgba(90,90,85,0.35)';
          circle(ctx, x + rng.range(-20, 20), y + rng.range(-8, 8), rng.range(1.5, 3));
          ctx.fill();
        }
      }
      break;
    case 'jungle':
      for (let i = 0; i < n * 0.6; i++) {
        ctx.fillStyle = rng.next() < 0.5 ? 'rgba(20,60,20,0.25)' : 'rgba(120,200,90,0.15)';
        ell(ctx, rx(), ry(), rng.range(25, 60), rng.range(12, 28), rng.range(0, TAU));
        ctx.fill();
      }
      break;
    case 'forest':
      for (let i = 0; i < n; i++) needles(ctx, rx(), ry(), rng);
      break;
    case 'asia':
      for (let i = 0; i < n * 0.5; i++) {
        ctx.fillStyle = 'rgba(70,120,50,0.22)';
        ell(ctx, rx(), ry(), rng.range(20, 50), rng.range(10, 22), rng.range(0, TAU));
        ctx.fill();
      }
      break;
  }
}

/** Травинка или мелочь вместо травы: сухая трава, снежный бугорок, камешек, хвоя. */
export function biomeTuft(ctx: Ctx, biome: Biome, theme: LevelTheme, x: number, y: number, rng: Rng): void {
  switch (biome) {
    case 'desert':
      if (rng.next() < 0.5) pebble(ctx, x, y, rng.range(2.5, 4.5), rng.range(1.8, 3));
      else grassTuft(ctx, x, y, rng, '#b5974e', '#d8bf73');
      break;
    case 'snow':
      if (rng.next() < 0.7) snowPile(ctx, x, y, rng.range(4, 7));
      else grassTuft(ctx, x, y, rng, '#7e8f7a', '#9aaa94');
      break;
    case 'mountains':
      if (rng.next() < 0.45) pebble(ctx, x, y, rng.range(3, 5), rng.range(2, 3.5));
      else grassTuft(ctx, x, y, rng, theme.grassDark, theme.grassLight);
      break;
    default:
      grassTuft(ctx, x, y, rng, theme.grassDark, theme.grassLight);
  }
}

/** Декор ландшафта в точке: у каждого свой набор, доли подобраны на глаз. */
export function biomeDecor(ctx: Ctx, biome: Biome, theme: LevelTheme, x: number, y: number, rng: Rng): void {
  const roll = rng.next();
  switch (biome) {
    case 'desert':
      if (roll < 0.26) cactus(ctx, x, y, rng.range(0.8, 1.15), rng);
      else if (roll < 0.38) bone(ctx, x, y, rng.range(0, TAU), rng.range(0.8, 1.1));
      else if (roll < 0.5) tumbleweed(ctx, x, y, rng.range(7, 10), rng);
      else if (roll < 0.62) crack(ctx, x, y, rng);
      else if (roll < 0.7) flower(ctx, x, y, rng.pick(['#ff8a5c', '#ffd54f', '#ff6f91']));
      else pebble(ctx, x, y, rng.range(4, 8), rng.range(3, 5));
      break;
    case 'mountains':
      if (roll < 0.3) boulder(ctx, x, y, rng.range(7, 12));
      else if (roll < 0.48) edelweiss(ctx, x, y);
      else if (roll < 0.62) moss(ctx, x, y, rng, '#6f8f45');
      else if (roll < 0.74) flower(ctx, x, y, rng.pick(['#8fa8ff', '#c89bff', '#fff1f1']));
      else pebble(ctx, x, y, rng.range(3, 6), rng.range(2, 4));
      break;
    case 'jungle':
      if (roll < 0.25) leaf(ctx, x, y, rng.range(13, 19), rng.range(6, 8), rng.range(0, TAU), rng.pick(['#3f9a3a', '#2f7f2f', '#5cb04a']), 'rgba(0,40,0,0.45)');
      else if (roll < 0.47) fern(ctx, x, y, rng.range(18, 26), rng.range(0, TAU), rng.pick(['#3f8f3a', '#4fa544']));
      else if (roll < 0.62) orchid(ctx, x, y, rng.pick(['#ff5fa2', '#c45cff', '#ff8a3c']));
      else if (roll < 0.72) mushroom(ctx, x, y, rng.range(6, 9), rng.int(0, 3), '#ff7a3c', '#fff3e6');
      else if (roll < 0.84) puddle(ctx, x, y, rng);
      else moss(ctx, x, y, rng, '#4aa547');
      break;
    case 'snow':
      if (roll < 0.28) snowPile(ctx, x, y, rng.range(8, 13));
      else if (roll < 0.44) pineCone(ctx, x, y, rng.range(0, TAU));
      else if (roll < 0.58) iceShards(ctx, x, y, rng);
      else if (roll < 0.72) {
        boulder(ctx, x, y, rng.range(7, 10));
        snowPile(ctx, x, y - 4, rng.range(5, 7));
      } else if (roll < 0.84) twig(ctx, x - 7, y + 2, x + 7, y - 3, 2.5);
      else {
        ctx.fillStyle = 'rgba(170,210,240,0.7)';
        ell(ctx, x, y, rng.range(12, 20), rng.range(6, 9));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x + 7, y - 2); ctx.stroke();
      }
      break;
    case 'forest':
      if (roll < 0.22) pineCone(ctx, x, y, rng.range(0, TAU));
      else if (roll < 0.42) fern(ctx, x, y, rng.range(12, 18), rng.range(0, TAU), '#4a8f3a');
      else if (roll < 0.62) mushroom(ctx, x, y, rng.range(6, 10), rng.int(0, 3), rng.next() < 0.6 ? PAL.mushroomCap : '#b5733a', '#fff3e6');
      else if (roll < 0.76) moss(ctx, x, y, rng, '#5e9a3e');
      else if (roll < 0.88) leaf(ctx, x, y, rng.range(9, 13), rng.range(4, 6), rng.range(0, TAU), rng.pick(['#c77f3a', '#d9a24a', '#9b6a2a']), 'rgba(60,30,5,0.5)');
      else twig(ctx, x - 8, y + 2, x + 8, y - 3, 2.5);
      break;
    case 'asia':
      if (roll < 0.26) petals(ctx, x, y, rng);
      else if (roll < 0.4) bambooShoot(ctx, x, y, rng.range(10, 15));
      else if (roll < 0.48) stoneLantern(ctx, x, y);
      else if (roll < 0.62) steppingStone(ctx, x, y, rng.range(7, 10));
      else if (roll < 0.74) mapleLeaf(ctx, x, y, rng.range(0, TAU), rng.pick(['#e2492f', '#f28a2e', '#c8322a']));
      else if (roll < 0.86) flower(ctx, x, y, rng.pick(['#ffb3d1', '#fff1f1', '#ffd6e6']));
      else moss(ctx, x, y, rng, '#5e9a3e');
      break;
  }
}

// ───────────────────────── препятствия ─────────────────────────

/** Слоистая скала из песчаника. */
function mesa(ctx: Ctx, x: number, y: number, r: number): void {
  drawShadow(ctx, x + r * 0.2, y + r * 0.35, r * 1.1, r * 0.45, 0.3);
  outline(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.25);
  ctx.lineTo(x - r * 0.85, y - r * 0.5);
  ctx.lineTo(x - r * 0.3, y - r * 0.72);
  ctx.lineTo(x + r * 0.55, y - r * 0.65);
  ctx.lineTo(x + r * 0.95, y - r * 0.3);
  ctx.lineTo(x + r, y + r * 0.25);
  ctx.quadraticCurveTo(x, y + r * 0.55, x - r, y + r * 0.25);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r * 0.5);
  g.addColorStop(0, '#e8a964');
  g.addColorStop(1, '#b56f38');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(120,60,20,0.45)';
  ctx.lineWidth = 2;
  for (const k of [-0.35, -0.05, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y + r * k);
    ctx.quadraticCurveTo(x, y + r * (k + 0.08), x + r * 0.95, y + r * k);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,200,0.4)';
  ell(ctx, x - r * 0.2, y - r * 0.6, r * 0.5, r * 0.08);
  ctx.fill();
}

/** Груда валунов. */
function rockPile(ctx: Ctx, x: number, y: number, r: number, rng: Rng, snow: boolean): void {
  const parts: [number, number, number][] = [
    [x - r * 0.45, y + r * 0.1, r * 0.55], [x + r * 0.4, y + r * 0.15, r * 0.5], [x, y - r * 0.25, r * 0.6],
  ];
  if (rng.next() < 0.6) parts.push([x + r * 0.15, y + r * 0.45, r * 0.35]);
  for (const [px, py, pr] of parts.sort((a, b) => a[1] - b[1])) {
    boulder(ctx, px, py, pr, rng.next() < 0.5 ? '#8f8f8a' : '#a3a39c');
    if (snow) snowPile(ctx, px, py - pr * 0.45, pr * 0.55);
  }
  if (!snow) moss(ctx, x - r * 0.1, y - r * 0.55, rng, '#6f8f45');
}

/** Розетка огромных листьев с цветком посередине. */
function leafRosette(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.2, r, r * 0.45, 0.28);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.2, 0.2);
    leaf(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.32, r * 0.55, r * 0.2, a, i % 2 ? '#2f8a35' : '#3fa042', 'rgba(0,40,0,0.5)');
  }
  orchid(ctx, x, y - 3, '#ff4f8f');
}

/** Сугроб с ледяными иглами. */
function drift(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  snowPile(ctx, x, y, r);
  snowPile(ctx, x - r * 0.45, y + r * 0.2, r * 0.55);
  iceShards(ctx, x + r * 0.35, y - r * 0.15, rng);
}

/** Спиленный пень с годовыми кольцами и мхом. */
function cutStump(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x + r * 0.15, y + r * 0.45, r * 1.05, r * 0.4, 0.3);
  outline(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y - r * 0.2);
  ctx.lineTo(x - r * 0.8, y + r * 0.35);
  ctx.quadraticCurveTo(x, y + r * 0.62, x + r * 0.8, y + r * 0.35);
  ctx.lineTo(x + r * 0.85, y - r * 0.2);
  ctx.closePath();
  fs(ctx, '#5a3b22');
  ell(ctx, x, y - r * 0.2, r * 0.85, r * 0.42);
  fs(ctx, '#c79a62');
  ctx.strokeStyle = 'rgba(110,70,30,0.55)';
  ctx.lineWidth = 1.6;
  for (const k of [0.7, 0.48, 0.26]) {
    ell(ctx, x, y - r * 0.2, r * 0.85 * k, r * 0.42 * k);
    ctx.stroke();
  }
  moss(ctx, x - r * 0.6, y + r * 0.15, rng, '#4f8f3a');
  mushroom(ctx, x + r * 0.7, y + r * 0.3, r * 0.18, 1, PAL.mushroomCap, '#fff3e6');
}

/** Пруд с карпами: каменная кромка, кувшинки, рыбка. */
function koiPond(ctx: Ctx, x: number, y: number, r: number, rng: Rng, time = 0): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    steppingStone(ctx, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.55, rng.range(6, 9));
  }
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, '#5aa7d6');
  g.addColorStop(1, '#2f6f9e');
  outline(ctx, 2.5);
  ell(ctx, x, y, r * 0.85, r * 0.48);
  fs(ctx, g);
  koi(ctx, x - r * 0.25, y + r * 0.05, 0.4 + time, '#ff8c3a');
  koi(ctx, x + r * 0.3, y - r * 0.1, 3.4 + time, '#f6f2ea');
  for (let i = 0; i < 2; i++) lilyPad(ctx, x + rng.range(-r * 0.5, r * 0.5), y + rng.range(-r * 0.25, r * 0.25), rng.range(6, 9), rng);
}

function koi(ctx: Ctx, x: number, y: number, a: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ell(ctx, 0, 0, 8, 3.2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-12, -3.5);
  ctx.lineTo(-12, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(220,60,30,0.8)';
  ell(ctx, 2, -0.5, 2.5, 1.6);
  ctx.fill();
  ctx.restore();
}

function lilyPad(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  const a = rng.range(0, TAU);
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, a + 0.4, a + TAU - 0.1);
  ctx.closePath();
  fs(ctx, '#4f9a3a');
  if (rng.next() < 0.4) orchid(ctx, x, y, '#ffb3d1');
}

/** Бамбуковая роща: стебли с узлами и листьями сверху. */
function bambooGrove(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.25, r, r * 0.4, 0.3);
  const stalks: [number, number][] = [];
  for (let i = 0; i < 9; i++) stalks.push([x + rng.range(-r * 0.75, r * 0.75), y + rng.range(-r * 0.25, r * 0.3)]);
  stalks.sort((a, b) => a[1] - b[1]);
  for (const [sx, sy] of stalks) {
    const h = rng.range(r * 0.9, r * 1.4);
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 2, sy - h); ctx.stroke();
    ctx.strokeStyle = rng.next() < 0.5 ? '#8fbf4a' : '#a6cf5a';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.strokeStyle = '#4f7a24';
    ctx.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) {
      const yy = sy - (h * k) / 4;
      ctx.beginPath(); ctx.moveTo(sx - 2.5, yy); ctx.lineTo(sx + 2.5 + (2 * k) / 4, yy); ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      leaf(ctx, sx + 2 + rng.range(-10, 10), sy - h + rng.range(-4, 8), rng.range(7, 10), 2.6, rng.range(-1, 1) + (k - 1) * 0.8, '#6fae3a', 'rgba(0,40,0,0.4)');
    }
  }
}

/** Крупное препятствие ландшафта: ни троп, ни застройки. */
export function biomeBlob(ctx: Ctx, theme: LevelTheme, b: { x: number; y: number; r: number }, rng: Rng): void {
  switch (theme.biome) {
    case 'desert': mesa(ctx, b.x, b.y, b.r); break;
    case 'mountains': rockPile(ctx, b.x, b.y, b.r, rng, false); break;
    case 'jungle': leafRosette(ctx, b.x, b.y, b.r, rng); break;
    case 'snow': if (rng.next() < 0.5) drift(ctx, b.x, b.y, b.r, rng); else rockPile(ctx, b.x, b.y, b.r, rng, true); break;
    case 'forest': cutStump(ctx, b.x, b.y, b.r, rng); break;
    case 'asia': if (rng.next() < 0.5) koiPond(ctx, b.x, b.y, b.r, rng); else bambooGrove(ctx, b.x, b.y, b.r, rng); break;
    default: classicBlob(ctx, theme, b, rng);
  }
}

// ───────────────────────── акценты первых двух актов ─────────────────────────

/** Цветущий куст: шапка листьев, ягоды или цветы. */
function bush(ctx: Ctx, x: number, y: number, r: number, rng: Rng, berry: string): void {
  drawShadow(ctx, x + r * 0.15, y + r * 0.35, r * 1.05, r * 0.42, 0.3);
  const lobes: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng.range(-0.2, 0.2);
    lobes.push([x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.35 - r * 0.15, r * rng.range(0.42, 0.55)]);
  }
  lobes.push([x, y - r * 0.25, r * 0.6]);
  outline(ctx, 3);
  for (const [lx, ly, lr] of lobes) { circle(ctx, lx, ly, lr); ctx.stroke(); }
  for (const [lx, ly, lr] of lobes) {
    circle(ctx, lx, ly, lr);
    ctx.fillStyle = '#4f9a3a';
    ctx.fill();
  }
  for (const [lx, ly, lr] of lobes) {
    ctx.fillStyle = 'rgba(160,220,110,0.45)';
    ell(ctx, lx - lr * 0.25, ly - lr * 0.35, lr * 0.45, lr * 0.28);
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    outline(ctx, 1.4);
    circle(ctx, x + rng.range(-r * 0.75, r * 0.75), y + rng.range(-r * 0.6, r * 0.25), rng.range(2.6, 3.6));
    fs(ctx, berry);
  }
}

/** Камыши с рогозом у воды. */
function reeds(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.2, r * 0.9, r * 0.32, 0.25);
  const stems: [number, number, number, number][] = [];
  for (let i = 0; i < 12; i++) stems.push([x + rng.range(-r * 0.7, r * 0.7), y + rng.range(-r * 0.15, r * 0.25), rng.range(r * 0.8, r * 1.5), rng.range(-0.25, 0.25)]);
  stems.sort((a, b) => a[1] - b[1]);
  for (const [sx, sy, h, lean] of stems) {
    const tx = sx + Math.sin(lean) * h;
    const ty = sy - h;
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx, sy - h * 0.6, tx, ty); ctx.stroke();
    ctx.strokeStyle = rng.next() < 0.5 ? '#6f9e3a' : '#86b24a';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (rng.next() < 0.45) {
      outline(ctx, 2);
      ell(ctx, tx, ty + 6, 3.4, 8, lean);
      fs(ctx, '#7a4a24');
    }
  }
}

/** Глиняная башенка термитов: столбик с наплывами и дырочками. */
function termiteSpire(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x + r * 0.2, y + r * 0.3, r * 0.95, r * 0.35, 0.3);
  const spike = (sx: number, sy: number, h: number, wd: number): void => {
    outline(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(sx - wd, sy);
    ctx.quadraticCurveTo(sx - wd * 0.8, sy - h * 0.6, sx - wd * 0.15, sy - h);
    ctx.quadraticCurveTo(sx, sy - h - 4, sx + wd * 0.15, sy - h);
    ctx.quadraticCurveTo(sx + wd * 0.8, sy - h * 0.6, sx + wd, sy);
    ctx.closePath();
    const g = ctx.createLinearGradient(sx - wd, 0, sx + wd, 0);
    g.addColorStop(0, '#c49a62');
    g.addColorStop(1, '#8f6a40');
    fs(ctx, g);
    ctx.fillStyle = '#3a2412';
    for (let i = 0; i < 3; i++) { ell(ctx, sx + rng.range(-wd * 0.4, wd * 0.4), sy - rng.range(h * 0.2, h * 0.75), 2.2, 3); ctx.fill(); }
  };
  spike(x - r * 0.45, y + r * 0.1, r * 1.0, r * 0.32);
  spike(x + r * 0.35, y + r * 0.15, r * 0.8, r * 0.3);
  spike(x, y + r * 0.25, r * 1.5, r * 0.42);
}

/** Сталагмиты пещеры: серые конусы с бликом. */
function stalagmites(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.3, r, r * 0.35, 0.35);
  const items: [number, number, number, number][] = [];
  for (let i = 0; i < 5; i++) items.push([x + rng.range(-r * 0.7, r * 0.7), y + rng.range(-r * 0.1, r * 0.35), rng.range(r * 0.5, r * 1.3), rng.range(r * 0.15, r * 0.28)]);
  items.sort((a, b) => a[1] - b[1]);
  for (const [sx, sy, h, wd] of items) {
    outline(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(sx - wd, sy);
    ctx.quadraticCurveTo(sx - wd * 0.3, sy - h * 0.7, sx, sy - h);
    ctx.quadraticCurveTo(sx + wd * 0.3, sy - h * 0.7, sx + wd, sy);
    ctx.closePath();
    fs(ctx, rng.next() < 0.5 ? '#5e5a54' : '#6f6a62');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(sx - wd * 0.5, sy - 2); ctx.lineTo(sx - 1, sy - h * 0.85); ctx.lineTo(sx - wd * 0.15, sy - 2); ctx.closePath(); ctx.fill();
  }
}

/** Кольцо светящихся грибов (ночь). */
function glowRing(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r * 1.2);
  g.addColorStop(0, 'rgba(140,255,170,0.3)');
  g.addColorStop(1, 'rgba(140,255,170,0)');
  ctx.fillStyle = g;
  ell(ctx, x, y, r * 1.2, r * 0.8);
  ctx.fill();
  const n = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.15, 0.15);
    pts.push([x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.42]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [mx, my] of pts) mushroom(ctx, mx, my, rng.range(7, 11), rng.int(0, 3), '#6fd3a0', '#eafff3');
}

/** Узел корней с мхом: несколько корней уходят в землю. */
function rootKnot(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  drawShadow(ctx, x, y + r * 0.25, r, r * 0.38, 0.28);
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, TAU);
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r * 0.55;
    for (const [wd, col] of [[16, PAL.outline], [11, '#5a3a1f']] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * r * 0.5, y + Math.sin(a + 0.6) * r * 0.3, ex, ey);
      ctx.stroke();
    }
  }
  outline(ctx, 3);
  ell(ctx, x, y, r * 0.42, r * 0.3);
  fs(ctx, '#6b4424');
  moss(ctx, x - r * 0.1, y - r * 0.1, rng, '#5e9a3e');
  mushroom(ctx, x + r * 0.35, y - r * 0.1, r * 0.18, 2, PAL.mushroomCap, '#fff3e6');
}

/** Акцент для тем первых двух актов: по виду местности. */
function classicBlob(ctx: Ctx, theme: LevelTheme, b: { x: number; y: number; r: number }, rng: Rng): void {
  if (theme.cave) stalagmites(ctx, b.x, b.y, b.r, rng);
  else if (theme.wall) termiteSpire(ctx, b.x, b.y, b.r, rng);
  else if (theme.night) glowRing(ctx, b.x, b.y, b.r, rng);
  else if (theme.water) reeds(ctx, b.x, b.y, b.r, rng);
  else if (theme.oak) rootKnot(ctx, b.x, b.y, b.r, rng);
  else bush(ctx, b.x, b.y, b.r, rng, rng.pick(['#e2492f', '#c45cff', '#ff8fb1']));
}

/** Группа одинакового декора ландшафта: несколько кактусов, клумба эдельвейсов, россыпь шишек. */
export function biomeCluster(ctx: Ctx, theme: LevelTheme, x: number, y: number, rng: Rng): void {
  if (!theme.biome) return;
  const state = rng.next();
  const n = rng.int(3, 6);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([x + rng.range(-24, 24), y + rng.range(-14, 14)]);
  pts.sort((a, b) => a[1] - b[1]);
  // У всех предметов группы одно и то же первое число: по нему biomeDecor выбирает вид.
  for (const [px, py] of pts) biomeDecor(ctx, theme.biome, theme, px, py, firstFixed(state, rng));
}

/** Генератор с заданным первым числом, дальше обычный. */
function firstFixed(first: number, base: Rng): Rng {
  let used = false;
  const next = (): number => {
    if (used) return base.next();
    used = true;
    return first;
  };
  return {
    next,
    range: (a: number, b: number) => a + next() * (b - a),
    int: (a: number, b: number) => Math.floor(a + next() * (b - a + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
  } as unknown as Rng;
}

// ───────────────────────── полосы и мосты ─────────────────────────

/** Замёрзшая река: голубой лёд, белые кромки, трещины. По льду тропа идёт без моста. */
export function drawIce(ctx: Ctx, band: { y: number; h: number }, rng: Rng, x0: number, x1: number): void {
  const { y, h } = band;
  ctx.fillStyle = '#f4f8fc';
  ctx.fillRect(x0, y - 10, x1 - x0, h + 20);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#bfe0f5');
  g.addColorStop(1, '#93c4e6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y + 4);
  for (let x = x0; x <= x1; x += 40) ctx.lineTo(x, y + 2 + Math.sin(x * 0.05) * 3);
  for (let x = x1; x >= x0; x -= 40) ctx.lineTo(x, y + h - 2 + Math.cos(x * 0.04) * 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < Math.round((x1 - x0) / 40); i++) {
    let cx = rng.range(x0, x1);
    let cy = rng.range(y + 10, y + h - 10);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 3; k++) {
      cx += rng.range(-14, 14);
      cy += rng.range(-6, 6);
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < Math.round((x1 - x0) / 60); i++) {
    ell(ctx, rng.range(x0, x1), rng.range(y + 8, y + h - 8), rng.range(10, 24), rng.range(2, 4), -0.15);
    ctx.fill();
  }
}

/** Ущелье: тёмная расселина с каменными краями. */
export function drawRavine(ctx: Ctx, band: { y: number; h: number }, rng: Rng, x0: number, x1: number): void {
  const { y, h } = band;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a1d14');
  g.addColorStop(0.5, '#120b06');
  g.addColorStop(1, '#2a1d14');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y + 4, x1 - x0, h - 8);
  const edge = (yy: number, dir: number): void => {
    for (let x = x0 - 20; x < x1 + 20; x += rng.range(22, 34)) {
      boulder(ctx, x, yy + dir * rng.range(0, 5), rng.range(11, 17), rng.next() < 0.5 ? '#8f8f8a' : '#7d7c76', '#b7b6ae');
    }
  };
  edge(y + 2, -1);
  edge(y + h - 2, 1);
}

/** Ручей с карпами: поверх обычной воды рыбки и кувшинки. */
export function koiStream(ctx: Ctx, band: { y: number; h: number }, rng: Rng, x0: number, x1: number): void {
  for (let i = 0; i < Math.round((x1 - x0) / 160); i++) {
    koi(ctx, rng.range(x0, x1), rng.range(band.y + 15, band.y + band.h - 15), rng.range(-0.4, 0.4) + (rng.next() < 0.5 ? 0 : Math.PI), rng.next() < 0.6 ? '#ff8c3a' : '#f6f2ea');
  }
  for (let i = 0; i < Math.round((x1 - x0) / 120); i++) lilyPad(ctx, rng.range(x0, x1), rng.range(band.y + 12, band.y + band.h - 12), rng.range(7, 11), rng);
}

/**
 * Точки тропы над полосой, по переправам: тропа может пересечь полосу несколько раз,
 * и каждая переправа — свой мост, а не одна линия через всю карту.
 */
export function crossings(path: Path, band: { y: number; h: number }, pad: number): Vec[][] {
  const out: Vec[][] = [];
  let cur: Vec[] = [];
  path.pts.forEach((p) => {
    if (p.y >= band.y - pad && p.y <= band.y + band.h + pad) cur.push(p);
    else if (cur.length) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out.filter((run) => run.length >= 2);
}

/** Подвесной мостик через ущелье: доски поперёк и верёвки по бокам. */
export function ropeBridge(ctx: Ctx, path: Path, band: { y: number; h: number }): void {
  for (const pts of crossings(path, band, 8)) ropeSpan(ctx, pts);
}

/** Поперечное направление тропы в точке i; в последней точке берём отрезок к ней, а не нулевой отрезок к самой себе. */
function across(pts: readonly Vec[], i: number): number {
  const a = pts[Math.min(i, pts.length - 2)];
  const b = pts[Math.min(i, pts.length - 2) + 1];
  return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
}

function ropeSpan(ctx: Ctx, pts: Vec[]): void {
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    const a = across(pts, i);
    const nx = Math.cos(a) * 26;
    const ny = Math.sin(a) * 26;
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(p.x - nx, p.y - ny); ctx.lineTo(p.x + nx, p.y + ny); ctx.stroke();
    ctx.strokeStyle = i % 4 === 0 ? '#9a6a3a' : '#b07c45';
    ctx.lineWidth = 4.5;
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#d8c08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const a = across(pts, i);
      const x = p.x + Math.cos(a) * 30 * side;
      const y = p.y + Math.sin(a) * 30 * side;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

/** Красный горбатый мостик с перилами. */
export function redBridge(ctx: Ctx, path: Path, band: { y: number; h: number }): void {
  for (const pts of crossings(path, band, 12)) redSpan(ctx, pts);
}

function redSpan(ctx: Ctx, pts: Vec[]): void {
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  const stroke = (wd: number, col: string): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = wd;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };
  stroke(78, PAL.outline);
  stroke(70, '#c8452f');
  stroke(54, '#d9b98a');
  ctx.strokeStyle = 'rgba(90,50,20,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    const a = across(pts, i);
    ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 26, p.y - Math.sin(a) * 26); ctx.lineTo(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26); ctx.stroke();
  }
  // Столбики перил по краям моста.
  for (const p of [pts[0], pts[pts.length - 1]]) {
    for (const side of [-1, 1]) {
      const n = pts[1];
      const a = Math.atan2(n.y - pts[0].y, n.x - pts[0].x) + Math.PI / 2;
      const x = p.x + Math.cos(a) * 34 * side;
      const y = p.y + Math.sin(a) * 34 * side;
      outline(ctx, 2);
      ctx.beginPath(); ctx.rect(x - 3.5, y - 10, 7, 12); fs(ctx, '#c8452f');
      circle(ctx, x, y - 11, 3.2);
      fs(ctx, '#f2c94c');
    }
  }
  ctx.lineCap = 'round';
}
