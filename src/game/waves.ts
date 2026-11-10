import { EARLY_CALL_BONUS_PER_SEC, FIRST_WAVE_DELAY, HP_GROWTH_PER_WAVE, WAVE_DELAY, type EnemyKind, type WaveDef } from './config';
import type { GameCtx } from './types';
import { FADE_IN } from './enemy';

export interface Spawner {
  kind: EnemyKind;
  left: number;
  interval: number;
  timer: number;
  hpMul: number;
  path: number;
  /** Номер волны (с 1): враги помнят, из какой они волны, по этому считается, какие волны отбиты. */
  wave: number;
  /** Группа только что вышла: её первый враг не был виден на подходе и проявляется на месте. */
  fresh: boolean;
}

/** Откуда берутся волны: готовый список уровня или генератор бесконечной осады (n с 1). */
export type WaveSource = readonly WaveDef[] | ((n: number) => WaveDef);

export interface WaveOptions {
  /** Пауза между волнами, с. */
  delay?: number;
  /** Множитель здоровья врагов n-й волны (с 1). */
  hpMul?: (n: number) => number;
}

/**
 * Волны как в Kingdom Rush: пока текущая волна выходит, кнопка недоступна;
 * как только все вышли, идёт отсчёт до следующей, и её можно позвать раньше за бонус.
 */
export class WaveManager {
  index = 0;
  countdown: number | null = FIRST_WAVE_DELAY;
  /** Обучение держит следующую волну, пока игрок не выполнит задание: отсчёт стоит, звать нельзя. */
  hold = false;
  /** Число волн; у бесконечной осады Infinity. */
  readonly total: number;
  private spawners: Spawner[] = [];
  private readonly delay: number;
  private readonly hpMulOf: (n: number) => number;

  constructor(private readonly source: WaveSource, opts: WaveOptions = {}) {
    this.total = typeof source === 'function' ? Infinity : source.length;
    this.delay = opts.delay ?? WAVE_DELAY;
    this.hpMulOf = opts.hpMul ?? ((n) => 1 + HP_GROWTH_PER_WAVE * (n - 1));
  }

  get endless(): boolean { return !Number.isFinite(this.total); }
  get spawning(): boolean { return this.spawners.length > 0; }
  /** Ещё не вышедшие группы текущей волны: по ним на полях экрана рисуются враги на подходе. */
  get queue(): readonly Readonly<Spawner>[] { return this.spawners; }
  get canCall(): boolean { return !this.hold && this.index < this.total && this.countdown !== null; }
  get bonus(): number { return this.countdown !== null ? Math.floor(this.countdown * EARLY_CALL_BONUS_PER_SEC) : 0; }

  /** Волна с номером n (с 1). */
  wave(n: number): WaveDef {
    const s = this.source;
    return typeof s === 'function' ? s(n) : s[n - 1];
  }

  finished(g: GameCtx): boolean {
    return this.index >= this.total && !this.spawning && g.enemies.length === 0;
  }

  /** Дев-режим: считать все волны выпущенными (в бесконечной осаде просто убрать текущую). */
  skipAll(): void {
    this.spawners = [];
    if (this.endless) {
      if (this.countdown === null) this.countdown = this.delay;
      return;
    }
    this.index = this.total;
    this.countdown = null;
  }

  callNext(g: GameCtx): boolean {
    if (!this.canCall) return false;
    const bonus = this.bonus;
    if (bonus > 0) g.addGold(bonus);
    this.index++;
    const wave = this.wave(this.index);
    const hpMul = this.hpMulOf(this.index);
    for (const grp of wave.groups) {
      this.spawners.push({
        kind: grp.kind, left: grp.count, interval: grp.interval, timer: grp.delay, hpMul,
        path: grp.path ?? 0, wave: this.index, fresh: true,
      });
    }
    this.countdown = null;
    g.sound('wave');
    return true;
  }

  update(dt: number, g: GameCtx): void {
    for (const s of this.spawners) {
      s.timer -= dt;
      while (s.timer <= 0 && s.left > 0) {
        const e = g.spawnEnemy(s.kind, s.hpMul, s.path);
        e.wave = s.wave;
        if (s.fresh) e.fadeIn = FADE_IN;
        s.left--;
        s.timer += s.interval;
      }
      s.fresh = false;
    }
    this.spawners = this.spawners.filter((s) => s.left > 0);
    if (!this.spawning && this.countdown === null && this.index < this.total) this.countdown = this.delay;
    if (this.countdown !== null && !this.hold) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.callNext(g);
      }
    }
  }
}
