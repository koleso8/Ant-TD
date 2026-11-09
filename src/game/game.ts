import type { Screen } from '../engine/canvas';
import type { Input } from '../engine/input';
import { Rng } from '../engine/rng';
import { dist, roundRect, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, ENEMIES, LOGICAL_H, LOGICAL_W, SPELLS, TARGET_MODES, TOWERS, type DifficultyDef, type DifficultyId, type EnemyKind, type TargetModeDef, type TowerKind } from './config';
import { LEVELS, type LevelDef } from './levels';
import { defaultProgress, difficultyRank, freeStars, loadProgress, saveProgress, type Progress } from './progress';
import { PERKS, perksFromRanks, type Perks } from './perks';
import { World } from './world';
import type { Plot } from './types';
import type { Tower } from './tower';
import { UI } from './ui';
import { PAL } from '../render/palette';
import { drawText } from '../render/text';
import {
  ANT_WORKER, circle, drawAnt, drawHammer, drawHardHat, drawLadder, drawRange, drawShadow, drawSporeCloud, drawTerrain, ell, pennant, twig,
} from '../render/art';
import type { Builder, Construction } from './construction';
import { installSprites } from '../render/sprites';
import { drawSplash, drawSplashSign } from '../render/splash';
import splashUrl from '../assets/sprites/splash.webp';

export type GameState = 'title' | 'levels' | 'perks' | 'intro' | 'playing' | 'won' | 'lost';
export type Selection =
  | { type: 'plot'; plot: Plot }
  | { type: 'tower'; tower: Tower }
  | null;

interface Ambient { cx: number; cy: number; rx: number; ry: number; speed: number; phase: number }

/** Клавиши заклинаний на ПК: латиница и та же кнопка в русской раскладке. */
const SPELL_KEYS: readonly (readonly string[])[] = [['q', 'Q', 'й', 'Й'], ['w', 'W', 'ц', 'Ц'], ['e', 'E', 'у', 'У']];

/** Экраны, ввод, отрисовка и прогресс поверх ядра World. */
export class Game {
  state: GameState = 'title';
  speed: 1 | 2 = 1;
  paused = false;
  /** Часы для анимаций интерфейса и фона (идут всегда). */
  clock = 0;

  world: World;
  levelIndex = 0;
  selected: Selection = null;
  /** Специализация, выбранная первым тапом: второй тап подтверждает. */
  pendingSpec: number | null = null;
  /** Заклинание, выбранное в хотбаре: следующий тап по полю применит его. */
  armedSpell: number | null = null;
  /** Дев-клавиша Y: какой вид врага выйдет следующим. */
  private devSpawnIdx = 0;
  hurtFlash = 0;
  readonly ui: UI;

  progress: Progress = loadProgress();
  /** Звёзды за только что пройденный уровень. */
  earnedStars = 0;
  /** Первый тап по «Сбросить прогресс» только предупреждает. */
  resetArmed = false;

  private bg: { canvas: HTMLCanvasElement; k: number } | null = null;
  /** Заставка главного меню, печётся один раз; перепекается, когда догрузится картина. */
  private splash: { canvas: HTMLCanvasElement; k: number } | null = null;
  private readonly splashImg = new Image();
  private ambient: Ambient[] = [];
  /** Светлячки ночных уровней. */
  private fireflies: { x: number; y: number; r: number; speed: number; phase: number }[] = [];

  constructor(readonly screen: Screen, readonly input: Input) {
    installSprites();
    this.splashImg.onload = () => { this.splash = null; };
    this.splashImg.src = splashUrl;
    this.world = this.makeWorld(LEVELS[0]);
    this.ui = new UI(this);
    input.onTap = (p) => this.onTap(p);
    input.onSecondaryTap = () => this.onSecondaryTap();
    input.onKey = (k) => this.onKey(k);
    this.loadLevel(0);
  }

  // ───────────── доступ к ядру ─────────────

