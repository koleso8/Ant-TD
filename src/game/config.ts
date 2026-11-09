export const LOGICAL_W = 1280;
export const LOGICAL_H = 720;
/** Клетка застройки: поле ровно 16×9 клеток, башня занимает одну. */
export const CELL = 80;

export const START_GOLD = 300;
export const START_LIVES = 20;
export const SELL_RATIO = 0.6;
export const FIRST_WAVE_DELAY = 30;
export const WAVE_DELAY = 26;
export const EARLY_CALL_BONUS_PER_SEC = 1.5;
export const HP_GROWTH_PER_WAVE = 0.04;

export type DifficultyId = 'easy' | 'normal' | 'hard';
export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  desc: string;
  /** Множитель здоровья врагов. */
  hpMul: number;
  /** Множитель стартового нектара и наград за врагов. */
  goldMul: number;
  /** Множитель числа личинок. */
  livesMul: number;
}
/** Сложность выбирается перед уровнем и запоминается; баланс в levels.ts рассчитан на «Нормально». */
export const DIFFICULTIES: readonly DifficultyDef[] = [
  { id: 'easy', name: 'Легко', desc: 'Враги слабее, нектара больше: можно спокойно разглядывать башни.', hpMul: 0.85, goldMul: 1.15, livesMul: 1 },
  { id: 'normal', name: 'Нормально', desc: 'Как задумано: придётся думать, где ставить башни и что улучшать.', hpMul: 1.0, goldMul: 1, livesMul: 1 },
  { id: 'hard', name: 'Сложно', desc: 'Крепкие враги и вдвое меньше личинок: права на ошибку почти нет. Для ветеранов.', hpMul: 1.15, goldMul: 1, livesMul: 0.5 },
];

export type SpellId = 'acid' | 'retinue' | 'spores';
export interface SpellDef {
  id: SpellId;
  name: string;
  desc: string;
  /** Подсказка клавиши на ПК. */
  key: string;
  cooldown: number;
  radius: number;
  /** Кислотный дождь: урон каждому в круге, панцирь не учитывается. */
  damage?: number;
  /** Дружина и туча: сколько секунд держится. */
  duration?: number;
}
/** Заклинания колонии в хотбаре: тап по кнопке, затем по точке на поле. */
export const SPELLS: readonly SpellDef[] = [
  { id: 'acid', name: 'Кислотный дождь', key: 'Q', cooldown: 24, radius: 90, damage: 140, desc: 'Рабочие разом плюют кислотой: урон всем в круге, панцирь не спасает, достаёт и летающих.' },
  { id: 'retinue', name: 'Дружина', key: 'W', cooldown: 32, radius: 60, duration: 16, desc: 'Воевода Жвал с двумя солдатами выходит в точку и держит врагов, пока не выдохнется.' },
  { id: 'spores', name: 'Споровая туча', key: 'E', cooldown: 26, radius: 75, duration: 8, desc: 'Облако спор на тропе: враги в нём замедлены вдвое, отравлены и оглушены на входе.' },
];

export type TowerKind = 'acid' | 'barracks' | 'catapult' | 'spore';

/** Кого бьёт башня, когда в радиусе несколько врагов. Переключается кнопкой с прицелом в меню башни. */
export type TargetMode = 'first' | 'last' | 'near' | 'strong' | 'weak';
export interface TargetModeDef {
  id: TargetMode;
  name: string;
  /** Короткая подпись на кнопке. */
  short: string;
  desc: string;
}
export const TARGET_MODES: readonly TargetModeDef[] = [
  { id: 'first', name: 'Первый', short: 'Перв.', desc: 'Бьёт того, кто ближе всех к муравейнику.' },
  { id: 'last', name: 'Последний', short: 'Посл.', desc: 'Бьёт того, кто дальше всех от муравейника: только вошёл в радиус.' },
  { id: 'near', name: 'Ближний', short: 'Ближ.', desc: 'Бьёт ближайшего к самой башне.' },
  { id: 'strong', name: 'Крепкий', short: 'Креп.', desc: 'Бьёт врага с самым большим запасом здоровья.' },
  { id: 'weak', name: 'Слабый', short: 'Слаб.', desc: 'Добивает врага с самым малым здоровьем.' },
];
export type EnemyKind =
  | 'termite' | 'spider' | 'beetle' | 'wasp' | 'rhino' | 'soldierTermite' | 'blackAnt' | 'hornet' | 'slug' | 'queen'
  | 'dragonfly' | 'leech' | 'bomber' | 'empress';

