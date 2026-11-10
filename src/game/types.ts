import type { Path } from './path';
import type { Enemy } from './enemy';
import type { Tower } from './tower';
import type { Projectile } from './projectile';
import type { Effects } from './effects';
import type { EnemyKind, TargetMode } from './config';

/** Клетка, пригодная для башни: центр, индексы в сетке, что на ней стоит. */
export interface Plot {
  x: number;
  y: number;
  col: number;
  row: number;
  tower: Tower | null;
}

export interface SporeCloud {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  slow: number;
  dps: number;
  poisonDur: number;
  /** Разовое оглушение при входе (специализация «Дурман»), с. */
  stun: number;
  stunned: Set<Enemy>;
  /** Вариант отрисовки облака. */
  variant: number;
}

/** Тот, кто может держать врага на тропе: солдат казармы или герой. */
export interface Blocker {
  x: number;
  y: number;
  dead: boolean;
  target: Enemy | null;
  blocking: boolean;
  takeDamage(a: number, g: GameCtx): void;
  /** Отброшен «Напором» босса из точки (fromX, fromY) на dur секунд. */
  stagger(dur: number, fromX: number, fromY: number): void;
}

/** Звуковые события ядра: Game превращает их в синтезированные эффекты, симуляция игнорирует. */
export type SoundId =
  | 'click' | 'build' | 'hammer' | 'done' | 'upgrade' | 'sell' | 'noGold'
  | 'shotAcid' | 'shotCatapult' | 'impact' | 'acidHit' | 'spore' | 'hit'
  | 'die' | 'dieBig' | 'leak' | 'wave' | 'spellAcid' | 'spellRetinue' | 'spellSpores'
  | 'summon' | 'ability' | 'fell' | 'stomp' | 'win' | 'lose';

/** То, что сущностям нужно знать об игре. Game реализует этот интерфейс. */
export interface GameCtx {
  readonly paths: Path[];
  enemies: Enemy[];
  projectiles: Projectile[];
  clouds: SporeCloud[];
  readonly effects: Effects;
  readonly time: number;
  addGold(n: number, x?: number, y?: number): void;
  loseLives(n: number): void;
  spawnEnemy(kind: EnemyKind, hpMul: number, pathIndex: number): Enemy;
  /** Появление врага прямо на тропе, в заданной точке по дистанции (призыв матки). */
  spawnEnemyAt(kind: EnemyKind, hpMul: number, path: Path, progress: number): void;
  onEnemyKilled(e: Enemy): void;
  /** Статистика урона по источникам для баланса. */
  recordDamage(source: string, amount: number): void;
  /** Урон защитникам (солдатам и герою) в радиусе: взрыв подрывника; со stagger ещё и оглушение («Напор» босса). */
  damageDefenders(x: number, y: number, radius: number, damage: number, stagger?: number): void;
  /** Множитель награды за врага (сложность). */
  readonly bountyMul: number;
  /** Общий для всех башен режим выбора цели. */
  readonly targetMode: TargetMode;
  /** Звуковое событие; в симуляции ничего не делает. */
  sound(id: SoundId): void;
}
