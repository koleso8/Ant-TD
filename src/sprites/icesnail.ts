/**
 * Ледяная улитка для спрайт-листа: вид сверху, смотрит вдоль +x, раковина чуть позади начала координат.
 * Нога — сиреневая капля: широкая у головы, к хвосту сужается, по краям бежит волна. На спине
 * раковина из бирюзового льда: настоящая спираль (каждый оборот внутрь уже предыдущего, у устья
 * ступенька), ростовые рёбра, иней, сзади по бокам ледяные шипы. Глаза на длинных стебельках вперёд
 * и в стороны, под ними пара коротких щупалец. Кадры листа — нога тянется и сжимается, раковина
 * чуть отстаёт, стебельки покачиваются.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const FOOT = '#9390c0';
const FOOT_LIGHT = '#d6d4f0';
const FOOT_DARK = '#57548c';
const SHELL = '#5cc4da';
const SHELL_LIGHT = '#f0fdff';
const SHELL_DARK = '#1f7898';
const GROOVE = '#0c3c58';

/** Центр раковины, угол устья, радиус у устья, сжатие поперёк хода и во сколько раз уже каждый оборот внутрь. */
const CX = -12;
const CY = 3;
const A_END = 0.35;
const R_OUT = 30;
const SQ = 0.92;
const Q = 0.55;
/** Откуда свет в осях спрайта: сверху-сзади. */
const LIGHT = -1.9;

function jit(i: number): number {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

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

/** Точка спирали раковины: back — на какой угол отступили от устья внутрь, k — доля радиуса оборота. */
function spiral(back: number, k = 1): [number, number] {
  const a = A_END - back;
  const r = R_OUT * Math.pow(Q, back / TAU) * k;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * SQ];
}