export interface TowerLevel {
  cost: number;
  range: number;
  damage?: readonly [number, number];
  interval?: number;
  splash?: number;
  flightTime?: number;
  slow?: number;
  poisonDps?: number;
  poisonDur?: number;
  cloudRadius?: number;
  cloudDur?: number;
  soldierHp?: number;
  soldierDmg?: readonly [number, number];
  respawn?: number;
}

/** Специализация 4-го уровня: своя статистика и одна особая механика. */
export interface SpecDef {
  name: string;
  short: string;
  desc: string;
  cost: number;
  stats: TowerLevel;
  /** Стрелки: плевков за выстрел, по разным целям. */
  multishot?: number;
  /** Доля панциря, которую урон игнорирует (0..1). */
  armorPierce?: number;
  /** Катапульта: оглушение всех в зоне взрыва, с. */
  stunOnHit?: number;
  /** Катапульта: снарядов за выстрел, веером. */
  volley?: number;
  /** Казарма: число солдат. */
  soldiers?: number;
  /** Казарма: броня солдат (0..1). */
  soldierArmor?: number;
  /** Грибница: разовое оглушение при входе в облако, с. */
  cloudStun?: number;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  short: string;
  desc: string;
  hitsAir: boolean;
  hitsGround: boolean;
  levels: readonly TowerLevel[];
  specs: readonly [SpecDef, SpecDef];
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  acid: {
    kind: 'acid',
    name: 'Кислотные стрелки',
    short: 'Стрелки',
    desc: 'Муравьи плюются муравьиной кислотой. Быстро, точно, достают и летающих.',
    hitsAir: true,
    hitsGround: true,
    levels: [
      { cost: 70, range: 135, damage: [8, 12], interval: 0.7 },
      { cost: 95, range: 150, damage: [13, 19], interval: 0.65 },
      { cost: 130, range: 165, damage: [22, 32], interval: 0.55 },
    ],
    specs: [
      {
        name: 'Снайперы', short: 'Снайперы', cost: 190,
        desc: 'Один меткий плевок издалека. Пробивает 60% панциря.',
        stats: { cost: 190, range: 215, damage: [60, 90], interval: 1.4 },
        armorPierce: 0.6,
      },
      {
        name: 'Залп', short: 'Залп', cost: 180,
        desc: 'Два плевка за выстрел по разным целям, очень часто.',
        stats: { cost: 180, range: 170, damage: [20, 28], interval: 0.5 },
        multishot: 2,
      },
    ],
  },
  barracks: {
    kind: 'barracks',
    name: 'Казарма солдат',
    short: 'Казарма',
    desc: 'Три муравья-солдата перекрывают тропу и держат врага в ближнем бою.',
    hitsAir: false,
    hitsGround: true,
    levels: [
      { cost: 90, range: 70, soldierHp: 70, soldierDmg: [4, 8], respawn: 10 },
      { cost: 110, range: 70, soldierHp: 120, soldierDmg: [8, 14], respawn: 9 },
      { cost: 150, range: 70, soldierHp: 190, soldierDmg: [14, 22], respawn: 8 },
    ],
    specs: [
      {
        name: 'Броненосцы', short: 'Броненосцы', cost: 200,
        desc: 'Солдаты в панцирях из гальки: вдвое больше здоровья и 40% брони.',
        stats: { cost: 200, range: 70, soldierHp: 340, soldierDmg: [16, 24], respawn: 8 },
        soldierArmor: 0.4,
      },
      {
        name: 'Жнецы', short: 'Жнецы', cost: 210,
        desc: 'Четверо быстрых бойцов с огромным уроном, но без брони.',
        stats: { cost: 210, range: 70, soldierHp: 170, soldierDmg: [26, 40], respawn: 7 },
        soldiers: 4,
      },
    ],
  },
  catapult: {
    kind: 'catapult',
    name: 'Семенная катапульта',
    short: 'Катапульта',
    desc: 'Листорезы швыряют семена: медленно, зато по площади. Летающих не достаёт.',
    hitsAir: false,
    hitsGround: true,
    levels: [
      { cost: 120, range: 175, damage: [24, 44], interval: 2.4, splash: 64, flightTime: 0.9 },
      { cost: 150, range: 185, damage: [40, 72], interval: 2.2, splash: 70, flightTime: 0.9 },
      { cost: 200, range: 200, damage: [64, 110], interval: 2.0, splash: 78, flightTime: 0.85 },
    ],
    specs: [
      {
        name: 'Камнемёт', short: 'Камнемёт', cost: 240,
        desc: 'Один валун: огромный урон и оглушение всех в зоне падения.',
        stats: { cost: 240, range: 210, damage: [150, 230], interval: 3.4, splash: 60, flightTime: 1.0 },
        stunOnHit: 1.0,
      },
      {
        name: 'Семенной дождь', short: 'Дождь', cost: 230,
        desc: 'Три семени веером: накрывают целую толпу.',
        stats: { cost: 230, range: 205, damage: [38, 64], interval: 2.0, splash: 52, flightTime: 0.9 },
        volley: 3,
      },
    ],
  },
  spore: {
    kind: 'spore',
    name: 'Грибница',
    short: 'Грибница',
    desc: 'Споровые облака замедляют и травят всех вокруг. Яд не замечает панцирь.',
    hitsAir: true,
    hitsGround: true,
    levels: [
      { cost: 100, range: 125, interval: 2.6, slow: 0.4, poisonDps: 6, poisonDur: 2.5, cloudRadius: 70, cloudDur: 3.2 },
      { cost: 130, range: 135, interval: 2.4, slow: 0.5, poisonDps: 11, poisonDur: 2.5, cloudRadius: 76, cloudDur: 3.4 },
      { cost: 170, range: 150, interval: 2.2, slow: 0.6, poisonDps: 18, poisonDur: 3, cloudRadius: 84, cloudDur: 3.6 },
    ],
    specs: [
      {
        name: 'Гниль', short: 'Гниль', cost: 200,
        desc: 'Яд втрое сильнее, облака крупнее и держатся дольше.',
        stats: { cost: 200, range: 165, interval: 2.2, slow: 0.4, poisonDps: 40, poisonDur: 4, cloudRadius: 95, cloudDur: 4.5 },
      },
      {
        name: 'Дурман', short: 'Дурман', cost: 210,
        desc: 'Облако почти останавливает врагов и оглушает каждого, кто в него входит.',
        stats: { cost: 210, range: 155, interval: 2.4, slow: 0.75, poisonDps: 12, poisonDur: 3, cloudRadius: 85, cloudDur: 4 },
        cloudStun: 1.0,
      },
    ],
  },
};

