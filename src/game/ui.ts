import { clamp, dist, roundRect, TAU, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, LOGICAL_H, LOGICAL_W, SPELLS, TOWERS, TOWER_ORDER, type SpecDef, type TowerKind } from './config';
import { ACTS, GAME_TITLE, LEVELS, type LevelDef } from './levels';
import { PERKS } from './perks';
import { freeStars, totalStars } from './progress';
import { Path, snapWaypoints } from './path';
import type { Game } from './game';
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
  onTap: () => void;
}

const R_MENU = 92;
const OPT_R = 42;

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

function towerStats(t: Tower): string {
  const s = t.stats;
  const dmg = s.damage ?? [0, 0];
  switch (t.kind) {
    case 'acid': return `Урон ${dmg[0]}–${dmg[1]} · радиус ${s.range} · выстрел каждые ${s.interval} с · бьёт по воздуху`;
    case 'barracks': return `${t.soldiers.length} солдата · здоровье ${s.soldierHp} · урон ${(s.soldierDmg ?? [0, 0])[0]}–${(s.soldierDmg ?? [0, 0])[1]} · возрождение ${s.respawn} с`;
    case 'catapult': return `Урон ${dmg[0]}–${dmg[1]} по площади ${s.splash} · радиус ${s.range} · только по земле`;
    case 'spore': return `Замедление ${Math.round((s.slow ?? 0) * 100)}% · яд ${s.poisonDps}/с · радиус ${s.range} · яд игнорирует панцирь`;
  }
}

/** HUD, радиальное меню, панели и экраны. Кнопки регистрируются при отрисовке и проверяются при тапе. */
export class UI {
  private buttons: Btn[] = [];
  private overlayButtons: Btn[] = [];
  /** Опция постройки под курсором мыши (для превью радиуса на ПК). */
  hoverKind: TowerKind | null = null;
  /** Специализация под курсором или выбранная первым тапом: её описание идёт в панель. */
  hoverSpec: SpecDef | null = null;
  private hoverSpecPending = false;
  /** Заклинание под курсором или выбранное: его описание идёт в панель. */
  hoverSpell: number | null = null;
  /** Курсор над кнопкой режима цели: её описание идёт в панель. */
  private hoverTarget = false;
  private miniPaths = new Map<string, Path[]>();

  constructor(private readonly g: Game) {}

