import { PAL } from '../render/palette';

/**
 * Муравьи для спрайт-листов: вид сверху, смотрят вдоль +x, центр тела в начале координат.
 * Рисуются в «спрайтовых» единицах (масштаб 2x относительно игры): длина рабочего от кончика
 * жвал до конца брюшка около 109 единиц. Свет здесь ненаправленный (круглые градиенты),
 * направленное освещение накладывает пекарня уже после поворота в нужную сторону.
 * Один рисунок с параметрами даёт рабочего, солдата, чёрного налётчика и Жвала с доспехом.
 */
type Ctx = CanvasRenderingContext2D;

export interface AntSkin {
  body: string;
  light: string;
  dark: string;
  /** Блик на глазах. */
  shine: string;
}

export interface AntLook {
  skin: AntSkin;
  /** Масштаб головы и жвал: у солдат крупнее. */
  head: number;
  /** Масштаб брюшка. */
  gaster: number;
  /** Доспех воеводы: шлем-жёлудь, лист-щит, копьё-шип, боевая раскраска. */
  hero: boolean;
}

export const WORKER_SKIN: AntSkin = { body: PAL.antBody, light: PAL.antLight, dark: PAL.antDark, shine: '#ffe3cf' };
export const SOLDIER_SKIN: AntSkin = { body: PAL.soldierBody, light: PAL.soldierLight, dark: PAL.soldierDark, shine: '#ffd6c4' };
export const HERO_SKIN: AntSkin = { body: '#8f2a1a', light: '#d4573c', dark: '#4a120a', shine: '#ffd0bd' };
export const BLACK_SKIN: AntSkin = { body: '#2f2f3a', light: '#6a6a7a', dark: '#121218', shine: '#d6d8ff' };

export const WORKER: AntLook = { skin: WORKER_SKIN, head: 1, gaster: 1, hero: false };
export const SOLDIER: AntLook = { skin: SOLDIER_SKIN, head: 1.35, gaster: 1.05, hero: false };
export const HERO: AntLook = { skin: HERO_SKIN, head: 1.3, gaster: 1.08, hero: true };
export const BLACK: AntLook = { skin: BLACK_SKIN, head: 1.05, gaster: 0.9, hero: false };

const OUT = PAL.outline;
const TAU = Math.PI * 2;

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

/** Объёмный градиент без направления: светлее к центру, темнее к краю. */
function shade(ctx: Ctx, x: number, y: number, r: number, skin: AntSkin): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r * 1.08);
  g.addColorStop(0, skin.light);
  g.addColorStop(0.5, skin.body);
  g.addColorStop(1, skin.dark);
  return g;
}

/**
 * Нога из трёх сегментов: тёмный контур и более светлая сердцевина.
 * `lift` от 0 до 1 — насколько нога в воздухе: поджимается к телу и светлеет.
 */
function leg(ctx: Ctx, pts: number[], lift: number, skin: AntSkin): void {
  const k = 1 - lift * 0.1;
  const [x0, y0] = pts;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x0 + (pts[i] - x0) * k, y0 + (pts[i + 1] - y0) * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? skin.body : skin.dark;
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

/**
 * Трипод-походка: передняя и задняя ноги одной стороны идут вместе со средней ногой другой.
 * `phase` от 0 до 2π — один полный шаг.
 */
function legs(ctx: Ctx, phase: number, skin: AntSkin): void {
  // база на груди, колено, лодыжка, кончик лапки (для стороны +1; сторона -1 зеркалится)
  const shapes: number[][] = [
    [18, 7, 36, 21, 46, 36, 51, 41],
    [10, 8, 14, 27, 16, 43, 20, 47],
    [2, 7, -14, 23, -28, 39, -34, 43],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      // Группа А: левая передняя, правая средняя, левая задняя.
      const groupA = (i === 1) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 9;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      const pts = [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.15, s[7] * side,
      ];
      leg(ctx, pts, lift, skin);
    }
  }
}

