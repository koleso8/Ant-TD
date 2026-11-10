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
  /** Группа только что вышла: её первый враг не был виден на подходе и проявляется на месте. */
  fresh: boolean;
}

/**
 * Волны как в Kingdom Rush: пока текущая волна выходит, кнопка недоступна;
 * как только все вышли, идёт отсчёт до следующей, и её можно позвать раньше за бонус.
 */
export class WaveManager {
  index = 0;
  countdown: number | null = FIRST_WAVE_DELAY;
  private spawners: Spawner[] = [];

  constructor(readonly waves: readonly WaveDef[]) {}

  get total(): number { return this.waves.length; }
  get spawning(): boolean { return this.spawners.length > 0; }
  /** Ещё не вышедшие группы текущей волны: по ним на полях экрана рисуются враги на подходе. */
  get queue(): readonly Readonly<Spawner>[] { return this.spawners; }
  get canCall(): boolean { return this.index < this.total && this.countdown !== null; }
  get bonus(): number { return this.countdown !== null ? Math.floor(this.countdown * EARLY_CALL_BONUS_PER_SEC) : 0; }

  finished(g: GameCtx): boolean {
    return this.index >= this.total && !this.spawning && g.enemies.length === 0;
  }

  /** Дев-режим: считать все волны выпущенными. */
  skipAll(): void {
    this.index = this.total;
    this.spawners = [];
    this.countdown = null;
  }

  callNext(g: GameCtx): boolean {
    if (!this.canCall) return false;
    const bonus = this.bonus;
    if (bonus > 0) g.addGold(bonus);
    const wave = this.waves[this.index];
    this.index++;
    const hpMul = 1 + HP_GROWTH_PER_WAVE * (this.index - 1);
    for (const grp of wave.groups) {
      this.spawners.push({ kind: grp.kind, left: grp.count, interval: grp.interval, timer: grp.delay, hpMul, path: grp.path ?? 0, fresh: true });
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
        if (s.fresh) e.fadeIn = FADE_IN;
        s.left--;
        s.timer += s.interval;
      }
      s.fresh = false;
    }
    this.spawners = this.spawners.filter((s) => s.left > 0);
    if (!this.spawning && this.countdown === null && this.index < this.total) this.countdown = WAVE_DELAY;
    if (this.countdown !== null) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.callNext(g);
      }
    }
  }
}
