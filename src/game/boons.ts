import { HERO } from './config';
import type { World } from './world';

/**
 * Дары бесконечной осады: за каждый десяток отбитых волн (счёт рекорда) игрок выбирает одно усиление
 * из трёх случайных, и оно остаётся до конца забега. Один и тот же дар можно брать снова —
 * он складывается. Дары меняют те же множители, что и перки за звёзды (World.perks).
 * Русские тексты лежат здесь, английские — в i18n.ts. Модуль без DOM.
 */
export type BoonId =
  | 'acid' | 'catapult' | 'spore' | 'rate' | 'range' | 'chitin' | 'jaws' | 'veteran' | 'spells' | 'bounty' | 'nectar' | 'brood';
/** К чему относится дар: по группе у карточки цвет ленты. */
export type BoonGroup = 'towers' | 'soldiers' | 'spells' | 'colony';

export interface BoonDef {
  id: BoonId;
  group: BoonGroup;
  name: string;
  /** Что даёт; {0} заменяется числом из value. */
  desc: string;
  /** Число для описания, если оно зависит от хода осады. */
  value?: (w: World) => number;
  /** Можно ли предложить сейчас; без поля — всегда. */
  available?: (w: World) => boolean;
  apply: (w: World) => void;
}

/** Столько отбитых волн бесконечной осады приносят один дар на выбор. */
export const BOON_EVERY = 10;

/** «Полная кладовая»: чем дальше осада, тем больше нектара. */
function nectarGift(w: World): number {
  return Math.round((200 + 20 * w.clearedWaves) / 50) * 50;
}

export const BOONS: readonly BoonDef[] = [
  { id: 'acid', group: 'towers', name: 'Жгучая кислота', desc: 'Урон плевальщиков +15%.', apply: (w) => { w.perks.acidDmg += 0.15; } },
  { id: 'catapult', group: 'towers', name: 'Каменные семена', desc: 'Урон катапульт +15%.', apply: (w) => { w.perks.catapultDmg += 0.15; } },
  {
    id: 'spore', group: 'towers', name: 'Злые споры', desc: 'Яд грибниц и споровой тучи +20%, облака держатся дольше.',
    apply: (w) => { w.perks.sporeMul += 0.2; },
  },
  {
    id: 'rate', group: 'towers', name: 'Скорострелы', desc: 'Плевальщики, катапульты и грибницы перезаряжаются на 8% быстрее.',
    apply: (w) => { w.perks.rateMul *= 0.92; },
  },
  {
    id: 'range', group: 'towers', name: 'Зоркие дозорные', desc: 'Дальность плевальщиков, катапульт и грибниц +6%.',
    apply: (w) => { w.perks.rangeMul += 0.06; },
  },
  {
    id: 'chitin', group: 'soldiers', name: 'Толстый хитин', desc: 'Здоровье солдат казарм и дружины +20%. Солдаты на поле сразу лечатся.',
    apply: (w) => {
      w.perks.soldierHp += 0.2;
      for (const t of w.towers) for (const s of t.soldiers) s.refreshStats();
    },
  },
  { id: 'jaws', group: 'soldiers', name: 'Острые жвалы', desc: 'Урон солдат казарм и дружины +20%.', apply: (w) => { w.perks.soldierDmg += 0.2; } },
  {
    id: 'veteran', group: 'soldiers', name: 'Ветеран', desc: 'Воевода Жвал выходит на поле на уровень выше.',
    available: (w) => w.hero.level < HERO.levels.length,
    apply: (w) => { w.hero.promote(); },
  },
  { id: 'spells', group: 'spells', name: 'Быстрые гонцы', desc: 'Заклинания перезаряжаются на 12% быстрее.', apply: (w) => { w.perks.spellCdMul *= 0.88; } },
  { id: 'bounty', group: 'colony', name: 'Медовая роса', desc: 'Нектара за каждого врага +15%.', apply: (w) => { w.perks.bountyMul += 0.15; } },
  { id: 'nectar', group: 'colony', name: 'Полная кладовая', desc: 'Сразу +{0} нектара.', value: nectarGift, apply: (w) => { w.addGold(nectarGift(w)); } },
  { id: 'brood', group: 'colony', name: 'Новый выводок', desc: 'Сразу +3 личинки.', apply: (w) => { w.lives += 3; } },
];

export function boonDef(id: BoonId): BoonDef {
  return BOONS.find((b) => b.id === id) ?? BOONS[0];
}

/** n разных даров на выбор из тех, что сейчас можно предложить. */
export function pickBoons(w: World, n: number, rnd: () => number = Math.random): BoonId[] {
  const pool = BOONS.filter((b) => !b.available || b.available(w)).map((b) => b.id);
  const out: BoonId[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