export const TOWER_ORDER: readonly TowerKind[] = ['acid', 'barracks', 'spore', 'catapult'];

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  armor: number;
  bounty: number;
  livesCost: number;
  flying: boolean;
  radius: number;
  meleeDmg: readonly [number, number];
  meleeInterval: number;
  /** Восстановление здоровья в секунду. */
  regen?: number;
  /** Призыв: пока жив, каждые `every` секунд выпускает `count` врагов `kind` позади себя. */
  spawn?: { kind: EnemyKind; every: number; count: number };
  /** Взрыв при смерти: урон защитникам (солдатам и герою) в радиусе. */
  explode?: { radius: number; damage: number };
  /** Босс: его нельзя держать дольше hold секунд, затем «Напор» (см. BossDef). */
  boss?: BossDef;
}

/**
 * Босс: после hold секунд удержания делает «Напор»: урон damage и оглушение на stagger секунд
 * всем защитникам в radius, а затем charge секунд идёт быстрее в speedMul раз, и его нельзя держать.
 */
export interface BossDef {
  hold: number;
  charge: number;
  speedMul: number;
  radius: number;
  damage: number;
  stagger: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  termite: { kind: 'termite', name: 'Термит', hp: 46, speed: 72, armor: 0, bounty: 5, livesCost: 1, flying: false, radius: 12, meleeDmg: [3, 5], meleeInterval: 1.0 },
  spider: { kind: 'spider', name: 'Паук', hp: 88, speed: 92, armor: 0.1, bounty: 8, livesCost: 1, flying: false, radius: 15, meleeDmg: [6, 10], meleeInterval: 1.0 },
  beetle: { kind: 'beetle', name: 'Жук-щитоносец', hp: 200, speed: 46, armor: 0.45, bounty: 15, livesCost: 1, flying: false, radius: 18, meleeDmg: [8, 14], meleeInterval: 1.4 },
  wasp: { kind: 'wasp', name: 'Оса', hp: 72, speed: 92, armor: 0, bounty: 10, livesCost: 1, flying: true, radius: 13, meleeDmg: [0, 0], meleeInterval: 9 },
  soldierTermite: { kind: 'soldierTermite', name: 'Термит-солдат', hp: 150, speed: 58, armor: 0.3, bounty: 9, livesCost: 1, flying: false, radius: 14, meleeDmg: [9, 15], meleeInterval: 1.1 },
  blackAnt: { kind: 'blackAnt', name: 'Чёрный муравей', hp: 72, speed: 102, armor: 0.05, bounty: 8, livesCost: 1, flying: false, radius: 13, meleeDmg: [7, 11], meleeInterval: 0.9 },
  hornet: { kind: 'hornet', name: 'Шершень', hp: 160, speed: 98, armor: 0.1, bounty: 14, livesCost: 1, flying: true, radius: 16, meleeDmg: [0, 0], meleeInterval: 9 },
  slug: { kind: 'slug', name: 'Слизень', hp: 540, speed: 24, armor: 0, bounty: 24, livesCost: 2, flying: false, radius: 22, meleeDmg: [10, 16], meleeInterval: 1.6, regen: 5 },
  rhino: {
    kind: 'rhino', name: 'Жук-носорог', hp: 2200, speed: 34, armor: 0.5, bounty: 250, livesCost: 5, flying: false, radius: 28,
    meleeDmg: [22, 34], meleeInterval: 1.5, boss: { hold: 6, charge: 4, speedMul: 1.4, radius: 70, damage: 40, stagger: 1.5 },
  },
  queen: {
    kind: 'queen', name: 'Термитная матка', hp: 3000, speed: 20, armor: 0.3, bounty: 400, livesCost: 10, flying: false, radius: 34,
    meleeDmg: [18, 28], meleeInterval: 1.6, regen: 4, spawn: { kind: 'termite', every: 8, count: 2 },
    boss: { hold: 6, charge: 4, speedMul: 1.25, radius: 85, damage: 55, stagger: 1.8 },
  },
  dragonfly: { kind: 'dragonfly', name: 'Стрекоза', hp: 150, speed: 102, armor: 0.1, bounty: 18, livesCost: 1, flying: true, radius: 18, meleeDmg: [0, 0], meleeInterval: 9 },
  leech: { kind: 'leech', name: 'Пиявка', hp: 360, speed: 36, armor: 0, bounty: 20, livesCost: 2, flying: false, radius: 18, meleeDmg: [8, 14], meleeInterval: 1.4, regen: 6 },
  bomber: {
    kind: 'bomber', name: 'Термит-подрывник', hp: 60, speed: 80, armor: 0, bounty: 7, livesCost: 1, flying: false, radius: 13,
    meleeDmg: [4, 6], meleeInterval: 1.0, explode: { radius: 64, damage: 45 },
  },
  empress: {
    kind: 'empress', name: 'Королева термитов', hp: 5600, speed: 16, armor: 0.4, bounty: 800, livesCost: 20, flying: false, radius: 42,
    meleeDmg: [28, 40], meleeInterval: 1.5, regen: 8, spawn: { kind: 'soldierTermite', every: 9, count: 2 },
    boss: { hold: 5, charge: 5, speedMul: 1.2, radius: 100, damage: 80, stagger: 2 },
  },
};

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  interval: number;
  delay: number;
  /** Индекс тропы уровня; по умолчанию первая. */
  path?: number;
}
export interface WaveDef {
  groups: readonly WaveGroup[];
}

