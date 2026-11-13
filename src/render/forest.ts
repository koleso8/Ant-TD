/**
 * Постройки Леса (акт 7): родной лесной острог — срубы из медовых сосновых брёвен с выпусками
 * по углам, серебристый тёс кровель, резные причелины, наличники и полотенца, частокол из
 * заострённых кольев, красные стяги с «ёлочкой», ели, берёзы, шишки и мох.
 * На тёмно-зелёной земле читаются медовое дерево, серебро тёса, белая резьба и красный.
 * Детализация на уровне утверждённых наборов: объём, фактура, мелочи.
 */
import { TAU, type Vec } from '../engine/math';
import type { Rng } from '../engine/rng';
import { ANT_WORKER, circle, drawAnt, drawShadow, ell, fs, outline, pennant } from './art';
import { antCrest, beam, jit, woodPole, type WoodTone } from './kit';
import { PAL } from './palette';

type Ctx = CanvasRenderingContext2D;
const OUT = PAL.outline;

/** Свежая сосна: медовые брёвна и брусья. */
const PINE: WoodTone = { hi: '#f2c98c', base: '#c98d4c', lo: '#7d4c20' };
/** Старый тёс кровли: серебристо-серый. */
const TES: WoodTone = { hi: '#d6cfc2', base: '#9c9282', lo: '#5f574b' };
/** Белёная резьба причелин и наличников. */
const CARVE = '#f6eedb';
const RED = '#c8352a';
const IRON = '#3e3a36';
/** Тёмная кора у комля старой берёзы — для корней. */
const BIRCH_ROOT: WoodTone = { hi: '#8a847a', base: '#5c564e', lo: '#34302a' };

/** Цвета трутовика: светлая кромка, основной, тень. */
interface ShelfTone { hi: string; base: string; lo: string }

// ───────────────────────── дерево и резьба ─────────────────────────

/**
 * Сруб: ряды круглых брёвен с корой и бликом поверху, по углам через ряд торчат выпуски
 * поперечных брёвен (светлые торцы с трещиной). halfAt(y) — полуширина стены на высоте y.
 */
function logCrib(ctx: Ctx, x: number, top: number, bottom: number, halfAt: (yy: number) => number, seed: number, lh = 6.4, ends = true): void {
  const n = Math.max(2, Math.round((bottom - top) / lh));
  const h = (bottom - top) / n;
  for (let i = n - 1; i >= 0; i--) {
    const ly = top + i * h;
    const hw = halfAt(ly + h / 2);
    outline(ctx, 1.5);
    ctx.beginPath();
    ctx.roundRect(x - hw, ly, 2 * hw, h + 0.6, h / 2);
    const g = ctx.createLinearGradient(0, ly, 0, ly + h);
    g.addColorStop(0, '#f4cf96');
    g.addColorStop(0.42, '#c78a48');
    g.addColorStop(1, '#6e4219');
    fs(ctx, g);
    ctx.strokeStyle = 'rgba(255,240,205,0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x - hw + 3, ly + h * 0.3); ctx.lineTo(x + hw - 4, ly + h * 0.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,35,10,0.5)';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < Math.max(2, hw / 5); k++) {
      const px = x - hw + 3 + jit(seed + i * 13 + k) * (2 * hw - 8);
      const py = ly + h * (0.55 + jit(seed + i * 7 + k + 40) * 0.2);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2 + jit(seed + k + i) * 4, py + 0.4); ctx.stroke();
    }
  }
  if (!ends) return;
  for (let i = 0; i < n; i++) {
    if ((i + seed) % 2) continue;
    const ly = top + (i + 0.5) * h;
    const hw = halfAt(ly);
    for (const s of [-1, 1]) {
      const ex = x + s * (hw + 1.6);
      outline(ctx, 1.2);
      const er = h * (0.44 + jit(seed + i * 3 + s) * 0.08);
      ell(ctx, ex, ly, er * 0.82, er);
      const eg = ctx.createLinearGradient(ex - h * 0.4, ly - h * 0.5, ex + h * 0.4, ly + h * 0.5);
      eg.addColorStop(0, '#ecd09a');
      eg.addColorStop(1, '#b07c44');
      fs(ctx, eg);
      ctx.strokeStyle = 'rgba(120,70,30,0.65)';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(ex + s * 0.3, ly - h * 0.05); ctx.lineTo(ex + s * h * 0.36, ly - h * 0.3); ctx.stroke();
    }
  }
}

/** Заострённый кол частокола: круглый ствол, тёсаный конец со светлой гранью. */
function stake(ctx: Ctx, x: number, bottom: number, top: number, w: number): void {
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(x - hw, bottom);
  ctx.lineTo(x - hw, top + w * 0.95);
  ctx.lineTo(x, top);
  ctx.lineTo(x + hw, top + w * 0.95);
  ctx.lineTo(x + hw, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
  g.addColorStop(0, '#a8703a');
  g.addColorStop(0.3, '#e2ac6a');
  g.addColorStop(1, '#6a4018');
  outline(ctx, 1.5);
  fs(ctx, g);
  ctx.fillStyle = '#f6dcaa';
  ctx.beginPath();
  ctx.moveTo(x - hw + 0.7, top + w * 0.95);
  ctx.lineTo(x, top + 0.9);
  ctx.lineTo(x + 0.2, top + w * 0.95 + 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,8,0.45)';
  ctx.lineWidth = 0.7;
  const len = bottom - top;
  if (len > 10) {
    ctx.beginPath(); ctx.moveTo(x + hw * 0.2, top + w * 1.4); ctx.lineTo(x + hw * 0.3, top + len * 0.55); ctx.stroke();
  }
}

/** Лыковая обвязка вдоль точек: тёмный контур и светлая плетёнка. */
function withy(ctx: Ctx, pts: readonly Vec[], dy: number): void {
  if (pts.length < 2) return;
  for (const [col, lw] of [[OUT, 3.2], ['#d2ae6c', 1.7]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + dy) : ctx.moveTo(p.x, p.y + dy)));
    ctx.stroke();
  }
}

/** Резной наличник: окно с тёплым светом и переплётом, сверху кокошник, снизу полотенце с фестонами. */
function nalichnik(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 13);
  glow.addColorStop(0, 'rgba(255,190,90,0.45)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 13);
  ctx.fill();
  // Рама.
  outline(ctx, 1.4);
  ctx.beginPath();
  ctx.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
  fs(ctx, CARVE);
  const og = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  og.addColorStop(0, '#ffe7a0');
  og.addColorStop(1, '#f08a30');
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  fs(ctx, og);
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y - 0.5); ctx.lineTo(x + w / 2, y - 0.5); ctx.stroke();
  // Кокошник.
  outline(ctx, 1.3);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3.5, y - h / 2 - 1.5);
  ctx.quadraticCurveTo(x - w * 0.3, y - h / 2 - 4, x, y - h / 2 - 8);
  ctx.quadraticCurveTo(x + w * 0.3, y - h / 2 - 4, x + w / 2 + 3.5, y - h / 2 - 1.5);
  ctx.closePath();
  fs(ctx, CARVE);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2 - 6); ctx.lineTo(x + 1.6, y - h / 2 - 3.6); ctx.lineTo(x, y - h / 2 - 2.2); ctx.lineTo(x - 1.6, y - h / 2 - 3.6);
  ctx.closePath();
  ctx.fill();
  // Подоконная доска с фестонами.
  const by = y + h / 2 + 1.5;
  outline(ctx, 1.3);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3, by);
  ctx.lineTo(x + w / 2 + 3, by);
  ctx.lineTo(x + w / 2 + 3, by + 2.2);
  const n = 3;
  const sp = (w + 6) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + w / 2 + 3 - (i + 0.5) * sp;
    ctx.arc(cx, by + 2.2, sp / 2, 0, Math.PI);
  }
  ctx.closePath();
  fs(ctx, CARVE);
}

