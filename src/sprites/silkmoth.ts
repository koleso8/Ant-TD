/**
 * Бабочка шелкопряда для спрайт-листа: вид сверху, летит вдоль +x, центр груди в начале координат.
 * Летающая: кадры листа — взмах (фаза 0..2π на цикл): крылья то распахнуты во всю ширь, то подняты
 * и сверху кажутся уже и темнее. Кремовые крылья с бурыми перевязями, жилками и каймой по краю,
 * толстое пушистое брюшко в поясках, мохнатая грудь, тёмные перистые усы-гребни.
 */
import { PAL } from '../render/palette';

type Ctx = CanvasRenderingContext2D;

const OUT = PAL.outline;
const TAU = Math.PI * 2;

const LINE = 'rgba(146,104,52,0.75)';
const VEIN = 'rgba(160,126,72,0.42)';

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

/** Круг с пушистым краем: bumps бугорков высотой amp. */
function fluff(ctx: Ctx, cx: number, cy: number, r: number, bumps: number, amp: number): void {
  ctx.beginPath();
  ctx.moveTo(cx + r, cy);
  for (let k = 0; k < bumps; k++) {
    const a1 = ((k + 0.5) / bumps) * TAU;
    const a2 = ((k + 1) / bumps) * TAU;
    ctx.quadraticCurveTo(cx + Math.cos(a1) * (r + amp), cy + Math.sin(a1) * (r + amp), cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
  }
  ctx.closePath();
}

/** Переднее крыло в своих осях: корень на оси x, крыло уходит в сторону side. */
function forewingPath(ctx: Ctx, side: number): void {
  const y = (v: number): number => v * side;
  ctx.beginPath();
  ctx.moveTo(10, y(0));
  ctx.bezierCurveTo(17, y(12), 21, y(32), 17, y(45));
  ctx.quadraticCurveTo(16, y(50.5), 9, y(48));
  ctx.bezierCurveTo(0, y(44), -12, y(38), -17, y(29));
  ctx.bezierCurveTo(-14, y(18), -8, y(7), -5, y(0));
  ctx.closePath();
}

/** Заднее крыло: короче и круглее. */
function hindwingPath(ctx: Ctx, side: number): void {
  const y = (v: number): number => v * side;
  ctx.beginPath();
  ctx.moveTo(0, y(0));
  ctx.bezierCurveTo(-4, y(14), -12, y(30), -24, y(32));
  ctx.bezierCurveTo(-34, y(32), -40, y(20), -37, y(9));
  ctx.quadraticCurveTo(-30, y(2), -16, y(0));
  ctx.closePath();
}

/** Одно крыло: f — видимая ширина взмаха (1 — распахнуто), sweep — поворот вперёд-назад. */
function wing(ctx: Ctx, side: number, f: number, sweep: number, hind: boolean): void {
  const y = (v: number): number => v * side;
  const path = hind ? hindwingPath : forewingPath;
  ctx.save();
  ctx.translate(hind ? -2 : 0, 5 * side);
  ctx.rotate(side * sweep);
  ctx.scale(1, f);
  path(ctx, side);
  const g = ctx.createLinearGradient(0, 0, 0, 50 * side);
  g.addColorStop(0, hind ? '#d9c796' : '#e2d1a2');
  g.addColorStop(0.45, hind ? '#eee2be' : '#f7f0da');
  g.addColorStop(1, hind ? '#f6eed6' : '#fffbf0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineCap = 'round';
  // Кайма по краю: широкая бурая полоса, внутрь от контура.
  path(ctx, side);
  ctx.strokeStyle = 'rgba(196,158,96,0.45)';
  ctx.lineWidth = 9;
  ctx.stroke();
  // Жилки от корня к краю.
  ctx.strokeStyle = VEIN;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const tips: ReadonlyArray<readonly [number, number]> = hind
    ? [[-22, 31], [-32, 28], [-37, 17], [-12, 26]]
    : [[15, 44], [8, 46], [-2, 42], [-10, 36], [-15, 29]];
  for (const [tx, ty] of tips) {
    ctx.moveTo(hind ? -5 : 2, y(1));
    ctx.lineTo(tx, y(ty));
  }
  ctx.stroke();
  // Перевязи поперёк крыла.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (hind) {
    ctx.moveTo(-7, y(21));
    ctx.quadraticCurveTo(-22, y(24), -37, y(14));
  } else {
    ctx.moveTo(14, y(16));
    ctx.quadraticCurveTo(3, y(20), -9, y(13));
    ctx.moveTo(18.5, y(33));
    ctx.quadraticCurveTo(3, y(36.5), -14.5, y(25));
  }
  ctx.stroke();
  if (!hind) {
    ctx.strokeStyle = 'rgba(146,104,52,0.4)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(18, y(37));
    ctx.quadraticCurveTo(3, y(40.5), -15.5, y(28.5));
    ctx.stroke();
  }
  // Поднятое крыло в тени.
  if (f < 0.99) {
    ctx.fillStyle = `rgba(104,78,36,${(0.34 * Math.min(1, (1 - f) / 0.34)).toFixed(3)})`;
    ctx.fillRect(-70, -80, 140, 160);
  }
  ctx.restore();
  path(ctx, side);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.6;
  ctx.stroke();
}

/** Перистый ус: тёмный «листок» вокруг изогнутого стержня, поперёк — зубцы гребня. */
function antenna(ctx: Ctx, side: number, sway: number): void {
  const p0 = { x: 21, y: 3 * side };
  const p1 = { x: 33, y: (5 + sway) * side };
  const p2 = { x: 35, y: (21 + sway) * side };
  const N = 12;
  const pts: { x: number; y: number; nx: number; ny: number; w: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const L = Math.hypot(dx, dy) || 1;
    pts.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      nx: -dy / L,
      ny: dx / L,
      w: 0.8 + 4.6 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.06))), 0.7),
    });
  }
  ctx.beginPath();
  for (const p of pts) ctx.lineTo(p.x + p.nx * p.w, p.y + p.ny * p.w);
  for (let i = N; i >= 0; i--) ctx.lineTo(pts[i].x - pts[i].nx * pts[i].w, pts[i].y - pts[i].ny * pts[i].w);
  ctx.closePath();
  fillOutline(ctx, '#6a4c2a', 2.6);
  ctx.strokeStyle = 'rgba(222,190,136,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < N; i++) {
    const p = pts[i];
    ctx.moveTo(p.x + p.nx * p.w * 0.85, p.y + p.ny * p.w * 0.85);
    ctx.lineTo(p.x - p.nx * p.w * 0.85, p.y - p.ny * p.w * 0.85);
  }
  ctx.stroke();
  ctx.strokeStyle = '#2e1e0c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  ctx.stroke();
}

