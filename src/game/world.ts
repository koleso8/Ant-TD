import { dist, type Vec } from '../engine/math';
import { CELL, DIFFICULTIES, HERO, TOWERS, type DifficultyDef, type EnemyKind, type TargetMode, type TowerKind } from './config';
import { levelSize, type LevelDef } from './levels';
import { Path, snapWaypoints } from './path';
import type { GameCtx, Plot, SoundId, SporeCloud } from './types';
import { Enemy } from './enemy';
import { Tower } from './tower';
import { Hero } from './hero';
import { SpellBook } from './spells';
import type { Projectile } from './projectile';
import { Effects } from './effects';
import { WaveManager } from './waves';
import { Construction } from './construction';
import { NO_PERKS, type Perks } from './perks';
import { PAL } from '../render/palette';
import { t as tr, towerText } from './i18n';

export type WorldState = 'playing' | 'won' | 'lost';

/** Что нужно знать для баланса. */
export interface WorldStats {
  /** Сколько личинок потеряно на каждой волне (индекс = номер волны с 1). */
  leaksByWave: number[];
  goldEarned: number;
  /** Сколько врагов убито (сбежавшие к муравейнику не в счёт). */
  kills: number;
  /** Урон по источникам: acid, barracks, catapult, spore, hero. */
  damage: Record<string, number>;
  heroDeaths: number;
}

/**
 * Ядро игры без отрисовки и ввода: уровень, башни, враги, герой, волны, ресурсы.
 * Game оборачивает его экранами и управлением, симуляция баланса гоняет напрямую.
 */
export class World implements GameCtx {
  readonly paths: Path[];
  readonly plots: Plot[];
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  clouds: SporeCloud[] = [];
  hero: Hero;
  readonly spells: SpellBook;
  /** Идущие стройки: рабочие бегут из муравейника к башне и обратно. */
  constructions: Construction[] = [];
  /** Кого бьют все стреляющие башни; переключается кнопкой в верхней панели. */
  targetMode: TargetMode = 'first';
  readonly effects: Effects;
  readonly waves: WaveManager;
  gold: number;
  lives: number;
  time = 0;
  state: WorldState = 'playing';
  readonly stats: WorldStats = { leaksByWave: [], goldEarned: 0, kills: 0, damage: {}, heroDeaths: 0 };
  /** Размер карты: кадр 1280x720 или больше (бесконечная осада). */
  readonly width: number;
  readonly height: number;
  /**
   * Самая поздняя отбитая волна: из неё никого не осталось ни на поле, ни в очереди (убиты или дошли до
   * муравейника), а колония стоит. Рекорд бесконечной осады считается по нему, а не по номеру вызванной
   * волны: позвать волну мало, её надо пережить. Медленный босс прошлой волны счёт не держит.
   */
  clearedWaves = 0;
  /** Game подсвечивает экран красным, когда враг дошёл до личинок. */
  onLivesLost: ((n: number) => void) | null = null;
  /** Game озвучивает события ядра; симуляция оставляет null. */
  onSound: ((id: SoundId) => void) | null = null;
  private heroWasDead = false;

  constructor(
    readonly level: LevelDef, readonly perks: Perks = NO_PERKS,
    readonly difficulty: DifficultyDef = DIFFICULTIES[1], effects: Effects = new Effects(),
  ) {
    this.effects = effects;
    const size = levelSize(level);
    this.width = size.w;
    this.height = size.h;
    this.paths = level.paths.map((w) => new Path(snapWaypoints(w, CELL)));
    this.plots = World.makeGrid(level, this.paths);
    this.gold = Math.round(level.startGold * difficulty.goldMul) + perks.startGold;
    this.lives = this.startLives;
    this.hero = new Hero(Math.min(HERO.levels.length, HERO.baseLevel + perks.heroLevelBonus), size);
    this.spells = new SpellBook(perks);
    this.waves = new WaveManager(level.waveGen ?? level.waves, { delay: level.waveDelay, hpMul: level.hpMul });
  }

  /** Сколько личинок было в начале: порог звёзд считается от этого числа. */
  get startLives(): number {
    return Math.round(this.level.lives * this.difficulty.livesMul) + this.perks.extraLives;
  }
  get bountyMul(): number {
    return this.difficulty.goldMul * (this.level.bountyMul ?? 1);
  }

