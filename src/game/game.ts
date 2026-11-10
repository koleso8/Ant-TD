import { MAX_EXTRA_X, type Screen, type ViewRect } from '../engine/canvas';
import { Camera } from './camera';
import { Tutorial } from './tutorial';
import { Effects } from './effects';
import { ENDLESS } from './endless';
import type { Input } from '../engine/input';
import { Rng } from '../engine/rng';
import { dist, roundRect, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, ENEMIES, LOGICAL_H, LOGICAL_W, SPELLS, TARGET_MODES, TOWERS, type DifficultyDef, type DifficultyId, type EnemyKind, type TargetModeDef, type TowerKind } from './config';
import { LEVELS, TUTORIAL, levelSize, type LevelDef } from './levels';
import { defaultProgress, difficultyRank, freeStars, loadProgress, saveProgress, totalStars, type EndlessRecord, type Progress } from './progress';
import { PERKS, perksFromRanks, type Perks } from './perks';
import { World } from './world';
import type { Plot } from './types';
import type { Tower } from './tower';
import { UI } from './ui';
import { PAL } from '../render/palette';
import { drawText } from '../render/text';
import {
  ANT_WORKER, circle, drawAnt, drawHammer, drawHardHat, drawLadder, drawRange, drawShadow, drawSporeCloud, drawTerrain, ell, leadRoom, pathLead, pennant, twig,
} from '../render/art';
import { Enemy } from './enemy';
import type { Builder, Construction } from './construction';
import { installSprites } from '../render/sprites';
import { drawSplash, drawSplashSign } from '../render/splash';
import { detectLang, gameTitle, getLang, setLang, t, targetText, type Lang } from './i18n';
import { audio } from '../engine/audio';
import { enterFullscreen, exitFullscreen, isInstalledApp, isTouchDevice } from '../engine/device';
import splashUrl from '../assets/sprites/splash.webp';

export type GameState = 'title' | 'levels' | 'perks' | 'intro' | 'settings' | 'playing' | 'won' | 'lost';
/** Кампания из шести уровней, обучение на плацу или бесконечная осада на большой карте. */
export type GameMode = 'campaign' | 'tutorial' | 'endless';

/** Поля вокруг большой карты, до которых можно отвести камеру. */
const MAP_MARGIN = 320;
/** Предел пикселей фона большой карты: печётся целиком один раз, и телефону должно хватить памяти. */
const BG_BUDGET = 8_000_000;
export type Selection =
  | { type: 'plot'; plot: Plot }
  | { type: 'tower'; tower: Tower }
  | null;

interface Ambient { cx: number; cy: number; rx: number; ry: number; speed: number; phase: number }

