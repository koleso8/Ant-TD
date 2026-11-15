import { PERKS } from './perks';

/**
 * Камеры муравейника: отстраиваются за зерно и дают постоянные улучшения в бою. Уровень камеры —
 * это ранг бывшего перка (Progress.perks), поэтому эффекты и баланс перков остались прежними,
 * поменялась только валюта: зерно вместо звёзд. Две камеры ещё под завалами: их первый уровень —
 * расчистка.
 */
export type RoomId = 'lab' | 'fungus' | 'solar' | 'hangar' | 'nursery' | 'granary' | 'workshop' | 'forage';

export interface RoomDef {
  id: RoomId;
  /** Перк, ранг которого и есть уровень камеры. */
  perk: string;
  /** Камера лежит под завалом: первый уровень дороже, в него входит расчистка. */
  rubble?: boolean;
}

/** Порядок — кого робот баланса отстраивает первым при равной цене: сперва нектар, потом урон. */
export const ROOMS: readonly RoomDef[] = [
  { id: 'forage', perk: 'bounty', rubble: true },
  { id: 'granary', perk: 'startGold' },
  { id: 'lab', perk: 'acidDmg' },
  { id: 'solar', perk: 'soldierHp' },
  { id: 'fungus', perk: 'spore' },
  { id: 'workshop', perk: 'catapultDmg', rubble: true },
  { id: 'hangar', perk: 'hero' },
  { id: 'nursery', perk: 'lives' },
];

/**
 * Зерно за уровни 1, 2, 3. Цены подобраны роботом (sim/campaign.ts): камеры отстраиваются примерно
 * так же быстро, как раньше покупались перки за звёзды, поэтому сложность карт осталась прежней.
 */
export const LEVEL_COST: readonly number[] = [15, 30, 60];
/** Расчистка завала: прибавляется к первому уровню камеры под завалом. */
export const CLEAR_COST = 40;

export function roomDef(id: RoomId): RoomDef {
  return ROOMS.find((r) => r.id === id) ?? ROOMS[0];
}

export function roomMax(r: RoomDef): number {
  return PERKS.find((p) => p.id === r.perk)?.maxRank ?? 0;
}

export function roomLevel(ranks: Readonly<Record<string, number>>, r: RoomDef): number {
  return Math.max(0, Math.min(ranks[r.perk] ?? 0, roomMax(r)));
}

/** Цена следующего уровня; null — камера отстроена полностью. */
export function roomCost(r: RoomDef, level: number): number | null {
  if (level >= roomMax(r)) return null;
  return LEVEL_COST[level] + (r.rubble && level === 0 ? CLEAR_COST : 0);
}

/** Сколько камер можно отстроить прямо сейчас: число на кнопке муравейника. */
export function affordableRooms(ranks: Readonly<Record<string, number>>, grain: number): number {
  let n = 0;
  for (const r of ROOMS) {
    const c = roomCost(r, roomLevel(ranks, r));
    if (c !== null && c <= grain) n++;
  }
  return n;
}

/**
 * Уровни камер, которые купит игрок с этим зерном, если всякий раз берёт самый дешёвый следующий
 * уровень (при равной цене — в порядке ROOMS). Для робота баланса; цены можно подменить для сравнения.
 */
export function cheapestFirst(grain: number, levelCost: readonly number[] = LEVEL_COST, clearCost = CLEAR_COST): Record<string, number> {
  const ranks: Record<string, number> = {};
  const cost = (r: RoomDef, level: number): number | null =>
    level >= roomMax(r) ? null : levelCost[level] + (r.rubble && level === 0 ? clearCost : 0);
  for (;;) {
    let best: RoomDef | null = null;
    let bestCost = Infinity;
    for (const r of ROOMS) {
      const c = cost(r, roomLevel(ranks, r));
      if (c !== null && c < bestCost) {
        best = r;
        bestCost = c;
      }
    }
    if (!best || bestCost > grain) return ranks;
    grain -= bestCost;
    ranks[best.perk] = (ranks[best.perk] ?? 0) + 1;
  }
}
