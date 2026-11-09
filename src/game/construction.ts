import { angleTo, dist, type Vec } from '../engine/math';
import type { Tower } from './tower';

export type BuilderRole = 'hammer' | 'ladderFront' | 'ladderBack';

export interface Builder {
  role: BuilderRole;
  x: number;
  y: number;
  angle: number;
  legPhase: number;
  /** Рабочее место у башни. */
  post: Vec;
  /** Куда бежит сейчас: к посту или домой. */
  target: Vec;
  /** Своя скорость, чтобы все трое прибыли одновременно. */
  speed: number;
  arrived: boolean;
}

/** Скорость строителей: быстрее любого врага, чтобы стройка не тянулась. */
export const BUILDER_SPEED = 460;
/** Сколько секунд строители стучат молотками у новой башни и при улучшении. */
export const BUILD_WORK = 1.8;
export const UPGRADE_WORK = 1.4;

export type ConstructionPhase = 'go' | 'work' | 'back' | 'done';

/**
 * Стройка: трое рабочих в касках выбегают из муравейника с молотком и лестницей,
 * возводят башню (она растёт из земли) и бегут обратно. Здесь только хореография;
 * готовность башни считает сама башня по длительности стройки.
 */
export class Construction {
  phase: ConstructionPhase = 'go';
  readonly builders: Builder[];
  /** Время пути в одну сторону. */
  readonly travel: number;
  readonly workTime: number;
  elapsed = 0;
  /** Фаза ударов молотком. */
  hammer = 0;
  private puffTimer = 0.3;

  constructor(readonly tower: Tower, readonly home: Vec, upgrade: boolean) {
    const mainDist = Math.max(60, dist(home.x, home.y, tower.x, tower.y));
    this.travel = mainDist / BUILDER_SPEED;
    this.workTime = upgrade ? UPGRADE_WORK : BUILD_WORK;
    // Посты вокруг башни: молотобоец слева, носильщики лестницы справа у её подножия.
    const posts: Record<BuilderRole, Vec> = {
      hammer: { x: tower.x - 30, y: tower.y + 16 },
      ladderFront: { x: tower.x + 30, y: tower.y + 20 },
      ladderBack: { x: tower.x + 46, y: tower.y + 30 },
    };
    const roles: BuilderRole[] = ['hammer', 'ladderFront', 'ladderBack'];
    this.builders = roles.map((role, i) => {
      const start = { x: home.x + (i - 1) * 12, y: home.y + 8 + (i % 2) * 4 };
      const post = posts[role];
      return {
        role,
        x: start.x,
        y: start.y,
        angle: angleTo(start.x, start.y, post.x, post.y),
        legPhase: i * 2.1,
        post,
        target: post,
        speed: dist(start.x, start.y, post.x, post.y) / this.travel,
        arrived: false,
      };
    });
  }

  /** Полное время до готовности башни. */
  get duration(): number {
    return this.travel + this.workTime;
  }
  get done(): boolean {
    return this.phase === 'done';
  }
  /** Прогресс самой башни: 0, пока бегут, затем до 1 за время работы. */
  get progress(): number {
    return Math.max(0, Math.min(1, (this.elapsed - this.travel) / this.workTime));
  }

  /** Башню продали: все бегут домой. */
  cancel(): void {
    if (this.phase === 'go' || this.phase === 'work') this.goHome();
  }

  update(dt: number, puff: (x: number, y: number) => void): void {
    this.elapsed += dt;
    switch (this.phase) {
      case 'go':
        if (this.moveAll(dt)) this.phase = 'work';
        break;
      case 'work': {
        this.hammer += dt * 10;
        const t = this.tower;
        for (const b of this.builders) b.angle = angleTo(b.x, b.y, t.x, t.y - 10);
        this.puffTimer -= dt;
        if (this.puffTimer <= 0) {
          this.puffTimer = 0.35;
          puff(t.x + (Math.random() - 0.5) * 44, t.y + 8 - Math.random() * 30);
        }
        if (this.elapsed >= this.duration) this.goHome();
        break;
      }
      case 'back':
        if (this.moveAll(dt)) this.phase = 'done';
        break;
      default:
        break;
    }
  }

  private goHome(): void {
    this.phase = 'back';
    for (const b of this.builders) {
      b.target = { x: this.home.x + (Math.random() - 0.5) * 16, y: this.home.y + 8 };
      b.speed = BUILDER_SPEED;
      b.arrived = false;
    }
  }

  /** Двигает всех к целям; true, когда все на месте. */
  private moveAll(dt: number): boolean {
    let all = true;
    for (const b of this.builders) {
      if (b.arrived) continue;
      const d = dist(b.x, b.y, b.target.x, b.target.y);
      const step = b.speed * dt;
      if (d <= step) {
        b.x = b.target.x;
        b.y = b.target.y;
        b.arrived = true;
        continue;
      }
      b.angle = angleTo(b.x, b.y, b.target.x, b.target.y);
      b.x += Math.cos(b.angle) * step;
      b.y += Math.sin(b.angle) * step;
      b.legPhase += dt * b.speed * 0.14;
      all = false;
    }
    return all;
  }
}