/** Левая причелина: белая доска вдоль ската с красным зубцом и фестонами снизу; правую рисуем зеркалом. */
function bargeLeft(ctx: Ctx, x: number, eave: number, apex: number, half: number, w: number, paint: boolean): void {
  const th = Math.atan2(apex - eave, half);
  const L = Math.hypot(half, apex - eave) + 1;
  ctx.save();
  ctx.translate(x - half, eave);
  ctx.rotate(th);
  const sp = 4.6;
  const n = Math.floor((L - 2) / sp);
  ctx.beginPath();
  ctx.moveTo(-1, -1.6);
  ctx.lineTo(L, -1.6);
  ctx.lineTo(L, w);
  for (let i = 0; i < n; i++) {
    const cx = L - 2 - (i + 0.5) * sp;
    ctx.arc(cx, w, sp / 2 - 0.2, 0, Math.PI);
  }
  ctx.lineTo(-1, w);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -1.6, 0, w + 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#d8ccb2');
  outline(ctx, 1.4);
  fs(ctx, g);
  if (paint) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let u = 2, i = 0; u < L - 2; u += 2.6, i++) ctx.lineTo(u, i % 2 ? w * 0.2 : w * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

/** Пара причелин по обоим скатам. */
function bargeboards(ctx: Ctx, x: number, eave: number, apex: number, half: number, w: number, paint: boolean): void {
  bargeLeft(ctx, x, eave, apex, half, w, paint);
  ctx.save();
  ctx.translate(2 * x, 0);
  ctx.scale(-1, 1);
  bargeLeft(ctx, x, eave, apex, half, w, paint);
  ctx.restore();
}

/** Полотенце под коньком: висячая резная доска с ромбом и фестоном внизу. */
function towel(ctx: Ctx, x: number, y: number, len: number, paint: boolean): void {
  const hw = 3.2;
  outline(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x + hw, y + len);
  ctx.arc(x + hw * 0.5, y + len, hw * 0.5, 0, Math.PI);
  ctx.arc(x - hw * 0.5, y + len, hw * 0.5, 0, Math.PI);
  ctx.closePath();
  fs(ctx, CARVE);
  ctx.fillStyle = paint ? RED : '#b89a6a';
  const my = y + len * 0.5;
  ctx.beginPath(); ctx.moveTo(x, my - 3); ctx.lineTo(x + 2, my); ctx.lineTo(x, my + 3); ctx.lineTo(x - 2, my); ctx.closePath(); ctx.fill();
}

/**
 * Двускатная кровля торцом к зрителю: два ската серебристого тёса уходят назад (вверх по экрану),
 * доски вдоль ската, по коньку охлупень. eave — низ свеса, apex — передний конёк.
 */
function gableRoof(ctx: Ctx, x: number, eave: number, apex: number, half: number, depth: number): void {
  for (const s of [1, -1]) {
    const poly = (): void => {
      ctx.beginPath();
      ctx.moveTo(x + s * half, eave);
      ctx.lineTo(x, apex);
      ctx.lineTo(x, apex - depth);
      ctx.lineTo(x + s * half, eave - depth);
      ctx.closePath();
    };
    poly();
    const g = ctx.createLinearGradient(x - half, apex, x + half, eave);
    if (s < 0) {
      g.addColorStop(0, TES.hi);
      g.addColorStop(1, TES.base);
    } else {
      g.addColorStop(0, TES.base);
      g.addColorStop(1, TES.lo);
    }
    outline(ctx, 2.2);
    fs(ctx, g);
    ctx.save();
    poly();
    ctx.clip();
    ctx.strokeStyle = 'rgba(40,34,26,0.4)';
    ctx.lineWidth = 0.8;
    for (let k = 3; k < depth; k += 3.1) {
      ctx.beginPath(); ctx.moveTo(x + s * half, eave - k); ctx.lineTo(x, apex - k); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let k = 4; k < depth; k += 6.2) {
      ctx.beginPath(); ctx.moveTo(x + s * half * 0.9, eave - k - 0.8); ctx.lineTo(x + s * half * 0.2, apex + (eave - apex) * 0.2 - k - 0.8); ctx.stroke();
    }
    ctx.restore();
  }
  beam(ctx, x, apex + 1, x, apex - depth - 1, 4.6, TES);
}

/** Валун фундамента: неровный серый камень с бликом и мхом поверху. */
function fieldStone(ctx: Ctx, x: number, y: number, r: number, seed: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = r * (0.82 + jit(seed + i) * 0.22);
    ctx.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.8);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.5, y - r * 0.5, 0.5, x, y, r * 1.3);
  g.addColorStop(0, '#c8c6be');
  g.addColorStop(0.6, '#8f8d86');
  g.addColorStop(1, '#5a5852');
  outline(ctx, 1.6);
  fs(ctx, g);
  ctx.fillStyle = '#7aa83e';
  ell(ctx, x - r * 0.2, y - r * 0.55, r * 0.6, r * 0.22, -0.1);
  ctx.fill();
}

/** Пятно мха: несколько зелёных подушек с крапом. */
function mossPatch(ctx: Ctx, x: number, y: number, w: number, seed: number): void {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#6f9e38' : '#86b84a';
    ell(ctx, x + (jit(seed + i) - 0.5) * w * 1.4, y + (jit(seed + i + 9) - 0.5) * w * 0.4, w * (0.35 + jit(seed + i + 3) * 0.3), w * 0.2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(210,240,150,0.7)';
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + (jit(seed + i + 20) - 0.5) * w * 1.2, y + (jit(seed + i + 30) - 0.5) * w * 0.3, 0.6);
    ctx.fill();
  }
}

/** Кованый фонарь: ушко, шатровая крышка, тёплое стекло с косой решёткой, свеча. */
function forgedLantern(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, 'rgba(255,200,100,0.55)');
  glow.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y, 20);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y - 12, 2.4, 0, TAU); ctx.stroke();
  const gl = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 6.5);
  gl.addColorStop(0, '#fffbd8');
  gl.addColorStop(0.6, '#ffd76a');
  gl.addColorStop(1, '#e08a2a');
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 6); ctx.lineTo(x + 4, y - 6); ctx.lineTo(x + 4.8, y + 4); ctx.lineTo(x - 4.8, y + 4);
  ctx.closePath();
  fs(ctx, gl);
  ctx.fillStyle = '#ff9a3a';
  ell(ctx, x, y + 0.5, 1.3, 2.5);
  ctx.fill();
  ctx.strokeStyle = IRON;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 6); ctx.lineTo(x + 4.8, y + 4);
  ctx.moveTo(x + 4, y - 6); ctx.lineTo(x - 4.8, y + 4);
  ctx.stroke();
  outline(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 5.5); ctx.lineTo(x, y - 10.5); ctx.lineTo(x + 6, y - 5.5);
  ctx.closePath();
  fs(ctx, '#4e4842');
  ctx.beginPath();
  ctx.rect(x - 5.6, y + 4, 11.2, 2.4);
  fs(ctx, '#4e4842');
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(x - 3.2, y - 5, 1.1, 8);
}

/** Красный стяг: кованый наконечник, белый пояс с зигзагом, герб и «ёлочка», низ ласточкиным хвостом. */
function forestBanner(ctx: Ctx, px: number, ground: number, topY: number): void {
  woodPole(ctx, px, ground, topY + 2, 4.4);
  ctx.beginPath();
  ctx.moveTo(px, topY - 13);
  ctx.quadraticCurveTo(px + 3.8, topY - 6, px, topY - 0.5);
  ctx.quadraticCurveTo(px - 3.8, topY - 6, px, topY - 13);
  ctx.closePath();
  const ig = ctx.createLinearGradient(px - 3, 0, px + 3, 0);
  ig.addColorStop(0, '#eef0f2');
  ig.addColorStop(0.5, '#a4a8ae');
  ig.addColorStop(1, '#55595e');
  outline(ctx, 1.5);
  fs(ctx, ig);
  const bw = 7.5;
  const y0 = topY + 5;
  const y1 = topY + 36;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px - bw - 3, y0); ctx.lineTo(px + bw + 3, y0); ctx.stroke();
  ctx.strokeStyle = PINE.base;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const cloth = (): void => {
    ctx.beginPath();
    ctx.moveTo(px - bw, y0);
    ctx.lineTo(px + bw, y0);
    ctx.quadraticCurveTo(px + bw + 1, (y0 + y1) / 2, px + bw, y1 + 5);
    ctx.lineTo(px, y1 - 2);
    ctx.lineTo(px - bw, y1 + 5);
    ctx.quadraticCurveTo(px - bw + 1, (y0 + y1) / 2, px - bw, y0);
    ctx.closePath();
  };
  cloth();
  const g = ctx.createLinearGradient(px - bw, 0, px + bw, 0);
  g.addColorStop(0, '#9a241a');
  g.addColorStop(0.35, '#dc4a3c');
  g.addColorStop(1, '#7a1a12');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  cloth();
  ctx.clip();
  ctx.fillStyle = CARVE;
  ctx.fillRect(px - bw, y1 - 9, 2 * bw, 4.4);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(px - bw + (i * 2 * bw) / 6, y1 - 6.8 + (i % 2 ? -1.4 : 1.4));
  ctx.stroke();
  ctx.restore();
  antCrest(ctx, px, y0 + 8.5, 4.2, '#7a1a12');
  // «Ёлочка»: стволик и три шеврона.
  ctx.strokeStyle = CARVE;
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(px, y0 + 15); ctx.lineTo(px, y0 + 26); ctx.stroke();
  for (const dy of [15.5, 19.5, 23.5]) {
    const k = 2.4 + (dy - 15.5) * 0.25;
    ctx.beginPath(); ctx.moveTo(px - k, dy + y0 + 2.6); ctx.lineTo(px, dy + y0); ctx.lineTo(px + k, dy + y0 + 2.6); ctx.stroke();
  }
}

/**
 * Шлем-жёлудь (вид сверху) смотрит по angle: чашечка жёлудя с чешуйками, черешок назад,
 * сбоку дубовый листок. Под эскиз героя с заставки.
 */
