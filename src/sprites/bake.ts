import { SHEET } from './layout';
import { BLACK, HERO, SOLDIER, WORKER, drawAntHD, type AntLook } from './ant';
import { TERMITE_BOMBER, TERMITE_SOLDIER, TERMITE_WORKER, drawTermiteHD } from './termite';
import { SPIDER, drawSpiderHD } from './spider';
import { BEETLE, RHINO, drawBeetleHD } from './beetle';
import { HORNET, WASP, drawWaspHD } from './wasp';
import { drawLeechHD, drawSlugHD } from './crawlers';
import { drawDragonflyHD } from './dragonfly';
import { drawQueenHD } from './royals';

/**
 * Пекарня спрайтов (только dev): растеризует векторный рисунок в лист
 * «8 направлений × N кадров» по общей раскладке SHEET, показывает лист и живой превью и
 * сохраняет PNG + JSON через dev-сервер в src/assets/sprites/.
 * Запуск: http://localhost:5173/sprites.html (?only=ant_hero печёт один лист).
 */
type Ctx = CanvasRenderingContext2D;

export interface SheetSpec {
  name: string;
  title: string;
  /** Рисует существо, смотрящее вдоль +x, с центром в начале координат. */
  draw: (ctx: Ctx, phase: number) => void;
}

const ant = (look: AntLook) => (ctx: Ctx, phase: number) => drawAntHD(ctx, phase, look);

export const SPECS: SheetSpec[] = [
  { name: 'ant_worker', title: 'Муравей-рабочий', draw: ant(WORKER) },
  { name: 'ant_soldier', title: 'Муравей-солдат казармы', draw: ant(SOLDIER) },
  { name: 'ant_hero', title: 'Жвал, воевода', draw: ant(HERO) },
  { name: 'ant_black', title: 'Чёрный муравей-налётчик', draw: ant(BLACK) },
  { name: 'termite', title: 'Термит', draw: (ctx, phase) => drawTermiteHD(ctx, phase, TERMITE_WORKER) },
  { name: 'termite_soldier', title: 'Термит-солдат', draw: (ctx, phase) => drawTermiteHD(ctx, phase, TERMITE_SOLDIER) },
  { name: 'termite_bomber', title: 'Термит-подрывник', draw: (ctx, phase) => drawTermiteHD(ctx, phase, TERMITE_BOMBER) },
  { name: 'spider', title: 'Паук', draw: (ctx, phase) => drawSpiderHD(ctx, phase, SPIDER) },
  { name: 'beetle', title: 'Жук-щитоносец', draw: (ctx, phase) => drawBeetleHD(ctx, phase, BEETLE) },
  { name: 'rhino', title: 'Жук-носорог', draw: (ctx, phase) => drawBeetleHD(ctx, phase, RHINO) },
  { name: 'wasp', title: 'Оса', draw: (ctx, phase) => drawWaspHD(ctx, phase, WASP) },
  { name: 'hornet', title: 'Шершень', draw: (ctx, phase) => drawWaspHD(ctx, phase, HORNET) },
  { name: 'slug', title: 'Слизень', draw: (ctx, phase) => drawSlugHD(ctx, phase) },
  { name: 'leech', title: 'Пиявка', draw: (ctx, phase) => drawLeechHD(ctx, phase) },
  { name: 'dragonfly', title: 'Стрекоза', draw: (ctx, phase) => drawDragonflyHD(ctx, phase) },
  { name: 'queen', title: 'Термитная матка', draw: (ctx, phase) => drawQueenHD(ctx, phase, false) },
  { name: 'empress', title: 'Королева термитов', draw: (ctx, phase) => drawQueenHD(ctx, phase, true) },
];

const DIRS = SHEET.directions.length;