export function drawSilkMothHD(ctx: Ctx, phase: number): void {
  // Взмах: передние крылья ведут, задние чуть отстают.
  const flap = (p: number): number => 0.64 + 0.36 * (0.5 + 0.5 * Math.cos(p));
  const fFore = flap(phase);
  const fHind = flap(phase - 0.6);
  const sweep = Math.sin(phase) * 0.09;
  for (const side of [-1, 1]) wing(ctx, side, fHind, -sweep * 0.6, true);
  for (const side of [-1, 1]) wing(ctx, side, fFore, sweep, false);

  // Брюшко: толстое, к хвосту сужается, в поясках.
  const abdomen = (): void => {
    ctx.beginPath();
    ctx.moveTo(-3, -8.8);
    ctx.bezierCurveTo(-16, -12.5, -32, -8.5, -36.5, 0);
    ctx.bezierCurveTo(-32, 8.5, -16, 12.5, -3, 8.8);
    ctx.closePath();
  };
  abdomen();
  const ag = ctx.createRadialGradient(-14, 0, 2, -18, 0, 20);
  ag.addColorStop(0, '#fffdf2');
  ag.addColorStop(0.55, '#efe3bc');
  ag.addColorStop(1, '#c2ab74');
  fillOutline(ctx, ag, 4);
  ctx.save();
  abdomen();
  ctx.clip();
  for (const bx of [-9, -15, -21, -27, -32]) {
    ctx.strokeStyle = 'rgba(142,110,58,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 1.6, -13);
    ctx.quadraticCurveTo(bx - 3, 0, bx + 1.6, 13);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bx + 3.4, -13);
    ctx.quadraticCurveTo(bx - 1.2, 0, bx + 3.4, 13);
    ctx.stroke();
  }
  ctx.restore();
  // Кисточка на кончике брюшка.
  fluff(ctx, -36, 0, 3, 6, 1.5);
  fillOutline(ctx, '#f4ead0', 2.4);

  // Усы — под головой, чтобы корни прятались.
  const sway = Math.sin(phase * 0.5) * 1.2;
  for (const side of [-1, 1]) antenna(ctx, side, sway);

  // Голова с тёмными глазами по бокам.
  ellipsePath(ctx, 17.5, 0, 6.2, 6.6);
  const hg = ctx.createRadialGradient(18.5, 0, 1, 17.5, 0, 7.5);
  hg.addColorStop(0, '#fbf3d8');
  hg.addColorStop(1, '#c9b27c');
  fillOutline(ctx, hg, 3.6);
  for (const side of [-1, 1]) {
    ellipsePath(ctx, 19.4, 5.2 * side, 2.7, 3.1, side * 0.3);
    ctx.fillStyle = '#2a1a0a';
    ctx.fill();
    ellipsePath(ctx, 20.3, 4.4 * side, 0.9, 1.1);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }

  // Грудь: мохнатый шар, шерсть зачёсана назад.
  fluff(ctx, 4, 0, 11.6, 14, 2);
  const tg = ctx.createRadialGradient(6, 0, 1.5, 4, 0, 14);
  tg.addColorStop(0, '#fbf4dc');
  tg.addColorStop(0.5, '#eadcb0');
  tg.addColorStop(1, '#b49a60');
  fillOutline(ctx, tg, 4);
  ctx.strokeStyle = 'rgba(140,108,56,0.75)';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    const yy = -8 + k * 2;
    const xx = 10 - Math.abs(yy) * 0.55;
    ctx.moveTo(xx, yy);
    ctx.quadraticCurveTo(xx - 5, yy * 1.05, xx - 9.5, yy * 1.12);
  }
  ctx.stroke();
  // Светлый воротник у головы.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipsePath(ctx, 12, 0, 1.8, 6);
  ctx.fill();
}