function acornHelmet(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const sx = -fy;
  const sy = fx;
  // Дубовый листок сбоку.
  const lx = x + sx * r * 0.75 - fx * r * 0.35;
  const ly = y + sy * r * 0.75 - fy * r * 0.35;
  outline(ctx, 1.1);
  ctx.beginPath();
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(angle + Math.PI * 0.82);
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.35, -r * 0.42, r * 0.7, -r * 0.18);
  ctx.quadraticCurveTo(r * 0.95, -r * 0.28, r * 1.1, 0);
  ctx.quadraticCurveTo(r * 0.95, r * 0.28, r * 0.7, r * 0.18);
  ctx.quadraticCurveTo(r * 0.35, r * 0.42, 0, 0);
  ctx.closePath();
  fs(ctx, '#5c9a3c');
  ctx.strokeStyle = 'rgba(20,50,10,0.6)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1, 0); ctx.stroke();
  ctx.restore();
  // Чашечка.
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.95);
  g.addColorStop(0, '#d6a266');
  g.addColorStop(0.55, '#9a6632');
  g.addColorStop(1, '#5e3a18');
  outline(ctx, 1.7);
  ell(ctx, x, y, r * 0.86, r * 0.8, angle);
  fs(ctx, g);
  ctx.save();
  ell(ctx, x, y, r * 0.86, r * 0.8, angle);
  ctx.clip();
  ctx.strokeStyle = 'rgba(55,28,8,0.55)';
  ctx.lineWidth = 0.7;
  const st = r * 0.36;
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const u = i * st + (j % 2 ? st / 2 : 0);
      const v = j * st * 0.8;
      const px = x + fx * u + sx * v;
      const py = y + fy * u + sy * v;
      ctx.beginPath();
      ctx.arc(px, py, st * 0.5, angle + Math.PI * 0.6, angle + Math.PI * 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Черешок назад.
  const bx = x - fx * r * 0.2;
  const by = y - fy * r * 0.2;
  const ex = x - fx * r * 0.9 + sx * r * 0.25;
  const ey = y - fy * r * 0.9 + sy * r * 0.25;
  for (const [col, lw] of [[OUT, 2.6], ['#7a5530', 1.3]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(x - fx * r * 0.6, y - fy * r * 0.6, ex, ey); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,235,200,0.4)';
  ell(ctx, x - r * 0.35, y - r * 0.4, r * 0.24, r * 0.12, -0.5);
  ctx.fill();
}

// ───────────────────────── лесные мелочи ─────────────────────────

/** Ель: короткий ствол и ярусы лап с зубчатым низом, светлые кончики слева. */
function spruceTree(ctx: Ctx, x: number, base: number, h: number, w: number, seed: number): void {
  drawShadow(ctx, x + 4, base + 2, w * 0.9, w * 0.25, 0.22);
  beam(ctx, x, base + 2, x, base - h * 0.25, Math.max(4, w * 0.18), { hi: '#9a6a44', base: '#6a4428', lo: '#3a2412' });
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const bot = base - h * 0.1 - i * h * 0.165;
    const tTop = bot - h * (i === tiers - 1 ? 0.36 : 0.3);
    const tw = w * (1 - i / (tiers + 0.8));
    const n = 6;
    ctx.beginPath();
    ctx.moveTo(x, tTop);
    ctx.quadraticCurveTo(x + tw * 0.45, bot - (bot - tTop) * 0.35, x + tw, bot);
    for (let k = 1; k < n; k++) {
      const px = x + tw - (2 * tw * k) / n;
      const sag = Math.sin((Math.PI * k) / n) * 3;
      ctx.lineTo(px + tw / n * 0.5, bot - 3.5 + sag + jit(seed + i * 9 + k) * 1.5);
      ctx.lineTo(px, bot + 1 + sag);
    }
    ctx.lineTo(x - tw, bot);
    ctx.quadraticCurveTo(x - tw * 0.45, bot - (bot - tTop) * 0.35, x, tTop);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
    g.addColorStop(0, '#4a8a56');
    g.addColorStop(0.38, '#2e6a42');
    g.addColorStop(1, '#163824');
    outline(ctx, 2);
    fs(ctx, g);
    ctx.strokeStyle = 'rgba(170,225,160,0.45)';
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) {
      const px = x - tw * (0.85 - k * 0.2);
      const py = bot - 2 - jit(seed + i * 5 + k) * 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2.4, py - 2.6); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(10,30,15,0.45)';
    ctx.beginPath(); ctx.moveTo(x + tw * 0.25, tTop + (bot - tTop) * 0.45); ctx.lineTo(x + tw * 0.55, bot - 2); ctx.stroke();
  }
}

/** Шишка: яйцо с острым кончиком, чешуйки ромбами со светлыми гранями, черешок у тупого конца. */
function pineCone(ctx: Ctx, x: number, y: number, len: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const r = len * 0.34;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-len * 0.48, 0); ctx.lineTo(-len * 0.66, -1); ctx.stroke();
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.bezierCurveTo(len * 0.3, -r * 1.0, -len * 0.5, -r * 1.3, -len * 0.5, 0);
    ctx.bezierCurveTo(-len * 0.5, r * 1.3, len * 0.3, r * 1.0, len * 0.5, 0);
    ctx.closePath();
  };
  shape();
  outline(ctx, 1.4);
  fs(ctx, '#5a3214');
  ctx.save();
  shape();
  ctx.clip();
  const st = len * 0.17;
  let row = 0;
  for (let u = -len * 0.5; u < len * 0.55; u += st, row++) {
    for (let v = -r * 1.2; v <= r * 1.2; v += st) {
      const vv = v + (row % 2 ? st / 2 : 0);
      ctx.beginPath();
      ctx.moveTo(u - st * 0.55, vv);
      ctx.lineTo(u, vv - st * 0.5);
      ctx.lineTo(u + st * 0.45, vv);
      ctx.lineTo(u, vv + st * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#a8703a';
      ctx.fill();
      ctx.fillStyle = 'rgba(245,205,145,0.75)';
      ctx.beginPath(); ctx.moveTo(u, vv - st * 0.5); ctx.lineTo(u + st * 0.45, vv); ctx.lineTo(u + st * 0.1, vv); ctx.closePath(); ctx.fill();
    }
  }
  const sh = ctx.createLinearGradient(0, -r, 0, r);
  sh.addColorStop(0, 'rgba(255,230,190,0.15)');
  sh.addColorStop(1, 'rgba(30,12,0,0.4)');
  ctx.fillStyle = sh;
  ctx.fillRect(-len, -r * 1.4, len * 2, r * 2.8);
  ctx.restore();
  shape();
  outline(ctx, 1.4);
  ctx.stroke();
  ctx.restore();
}

/** Папоротник: кустик из нескольких вай с парными листочками. */
function fernCluster(ctx: Ctx, x: number, y: number, len: number, seed: number): void {
  const angs = [-2.35, -1.85, -1.3, -0.8];
  angs.forEach((a0, i) => {
    const a = a0 + (jit(seed + i) - 0.5) * 0.25;
    const l = len * (0.75 + jit(seed + i + 7) * 0.35);
    const ex = x + Math.cos(a) * l;
    const ey = y + Math.sin(a) * l;
    const mx = x + Math.cos(a) * l * 0.55 + Math.cos(a + Math.PI / 2) * l * 0.12 * (a < -1.57 ? -1 : 1);
    const my = y + Math.sin(a) * l * 0.55 - l * 0.08;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#3e7a2c';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let k = 1; k <= 7; k++) {
      const t = k / 8;
      const u = 1 - t;
      const px = u * u * x + 2 * u * t * mx + t * t * ex;
      const py = u * u * y + 2 * u * t * my + t * t * ey;
      const tx = 2 * u * (mx - x) + 2 * t * (ex - mx);
      const ty = 2 * u * (my - y) + 2 * t * (ey - my);
      const ta = Math.atan2(ty, tx);
      const sz = (1 - t) * l * 0.2 + 1.2;
      for (const s of [-1, 1]) {
        ctx.fillStyle = s < 0 ? '#5aa844' : '#3f8a32';
        ell(ctx, px + Math.cos(ta + s * 1.2) * sz * 0.7, py + Math.sin(ta + s * 1.2) * sz * 0.7, sz * 0.75, sz * 0.32, ta + s * 0.9);
        ctx.fill();
      }
    }
  });
}

/** Грибок: ножка и шляпка с бликом; spots — белые неровные хлопья (мухомор). */
function shroom(ctx: Ctx, x: number, y: number, r: number, cap: string, capLo: string, spots: boolean, seed: number): void {
  outline(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.38, y);
  ctx.quadraticCurveTo(x - r * 0.48, y - r * 0.6, x - r * 0.3, y - r * 1.05);
  ctx.lineTo(x + r * 0.3, y - r * 1.05);
  ctx.quadraticCurveTo(x + r * 0.48, y - r * 0.6, x + r * 0.38, y);
  ctx.closePath();
  const sg = ctx.createLinearGradient(x - r * 0.4, 0, x + r * 0.4, 0);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, '#cdbf9e');
  fs(ctx, sg);
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.85);
  ctx.bezierCurveTo(x - r, y - r * 2.05, x + r, y - r * 2.05, x + r, y - r * 0.85);
  ctx.quadraticCurveTo(x, y - r * 0.55, x - r, y - r * 0.85);
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 1.6, 0.5, x, y - r, r * 1.2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.12, cap);
  g.addColorStop(1, capLo);
  outline(ctx, 1.5);
  fs(ctx, g);
  if (spots) {
    ctx.fillStyle = '#fbf6ea';
    for (let i = 0; i < 4; i++) {
      const px = x + (jit(seed + i) - 0.5) * r * 1.3;
      const py = y - r * (1.15 + jit(seed + i + 5) * 0.45);
      ell(ctx, px, py, r * (0.1 + jit(seed + i + 2) * 0.08), r * (0.07 + jit(seed + i + 3) * 0.05), jit(seed + i) * 2);
      ctx.fill();
    }
  }
}