  get level(): LevelDef { return this.world.level; }
  get gold(): number { return this.world.gold; }
  get lives(): number { return this.world.lives; }
  get waves() { return this.world.waves; }
  get hero() { return this.world.hero; }
  get towers() { return this.world.towers; }
  get enemies() { return this.world.enemies; }
  get plots() { return this.world.plots; }
  get effects() { return this.world.effects; }
  get time(): number { return this.world.time; }
  get perks(): Perks { return perksFromRanks(this.progress.perks); }
  get difficulty(): DifficultyDef { return DIFFICULTIES.find((d) => d.id === this.progress.difficulty) ?? DIFFICULTIES[1]; }

  /** Сложность выбирается на экране перед уровнем и запоминается между уровнями. */
  setDifficulty(id: DifficultyId): void {
    if (this.progress.difficulty === id) return;
    this.progress.difficulty = id;
    saveProgress(this.progress);
    this.world = this.makeWorld(this.level);
    this.resetView();
  }

  private makeWorld(level: LevelDef): World {
    const w = new World(level, this.perks, this.difficulty);
    w.targetMode = this.progress.targetMode;
    w.onLivesLost = () => { this.hurtFlash = 0.7; };
    return w;
  }

  // ───────────── уровни и прогресс ─────────────

  isUnlocked(i: number): boolean {
    if (i === 0) return true;
    if (import.meta.env.DEV) return true;
    const prev = LEVELS[i - 1];
    return (this.progress.stars[prev.id] ?? 0) > 0;
  }

  starsFor(i: number): number {
    return this.progress.stars[LEVELS[i].id] ?? 0;
  }

  loadLevel(i: number): void {
    this.levelIndex = i;
    this.world = this.makeWorld(LEVELS[i]);
    this.bg = null;
    const a = this.level.anthill;
    this.ambient = [
      { cx: a.x - 30, cy: a.y + 42, rx: 60, ry: 16, speed: 0.9, phase: 0 },
      { cx: a.x + 30, cy: a.y + 36, rx: 48, ry: 13, speed: -1.1, phase: 2 },
      { cx: a.x - 55, cy: a.y + 26, rx: 34, ry: 10, speed: 1.4, phase: 4 },
    ];
    this.fireflies = [];
    if (this.level.theme.night) {
      const rng = new Rng(this.level.seed + 1);
      for (let k = 0; k < 18; k++) {
        this.fireflies.push({ x: rng.range(40, LOGICAL_W - 40), y: rng.range(100, LOGICAL_H - 60), r: rng.range(18, 40), speed: rng.range(0.4, 0.9), phase: rng.range(0, 6.28) });
      }
    }
    this.resetView();
  }

  private resetView(): void {
    this.speed = 1;
    this.paused = false;
    this.selected = null;
    this.pendingSpec = null;
    this.armedSpell = null;
    this.hurtFlash = 0;
  }

  /** Начать текущий уровень заново. */
  reset(): void {
    this.world = this.makeWorld(this.level);
    this.resetView();
  }

  chooseLevel(i: number): void {
    if (!this.isUnlocked(i)) return;
    this.loadLevel(i);
    this.state = 'intro';
  }

  toLevels(): void {
    this.state = 'levels';
    this.paused = false;
    this.resetArmed = false;
  }

  toPerks(): void {
    this.state = 'perks';
  }

  start(): void {
    this.reset();
    this.state = 'playing';
  }

