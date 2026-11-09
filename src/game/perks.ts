import type { TowerKind, TowerLevel } from './config';

/** Перк: постоянное улучшение, покупается за звёзды между уровнями. */
export interface PerkDef {
  id: string;
  name: string;
  maxRank: number;
  /** Звёзд за один ранг. */
  cost: number;
  /** Описание эффекта при данном ранге (1..maxRank). */
  desc: (rank: number) => string;
}

export const PERKS: readonly PerkDef[] = [
  { id: 'acidDmg', name: 'Едкая кислота', maxRank: 3, cost: 1, desc: (r) => `Урон стрелков +${r * 10}%` },
  { id: 'soldierHp', name: 'Крепкий хитин', maxRank: 3, cost: 1, desc: (r) => `Здоровье солдат казармы и дружины +${r * 15}%` },
  { id: 'spore', name: 'Густые споры', maxRank: 3, cost: 1, desc: (r) => `Яд грибницы и споровой тучи +${r * 12}%, облака держатся дольше` },
  { id: 'catapultDmg', name: 'Тяжёлые семена', maxRank: 3, cost: 1, desc: (r) => `Урон катапульты +${r * 12}%` },
  { id: 'bounty', name: 'Запасливые фуражиры', maxRank: 2, cost: 1, desc: (r) => `Нектар за каждого врага +${r * 10}%` },
  { id: 'startGold', name: 'Полные кладовые', maxRank: 2, cost: 1, desc: (r) => `Стартовый нектар +${r * 60}` },
  { id: 'hero', name: 'Закалка воеводы', maxRank: 2, cost: 1, desc: (r) => `Жвал выходит на ${r} ур. выше, перезарядка заклинаний −${r * 8}%` },
  { id: 'lives', name: 'Глубокие ясли', maxRank: 2, cost: 1, desc: (r) => `+${r * 2} личинки в начале уровня` },
];

/** Сводные множители, посчитанные из рангов. */
export interface Perks {
  acidDmg: number;
  soldierHp: number;
  sporeMul: number;
  catapultDmg: number;
  bountyMul: number;
  startGold: number;
  /** На сколько уровней выше базового выходит герой. */
  heroLevelBonus: number;
  /** Множитель перезарядки заклинаний (меньше единицы — быстрее). */
  spellCdMul: number;
  extraLives: number;
}

export function perksFromRanks(ranks: Readonly<Record<string, number>>): Perks {
  const r = (id: string) => Math.max(0, Math.min(ranks[id] ?? 0, PERKS.find((p) => p.id === id)?.maxRank ?? 0));
  return {
    acidDmg: 1 + 0.1 * r('acidDmg'),
    soldierHp: 1 + 0.15 * r('soldierHp'),
    sporeMul: 1 + 0.12 * r('spore'),
    catapultDmg: 1 + 0.12 * r('catapultDmg'),
    bountyMul: 1 + 0.1 * r('bounty'),
    startGold: 60 * r('startGold'),
    heroLevelBonus: r('hero'),
    spellCdMul: 1 - 0.08 * r('hero'),
    extraLives: 2 * r('lives'),
  };
}

export const NO_PERKS: Perks = perksFromRanks({});

export function starsSpent(ranks: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const p of PERKS) total += Math.min(ranks[p.id] ?? 0, p.maxRank) * p.cost;
  return total;
}

/** Применить перки к статистике башни. */
export function applyPerks(kind: TowerKind, s: TowerLevel, p: Perks): TowerLevel {
  const scale = (d: readonly [number, number] | undefined, m: number): readonly [number, number] | undefined =>
    d ? [Math.round(d[0] * m), Math.round(d[1] * m)] : undefined;
  switch (kind) {
    case 'acid':
      return p.acidDmg === 1 ? s : { ...s, damage: scale(s.damage, p.acidDmg) };
    case 'catapult':
      return p.catapultDmg === 1 ? s : { ...s, damage: scale(s.damage, p.catapultDmg) };
    case 'barracks':
      return p.soldierHp === 1 ? s : { ...s, soldierHp: Math.round((s.soldierHp ?? 0) * p.soldierHp) };
    case 'spore':
      return p.sporeMul === 1 ? s : {
        ...s,
        poisonDps: Math.round((s.poisonDps ?? 0) * p.sporeMul),
        cloudDur: (s.cloudDur ?? 3) * (1 + (p.sporeMul - 1) * 0.5),
      };
  }
}