/** Лист-щит на левом боку: зелёный, с прожилкой. */
function leafShield(ctx: Ctx, x: number, y: number, len: number, wid: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.quadraticCurveTo(0, -wid, len / 2, 0);
  ctx.quadraticCurveTo(0, wid, -len / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -wid, 0, wid);
  g.addColorStop(0, '#9ed65a');
  g.addColorStop(1, '#4e8a2a');
  fillOutline(ctx, g, 4);
  ctx.strokeStyle = '#3f7020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-len / 2 + 4, 0);
  ctx.lineTo(len / 2 - 4, 0);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * len * 0.22, 0);
    ctx.lineTo(i * len * 0.22 + 6, -wid * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/** Копьё-шип вдоль правого бока: ветка с тёмным острым концом. */
function spear(ctx: Ctx, y: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-30, y);
  ctx.lineTo(44, y);
  ctx.stroke();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = '#b57a3c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-26, y - 1.2);
  ctx.lineTo(38, y - 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(42, y - 5.5);
  ctx.lineTo(68, y);
  ctx.lineTo(42, y + 5.5);
  ctx.closePath();
  fillOutline(ctx, '#3a2412', 3.5);
}

/** Шлем из шляпки жёлудя: накрывает заднюю половину головы, с черенком. */
function acornHelmet(ctx: Ctx, hx: number, hs: number): void {
  ctx.beginPath();
  ctx.ellipse(hx - 1, 0, 14.5 * hs, 13.8 * hs, 0, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  const g = ctx.createRadialGradient(hx - 6 * hs, 0, 2, hx - 4 * hs, 0, 16 * hs);
  g.addColorStop(0, '#b07a3f');
  g.addColorStop(1, '#6f4420');
  fillOutline(ctx, g, 4.5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (const [dx, dy] of [[-6, -6], [-9, 1], [-5, 7], [-12, -3], [-11, 5], [-3, -1]] as const) {
    ellipsePath(ctx, hx + dx * hs, dy * hs, 1.9 * hs, 1.9 * hs);
    ctx.fill();
  }
  // Ободок по срезу шляпки.
  ctx.strokeStyle = '#4a2c12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx - 1, -13.8 * hs);
  ctx.lineTo(hx - 1, 13.8 * hs);
  ctx.stroke();
  // Черенок назад-вверх.
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(hx - 13 * hs, 0);
  ctx.lineTo(hx - 21 * hs, -7);
  ctx.stroke();
  ctx.strokeStyle = '#5c3a1c';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function drawAntHD(ctx: Ctx, phase: number, look: AntLook): void {
  const skin = look.skin;
  const hs = look.head;
  const gs = look.gaster;
  const wiggle = Math.sin(phase) * 1.3;
  legs(ctx, phase, skin);

  // Голова вынесена вперёд пропорционально размеру.
  const hx = 34 + (hs - 1) * 8;

  // Усики: тонкие, с лёгким покачиванием в такт шагу.
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.6;
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side * 1.3) * 2.2;
    ctx.beginPath();
    ctx.moveTo(hx + 6 * hs, 7 * hs * side);
    ctx.lineTo(hx + 19 * hs, (17 + sway) * side);
    ctx.lineTo(hx + 32 * hs, (13 + sway * 1.5) * side);
    ctx.stroke();
  }

  // Брюшко с сегментами.
  const gx = -27 - (gs - 1) * 10;
  const grx = 24 * gs;
  const gry = 17 * gs;
  ellipsePath(ctx, gx, wiggle, grx, gry);
  fillOutline(ctx, shade(ctx, gx, wiggle, grx, skin));
  ctx.save();
  ellipsePath(ctx, gx, wiggle, grx, gry);
  ctx.clip();
  ctx.strokeStyle = skin.dark;
  ctx.lineWidth = 2.6;
  ctx.globalAlpha = 0.85;
  for (const k of [0.33, 0.08, -0.45]) {
    const sx = gx + grx * k;
    ctx.beginPath();
    ctx.moveTo(sx, wiggle - gry - 1);
    ctx.quadraticCurveTo(sx - 5, wiggle, sx, wiggle + gry + 1);
    ctx.stroke();
  }
  if (look.hero) {
    // Боевая раскраска мёдом.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.honey;
    ctx.lineWidth = 3.2;
    for (const k of [0.2, -0.3]) {
      const sx = gx + grx * k;
      ctx.beginPath();
      ctx.moveTo(sx, wiggle - gry * 0.8);
      ctx.quadraticCurveTo(sx - 4, wiggle, sx, wiggle + gry * 0.8);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Стебелёк (талия).
  ellipsePath(ctx, -4, 0, 5.5, 4.5);
  fillOutline(ctx, skin.dark, 4);

  // Грудь с поперечным швом.
  ellipsePath(ctx, 10, 0, 14, 9.5);
  fillOutline(ctx, shade(ctx, 10, 0, 14, skin));
  ctx.strokeStyle = skin.dark;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(14, -8.5);
  ctx.quadraticCurveTo(11, 0, 14, 8.5);
  ctx.stroke();

  // Жвалы: толстые, сходятся перед головой.
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(hx + 9 * hs, 5 * hs * side);
    ctx.quadraticCurveTo(hx + 22 * hs, 9.5 * hs * side, hx + 24 * hs, 1.5 * hs * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7 * Math.sqrt(hs);
    ctx.stroke();
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = 2.8 * Math.sqrt(hs);
    ctx.stroke();
  }

  // Голова: чуть шире сзади, как сердечко.
  ctx.beginPath();
  ctx.moveTo(hx + 13 * hs, 0);
  ctx.bezierCurveTo(hx + 13 * hs, -9 * hs, hx + 5 * hs, -13 * hs, hx - 4 * hs, -12.5 * hs);
  ctx.bezierCurveTo(hx - 12 * hs, -12 * hs, hx - 14 * hs, -4 * hs, hx - 13 * hs, 0);
  ctx.bezierCurveTo(hx - 14 * hs, 4 * hs, hx - 12 * hs, 12 * hs, hx - 4 * hs, 12.5 * hs);
  ctx.bezierCurveTo(hx + 5 * hs, 13 * hs, hx + 13 * hs, 9 * hs, hx + 13 * hs, 0);
  ctx.closePath();
  fillOutline(ctx, shade(ctx, hx - hs, 0, 14 * hs, skin));

  // Глаза: мультяшные, с бликом.
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, hx + 3 * hs, 7.5 * hs * side, 4.6 * hs, 3.8 * hs, side * 0.35);
    ctx.fillStyle = '#fff8f0';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = OUT;
    ellipsePath(ctx, hx + 4.6 * hs, 7.4 * hs * side, 2.1 * hs, 2.1 * hs);
    ctx.fill();
    ctx.fillStyle = skin.shine;
    ellipsePath(ctx, hx + 3.8 * hs, 6.4 * hs * side, 0.9 * hs, 0.9 * hs);
    ctx.fill();
  }

  if (look.hero) {
    acornHelmet(ctx, hx, hs);
    spear(ctx, 26);
    leafShield(ctx, 6, -27, 34, 13, 0.12);
  }
}