/** Один кадр: поворот на плоскости земли, наклон камеры, направленный свет сверху, блик. Без тени: её рисует игра. */
function renderFrame(spec: SheetSpec, angle: number, phase: number): HTMLCanvasElement {
  const F = SHEET.frame;
  const c = document.createElement('canvas');
  c.width = F;
  c.height = F;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(SHEET.anchor[0], SHEET.anchor[1]);
  ctx.scale(SHEET.scale, SHEET.scale * SHEET.perspective);
  ctx.rotate(angle);
  spec.draw(ctx, phase);
  ctx.restore();
  // Свет сверху экрана: верх светлее, низ темнее, только по нарисованным пикселям.
  ctx.globalCompositeOperation = 'source-atop';
  const light = ctx.createLinearGradient(0, F * 0.15, 0, F * 0.9);
  light.addColorStop(0, 'rgba(255,255,255,0.22)');
  light.addColorStop(0.45, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, F, F);
  const shine = ctx.createRadialGradient(F / 2 - 8, F / 2 - 12, 2, F / 2 - 8, F / 2 - 12, F * 0.22);
  shine.addColorStop(0, 'rgba(255,255,255,0.28)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, F, F);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export function bakeSheet(spec: SheetSpec): HTMLCanvasElement {
  const F = SHEET.frame;
  const sheet = document.createElement('canvas');
  sheet.width = F * SHEET.frames;
  sheet.height = F * DIRS;
  const ctx = sheet.getContext('2d')!;
  for (let d = 0; d < DIRS; d++) {
    const angle = (d * Math.PI) / 4;
    for (let f = 0; f < SHEET.frames; f++) {
      ctx.drawImage(renderFrame(spec, angle, (f / SHEET.frames) * Math.PI * 2), f * F, d * F);
    }
  }
  return sheet;
}

/** Мягкая тень под существом для превью (в игре её рисует drawShadow). */
function shadow(ctx: Ctx, cx: number, cy: number, angle: number, k: number): void {
  const along = 30 * SHEET.scale * k;
  const across = 20 * SHEET.scale * k;
  const rx = across + (along - across) * Math.abs(Math.cos(angle));
  const ry = (across + (along - across) * Math.abs(Math.sin(angle))) * SHEET.perspective * 0.75;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(20,10,4,0.34)');
  g.addColorStop(0.7, 'rgba(20,10,4,0.22)');
  g.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function checkerboard(ctx: Ctx, w: number, h: number, cell = 16): void {
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x + y) / cell) % 2 === 0 ? '#3a4a3a' : '#2e3b2e';
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

async function save(spec: SheetSpec, sheet: HTMLCanvasElement, status: HTMLElement): Promise<void> {
  const meta = {
    name: spec.name,
    title: spec.title,
    frame: SHEET.frame,
    frames: SHEET.frames,
    directions: [...SHEET.directions],
    anchor: [...SHEET.anchor],
    gameScale: SHEET.gameScale,
    perspective: SHEET.perspective,
  };
  try {
    // PNG — эталон для просмотра, WebP (качество 0.9) — то, что игра вшивает в сборку.
    const png = sheet.toDataURL('image/png');
    const webpTry = sheet.toDataURL('image/webp', 0.9);
    const webp = webpTry.startsWith('data:image/webp') ? webpTry : null;
    const kb = (d: string) => Math.round(((d.length - d.indexOf(',') - 1) * 0.75) / 1024);
    const res = await fetch('/__sprites/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: spec.name, png, webp, meta }),
    });
    status.textContent = res.ok
      ? `Сохранено: ${spec.name}.png (${kb(png)} КБ)${webp ? `, ${spec.name}.webp (${kb(webp)} КБ)` : ', WebP не поддержан'} и ${spec.name}.json (${sheet.width}×${sheet.height})`
      : `Не сохранилось: ${res.status} ${await res.text()}`;
  } catch (e) {
    status.textContent = `Не сохранилось: ${String(e)}`;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function showSheet(spec: SheetSpec, sheet: HTMLCanvasElement, root: HTMLElement): void {
  root.appendChild(el('h2', `Лист ${DIRS} направлений × ${SHEET.frames} кадров, кадр ${SHEET.frame} px, фон прозрачный`));
  const view = document.createElement('canvas');
  const k = 0.5;
  const labelW = 40;
  view.width = sheet.width * k + labelW;
  view.height = sheet.height * k;
  const ctx = view.getContext('2d')!;
  checkerboard(ctx, view.width, view.height);
  ctx.drawImage(sheet, labelW, 0, sheet.width * k, sheet.height * k);
  ctx.fillStyle = '#f6e6c8';
  ctx.font = 'bold 14px sans-serif';
  ctx.textBaseline = 'middle';
  SHEET.directions.forEach((d, i) => ctx.fillText(d, 8, (i + 0.5) * SHEET.frame * k));
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let f = 0; f <= SHEET.frames; f++) {
    ctx.beginPath();
    ctx.moveTo(labelW + f * SHEET.frame * k, 0);
    ctx.lineTo(labelW + f * SHEET.frame * k, view.height);
    ctx.stroke();
  }
  root.appendChild(view);
}

/** Живой превью: восемь направлений шагают на месте в игровом масштабе, один ходит по кругу. */
function showPreview(sheet: HTMLCanvasElement, root: HTMLElement): void {
  root.appendChild(el('h2', 'Как в игре: масштаб 1x (кадр 64 px) и 2x, 10 кадров в секунду'));
  const view = document.createElement('canvas');
  view.width = 760;
  view.height = 300;
  root.appendChild(view);
  const ctx = view.getContext('2d')!;
  const F = SHEET.frame;
  let t = 0;
  let last = performance.now();
  const dirAt = (angle: number): number => {
    const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.round(a / (Math.PI / 4)) % DIRS;
  };
  const blit = (x: number, y: number, dir: number, frame: number, scale = 1) => {
    const k = SHEET.gameScale * scale;
    shadow(ctx, x, y + 6 * k, (dir * Math.PI) / 4, scale);
    ctx.drawImage(sheet, frame * F, dir * F, F, F, x - SHEET.anchor[0] * k, y - SHEET.anchor[1] * k, F * k, F * k);
  };
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    ctx.fillStyle = '#6cae47';
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.fillStyle = '#5f9a3e';
    for (let y = 0; y < view.height; y += 40) for (let x = 0; x < view.width; x += 40) if (((x + y) / 40) % 2 === 0) ctx.fillRect(x, y, 40, 40);
    const frame = Math.floor(t * 10) % SHEET.frames;
    for (let d = 0; d < DIRS; d++) blit(48 + d * 72, 70, d, frame);
    const cx = 380;
    const cy = 200;
    const R = 70;
    const a = t * 0.9;
    const px = cx + Math.cos(a) * R * 1.8;
    const py = cy + Math.sin(a) * R;
    const dir = dirAt(Math.atan2(Math.cos(a) * R, -Math.sin(a) * R * 1.8));
    blit(px, py, dir, frame);
    blit(660, 200, dir, frame, 2);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Полоса кадров одного направления крупно, с номерами: показывает, чем кадры походки отличаются. */
function walkStrip(sheet: HTMLCanvasElement, dir = 0, k = 1.5): HTMLCanvasElement {
  const F = SHEET.frame;
  const pad = 10;
  const c = document.createElement('canvas');
  c.width = SHEET.frames * (F * k + pad) + pad;
  c.height = F * k + 44;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5f9a3e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6e6c8';
  for (let f = 0; f < SHEET.frames; f++) {
    const x = pad + f * (F * k + pad);
    ctx.fillStyle = '#6cae47';
    ctx.fillRect(x, 34, F * k, F * k);
    ctx.drawImage(sheet, f * F, dir * F, F, F, x, 34, F * k, F * k);
    ctx.fillStyle = '#f6e6c8';
    ctx.fillText(`кадр ${f + 1}`, x + (F * k) / 2, 22);
  }
  return c;
}

function main(): void {
  const root = document.getElementById('app')!;
  root.appendChild(el('h1', 'Пекарня спрайтов'));
  const params = new URLSearchParams(location.search);
  const only = params.get('only');
  const strip = params.get('strip') !== null;
  const specs = only ? SPECS.filter((s) => s.name === only) : SPECS;
  for (const spec of specs) {
    const block = el('section');
    block.appendChild(el('h1', spec.title));
    const status = el('p', 'Пеку лист…', 'status');
    block.appendChild(status);
    const sheet = bakeSheet(spec);
    showSheet(spec, sheet, block);
    if (strip) {
      block.appendChild(el('h2', 'Кадры походки крупно (направление E)'));
      const s = walkStrip(sheet);
      block.appendChild(s);
    }
    showPreview(sheet, block);
    const link = el('a', `Скачать ${spec.name}.png`);
    link.setAttribute('href', sheet.toDataURL('image/png'));
    link.setAttribute('download', `${spec.name}.png`);
    block.appendChild(link);
    root.appendChild(block);
    void save(spec, sheet, status);
  }
}

main();
