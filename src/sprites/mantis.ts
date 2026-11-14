/**
 * Богомол для спрайт-листа: вид сверху, смотрит вдоль +x, грудь в начале координат.
 * Нефритово-зелёный, узкий: треугольная голова с крупными светлыми глазами по углам и длинными
 * усами, длинная «шея»-переднегрудь, сзади листовидные крылья с жилками поверх жёлто-зелёного
 * брюшка, из-под них кончик брюшка в поясках с двумя хвостиками. Главное — хватательные ноги:
 * толстое бедро с шипами и длинная светлая голень-серп, оба серпа выставлены вперёд.
 * Две пары длинных тонких ходильных ног. Кадры листа — шаг: ходильные ноги переступают,
 * серпы чуть сходятся и расходятся, усы и брюшко покачиваются.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const JADE = '#2fa46c';
const JADE_LIGHT = '#93e8b8';
const JADE_DARK = '#0e5a3c';
const WING = '#5cc88e';
const WING_LIGHT = '#bdf3d2';
const WING_DARK = '#1f7a52';
const BELLY = '#cfe07a';
const BELLY_DARK = '#7c9834';
const BLADE = '#f3f7d6';
const BLADE_DARK = '#9bb866';
const SPINE = '#123a26';

function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function fillOutline(ctx: Ctx, fill: string | CanvasGradient, w = 4.2): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Градиент поперёк тела: светлый гребень по оси, тёмные бока. */
function ridge(ctx: Ctx, half: number, light: string, mid: string, dark: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, dark);
  g.addColorStop(0.3, mid);
  g.addColorStop(0.5, light);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, dark);
  return g;
}

/** Тонкая ходильная нога: бедро, голень и лапка. */
function leg(ctx: Ctx, pts: readonly number[], lift: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = lift > 0.5 ? JADE_LIGHT : JADE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // Тёмное колено.
  ctx.fillStyle = JADE_DARK;
  ellipsePath(ctx, pts[2], pts[3], 2, 2);
  ctx.fill();
}

/**
 * Хватательная нога одной стороны: тазик от плеча в сторону, толстое бедро с шипами вперёд,
 * длинная голень-серп дальше вперёд. Серпы почти параллельны и не смыкаются перед головой:
 * сомкнутые читались клешнями краба.
 */