/** Контур раковины: наружный оборот спирали, замкнутый ступенькой устья. */
function shellPath(ctx: Ctx): void {
  ctx.beginPath();
  for (let i = 0; i <= 56; i++) {
    const [x, y] = spiral((i / 56) * TAU);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Ледяной шип: узкий кристалл с бликом. */
function shard(ctx: Ctx, x: number, y: number, len: number, w: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -w);
  ctx.lineTo(len, 0);
  ctx.lineTo(0, w);
  ctx.lineTo(-len * 0.18, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#9fd4f4');
  fillOutline(ctx, g, 2);
  ctx.strokeStyle = 'rgba(60,120,190,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-len * 0.1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

function foot(ctx: Ctx, phase: number): void {
  // Подошва: капля, широкая у головы, к хвосту сужается; волна бежит по обоим краям.
  const halfWidth = (x: number): number => {
    const u = (x + 8) / 52;
    const base = Math.sqrt(Math.max(0, 1 - u * u)) * 17.5;
    return base * (0.5 + 0.5 * Math.min(1, (x + 60) / 62));
  };
  const sole = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= 44; i++) {
      const x = -60 + (104 * i) / 44;
      ctx.lineTo(x, -(halfWidth(x) + Math.sin(phase + x * 0.16) * 1.6));
    }
    for (let i = 44; i >= 0; i--) {
      const x = -60 + (104 * i) / 44;
      ctx.lineTo(x, halfWidth(x) + Math.sin(phase + x * 0.16 + Math.PI) * 1.6);
    }
    ctx.closePath();
  };
  sole();
  const g = ctx.createRadialGradient(6, -6, 4, -6, 0, 58);
  g.addColorStop(0, FOOT_LIGHT);
  g.addColorStop(0.5, FOOT);
  g.addColorStop(1, FOOT_DARK);
  fillOutline(ctx, g, 4.5);
  ctx.save();
  sole();
  ctx.clip();
  // Кожа: тёмные бугорки на шее и хвосте (там, где ногу не закрывает раковина), светлая кайма подошвы.
  ctx.fillStyle = 'rgba(60,56,110,0.6)';
  for (const [x, y, r] of [[30, -7, 3], [36, 5, 2.6], [25, 8, 3.2], [40, -3, 2], [-40, -4, 3], [-46, 3, 2.6], [-52, -1, 2], [-37, 6, 2.4]] as const) {
    ellipsePath(ctx, x, y, r, r * 0.8);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(236,234,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 4; i <= 40; i++) {
    const x = -60 + (104 * i) / 44;
    ctx.lineTo(x, -(halfWidth(x) + Math.sin(phase + x * 0.16) * 1.6) + 3.4);
  }
  ctx.stroke();
  // Хвост: тёмная полоска по оси.
  ctx.strokeStyle = 'rgba(60,56,110,0.45)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.lineTo(-56, 0);
  ctx.stroke();
  ctx.restore();
}

function tentacles(ctx: Ctx, phase: number): void {
  ctx.lineCap = 'round';
  // Нижние щупальца: короткие, вперёд.
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(41, 4 * side);
    ctx.quadraticCurveTo(46, 4.5 * side, 49, 6 * side);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = FOOT;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  // Глаза на стебельках: симметрично вперёд и в стороны, покачиваются.
  for (let side = -1; side <= 1; side += 2) {
    const sway = Math.sin(phase * 0.5 + side * 1.1) * 3;
    const ex = 58 + sway * 0.4;
    const ey = (19 + sway) * side;
    ctx.beginPath();
    ctx.moveTo(34, 5 * side);
    ctx.quadraticCurveTo(48, 8 * side, ex, ey);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = FOOT;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ellipsePath(ctx, ex, ey, 6, 6);
    fillOutline(ctx, '#eef9ff', 3.5);
    ellipsePath(ctx, ex + 1.5, ey, 2.7, 2.7);
    ctx.fillStyle = OUT;
    ctx.fill();
    ellipsePath(ctx, ex + 0.6, ey - 1.2 * side, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

/** Искра инея: четырёхлучевая звёздочка. */
function sparkle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const k = i % 2 === 0 ? r : r * 0.3;
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function shell(ctx: Ctx): void {
  // Ледяные шипы веером сзади: основания уходят под раковину, силуэт перестаёт быть ровным кругом.
  for (const [ang, len, w] of [[Math.PI, 19, 5], [2.5, 21, 5.4], [-2.5, 21, 5.4], [1.85, 15, 4.4], [-1.85, 15, 4.4]] as const) {
    const back = ((A_END - ang) % TAU + TAU) % TAU;
    const [x, y] = spiral(back, 0.8);
    shard(ctx, x, y, len, w, ang);
  }

  shellPath(ctx);
  const g = ctx.createRadialGradient(CX - 6, CY - 9, 2, CX, CY, 32);
  g.addColorStop(0, SHELL_LIGHT);
  g.addColorStop(0.4, SHELL);
  g.addColorStop(1, SHELL_DARK);
  fillOutline(ctx, g, 5);

  ctx.save();
  shellPath(ctx);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Тень на стороне от света: раковина — купол, а не плоский диск.
  const sh = ctx.createLinearGradient(CX + Math.cos(LIGHT) * 26, CY + Math.sin(LIGHT) * 26, CX - Math.cos(LIGHT) * 26, CY - Math.sin(LIGHT) * 26);
  sh.addColorStop(0.45, 'rgba(10,50,90,0)');
  sh.addColorStop(1, 'rgba(10,50,90,0.42)');
  ctx.fillStyle = sh;
  ctx.fillRect(CX - 40, CY - 40, 80, 80);

  // Борозда между оборотами: настоящая спираль, каждый оборот внутрь почти вдвое уже.
  const groove = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= 110; i++) {
      const [x, y] = spiral(TAU + (i / 110) * TAU * 2.6);
      ctx.lineTo(x, y);
    }
  };
  // Оборот ныряет под соседний: мягкая тень снаружи от борозды.
  groove();
  ctx.strokeStyle = 'rgba(12,60,92,0.32)';
  ctx.lineWidth = 9;
  ctx.stroke();

  // Ростовые рёбра: редкие косые штрихи поперёк наружного оборота.
  ctx.strokeStyle = 'rgba(16,80,110,0.3)';
  ctx.lineWidth = 1.4;
  let back = 0.5;
  for (let i = 0; back < TAU * 0.95; i++) {
    const [x0, y0] = spiral(back, 0.95);
    const [x1, y1] = spiral(back + 0.12, Q + 0.12);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    back += 0.34 + jit(i) * 0.22;
  }

  // Гребень оборота на свету: светлая дуга.
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 3.2;
  let open = false;
  ctx.beginPath();
  for (let i = 0; i <= 150; i++) {
    const b = (i / 150) * TAU * 2.4;
    const lit = Math.cos(A_END - b - LIGHT) > 0.3;
    if (lit) {
      const [x, y] = spiral(b, 0.8);
      if (open) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    open = lit;
  }
  ctx.stroke();

  groove();
  ctx.strokeStyle = GROOVE;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Иней: три искры на освещённой стороне.
  sparkle(ctx, CX - 12, CY - 13, 6);
  sparkle(ctx, CX + 11, CY - 14, 4.4);
  sparkle(ctx, CX - 17, CY + 5, 3.8);

  // Устье: ступенька спирали, откуда выходит нога, — тёмная губа со светлой кромкой.
  const [lx0, ly0] = spiral(0, 0.97);
  const [lx1, ly1] = spiral(TAU, 1.02);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lx0, ly0);
  ctx.lineTo(lx1, ly1);
  ctx.stroke();
}

export function drawIceSnailHD(ctx: Ctx, phase: number): void {
  const stretch = Math.sin(phase);
  ctx.save();
  ctx.scale(1 + 0.05 * stretch, 1 - 0.04 * stretch);
  foot(ctx, phase);
  tentacles(ctx, phase);
  ctx.restore();
  ctx.save();
  ctx.translate(-1.6 * stretch, 0);
  shell(ctx);
  ctx.restore();
}
