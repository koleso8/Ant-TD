import { clamp, dist, roundRect, TAU, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, LOGICAL_H, LOGICAL_W, SPELLS, TOWERS, TOWER_ORDER, type SpecDef, type TowerKind } from './config';
import { ACTS, GAME_TITLE, LEVELS, type LevelDef } from './levels';
import { PERKS } from './perks';
import { freeStars, totalStars } from './progress';
import { actTitle, difficultyText, gameTitle, getLang, LANGS, levelText, perkText, spellText, t, targetText, towerText } from './i18n';
import { Path, snapWaypoints } from './path';
import type { Game } from './game';
import { canInstall, fullscreenSupported, isInstalledApp, manualInstall, promptInstall } from '../engine/device';
import type { Tower } from './tower';
import { PAL } from '../render/palette';
import { drawText, measure, wrapText } from '../render/text';
import {
  circle, drawAcidGlob, drawFlagIcon, drawHero, drawHoney, drawLarva, drawSporeCloud, drawStar, drawTowerIcon, ell, outline, pennant, twig,
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
  /** Курсор над кнопкой режима цели: её описание идёт в панель. */
  private hoverTarget = false;
  private miniPaths = new Map<string, Path[]>();
  /** Сдвиг текущей группы интерфейса: угловые блоки прижимаются к краям экрана. */
  private gx = 0;
  private gy = 0;

  constructor(private readonly g: Game) {}

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
    const g = this.g;
    switch (g.state) {
      case 'playing':
        this.drawSelection(ctx);
        this.drawHud(ctx);
        this.drawWaveButton(ctx);
        this.drawHotbar(ctx);
        this.drawInfo(ctx);
        if (g.paused) this.drawPause(ctx);
        break;
      case 'title': this.drawTitle(ctx); break;
      case 'levels': this.drawLevels(ctx); break;
      case 'perks': this.drawPerks(ctx); break;
      case 'intro': this.drawIntro(ctx); break;
      case 'settings': this.drawSettings(ctx); break;
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
    drawText(ctx, t('hud.wave', g.waves.index, g.waves.total), 280, 42, { size: 20 });
    this.reg(this.buttons, { x: 14, y: 12, w: 440, h: 58, onTap: () => {} });
    this.ungroup(ctx);

    this.group(ctx, o.r, o.t);
    this.roundBtn(ctx, 1166, 42, 30, () => {
      drawText(ctx, `x${g.speed}`, 1166, 42, { size: 22, color: g.speed === 2 ? PAL.uiGreen : PAL.uiLight, align: 'center' });
    }, () => g.toggleSpeed());

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
      drawText(ctx, td.short, 975, 684, { size: 11, align: 'center', color: PAL.uiGold, stroke: null });
    }, () => g.cycleTargetMode(), this.hoverTarget);
    const x = 1030;
    const y = 632;
    const bw = 234;
    const bh = 72;
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
    if (this.hoverKind) {
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
    const cx = sel.type === 'plot' ? sel.plot.x : sel.tower.x;
    const cy = sel.type === 'plot' ? sel.plot.y : sel.tower.y;
    const v = g.screen.view;
    const mcx = clamp(cx, v.x0 + 50 + R_MENU, v.x1 - 50 - R_MENU);
    const mcy = clamp(cy, this.hud().t + 110 + R_MENU, v.y1 - 70 - R_MENU);

    if (sel.type === 'tower') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ell(ctx, cx, cy, 42, 30);
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
    this.bigButton(ctx, 640, 630, 300, 74, t('title.play'), () => g.toLevels(), '#3c8a2b', 30);
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
    const s = Math.min(w / LOGICAL_W, h / LOGICAL_H);
    const ox = x + (w - LOGICAL_W * s) / 2;
    const oy = y + (h - LOGICAL_H * s) / 2;
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
      ctx.fillStyle = '#4f8fc0';
      ctx.fillRect(-20, lv.theme.water.y, LOGICAL_W + 40, lv.theme.water.h);
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

  private levelCard(ctx: CanvasRenderingContext2D, lv: LevelDef, i: number, x: number, y: number, w: number, h: number): void {
    const g = this.g;
    const unlocked = g.isUnlocked(i);
    const stars = g.starsFor(i);
    this.panel(ctx, x, y, w, h, 18);
    this.miniMap(ctx, lv, x + 12, y + 12, w - 24, 104);
    const beaten = g.progress.beaten[lv.id];
    const beatenLabel = beaten ? ` · ${difficultyText(beaten).name.toLowerCase()}` : '';
    drawText(ctx, `${t('levels.level', i + 1)}${beatenLabel}`, x + 16, y + 132, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    for (let s = 0; s < 3; s++) drawStar(ctx, x + w - 86 + s * 30, y + 134, 11, s < stars);
    const nameLines = wrapText(ctx, levelText(lv.id).name, w - 32, 18, 'bold');
    nameLines.slice(0, 2).forEach((l, k) => drawText(ctx, l, x + 16, y + 156 + k * 22, { size: 18, color: PAL.uiGold }));
    if (unlocked) {
      roundRect(ctx, x + 16, y + h - 48, w - 32, 36, 10);
      ctx.fillStyle = '#3c8a2b';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, stars > 0 ? t('levels.replay') : t('levels.play'), x + w / 2, y + h - 30, { size: 17, align: 'center' });
      this.reg(this.overlayButtons, { x, y, w, h, onTap: () => g.chooseLevel(i) });
    } else {
      roundRect(ctx, x, y, w, h, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      this.drawLock(ctx, x + w / 2, y + h / 2 - 22, 18);
      drawText(ctx, t('levels.locked'), x + w / 2, y + h / 2 + 22, { size: 14, align: 'center', weight: 'normal', stroke: null });
    }
  }

  private drawLevels(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, gameTitle(), 640, 34, { size: 30, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    const cw = 300;
    const ch = 236;
    const gap = 30;
    ACTS.forEach((act, a) => {
      const y0 = 76 + a * 290;
      const n = act.to - act.from + 1;
      const total = n * cw + (n - 1) * gap;
      const x0 = (LOGICAL_W - total) / 2;
      drawText(ctx, actTitle(a), x0 + 4, y0, { size: 15, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.85)' });
      for (let k = 0; k < n; k++) {
        this.levelCard(ctx, LEVELS[act.from + k], act.from + k, x0 + k * (cw + gap), y0 + 14, cw, ch);
      }
    });
    const free = freeStars(g.progress);
    this.bigButton(ctx, 640, 680, 330, 44, t('levels.perks', free), () => g.toPerks(), free > 0 ? '#3c8a2b' : 'rgba(90,60,30,0.9)', 18);
    this.bigButton(ctx, 1150, 34, 180, 40, t('levels.settings'), () => g.toSettings(), 'rgba(90,60,30,0.9)', 16);
    drawText(ctx, t('levels.difficulty', difficultyText(g.difficulty.id).name.toLowerCase()), 300, 680, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    const label = g.resetArmed ? t('levels.resetConfirm') : t('levels.reset');
    drawText(ctx, label, 980, 680, { size: 14, align: 'center', weight: 'normal', stroke: null, color: g.resetArmed ? PAL.uiRed : 'rgba(246,230,200,0.55)' });
    this.reg(this.overlayButtons, { x: 860, y: 662, w: 240, h: 36, onTap: () => g.resetProgressTap() });
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
    this.dim(ctx);
    this.panel(ctx, 240, 80, 800, 570, 26);
    const lx = levelText(lv.id);
    drawText(ctx, t('intro.level', g.levelIndex + 1), 640, 120, { size: 18, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    drawText(ctx, lx.name, 640, 160, { size: 40, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
    const lines = wrapText(ctx, lx.story, 700, 19);
    lines.forEach((l, i) => drawText(ctx, l, 640, 216 + i * 27, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    drawText(ctx, t('intro.stats', lv.waves.length, lv.paths.length === 1 ? t('intro.onePath') : t('intro.paths', lv.paths.length), g.world.plots.length, g.world.startLives), 640, 380, {
      size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)',
    });
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
    drawText(ctx, difficultyText(cur.id).desc, 640, 494, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
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
    this.dim(ctx);
    this.panel(ctx, 320, 150, 640, 420, 26);
    drawText(ctx, won ? t('end.won') : t('end.lost'), 640, 210, { size: 40, align: 'center', color: won ? PAL.uiGold : PAL.uiRed, strokeWidth: 7 });
    if (won) {
      for (let s = 0; s < 3; s++) {
        const filled = s < g.earnedStars;
        const bounce = filled ? Math.sin(g.clock * 3 + s) * 3 : 0;
        drawStar(ctx, 640 - 70 + s * 70, 290 + bounce, 28, filled);
      }
    }
    const finale = !won ? '' : g.levelIndex === 2 ? t('end.finaleAct1') : g.levelIndex === LEVELS.length - 1 ? t('end.finaleAll') : '';
    const diff = t('end.difficulty', difficultyText(g.difficulty.id).name.toLowerCase());
    const sub = won
      ? t('end.wonText', g.waves.total, g.lives, g.world.startLives, diff, finale)
      : t('end.lostText', g.waves.index, g.waves.total, diff, g.difficulty.id !== 'easy' ? t('end.easier') : '');
    const lines = wrapText(ctx, sub, 560, 19);
    lines.forEach((l, i) => drawText(ctx, l, 640, (won ? 350 : 290) + i * 26, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    this.bigButton(ctx, 520, 500, 220, 64, t('end.back'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 770, 500, 220, 64, t('end.again'), () => g.start());
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, t('pause.title'), 640, 300, { size: 54, align: 'center', color: PAL.uiGold, strokeWidth: 8 });
    this.bigButton(ctx, 400, 400, 220, 64, t('pause.resume'), () => g.togglePause(), '#3c8a2b', 22);
    this.bigButton(ctx, 640, 400, 220, 64, t('pause.settings'), () => g.toSettings(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 880, 400, 220, 64, t('pause.levels'), () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    drawText(ctx, t('pause.hint'), 640, 470, { size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    this.reg(this.overlayButtons, { ...this.viewRect(), onTap: () => g.togglePause() });
  }
}