/** Одна и та же видимая область: иначе фон и заставку надо перепечь. */
function sameView(a: ViewRect, b: ViewRect): boolean {
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}

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
  /** Откуда открыли настройки: туда и вернёмся. */
  settingsFrom: GameState = 'title';
  /** Подсказка, как поставить игру на главный экран (iPhone и iPad). */
  installHelp = false;
  /** Камера: на обычных уровнях стоит, на большой карте двигается. */
  readonly camera = new Camera();
  /** Шаги обучения на учебном плацу; на других уровнях null. */
  tutorial: Tutorial | null = null;
  /** Всплывающие надписи интерфейса: в координатах экрана, камера их не двигает. */
  readonly uiFx = new Effects();
  /** Забег бесконечной осады побил рекорд на этой сложности. */
  newRecord = false;
  /** Сколько ещё секунд показывать подсказку про камеру в начале бесконечной осады. */
  camHint = 0;
  /** Точки, где тропы входят на карту, и направление внутрь: там стоят флажки волн. */
  private entrances: { x: number; y: number; angle: number }[] = [];
  /** Тропы следующей волны: волна бесконечной осады собирается на лету, так что запоминаем. */
  private nextPaths: { n: number; paths: number[] } | null = null;

  private bg: { canvas: HTMLCanvasElement; k: number; view: ViewRect } | null = null;
  /** Заставка главного меню, печётся один раз; перепекается, когда догрузится картина. */
  private splash: { canvas: HTMLCanvasElement; k: number; view: ViewRect; ready: boolean } | null = null;
  /** Образцы врагов для отрисовки на подходе: по одному на вид, двигаются только при рисовании. */
  private readonly ghosts = new Map<EnemyKind, Enemy>();
  private readonly splashImg = new Image();
  private ambient: Ambient[] = [];
  /** Светлячки ночных уровней. */
  private fireflies: { x: number; y: number; r: number; speed: number; phase: number }[] = [];

  constructor(readonly screen: Screen, readonly input: Input) {
    installSprites();
    setLang(this.progress.settings.lang ?? detectLang());
    this.syncLangDom();
    audio.setVolumes(this.progress.settings.music, this.progress.settings.sfx);
    this.splashImg.onload = () => { this.splash = null; };
    this.splashImg.src = splashUrl;
    this.world = this.makeWorld(LEVELS[0]);
    this.ui = new UI(this);
    input.onTap = (p) => this.onTap(p);
    input.onSecondaryTap = () => this.onSecondaryTap();
    input.onKey = (k) => this.onKey(k);
    input.onDrag = (dx, dy) => this.onDrag(dx, dy);
    input.onZoom = (f, at) => this.onZoom(f, at);
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
  get mode(): GameMode {
    return this.level === TUTORIAL ? 'tutorial' : this.level === ENDLESS ? 'endless' : 'campaign';
  }
  /** Бесконечная осада открыта после обучения (и у всех, кто уже брал звёзды). */
  get endlessUnlocked(): boolean {
    return import.meta.env.DEV || this.progress.tutorialDone || totalStars(this.progress) > 0;
  }
  /** Рекорд бесконечной осады на выбранной сложности. */
  get endlessBest(): EndlessRecord | null {
    return this.progress.endless[this.difficulty.id] ?? null;
  }

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
    w.onSound = (id) => audio.play(id);
    w.onLivesLost = () => { this.hurtFlash = 0.7; };
    return w;
  }

  // ───────────── уровни и прогресс ─────────────

  /** Первый уровень кампании открывает обучение, следующие — победа на предыдущем; кто уже побеждал здесь, тому открыто. */
  isUnlocked(i: number): boolean {
    if (import.meta.env.DEV) return true;
    const stars = (lv: LevelDef): number => this.progress.stars[lv.id] ?? 0;
    if (stars(LEVELS[i]) > 0) return true;
    return i === 0 ? this.progress.tutorialDone : stars(LEVELS[i - 1]) > 0;
  }

  starsFor(i: number): number {
    return this.progress.stars[LEVELS[i].id] ?? 0;
  }

  loadLevel(i: number): void {
    this.loadDef(LEVELS[i], i);
  }

  /** Загрузить уровень; index — номер в кампании, у обучения и бесконечной осады -1. */
  private loadDef(def: LevelDef, index: number): void {
    this.levelIndex = index;
    this.world = this.makeWorld(def);
    this.bg = null;
    this.nextPaths = null;
    this.entrances = this.world.paths.map((p) => {
      const { w, h } = levelSize(def);
      let d = 0;
      while (d < p.length) {
        const q = p.at(d);
        if (q.x >= 0 && q.x <= w && q.y >= 0 && q.y <= h) break;
        d += 6;
      }
      const q = p.at(Math.min(p.length, d + 30));
      return { x: q.x, y: q.y, angle: q.angle };
    });
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
      // Светлячки и на полях широкого экрана: за краем кадра их просто не видно.
      for (let k = 0; k < 8; k++) {
        const x = k % 2 === 0 ? rng.range(20 - MAX_EXTRA_X, -20) : rng.range(LOGICAL_W + 20, LOGICAL_W + MAX_EXTRA_X - 20);
        this.fireflies.push({ x, y: rng.range(100, LOGICAL_H - 60), r: rng.range(18, 40), speed: rng.range(0.4, 0.9), phase: rng.range(0, 6.28) });
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
    this.newRecord = false;
    this.uiFx.clear();
    this.tutorial = this.mode === 'tutorial' ? new Tutorial() : null;
    this.camHint = this.mode === 'endless' ? 12 : 0;
    this.resetCamera();
  }

  /** Обычный уровень ровно в кадре; большую карту сначала показываем целиком, насколько влезает. */
  private resetCamera(): void {
    const lv = this.level;
    if (!lv.size) {
      this.camera.fixed();
      return;
    }
    const { w, h } = lv.size;
    const v = this.screen.view;
    this.camera.open({ x0: -MAP_MARGIN, y0: -MAP_MARGIN, x1: w + MAP_MARGIN, y1: h + MAP_MARGIN }, { x: w / 2, y: h / 2 }, 1);
    this.camera.zoom = this.camera.fitZoom(v, w, h);
    this.camera.clamp(v);
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

  chooseTutorial(): void {
    this.loadDef(TUTORIAL, -1);
    this.state = 'intro';
  }

  chooseEndless(): void {
    if (!this.endlessUnlocked) return;
    this.loadDef(ENDLESS, -1);
    this.state = 'intro';
  }

  /** «Пропустить обучение»: считаем пройденным, открывается кампания и бесконечная осада. */
  skipTutorial(): void {
    this.progress.tutorialDone = true;
    saveProgress(this.progress);
    this.toLevels();
  }

  /** «Играть» на заставке: новичок сразу попадает на обучение, остальные к списку уровней. */
  playFromTitle(): void {
    if (!this.progress.tutorialDone && totalStars(this.progress) === 0) this.chooseTutorial();
    else this.toLevels();
  }

  toLevels(): void {
    // Ушли из забега бесконечной осады: дошедшее до сих пор тоже идёт в рекорд.
    if (this.state === 'playing') this.commitEndless();
    this.state = 'levels';
    this.paused = false;
    this.resetArmed = false;
  }

  toPerks(): void {
    this.state = 'perks';
  }

  toSettings(): void {
    if (this.state === 'settings') return;
    this.settingsFrom = this.state;
    this.state = 'settings';
  }

  closeSettings(): void {
    if (this.state === 'settings') this.state = this.settingsFrom;
  }

  showInstallHelp(): void {
    this.installHelp = true;
  }

  closeInstallHelp(): void {
    this.installHelp = false;
  }

  setLang(l: Lang): void {
    setLang(l);
    this.progress.settings.lang = l;
    saveProgress(this.progress);
    this.syncLangDom();
  }

  /** Громкость шагами по 5%: сразу в движок и в сохранение. */
  setMusic(v: number): void {
    this.progress.settings.music = Game.volume(v);
    saveProgress(this.progress);
    audio.setVolumes(this.progress.settings.music, this.progress.settings.sfx);
  }

  setSfx(v: number): void {
    this.progress.settings.sfx = Game.volume(v);
    saveProgress(this.progress);
    audio.setVolumes(this.progress.settings.music, this.progress.settings.sfx);
    audio.play('click');
  }

  private static volume(v: number): number {
    return Math.min(1, Math.max(0, Math.round(v * 20) / 20));
  }

  /** Нужен ли полный экран: выбор игрока, а по умолчанию да на телефоне и нет на ПК. */
  get fullscreenWanted(): boolean {
    return this.progress.settings.fullscreen ?? isTouchDevice();
  }

  setFullscreen(on: boolean): void {
    this.progress.settings.fullscreen = on;
    saveProgress(this.progress);
    if (on) enterFullscreen();
    else exitFullscreen();
  }

  /** Заголовок вкладки и атрибут lang на текущем языке. */
  private syncLangDom(): void {
    document.title = gameTitle();
    document.documentElement.lang = getLang();
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

  /** Рекорд бесконечной осады: отбитые волны, при равенстве — повергнутые враги. Можно звать сколько угодно раз за забег. */
  private commitEndless(): void {
    if (this.mode !== 'endless') return;
    const wave = this.world.clearedWaves;
    const kills = this.world.stats.kills;
    if (wave <= 0) return;
    const best = this.endlessBest;
    if (best && (wave < best.wave || (wave === best.wave && kills <= best.kills))) return;
    this.progress.endless[this.difficulty.id] = { wave, kills };
    saveProgress(this.progress);
    this.newRecord = true;
  }

  private onWin(): void {
    this.state = 'won';
    audio.play('win');
    this.selected = null;
    if (this.mode === 'tutorial') {
      // Обучение звёзд не даёт: оно открывает кампанию и бесконечную осаду.
      this.earnedStars = 0;
      this.progress.tutorialDone = true;
      saveProgress(this.progress);
      return;
    }
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
    const o = this.ui.hud();
    this.uiFx.text(t('fx.target', targetText(next.id).name.toLowerCase()), 975 + o.r, 618 + o.b, PAL.uiGold, 18);
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
    if (this.state !== 'playing') return;
    this.paused = true;
    // Вкладку могут и закрыть: рекорд бесконечной осады сохраняем сразу.
    this.commitEndless();
  }
  /** Кнопка хотбара или клавиша: выбрать заклинание, следующий тап по полю применит его. */
  armSpell(i: number): void {
    if (this.state !== 'playing' || this.paused) return;
    if (this.armedSpell === i) {
      this.armedSpell = null;
      return;
    }
    if (!this.world.spells.ready(i)) {
      const o = this.ui.hud();
      this.uiFx.text(t('fx.cooldown', Math.ceil(this.world.spells.cooldowns[i])), 164 + o.l, 596 + o.b, PAL.uiRed, 18);
      return;
    }
    this.armedSpell = i;
    this.selected = null;
    this.pendingSpec = null;
  }

  private onTap(p: Vec): void {
    this.handleTap(p);
    // Полный экран по тапу: браузер разрешает его только в ответ на жест, не при загрузке страницы.
    if (this.fullscreenWanted && !isInstalledApp()) enterFullscreen();
  }

  private handleTap(p: Vec): void {
    if (this.state !== 'playing' || this.paused) {
      if (this.ui.tapOverlay(p)) audio.play('click');
      return;
    }
    if (this.ui.tap(p)) { audio.play('click'); return; }
    this.pendingSpec = null;
    // Тап по полю: из координат экрана в координаты мира (на большой карте их двигает камера).
    const w = this.camera.toWorld(p.x, p.y);
    if (this.armedSpell !== null) {
      // Цель заклинания: любая точка поля ниже верхней панели.
      if (p.y > this.ui.hud().t + 84 && this.world.castSpell(this.armedSpell, w)) this.armedSpell = null;
      return;
    }
    const plot = this.world.plotAt(w.x, w.y);
    if (plot) {
      this.selected = plot.tower ? { type: 'tower', tower: plot.tower } : { type: 'plot', plot };
      return;
    }
    this.selected = null;
  }

  /** Перетаскивание двигает большую карту; на обычных уровнях камера стоит. */
  private onDrag(dx: number, dy: number): void {
    if (this.state !== 'playing' || !this.camera.free) return;
    this.camera.pan(dx, dy);
    this.camera.clamp(this.screen.view);
    this.camHint = 0;
  }

  /** Щипок или колесо: масштаб вокруг пальца или курсора. */
  private onZoom(f: number, at: Vec): void {
    if (this.state !== 'playing' || !this.camera.free) return;
    this.camera.zoomAt(f, at.x, at.y, this.screen.view);
    this.camera.clamp(this.screen.view);
    this.camHint = 0;
  }

  /** Показать вход тропы: тап по стрелке у края экрана. */
  focusEntrance(i: number): void {
    const e = this.entrances[i];
    if (!e || !this.camera.free) return;
    const c = this.camera.toScreen(e.x, e.y);
    this.camera.pan(640 - c.x, 360 - c.y);
    this.camera.clamp(this.screen.view);
  }

  /** Где тропа i входит на карту. */
  entrance(i: number): { x: number; y: number; angle: number } | null {
    return this.entrances[i] ?? null;
  }

  /** Тропы, по которым враги идут сейчас или пойдут в следующей волне. */
  incomingPaths(): number[] {
    const w = this.world.waves;
    const set = new Set<number>();
    for (const s of w.queue) set.add(s.path);
    if (w.countdown !== null && w.index < w.total) {
      const n = w.index + 1;
      if (!this.nextPaths || this.nextPaths.n !== n) this.nextPaths = { n, paths: w.wave(n).groups.map((gr) => gr.path ?? 0) };
      for (const p of this.nextPaths.paths) set.add(p);
    }
    return [...set];
  }

  /** Правая кнопка мыши: отменить выбранное заклинание и закрыть меню. */
  private onSecondaryTap(): void {
    if (this.state !== 'playing') return;
    this.armedSpell = null;
    this.selected = null;
    this.pendingSpec = null;
  }

  private onKey(k: string): void {
    if (this.installHelp) {
      if (k === 'Escape' || k === ' ' || k === 'Enter') this.closeInstallHelp();
      return;
    }
    if (k === ' ') {
      switch (this.state) {
        case 'title': this.playFromTitle(); break;
        case 'intro': case 'won': case 'lost': this.start(); break;
        case 'playing': this.togglePause(); break;
        default: break;
      }
      return;
    }
    if (this.state === 'playing' && this.camera.free) {
      // Стрелки двигают большую карту, плюс и минус меняют масштаб.
      const step = 140;
      const pan: Record<string, readonly [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const d = pan[k];
      if (d) { this.onDrag(d[0], d[1]); return; }
      if (k === '+' || k === '=') { this.onZoom(1.2, { x: 640, y: 360 }); return; }
      if (k === '-' || k === '_') { this.onZoom(1 / 1.2, { x: 640, y: 360 }); return; }
    }
    if (k === 'Escape') {
      if (this.state === 'settings') this.closeSettings();
      else if (this.state === 'playing') { this.selected = null; this.pendingSpec = null; this.armedSpell = null; }
      else if (this.state === 'intro' || this.state === 'won' || this.state === 'lost' || this.state === 'perks') this.toLevels();
      return;
    }
    if (import.meta.env.DEV && (this.state === 'title' || this.state === 'settings') && (k === 'i' || k === 'I')) { this.showInstallHelp(); return; }
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
      if (k === 'l' || k === 'L') w.loseLives(w.lives);
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
    audio.setMusic(this.state === 'playing' || (this.state === 'settings' && this.settingsFrom === 'playing') ? 'battle' : 'menu');
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    this.uiFx.update(dt);
    if (this.state !== 'playing' || this.paused) {
      this.effects.update(dt);
      return;
    }
    if (this.camHint > 0) this.camHint -= dt;
    if (this.tutorial) {
      this.tutorial.update(dt, this);
      // Обучение остановило время: мир стоит, а кнопки и тапы работают.
      if (this.tutorial.frozen) {
        this.effects.update(dt);
        return;
      }
    }
    for (let i = 0; i < this.speed && this.world.state === 'playing'; i++) this.world.step(dt);
    if (this.world.state === 'won') this.onWin();
    else if (this.world.state === 'lost') {
      this.state = 'lost';
      audio.play('lose');
      this.selected = null;
      this.commitEndless();
    }
  }

  // ───────────── отрисовка ─────────────

  render(): void {
    const ctx = this.screen.ctx;
    this.screen.begin();
    if (this.state === 'title' || (this.state === 'settings' && this.settingsFrom === 'title')) {
      // Заставка: диорама без игрового мира, поверх только текст и кнопка.
      this.drawSplash(ctx);
      this.ui.draw(ctx);
      this.screen.end();
      if (this.screen.cssH > this.screen.cssW) this.drawPortraitHint(ctx);
      return;
    }
    // Мир рисуется через камеру (на обычных уровнях она стоит), интерфейс поверх в координатах экрана.
    const cam = this.camera;
    cam.clamp(this.screen.view);
    const wv = cam.free ? cam.visible(this.screen.view) : this.screen.view;
    ctx.save();
    cam.apply(ctx);
    this.drawBackground(ctx);
    this.drawIncoming(ctx, wv);
    if (this.mode === 'endless') this.drawEntranceFlags(ctx);

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
      if (hv && hv.y > this.ui.hud().t + 84) {
        const p = cam.toWorld(hv.x, hv.y);
        drawRange(ctx, p.x, p.y, def.radius, def.id === 'acid' ? '155,229,58' : def.id === 'spores' ? '181,123,214' : '255,217,90');
      }
    }

    for (const c of this.world.clouds) drawSporeCloud(ctx, c.x, c.y, c.r, c.life / c.max, this.clock, c.variant);

    // На большой карте рисуем только то, что видно, с запасом на размер спрайта.
    const seen = (x: number, y: number): boolean => x > wv.x0 - 120 && x < wv.x1 + 120 && y > wv.y0 - 150 && y < wv.y1 + 120;
    const items: { y: number; draw: () => void }[] = [];
    for (const t of this.towers) {
      if (!seen(t.x, t.y)) continue;
      items.push({ y: t.y + 6, draw: () => t.draw(ctx, this.time) });
      if (t.built) for (const s of t.soldiers) if (!s.dead) items.push({ y: s.y, draw: () => s.draw(ctx) });
    }
    for (const c of this.world.constructions) {
      c.builders.forEach((b, i) => { if (seen(b.x, b.y)) items.push({ y: b.y, draw: () => this.drawBuilder(ctx, c, b, i) }); });
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
    for (const e of this.enemies) if (!e.def.flying && seen(e.x, e.y)) items.push({ y: e.y, draw: () => e.draw(ctx, this.clock) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    for (const p of this.world.projectiles) p.draw(ctx);
    for (const e of this.enemies) if (e.def.flying && seen(e.x, e.y)) e.draw(ctx, this.clock);
    this.drawAmbient(ctx);
    this.effects.draw(ctx);
    if (this.level.theme.night) this.drawFireflies(ctx);
    ctx.restore();

    if (this.level.theme.night) {
      ctx.fillStyle = 'rgba(15,25,70,0.14)';
      this.fillView(ctx);
    }
    if (this.tutorial?.frozen && this.state === 'playing') {
      // Обучение остановило время: поле чуть синеет, чтобы это было видно.
      ctx.fillStyle = 'rgba(40,80,170,0.24)';
      this.fillView(ctx);
    }
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,20,${Math.min(0.45, this.hurtFlash * 0.6)})`;
      this.fillView(ctx);
    }

    this.ui.draw(ctx);
    this.uiFx.draw(ctx);
    this.screen.end();
    if (this.screen.cssH > this.screen.cssW) this.drawPortraitHint(ctx);
  }

  /** Флажок у входа тропы на большой карте: оттуда выйдет следующая волна. */
  private drawEntranceFlags(ctx: CanvasRenderingContext2D): void {
    for (const i of this.incomingPaths()) {
      const e = this.entrances[i];
      if (!e) continue;
      // Флажок сбоку от тропы, чтобы не загораживал идущих врагов.
      const nx = -Math.sin(e.angle);
      const ny = Math.cos(e.angle);
      const side = ny > 0.5 ? -1 : 1;
      const x = e.x + nx * 54 * side;
      const y = e.y + ny * 54 * side;
      const wave = Math.sin(this.clock * 6 + i);
      drawShadow(ctx, x, y + 4, 12, 5);
      twig(ctx, x, y + 4, x, y - 66, 6);
      pennant(ctx, x, y - 66, 46, 28, PAL.uiRed, wave * 4);
    }
  }

  /** Подсветка клеток: свободные клетки и так видны по шахматному газону; здесь только курсор (ПК) и выбранная клетка. */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const sel = this.selected;
    const hv = this.input.hover;
    const hover = hv ? this.camera.toWorld(hv.x, hv.y) : null;
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
    drawText(ctx, t('portrait.title'), x + 70, y + 24, { size: 18, color: PAL.uiGold, stroke: null });
    drawText(ctx, t('portrait.sub'), x + 70, y + 46, { size: 14, weight: 'normal', stroke: null });
  }

  private drawSplash(ctx: CanvasRenderingContext2D): void {
    const k = Math.min(this.screen.pixelScale, 2.5);
    const v = this.screen.view;
    const img = this.splashImg;
    const ready = img.complete && img.naturalWidth > 0;
    const sp = this.splash;
    if (!sp || Math.abs(sp.k - k) > 0.12 || !sameView(sp.view, v) || sp.ready !== ready) {
      const c = document.createElement('canvas');
      c.width = Math.ceil((v.x1 - v.x0) * k);
      c.height = Math.ceil((v.y1 - v.y0) * k);
      const sctx = c.getContext('2d');
      if (!sctx) return;
      sctx.scale(k, k);
      sctx.translate(-v.x0, -v.y0);
      if (ready) {
        this.paintSplash(sctx, img, v, k);
        drawSplashSign(sctx);
      } else {
        drawSplash(sctx, LOGICAL_W, LOGICAL_H, new Rng(2026));
      }
      this.splash = { canvas: c, k, view: { ...v }, ready };
    }
    const s = this.splash;
    if (s) ctx.drawImage(s.canvas, s.view.x0, s.view.y0, s.view.x1 - s.view.x0, s.view.y1 - s.view.y0);
  }

  /**
   * Картина заставки на всю видимую область, по ширине экрана. Если экран шире картины, лишнее
   * сверху и снизу обрезается; если выше, сверху и снизу её размытое продолжение.
   */
  private paintSplash(c: CanvasRenderingContext2D, img: HTMLImageElement, v: ViewRect, k: number): void {
    const vw = v.x1 - v.x0;
    const vh = v.y1 - v.y0;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const pw = vw;
    const ph = (ih * vw) / iw;
    const x = v.x0;
    const y = (v.y0 + v.y1) / 2 - ph / 2;
    if (ph >= vh) {
      c.drawImage(img, x, y, pw, ph);
      return;
    }
    // Размытый фон: картина, ужатая до горстки пикселей и растянутая обратно на весь экран.
    const tiny = document.createElement('canvas');
    tiny.width = 40;
    tiny.height = Math.max(4, Math.round((40 * vh) / vw));
    const tctx = tiny.getContext('2d');
    if (tctx) {
      const ts = Math.max(tiny.width / iw, tiny.height / ih);
      tctx.drawImage(img, (tiny.width - iw * ts) / 2, (tiny.height - ih * ts) / 2, iw * ts, ih * ts);
      c.drawImage(tiny, v.x0, v.y0, vw, vh);
      c.fillStyle = 'rgba(20,12,4,0.25)';
      c.fillRect(v.x0, v.y0, vw, vh);
    }
    // Резкая картина, верхний и нижний края мягко растворяются в размытом фоне.
    const sharp = document.createElement('canvas');
    sharp.width = Math.ceil(pw * k);
    sharp.height = Math.ceil(ph * k);
    const m = sharp.getContext('2d');
    if (!m) {
      c.drawImage(img, x, y, pw, ph);
      return;
    }
    m.drawImage(img, 0, 0, sharp.width, sharp.height);
    m.globalCompositeOperation = 'destination-in';
    const f = Math.min(0.2, 48 / ph);
    const grad = m.createLinearGradient(0, 0, 0, sharp.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(f, 'rgba(0,0,0,1)');
    grad.addColorStop(1 - f, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = grad;
    m.fillRect(0, 0, sharp.width, sharp.height);
    c.drawImage(sharp, x, y, pw, ph);
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
    // Обычный уровень печётся под видимую область экрана, большая карта целиком вместе с полями.
    const free = this.camera.free;
    const v = free ? this.camera.area : this.screen.view;
    const area = (v.x1 - v.x0) * (v.y1 - v.y0);
    const k = free
      ? Math.min(this.screen.pixelScale * this.camera.maxZoom, Math.sqrt(BG_BUDGET / area))
      : Math.min(this.screen.pixelScale, 2.5);
    if (!this.bg || Math.abs(this.bg.k - k) > 0.12 || !sameView(this.bg.view, v)) this.bake(k, v);
    const b = this.bg;
    if (b) ctx.drawImage(b.canvas, b.view.x0, b.view.y0, b.view.x1 - b.view.x0, b.view.y1 - b.view.y0);
  }

  /** Фон уровня печётся под видимую область: кадр плюс поля широкого или высокого экрана. */
  private bake(k: number, v: ViewRect): void {
    const vw = v.x1 - v.x0;
    const vh = v.y1 - v.y0;
    const c = document.createElement('canvas');
    c.width = Math.ceil(vw * k);
    c.height = Math.ceil(vh * k);
    const bctx = c.getContext('2d');
    if (!bctx) return;
    bctx.scale(k, k);
    bctx.translate(-v.x0, -v.y0);
    const o = this.ui.hud();
    const size = levelSize(this.level);
    drawTerrain(bctx, {
      w: size.w,
      h: size.h,
      paths: this.world.paths,
      plots: this.plots,
      anthill: this.level.anthill,
      rng: new Rng(this.level.seed),
      marginRng: new Rng(this.level.seed + 7),
      view: v,
      theme: this.level.theme,
      // Под интерфейсом декор не нужен; угловые блоки прижаты к краям экрана. Над большой картой интерфейс плавает.
      reserved: this.camera.free ? [] : [
        { x: v.x0, y: v.y0, w: vw, h: o.t + 84 - v.y0 },
        { x: 930 + o.r, y: 615 + o.b, w: v.x1 - 930 - o.r, h: v.y1 - 615 - o.b },
        { x: v.x0, y: 610 + o.b, w: 365 + o.l - v.x0, h: v.y1 - 610 - o.b },
      ],
    });
    this.bg = { canvas: c, k, view: { ...v } };
  }

  /** Залить всю видимую область, вместе с полями. */
  private fillView(ctx: CanvasRenderingContext2D): void {
    const v = this.screen.view;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /**
   * Враги волны, которые ещё не вышли на карту: на полях широкого экрана они уже идут по
   * продолжению тропы и выходят на карту ровно там и тогда, где их создаст симуляция.
   */
  private drawIncoming(ctx: CanvasRenderingContext2D, v: ViewRect): void {
    const paths = this.world.paths;
    const { w, h } = levelSize(this.level);
    for (const s of this.world.waves.queue) {
      const path = paths[s.path] ?? paths[0];
      const lead = pathLead(path, w, h);
      if (!lead) continue;
      const room = leadRoom(lead, v);
      if (room <= 0) continue;
      let ghost = this.ghosts.get(s.kind);
      if (!ghost) {
        ghost = new Enemy(s.kind, 1, path);
        this.ghosts.set(s.kind, ghost);
      }
      ghost.angle = Math.atan2(lead.dy, lead.dx);
      const speed = ENEMIES[s.kind].speed;
      for (let i = 0; i < s.left; i++) {
        const d = speed * (s.timer + i * s.interval);
        if (d <= 0) continue;
        if (d > room + 50) break;
        ghost.x = lead.x - lead.dx * d;
        ghost.y = lead.y - lead.dy * d;
        ghost.legPhase = -d * 0.14;
        ghost.draw(ctx, this.clock);
      }
    }
  }

  /** Светлячки ночных уровней; синюю дымку поверх сцены рисует render. */
  private drawFireflies(ctx: CanvasRenderingContext2D): void {
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
