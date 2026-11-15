import type { DifficultyId } from './config';

/**
 * Зерно — валюта колонии. Его приносят бои и дар дня, тратится оно на отстройку муравейника.
 * Звёзды остаются как были: они открывают акты и идут на улучшения колонии.
 */

/** За каждую новую звезду карты: звезда даётся один раз, и зерно за неё тоже. */
export const GRAIN_PER_STAR = 15;
/** Обучение пройдено впервые: первое зерно в кладовую. */
export const GRAIN_TUTORIAL = 30;
/** Бесконечная осада: за каждую отбитую волну. */
export const GRAIN_PER_WAVE = 2;

/** На сложной труднее, и платят щедрее; на лёгкой поменьше. */
const DIFF_MUL: Record<DifficultyId, number> = { easy: 0.75, normal: 1, hard: 1.5 };

/** Победа на карте кампании: основа растёт с актом и сложностью, плюс зерно за новые звёзды. */
export function winGrain(act: number, diff: DifficultyId, newStars: number): number {
  return Math.round((10 + 2 * act) * DIFF_MUL[diff]) + newStars * GRAIN_PER_STAR;
}

/** Поражение на карте кампании: по зерну за отбитую волну, чтобы бой не прошёл впустую. */
export function lossGrain(waves: number, diff: DifficultyId): number {
  return Math.round(waves * DIFF_MUL[diff]);
}

/** Бесконечная осада: за все отбитые волны забега. */
export function endlessGrain(waves: number, diff: DifficultyId): number {
  return Math.round(waves * GRAIN_PER_WAVE * DIFF_MUL[diff]);
}

// ───────────── дар дня ─────────────

/** Дар дня: календарь на семь дней, к седьмому зерна больше всего. После седьмого снова первый. */
export const DAILY_GIFTS: readonly number[] = [20, 30, 40, 50, 60, 80, 150];

export interface DailyState {
  /** Местная дата последнего взятого дара, ГГГГ-ММ-ДД; null — ещё ни разу. */
  last: string | null;
  /** Какой день календаря взят последним, 1..7; 0 — ещё ни разу. */
  day: number;
}

export interface DailyStatus {
  /** Дар сегодня ещё не взят. */
  ready: boolean;
  /** День календаря: тот, что можно взять сейчас, или уже взятый сегодня. */
  day: number;
  /** Пропущен день, и серия началась заново с первого. */
  reset: boolean;
}

/** Местная дата в виде ГГГГ-ММ-ДД: день сменяется в полночь по часам игрока. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Взят ли дар сегодня и какой день календаря на очереди. Пропуск дня сбрасывает серию на первый. */
export function dailyStatus(s: DailyState, now = new Date()): DailyStatus {
  if (s.last === dateKey(now)) return { ready: false, day: Math.max(1, s.day), reset: false };
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (s.last === dateKey(yesterday) && s.day > 0) return { ready: true, day: (s.day % DAILY_GIFTS.length) + 1, reset: false };
  return { ready: true, day: 1, reset: s.last !== null };
}

/** Сколько миллисекунд до местной полуночи: тогда созреет следующий дар. */
export function msToMidnight(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}