/** Боровик: толстая светлая ножка и бурая бархатная шляпка. */
function porcini(ctx: Ctx, x: number, y: number, r: number): void {
  shroom(ctx, x, y, r, '#9a5c2c', '#4e2a10', false, 0);
}

/** Мухомор: красная шляпка с белыми хлопьями. */
function flyAgaric(ctx: Ctx, x: number, y: number, r: number, seed: number): void {
  shroom(ctx, x, y, r, '#e0402e', '#8a1e12', true, seed);
}

/** Бородовидный топор: топорище и железное лезвие с бородой, светлая кромка. */
function axe(ctx: Ctx, hx: number, hy: number, tx: number, ty: number, flip = 1): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = '#b07a46';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(Math.atan2(ty - hy, tx - hx));
  ctx.scale(1, flip);
  ctx.beginPath();
  ctx.moveTo(-2.4, -2.6);
  ctx.lineTo(2.2, -2.6);
  ctx.lineTo(3.6, -10.5);
  ctx.quadraticCurveTo(-1, -11.6, -6.5, -10.6);
  ctx.quadraticCurveTo(-3.4, -8, -2.4, -2.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -2.6, 0, -11);
  g.addColorStop(0, '#5e646c');
  g.addColorStop(1, '#c8ccd2');
  outline(ctx, 1.5);
  fs(ctx, g);
  ctx.strokeStyle = '#f2f5f8';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(3.2, -9.9); ctx.quadraticCurveTo(-1, -10.9, -5.8, -10.1); ctx.stroke();
  outline(ctx, 1.3);
  ctx.beginPath();
  ctx.rect(-2.6, -2.8, 5, 5.6);
  fs(ctx, '#4e545c');
  ctx.restore();
}

/** Каплевидный щит: красное поле, белая «ёлочка», железная оковка по краю. */
function kiteShield(ctx: Ctx, x: number, y: number, w: number, h: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.bezierCurveTo(w * 0.66, -h / 2, w * 0.56, h * 0.12, 0, h / 2);
    ctx.bezierCurveTo(-w * 0.56, h * 0.12, -w * 0.66, -h / 2, 0, -h / 2);
    ctx.closePath();
  };
  shape();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#e05a4a');
  g.addColorStop(0.4, '#c8352a');
  g.addColorStop(1, '#6e1810');
  outline(ctx, 2);
  fs(ctx, g);
  ctx.save();
  shape();
  ctx.clip();
  ctx.strokeStyle = CARVE;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.32); ctx.lineTo(0, h * 0.3); ctx.stroke();
  for (const k of [-0.24, -0.04, 0.16]) {
    const hw = w * (0.18 + (k + 0.24) * 0.35);
    ctx.beginPath(); ctx.moveTo(-hw, h * k + 3); ctx.lineTo(0, h * k); ctx.lineTo(hw, h * k + 3); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#8a9099';
  ctx.lineWidth = 1.2;
  shape();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ell(ctx, -w * 0.2, -h * 0.25, w * 0.12, h * 0.16, 0.2);
  ctx.fill();
  ctx.restore();
}

/** Колода с воткнутым топором и пара колотых поленьев рядом. */
function choppingBlock(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawShadow(ctx, 1, 4, 16, 4.5, 0.2);
  // Поленья: трёхгранные, светлый скол.
  for (const [px, py, a] of [[-11, 4, -0.15], [-7, 6.5, 0.1]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(7, -3.6); ctx.lineTo(-5, -3.6);
    ctx.closePath();
    outline(ctx, 1.3);
    fs(ctx, '#8a5a2c');
    ctx.beginPath();
    ctx.moveTo(-5, -3.6); ctx.lineTo(7, -3.6); ctx.lineTo(4.5, -5.6); ctx.lineTo(-7.2, -5.6);
    ctx.closePath();
    fs(ctx, '#ecc890');
    ctx.restore();
  }
  // Колода.
  const r = 8;
  outline(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(-r, -9);
  ctx.lineTo(-r, 2);
  ctx.ellipse(0, 2, r, 3.2, 0, Math.PI, 0, true);
  ctx.lineTo(r, -9);
  ctx.closePath();
  const bg = ctx.createLinearGradient(-r, 0, r, 0);
  bg.addColorStop(0, '#8a5a32');
  bg.addColorStop(0.3, '#b07a46');
  bg.addColorStop(1, '#4e2e14');
  fs(ctx, bg);
  ctx.strokeStyle = 'rgba(40,20,5,0.5)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.5, 0.15, 0.6]) { ctx.beginPath(); ctx.moveTo(k * r, -7); ctx.lineTo(k * r + 0.5, 3); ctx.stroke(); }
  outline(ctx, 1.6);
  ell(ctx, 0, -9, r, 3.2);
  fs(ctx, '#e8c58c');
  ctx.strokeStyle = 'rgba(130,80,35,0.6)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(-5.5, -10.5); ctx.moveTo(1, -8.6); ctx.lineTo(5, -7.6); ctx.stroke();
  axe(ctx, 9, -21, 1.5, -10, 1);
  ctx.restore();
}

/** Мешок из рогожи с шишками: завязан лыком, из горловины торчат две шишки. */
function coneSack(ctx: Ctx, x: number, y: number): void {
  drawShadow(ctx, x + 1, y + 6, 11, 3.5, 0.2);
  pineCone(ctx, x - 3.5, y - 8, 8.5, -2.3);
  pineCone(ctx, x + 3.5, y - 8.5, 8.5, -0.8);
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 6);
  ctx.quadraticCurveTo(x - 10, y - 2, x - 8.5, y + 5);
  ctx.quadraticCurveTo(x, y + 8, x + 8.5, y + 5);
  ctx.quadraticCurveTo(x + 10, y - 2, x + 4, y - 6);
  ctx.closePath();
  const g = ctx.createRadialGradient(x - 3, y - 2, 0.5, x, y, 10);
  g.addColorStop(0, '#e2c088');
  g.addColorStop(0.6, '#b8914e');
  g.addColorStop(1, '#7a5a26');
  fs(ctx, g);
  ctx.strokeStyle = 'rgba(90,60,20,0.45)';
  ctx.lineWidth = 0.6;
  for (let k = -6; k <= 6; k += 2) { ctx.beginPath(); ctx.moveTo(x + k, y - 4); ctx.lineTo(x + k * 1.1, y + 5); ctx.stroke(); }
  for (const [col, lw] of [[OUT, 2.8], ['#d8b470', 1.4]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x - 4.5, y - 5.5); ctx.lineTo(x + 4.5, y - 5.5); ctx.stroke();
  }
}

// ───────────────────────── стрелки ─────────────────────────

/**
 * Сторожевая вышка Леса: сруб из медовых брёвен на валунах, с выпусками по углам и резным
 * наличником, под настилом повал на кронштейнах, позади венец из заострённых кольев с лыковой
 * обвязкой; стрелки в шлемах-желудях. 2-й уровень — красный стяг с «ёлочкой», боровики у
 * подножия; 3-й — кованый фонарь. Снайперы — шест с вымпелом, залп — широкий сруб и четверо.
 */
export function drawTowerAcidForest(ctx: Ctx, x: number, y: number, level: number, angle: number, recoil: number, variant: number): void {
  const lv = Math.min(level, 3);
  const h = 34 + lv * 8 + (level >= 4 ? 6 : 0);
  const rb = 18 + lv + (variant === 2 ? 5 : 0);
  const rt = rb - 3;
  const dr = rt + 9;
  const top = y - h;
  drawShadow(ctx, x + 3, y + 8, dr + 14, 15, 0.2);
  if (level >= 2 && variant !== 1) forestBanner(ctx, x + dr + 2, y + 2, top - 30);
  const bot = y - 1;
  const bt = top + 8;
  const stones = Math.round(rb / 6);
  for (let i = 0; i < stones; i++) {
    const k = stones > 1 ? i / (stones - 1) : 0.5;
    fieldStone(ctx, x - rb * 0.8 + k * rb * 1.6, y + 3, 5.5 + jit(i + 3) * 1.5, 40 + i * 9);
  }
  logCrib(ctx, x, bt, bot, (yy) => rt + ((rb - rt) * (yy - bt)) / (bot - bt), 40 + lv * 7 + variant * 3);
  mossPatch(ctx, x - rb * 0.55, bot - 2, 7, 11 + lv);
  mossPatch(ctx, x + rb * 0.5, bot - 1, 5, 23);
  nalichnik(ctx, x, bt + (bot - bt) * 0.46, 7, 8);
  fernCluster(ctx, x - rb - 3, y + 7, 13, 5);
  if (lv >= 2) {
    porcini(ctx, x - rb + 4, y + 10, 4.8);
    porcini(ctx, x - rb - 5, y + 11, 3.6);
    fernCluster(ctx, x + rb + 4, y + 8, 10, 17);
  }
  // Повал: кронштейны под настилом.
  for (const k of [-0.75, 0, 0.75]) beam(ctx, x + k * rt * 0.85, bt + 8, x + k * (dr - 2), top + 10, 3.4, PINE);
  // Настил из досок.
  const ry = 9;
  outline(ctx, 2.5);
  ell(ctx, x, top + 4, dr, ry);
  fs(ctx, PINE.lo);
  ell(ctx, x, top, dr, ry);
  const dg = ctx.createRadialGradient(x - dr * 0.3, top - 3, 2, x, top, dr);
  dg.addColorStop(0, '#f0c890');
  dg.addColorStop(1, '#a8723c');
  fs(ctx, dg, false);
  ctx.save();
  ell(ctx, x, top, dr, ry);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,45,15,0.45)';
  ctx.lineWidth = 1;
  for (let k = -dr + 5; k < dr; k += 5.2) { ctx.beginPath(); ctx.moveTo(x + k, top - ry); ctx.lineTo(x + k, top + ry); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5.5;
  ell(ctx, x, top, dr, ry);
  ctx.stroke();
  ctx.strokeStyle = PINE.base;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,196,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, top + 0.6, dr - 0.5, ry - 0.3, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  // Венец из кольев позади настила.
  const posts = 5 + lv;
  const pts: Vec[] = [];
  for (let i = 0; i < posts; i++) {
    const th = Math.PI * 1.04 + ((Math.PI * 0.92) * i) / (posts - 1);
    pts.push({ x: x + Math.cos(th) * dr * 0.9, y: top + Math.sin(th) * ry * 0.9 + 1 });
  }
  pts.forEach((p, i) => stake(ctx, p.x, p.y + 1, p.y - 12 - jit(i + 70) * 3, 4.4));
  withy(ctx, pts, -5);
  if (level >= 3 && variant !== 1) {
    const lx = x - rb - 5;
    const ly = bt + 9;
    beam(ctx, x - rt + 2, ly + 1.5, lx - 1, ly - 0.5, 2.8, PINE);
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 5); ctx.stroke();
    forgedLantern(ctx, lx, ly + 17);
  }
  if (variant === 1) {
    woodPole(ctx, x + 8, top + 2, top - 46, 3.6);
    pennant(ctx, x + 8, top - 44, 24, 13, RED);
    outline(ctx, 1.3);
    ctx.beginPath(); ctx.moveTo(x + 8, top - 54); ctx.lineTo(x + 10, top - 47); ctx.lineTo(x + 6, top - 47); ctx.closePath();
    fs(ctx, '#a4a8ae');
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
    acornHelmet(ctx, ax + Math.cos(angle) * 14 * as, ay + Math.sin(angle) * 14 * as, 5.8 * as / 0.6, angle);
  }
}