  /**
   * Сетка застройки: все клетки поля, не занятые тропами, водой, стеной, пнём,
   * муравейником и панелями интерфейса. На большой карте интерфейс плавает над ней,
   * и клетки под ним достаются, сдвинув камеру.
   */
  static makeGrid(level: LevelDef, paths: readonly Path[]): Plot[] {
    const t = level.theme;
    const size = levelSize(level);
    const fixed = !level.size;
    const cols = Math.floor(size.w / CELL);
    const rows = Math.floor(size.h / CELL);
    const out: Plot[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        if (fixed && cy < 100) continue;
        if (fixed && cy > 640 && (cx < 380 || cx > 1000)) continue;
        // Холм муравейника: эллипс чуть больше рисунка.
        const ax = (cx - level.anthill.x) / 108;
        const ay = (cy - level.anthill.y) / 94;
        if (ax * ax + ay * ay < 1) continue;
        if (t.water && cy + 30 > t.water.y - 10 && cy - 30 < t.water.y + t.water.h + 10) continue;
        if (t.wall && cy - 30 < t.wall.h + 10) continue;
        if (t.stump && dist(cx, cy, t.stump.x, t.stump.y) < 110) continue;
        if (t.blobs?.some((b) => dist(cx, cy, b.x, b.y) < b.r + 26)) continue;
        let ok = true;
        outer: for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const px = cx + i * 30;
            const py = cy + j * 30;
            for (const p of paths) {
              if (p.nearest(px, py).dist < 32) { ok = false; break outer; }
            }
          }
        }
        if (!ok) continue;
        out.push({ x: cx, y: cy, col: c, row: r, tower: null });
      }
    }
    return out;
  }

  /** Клетка под точкой или null, если там строить нельзя. */
  plotAt(x: number, y: number): Plot | null {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    return this.plots.find((p) => p.col === c && p.row === r) ?? null;
  }

  // ───────────── симуляция ─────────────

  step(dt: number): void {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.waves.update(dt, this);
    for (const t of this.towers) t.update(dt, this);
    for (const c of this.constructions) {
      c.update(dt, (x, y) => {
        this.effects.burst(x, y, 3, 'rgba(230,210,170,0.9)', 50, 2.5, 0.4, 60);
        this.sound('hammer');
      });
    }
    this.constructions = this.constructions.filter((c) => !c.done);
    this.hero.update(dt, this);
    this.spells.update(dt, this);
    if (this.hero.dead && !this.heroWasDead && this.hero.hp <= 0) this.stats.heroDeaths++;
    this.heroWasDead = this.hero.dead;
    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const c of this.clouds) {
      c.life -= dt;
      if (c.life <= 0) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, c.x, c.y) <= c.r + e.def.radius * 0.5) {
          e.applySlow(c.slow, 0.5);
          e.applyPoison(c.dps, c.poisonDur);
          if (c.stun > 0 && !c.stunned.has(e)) {
            c.stunned.add(e);
            e.stun(c.stun);
          }
        }
      }
    }
    this.clouds = this.clouds.filter((c) => c.life > 0);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.effects.update(dt);
    this.countCleared();
    if (this.state === 'playing' && this.waves.finished(this)) this.state = 'won';
  }

  /** Волна отбита, когда из неё никого не осталось ни на поле, ни в очереди на выход. */
  private countCleared(): void {
    if (this.state === 'lost' || this.clearedWaves >= this.waves.index) return;
    const busy = new Set<number>();
    for (const e of this.enemies) busy.add(e.wave);
    for (const s of this.waves.queue) busy.add(s.wave);
    for (let n = this.waves.index; n > this.clearedWaves; n--) {
      if (!busy.has(n)) {
        this.clearedWaves = n;
        break;
      }
    }
  }

  // ───────────── GameCtx ─────────────

  addGold(n: number, x?: number, y?: number): void {
    this.gold += n;
    if (n > 0) this.stats.goldEarned += n;
    if (x !== undefined && y !== undefined && n > 0) this.effects.text(`+${n}`, x, y - 18, PAL.uiGold, 20);
  }

  loseLives(n: number): void {
    if (this.state !== 'playing') return;
    this.lives = Math.max(0, this.lives - n);
    const w = this.waves.index;
    this.stats.leaksByWave[w] = (this.stats.leaksByWave[w] ?? 0) + n;
    const a = this.level.anthill;
    this.effects.text(`-${n}`, a.x, a.y - 95, PAL.uiRed, 30);
    this.sound('leak');
    this.onLivesLost?.(n);
    if (this.lives <= 0) this.state = 'lost';
  }

  spawnEnemy(kind: EnemyKind, hpMul: number, pathIndex: number): Enemy {
    const path = this.paths[pathIndex] ?? this.paths[0];
    const e = new Enemy(kind, hpMul * this.difficulty.hpMul, path);
    this.enemies.push(e);
    return e;
  }

  spawnEnemyAt(kind: EnemyKind, hpMul: number, path: Path, progress: number): Enemy {
    const e = new Enemy(kind, hpMul, path, progress);
    this.enemies.push(e);
    return e;
  }

  /** Перк фуражиров: надбавка к награде за врага. */
  onEnemyKilled(e: Enemy): void {
    this.stats.kills++;
    if (this.perks.bountyMul > 1) this.addGold(Math.round(e.def.bounty * (this.perks.bountyMul - 1)));
  }

  sound(id: SoundId): void {
    this.onSound?.(id);
  }

  recordDamage(source: string, amount: number): void {
    if (amount <= 0) return;
    this.stats.damage[source] = (this.stats.damage[source] ?? 0) + amount;
  }

  damageDefenders(x: number, y: number, radius: number, damage: number, stagger = 0): void {
    const soldiers = [...this.spells.recruits];
    for (const t of this.towers) soldiers.push(...t.soldiers);
    for (const s of soldiers) {
      if (s.dead || dist(s.x, s.y, x, y) > radius) continue;
      s.takeDamage(damage, this);
      if (stagger > 0) s.stagger(stagger, x, y);
    }
    const h = this.hero;
    if (!h.dead && dist(h.x, h.y, x, y) <= radius) {
      h.takeDamage(damage, this);
      if (stagger > 0) h.stagger(stagger, x, y);
    }
  }

  /** Заклинание из хотбара в точку поля. */
  castSpell(i: number, p: Vec): boolean {
    if (this.state !== 'playing') return false;
    return this.spells.cast(i, p, this, this.hero);
  }

  // ───────────── действия игрока ─────────────

  build(kind: TowerKind, plot: Plot): boolean {
    if (plot.tower) return false;
    const cost = TOWERS[kind].levels[0].cost;
    if (this.gold < cost) {
      this.effects.text(tr('fx.noNectar'), plot.x, plot.y - 54, PAL.uiRed, 18);
      this.sound('noGold');
      return false;
    }
    this.gold -= cost;
    const t = new Tower(kind, plot, this.paths, this.perks);
    plot.tower = t;
    this.towers.push(t);
    this.startConstruction(t, false);
    this.sound('build');
    return true;
  }

  /** Рабочие выбегают из муравейника; башня готова, когда они достроят. */
  private startConstruction(t: Tower, upgrade: boolean): void {
    t.construction?.cancel();
    const c = new Construction(t, this.level.anthill, upgrade);
    t.beginBuild(c);
    this.constructions.push(c);
  }

  upgrade(t: Tower): boolean {
    const c = t.upgradeCost;
    if (c === null) return false;
    if (this.gold < c) {
      this.effects.text(tr('fx.noNectar'), t.x, t.y - 60, PAL.uiRed, 18);
      this.sound('noGold');
      return false;
    }
    this.gold -= c;
    t.upgrade();
    this.startConstruction(t, true);
    this.sound('build');
    return true;
  }

  specialize(t: Tower, i: number): boolean {
    if (!t.canSpecialize) return false;
    const cost = t.def.specs[i].cost;
    if (this.gold < cost) {
      this.effects.text(tr('fx.noNectar'), t.x, t.y - 60, PAL.uiRed, 18);
      this.sound('noGold');
      return false;
    }
    this.gold -= cost;
    t.specialize(i);
    this.startConstruction(t, true);
    this.sound('upgrade');
    this.effects.text(towerText(t.kind).specs[i].name, t.x, t.y - 70, PAL.uiGold, 22);
    return true;
  }

  sell(t: Tower): void {
    const v = t.sellValue;
    this.gold += v;
    this.effects.text(`+${v}`, t.x, t.y - 44, PAL.uiGold, 20);
    this.sound('sell');
    t.construction?.cancel();
    t.destroy();
    t.plot.tower = null;
    this.towers = this.towers.filter((x) => x !== t);
  }

  callWave(): boolean {
    return this.waves.callNext(this);
  }
}