export interface HeroLevel {
  hp: number;
  dmg: readonly [number, number];
  armor: number;
  abilityDmg: number;
}

/** Герой: муравей-воевода. Ближний бой, держит одного врага, растёт от убийств. */
export const HERO = {
  name: 'Жвал',
  title: 'воевода муравейника',
  desc: 'Выходит на поле заклинанием «Дружина»: держит врага, бьёт всех рядом и сам пускает «Жвалы». По воздуху не бьёт.',
  levels: [
    { hp: 220, dmg: [12, 20], armor: 0.2, abilityDmg: 45 },
    { hp: 270, dmg: [16, 26], armor: 0.25, abilityDmg: 65 },
    { hp: 330, dmg: [21, 33], armor: 0.3, abilityDmg: 90 },
    { hp: 400, dmg: [27, 41], armor: 0.35, abilityDmg: 120 },
    { hp: 480, dmg: [34, 50], armor: 0.4, abilityDmg: 160 },
  ] as readonly HeroLevel[],
  /** С какого уровня выходит без перков; перк «Закалка воеводы» добавляет по уровню за ранг. */
  baseLevel: 3,
  /** Сколько секунд дружина остаётся на поле. */
  summonDuration: 16,
  /** Солдаты дружины: здоровье и урон. */
  retinueHp: 110,
  retinueDmg: [8, 14] as readonly [number, number],
  speed: 150,
  attackInterval: 0.8,
  regenPerSec: 16,
  regenDelay: 2.5,
  engageRadius: 120,
  leash: 210,
  abilityName: 'Жвалы',
  abilityRadius: 78,
  abilityCooldown: 14,
  abilityStun: 1.3,
};
