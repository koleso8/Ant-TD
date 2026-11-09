import { DIFFICULTIES, TARGET_MODES, type DifficultyId, type TargetMode } from './config';
import { PERKS, starsSpent } from './perks';

/** Сохранение прогресса в localStorage: звёзды по уровням, перки, выбранная сложность. */
export interface Progress {
  version: 3;
  stars: Record<string, number>;
  perks: Record<string, number>;
  /** Выбранная сложность: запоминается между уровнями. */
  difficulty: DifficultyId;
  /** Самая высокая сложность, на которой пройден уровень (по id уровня). */
  beaten: Record<string, DifficultyId>;
  /** Общий режим цели башен: запоминается между уровнями. */
  targetMode: TargetMode;
}

const KEY = 'anthill-td-progress';

function validDifficulty(id: unknown): DifficultyId | null {
  return DIFFICULTIES.some((d) => d.id === id) ? (id as DifficultyId) : null;
}

export function defaultProgress(): Progress {
  return { version: 3, stars: {}, perks: {}, difficulty: 'normal', beaten: {}, targetMode: 'first' };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    const perks: Record<string, number> = {};
    for (const def of PERKS) {
      const r = p.perks?.[def.id] ?? 0;
      if (r > 0) perks[def.id] = Math.min(r, def.maxRank);
    }
    const beaten: Record<string, DifficultyId> = {};
    for (const [id, d] of Object.entries(p.beaten ?? {})) {
      const v = validDifficulty(d);
      if (v) beaten[id] = v;
    }
    return {
      version: 3,
      stars: { ...(p.stars ?? {}) },
      perks,
      difficulty: validDifficulty(p.difficulty) ?? 'normal',
      beaten,
      targetMode: TARGET_MODES.some((m) => m.id === p.targetMode) ? (p.targetMode as TargetMode) : 'first',
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Приватный режим или запрет хранилища: играем без сохранения.
  }
}

export function totalStars(p: Progress): number {
  let n = 0;
  for (const k of Object.keys(p.stars)) n += p.stars[k];
  return n;
}

export function freeStars(p: Progress): number {
  return Math.max(0, totalStars(p) - starsSpent(p.perks));
}

/** Порядок сложности для сравнения: чем больше, тем сложнее; -1, если не задана. */
export function difficultyRank(id: DifficultyId | undefined): number {
  return id ? DIFFICULTIES.findIndex((d) => d.id === id) : -1;
}