// ───────────────────────── казарма ─────────────────────────

/**
 * Казарма Леса: изба-сруб торцом к зрителю — выпуски брёвен по углам, бревенчатый фронтон,
 * кровля из серебристого тёса с охлупнем, белые резные причелины и полотенце, открытая дверь
 * с тёплым светом и окно в наличнике, печная труба с дымком. 2-й уровень — колода с топором,
 * красная роспись по резьбе; 3-й — изба выше, крыльцо под навесом и флюгер на коньке.
 * Броненосцы — каплевидные красные щиты, жнецы — скрещённые топоры.
 */
export function drawTowerBarracksForest(ctx: Ctx, x: number, y: number, level: number, variant: number): void {
  const lv = Math.min(level, 3);
  const hw = 24;
  const wBot = y + 2;
  const wTop = y - 23;
  const gh = 26 + (lv - 1) * 3 + (lv >= 3 ? 2 : 0);
  const apex = wTop - gh;
  const ov = 8;
  const depth = 11;
  const eave = wTop + 4;
  const rApex = apex - 2;
  const rHalf = hw + ov;
  drawShadow(ctx, x + 4, y + 12, 48, 16, 0.2);
  forestBanner(ctx, x + 37, y - 2, apex - 18);
  if (variant === 2) {
    axe(ctx, x - 32, y - 4, x + 13, apex - 16, -1);
    axe(ctx, x + 32, y - 4, x - 13, apex - 16, 1);
  }
  if (lv >= 2) choppingBlock(ctx, x - 34, y + 5, 0.92);
  // Стена и фронтон.
  logCrib(ctx, x, wTop, wBot, () => hw, 200 + lv);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - hw - 2, wTop + 0.6);
  ctx.lineTo(x, apex);
  ctx.lineTo(x + hw + 2, wTop + 0.6);
  ctx.closePath();
  ctx.clip();
  logCrib(ctx, x, apex, wTop + 0.6, () => hw + 2, 230, 5.4, false);
  ctx.strokeStyle = 'rgba(30,15,5,0.35)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x - hw - 2, wTop + 0.6); ctx.lineTo(x, apex); ctx.lineTo(x + hw + 2, wTop + 0.6); ctx.stroke();
  ctx.restore();
  // Кровля, труба, резьба.
  gableRoof(ctx, x, eave, rApex, rHalf, depth);
  const chx = x + 13;
  const chy = eave + (rApex - eave) * (1 - 13 / rHalf) - depth * 0.55;
  outline(ctx, 1.8);
  ctx.beginPath();
  ctx.rect(chx - 3.5, chy - 13, 7, 14);
  const cg = ctx.createLinearGradient(chx - 3.5, 0, chx + 3.5, 0);
  cg.addColorStop(0, '#c8826a');
  cg.addColorStop(1, '#7a3e2c');
  fs(ctx, cg);
  ctx.strokeStyle = 'rgba(60,25,15,0.5)';
  ctx.lineWidth = 0.7;
  for (const dy of [-9, -5, -1]) { ctx.beginPath(); ctx.moveTo(chx - 3.5, chy + dy); ctx.lineTo(chx + 3.5, chy + dy); ctx.stroke(); }
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(chx - 4.6, chy - 15, 9.2, 3);
  fs(ctx, '#6a3424');
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(225,228,232,${0.6 - i * 0.15})`;
    circle(ctx, chx + 2 + i * 3, chy - 21 - i * 7, 3 + i * 1.6);
    ctx.fill();
  }
  bargeboards(ctx, x, eave, rApex, rHalf, 4.2, lv >= 2);
  towel(ctx, x, rApex + 2, 10, lv >= 2);
  // Окно в наличнике справа.
  nalichnik(ctx, x + 12, wBot - 14, 7, 7);
  // Открытая дверь слева от середины.
  const dx0 = x - 14;
  const dx1 = x - 3;
  const dTop = wBot - 18;
  const dGlow = ctx.createRadialGradient((dx0 + dx1) / 2, wBot - 6, 1, (dx0 + dx1) / 2, wBot - 6, 18);
  dGlow.addColorStop(0, 'rgba(255,180,80,0.5)');
  dGlow.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = dGlow;
  circle(ctx, (dx0 + dx1) / 2, wBot - 6, 18);
  ctx.fill();
  outline(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(dx0 - 1.8, dTop - 1.8, dx1 - dx0 + 3.6, wBot - dTop + 1.8);
  fs(ctx, PINE.base);
  ctx.beginPath();
  ctx.rect(dx0, dTop, dx1 - dx0, wBot - dTop);
  const dg = ctx.createLinearGradient(0, dTop, 0, wBot);
  dg.addColorStop(0, '#5a2a10');
  dg.addColorStop(1, '#f0a050');
  fs(ctx, dg);
  // Створка распахнута наружу.
  ctx.beginPath();
  ctx.moveTo(dx0, dTop);
  ctx.lineTo(dx0 - 6, dTop + 2.5);
  ctx.lineTo(dx0 - 6, wBot + 2);
  ctx.lineTo(dx0, wBot);
  ctx.closePath();
  outline(ctx, 1.5);
  fs(ctx, '#8a5a30');
  ctx.strokeStyle = IRON;
  ctx.lineWidth = 1.1;
  for (const k of [0.25, 0.75]) {
    ctx.beginPath(); ctx.moveTo(dx0, dTop + (wBot - dTop) * k); ctx.lineTo(dx0 - 6, dTop + 2.5 + (wBot - dTop) * k); ctx.stroke();
  }
  // Порог-бревно.
  beam(ctx, dx0 - 3, wBot + 2.5, dx1 + 3, wBot + 2.5, 3.4, PINE);
  if (lv >= 3) {
    // Крыльцо: два резных столбика и навес над дверью.
    const cx = (dx0 + dx1) / 2;
    for (const px of [dx0 - 3.5, dx1 + 3.5]) {
      beam(ctx, px, wBot + 3, px, dTop - 3, 2.6, PINE);
      outline(ctx, 1);
      ell(ctx, px, dTop + 5, 2.2, 1.6);
      fs(ctx, CARVE);
    }
    const ceave = dTop - 3;
    const capex = dTop - 11;
    gableRoof(ctx, cx, ceave, capex, 10, 4);
    bargeboards(ctx, cx, ceave, capex, 10, 2.4, true);
    // Флюгер на заднем конце конька.
    const vx = x;
    const vy = rApex - depth - 2;
    outline(ctx, 1.4);
    ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - 16); ctx.stroke();
    ctx.strokeStyle = '#7a7e84';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vx, vy - 16); ctx.lineTo(vx + 9, vy - 13.5); ctx.lineTo(vx + 6.5, vy - 11.5); ctx.lineTo(vx + 9, vy - 9.5); ctx.lineTo(vx, vy - 9.5);
    ctx.closePath();
    outline(ctx, 1.3);
    fs(ctx, RED);
  }
  fernCluster(ctx, x + hw + 3, y + 8, 11, 31);
  if (variant === 1) {
    kiteShield(ctx, x - 36, y - 3, 13.5, 20, -0.12);
    kiteShield(ctx, x + 36, y - 1, 13.5, 20, 0.12);
  }
}

// ───────────────────────── грибница ─────────────────────────

/**
 * Трутовик на стволе: полукруглая полка с плоским краем вдоль коры, торчит от точки крепления
 * (ax, ay) к зрителю (dir 0) или вбок (±1); волнистая кромка, дуги нарастания, низ потемнее.
 */
function shelfFungus(ctx: Ctx, px: number, py: number, dir: number, w: number, tone: ShelfTone, tilt = 0): void {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt);
  const ax = 0;
  const ay = 0;
  const rx = dir === 0 ? w : w * 0.95;
  const ry = dir === 0 ? w * 0.55 : w * 0.42;
  const a0 = dir === 0 ? 0 : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  const shape = (k: number, dy: number, wavy: boolean): void => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = a0 + (i / 24) * Math.PI;
      const m = wavy ? 1 + 0.035 * Math.sin(i * 1.3 + px) : 1;
      ctx.lineTo(ax + Math.cos(a) * rx * k * m, ay + dy + Math.sin(a) * ry * k * m);
    }
    ctx.closePath();
  };
  outline(ctx, 1.8);
  shape(1, 2.8, true);
  fs(ctx, tone.lo);
  shape(1, 0, true);
  const g = ctx.createRadialGradient(ax, ay, 0.5, ax, ay, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, tone.base);
  g.addColorStop(0.6, tone.base);
  g.addColorStop(0.9, tone.hi);
  g.addColorStop(1, tone.hi);
  fs(ctx, g);
  ctx.save();
  shape(1, 0, true);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,250,220,0.22)';
  ell(ctx, ax - rx * 0.3, ay + ry * 0.1, rx * 0.5, ry * 0.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,35,5,0.3)';
  ctx.lineWidth = 0.9;
  for (const k of [0.45, 0.7]) {
    ctx.beginPath();
    ctx.ellipse(ax, ay, rx * k, ry * k, 0, a0 + 0.05, a0 + Math.PI - 0.05);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,20,5,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(a0) * rx, ay + Math.sin(a0) * ry);
  ctx.lineTo(ax - Math.cos(a0) * rx, ay - Math.sin(a0) * ry);
  ctx.stroke();
  ctx.restore();
}

/** Дятел: держится за ствол справа, клюв к коре; чёрно-белый, красная шапочка и подхвостье. */
function woodpecker(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  outline(ctx, 1.2);
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(2.6, 12); ctx.lineTo(-1.2, 11); ctx.closePath(); fs(ctx, '#26262c');
  outline(ctx, 1.4);
  ell(ctx, 1, 0, 3.6, 6.2, 0.12);
  fs(ctx, '#26262c');
  ctx.fillStyle = '#f2f0ea';
  ell(ctx, 2.4, -1.5, 1.4, 2.8, 0.2);
  ctx.fill();
  ctx.fillRect(1.2, 2.2, 2.6, 0.9);
  ctx.fillRect(1.4, 4, 2.2, 0.8);
  ctx.fillStyle = '#d8372a';
  ell(ctx, 0.2, 5.2, 1.8, 1.4);
  ctx.fill();
  outline(ctx, 1.3);
  circle(ctx, -0.6, -7.2, 2.9);
  fs(ctx, '#26262c');
  ctx.fillStyle = '#f2f0ea';
  ell(ctx, -0.9, -6.1, 1.7, 0.9, 0.2);
  ctx.fill();
  ctx.fillStyle = '#d8372a';
  circle(ctx, 1.7, -8.3, 1.1);
  ctx.fill();
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath(); ctx.moveTo(-3.2, -7.6); ctx.lineTo(-7, -6.9); ctx.lineTo(-3.2, -6.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * Грибница Леса: обломанный ствол старой берёзы — белая кора с чёрными чечевичками, тёмный
 * потрескавшийся низ, светлый излом сверху; на стволе ярусы трутовиков. 2-й уровень —
 * папоротник и боровики у корней, 3-й — дятел на стволе. Гниль — болотные, дурман — лиловые.
 */
export function drawTowerSporeForest(ctx: Ctx, x: number, y: number, level: number, time: number, variant: number): void {
  const lv = Math.min(level, 3);
  const tone: ShelfTone = variant === 1
    ? { hi: '#eef0a8', base: '#a8b03a', lo: '#4f5a14' }
    : variant === 2 ? { hi: '#ffe0ff', base: '#b45ad8', lo: '#521a78' } : { hi: '#ffec9a', base: '#f4a434', lo: '#a8501a' };
  const glow = variant === 1 ? '150,170,60' : variant === 2 ? '200,120,255' : '181,123,214';
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
  drawShadow(ctx, x + 3, y + 10, 30, 12, 0.2);
  const R = 12.5;
  const top = y - 40 - lv * 2;
  const gl = ctx.createRadialGradient(x, top + 8, 2, x, top + 8, 40);
  gl.addColorStop(0, `rgba(${glow},${0.45 * pulse})`);
  gl.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = gl;
  circle(ctx, x, top + 8, 40);
  ctx.fill();
  // Корни: короткие приземистые наплывы, утопают во мху.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * (R - 3), y - 7);
    ctx.quadraticCurveTo(x + s * (R + 2), y - 1, x + s * (R + 9), y + 5);
    ctx.lineTo(x + s * (R - 1), y + 6);
    ctx.closePath();
    const rg = ctx.createLinearGradient(x + s * R, y - 6, x + s * (R + 8), y + 6);
    rg.addColorStop(0, BIRCH_ROOT.hi);
    rg.addColorStop(1, BIRCH_ROOT.lo);
    outline(ctx, 2);
    fs(ctx, rg);
  }
  const jag: ReadonlyArray<readonly [number, number]> = [[-1, 4], [-0.62, -3], [-0.32, 2], [0, -7], [0.28, 0], [0.56, -4], [1, 5]];
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - R - 1, y + 2);
    for (const [k, dy] of jag) ctx.lineTo(x + k * R, top + dy);
    ctx.lineTo(x + R + 1, y + 2);
    ctx.ellipse(x, y + 2, R + 1, 5, 0, 0, Math.PI);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
  g.addColorStop(0, '#c4beb2');
  g.addColorStop(0.28, '#fbf8f0');
  g.addColorStop(0.62, '#e2dccf');
  g.addColorStop(1, '#8e887e');
  outline(ctx, 2.5);
  fs(ctx, g);
  ctx.save();
  body();
  ctx.clip();
  // Тёмный потрескавшийся низ.
  const lg = ctx.createLinearGradient(0, y - 12, 0, y + 2);
  lg.addColorStop(0, 'rgba(58,52,48,0)');
  lg.addColorStop(0.45, 'rgba(58,52,48,0.85)');
  lg.addColorStop(1, 'rgba(40,36,32,0.95)');
  ctx.fillStyle = lg;
  ctx.fillRect(x - R - 2, y - 12, 2 * R + 4, 16);
  ctx.strokeStyle = 'rgba(220,214,200,0.45)';
  ctx.lineWidth = 0.8;
  for (const k of [-0.6, -0.15, 0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(x + k * R, y - 7); ctx.lineTo(x + k * R + 0.6, y + 3); ctx.stroke(); }
  // Чечевички: чёрные чёрточки поперёк ствола, у краёв короче.
  ctx.strokeStyle = '#2a2420';
  for (let i = 0; i < 36; i++) {
    const k = jit(i + 300) * 1.8 - 0.9;
    const py = top + 5 + jit(i + 320) * (y - top - 16);
    const len = (1.2 + jit(i + 340) * 6.5) * Math.sqrt(1 - k * k);
    ctx.lineWidth = 0.9 + jit(i + 360) * 0.9;
    ctx.beginPath(); ctx.moveTo(x + k * R - len / 2, py); ctx.quadraticCurveTo(x + k * R, py + 0.6, x + k * R + len / 2, py); ctx.stroke();
  }
  // Светлый излом.
  ctx.beginPath();
  jag.forEach(([k, dy], i) => (i ? ctx.lineTo(x + k * R, top + dy) : ctx.moveTo(x + k * R, top + dy)));
  for (let i = jag.length - 1; i >= 0; i--) ctx.lineTo(x + jag[i][0] * R, top + jag[i][1] + 4.5);
  ctx.closePath();
  ctx.fillStyle = '#e8c48a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,25,0.55)';
  ctx.lineWidth = 0.7;
  for (const k of [-0.5, 0.1, 0.65]) { ctx.beginPath(); ctx.moveTo(x + k * R, top - 1); ctx.lineTo(x + k * R + 0.4, top + 5); ctx.stroke(); }
  ctx.restore();
  body();
  outline(ctx, 2.5);
  ctx.stroke();
  // Щепа на изломе.
  outline(ctx, 1.2);
  ctx.beginPath(); ctx.moveTo(x - R * 0.7, top + 1); ctx.lineTo(x - R * 0.55, top - 9); ctx.lineTo(x - R * 0.4, top + 1); ctx.closePath(); fs(ctx, '#f2d6a2');
  ctx.beginPath(); ctx.moveTo(x + R * 0.1, top - 3); ctx.lineTo(x + R * 0.18, top - 11); ctx.lineTo(x + R * 0.32, top - 2); ctx.closePath(); fs(ctx, '#e8c48a');
  mossPatch(ctx, x - R * 0.4, y - 1, 8, 77);
  mossPatch(ctx, x + R * 0.6, y + 1, 6, 83);
  if (lv >= 2) {
    fernCluster(ctx, x - R - 8, y + 9, 13, 41);
    fernCluster(ctx, x + R + 8, y + 10, 11, 53);
    porcini(ctx, x + R + 1, y + 11, 4.2);
  }
  // Трутовики: [крепление по ширине ствола, высота от земли, направление, размер].
  const shelves: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.18, -19, 0, 13], [1, -33, 1, 10], [-1, -12, -1, 9.5], [0.2, -35, 0, 8.5], [-1, -25, -1, 8],
  ];
  const n = [3, 4, 5][lv - 1];
  const grow = variant ? 1.1 : 1;
  for (const [k, dy, dir, w] of shelves.slice(0, n)) {
    shelfFungus(ctx, x + k * R, y + dy - (dy < -30 ? lv * 2 : 0), dir, w * grow, tone, dir === 0 ? (k < 0 ? -0.14 : 0.12) : dir * 0.1);
  }
  if (lv >= 3) woodpecker(ctx, x + R + 3, top + 13, 0.95);
  for (let i = 0; i < 3 + level; i++) {
    const t = (time * 0.35 + i * 0.23) % 1;
    const sx = x + Math.sin(time * 1.3 + i * 1.7) * 18;
    const sy = top - 8 - t * 40;
    ctx.fillStyle = `rgba(${glow},${(1 - t) * 0.85})`;
    circle(ctx, sx, sy, 2.4 + (1 - t) * 1.6);
    ctx.fill();
  }
}

// ───────────────────────── катапульта ─────────────────────────

/** Замшелый валун — снаряд камнемёта. */
function mossyBoulder(ctx: Ctx, x: number, y: number, r: number): void {
  outline(ctx, 1.8);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const rr = r * (0.85 + jit(i + 500) * 0.2);
    ctx.lineTo(x + Math.cos(a) * rr * 1.1, y + Math.sin(a) * rr * 0.9);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0.5, x, y, r * 1.2);
  g.addColorStop(0, '#d0cec6');
  g.addColorStop(0.6, '#8f8d86');
  g.addColorStop(1, '#55534e');
  fs(ctx, g);
  ctx.fillStyle = '#7aa83e';
  ell(ctx, x - r * 0.15, y - r * 0.5, r * 0.65, r * 0.3, -0.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,240,150,0.6)';
  circle(ctx, x - r * 0.35, y - r * 0.6, 0.8);
  ctx.fill();
}

/**
 * Катапульта Леса: помост — круг из стоячих брёвен с дощатым полом и мхом по краю, поворотный
 * круг в железном ободе, рама из медовых брёвен с лыковой обвязкой углов, лыковая корзина.
 * 2-й уровень — бухта лыковой верёвки, 3-й — мешок с шишками у помоста. Снаряды — еловые шишки,
 * камнемёт — замшелый валун, дождь — три шишки.
 */
export function drawTowerCatapultForest(ctx: Ctx, x: number, y: number, level: number, angle: number, armPhase: number, variant: number): void {
  const lv = Math.min(level, 3);
  drawShadow(ctx, x + 3, y + 10, 42, 15, 0.2);
  const side = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 36, 15, 0, 0, Math.PI);
    ctx.lineTo(x - 36, y + 5);
    ctx.ellipse(x, y + 5, 36, 15, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  ctx.save();
  side();
  ctx.clip();
  ctx.fillStyle = '#5a3414';
  ctx.fillRect(x - 37, y - 4, 74, 26);
  const nLogs = 24;
  for (let i = 0; i < nLogs; i++) {
    const a0 = Math.PI - (i / nLogs) * Math.PI;
    const a1 = Math.PI - ((i + 1) / nLogs) * Math.PI;
    const xa = x + Math.cos(a0) * 36;
    const xb = x + Math.cos(a1) * 36;
    const lg = ctx.createLinearGradient(xa, 0, xb, 0);
    lg.addColorStop(0, '#d8a060');
    lg.addColorStop(0.35, '#b47840');
    lg.addColorStop(1, '#6a3e18');
    ctx.fillStyle = lg;
    ctx.fillRect(xa + 0.5, y - 20, xb - xa - 1, 44);
  }
  const sh = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
  sh.addColorStop(0, 'rgba(40,20,5,0.1)');
  sh.addColorStop(0.3, 'rgba(255,240,210,0.1)');
  sh.addColorStop(1, 'rgba(40,20,5,0.45)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - 36, y - 4, 72, 26);
  ctx.restore();
  outline(ctx, 2.5);
  ell(ctx, x, y + 5, 36, 15);
  ctx.stroke();
  ell(ctx, x, y - 2, 36, 15);
  const fg = ctx.createRadialGradient(x - 12, y - 8, 2, x, y - 2, 36);
  fg.addColorStop(0, '#f0c890');
  fg.addColorStop(1, '#a8723c');
  fs(ctx, fg);
  ctx.save();
  ell(ctx, x, y - 2, 36, 15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,45,15,0.42)';
  ctx.lineWidth = 1;
  for (let k = -15; k <= 15; k += 4.6) { ctx.beginPath(); ctx.moveTo(x - 36, y - 2 + k); ctx.lineTo(x + 36, y - 2 + k); ctx.stroke(); }
  ctx.restore();
  mossPatch(ctx, x - 26, y + 7, 9, 601);
  mossPatch(ctx, x + 22, y + 10, 7, 611);
  fernCluster(ctx, x - 37, y + 11, 12, 621);
  if (lv >= 3) {
    coneSack(ctx, x + 37, y + 9);
  } else {
    pineCone(ctx, x + 31, y + 14, 9, -0.4);
    pineCone(ctx, x + 38, y + 10, 8, 0.5);
  }
  const tr = variant === 1 ? 31 : 28;
  const ty0 = y - 7;
  outline(ctx, 2.5);
  ell(ctx, x, ty0 + 3, tr, tr * 0.46);
  fs(ctx, '#4e2e14');
  ell(ctx, x, ty0, tr, tr * 0.46);
  const tg = ctx.createRadialGradient(x - 8, ty0 - 4, 2, x, ty0, tr);
  tg.addColorStop(0, '#b47a44');
  tg.addColorStop(1, '#6a4020');
  fs(ctx, tg);
  ctx.save();
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,15,2,0.45)';
  ctx.lineWidth = 1;
  for (let k = -tr; k <= tr; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, ty0 - tr); ctx.lineTo(x + k, ty0 + tr); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ell(ctx, x, ty0, tr, tr * 0.46);
  ctx.stroke();
  ctx.strokeStyle = '#5c626b';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,236,242,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, ty0 - 0.6, tr, tr * 0.46, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  // Рама на стойках из медовых брёвен.
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
    beam(ctx, px, py + 1, px, py - lift, 4.2, PINE);
  }
  ctx.save();
  ctx.translate(x, y - 12 - lift);
  ctx.rotate(angle);
  beam(ctx, -17, -11, 17, -11, 4.6, PINE);
  beam(ctx, -17, 11, 17, 11, 4.6, PINE);
  beam(ctx, -15, 13, -15, -13, 4.6, PINE);
  beam(ctx, 15, 13, 15, -13, 4.6, PINE);
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    outline(ctx, 1.3);
    ctx.beginPath();
    ctx.roundRect(-3.4, -3.4, 6.8, 6.8, 1.4);
    fs(ctx, '#d8b470');
    ctx.strokeStyle = 'rgba(90,55,15,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-3.4, -1.1); ctx.lineTo(3.4, -1.1); ctx.moveTo(-3.4, 1.1); ctx.lineTo(3.4, 1.1); ctx.stroke();
    ctx.restore();
  }
  outline(ctx, 2);
  ctx.beginPath();
  ctx.rect(-2.5, -12.5, 5, 25);
  fs(ctx, PINE.lo);
  if (lv >= 2) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(-10 + i * 2.6, 0, 4.6 - i * 0.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#d2ae6c';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  const len = 30 + lv * 5 + (variant === 1 ? 6 : 0);
  const p = armPhase;
  const tx = -len * Math.cos(p * Math.PI);
  const ty = -len * 0.25 * Math.sin(p * Math.PI);
  beam(ctx, 0, 0, tx, ty, variant === 1 ? 6 : 5, PINE);
  // Лыковая корзина.
  const bw = variant === 2 ? 13 : 9;
  const bh = variant === 2 ? 8 : 6.5;
  outline(ctx, 2.2);
  ell(ctx, tx, ty, bw, bh);
  const lg2 = ctx.createRadialGradient(tx - bw * 0.3, ty - bh * 0.4, 1, tx, ty, bw);
  lg2.addColorStop(0, '#e0bc78');
  lg2.addColorStop(1, '#8a6430');
  fs(ctx, lg2);
  ctx.save();
  ell(ctx, tx, ty, bw, bh);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,50,15,0.55)';
  ctx.lineWidth = 0.9;
  for (let k = -bw * 2; k < bw * 2; k += 3) {
    ctx.beginPath(); ctx.moveTo(tx + k, ty - bh); ctx.lineTo(tx + k + bh * 2, ty + bh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx + k, ty + bh); ctx.lineTo(tx + k + bh * 2, ty - bh); ctx.stroke();
  }
  ctx.restore();
  if (p < 0.5) {
    if (variant === 1) {
      mossyBoulder(ctx, tx, ty - 0.5, 6.5);
    } else {
      const cones: ReadonlyArray<readonly [number, number, number]> = variant === 2
        ? [[-5, -0.5, 0.4], [4, -2, -0.5], [0, 2.4, 1.3]]
        : lv >= 3 ? [[-2.8, 0.4, 0.5], [3.4, -1.4, -0.6]] : [[0, 0, 0.3]];
      const cl = variant === 2 ? 9 : lv >= 3 ? 9.5 : 11;
      for (const [sx, sy, a] of cones) pineCone(ctx, tx + sx, ty + sy, cl, a);
    }
  }
  outline(ctx, 2);
  circle(ctx, 0, 0, 5.5);
  fs(ctx, '#6d737c');
  ctx.fillStyle = 'rgba(240,244,248,0.7)';
  circle(ctx, -1.5, -1.5, 1.7);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────── муравейник ─────────────────────────

/** Холм рыжих лесных муравьёв: купол из хвои и веточек, свет слева сверху, боковая нора и главный вход. */
function needleMound(ctx: Ctx, x: number, y: number, rng: Rng): void {
  drawShadow(ctx, x, y + 40, 105, 22, 0.22);
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - 100, y + 32);
    ctx.bezierCurveTo(x - 75, y - 15, x - 45, y - 72, x, y - 78);
    ctx.bezierCurveTo(x + 45, y - 72, x + 75, y - 15, x + 100, y + 32);
    ctx.quadraticCurveTo(x, y + 66, x - 100, y + 32);
    ctx.closePath();
  };
  outline(ctx, 3.5);
  shape();
  const g = ctx.createLinearGradient(0, y - 78, 0, y + 55);
  g.addColorStop(0, '#d49a58');
  g.addColorStop(0.5, '#a8652e');
  g.addColorStop(1, '#6a3a16');
  fs(ctx, g);
  ctx.save();
  shape();
  ctx.clip();
  const cols = ['rgba(90,45,15,0.6)', 'rgba(245,200,130,0.55)', 'rgba(150,75,25,0.65)', 'rgba(55,28,8,0.5)', 'rgba(200,120,50,0.6)'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const px = x + rng.range(-100, 100);
    const py = y + rng.range(-80, 64);
    const a = rng.range(0, TAU);
    const l = rng.range(2.4, 5);
    ctx.strokeStyle = cols[i % cols.length];
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const px = x + rng.range(-80, 80);
    const py = y + rng.range(-60, 40);
    const a = rng.range(-0.6, 0.6) + (rng.next() < 0.5 ? 0 : Math.PI);
    const l = rng.range(8, 15);
    for (const [col, lw] of [['rgba(42,22,8,0.8)', 2.6], ['#8a5a30', 1.3]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l * 0.6); ctx.stroke();
    }
  }
  const hl = ctx.createRadialGradient(x - 32, y - 48, 4, x - 32, y - 48, 70);
  hl.addColorStop(0, 'rgba(255,230,180,0.22)');
  hl.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(x - 100, y - 80, 200, 150);
  const dk = ctx.createRadialGradient(x + 60, y + 30, 10, x + 60, y + 30, 90);
  dk.addColorStop(0, 'rgba(30,15,0,0.28)');
  dk.addColorStop(1, 'rgba(30,15,0,0)');
  ctx.fillStyle = dk;
  ctx.fillRect(x - 100, y - 80, 200, 150);
  ctx.restore();
  outline(ctx, 2.5);
  ell(ctx, x - 52, y + 24, 11, 6);
  fs(ctx, '#2a1608');
  outline(ctx, 3);
  ell(ctx, x, y + 8, 26, 14);
  fs(ctx, '#3a2412');
  ctx.fillStyle = '#140903';
  ell(ctx, x, y + 5, 17, 8);
  ctx.fill();
}

/** Лесные ворота над входом: два столба, перекладина, кровелька тёсом с причелинами, полотенцем и гербом. */
function forestGate(ctx: Ctx, x: number, base: number, r: number): void {
  for (const s of [-1, 1]) beam(ctx, x + s * (r + 3), base + 11, x + s * (r + 3), base - 21, 6, PINE);
  beam(ctx, x - r - 10, base - 20, x + r + 10, base - 20, 5, PINE);
  const eave = base - 21;
  const apex = base - 38;
  gableRoof(ctx, x, eave, apex, r + 13, 7);
  bargeboards(ctx, x, eave, apex, r + 13, 3.6, true);
  towel(ctx, x, apex + 2, 7, true);
  // Резные подкосы между столбами и перекладиной.
  for (const s of [-1, 1]) beam(ctx, x + s * (r + 3), base - 11, x + s * (r - 5), base - 19, 2.6, PINE);
}

/**
 * Муравейник Леса: купол из хвои рыжих лесных муравьёв, позади ели, у подножия частокол из
 * заострённых кольев с лыковой обвязкой (расступается у троп и у входа), над входом резные
 * ворота с кровелькой, кованые фонари, колода с топором, на холме красные стяги, вокруг
 * мухоморы, папоротники и шишки.
 */
export function drawAnthillForest(ctx: Ctx, x: number, y: number, rng: Rng, onPath?: (px: number, py: number) => boolean): void {
  if (!onPath?.(x - 104, y + 16)) spruceTree(ctx, x - 106, y + 22, 122, 30, 7);
  if (!onPath?.(x + 108, y + 2)) spruceTree(ctx, x + 112, y + 4, 90, 23, 13);
  needleMound(ctx, x, y, rng);
  for (const [px, py, top, k] of [[x - 50, y - 14, y - 86, 1.3], [x + 42, y - 36, y - 128, 1.6]] as const) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    forestBanner(ctx, 0, 0, (top - py) / k);
    ctx.restore();
  }
  // Частокол у подножия: колья вдоль нижнего края, прогоны обвязки — по непрерывным отрезкам.
  const at = (t: number): Vec => {
    const u = 1 - t;
    return { x: u * u * (x - 100) + 2 * u * t * x + t * t * (x + 100), y: u * u * (y + 32) + 2 * u * t * (y + 66) + t * t * (y + 32) };
  };
  let run: Vec[] = [];
  const flush = (): void => {
    withy(ctx, run, -6);
    withy(ctx, run, -12);
    run = [];
  };
  for (let i = 0, t = 0.02; t < 0.99; i++, t += 0.034) {
    const p = at(t);
    if (Math.abs(p.x - x) < 38 || onPath?.(p.x, p.y - 6)) {
      flush();
      continue;
    }
    stake(ctx, p.x, p.y + 1, p.y - 17 - jit(i + 1100) * 4, 5);
    run.push({ x: p.x, y: p.y });
  }
  flush();
  forestGate(ctx, x, y + 14, 27);
  // Кованый фонарь на левом конце перекладины ворот.
  const lx = x - 34;
  const ly = y - 6;
  outline(ctx, 1);
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 6); ctx.stroke();
  forgedLantern(ctx, lx, ly + 18);
  if (!onPath?.(x + 64, y + 40)) {
    beam(ctx, x + 64, y + 46, x + 64, y + 16, 3.4, PINE);
    beam(ctx, x + 64, y + 18, x + 73, y + 18, 2.6, PINE);
    outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(x + 71, y + 18); ctx.lineTo(x + 71, y + 22); ctx.stroke();
    forgedLantern(ctx, x + 71, y + 34);
  }
  if (!onPath?.(x + 86, y + 50)) choppingBlock(ctx, x + 88, y + 52, 1.1);
  if (!onPath?.(x - 80, y + 52)) {
    flyAgaric(ctx, x - 82, y + 58, 6, 3);
    flyAgaric(ctx, x - 73, y + 61, 4.2, 9);
  }
  for (const [px, py, l] of [[x - 112, y + 50, 15], [x + 30, y + 72, 12]] as const) {
    if (!onPath?.(px, py)) fernCluster(ctx, px, py, l, Math.round(px));
  }
  for (let i = 0; i < 4; i++) {
    const px = x + rng.range(-120, 120);
    const py = y + rng.range(50, 76);
    if (onPath?.(px, py)) continue;
    pineCone(ctx, px, py, rng.range(7, 10), rng.range(0, TAU));
  }
}