  resetProgressTap(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      return;
    }
    this.progress = defaultProgress();
    saveProgress(this.progress);
    this.resetArmed = false;
  }

  buyPerk(id: string): boolean {
    const def = PERKS.find((p) => p.id === id);
    if (!def) return false;
    const rank = this.progress.perks[id] ?? 0;
    if (rank >= def.maxRank || freeStars(this.progress) < def.cost) return false;
    this.progress.perks[id] = rank + 1;
    saveProgress(this.progress);
    return true;
  }

  refundPerks(): void {
    this.progress.perks = {};
    saveProgress(this.progress);
  }

  private onWin(): void {
    this.state = 'won';
    this.selected = null;
    const frac = this.lives / Math.max(1, this.world.startLives);
    this.earnedStars = frac >= 0.9 ? 3 : frac >= 0.5 ? 2 : 1;
    const id = this.level.id;
    this.progress.stars[id] = Math.max(this.progress.stars[id] ?? 0, this.earnedStars);
    if (difficultyRank(this.difficulty.id) > difficultyRank(this.progress.beaten[id])) this.progress.beaten[id] = this.difficulty.id;
    saveProgress(this.progress);
  }

  // ───────────── действия игрока ─────────────

  build(kind: TowerKind, plot: Plot): void {
    if (this.world.build(kind, plot)) this.selected = null;
  }

  upgradeTower(t: Tower): void {
    this.world.upgrade(t);
  }

  /** Первый тап показывает описание, второй по той же опции строит. */
  chooseSpec(t: Tower, i: number): void {
    if (!t.canSpecialize) return;
    if (this.pendingSpec !== i) {
      this.pendingSpec = i;
      return;
    }
    if (this.world.specialize(t, i)) this.pendingSpec = null;
  }

  get targetDef(): TargetModeDef {
    return TARGET_MODES.find((m) => m.id === this.world.targetMode) ?? TARGET_MODES[0];
  }

  /** Кнопка с прицелом в верхней панели: следующий режим цели для всех башен, выбор запоминается. */
  cycleTargetMode(): void {
    const i = TARGET_MODES.findIndex((m) => m.id === this.world.targetMode);
    const next = TARGET_MODES[(i + 1) % TARGET_MODES.length];
    this.world.targetMode = next.id;
    this.progress.targetMode = next.id;
    saveProgress(this.progress);
    this.effects.text(`Цель башен: ${next.name.toLowerCase()}`, 975, 618, PAL.uiGold, 18);
  }

  sellTower(t: Tower): void {
    this.world.sell(t);
    this.selected = null;
  }

  callWave(): void {
    this.world.callWave();
  }
  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }
  togglePause(): void {
    if (this.state === 'playing') this.paused = !this.paused;
  }
  autoPause(): void {
    if (this.state === 'playing') this.paused = true;
  }
  /** Кнопка хотбара или клавиша: выбрать заклинание, следующий тап по полю применит его. */
  armSpell(i: number): void {
    if (this.state !== 'playing' || this.paused) return;
    if (this.armedSpell === i) {
      this.armedSpell = null;
      return;
    }
    if (!this.world.spells.ready(i)) {
      this.effects.text(`Перезарядка ${Math.ceil(this.world.spells.cooldowns[i])} с`, 164, 596, PAL.uiRed, 18);
      return;
    }
    this.armedSpell = i;
    this.selected = null;
    this.pendingSpec = null;
  }

  private onTap(p: Vec): void {
    if (this.state !== 'playing' || this.paused) {
      this.ui.tapOverlay(p);
      return;
    }
    if (this.ui.tap(p)) return;
    this.pendingSpec = null;
    if (this.armedSpell !== null) {
      // Цель заклинания: любая точка поля ниже верхней панели.
      if (p.y > 84 && this.world.castSpell(this.armedSpell, { x: p.x, y: p.y })) this.armedSpell = null;
      return;
    }
    const plot = this.world.plotAt(p.x, p.y);
    if (plot) {
      this.selected = plot.tower ? { type: 'tower', tower: plot.tower } : { type: 'plot', plot };
      return;
    }
    this.selected = null;
  }

  /** Правая кнопка мыши: отменить выбранное заклинание и закрыть меню. */
  private onSecondaryTap(): void {
    if (this.state !== 'playing') return;
    this.armedSpell = null;
    this.selected = null;
    this.pendingSpec = null;
  }

  private onKey(k: string): void {
    if (k === ' ') {
      switch (this.state) {
        case 'title': this.toLevels(); break;
        case 'intro': case 'won': case 'lost': this.start(); break;
        case 'playing': this.togglePause(); break;
        default: break;
      }
      return;
    }
    if (k === 'Escape') {
      if (this.state === 'playing') { this.selected = null; this.pendingSpec = null; this.armedSpell = null; }
      else if (this.state === 'intro' || this.state === 'won' || this.state === 'lost' || this.state === 'perks') this.toLevels();
      return;
    }
    if (import.meta.env.DEV && this.state === 'title' && (k === 's' || k === 'S')) { this.saveSplash(); return; }
    if (this.state !== 'playing') return;
    if (k === 'n' || k === 'N' || k === 'т' || k === 'Т' || k === 'Enter') { this.callWave(); return; }
    const spell = SPELL_KEYS.findIndex((keys) => keys.includes(k));
    if (spell >= 0) { this.armSpell(spell); return; }
    if (k === '1') this.speed = 1;
    if (k === '2') this.speed = 2;
    if (k === 'f' || k === 'F' || k === 'а' || k === 'А') this.toggleSpeed();
    if (import.meta.env.DEV) {
      // Дев-клавиши: только в режиме разработки, в сборку не попадают.
      const w = this.world;
      if (k === 'g' || k === 'G') w.addGold(500);
      if (k === 'k' || k === 'K') for (const e of w.enemies) e.damage(1e9, 'true', w);
      if (k === 'c' || k === 'C') for (let i = 0; i < w.spells.cooldowns.length; i++) w.spells.cooldowns[i] = 0;
      if (k === 'p' || k === 'P') {
        w.waves.skipAll();
        for (const e of w.enemies) e.damage(1e9, 'true', w);
      }
      if (k === 'y' || k === 'Y') {
        const kinds = Object.keys(ENEMIES) as EnemyKind[];
        w.spawnEnemy(kinds[this.devSpawnIdx++ % kinds.length], 1, 0);
      }
      if (k === 'b' || k === 'B') {
        const hasEmpress = this.level.waves.some((wv) => wv.groups.some((gr) => gr.kind === 'empress'));
        w.spawnEnemy(hasEmpress ? 'empress' : 'queen', 1, 0);
      }
    }
  }

  // ───────────── симуляция ─────────────

  update(dt: number): void {
    this.clock += dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.state !== 'playing' || this.paused) {
      this.effects.update(dt);
      return;
    }
    for (let i = 0; i < this.speed && this.world.state === 'playing'; i++) this.world.step(dt);
    if (this.world.state === 'won') this.onWin();
    else if (this.world.state === 'lost') {
      this.state = 'lost';
      this.selected = null;
    }
  }

  // ───────────── отрисовка ─────────────

  render(): void {
    const ctx = this.screen.ctx;
    this.screen.begin();
    if (this.state === 'title') {
      // Заставка: диорама без игрового мира, поверх только текст и кнопка.
      this.drawSplash(ctx);
      this.ui.draw(ctx);
      this.screen.end();
      if (this.screen.cssH > this.screen.cssW) this.drawPortraitHint(ctx);
      return;
    }
    this.drawBackground(ctx);

    if (this.state === 'playing') this.drawGrid(ctx);

    const sel = this.selected;
    const h = this.hero;
    if (sel?.type === 'tower') {
      const t = sel.tower;
      drawRange(ctx, t.x, t.y, t.stats.range, t.kind === 'barracks' ? '255,130,100' : '255,255,255');
      if (t.kind === 'barracks') {
        ctx.strokeStyle = 'rgba(255,130,100,0.9)';
        ctx.lineWidth = 2.5;
        circle(ctx, t.rally.x, t.rally.y, 12);
        ctx.stroke();
      }
    } else if (sel?.type === 'plot' && this.ui.hoverKind) {
      drawRange(ctx, sel.plot.x, sel.plot.y, TOWERS[this.ui.hoverKind].levels[0].range);
    }
    if (this.state === 'playing' && this.armedSpell !== null) {
      // Прицел заклинания: на ПК следует за курсором, на телефоне игрок просто тапает по точке.
      const def = SPELLS[this.armedSpell];
      const hv = this.input.hover;
      if (hv && hv.y > 84) {
        drawRange(ctx, hv.x, hv.y, def.radius, def.id === 'acid' ? '155,229,58' : def.id === 'spores' ? '181,123,214' : '255,217,90');
      }
    }

    for (const c of this.world.clouds) drawSporeCloud(ctx, c.x, c.y, c.r, c.life / c.max, this.clock, c.variant);

    const items: { y: number; draw: () => void }[] = [];
    for (const t of this.towers) {
      items.push({ y: t.y + 6, draw: () => t.draw(ctx, this.time) });
      if (t.built) for (const s of t.soldiers) if (!s.dead) items.push({ y: s.y, draw: () => s.draw(ctx) });
    }
    for (const c of this.world.constructions) {
      c.builders.forEach((b, i) => items.push({ y: b.y, draw: () => this.drawBuilder(ctx, c, b, i) }));
      if (c.phase === 'work') {
        const t = c.tower;
        items.push({ y: t.y + 24, draw: () => drawLadder(ctx, t.x + 30, t.y + 22, t.x + 14, t.y - 38) });
      } else {
        const [, front, back] = c.builders;
        items.push({ y: Math.max(front.y, back.y) + 1, draw: () => drawLadder(ctx, front.x, front.y, back.x, back.y) });
      }
    }
    for (const s of this.world.spells.recruits) if (!s.dead) items.push({ y: s.y, draw: () => s.draw(ctx) });
    if (!h.dead) items.push({ y: h.y, draw: () => h.draw(ctx) });
    for (const e of this.enemies) if (!e.def.flying) items.push({ y: e.y, draw: () => e.draw(ctx, this.clock) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    for (const p of this.world.projectiles) p.draw(ctx);
    for (const e of this.enemies) if (e.def.flying) e.draw(ctx, this.clock);
    this.drawAmbient(ctx);
    this.effects.draw(ctx);
    if (this.level.theme.night) this.drawNight(ctx);

    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,20,${Math.min(0.45, this.hurtFlash * 0.6)})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    this.ui.draw(ctx);
    this.screen.end();
    if (this.screen.cssH > this.screen.cssW) this.drawPortraitHint(ctx);
  }

  /** Подсветка клеток: свободные клетки и так видны по шахматному газону; здесь только курсор (ПК) и выбранная клетка. */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const sel = this.selected;
    const hover = this.input.hover;
    const hovered = hover ? this.world.plotAt(hover.x, hover.y) : null;
    const half = CELL / 2 - 3;
    if (hovered && !hovered.tower && !(sel?.type === 'plot' && sel.plot === hovered)) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, hovered.x - half, hovered.y - half, half * 2, half * 2, 8);
      ctx.fill();
    }
    if (sel?.type === 'plot') {
      const p = sel.plot;
      const pulse = 0.6 + 0.3 * Math.sin(this.clock * 4);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      roundRect(ctx, p.x - half, p.y - half, half * 2, half * 2, 8);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Строитель: рабочий в каске; молотобоец несёт молоток, у башни стучат все трое. */
  private drawBuilder(ctx: CanvasRenderingContext2D, c: Construction, b: Builder, i: number): void {
    const s = 0.72;
    drawShadow(ctx, b.x, b.y + 4, 11, 4.5);
    drawAnt(ctx, b.x, b.y, b.angle, s, ANT_WORKER, b.legPhase);
    drawHardHat(ctx, b.x, b.y, b.angle, s);
    const working = c.phase === 'work';
    if (working || b.role === 'hammer') {
      drawHammer(ctx, b.x, b.y, b.angle, s, working ? Math.sin(c.hammer + i * 2.1) * 0.7 - 0.2 : 0.35);
    }
  }

  /** Телефон в портрете: игра влезает, но мелко. Мягко просим повернуть. */
  private drawPortraitHint(ctx: CanvasRenderingContext2D): void {
    const s = this.screen;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    const w = Math.min(s.cssW - 32, 360);
    const x = (s.cssW - w) / 2;
    const y = Math.max(12, s.offY / 2 - 34);
    roundRect(ctx, x, y, w, 68, 16);
    ctx.fillStyle = 'rgba(43,22,8,0.92)';
    ctx.fill();
    ctx.strokeStyle = PAL.uiBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(x + 38, y + 34);
    ctx.rotate(Math.sin(this.clock * 2) * 0.35 - 0.4);
    roundRect(ctx, -11, -20, 22, 40, 5);
    ctx.fillStyle = PAL.uiLight;
    ctx.fill();
    ctx.fillStyle = PAL.ui;
    ctx.fillRect(-8, -15, 16, 28);
    ctx.restore();
    drawText(ctx, 'Поверни телефон', x + 70, y + 24, { size: 18, color: PAL.uiGold, stroke: null });
    drawText(ctx, 'горизонтально: так удобнее играть', x + 70, y + 46, { size: 14, weight: 'normal', stroke: null });
  }

  private drawSplash(ctx: CanvasRenderingContext2D): void {
    const k = Math.min(this.screen.pixelScale, 2.5);
    if (!this.splash || Math.abs(this.splash.k - k) > 0.12) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(LOGICAL_W * k);
      c.height = Math.ceil(LOGICAL_H * k);
      const sctx = c.getContext('2d');
      if (!sctx) return;
      sctx.scale(k, k);
      const img = this.splashImg;
      if (img.complete && img.naturalWidth > 0) {
        // Картина вписывается с обрезкой по краям, табличка под заголовок поверх.
        const s = Math.max(LOGICAL_W / img.naturalWidth, LOGICAL_H / img.naturalHeight);
        sctx.drawImage(img, (LOGICAL_W - img.naturalWidth * s) / 2, (LOGICAL_H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        drawSplashSign(sctx);
      } else {
        drawSplash(sctx, LOGICAL_W, LOGICAL_H, new Rng(2026));
      }
      this.splash = { canvas: c, k };
    }
    ctx.drawImage(this.splash.canvas, 0, 0, LOGICAL_W, LOGICAL_H);
  }

  /** Дев: заставка с заголовком в полном размере уходит в пекарню как splash.png для показа. */
  private saveSplash(): void {
    const c = document.createElement('canvas');
    c.width = LOGICAL_W;
    c.height = LOGICAL_H;
    const sctx = c.getContext('2d');
    if (!sctx) return;
    drawSplash(sctx, LOGICAL_W, LOGICAL_H, new Rng(2026));
    this.ui.draw(sctx);
    void fetch('/__sprites/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'splash', png: c.toDataURL('image/png'), meta: { w: c.width, h: c.height } }),
    });
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const k = Math.min(this.screen.pixelScale, 2.5);
    if (!this.bg || Math.abs(this.bg.k - k) > 0.12) this.bake(k);
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, LOGICAL_W, LOGICAL_H);
  }

  private bake(k: number): void {
    const c = document.createElement('canvas');
    c.width = Math.ceil(LOGICAL_W * k);
    c.height = Math.ceil(LOGICAL_H * k);
    const bctx = c.getContext('2d');
    if (!bctx) return;
    bctx.scale(k, k);
    drawTerrain(bctx, {
      w: LOGICAL_W,
      h: LOGICAL_H,
      paths: this.world.paths,
      plots: this.plots,
      anthill: this.level.anthill,
      rng: new Rng(this.level.seed),
      theme: this.level.theme,
      reserved: [
        { x: 0, y: 0, w: LOGICAL_W, h: 84 },
        { x: 930, y: 615, w: 350, h: 105 },
        { x: 0, y: 610, w: 365, h: 110 },
      ],
    });
    this.bg = { canvas: c, k };
  }

  /** Ночь: лёгкая синяя дымка поверх сцены и светлячки. */
  private drawNight(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(15,25,70,0.14)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    for (const f of this.fireflies) {
      const t = this.clock * f.speed + f.phase;
      const px = f.x + Math.sin(t) * f.r;
      const py = f.y + Math.cos(t * 0.7) * f.r * 0.6;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3));
      const g = ctx.createRadialGradient(px, py, 1, px, py, 16);
      g.addColorStop(0, `rgba(220,255,150,${0.45 * blink})`);
      g.addColorStop(1, 'rgba(220,255,150,0)');
      ctx.fillStyle = g;
      circle(ctx, px, py, 16);
      ctx.fill();
      ctx.fillStyle = `rgba(240,255,190,${blink})`;
      circle(ctx, px, py, 2.2);
      ctx.fill();
    }
  }

  /** Рабочие муравьи, снующие у входа в муравейник. */
  private drawAmbient(ctx: CanvasRenderingContext2D): void {
    for (const a of this.ambient) {
      const t = this.clock * a.speed + a.phase;
      const x = a.cx + Math.cos(t) * a.rx;
      const y = a.cy + Math.sin(t) * a.ry;
      const dx = -Math.sin(t) * a.rx * a.speed;
      const dy = Math.cos(t) * a.ry * a.speed;
      drawAnt(ctx, x, y, Math.atan2(dy, dx), 0.5, ANT_WORKER, this.clock * 12 + a.phase);
    }
  }
}