  private static hit(b: Btn, p: Vec): boolean {
    if (b.round) return dist(p.x, p.y, b.x, b.y) <= b.w / 2;
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  tap(p: Vec): boolean {
    for (const b of this.buttons) {
      if (UI.hit(b, p)) { b.onTap(); return true; }
    }
    return false;
  }

  tapOverlay(p: Vec): boolean {
    for (const b of this.overlayButtons) {
      if (UI.hit(b, p)) { b.onTap(); return true; }
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
      default: this.drawEnd(ctx); break;
    }
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
    this.buttons.push({ x, y, w: r * 2, h: r * 2, round: true, onTap });
  }

  private bigButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, label: string, onTap: () => void, fill = '#3c8a2b', size = 26): void {
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 18);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawText(ctx, label, cx, cy, { size, align: 'center' });
    this.overlayButtons.push({ x: cx - w / 2, y: cy - h / 2, w, h, onTap });
  }

  private dim(ctx: CanvasRenderingContext2D, a = 0.6): void {
    ctx.fillStyle = `rgba(12,7,2,${a})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
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
    this.panel(ctx, 14, 12, 440, 58);
    drawHoney(ctx, 46, 42, 13);
    drawText(ctx, String(g.gold), 68, 42, { size: 26, color: PAL.uiGold });
    // Плотнее, чтобы «Волна 12/16» не упиралась в край панели.
    drawLarva(ctx, 168, 42, 11);
    drawText(ctx, String(g.lives), 192, 42, { size: 26 });
    drawFlagIcon(ctx, 258, 42, 28, PAL.flag);
    drawText(ctx, `Волна ${g.waves.index}/${g.waves.total}`, 280, 42, { size: 20 });

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
    this.buttons.push({ x: 14, y: 12, w: 440, h: 58, onTap: () => {} });
  }

  /** Хотбар заклинаний: три кнопки с перезарядкой; тап выбирает, следующий тап по полю применяет. */
  private drawHotbar(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const book = g.world.spells;
    const x = 14;
    const y = 622;
    const w = 300;
    const hh = 84;
    this.panel(ctx, x, y, w, hh, 18);
    const hover = g.input.hover;
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
      this.buttons.push({ x: bx, y: by, w: br * 2, h: br * 2, round: true, onTap: () => g.armSpell(i) });
    }
    this.hoverSpell = g.armedSpell ?? hovered;
    if (g.armedSpell !== null) {
      drawText(ctx, 'Выбери точку на поле', x + w / 2, y - 14, { size: 15, align: 'center', color: PAL.uiGold });
    }
    this.buttons.push({ x, y, w, h: hh, onTap: () => {} });
  }

  private drawWaveButton(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const w = g.waves;
    // Общий режим цели башен: кнопка с прицелом слева от кнопки волны, тап листает по кругу.
    const td = g.targetDef;
    const hover = g.input.hover;
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
      const label = w.index === 0 ? 'В бой!' : 'Следующая волна';
      drawText(ctx, label, x + bw / 2, y + 23, { size: 22, align: 'center' });
      const secs = Math.ceil(w.countdown ?? 0);
      drawText(ctx, `через ${secs} с`, x + 68, y + 51, { size: 17, align: 'center', weight: 'normal', stroke: null, color: 'rgba(255,255,255,0.85)' });
      if (w.bonus > 0) {
        drawHoney(ctx, x + 146, y + 51, 8);
        drawText(ctx, `+${w.bonus}`, x + 160, y + 51, { size: 18, color: PAL.uiGold });
      }
      this.buttons.push({ x, y, w: bw, h: bh, onTap: () => g.callWave() });
    } else if (w.index < w.total) {
      this.panel(ctx, x, y, bw, bh, 18);
      drawText(ctx, `Волна ${w.index} идёт`, x + bw / 2, y + 36, { size: 20, align: 'center', color: 'rgba(246,230,200,0.8)' });
    } else {
      this.panel(ctx, x, y, bw, bh, 18);
      drawText(ctx, 'Последняя волна!', x + bw / 2, y + 36, { size: 20, align: 'center', color: PAL.uiGold });
    }
  }

  private drawInfo(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const sel = g.selected;
    let title = '';
    let desc = '';
    if (this.hoverKind) {
      const d = TOWERS[this.hoverKind];
      title = `${d.name} · ${d.levels[0].cost}`;
      desc = d.desc;
    } else if (this.hoverSpec) {
      title = `${this.hoverSpec.name} · ${this.hoverSpec.cost}`;
      desc = this.hoverSpec.desc + (this.hoverSpecPending ? ' Нажми ещё раз, чтобы выбрать.' : '');
    } else if (sel?.type === 'tower') {
      title = `${sel.tower.displayName} · уровень ${sel.tower.level}${sel.tower.building ? ' · строится' : ''}`;
      desc = towerStats(sel.tower);
    } else if (this.hoverTarget) {
      const d = g.targetDef;
      title = `Цель башен: ${d.name.toLowerCase()}`;
      desc = `${d.desc} Тап листает режимы для всех башен.`;
    } else if (this.hoverSpell !== null) {
      const d = SPELLS[this.hoverSpell];
      const cd = g.world.spells.cooldowns[this.hoverSpell];
      const state = cd > 0 ? ` · перезарядка ${Math.ceil(cd)} с` : g.armedSpell === this.hoverSpell ? ' · выбери точку на поле' : ` · ${d.key}`;
      title = `${d.name}${state}`;
      desc = d.desc;
    } else if (sel?.type === 'plot') {
      title = 'Свободная клетка';
      desc = 'Выбери, что построить. Солдаты держат врага, стрелки и споры достают летающих.';
    } else {
      return;
    }
    // Текст ужимается по ширине панели, а не вылезает за неё.
    const pw = 650;
    const avail = pw - 32;
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
    else if (dirX > 0 && ox + OPT_R + 12 + tw < LOGICAL_W - 6) drawText(ctx, caption, ox + OPT_R + 10, oy, { ...capOpts, align: 'left' });
    else if (dirX < 0 && ox - OPT_R - 12 - tw > 6) drawText(ctx, caption, ox - OPT_R - 10, oy, { ...capOpts, align: 'right' });
    else drawText(ctx, caption, ox, oy + OPT_R + 15, { ...capOpts, align: 'center' });

    this.buttons.push({ x: ox, y: oy, w: OPT_R * 2, h: OPT_R * 2, round: true, onTap });
    return hot;
  }

  private drawSelection(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const sel = g.selected;
    if (!sel) return;
    const cx = sel.type === 'plot' ? sel.plot.x : sel.tower.x;
    const cy = sel.type === 'plot' ? sel.plot.y : sel.tower.y;
    const mcx = clamp(cx, 50 + R_MENU, LOGICAL_W - 50 - R_MENU);
    const mcy = clamp(cy, 110 + R_MENU, LOGICAL_H - 70 - R_MENU);

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
          String(cost), can ? PAL.uiGold : PAL.uiRed, def.short,
          () => g.build(kind, sel.plot),
        );
        if (hot) this.hoverKind = kind;
      });
      return;
    }

    const t = sel.tower;
    if (t.canSpecialize) {
      // Развилка 4-го уровня: две специализации слева и справа сверху.
      const D = Math.round(R_MENU * 0.8);
      t.def.specs.forEach((sp, i) => {
        const ox = mcx + (i === 0 ? -D : D);
        const oy = mcy - D;
        const can = g.gold >= sp.cost;
        const pending = g.pendingSpec === i;
        const hot = this.option(
          ctx, ox, oy, i === 0 ? -1 : 1, -1, can,
          () => drawTowerIcon(ctx, t.kind, ox, oy - 10, 0.44, 4, i + 1),
          String(sp.cost), can ? PAL.uiGold : PAL.uiRed, sp.short,
          () => g.chooseSpec(t, i), pending,
        );
        if (hot || (pending && !this.hoverSpec)) {
          this.hoverSpec = sp;
          this.hoverSpecPending = pending && !hot;
        }
      });
    } else {
      const up = t.upgradeCost;
      const canUp = up !== null && g.gold >= up;
      const ux = mcx;
      const uy = mcy - R_MENU;
      this.option(ctx, ux, uy, 0, -1, up !== null, () => {
        if (up === null) {
          if (t.building) drawText(ctx, 'СТРОИМ', ux, uy - 8, { size: 13, align: 'center', color: PAL.uiGold });
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
      up === null ? 'Макс. уровень' : `Улучшить до ${t.level + 1}`, () => g.upgradeTower(t));
    }

    const sx = mcx;
    const sy = mcy + R_MENU;
    this.option(ctx, sx, sy, 0, 1, true, () => drawHoney(ctx, sx, sy - 8, 12),
      `+${t.sellValue}`, PAL.uiGold, 'Продать', () => g.sellTower(t));
  }

  // ───────────── экраны ─────────────

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    // Фон-диорама уже нарисован игрой; здесь заголовок на табличке и кнопка внизу.
    drawText(ctx, GAME_TITLE, 640, 100, { size: 60, align: 'center', color: PAL.uiGold, strokeWidth: 10 });
    drawText(ctx, 'Tower defense про оборону муравейника', 640, 158, { size: 20, align: 'center', weight: 'normal', color: '#f6e6c8', strokeWidth: 5 });
    this.bigButton(ctx, 640, 630, 300, 74, 'Играть', () => g.toLevels(), '#3c8a2b', 30);
    drawText(ctx, 'Управление мышью и пальцем', 640, 698, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
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
    const beatenLabel = beaten ? ` · ${DIFFICULTIES.find((d) => d.id === beaten)?.name.toLowerCase() ?? ''}` : '';
    drawText(ctx, `Уровень ${i + 1}${beatenLabel}`, x + 16, y + 132, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    for (let s = 0; s < 3; s++) drawStar(ctx, x + w - 86 + s * 30, y + 134, 11, s < stars);
    const nameLines = wrapText(ctx, lv.name, w - 32, 18, 'bold');
    nameLines.slice(0, 2).forEach((l, k) => drawText(ctx, l, x + 16, y + 156 + k * 22, { size: 18, color: PAL.uiGold }));
    if (unlocked) {
      roundRect(ctx, x + 16, y + h - 48, w - 32, 36, 10);
      ctx.fillStyle = '#3c8a2b';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, stars > 0 ? 'Играть снова' : 'Играть', x + w / 2, y + h - 30, { size: 17, align: 'center' });
      this.overlayButtons.push({ x, y, w, h, onTap: () => g.chooseLevel(i) });
    } else {
      roundRect(ctx, x, y, w, h, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      this.drawLock(ctx, x + w / 2, y + h / 2 - 22, 18);
      drawText(ctx, 'Пройди предыдущий уровень', x + w / 2, y + h / 2 + 22, { size: 14, align: 'center', weight: 'normal', stroke: null });
    }
  }

  private drawLevels(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, GAME_TITLE, 640, 34, { size: 30, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    const cw = 300;
    const ch = 236;
    const gap = 30;
    ACTS.forEach((act, a) => {
      const y0 = 76 + a * 290;
      const n = act.to - act.from + 1;
      const total = n * cw + (n - 1) * gap;
      const x0 = (LOGICAL_W - total) / 2;
      drawText(ctx, act.title, x0 + 4, y0, { size: 15, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.85)' });
      for (let k = 0; k < n; k++) {
        this.levelCard(ctx, LEVELS[act.from + k], act.from + k, x0 + k * (cw + gap), y0 + 14, cw, ch);
      }
    });
    const free = freeStars(g.progress);
    this.bigButton(ctx, 640, 680, 330, 44, `Улучшения колонии · ${free} ★`, () => g.toPerks(), free > 0 ? '#3c8a2b' : 'rgba(90,60,30,0.9)', 18);
    drawText(ctx, `Сложность: ${g.difficulty.name.toLowerCase()} (меняется перед уровнем)`, 300, 680, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    const label = g.resetArmed ? 'Точно сбросить? Ещё раз' : 'Сбросить прогресс';
    drawText(ctx, label, 980, 680, { size: 14, align: 'center', weight: 'normal', stroke: null, color: g.resetArmed ? PAL.uiRed : 'rgba(246,230,200,0.55)' });
    this.overlayButtons.push({ x: 860, y: 662, w: 240, h: 36, onTap: () => g.resetProgressTap() });
  }

  /** Перки за звёзды: восемь улучшений в два столбца. */
  private drawPerks(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    const free = freeStars(g.progress);
    const total = totalStars(g.progress);
    drawText(ctx, 'Улучшения колонии', 640, 46, { size: 34, align: 'center', color: PAL.uiGold, strokeWidth: 6 });
    drawText(ctx, `Свободных звёзд: ${free} из ${total}. Звёзды дают победы на уровнях, улучшения действуют везде.`, 640, 84, {
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
      drawText(ctx, p.name, x + 18, y + 24, { size: 19, color: PAL.uiGold });
      drawText(ctx, p.desc(Math.max(1, rank)), x + 18, y + 50, { size: 14, weight: 'normal', stroke: null });
      if (!maxed) {
        drawText(ctx, `Следующий ранг: ${p.desc(rank + 1)}`, x + 18, y + 72, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.65)' });
      } else {
        drawText(ctx, 'Максимальный ранг', x + 18, y + 72, { size: 13, weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.65)' });
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
      drawText(ctx, maxed ? 'Макс.' : `+1 за ${p.cost} ★`, bx + 54, by + 21, { size: 16, align: 'center', color: can || maxed ? PAL.uiLight : 'rgba(246,230,200,0.5)' });
      if (can) this.overlayButtons.push({ x: bx, y: by, w: 108, h: 42, onTap: () => g.buyPerk(p.id) });
    });
    this.bigButton(ctx, 540, 600, 220, 56, 'К уровням', () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 790, 600, 260, 56, 'Вернуть все звёзды', () => g.refundPerks(), 'rgba(90,60,30,0.9)', 20);
    drawText(ctx, 'Звёзды возвращаются без потерь: пробуй разные наборы под разные уровни.', 640, 656, {
      size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.6)',
    });
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const lv = g.level;
    this.dim(ctx);
    this.panel(ctx, 240, 80, 800, 570, 26);
    drawText(ctx, `Уровень ${g.levelIndex + 1}`, 640, 120, { size: 18, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    drawText(ctx, lv.name, 640, 160, { size: 40, align: 'center', color: PAL.uiGold, strokeWidth: 7 });
    const lines = wrapText(ctx, lv.story, 700, 19);
    lines.forEach((l, i) => drawText(ctx, l, 640, 216 + i * 27, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    drawText(ctx, `${lv.waves.length} волн · ${lv.paths.length === 1 ? 'одна тропа' : `${lv.paths.length} тропы`} · ${g.world.plots.length} клеток под застройку · ${g.world.startLives} личинок`, 640, 380, {
      size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)',
    });
    // Сложность: три кнопки, выбор запоминается между уровнями.
    const cur = g.difficulty;
    drawText(ctx, 'Сложность', 640, 416, { size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
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
      drawText(ctx, d.name, x + bw / 2, 432 + bh / 2, { size: 18, align: 'center', color: on ? PAL.uiLight : 'rgba(246,230,200,0.7)' });
      this.overlayButtons.push({ x, y: 432, w: bw, h: bh, onTap: () => g.setDifficulty(d.id) });
    });
    drawText(ctx, cur.desc, 640, 494, { size: 14, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.75)' });
    this.bigButton(ctx, 700, 544, 260, 60, 'В бой!', () => g.start());
    this.bigButton(ctx, 450, 544, 200, 60, 'К уровням', () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    drawText(ctx, 'Тап по свободной клетке строит башню. Заклинания внизу слева: тап по кнопке, потом по точке на поле.', 640, 606, {
      size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)',
    });
    drawText(ctx, 'Q, W, E: заклинания. Пробел: пауза. N: следующая волна. Esc или правая кнопка: отмена.', 640, 628, {
      size: 15, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)',
    });
  }

  private drawEnd(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    const won = g.state === 'won';
    this.dim(ctx);
    this.panel(ctx, 320, 150, 640, 420, 26);
    drawText(ctx, won ? 'Муравейник выстоял!' : 'Муравейник пал...', 640, 210, { size: 40, align: 'center', color: won ? PAL.uiGold : PAL.uiRed, strokeWidth: 7 });
    if (won) {
      for (let s = 0; s < 3; s++) {
        const filled = s < g.earnedStars;
        const bounce = filled ? Math.sin(g.clock * 3 + s) * 3 : 0;
        drawStar(ctx, 640 - 70 + s * 70, 290 + bounce, 28, filled);
      }
    }
    const finale = !won ? ''
      : g.levelIndex === 2 ? ' Акт 1 завершён: утром колония сама выступает в поход на термитник.'
        : g.levelIndex === LEVELS.length - 1 ? ' Термитник пал, королева мертва. Поход окончен, колония возвращается домой с победой.'
          : '';
    const diff = `Сложность: ${g.difficulty.name.toLowerCase()}.`;
    const sub = won
      ? `Все ${g.waves.total} волн отбиты, личинок уцелело ${g.lives} из ${g.world.startLives}. ${diff}${finale}`
      : `Продержались волн: ${g.waves.index} из ${g.waves.total}. ${diff} Попробуй казарму на развилке и не копи заклинания${g.difficulty.id !== 'easy' ? ', или выбери сложность полегче' : ''}.`;
    const lines = wrapText(ctx, sub, 560, 19);
    lines.forEach((l, i) => drawText(ctx, l, 640, (won ? 350 : 290) + i * 26, { size: 19, align: 'center', weight: 'normal', stroke: null }));
    this.bigButton(ctx, 520, 500, 220, 64, 'К уровням', () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    this.bigButton(ctx, 770, 500, 220, 64, 'Ещё раз', () => g.start());
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    const g = this.g;
    this.dim(ctx);
    drawText(ctx, 'Пауза', 640, 300, { size: 54, align: 'center', color: PAL.uiGold, strokeWidth: 8 });
    this.bigButton(ctx, 540, 400, 220, 64, 'Продолжить', () => g.togglePause(), '#3c8a2b', 22);
    this.bigButton(ctx, 790, 400, 220, 64, 'К уровням', () => g.toLevels(), 'rgba(90,60,30,0.9)', 22);
    drawText(ctx, 'Тап мимо кнопок или Пробел тоже продолжают игру', 640, 470, { size: 16, align: 'center', weight: 'normal', stroke: null, color: 'rgba(246,230,200,0.7)' });
    this.overlayButtons.push({ x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H, onTap: () => g.togglePause() });
  }
}
