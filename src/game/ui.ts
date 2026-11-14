import { clamp, dist, roundRect, TAU, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, ENEMIES, LOGICAL_H, LOGICAL_W, SPELLS, TOWERS, TOWER_ORDER, type EnemyKind, type SpecDef, type TowerKind } from './config';
import { TUTORIAL, levelSize, type LevelDef } from './levels';
import { ACTS, LEVELS, LEVEL_ACT, THEMES } from './campaign';
import { ENDLESS } from './endless';
import { PERKS } from './perks';
import { BESTIARY, bestiaryEntry, foeStats, homeAct } from './bestiary';
import { BOONS, boonDef, type BoonGroup, type BoonId } from './boons';
import { freeStars, totalStars } from './progress';
import {
  actFinale, actTitle, boonText, difficultyText, enemyName, foeText, gameTitle, getLang, LANGS, levelText, perkText, spellText, t, targetText, towerText, type FoeText,
} from './i18n';
import { Path, snapWaypoints } from './path';
import type { Game } from './game';
import { canInstall, fullscreenSupported, isInstalledApp, manualInstall, promptInstall } from '../engine/device';
import type { Tower } from './tower';
import { PAL } from '../render/palette';
import { drawText, measure, wrapText } from '../render/text';
import {
  ANT_SOLDIER, circle, drawAcidGlob, drawAnt, drawFlagIcon, drawHero, drawHoney, drawLarva, drawShadow, drawSporeCloud, drawStar, drawTowerIcon, ell, outline,
  pennant, twig,
} from '../render/art';

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  round?: boolean;
  onTap: (p: Vec) => void;
}

const R_MENU = 92;
/**
 * Полуразмах врага в игре, px (с усами и лапами): по нему образец подгоняется под медальон.
 * Радиус из config.ts для этого не годится: он про столкновения, а не про рисунок.
 */
/** Цвета групп даров: основной, светлый и тёмный. По ним различаются карточки и значки в бою. */
const BOON_TINT: Record<BoonGroup, readonly [string, string, string]> = {
  towers: ['#3c8a2b', '#8fd66a', '#1f4a17'],
  soldiers: ['#2f6a9a', '#8fd3ff', '#143350'],
  spells: ['#6f3f91', '#c79be6', '#3a1f50'],
  colony: ['#a55a14', '#f2ad4e', '#4a2606'],
};

const FOE_EXTENT: Record<EnemyKind, number> = {
  termite: 27, spider: 32, beetle: 32, wasp: 30, soldierTermite: 33, blackAnt: 27, hornet: 37, slug: 34, rhino: 56,
  queen: 58, dragonfly: 29, leech: 27, bomber: 30, empress: 70, scarab: 34, scorpion: 33, woodlouse: 30,
  grasshopper: 27, centipede: 34, centipedeHalf: 20, armyAnt: 25, iceBug: 32, iceSnail: 40, silkworm: 26,
  cocoon: 18, silkMoth: 27, tick: 20, mantis: 31, firefly: 28,
};
const OPT_R = 42;

/** Название башни на текущем языке: базовое или имя специализации. */
function towerDisplayName(tw: Tower): string {
  const tx = towerText(tw.kind);
  return tw.spec === null ? tx.name : `${tx.name}: ${tx.specs[tw.spec].name}`;
}

/** Прицел для кнопки режима цели. */
function drawTargetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = PAL.uiLight;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  circle(ctx, x, y, r);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    ctx.moveTo(x + dx * (r - 4), y + dy * (r - 4));
    ctx.lineTo(x + dx * (r + 5), y + dy * (r + 5));
  }
  ctx.stroke();
  ctx.fillStyle = PAL.uiRed;
  circle(ctx, x, y, 3);
  ctx.fill();
}

function towerStats(tw: Tower): string {
  const s = tw.stats;
  const dmg = s.damage ?? [0, 0];
  switch (tw.kind) {
    case 'acid': return t('stats.acid', dmg[0], dmg[1], s.range, s.interval ?? 1);
    case 'barracks': return t('stats.barracks', tw.soldiers.length, s.soldierHp ?? 0, (s.soldierDmg ?? [0, 0])[0], (s.soldierDmg ?? [0, 0])[1], s.respawn ?? 0);
    case 'catapult': return t('stats.catapult', dmg[0], dmg[1], s.splash ?? 0, s.range);
    case 'spore': return t('stats.spore', Math.round((s.slow ?? 0) * 100), s.poisonDps ?? 0, s.range);
  }
}

/** Светлая плашка под значки браузера в подсказке установки. */
function iconPlate(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  roundRect(ctx, x - 24, y - 24, 48, 48, 12);
  ctx.fillStyle = '#f6f2ea';
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** Значок «Поделиться» как в Safari: квадрат без верха и стрелка вверх. */
function drawShareIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  iconPlate(ctx, x, y);
  ctx.save();
  ctx.strokeStyle = '#2f7cf6';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 4);
  ctx.lineTo(x - 11, y - 4);
  ctx.lineTo(x - 11, y + 15);
  ctx.lineTo(x + 11, y + 15);
  ctx.lineTo(x + 11, y - 4);
  ctx.lineTo(x + 5, y - 4);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y - 16);
  ctx.moveTo(x - 6, y - 10);
  ctx.lineTo(x, y - 16);
  ctx.lineTo(x + 6, y - 10);
  ctx.stroke();
  ctx.restore();
}

/** Значок «На экран „Домой“»: квадрат с плюсом. */
function drawAddIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  iconPlate(ctx, x, y);
  ctx.save();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  roundRect(ctx, x - 12, y - 12, 24, 24, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + 6);
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 6, y);
  ctx.stroke();
  ctx.restore();
}

/** Плитка приложения: муравейник с флажком на закатном небе. */
function drawAppTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  roundRect(ctx, x - 24, y - 24, 48, 48, 12);
  const sky = ctx.createLinearGradient(x, y - 24, x, y + 24);
  sky.addColorStop(0, '#f7d98a');
  sky.addColorStop(1, '#e98a4a');
  ctx.fillStyle = sky;
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 18, 18, 22, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#8a5a2b';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 12, 5, 4, 0, 0, TAU);
  ctx.fillStyle = '#2a1608';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 12, y - 14);
  ctx.lineTo(x, y - 10);
  ctx.closePath();
  ctx.fillStyle = PAL.flag;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** HUD, радиальное меню, панели и экраны. Кнопки регистрируются при отрисовке и проверяются при тапе. */
export class UI {
  private buttons: Btn[] = [];
  private overlayButtons: Btn[] = [];
  /** Опция постройки под курсором мыши (для превью радиуса на ПК). */
  hoverKind: TowerKind | null = null;
  /** Специализация под курсором или выбранная первым тапом (башня и индекс): её описание идёт в панель. */
  hoverSpec: [Tower, number] | null = null;
  private hoverSpecPending = false;
  /** Заклинание под курсором или выбранное: его описание идёт в панель. */
  hoverSpell: number | null = null;
  /** Дар, на значке которого стоит курсор. */
  private hoverBoon: BoonId | null = null;
  /** Курсор над кнопкой режима цели: её описание идёт в панель. */
  private hoverTarget = false;
  private miniPaths = new Map<string, Path[]>();
  /** Силуэты ещё не встреченных врагов для меню «Враги». */
  private readonly silhouettes = new Map<string, HTMLCanvasElement>();
  /** Кнопка всплывающей карточки врага: в список попадает последней, меню постройки поверх неё главнее. */
  private toastBtn: Btn | null = null;
  /** Сдвиг текущей группы интерфейса: угловые блоки прижимаются к краям экрана. */
  private gx = 0;
  private gy = 0;
  /** Где в этом кадре нарисованы кнопки, на которые показывает обучение (координаты экрана). */
  private readonly anchors = new Map<string, { x: number; y: number; r?: number; w?: number; h?: number }>();

  constructor(private readonly g: Game) {}

  /** Кнопка по имени: wave, speed, spell0..2, hud:gold, build:<башня>, upgrade. */
  anchor(name: string): { x: number; y: number; r?: number; w?: number; h?: number } | null {
    return this.anchors.get(name) ?? null;
  }

  private mark(name: string, a: { x: number; y: number; r?: number; w?: number; h?: number }): void {
    this.anchors.set(name, { ...a, x: a.x + this.gx, y: a.y + this.gy });
  }

  /** Сдвиг угловых блоков HUD к настоящим краям экрана с учётом выреза камеры, в логических пикселях. */
  hud(): { l: number; r: number; t: number; b: number } {
    const v = this.g.screen.view;
    const s = this.g.screen.safe;
    return { l: v.x0 + s.l, r: v.x1 - s.r - LOGICAL_W, t: v.y0 + s.t, b: v.y1 - s.b - LOGICAL_H };
  }

  private group(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    ctx.save();
    ctx.translate(dx, dy);
    this.gx = dx;
    this.gy = dy;
  }

  private ungroup(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
    this.gx = 0;
    this.gy = 0;
  }

  /** Курсор мыши в координатах текущей группы. */
  private get hov(): Vec | null {
    const h = this.g.input.hover;
    return h ? { x: h.x - this.gx, y: h.y - this.gy } : null;
  }

  /** Кнопка запоминается со сдвигом группы: тап попадает туда, где она нарисована. */
  private reg(list: Btn[], b: Btn): void {
    list.push({ ...b, x: b.x + this.gx, y: b.y + this.gy });
  }

  /** Вся видимая область вместе с полями. */
  private viewRect(): { x: number; y: number; w: number; h: number } {
    const v = this.g.screen.view;
    return { x: v.x0, y: v.y0, w: v.x1 - v.x0, h: v.y1 - v.y0 };
  }