function scythe(ctx: Ctx, side: number, close: number): void {
  const y = (v: number): number => v * side;
  ctx.save();
  ctx.translate(9, y(8));
  // Серпы слегка разведены в стороны: голова между ними остаётся на виду.
  ctx.rotate(-side * (close - 0.14));
  ctx.translate(-16, -y(6.5));
  // Голень-серп: длинное светлое лезвие, выгнутое наружу, остриё смотрит вперёд и чуть внутрь.
  ctx.beginPath();
  ctx.moveTo(42, y(23.5));
  ctx.quadraticCurveTo(60, y(24.5), 68, y(10));
  ctx.quadraticCurveTo(58, y(16.5), 43, y(16.5));
  ctx.closePath();
  const bg = ctx.createLinearGradient(44, y(22), 66, y(11));
  bg.addColorStop(0, BLADE_DARK);
  bg.addColorStop(0.4, BLADE);
  bg.addColorStop(1, '#ffffff');
  fillOutline(ctx, bg, 3.2);
  // Зубцы по внутренней кромке лезвия.
  ctx.fillStyle = SPINE;
  for (const t of [0.2, 0.38, 0.56, 0.74]) {
    const u = 1 - t;
    const px = u * u * 43 + 2 * u * t * 58 + t * t * 68;
    const py = u * u * 16.5 + 2 * u * t * 16.5 + t * t * 10;
    ctx.beginPath();
    ctx.moveTo(px - 1.8, y(py + 0.5));
    ctx.lineTo(px + 0.6, y(py - 3.6));
    ctx.lineTo(px + 2, y(py + 0.2));
    ctx.closePath();
    ctx.fill();
  }
  // Бедро: толстое у локтя, сужается к суставу с голенью.
  ctx.beginPath();
  ctx.moveTo(22, y(16.5));
  ctx.quadraticCurveTo(34, y(14.5), 45, y(16.5));
  ctx.quadraticCurveTo(48, y(20), 45, y(24));
  ctx.quadraticCurveTo(33, y(27.5), 22, y(25.5));
  ctx.quadraticCurveTo(19, y(21), 22, y(16.5));
  ctx.closePath();
  const fg = ctx.createLinearGradient(30, y(15), 32, y(27));
  fg.addColorStop(0, JADE_LIGHT);
  fg.addColorStop(0.5, JADE);
  fg.addColorStop(1, JADE_DARK);
  fillOutline(ctx, fg, 3.6);
  // Шипы по внутреннему краю бедра и коралловая полоска вдоль него.
  ctx.fillStyle = SPINE;
  for (const sx of [27, 32, 37, 42]) {
    ctx.beginPath();
    ctx.moveTo(sx - 1.8, y(15.8));
    ctx.lineTo(sx + 0.8, y(11.4));
    ctx.lineTo(sx + 2, y(15.8));
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(236,104,124,0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(25, y(18.6));
  ctx.quadraticCurveTo(34, y(17.2), 43, y(18.8));
  ctx.stroke();
  // Тазик: короткий толстый членик от плеча к локтю.
  ctx.beginPath();
  ctx.moveTo(16, y(5));
  ctx.lineTo(23.5, y(19));
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 8.6;
  ctx.stroke();
  ctx.strokeStyle = JADE;
  ctx.lineWidth = 4.8;
  ctx.stroke();
  ctx.restore();
}

export function drawMantisHD(ctx: Ctx, phase: number): void {
  // Серпы и длинная шея тянут рисунок вперёд: сдвиг назад держит его в кадре и на тени.
  ctx.save();
  ctx.translate(-5, 0);
  drawBody(ctx, phase);
  ctx.restore();
}

function drawBody(ctx: Ctx, phase: number): void {
  // Ходильные ноги: две пары, шагают накрест.
  const shapes: ReadonlyArray<readonly number[]> = [
    [3, 6, 12, 23, 6, 38, 2, 41],
    [-7, 7, -19, 23, -33, 36, -38, 37],
  ];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const groupA = (i === 0) === (side > 0);
      const ph = phase + (groupA ? 0 : Math.PI);
      const swing = Math.sin(ph) * 6;
      const lift = Math.max(0, Math.cos(ph));
      const s = shapes[i];
      leg(ctx, [s[0], s[1] * side, s[2] + swing * 0.5, s[3] * side, s[4] + swing, s[5] * side, s[6] + swing * 1.1, s[7] * side], lift);
    }
  }

  const sway = Math.sin(phase) * 1.2;
  // Брюшко: шире крыльев, в поясках; сзади два хвостика.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-50, 2.4 * side + sway);
    ctx.lineTo(-60, 6 * side + sway * 1.4);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.strokeStyle = BELLY_DARK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  const belly = (): void => {
    ctx.beginPath();
    ctx.moveTo(-30, -7);
    ctx.quadraticCurveTo(-46, -6, -55, sway);
    ctx.quadraticCurveTo(-46, 6, -30, 7);
    ctx.closePath();
  };
  belly();
  fillOutline(ctx, ridge(ctx, 7, '#eef6b0', BELLY, BELLY_DARK), 3.8);
  ctx.save();
  belly();
  ctx.clip();
  ctx.strokeStyle = 'rgba(86,110,30,0.75)';
  ctx.lineWidth = 1.4;
  for (const bx of [-42, -47, -51]) {
    ctx.beginPath();
    ctx.moveTo(bx + 1.5, -8);
    ctx.quadraticCurveTo(bx - 2, 0, bx + 1.5, 8);
    ctx.stroke();
  }
  ctx.restore();

  // Крылья: узкий лист поверх брюшка, жилка по оси и косые жилки назад.
  const wings = (): void => {
    ctx.beginPath();
    ctx.moveTo(8, -7.5);
    ctx.bezierCurveTo(-10, -13, -28, -11.5, -45, sway * 0.8);
    ctx.bezierCurveTo(-28, 11.5, -10, 13, 8, 7.5);
    ctx.quadraticCurveTo(10, 0, 8, -7.5);
    ctx.closePath();
  };
  wings();
  fillOutline(ctx, ridge(ctx, 13, WING_LIGHT, WING, WING_DARK), 4.2);
  ctx.save();
  wings();
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(16,84,52,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-46, sway * 0.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(16,84,52,0.45)';
  ctx.lineWidth = 1;
  for (const vx of [0, -8, -16, -24, -32]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx - 5, 6 * side, vx - 12, 12 * side);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ellipsePath(ctx, -12, 0, 14, 1.6);
  ctx.fill();
  ctx.restore();

  // Серпы: чуть сходятся и расходятся в такт шагу.
  const close = Math.sin(phase) * 0.07;
  for (const side of [-1, 1]) scythe(ctx, side, close);

  // Усы: длинные, тонкие, расходятся вперёд.
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase * 0.5 + side) * 2.5;
    ctx.beginPath();
    ctx.moveTo(47, 3.5 * side);
    ctx.quadraticCurveTo(54, (7 + sw * 0.4) * side, 61, (4.5 + sw * 0.6) * side);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = JADE_DARK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  // Переднегрудь: длинная «шея» с расширением у плеч.
  ctx.beginPath();
  ctx.moveTo(5, -4.6);
  ctx.bezierCurveTo(8, -5, 10, -7.6, 14, -7.4);
  ctx.quadraticCurveTo(21, -6.2, 26, -4.2);
  ctx.lineTo(39, -3.6);
  ctx.lineTo(39, 3.6);
  ctx.lineTo(26, 4.2);
  ctx.quadraticCurveTo(21, 6.2, 14, 7.4);
  ctx.bezierCurveTo(10, 7.6, 8, 5, 5, 4.6);
  ctx.quadraticCurveTo(3, 0, 5, -4.6);
  ctx.closePath();
  fillOutline(ctx, ridge(ctx, 8, JADE_LIGHT, JADE, JADE_DARK));
  ctx.strokeStyle = 'rgba(14,90,60,0.6)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(20, -5.4);
  ctx.quadraticCurveTo(18.5, 0, 20, 5.4);
  ctx.moveTo(30, -3.6);
  ctx.quadraticCurveTo(29, 0, 30, 3.6);
  ctx.stroke();

  // Голова: треугольник остриём вперёд, глаза по углам.
  ctx.beginPath();
  ctx.moveTo(37, -4);
  ctx.quadraticCurveTo(39.5, -11.5, 43.5, -11.5);
  ctx.quadraticCurveTo(48.5, -6, 51, 0);
  ctx.quadraticCurveTo(48.5, 6, 43.5, 11.5);
  ctx.quadraticCurveTo(39.5, 11.5, 37, 4);
  ctx.closePath();
  const hg = ctx.createRadialGradient(43.5, 0, 1, 42.5, 0, 12);
  hg.addColorStop(0, JADE_LIGHT);
  hg.addColorStop(0.6, JADE);
  hg.addColorStop(1, JADE_DARK);
  fillOutline(ctx, hg, 3.8);
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 42.5, 9.6 * side, 5, 4.2, side * 0.5);
    fillOutline(ctx, '#f4fbb8', 2);
    ellipsePath(ctx, 44.3, 9.2 * side, 1.7, 1.5);
    ctx.fillStyle = '#16301e';
    ctx.fill();
  }
}
