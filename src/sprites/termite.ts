import { PAL } from '../render/palette';

/**
 * Термиты для спрайт-листов: вид сверху, смотрят вдоль +x, центр тела в начале координат.
 * Мягкое кремовое тело с сегментами, крупная рыжая голова, короткие бледные ноги,
 * усики-бусины. Один рисунок с параметрами даёт рабочего, солдата и подрывника.
 */
type Ctx = CanvasRenderingContext2D;

export interface TermiteLook {
  body: string;
  light: string;
  dark: string;
  head: string;
  headLight: string;
  headDark: string;
  /** Масштаб головы: у солдат крупнее. */
  headScale: number;
  /** Длина жвал относительно головы: у солдат клещи. */
  mandible: number;
  /** Масштаб брюшка: у подрывника раздутое. */
  gaster: number;
  /** Цвет сегментных полос на брюшке. */
  bands: string;
  legs: string;
  legsDark: string;
  /** Подрывник: раскалённый кончик брюшка. */
  hotTip: boolean;
}

export const TERMITE_WORKER: TermiteLook = {
  body: PAL.termite, light: PAL.termiteLight, dark: '#c9a86a',
  head: PAL.termiteHead, headLight: '#e9a456', headDark: '#8c4f1c',
  headScale: 1, mandible: 1, gaster: 1, bands: 'rgba(150,100,40,0.45)',
  legs: '#dcbd90', legsDark: '#a8845a', hotTip: false,
};

export const TERMITE_SOLDIER: TermiteLook = {
  ...TERMITE_WORKER,
  head: '#a85a1f', headLight: '#d2823c', headDark: '#6a3410',
  headScale: 1.4, mandible: 1.6, gaster: 1.05,
};

export const TERMITE_BOMBER: TermiteLook = {
  ...TERMITE_WORKER,
  body: '#f2c84b', light: '#ffe9a0', dark: '#c98a22', bands: 'rgba(140,70,10,0.5)',
  gaster: 1.25, hotTip: true,
};

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

function shade(ctx: Ctx, x: number, y: number, r: number, light: string, mid: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r * 1.08);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  return g;
}

function leg(ctx: Ctx, pts: number[], lift: number, look: TermiteLook): void {
  const k = 1 - lift * 0.1;
  const [x0, y0] = pts;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x0 + (pts[i] - x0) * k, y0 + (pts[i + 1] - y0) * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? look.legs : look.legsDark;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

/** Короткие ноги термита, та же трипод-походка, что у муравья. */
function legs(ctx: Ctx, phase: number, look: TermiteLook): void {
  const shapes: number[][] = [
    [14, 6, 26, 16, 32, 27, 35, 31],
    [6, 7, 8, 20, 9, 32, 12, 35],
    [-2, 6, -13, 17, -22, 28, -26, 31],
  ];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const groupA = (i === 1) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 7;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [
        s[0], s[1] * side,
        s[2] + swing * 0.5, s[3] * side,
        s[4] + swing, s[5] * side,
        s[6] + swing * 1.15, s[7] * side,
      ], lift, look);
    }
  }
}

export function drawTermiteHD(ctx: Ctx, phase: number, look: TermiteLook = TERMITE_WORKER): void {
  const hs = look.headScale;
  const wiggle = Math.sin(phase) * 1.0;
  legs(ctx, phase, look);

  const hx = 28 + (hs - 1) * 6;

  // Усики-бусины: прямые, вперёд и чуть в стороны.
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side * 1.1) * 1.8;
    const x0 = hx + 8 * hs;
    const y0 = 5 * hs * side;
    const x1 = hx + 27 * hs;
    const y1 = (15 + sway) * side;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    for (const t of [0.3, 0.55, 0.8, 1]) {
      ellipsePath(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2.4, 2.4);
      ctx.fillStyle = look.headLight;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  // Брюшко: длинное, мягкое, с поперечными сегментами и мягким бликом.
  const gs = look.gaster;
  const grx = 26 * gs;
  const gry = 15 * gs;
  const gx = -24 - (gs - 1) * 12;
  ellipsePath(ctx, gx, wiggle, grx, gry);
  fillOutline(ctx, shade(ctx, gx, wiggle, grx, look.light, look.body, look.dark));
  ctx.save();
  ellipsePath(ctx, gx, wiggle, grx, gry);
  ctx.clip();
  ctx.strokeStyle = look.bands;
  ctx.lineWidth = 2.6;
  for (const k of [0.45, 0.15, -0.15, -0.45]) {
    const sx = gx + grx * k;
    ctx.beginPath();
    ctx.moveTo(sx, wiggle - gry - 1);
    ctx.quadraticCurveTo(sx - 3, wiggle, sx, wiggle + gry + 1);
    ctx.stroke();
  }
  if (look.hotTip) {
    // Раскалённый кончик: от красного к белому у самого конца.
    const tipX = gx - grx * 0.55;
    const g = ctx.createRadialGradient(tipX - 6, wiggle, 1, tipX, wiggle, grx * 0.6);
    g.addColorStop(0, 'rgba(255,255,220,0.95)');
    g.addColorStop(0.4, 'rgba(255,120,40,0.85)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - grx - 2, wiggle - gry - 2, grx * 1.2, gry * 2 + 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipsePath(ctx, gx - 3, wiggle - 5 * gs, 11 * gs, 3.5 * gs);
  ctx.fill();
  ctx.restore();

  // Грудь.
  ellipsePath(ctx, 6, 0, 11, 9.5);
  fillOutline(ctx, shade(ctx, 6, 0, 11, look.light, look.body, look.dark));

  // Жвалы: короткие тёмные пинцеты, у солдата — клещи.
  const m = look.mandible;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(hx + 10 * hs, 4.5 * hs * side);
    ctx.quadraticCurveTo(hx + (10 + 9 * m) * hs, 7 * hs * m * side, hx + (10 + 11 * m) * hs, 1.5 * hs * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5.5 * Math.sqrt(hs * m);
    ctx.stroke();
    ctx.strokeStyle = '#5a3012';
    ctx.lineWidth = 2 * Math.sqrt(hs * m);
    ctx.stroke();
  }

  // Голова: округлая, рыжая, крупнее груди.
  ellipsePath(ctx, hx, 0, 13 * hs, 12 * hs);
  fillOutline(ctx, shade(ctx, hx, 0, 13 * hs, look.headLight, look.head, look.headDark));
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipsePath(ctx, hx - 2 * hs, 0, 2 * hs, 1.6 * hs);
  ctx.fill();

  // Глаза-бусинки с бликом.
  for (let side = -1; side <= 1; side += 2) {
    ellipsePath(ctx, hx + 5 * hs, 6.5 * hs * side, 2.7 * hs, 2.7 * hs);
    ctx.fillStyle = OUT;
    ctx.fill();
    ellipsePath(ctx, hx + 4.3 * hs, 5.7 * hs * side, 1 * hs, 1 * hs);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