  private static hit(b: Btn, p: Vec): boolean {
    if (b.round) return dist(p.x, p.y, b.x, b.y) <= b.w / 2;
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  tap(p: Vec): boolean {
    for (const b of this.buttons) {
      if (UI.hit(b, p)) { b.onTap(p); return true; }
    }
    return false;
  }

  tapOverlay(p: Vec): boolean {
    for (const b of this.overlayButtons) {
      if (UI.hit(b, p)) { b.onTap(p); return true; }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.buttons = [];
    this.overlayButtons = [];
    this.hoverKind = null;
    this.hoverSpec = null;
    this.hoverSpecPending = false;
    this.hoverSpell = null;
    this.hoverBoon = null;
    this.anchors.clear();
    const g = this.g;
    switch (g.state) {
      case 'playing':
        if (g.mode === 'endless') this.drawEntranceArrows(ctx);
        this.drawFoeToast(ctx);
        this.drawSelection(ctx);
        this.drawHud(ctx);
        this.drawWaveButton(ctx);
        this.drawHotbar(ctx);
        this.drawInfo(ctx);
        if (g.camHint > 0) this.drawCamHint(ctx);
        if (!g.paused) g.tutorial?.draw(ctx, g);
        if (this.toastBtn) this.buttons.push(this.toastBtn);
        if (g.paused) this.drawPause(ctx);
        else if (g.foeCard) this.drawFoeCard(ctx);
        else if (g.boonOffer) this.drawBoons(ctx);
        break;
      case 'title': this.drawTitle(ctx); break;
      case 'levels': this.drawLevels(ctx); break;
      case 'perks': this.drawPerks(ctx); break;
      case 'intro': this.drawIntro(ctx); break;
      case 'settings': this.drawSettings(ctx); break;
      case 'bestiary': this.drawBestiary(ctx); break;
      default: this.drawEnd(ctx); break;
    }
    if (g.installHelp && (g.state === 'title' || g.state === 'settings')) this.drawInstallHelp(ctx);
  }

  // ───────────── helpers ─────────────

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 16, fill: string = PAL.ui): void {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = PAL.uiBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private roundBtn(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, icon: () => void, onTap: () => void, hot = false): void {
    circle(ctx, x, y, r);
    ctx.fillStyle = PAL.ui;
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255,255,255,0.9)' : PAL.uiBorder;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    icon();
    this.reg(this.buttons, { x, y, w: r * 2, h: r * 2, round: true, onTap });
  }

  private bigButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, label: string, onTap: () => void, fill = '#3c8a2b', size = 26): void {
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 18);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawText(ctx, label, cx, cy, { size, align: 'center' });
    this.reg(this.overlayButtons, { x: cx - w / 2, y: cy - h / 2, w, h, onTap });
  }

  private dim(ctx: CanvasRenderingContext2D, a = 0.6): void {
    ctx.fillStyle = `rgba(12,7,2,${a})`;
    const r = this.viewRect();
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
    roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    const fw = w * clamp(frac, 0, 1);
    if (fw > 0.5) {
      roundRect(ctx, x, y, fw, h, 3);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  // ───────────── HUD ─────────────

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const o = this.hud();
    this.group(ctx, o.l, o.t);
    this.panel(ctx, 14, 12, 440, 58);
    drawHoney(ctx, 46, 42, 13);
    drawText(ctx, String(g.gold), 68, 42, { size: 26, color: PAL.uiGold });
    // Плотнее, чтобы «Волна 12/16» не упиралась в край панели.
    drawLarva(ctx, 168, 42, 11);
    drawText(ctx, String(g.lives), 192, 42, { size: 26 });
    drawFlagIcon(ctx, 258, 42, 28, PAL.flag);
    if (g.waves.endless) {
      // Бесконечная осада: номер волны без «из скольких» и рекорд на этой сложности.
      drawText(ctx, t('hud.waveEndless', g.waves.index), 280, 42, { size: 20 });
      const best = g.endlessBest;
      if (best) drawText(ctx, t('hud.best', best.wave), 444, 42, { size: 14, align: 'right', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    } else {
      drawText(ctx, t('hud.wave', g.waves.index, g.waves.total), 280, 42, { size: 20 });
    }
    this.mark('hud:gold', { x: 88, y: 42, w: 136, h: 46 });
    this.reg(this.buttons, { x: 14, y: 12, w: 440, h: 58, onTap: () => {} });
    this.drawBoonChips(ctx);
    this.ungroup(ctx);

    this.group(ctx, o.r, o.t);
    this.roundBtn(ctx, 1166, 42, 30, () => {
      drawText(ctx, `x${g.speed}`, 1166, 42, { size: 22, color: g.speed === 2 ? PAL.uiGreen : PAL.uiLight, align: 'center' });
    }, () => g.toggleSpeed());
    this.mark('speed', { x: 1166, y: 42, r: 30 });

    this.roundBtn(ctx, 1236, 42, 30, () => {
      ctx.fillStyle = PAL.uiLight;
      if (g.paused) {
        ctx.beginPath(); ctx.moveTo(1229, 31); ctx.lineTo(1247, 42); ctx.lineTo(1229, 53); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(1227, 31, 6, 22);
        ctx.fillRect(1239, 31, 6, 22);
      }
    }, () => g.togglePause());
    this.ungroup(ctx);
  }

  /**
   * Взятые дары под верхней панелью: кружок цвета группы со значком и счётчиком.
   * Тап или курсор показывают в верхней подсказке, что дар даёт.
   */
  private drawBoonChips(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const taken = BOONS.filter((b) => (g.world.boons[b.id] ?? 0) > 0);
    if (!taken.length) return;
    const hover = this.hov;
    const r = 21;
    taken.forEach((def, i) => {
      const cx = 39 + i * 52;
      const cy = 103;
      const n = g.world.boons[def.id] ?? 0;
      const [main, light, dark] = BOON_TINT[def.group];
      const hot = !!hover && dist(hover.x, hover.y, cx, cy) <= r + 4;
      if (hot) this.hoverBoon = def.id;
      const on = hot || g.boonPeek === def.id;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      circle(ctx, cx + 1, cy + 3, r + 3.5);
      ctx.fill();
      const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rim.addColorStop(0, on ? '#fff6c8' : '#fbe6a0');
      rim.addColorStop(0.45, on ? '#ffd95a' : '#cf9a3e');
      rim.addColorStop(1, on ? '#e8b24a' : '#6b4315');
      circle(ctx, cx, cy, r + 3.5);
      ctx.fillStyle = rim;
      ctx.fill();
      outline(ctx, 2.5);
      ctx.stroke();
      const disc = ctx.createRadialGradient(cx - 6, cy - 7, 2, cx, cy, r);
      disc.addColorStop(0, light);
      disc.addColorStop(0.55, main);
      disc.addColorStop(1, dark);
      circle(ctx, cx, cy, r);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,22,8,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (on) {
        // Выбранный значок: светлое кольцо снаружи.
        circle(ctx, cx, cy, r + 6.5);
        ctx.strokeStyle = 'rgba(255,246,200,0.95)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.save();
      circle(ctx, cx, cy, r - 0.5);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(0.36, 0.36);
      this.boonIcon(ctx, def.id, 0, 0);
      ctx.restore();
      if (n > 1) {
        // Счётчик повторов на кромке кружка.
        const label = `×${n}`;
        const bw = measure(ctx, label, 14, 'bold') + 10;
        roundRect(ctx, cx + r + 5 - bw, cy + r - 10, bw, 19, 9);
        ctx.fillStyle = PAL.ui;
        ctx.fill();
        ctx.strokeStyle = PAL.uiGold;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        drawText(ctx, label, cx + r + 5 - bw / 2, cy + r, { size: 14, align: 'center', color: PAL.uiGold, stroke: null });
      }
      this.reg(this.buttons, { x: cx, y: cy, w: 52, h: 52, round: true, onTap: () => g.peekBoon(def.id) });
    });
  }

  /** Хотбар заклинаний: три кнопки с перезарядкой; тап выбирает, следующий тап по полю применяет. */
  private drawHotbar(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const o = this.hud();
    this.group(ctx, o.l, o.b);
    const book = g.world.spells;
    const x = 14;
    const y = 622;
    const w = 300;
    const hh = 84;
    this.panel(ctx, x, y, w, hh, 18);
    const hover = this.hov;
    let hovered: number | null = null;
    for (let i = 0; i < SPELLS.length; i++) {
      const d = SPELLS[i];
      const bx = 64 + i * 92;
      const by = 664;
      const br = 32;
      const ready = book.ready(i);
      const armed = g.armedSpell === i;
      if (hover && dist(hover.x, hover.y, bx, by) <= br) hovered = i;
      circle(ctx, bx, by, br);
      ctx.fillStyle = armed ? '#3c8a2b' : PAL.ui;
      ctx.fill();
      ctx.save();
      circle(ctx, bx, by, br - 2);
      ctx.clip();
      ctx.globalAlpha = ready ? 1 : 0.55;
      switch (d.id) {
        case 'acid':
          ctx.translate(bx, by);
          ctx.scale(2.4, 2.4);
          drawAcidGlob(ctx, 0, -1, -Math.PI / 2);
          break;
        case 'retinue':
          ctx.translate(bx, by + 6);
          ctx.scale(0.8, 0.8);
          drawHero(ctx, 0, 0, -Math.PI / 2, 0);
          break;
        case 'spores':
          drawSporeCloud(ctx, bx, by, 15, 0.8, g.clock, 1);
          break;
      }
      ctx.restore();
      if (!ready) {
        const frac = book.cooldowns[i] / book.cooldownOf(i);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, br, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.closePath();
        ctx.fill();
        drawText(ctx, String(Math.ceil(book.cooldowns[i])), bx, by, { size: 22, align: 'center' });
      }
      const pulse = 0.5 + 0.5 * Math.sin(g.clock * 5);
      circle(ctx, bx, by, br);
      ctx.strokeStyle = armed ? `rgba(255,217,90,${0.6 + 0.4 * pulse})` : ready ? 'rgba(255,255,255,0.55)' : PAL.uiBorder;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawText(ctx, d.key, bx + 20, by + 22, { size: 12 });
      this.mark(`spell${i}`, { x: bx, y: by, r: br });
      this.reg(this.buttons, { x: bx, y: by, w: br * 2, h: br * 2, round: true, onTap: () => g.armSpell(i) });
    }
    this.hoverSpell = g.armedSpell ?? hovered;
    if (g.armedSpell !== null) {
      drawText(ctx, t('hotbar.pick'), x + w / 2, y - 14, { size: 15, align: 'center', color: PAL.uiGold });
    }
    this.reg(this.buttons, { x, y, w, h: hh, onTap: () => {} });
    this.ungroup(ctx);
  }

  private drawWaveButton(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const o = this.hud();
    this.group(ctx, o.r, o.b);
    const w = g.waves;
    // Общий режим цели башен: кнопка с прицелом слева от кнопки волны, тап листает по кругу.
    const td = g.targetDef;
    const hover = this.hov;
    this.hoverTarget = !!hover && dist(hover.x, hover.y, 975, 668) <= 32;
    this.roundBtn(ctx, 975, 668, 32, () => {
      drawTargetIcon(ctx, 975, 660, 10);
      drawText(ctx, targetText(td.id).short, 975, 684, { size: 11, align: 'center', color: PAL.uiGold, stroke: null });
    }, () => g.cycleTargetMode(), this.hoverTarget);
    const x = 1030;
    const y = 632;
    const bw = 234;
    const bh = 72;
    this.mark('wave', { x: x + bw / 2, y: y + bh / 2, w: bw, h: bh });
    if (w.canCall) {
      this.panel(ctx, x, y, bw, bh, 18, '#3c8a2b');
      const label = w.index === 0 ? t('wave.fight') : t('wave.next');
      drawText(ctx, label, x + bw / 2, y + 23, { size: 22, align: 'center' });
      const secs = Math.ceil(w.countdown ?? 0);
      drawText(ctx, t('wave.in', secs), x + 68, y + 51, { size: 17, align: 'center', weight: 'normal', stroke: null, color: 'rgba(255,255,255,0.85)' });
      if (w.bonus > 0) {
        drawHoney(ctx, x + 146, y + 51, 8);
        drawText(ctx, `+${w.bonus}`, x + 160, y + 51, { size: 18, color: PAL.uiGold });
      }
      this.reg(this.buttons, { x, y, w: bw, h: bh, onTap: () => g.callWave() });
    } else if (w.hold && !w.spawning && w.index < w.total) {
      // Обучение держит волну, пока игрок не выполнит задание.
      this.panel(ctx, x, y, bw, bh, 18);
      drawText(ctx, t('wave.wait'), x + bw / 2, y + 36, { size: 20, align: 'center', color: 'rgba(246,230,200,0.8)' });
    } else if (w.index < w.total) {
      this.panel(ctx, x, y, bw, bh, 18);
      drawText(ctx, t('wave.running', w.index), x + bw / 2, y + 36, { size: 20, align: 'center', color: 'rgba(246,230,200,0.8)' });
    } else {
      this.panel(ctx, x, y, bw, bh, 18);
      drawText(ctx, t('wave.last'), x + bw / 2, y + 36, { size: 20, align: 'center', color: PAL.uiGold });
    }
    this.ungroup(ctx);
  }

  private drawInfo(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const sel = g.selected;
    let title = '';
    let desc = '';
    const peek = this.hoverBoon ?? g.boonPeek;
    if (peek) {
      // Значок взятого дара: что он даёт и сколько раз взят.
      const n = g.world.boons[peek] ?? 0;
      const bx = boonText(peek, g.world);
      title = `${bx.name}${n > 1 ? ` ×${n}` : ''} · ${t('boon.title')}`;
      desc = boonDef(peek).value ? t('boon.spent') : bx.desc;
    } else if (this.hoverKind) {
      const d = TOWERS[this.hoverKind];
      const tx = towerText(this.hoverKind);
      title = `${tx.name} · ${d.levels[0].cost}`;
      desc = tx.desc;
    } else if (this.hoverSpec) {
      const [tw, i] = this.hoverSpec;
      const sx = towerText(tw.kind).specs[i];
      title = `${sx.name} · ${tw.def.specs[i].cost}`;
      desc = sx.desc + (this.hoverSpecPending ? t('info.again') : '');
    } else if (sel?.type === 'tower') {
      title = `${towerDisplayName(sel.tower)} · ${t('info.level')} ${sel.tower.level}${sel.tower.building ? ` · ${t('info.building')}` : ''}`;
      desc = towerStats(sel.tower);
    } else if (this.hoverTarget) {
      const d = targetText(g.world.targetMode);
      title = t('info.target', d.name.toLowerCase());
      desc = d.desc + t('info.targetHint');
    } else if (this.hoverSpell !== null) {
      const d = SPELLS[this.hoverSpell];
      const sx = spellText(d.id);
      const cd = g.world.spells.cooldowns[this.hoverSpell];
      const state = cd > 0 ? ` · ${t('info.cooldown', Math.ceil(cd))}` : g.armedSpell === this.hoverSpell ? ` · ${t('info.pickSpot')}` : ` · ${d.key}`;
      title = `${sx.name}${state}`;
      desc = sx.desc;
    } else if (sel?.type === 'plot') {
      title = t('info.freeCell');
      desc = t('info.freeCellDesc');
    } else {
      return;
    }
    // Текст ужимается по ширине панели, а не вылезает за неё.
    const pw = 650;
    const avail = pw - 32;
    const o = this.hud();
    this.group(ctx, 0, o.t);
    this.panel(ctx, 470, 12, pw, 58);
    const fit = (text: string, size: number, min: number, weight: 'bold' | 'normal'): { text: string; size: number } => {
      let s = size;
      while (s > min && measure(ctx, text, s, weight) > avail) s -= 1;
      let t = text;
      while (t.length > 8 && measure(ctx, `${t}…`, s, weight) > avail && measure(ctx, t, s, weight) > avail) t = t.slice(0, -2).trimEnd();
      return { text: t === text ? text : `${t}…`, size: s };
    };
    const ft = fit(title, 19, 15, 'bold');
    const fd = fit(desc, 14, 12, 'normal');
    drawText(ctx, ft.text, 486, 31, { size: ft.size, color: PAL.uiGold });
    drawText(ctx, fd.text, 486, 54, { size: fd.size, weight: 'normal', stroke: null, color: PAL.uiLight });
    this.ungroup(ctx);
  }

  // ───────────── радиальное меню ─────────────

  /**
   * Круглая опция меню. Ценник внутри круга (бейдж снизу), подпись снаружи,
   * с той стороны, куда опция «смотрит» от центра меню.
   */
  private option(
    ctx: CanvasRenderingContext2D, ox: number, oy: number, dirX: number, dirY: number, enabled: boolean,
    icon: () => void, badge: string, badgeColor: string, caption: string, onTap: () => void, forceHot = false,
  ): boolean {
    const hover = this.g.input.hover;
    const hot = !!hover && dist(hover.x, hover.y, ox, oy) <= OPT_R;
    ctx.globalAlpha = enabled ? 1 : 0.55;
    circle(ctx, ox, oy, OPT_R);
    ctx.fillStyle = PAL.ui;
    ctx.fill();
    ctx.strokeStyle = forceHot ? PAL.uiGold : hot ? 'rgba(255,255,255,0.95)' : PAL.uiBorder;
    ctx.lineWidth = 3;
    ctx.stroke();
    icon();
    roundRect(ctx, ox - 24, oy + 16, 48, 20, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    drawText(ctx, badge, ox, oy + 26, { size: 15, color: badgeColor, align: 'center', stroke: null });
    ctx.globalAlpha = 1;

    const capOpts = { size: 15, color: 'rgba(246,230,200,0.95)', strokeWidth: 3 } as const;
    const tw = measure(ctx, caption, 15);
    if (dirY < 0) drawText(ctx, caption, ox, oy - OPT_R - 14, { ...capOpts, align: 'center' });
    else if (dirY > 0) drawText(ctx, caption, ox, oy + OPT_R + 15, { ...capOpts, align: 'center' });
    else if (dirX > 0 && ox + OPT_R + 12 + tw < this.g.screen.view.x1 - 6) drawText(ctx, caption, ox + OPT_R + 10, oy, { ...capOpts, align: 'left' });
    else if (dirX < 0 && ox - OPT_R - 12 - tw > this.g.screen.view.x0 + 6) drawText(ctx, caption, ox - OPT_R - 10, oy, { ...capOpts, align: 'right' });
    else drawText(ctx, caption, ox, oy + OPT_R + 15, { ...capOpts, align: 'center' });

    this.reg(this.buttons, { x: ox, y: oy, w: OPT_R * 2, h: OPT_R * 2, round: true, onTap });
    return hot;
  }

  private drawSelection(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const sel = g.selected;
    if (!sel) return;
    // Меню рисуется в координатах экрана там, где камера показывает клетку или башню.
    const at = g.camera.toScreen(sel.type === 'plot' ? sel.plot.x : sel.tower.x, sel.type === 'plot' ? sel.plot.y : sel.tower.y);
    const cx = at.x;
    const cy = at.y;
    const z = g.camera.zoom;
    const v = g.screen.view;
    const mcx = clamp(cx, v.x0 + 50 + R_MENU, v.x1 - 50 - R_MENU);
    const mcy = clamp(cy, this.hud().t + 110 + R_MENU, v.y1 - 70 - R_MENU);

    if (sel.type === 'tower') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ell(ctx, cx, cy, 42 * z, 30 * z);
      ctx.stroke();
    }

    if (sel.type === 'plot') {
      const dirs: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      TOWER_ORDER.forEach((kind, i) => {
        const [dx, dy] = dirs[i];
        const ox = mcx + dx * R_MENU;
        const oy = mcy + dy * R_MENU;
        const def = TOWERS[kind];
        const cost = def.levels[0].cost;
        const can = g.gold >= cost;
        const hot = this.option(
          ctx, ox, oy, dx, dy, can,
          () => drawTowerIcon(ctx, kind, ox, oy - 12, 0.5),
          String(cost), can ? PAL.uiGold : PAL.uiRed, towerText(kind).short,
          () => g.build(kind, sel.plot),
        );
        this.mark(`build:${kind}`, { x: ox, y: oy, r: OPT_R });
        if (hot) this.hoverKind = kind;
      });
      return;
    }

    const tw = sel.tower;
    if (tw.canSpecialize) {
      // Развилка 4-го уровня: две специализации слева и справа сверху.
      const D = Math.round(R_MENU * 0.8);
      tw.def.specs.forEach((sp, i) => {
        const ox = mcx + (i === 0 ? -D : D);
        const oy = mcy - D;
        const can = g.gold >= sp.cost;
        const pending = g.pendingSpec === i;
        const hot = this.option(
          ctx, ox, oy, i === 0 ? -1 : 1, -1, can,
          () => drawTowerIcon(ctx, tw.kind, ox, oy - 10, 0.44, 4, i + 1),
          String(sp.cost), can ? PAL.uiGold : PAL.uiRed, towerText(tw.kind).specs[i].short,
          () => g.chooseSpec(tw, i), pending,
        );
        if (hot || (pending && !this.hoverSpec)) {
          this.hoverSpec = [tw, i];
          this.hoverSpecPending = pending && !hot;
        }
      });
    } else {
      const up = tw.upgradeCost;
      const canUp = up !== null && g.gold >= up;
      const ux = mcx;
      const uy = mcy - R_MENU;
      this.mark('upgrade', { x: ux, y: uy, r: OPT_R });
      this.option(ctx, ux, uy, 0, -1, up !== null, () => {
        if (up === null) {
          if (tw.building) drawText(ctx, t('menu.building'), ux, uy - 8, { size: 13, align: 'center', color: PAL.uiGold });
          else drawText(ctx, 'MAX', ux, uy - 8, { size: 20, align: 'center', color: PAL.uiGold });
          return;
        }
        ctx.fillStyle = canUp ? PAL.uiGreen : PAL.uiLight;
        const y = uy - 6;
        ctx.beginPath();
        ctx.moveTo(ux, y - 16); ctx.lineTo(ux + 15, y); ctx.lineTo(ux + 7, y); ctx.lineTo(ux + 7, y + 14);
        ctx.lineTo(ux - 7, y + 14); ctx.lineTo(ux - 7, y); ctx.lineTo(ux - 15, y); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = PAL.outline;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }, up === null ? '—' : String(up), up === null ? PAL.uiLight : canUp ? PAL.uiGold : PAL.uiRed,
      up === null ? t('menu.max') : t('menu.upgrade', tw.level + 1), () => g.upgradeTower(tw));
    }

    const sx = mcx;
    const sy = mcy + R_MENU;
    this.option(ctx, sx, sy, 0, 1, true, () => drawHoney(ctx, sx, sy - 8, 12),
      `+${tw.sellValue}`, PAL.uiGold, t('menu.sell'), () => g.sellTower(tw));
  }

  // ───────────── экраны ─────────────

  /** Подсказка для iPhone и iPad: Safari ставит игру на главный экран только вручную. */
  private drawInstallHelp(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.buttons = [];
    this.overlayButtons = [];
    this.dim(ctx, 0.75);
    this.panel(ctx, 270, 110, 740, 500, 22);
    drawText(ctx, t('install.title'), 640, 160, { size: 34, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    const steps: ReadonlyArray<readonly [string, (x: number, y: number) => void]> = [
      [t('install.step1'), (x, y) => drawShareIcon(ctx, x, y)],
      [t('install.step2'), (x, y) => drawAddIcon(ctx, x, y)],
      [t('install.step3'), (x, y) => drawAppTile(ctx, x, y)],
    ];
    steps.forEach(([text, icon], i) => {
      const y = 245 + i * 85;
      circle(ctx, 325, y, 18);
      ctx.fillStyle = PAL.uiGold;
      ctx.fill();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      drawText(ctx, String(i + 1), 325, y + 1, { size: 20, align: 'center', color: PAL.outline, stroke: null });
      icon(392, y);
      const lines = text.split('\n').flatMap((part) => wrapText(ctx, part, 540, 20, 'bold'));
      lines.forEach((ln, k) => drawText(ctx, ln, 440, y + (k - (lines.length - 1) / 2) * 25, { size: 20 }));
    });
    const note = wrapText(ctx, t('install.note'), 640, 16);
    note.forEach((ln, k) => drawText(ctx, ln, 640, 498 + k * 20, { size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.8)' }));
    this.bigButton(ctx, 640, 562, 220, 56, t('install.ok'), () => g.closeInstallHelp(), '#3c8a2b', 22);
    // Тап мимо кнопки тоже закрывает подсказку.
    this.reg(this.overlayButtons, { ...this.viewRect(), onTap: () => g.closeInstallHelp() });
  }

  private drawSettings(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const off = 'rgba(90,60,30,0.9)';
    this.dim(ctx, 0.72);
    this.panel(ctx, 290, 76, 700, 568, 22);
    drawText(ctx, t('settings.title'), 640, 126, { size: 40, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
    drawText(ctx, t('settings.language'), 340, 210, { size: 24 });
    LANGS.forEach((l, i) => {
      const on = getLang() === l.id;
      this.bigButton(ctx, 660 + i * 180, 210, 160, 52, l.name, () => g.setLang(l.id), on ? '#3c8a2b' : off, 20);
    });
    this.slider(ctx, 340, 300, t('settings.music'), g.progress.settings.music, (v) => g.setMusic(v));
    this.slider(ctx, 340, 385, t('settings.sfx'), g.progress.settings.sfx, (v) => g.setSfx(v));
    drawText(ctx, t('settings.fullscreen'), 340, 470, { size: 24 });
    if (isInstalledApp()) {
      drawText(ctx, t('settings.fsApp'), 580, 470, { size: 18, color: PAL.uiGold });
    } else if (fullscreenSupported()) {
      const want = g.fullscreenWanted;
      this.bigButton(ctx, 660, 470, 160, 52, t('settings.on'), () => g.setFullscreen(true), want ? '#3c8a2b' : off, 20);
      this.bigButton(ctx, 840, 470, 160, 52, t('settings.offBtn'), () => g.setFullscreen(false), want ? off : '#3c8a2b', 20);
    } else if (manualInstall()) {
      // iPhone не умеет полный экран в браузере: только со значка на главном экране.
      this.bigButton(ctx, 750, 470, 340, 52, t('settings.howInstall'), () => g.showInstallHelp(), '#3c8a2b', 18);
    } else {
      drawText(ctx, t('settings.fsHint'), 580, 470, { size: 18, color: PAL.uiGold });
    }
    this.bigButton(ctx, 640, 580, 240, 60, t('settings.back'), () => g.closeSettings(), off, 22);
  }

  /** Ползунок громкости: тап по полосе ставит значение, кнопки по краям двигают на шаг. */
  private slider(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: number, set: (v: number) => void): void {
    drawText(ctx, label, x, y, { size: 24 });
    const bx = 540;
    const bw = 280;
    this.bar(ctx, bx, y - 9, bw, 18, value, PAL.uiGold);
    circle(ctx, bx + bw * value, y, 13);
    ctx.fillStyle = PAL.uiLight;
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    this.reg(this.overlayButtons, { x: bx - 14, y: y - 26, w: bw + 28, h: 52, onTap: (p) => set(clamp((p.x - bx) / bw, 0, 1)) });
    this.bigButton(ctx, bx - 52, y, 46, 46, '−', () => set(value - 0.1), 'rgba(90,60,30,0.9)', 26);
    this.bigButton(ctx, bx + bw + 52, y, 46, 46, '+', () => set(value + 0.1), 'rgba(90,60,30,0.9)', 26);
    drawText(ctx, value <= 0 ? t('settings.off') : `${Math.round(value * 100)}%`, bx + bw + 88, y, { size: 20, color: PAL.uiGold });
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    // Фон-диорама уже нарисован игрой; здесь заголовок на табличке и кнопка внизу.
    drawText(ctx, gameTitle(), 640, 100, { size: 60, align: 'center', color: PAL.uiGold, strokeWidth: 10 });
    drawText(ctx, t('title.subtitle'), 640, 158, { size: 20, align: 'center', weight: 'normal', color: '#f6e6c8', strokeWidth: 5 });
    this.bigButton(ctx, 640, 630, 300, 74, t('title.play'), () => g.playFromTitle(), '#3c8a2b', 30);
    const o = this.hud();
    this.group(ctx, o.r, o.b);
    this.bigButton(ctx, 1150, 660, 200, 48, t('title.settings'), () => g.toSettings(), 'rgba(90,60,30,0.9)', 18);
    this.ungroup(ctx);
    // Chrome сам предлагает установку; на iPhone и iPad показываем, как поставить значок вручную.
    const install = canInstall() ? () => promptInstall() : manualInstall() ? () => g.showInstallHelp() : null;
    if (install) {
      this.group(ctx, o.l, o.b);
      this.bigButton(ctx, 130, 660, 200, 48, t('title.install'), install, '#3c8a2b', 18);
      this.ungroup(ctx);
    }
    this.group(ctx, 0, o.b);
    drawText(ctx, t('title.controls'), 640, 698, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    this.ungroup(ctx);
  }

  private pathsFor(lv: LevelDef): Path[] {
    let ps = this.miniPaths.get(lv.id);
    if (!ps) {
      ps = lv.paths.map((w) => new Path(snapWaypoints(w, CELL)));
      this.miniPaths.set(lv.id, ps);
    }
    return ps;
  }

  /** Миниатюра карты уровня: тропы, вход в муравейник, флаг. */
  private miniMap(ctx: CanvasRenderingContext2D, lv: LevelDef, x: number, y: number, w: number, h: number): void {
    const size = levelSize(lv);
    const s = Math.min(w / size.w, h / size.h);
    const ox = x + (w - size.w * s) / 2;
    const oy = y + (h - size.h * s) / 2;
    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.clip();
    ctx.fillStyle = lv.theme.grass;
    ctx.fillRect(x, y, w, h);
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    if (lv.theme.oak) {
      ctx.fillStyle = '#5a3a1f';
      ctx.fillRect(-20, -30, LOGICAL_W + 40, 100);
    }
    if (lv.theme.water) {
      const kind = lv.theme.bandKind ?? 'water';
      ctx.fillStyle = kind === 'ice' ? '#bfe0f5' : kind === 'ravine' ? '#1e140c' : '#4f8fc0';
      ctx.fillRect(-20, lv.theme.water.y, LOGICAL_W + 40, lv.theme.water.h);
    }
    // Препятствия ландшафта: пятна цвета скал, прудов, стволов.
    const blobColor: Record<string, string> = { desert: '#d38a4a', mountains: '#8f8f8a', jungle: '#2f8a35', snow: '#ffffff', forest: '#6b4424', asia: '#7fae4a' };
    for (const b of lv.theme.blobs ?? []) {
      ctx.fillStyle = blobColor[lv.theme.biome ?? ''] ?? '#8f8f8a';
      ell(ctx, b.x, b.y, b.r, b.r * 0.6);
      ctx.fill();
    }
    if (lv.theme.wall) {
      ctx.fillStyle = '#6b4f32';
      ctx.fillRect(-20, -30, LOGICAL_W + 40, lv.theme.wall.h + 10);
    }
    if (lv.theme.cave) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-20, -30, LOGICAL_W + 40, LOGICAL_H + 60);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [wd, col] of [[72, lv.theme.dirtDark], [60, lv.theme.dirt]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      for (const p of this.pathsFor(lv)) {
        ctx.beginPath();
        p.pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.stroke();
      }
    }
    outline(ctx, 8);
    ell(ctx, lv.anthill.x, lv.anthill.y - 10, 95, 58);
    ctx.fillStyle = PAL.mound;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2412';
    ell(ctx, lv.anthill.x, lv.anthill.y + 8, 26, 14);
    ctx.fill();
    twig(ctx, lv.anthill.x + 28, lv.anthill.y - 44, lv.anthill.x + 28, lv.anthill.y - 125, 10);
    pennant(ctx, lv.anthill.x + 28, lv.anthill.y - 125, 60, 34, PAL.flag);
    ctx.restore();
    roundRect(ctx, x, y, w, h, 12);
    ctx.strokeStyle = PAL.uiBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    outline(ctx, 3);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.55, Math.PI, 0);
    ctx.strokeStyle = PAL.uiLight;
    ctx.lineWidth = 6;
    ctx.stroke();
    roundRect(ctx, x - r * 0.8, y - r * 0.3, r * 1.6, r * 1.2, 6);
    ctx.fillStyle = PAL.uiLight;
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PAL.outline;
    circle(ctx, x, y + r * 0.25, r * 0.16);
    ctx.fill();
  }

  /** Галочка «пройдено» в зелёном кружке. */
  private drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    circle(ctx, x, y, r);
    ctx.fillStyle = '#3c8a2b';
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y);
    ctx.lineTo(x - r * 0.1, y + r * 0.38);
    ctx.lineTo(x + r * 0.5, y - r * 0.4);
    ctx.strokeStyle = PAL.uiLight;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Карточка карты в сетке акта: миниатюра слева, номер и название справа, внизу звёзды и
   * сложность, на которой карта пройдена. Тап по карточке открывает вступление карты.
   */
  private levelCard(ctx: CanvasRenderingContext2D, lv: LevelDef, i: number, x: number, y: number, w: number, h: number): void {
    const g = this.g;
    const unlocked = g.isUnlocked(i);
    const stars = g.starsFor(i);
    const act = ACTS[LEVEL_ACT[i]];
    const hover = this.g.input.hover;
    const hot = !!hover && unlocked && hover.x >= x && hover.x <= x + w && hover.y >= y && hover.y <= y + h;
    this.panel(ctx, x, y, w, h, 16, hot ? 'rgba(70,40,15,0.92)' : PAL.ui);
    const mw = 150;
    const mh = 84;
    this.miniMap(ctx, lv, x + 10, y + 10, mw, mh);
    const tx = x + mw + 22;
    const tw = w - mw - 30;
    drawText(ctx, t('levels.map', i - act.from + 1), tx, y + 22, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    const lines = wrapText(ctx, levelText(lv.id).name, tw, 16, 'bold').slice(0, 3);
    lines.forEach((l, k) => drawText(ctx, l, tx, y + 46 + k * 19, { size: 16, color: PAL.uiGold }));
    for (let s = 0; s < 3; s++) drawStar(ctx, x + 24 + s * 30, y + h - 28, 11, s < stars);
    const beaten = g.progress.beaten[lv.id];
    if (beaten) drawText(ctx, difficultyText(beaten).name.toLowerCase(), x + w - 14, y + h - 28, { size: 13, align: 'right', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    if (unlocked) {
      this.reg(this.overlayButtons, { x, y, w, h, onTap: () => g.chooseLevel(i) });
    } else {
      roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      this.drawLock(ctx, x + w / 2, y + h / 2 - 12, 16);
    }
  }

  /** Вкладка акта слева: кружок с цветом ландшафта, номер и название, звёзды акта или замок. */
  private actTab(ctx: CanvasRenderingContext2D, a: number, x: number, y: number, w: number, h: number): void {
    const g = this.g;
    const act = ACTS[a];
    const open = g.isActUnlocked(a);
    const on = g.levelsAct === a;
    this.panel(ctx, x, y, w, h, 14, on ? '#3c6a2b' : open ? PAL.ui : 'rgba(30,18,8,0.85)');
    if (on) {
      roundRect(ctx, x, y, w, h, 14);
      ctx.strokeStyle = PAL.uiGold;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    const theme = THEMES[act.theme];
    const cx = x + 26;
    const cy = y + h / 2;
    circle(ctx, cx, cy, 17);
    ctx.fillStyle = theme.grass;
    ctx.fill();
    ctx.save();
    circle(ctx, cx, cy, 17);
    ctx.clip();
    ctx.strokeStyle = theme.dirt;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 6);
    ctx.quadraticCurveTo(cx, cy - 10, cx + 18, cy + 4);
    ctx.stroke();
    ctx.restore();
    circle(ctx, cx, cy, 17);
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const [num, name] = actTitle(a).split(' · ');
    drawText(ctx, num, x + 52, y + 18, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    // Длинные названия первых актов ужимаются по ширине вкладки, а не обрезаются.
    const nm = name ?? '';
    let size = 15;
    while (size > 10 && measure(ctx, nm, size, 'bold') > w - 62) size--;
    drawText(ctx, nm, x + 52, y + 37, { size, color: open ? PAL.uiLight : 'rgba(246,230,200,0.5)' });
    if (open) {
      const st = g.actStars(a);
      drawText(ctx, `★ ${st.have}/${st.max}`, x + 52, y + 55, { size: 12, weight: 'normal', stroke: null, color: g.actDone(a) ? PAL.uiGold : 'rgba(246,230,200,0.7)' });
      this.reg(this.overlayButtons, { x, y, w, h, onTap: () => { g.levelsAct = a; } });
    } else {
      this.drawLock(ctx, x + w - 22, y + h / 2, 10);
    }
  }

  /** Боковая карточка: пролог (обучение) или испытание (бесконечная осада). */
  private sideCard(
    ctx: CanvasRenderingContext2D, lv: LevelDef, x: number, y: number, w: number, h: number,
    o: { label: string; status: string; unlocked: boolean; done?: boolean; onTap: () => void },
  ): void {
    this.panel(ctx, x, y, w, h, 16);
    drawText(ctx, o.label, x + w / 2, y + 18, { size: 13, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    this.miniMap(ctx, lv, x + 10, y + 32, w - 20, Math.round(((w - 20) * 9) / 16));
    const lines = wrapText(ctx, levelText(lv.id).name, w - 16, 15, 'bold').slice(0, 2);
    const ny = y + 32 + Math.round(((w - 20) * 9) / 16) + 20;
    lines.forEach((l, k) => drawText(ctx, l, x + w / 2, ny + k * 18, { size: 15, align: 'center', color: PAL.uiGold }));
    drawText(ctx, o.status, x + w / 2, y + h - 18, { size: 12, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    if (o.done) this.drawCheck(ctx, x + w - 16, y + 16, 10);
    if (o.unlocked) this.reg(this.overlayButtons, { x, y, w, h, onTap: o.onTap });
    else {
      roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      this.drawLock(ctx, x + w / 2, y + h / 2, 14);
    }
  }

  /**
   * Экран кампании: слева вкладки восьми актов, в центре девять карт выбранного акта, справа
   * пролог-обучение и бесконечная осада. Следующий акт открывается звездой на каждой карте прошлого.
   */
  private drawLevels(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, gameTitle(), 640, 30, { size: 28, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    this.bigButton(ctx, 1170, 30, 180, 38, t('levels.settings'), () => g.toSettings(), 'rgba(90,60,30,0.9)', 16);
    this.bigButton(ctx, 980, 30, 180, 38, t('levels.bestiary'), () => g.toBestiary(), 'rgba(90,60,30,0.9)', 16);
    // Вкладки актов.
    const tabX = 14;
    const tabW = 186;
    const tabH = 64;
    ACTS.forEach((_, a) => this.actTab(ctx, a, tabX, 62 + a * (tabH + 7), tabW, tabH));
    // Карты акта.
    const a = Math.min(g.levelsAct, ACTS.length - 1);
    const act = ACTS[a];
    const gx = 214;
    const gy = 92;
    const cw = 296;
    const ch = 172;
    const gap = 12;
    const st = g.actStars(a);
    drawText(ctx, actTitle(a), gx + 4, 72, { size: 19, color: PAL.uiLight });
    drawText(ctx, `★ ${st.have}/${st.max}`, gx + 3 * cw + 2 * gap - 4, 72, { size: 16, align: 'right', color: PAL.uiGold });
    for (let k = 0; k <= act.to - act.from; k++) {
      const i = act.from + k;
      this.levelCard(ctx, LEVELS[i], i, gx + (k % 3) * (cw + gap), gy + Math.floor(k / 3) * (ch + gap), cw, ch);
    }
    if (!g.isActUnlocked(a)) {
      drawText(ctx, t('levels.actLocked'), gx + (3 * cw + 2 * gap) / 2, gy + (3 * ch + 2 * gap) / 2, { size: 20, align: 'center', color: PAL.uiLight, strokeWidth: 5 });
    }
    // Пролог и испытание.
    const sx = gx + 3 * cw + 2 * gap + 12;
    const sw = 1268 - sx;
    const tutDone = g.progress.tutorialDone;
    this.sideCard(ctx, TUTORIAL, sx, gy, sw, 260, {
      label: t('levels.prologue'), status: tutDone ? t('levels.tutorialDone') : t('levels.tutorial'), unlocked: true, done: tutDone,
      onTap: () => g.chooseTutorial(),
    });
    const best = g.endlessBest;
    this.sideCard(ctx, ENDLESS, sx, gy + 280, sw, 260, {
      label: t('levels.challenge'), status: best ? t('levels.record', best.wave) : g.endlessUnlocked ? t('levels.noRecord') : t('levels.lockedTutorial'),
      unlocked: g.endlessUnlocked, onTap: () => g.chooseEndless(),
    });
    const free = freeStars(g.progress);
    this.bigButton(ctx, 690, 684, 330, 42, t('levels.perks', free), () => g.toPerks(), free > 0 ? '#3c8a2b' : 'rgba(90,60,30,0.9)', 18);
    drawText(ctx, t('levels.difficulty', difficultyText(g.difficulty.id).name.toLowerCase()), 16, 684, { size: 12, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    const resetLabel = g.resetArmed ? t('levels.resetConfirm') : t('levels.reset');
    drawText(ctx, resetLabel, 1050, 684, { size: 14, align: 'center', weight: 'normal', stroke: null, color: g.resetArmed ? PAL.uiRed : 'rgba(246,230,200,0.55)' });
    this.reg(this.overlayButtons, { x: 930, y: 666, w: 240, h: 36, onTap: () => g.resetProgressTap() });
  }

  /** Перки за звёзды: восемь улучшений в два столбца. */
  private drawPerks(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    const free = freeStars(g.progress);
    const total = totalStars(g.progress);
    drawText(ctx, t('perks.title'), 640, 46, { size: 34, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    drawText(ctx, t('perks.free', free, total), 640, 84, {
      size: 16, align: 'center', weight: 'normal', stroke: null,
    });
    const colW = 560;
    const rowH = 100;
    PERKS.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 80 + col * (colW + 40);
      const y = 112 + row * (rowH + 10);
      const rank = g.progress.perks[p.id] ?? 0;
      const maxed = rank >= p.maxRank;
      const can = !maxed && free >= p.cost;
      this.panel(ctx, x, y, colW, rowH, 16);
      const px = perkText(p.id);
      drawText(ctx, px.name, x + 18, y + 24, { size: 19, color: PAL.uiGold });
      drawText(ctx, px.desc(Math.max(1, rank)), x + 18, y + 50, { size: 14, weight: 'normal', stroke: null });
      if (!maxed) {
        drawText(ctx, t('perks.next', px.desc(rank + 1)), x + 18, y + 72, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.65)' });
      } else {
        drawText(ctx, t('perks.maxRank'), x + 18, y + 72, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.65)' });
      }
      for (let r = 0; r < p.maxRank; r++) {
        circle(ctx, x + colW - 150 + r * 20, y + 26, 7);
        ctx.fillStyle = r < rank ? PAL.honey : 'rgba(0,0,0,0.4)';
        ctx.fill();
        ctx.strokeStyle = PAL.outline;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const bx = x + colW - 124;
      const by = y + 44;
      roundRect(ctx, bx, by, 108, 42, 12);
      ctx.fillStyle = can ? '#3c8a2b' : 'rgba(60,40,25,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, maxed ? t('perks.max') : t('perks.buy', p.cost), bx + 54, by + 21, { size: 16, align: 'center', color: can || maxed ? PAL.uiLight : 'rgba(246,230,200,0.5)' });
      if (can) this.reg(this.overlayButtons, { x: bx, y: by, w: 108, h: 42, onTap: () => g.buyPerk(p.id) });
    });
    this.bigButton(ctx, 540, 600, 220, 56, t('perks.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 790, 600, 260, 56, t('perks.refund'), () => g.refundPerks(), 'rgba(90,60,30,0.9)', 20);
    drawText(ctx, t('perks.refundHint'), 640, 656, {
      size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.6)',
    });
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const lv = g.level;
    const mode = g.mode;
    this.dim(ctx);
    this.panel(ctx, 240, 80, 800, 570, 26);
    const lx = levelText(lv.id);
    // Карта кампании: акт и номер карты в нём.
    const actIdx = LEVEL_ACT[g.levelIndex] ?? 0;
    const head = mode === 'tutorial' ? t('intro.tutorial') : mode === 'endless' ? t('intro.endless')
      : `${actTitle(actIdx)} · ${t('levels.map', g.levelIndex - ACTS[actIdx].from + 1)}`;
    drawText(ctx, head, 640, 120, { size: 18, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    drawText(ctx, lx.name, 640, 160, { size: 40, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
    const lines = wrapText(ctx, lx.story, 700, 19);
    lines.forEach((l, i) => drawText(ctx, l, 640, 216 + i * 27, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    const stats = mode === 'tutorial'
      ? t('intro.tutorialStats')
      : mode === 'endless'
        ? t('intro.endlessStats', g.world.plots.length, g.world.startLives)
        : t('intro.stats', lv.waves.length, lv.paths.length === 1 ? t('intro.onePath') : t('intro.paths', lv.paths.length), g.world.plots.length, g.world.startLives);
    drawText(ctx, stats, 640, 380, { size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    if (mode === 'tutorial') {
      // На обучении сложность не выбирается; кто и так всё знает, может его пропустить.
      this.bigButton(ctx, 640, 450, 320, 48, t('intro.skip'), () => g.skipTutorial(), 'rgba(90,60,30,0.9)', 18);
    } else {
      // Сложность: три кнопки, выбор запоминается между уровнями.
      const cur = g.difficulty;
      drawText(ctx, t('intro.difficulty'), 640, 416, { size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
      const bw = 200;
      const bh = 42;
      const gap = 12;
      const x0 = 640 - (DIFFICULTIES.length * bw + (DIFFICULTIES.length - 1) * gap) / 2;
      DIFFICULTIES.forEach((d, i) => {
        const x = x0 + i * (bw + gap);
        const on = d.id === cur.id;
        roundRect(ctx, x, 432, bw, bh, 12);
        ctx.fillStyle = on ? '#3c8a2b' : 'rgba(60,40,25,0.9)';
        ctx.fill();
        ctx.strokeStyle = on ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        drawText(ctx, difficultyText(d.id).name, x + bw / 2, 432 + bh / 2, { size: 18, align: 'center', color: on ? PAL.uiLight : 'rgba(246,230,200,0.7)' });
        this.reg(this.overlayButtons, { x, y: 432, w: bw, h: bh, onTap: () => g.setDifficulty(d.id) });
      });
      if (mode === 'endless') {
        // Рекорд своей на каждой сложности: под кнопками тот, что на выбранной.
        const best = g.endlessBest;
        const rec = best ? t('intro.record', difficultyText(cur.id).name.toLowerCase(), best.wave, best.kills) : t('intro.noRecord');
        drawText(ctx, rec, 640, 494, { size: 15, align: 'center', color: best ? PAL.uiGold : 'rgba(246,230,200,0.75)', strokeWidth: 3 });
      } else {
        drawText(ctx, difficultyText(cur.id).desc, 640, 494, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
      }
    }
    this.bigButton(ctx, 700, 544, 260, 60, t('intro.fight'), () => g.start());
    this.bigButton(ctx, 450, 544, 200, 60, t('intro.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    drawText(ctx, t('intro.hint1'), 640, 606, {
      size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)',
    });
    drawText(ctx, t('intro.hint2'), 640, 628, {
      size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)',
    });
  }

  private drawEnd(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const won = g.state === 'won';
    const mode = g.mode;
    this.dim(ctx);
    this.panel(ctx, 320, 150, 640, 420, 26);
    const diff = t('end.difficulty', difficultyText(g.difficulty.id).name.toLowerCase());
    const body = (text: string, y: number): void => {
      wrapText(ctx, text, 560, 19).forEach((l, i) => drawText(ctx, l, 640, y + i * 26, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    };
    if (mode === 'tutorial' && won) {
      drawText(ctx, t('end.tutorialWon'), 640, 210, { size: 40, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
      this.drawCheck(ctx, 640, 272, 24);
      body(t('end.tutorialText'), 326);
      this.bigButton(ctx, 520, 500, 220, 64, t('end.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
      this.bigButton(ctx, 770, 500, 220, 64, t('end.march'), () => g.chooseLevel(0));
      return;
    }
    if (mode === 'endless') {
      drawText(ctx, t('end.endless'), 640, 210, { size: 40, align: 'center', color: PAL.uiRed, strokeWidth: 7 });
      const best = g.endlessBest;
      if (g.newRecord) {
        const bounce = Math.sin(g.clock * 3) * 3;
        drawText(ctx, t('end.newRecord'), 640, 272 + bounce, { size: 32, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
      }
      const rec = !g.newRecord && best ? t('end.record', best.wave) : '';
      body(t('end.endlessText', g.world.clearedWaves, g.world.stats.kills, `${rec} ${diff}`.trim()), 330);
      this.bigButton(ctx, 520, 500, 220, 64, t('end.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
      this.bigButton(ctx, 770, 500, 220, 64, t('end.again'), () => g.start());
      return;
    }
    drawText(ctx, won ? t('end.won') : t('end.lost'), 640, 210, { size: 40, align: 'center', color: won ? PAL.uiGold : PAL.uiRed, strokeWidth: 7 });
    if (won) {
      for (let s = 0; s < 3; s++) {
        const filled = s < g.earnedStars;
        const bounce = filled ? Math.sin(g.clock * 3 + s) * 3 : 0;
        drawStar(ctx, 640 - 70 + s * 70, 290 + bounce, 28, filled);
      }
    }
    // Победа впервые закрыла акт: строка финала акта и какой акт открылся следом.
    const done = won && mode === 'campaign' ? g.actCompleted : null;
    const finale = done === null ? '' : actFinale(done) + (done + 1 < ACTS.length ? t('end.actUnlocked', actTitle(done + 1)) : '');
    const sub = won
      ? t('end.wonText', g.waves.total, g.lives, g.world.startLives, diff, finale)
      : t('end.lostText', g.waves.index, g.waves.total, diff, g.difficulty.id !== 'easy' ? t('end.easier') : '');
    body(sub, won ? 350 : 290);
    const next = won ? g.nextLevel() : null;
    if (next !== null) {
      this.bigButton(ctx, 450, 500, 190, 64, t('end.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
      this.bigButton(ctx, 650, 500, 190, 64, t('end.again'), () => g.start(), 'rgba(90,60,30,0.9)', 22);
      this.bigButton(ctx, 850, 500, 190, 64, t('end.next'), () => g.chooseLevel(next));
      return;
    }
    this.bigButton(ctx, 520, 500, 220, 64, t('end.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 770, 500, 220, 64, t('end.again'), () => g.start());
  }

  /**
   * Большая карта: вход тропы, откуда идёт волна, может быть за краем экрана. Тогда у края
   * стоит стрелка в его сторону; тап по ней переводит камеру к этому входу.
   */
  private drawEntranceArrows(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const v = g.screen.view;
    const o = this.hud();
    const x0 = v.x0 + 44;
    const x1 = v.x1 - 44;
    const y0 = o.t + 120;
    const y1 = v.y1 - 120;
    for (const i of g.incomingPaths()) {
      const e = g.entrance(i);
      if (!e) continue;
      const s = g.camera.toScreen(e.x, e.y);
      // Вход виден на экране (не под верхней панелью): стрелка не нужна, хватает флажка.
      if (s.x >= v.x0 + 8 && s.x <= v.x1 - 8 && s.y >= o.t + 80 && s.y <= v.y1 - 8) continue;
      const cx = clamp(s.x, x0, x1);
      const cy = clamp(s.y, y0, y1);
      const a = Math.atan2(s.y - cy, s.x - cx);
      const pulse = 0.75 + 0.25 * Math.sin(g.clock * 5 + i);
      ctx.save();
      ctx.globalAlpha = pulse;
      circle(ctx, cx, cy, 26);
      ctx.fillStyle = 'rgba(150,30,20,0.9)';
      ctx.fill();
      ctx.strokeStyle = PAL.uiLight;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fillStyle = PAL.uiLight;
      ctx.fill();
      ctx.restore();
      this.reg(this.buttons, { x: cx, y: cy, w: 56, h: 56, round: true, onTap: () => g.focusEntrance(i) });
    }
  }

  /** Подсказка про камеру в начале бесконечной осады: внизу посередине, пока игрок не сдвинет карту. */
  private drawCamHint(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const o = this.hud();
    const a = Math.min(1, g.camHint);
    const text = t('endless.hint');
    const w = measure(ctx, text, 16, 'bold') + 40;
    ctx.save();
    ctx.globalAlpha = a;
    this.panel(ctx, 640 - w / 2, 560 + o.b, w, 40, 14);
    drawText(ctx, text, 640, 580 + o.b, { size: 16, align: 'center', color: PAL.uiLight, strokeWidth: 3 });
    ctx.restore();
  }

  // ───────────── дары бесконечной осады ─────────────

  /** Значок дара внутри эмблемы радиуса около 56 px. */
  private boonIcon(ctx: CanvasRenderingContext2D, id: BoonId, cx: number, cy: number): void {
    const g = this.g;
    const tower = (kind: TowerKind, s: number, dy: number): void => drawTowerIcon(ctx, kind, cx, cy + dy, s, 3);
    switch (id) {
      case 'acid': tower('acid', 0.98, 10); break;
      case 'catapult': tower('catapult', 1.3, 8); break;
      case 'spore': tower('spore', 1.2, 10); break;
      case 'chitin': tower('barracks', 0.98, 10); break;
      case 'range': {
        // Круг дальности, как у выбранной башни, и сама башня в середине.
        ctx.save();
        ctx.translate(cx, cy + 4);
        ctx.scale(1, 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        circle(ctx, 0, 0, 50);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = -g.clock * 14;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawTowerIcon(ctx, 'acid', cx, cy + 4, 0.42, 3);
        break;
      }
      case 'rate': {
        // Секундомер: бронзовый корпус, светлый циферблат, бегущая стрелка.
        ctx.save();
        ctx.translate(cx, cy + 4);
        outline(ctx, 3);
        roundRect(ctx, -7, -44, 14, 12, 3);
        ctx.fillStyle = '#c8923a';
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.rotate(0.7);
        roundRect(ctx, -5, -42, 10, 9, 3);
        ctx.fillStyle = '#c8923a';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        const body = ctx.createLinearGradient(-30, -30, 30, 30);
        body.addColorStop(0, '#fbe6a0');
        body.addColorStop(1, '#8a5a1e');
        circle(ctx, 0, 0, 33);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.stroke();
        const face = ctx.createRadialGradient(-8, -10, 2, 0, 0, 27);
        face.addColorStop(0, '#fffaf0');
        face.addColorStop(1, '#e6d5b0');
        circle(ctx, 0, 0, 26);
        ctx.fillStyle = face;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(42,22,8,0.75)';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const r0 = i % 3 === 0 ? 18 : 21;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
          ctx.stroke();
        }
        const a = g.clock * 2.4 - Math.PI / 2;
        ctx.strokeStyle = '#c8362a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * 5, -Math.sin(a) * 5);
        ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.stroke();
        ctx.fillStyle = PAL.outline;
        circle(ctx, 0, 0, 3.5);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'jaws':
        ctx.save();
        ctx.translate(cx, cy + 2);
        ctx.scale(1.7, 1.7);
        drawShadow(ctx, 0, 6, 15, 6);
        drawAnt(ctx, 0, 0, 0.5, 1, ANT_SOLDIER, g.clock * 9, true);
        ctx.restore();
        break;
      case 'veteran':
        ctx.save();
        ctx.translate(cx, cy + 6);
        ctx.scale(1.6, 1.6);
        drawShadow(ctx, 0, 6, 15, 6);
        drawHero(ctx, 0, 0, 0.5, g.clock * 8);
        ctx.restore();
        drawStar(ctx, cx + 30, cy - 30, 13, true);
        break;
      case 'spells': {
        // Капля кислотного дождя в кольце со стрелкой: перезарядка идёт быстрее.
        ctx.save();
        ctx.translate(cx, cy + 2);
        ctx.scale(3.2, 3.2);
        drawAcidGlob(ctx, 0, 0, -Math.PI / 2);
        ctx.restore();
        ctx.save();
        ctx.translate(cx, cy + 2);
        ctx.rotate(g.clock * 1.2);
        for (const [col, lw] of [[PAL.outline, 9], [PAL.uiGold, 5]] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, 40, 0.5, TAU - 0.5);
          ctx.stroke();
        }
        const ax = Math.cos(TAU - 0.5) * 40;
        const ay = Math.sin(TAU - 0.5) * 40;
        ctx.translate(ax, ay);
        ctx.rotate(TAU - 0.5 + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(-6, -11);
        ctx.lineTo(-6, 11);
        ctx.closePath();
        ctx.fillStyle = PAL.uiGold;
        ctx.fill();
        outline(ctx, 2.5);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'bounty':
        // Большая капля нектара с зелёным плюсом: каждая награда больше.
        drawHoney(ctx, cx - 4, cy + 8, 30);
        circle(ctx, cx + 28, cy + 24, 15);
        ctx.fillStyle = '#3c8a2b';
        ctx.fill();
        outline(ctx, 3);
        ctx.stroke();
        ctx.strokeStyle = PAL.uiLight;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(cx + 20, cy + 24);
        ctx.lineTo(cx + 36, cy + 24);
        ctx.moveTo(cx + 28, cy + 16);
        ctx.lineTo(cx + 28, cy + 32);
        ctx.stroke();
        break;
      case 'nectar':
        // Горка капель: полная кладовая.
        drawHoney(ctx, cx - 22, cy + 2, 17);
        drawHoney(ctx, cx + 22, cy + 2, 17);
        drawHoney(ctx, cx, cy - 16, 17);
        drawHoney(ctx, cx, cy + 22, 21);
        break;
      case 'brood':
        drawLarva(ctx, cx - 20, cy - 16, 15);
        drawLarva(ctx, cx + 22, cy - 6, 15);
        drawLarva(ctx, cx - 6, cy + 20, 17);
        break;
    }
  }

  /**
   * Карточка дара: тёмное поле в золотой раме, сверху лента группы, эмблема со значком,
   * название, что даёт, сколько раз уже взят и кнопка. k — насколько карточка уже выехала (0..1).
   */
  private boonCard(ctx: CanvasRenderingContext2D, id: BoonId, i: number, x: number, y0: number, w: number, h: number, k: number): void {
    const g = this.g;
    const def = boonDef(id);
    const tx = boonText(id, g.world);
    const taken = g.world.boons[id] ?? 0;
    const hover = g.input.hover;
    const ready = k >= 1;
    const hot = ready && !!hover && hover.x >= x && hover.x <= x + w && hover.y >= y0 && hover.y <= y0 + h;
    const y = y0 + (1 - k) * 60 - (hot ? 8 : 0);
    const [main, light, dark] = BOON_TINT[def.group];
    const cx = x + w / 2;
    ctx.save();
    ctx.globalAlpha = k;
    // Тень и поле карточки.
    roundRect(ctx, x + 3, y + 9, w, h, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    const field = ctx.createLinearGradient(0, y, 0, y + h);
    field.addColorStop(0, '#5c3619');
    field.addColorStop(0.45, '#3d2210');
    field.addColorStop(1, '#2a1508');
    roundRect(ctx, x, y, w, h, 24);
    ctx.fillStyle = field;
    ctx.fill();
    // Отсвет цвета группы сверху: по нему карточки различаются с первого взгляда.
    ctx.save();
    roundRect(ctx, x, y, w, h, 24);
    ctx.clip();
    const glow = ctx.createRadialGradient(cx, y + 108, 10, cx, y + 108, 190);
    glow.addColorStop(0, `${main}aa`);
    glow.addColorStop(1, `${main}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    // Золотая рама и тонкая внутренняя линия.
    const gold = ctx.createLinearGradient(x, y, x + w, y + h);
    gold.addColorStop(0, hot ? '#fff6c8' : '#fbe6a0');
    gold.addColorStop(0.5, hot ? '#ffd95a' : '#cf9a3e');
    gold.addColorStop(1, hot ? '#e8b24a' : '#7e521a');
    roundRect(ctx, x, y, w, h, 24);
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    roundRect(ctx, x + 9, y + 9, w - 18, h - 18, 17);
    ctx.strokeStyle = 'rgba(255,230,190,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Эмблема: бронзовый обод, внутри поле цвета группы и значок.
    const ey = y + 112;
    const er = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    circle(ctx, cx + 1, ey + 5, er + 7);
    ctx.fill();
    const bronze = ctx.createLinearGradient(cx - er, ey - er, cx + er, ey + er);
    bronze.addColorStop(0, '#fbe6a0');
    bronze.addColorStop(0.4, '#cf9a3e');
    bronze.addColorStop(1, '#6b4315');
    circle(ctx, cx, ey, er + 7);
    ctx.fillStyle = bronze;
    ctx.fill();
    outline(ctx, 3);
    ctx.stroke();
    const disc = ctx.createRadialGradient(cx - 18, ey - 24, 6, cx, ey, er);
    disc.addColorStop(0, light);
    disc.addColorStop(0.55, main);
    disc.addColorStop(1, dark);
    circle(ctx, cx, ey, er);
    ctx.fillStyle = disc;
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,22,8,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    circle(ctx, cx, ey, er - 1);
    ctx.clip();
    this.boonIcon(ctx, id, cx, ey);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, ey, er + 4, Math.PI * 1.08, Math.PI * 1.45);
    ctx.stroke();
    // Лента группы на верхней кромке.
    const label = t(`boon.group.${def.group}`);
    const lw = measure(ctx, label, 14, 'bold') + 34;
    roundRect(ctx, cx - lw / 2, y - 15, lw, 30, 15);
    ctx.fillStyle = main;
    ctx.fill();
    outline(ctx, 3);
    ctx.stroke();
    roundRect(ctx, cx - lw / 2 + 3, y - 12, lw - 6, 10, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    drawText(ctx, label, cx, y + 1, { size: 14, align: 'center', strokeWidth: 3 });
    // Название и что даёт.
    let ns = 24;
    while (ns > 18 && measure(ctx, tx.name, ns, 'bold') > w - 36) ns--;
    drawText(ctx, tx.name, cx, y + 208, { size: ns, align: 'center', color: PAL.uiGold, strokeWidth: 5 });
    const lines = wrapText(ctx, tx.desc, w - 44, 17).slice(0, 4);
    lines.forEach((ln, n) => drawText(ctx, ln, cx, y + 246 + n * 23, { size: 17, align: 'center', weight: 'normal', stroke: null }));
    if (taken > 0) {
      drawText(ctx, t('boon.taken', taken), cx, y + h - 76, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(255,217,90,0.9)' });
    }
    // Кнопка: тапать можно по всей карточке.
    const bw = 170;
    const bh = 42;
    roundRect(ctx, cx - bw / 2, y + h - 60, bw, bh, 14);
    ctx.fillStyle = hot ? '#4aa636' : '#3c8a2b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawText(ctx, t('boon.pick'), cx, y + h - 39, { size: 20, align: 'center' });
    ctx.restore();
    this.reg(this.overlayButtons, { x, y: y0, w, h, onTap: () => g.chooseBoon(i) });
  }

  /** Выбор дара после каждой десятой волны осады: затемнённое поле и три карточки посередине. */
  private drawBoons(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const offer = g.boonOffer;
    if (!offer) return;
    const age = g.clock - g.boonShown;
    ctx.save();
    ctx.globalAlpha = Math.min(1, age / 0.25);
    this.dim(ctx, 0.7);
    drawText(ctx, t('boon.title'), 640, 84, { size: 46, align: 'center', color: PAL.uiGold, strokeWidth: 8 });
    drawText(ctx, t('boon.sub', g.boonWave), 640, 130, { size: 18, align: 'center', weight: 'normal', color: PAL.uiLight, strokeWidth: 4 });
    ctx.restore();
    const w = 272;
    const h = 392;
    const gap = 30;
    const x0 = 640 - (offer.length * w + (offer.length - 1) * gap) / 2;
    offer.forEach((id, i) => {
      const k = clamp((age - 0.1 - i * 0.09) / 0.35, 0, 1);
      this.boonCard(ctx, id, i, x0 + i * (w + gap), 186, w, h, 1 - Math.pow(1 - k, 3));
    });
  }

  // ───────────── карточки врагов ─────────────

  /** Во сколько раз увеличить образец, чтобы он занял медальон радиуса r, и на сколько сдвинуть вниз летуна. */
  private static specimenFit(kind: EnemyKind, r: number): { k: number; dx: number; dy: number } {
    const d = ENEMIES[kind];
    const k = Math.min(2.8, (r * 0.8) / FOE_EXTENT[kind]);
    // Летун рисуется над своей тенью, скарабей идёт позади шара: сдвигаем, чтобы в круге стоял по центру.
    return { k, dx: d.ball ? -5 * k : 0, dy: (d.flying ? 21 : 2) * k };
  }

  /** Тёмный силуэт ещё не встреченного врага: печётся один раз на вид и размер. */
  private silhouette(kind: EnemyKind, r: number): HTMLCanvasElement | null {
    const ps = Math.min(this.g.screen.pixelScale, 2.5);
    const key = `${kind}:${r}:${ps.toFixed(1)}`;
    let c = this.silhouettes.get(key) ?? null;
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(r * 2 * ps);
      const sctx = c.getContext('2d');
      if (!sctx) return null;
      sctx.scale(ps, ps);
      const f = UI.specimenFit(kind, r);
      this.g.drawSpecimen(sctx, kind, r + f.dx, r + f.dy, f.k);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = '#150d06';
      sctx.fillRect(0, 0, r * 2, r * 2);
      this.silhouettes.set(key, c);
    }
    return c;
  }

  /**
   * Медальон врага: бронзовый обод, внутри клочок земли его акта с тропой и сам враг, шагающий
   * на месте. Незнакомый враг — тёмный силуэт в сумерках со знаком вопроса.
   */
  private medallion(ctx: CanvasRenderingContext2D, kind: EnemyKind, cx: number, cy: number, r: number, known = true): void {
    const theme = THEMES[ACTS[homeAct(kind)].theme];
    const rim = Math.max(3, r * 0.1);
    ctx.save();
    // Тень под медальоном и обод: светлый сверху слева, тёмный снизу справа.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    circle(ctx, cx + 1, cy + rim * 0.7, r + rim);
    ctx.fill();
    const bronze = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    bronze.addColorStop(0, '#fbe6a0');
    bronze.addColorStop(0.4, '#cf9a3e');
    bronze.addColorStop(1, '#6b4315');
    circle(ctx, cx, cy, r + rim);
    ctx.fillStyle = bronze;
    ctx.fill();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = Math.max(1.5, r * 0.045);
    ctx.stroke();
    // Земля акта с тропой наискось.
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = theme.grass;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const big = r >= 50;
    if (big) {
      // Пятна светлой и тёмной травы и пучки травинок: на маленьком медальоне их не разглядеть.
      for (const [px, py, pr, col] of [[-0.55, -0.62, 0.34, theme.grassLight], [0.5, -0.5, 0.3, theme.grassDark], [0.1, 0.92, 0.4, theme.grassDark]] as const) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.55;
        ell(ctx, cx + px * r, cy + py * r, pr * r, pr * r * 0.6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'round';
    const trail = (dy: number): void => {
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.3, cy + r * (0.46 + dy));
      ctx.quadraticCurveTo(cx - r * 0.1, cy + r * (0.1 + dy), cx + r * 1.3, cy + r * (0.36 + dy));
      ctx.stroke();
    };
    for (const [lw, col] of [[r * 0.98, theme.dirtDark], [r * 0.84, theme.dirt]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      trail(0);
    }
    // Утоптанная середина тропы светлее краёв.
    ctx.strokeStyle = 'rgba(255,240,205,0.16)';
    ctx.lineWidth = r * 0.4;
    trail(-0.06);
    if (big) {
      // Камешки у кромки тропы и травинки: мелочь, по которой круг читается как клочок карты.
      for (const [px, py, pr] of [[-0.62, -0.2, 0.07], [0.7, -0.16, 0.055], [0.3, 0.78, 0.065], [-0.3, 0.84, 0.045], [0.52, 0.52, 0.035], [-0.72, 0.3, 0.035]] as const) {
        const sx = cx + px * r;
        const sy = cy + py * r;
        ctx.fillStyle = 'rgba(30,18,6,0.35)';
        ell(ctx, sx + pr * r * 0.25, sy + pr * r * 0.5, pr * r * 1.1, pr * r * 0.6);
        ctx.fill();
        ell(ctx, sx, sy, pr * r, pr * r * 0.74);
        ctx.fillStyle = theme.dirtDark;
        ctx.fill();
        ctx.strokeStyle = 'rgba(42,22,8,0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ell(ctx, sx - pr * r * 0.3, sy - pr * r * 0.28, pr * r * 0.36, pr * r * 0.2);
        ctx.fill();
      }
      ctx.strokeStyle = theme.grassDark;
      ctx.lineWidth = Math.max(1.5, r * 0.022);
      for (const [px, py] of [[-0.42, -0.5], [0.22, -0.66], [0.62, -0.44], [-0.1, 0.9], [0.52, 0.8], [-0.56, 0.74]] as const) {
        const sx = cx + px * r;
        const sy = cy + py * r;
        ctx.beginPath();
        for (const [dx, dy] of [[-0.07, -0.1], [0, -0.14], [0.07, -0.09]] as const) {
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + dx * r * 0.4, sy + dy * r * 0.7, sx + dx * r, sy + dy * r);
        }
        ctx.stroke();
      }
    }
    const sun = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 1.2);
    sun.addColorStop(0, 'rgba(255,250,220,0.3)');
    sun.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (!known) {
      ctx.fillStyle = 'rgba(18,12,24,0.72)';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const sil = this.silhouette(kind, r);
      if (sil) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(sil, cx - r, cy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    } else {
      const f = UI.specimenFit(kind, r);
      this.g.drawSpecimen(ctx, kind, cx + f.dx, cy + f.dy, f.k);
    }
    // Тень от обода по краю: круг выглядит вдавленным.
    const edge = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
    edge.addColorStop(0, 'rgba(20,10,0,0)');
    edge.addColorStop(1, 'rgba(20,10,0,0.5)');
    ctx.fillStyle = edge;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    circle(ctx, cx, cy, r);
    ctx.strokeStyle = 'rgba(42,22,8,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.035);
    ctx.stroke();
    // Блик на ободе.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, rim * 0.28);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r + rim * 0.55, Math.PI * 1.08, Math.PI * 1.45);
    ctx.stroke();
    if (!known) drawText(ctx, '?', cx, cy + r * 0.04, { size: Math.round(r * 0.9), align: 'center', color: PAL.uiGold, strokeWidth: Math.max(3, r * 0.14) });
    ctx.restore();
  }

  /** Значок свойства в карточке: сердце, щит, стрелки скорости или жвало. */
  private statIcon(ctx: CanvasRenderingContext2D, id: 'hp' | 'armor' | 'speed' | 'hit', x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    outline(ctx, 2);
    switch (id) {
      case 'hp':
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.bezierCurveTo(-11, -1, -6, -10, 0, -3.5);
        ctx.bezierCurveTo(6, -10, 11, -1, 0, 7);
        ctx.closePath();
        ctx.fillStyle = '#e2584a';
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ell(ctx, -3.6, -3, 1.9, 1.3, -0.6);
        ctx.fill();
        break;
      case 'armor': {
        const shield = (): void => {
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(7, -5.5);
          ctx.lineTo(7, 0);
          ctx.quadraticCurveTo(6, 6, 0, 8.5);
          ctx.quadraticCurveTo(-6, 6, -7, 0);
          ctx.lineTo(-7, -5.5);
          ctx.closePath();
        };
        shield();
        ctx.fillStyle = '#7f9fc4';
        ctx.fill();
        ctx.save();
        shield();
        ctx.clip();
        ctx.fillStyle = '#b9d2ea';
        ctx.fillRect(-8, -9, 8, 18);
        ctx.restore();
        shield();
        ctx.stroke();
        break;
      }
      case 'speed':
        for (const [col, lw] of [[PAL.outline, 5.5], ['#9ee86a', 2.8]] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          for (const dx of [-5, 2]) {
            ctx.moveTo(dx - 2, -6);
            ctx.lineTo(dx + 4, 0);
            ctx.lineTo(dx - 2, 6);
          }
          ctx.stroke();
        }
        break;
      case 'hit':
        // Жвалы клещами: два серпа остриями друг к другу.
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sx * 1.6, 8.5);
          ctx.quadraticCurveTo(sx * 17, 1, sx * 1, -9);
          ctx.quadraticCurveTo(sx * 4.5, -1, sx * 1.6, 8.5);
          ctx.closePath();
          ctx.fillStyle = '#f5a03a';
          ctx.lineWidth = 1.6;
          ctx.fill();
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-7.2, 3);
        ctx.quadraticCurveTo(-8.2, -2, -4.4, -5.4);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /** Строка свойства: значок, подпись и шкала из пяти делений. */
  private statRow(ctx: CanvasRenderingContext2D, id: 'hp' | 'armor' | 'speed' | 'hit', x: number, y: number, w: number, n: number): void {
    const color = { hp: '#e2584a', armor: '#8fb4d8', speed: '#9ee86a', hit: '#f5a03a' }[id];
    this.statIcon(ctx, id, x + 11, y);
    drawText(ctx, t(`foe.${id}`), x + 30, y, { size: 16, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.9)' });
    const pw = 20;
    const gap = 4;
    const x0 = x + w - 5 * pw - 4 * gap;
    for (let i = 0; i < 5; i++) {
      const px = x0 + i * (pw + gap);
      roundRect(ctx, px, y - 6, pw, 12, 3.5);
      ctx.fillStyle = i < n ? color : 'rgba(0,0,0,0.5)';
      ctx.fill();
      if (i < n) {
        roundRect(ctx, px + 1.5, y - 4.5, pw - 3, 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
      roundRect(ctx, px, y - 6, pw, 12, 3.5);
      ctx.strokeStyle = i < n ? PAL.outline : 'rgba(255,230,190,0.18)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** Плашка-ярлык; возвращает свою ширину. */
  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, fill: string): number {
    const w = measure(ctx, text, 14, 'bold') + 22;
    roundRect(ctx, x, y - 13, w, 26, 13);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawText(ctx, text, x + w / 2, y + 0.5, { size: 14, align: 'center', strokeWidth: 2.5 });
    return w;
  }

  /** Разбивка текста карточки по строкам и её высота при ширине w. */
  private foeLayout(ctx: CanvasRenderingContext2D, kind: EnemyKind, w: number): { tx: FoeText; desc: string[]; tip: string[]; forms: readonly EnemyKind[]; h: number } | null {
    const tx = foeText(kind);
    if (!tx) return null;
    const desc = wrapText(ctx, tx.desc, w, 18);
    const tip = wrapText(ctx, tx.tip, w - 32, 17);
    const forms = bestiaryEntry(kind)?.forms ?? [];
    return { tx, desc, tip, forms, h: 200 + desc.length * 25 + (forms.length ? 66 : 10) + 38 + tip.length * 23 + 12 };
  }

  /** Содержимое карточки: медальон, имя, ярлыки, свойства, описание, кто из него выходит и совет. */
  private foeBlock(ctx: CanvasRenderingContext2D, kind: EnemyKind, x: number, y: number, w: number): void {
    const L = this.foeLayout(ctx, kind, w);
    if (!L) return;
    const d = ENEMIES[kind];
    const R = 80;
    this.medallion(ctx, kind, x + R + 8, y + R + 8, R);
    const tx = x + 2 * R + 40;
    const tw = x + w - tx;
    let size = 30;
    while (size > 20 && measure(ctx, L.tx.name, size, 'bold') > tw) size--;
    drawText(ctx, L.tx.name, tx, y + 20, { size, color: PAL.uiGold, strokeWidth: 5 });
    // Ярлыки: босс, пеший или летает, сколько личинок уносит (если больше одной).
    let px = tx;
    if (d.boss) px += this.pill(ctx, px, y + 58, t('foe.boss'), '#a3311f') + 8;
    px += this.pill(ctx, px, y + 58, d.flying ? t('foe.flying') : t('foe.ground'), d.flying ? '#2f6a9a' : '#6b5326') + 8;
    if (d.livesCost > 1) this.pill(ctx, px, y + 58, t('foe.lives', d.livesCost), '#7a3c1c');
    const st = foeStats(kind);
    const sw = Math.min(tw, 330);
    this.statRow(ctx, 'hp', tx, y + 94, sw, st.hp);
    this.statRow(ctx, 'armor', tx, y + 120, sw, st.armor);
    this.statRow(ctx, 'speed', tx, y + 146, sw, st.speed);
    this.statRow(ctx, 'hit', tx, y + 172, sw, st.hit);
    let cy = y + 212;
    for (const ln of L.desc) {
      drawText(ctx, ln, x, cy, { size: 18, weight: 'normal', stroke: null });
      cy += 25;
    }
    if (L.forms.length) {
      // Кто из него выходит: маленькие медальоны со стрелками.
      let fx = x + 6;
      const fy = cy + 30;
      for (const f of L.forms) {
        ctx.strokeStyle = PAL.uiGold;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(fx, fy - 8);
        ctx.lineTo(fx + 9, fy);
        ctx.lineTo(fx, fy + 8);
        ctx.stroke();
        this.medallion(ctx, f, fx + 44, fy, 23);
        const name = enemyName(f);
        drawText(ctx, name, fx + 78, fy, { size: 15, color: PAL.uiLight, strokeWidth: 3 });
        fx += 78 + measure(ctx, name, 15, 'bold') + 26;
      }
      cy += 66;
    } else {
      cy += 10;
    }
    // Совет: зелёная плашка с заголовком.
    const th = 34 + L.tip.length * 23 + 8;
    roundRect(ctx, x, cy - 8, w, th, 12);
    ctx.fillStyle = 'rgba(60,138,43,0.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(158,232,106,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawText(ctx, t('foe.tip'), x + 16, cy + 10, { size: 14, color: PAL.uiGreen, strokeWidth: 3 });
    L.tip.forEach((ln, i) => drawText(ctx, ln, x + 16, cy + 36 + i * 23, { size: 17, weight: 'normal', stroke: null }));
  }

  /**
   * Всплывающая карточка нового врага: вверху по центру, бой не останавливает. Висит несколько
   * секунд; тап разворачивает её в полную карточку.
   */
  private drawFoeToast(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.toastBtn = null;
    const toast = g.foeToast;
    const tx = toast ? foeText(toast.kind) : null;
    if (!toast || !tx) return;
    const kin = Math.min(1, toast.age / 0.35);
    const kout = clamp((g.foeToastLife - toast.age) / 0.35, 0, 1);
    const k = (1 - Math.pow(1 - kin, 3)) * kout;
    const o = this.hud();
    const w = 490;
    const h = 92;
    const x = 640 - w / 2;
    const y = 80 - (1 - k) * 46;
    this.group(ctx, 0, o.t);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, x + 2, y + 5, w, h, 20);
    ctx.fill();
    this.panel(ctx, x, y, w, h, 20, 'rgba(43,22,8,0.95)');
    roundRect(ctx, x, y, w, h, 20);
    ctx.strokeStyle = 'rgba(255,217,90,0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    this.medallion(ctx, toast.kind, x + 48, y + h / 2, 31);
    const tx0 = x + 94;
    const avail = w - 94 - 50;
    drawText(ctx, t('foe.new').toUpperCase(), tx0, y + 19, { size: 13, color: 'rgba(255,217,90,0.9)', stroke: null });
    let ns = 21;
    while (ns > 15 && measure(ctx, tx.name, ns, 'bold') > avail) ns--;
    drawText(ctx, tx.name, tx0, y + 43, { size: ns, color: PAL.uiLight, strokeWidth: 4 });
    let ss = 16;
    while (ss > 12 && measure(ctx, tx.short, ss, 'normal') > avail) ss--;
    drawText(ctx, tx.short, tx0, y + 69, { size: ss, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.92)' });
    // Кружок «i»: по тапу откроется полная карточка.
    const pulse = 0.5 + 0.5 * Math.sin(g.clock * 4);
    circle(ctx, x + w - 28, y + h / 2, 15);
    ctx.fillStyle = `rgba(255,217,90,${(0.14 + 0.14 * pulse).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = PAL.uiGold;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, 'i', x + w - 28, y + h / 2 + 1, { size: 19, align: 'center', color: PAL.uiGold, strokeWidth: 3 });
    ctx.restore();
    this.toastBtn = { x: x + this.gx, y: y + this.gy, w, h, onTap: () => g.openFoeCard(toast.kind) };
    this.ungroup(ctx);
  }

  /** Развёрнутая карточка нового врага поверх боя: бой стоит, пока её не закроют. */
  private drawFoeCard(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const kind = g.foeCard;
    if (!kind) return;
    const w = 660;
    const L = this.foeLayout(ctx, kind, w - 60);
    if (!L) return;
    this.dim(ctx, 0.6);
    const h = 52 + L.h + 84;
    const x = 640 - w / 2;
    const y = Math.max(16, 360 - h / 2);
    this.panel(ctx, x, y, w, h, 26, 'rgba(43,22,8,0.96)');
    roundRect(ctx, x, y, w, h, 26);
    ctx.strokeStyle = 'rgba(255,217,90,0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawText(ctx, t('foe.new').toUpperCase(), 640, y + 26, { size: 14, align: 'center', color: 'rgba(255,217,90,0.9)', stroke: null });
    this.foeBlock(ctx, kind, x + 30, y + 48, w - 60);
    this.bigButton(ctx, 640, y + h - 42, 220, 52, t('foe.ok'), () => g.closeFoeCard(), '#3c8a2b', 22);
    // Тап мимо кнопки тоже закрывает карточку.
    this.reg(this.overlayButtons, { ...this.viewRect(), onTap: () => g.closeFoeCard() });
  }

  /** Плитка врага в сетке меню «Враги»: медальон и имя; незнакомый — силуэт и вопросы. */
  private foeTile(ctx: CanvasRenderingContext2D, kind: EnemyKind, x: number, y: number, w: number, h: number): void {
    const g = this.g;
    const known = g.hasSeen(kind);
    const on = g.bestiaryPick === kind;
    const hover = g.input.hover;
    const hot = !!hover && hover.x >= x && hover.x <= x + w && hover.y >= y && hover.y <= y + h;
    this.panel(ctx, x, y, w, h, 14, on ? '#3c6a2b' : hot ? 'rgba(70,40,15,0.92)' : PAL.ui);
    if (on) {
      roundRect(ctx, x, y, w, h, 14);
      ctx.strokeStyle = PAL.uiGold;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    this.medallion(ctx, kind, x + w / 2, y + 40, 29, known);
    // Длинные имена через дефис («Термит-подрывник») переносятся по дефису.
    const name = known ? enemyName(kind) : '? ? ?';
    const lines = (measure(ctx, name, 13, 'bold') <= w - 6 ? [name] : wrapText(ctx, name.replace(/-/g, '- '), w - 6, 13, 'bold').map((ln) => ln.replace(/- /g, '-'))).slice(0, 2);
    lines.forEach((ln, i) => drawText(ctx, ln, x + w / 2, y + 86 + (i - (lines.length - 1) / 2) * 14, {
      size: 13, align: 'center', color: known ? PAL.uiLight : 'rgba(246,230,200,0.5)', strokeWidth: 2.5,
    }));
    this.reg(this.overlayButtons, { x, y, w, h, onTap: () => { g.bestiaryPick = kind; } });
  }

  /**
   * Меню «Враги»: слева сетка всех врагов кампании, справа карточка выбранного. Карточка
   * открывается, когда враг впервые выходит на тропу; до того в сетке стоит его силуэт.
   */
  private drawBestiary(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx, 0.74);
    const met = BESTIARY.filter((e) => g.hasSeen(e.kind)).length;
    drawText(ctx, t('bestiary.title'), 640, 34, { size: 36, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
    drawText(ctx, t('bestiary.count', met, BESTIARY.length), 640, 66, { size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.8)' });
    const gx = 24;
    const gy = 88;
    const tw = 98;
    const th = 106;
    const gap = 6;
    BESTIARY.forEach((e, i) => this.foeTile(ctx, e.kind, gx + (i % 6) * (tw + gap), gy + Math.floor(i / 6) * (th + gap), tw, th));
    const px = 658;
    const pw = 598;
    const ph = 5 * th + 4 * gap;
    this.panel(ctx, px, gy, pw, ph, 22, 'rgba(43,22,8,0.92)');
    const kind = g.bestiaryPick;
    const act = actTitle(homeAct(kind));
    if (g.hasSeen(kind)) {
      this.foeBlock(ctx, kind, px + 26, gy + 24, pw - 52);
      drawText(ctx, t('bestiary.where', act), px + pw - 26, gy + ph - 22, { size: 13, align: 'right', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.6)' });
    } else {
      this.medallion(ctx, kind, px + pw / 2, gy + 150, 96, false);
      drawText(ctx, t('bestiary.unknown'), px + pw / 2, gy + 296, { size: 28, align: 'center', color: PAL.uiGold, strokeWidth: 5 });
      wrapText(ctx, t('bestiary.unknownText'), pw - 120, 18).forEach((ln, i) => drawText(ctx, ln, px + pw / 2, gy + 340 + i * 25, {
        size: 18, align: 'center', weight: 'normal', stroke: null,
      }));
      drawText(ctx, t('bestiary.where', act), px + pw / 2, gy + 410, { size: 16, align: 'center', color: PAL.uiLight, strokeWidth: 3 });
    }
    this.bigButton(ctx, 640, 684, 240, 48, t('bestiary.back'), () => g.closeBestiary(), 'rgba(90,60,30,0.9)', 20);
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, t('pause.title'), 640, 300, { size: 54, align: 'center', color: PAL.uiGold, strokeWidth: 8 });
    this.bigButton(ctx, 301, 400, 210, 64, t('pause.resume'), () => g.togglePause(), '#3c8a2b', 22);
    this.bigButton(ctx, 527, 400, 210, 64, t('pause.bestiary'), () => g.toBestiary(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 753, 400, 210, 64, t('pause.settings'), () => g.toSettings(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 979, 400, 210, 64, t('pause.levels'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    drawText(ctx, t('pause.hint'), 640, 470, { size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    this.reg(this.overlayButtons, { ...this.viewRect(), onTap: () => g.togglePause() });
  }
}
