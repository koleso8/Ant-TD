import type { Vec } from '../engine/math';
import { HP_GROWTH_PER_WAVE, type WaveDef } from './config';

export const GAME_TITLE = 'Муравейник: Осада';

/** Цвета и декор карты. */
export interface LevelTheme {
  grass: string;
  grassLight: string;
  grassDark: string;
  dirt: string;
  dirtDark: string;
  /** Доли попыток декора на цветы, грибы и лужи; остальное камни, клевер, веточки, листья. */
  flowers: number;
  mushrooms: number;
  puddles: number;
  /** Ствол павшего дуба вдоль верхнего края и корни, уходящие в землю. */
  oak: boolean;
  /** Ночь: тёмная палитра, светлячки, светящиеся грибы. */
  night: boolean;
  /** Гнилой пень с норой, из которой выходят враги (нора на 20 px ниже центра). */
  stump?: Vec;
  /** Ручей поперёк карты: полоса воды, тропы через неё идут по брёвнам. */
  water?: { y: number; h: number };
  /** Стена термитника вдоль верхнего края высотой h, тропы начинаются в норах. */
  wall?: { h: number };
  /** Пещера: виньетка, камни по краям, вместо травы галька. */
  cave?: boolean;
  /** Ландшафт новых актов: свой декор, препятствия и вид полосы поперёк карты. Без него — лесная поляна. */
  biome?: Biome;
  /** Чем нарисована полоса water: вода с брёвнами, лёд, ущелье с мостиком, ручей с красным мостиком. */
  bandKind?: BandKind;
  /** Препятствия (камни, пруды, стволы, бамбук, сугробы): ни троп, ни застройки. */
  blobs?: ReadonlyArray<{ x: number; y: number; r: number }>;
}

/** Ландшафты новых актов. */
export type Biome = 'desert' | 'mountains' | 'jungle' | 'snow' | 'forest' | 'asia';
export type BandKind = 'water' | 'ice' | 'ravine' | 'koi';


export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  story: string;
  /** Тропы врагов: каждая заканчивается у входа в муравейник. */
  paths: ReadonlyArray<readonly Vec[]>;
  anthill: Vec;
  seed: number;
  startGold: number;
  lives: number;
  waves: readonly WaveDef[];
  theme: LevelTheme;
  /** Размер карты; без него карта ровно кадр 1280x720. Карта больше кадра двигается камерой. */
  size?: { w: number; h: number };
  /** Пауза между волнами, с; без неё WAVE_DELAY. */
  waveDelay?: number;
  /** Бесконечные волны: n-я волна (с 1) собирается на лету вместо списка waves. */
  waveGen?: (n: number) => WaveDef;
  /** Рост здоровья врагов от номера волны (с 1); без него общий линейный рост. */
  hpMul?: (n: number) => number;
  /** Надбавка к нектару за врагов: на большой карте обороны две, и доход должен их кормить. */
  bountyMul?: number;
}

/** Размер карты уровня в логических пикселях. */
export function levelSize(lv: LevelDef): { w: number; h: number } {
  return lv.size ?? { w: 1280, h: 720 };
}

export const MEADOW: LevelTheme = {
  grass: '#6cae47', grassLight: '#86c45c', grassDark: '#569a39',
  dirt: '#c08a4e', dirtDark: '#7d4f26',
  flowers: 0.26, mushrooms: 0.08, puddles: 0, oak: false, night: false,
};

export const ROOTS: LevelTheme = {
  grass: '#5e8f3b', grassLight: '#78a850', grassDark: '#486f2e',
  dirt: '#ad7a40', dirtDark: '#6d4420',
  flowers: 0.08, mushrooms: 0.22, puddles: 0.1, oak: true, night: false,
};

export const NIGHT: LevelTheme = {
  grass: '#33503f', grassLight: '#43664f', grassDark: '#263d30',
  dirt: '#7a6a55', dirtDark: '#4a3d31',
  flowers: 0.04, mushrooms: 0.3, puddles: 0.12, oak: false, night: true, stump: { x: 100, y: 150 },
};

const LEVEL1_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 6, interval: 1.3, delay: 0 }] },
  { groups: [{ kind: 'termite', count: 8, interval: 1.1, delay: 0 }, { kind: 'spider', count: 2, interval: 1.5, delay: 7 }] },
  { groups: [{ kind: 'spider', count: 4, interval: 1.3, delay: 0 }, { kind: 'termite', count: 8, interval: 0.9, delay: 5 }] },
  { groups: [{ kind: 'beetle', count: 2, interval: 2.4, delay: 0 }, { kind: 'termite', count: 8, interval: 0.8, delay: 4 }, { kind: 'blackAnt', count: 4, interval: 0.8, delay: 12 }] },
  { groups: [{ kind: 'wasp', count: 6, interval: 1.2, delay: 0 }, { kind: 'spider', count: 4, interval: 1.2, delay: 6 }] },
  { groups: [{ kind: 'blackAnt', count: 10, interval: 0.7, delay: 0 }, { kind: 'soldierTermite', count: 3, interval: 2.0, delay: 6 }] },
  { groups: [{ kind: 'beetle', count: 5, interval: 2.0, delay: 0 }, { kind: 'wasp', count: 5, interval: 1.1, delay: 5 }, { kind: 'slug', count: 1, interval: 1, delay: 12 }] },
  { groups: [{ kind: 'termite', count: 16, interval: 0.6, delay: 0 }, { kind: 'soldierTermite', count: 4, interval: 1.8, delay: 8 }, { kind: 'hornet', count: 2, interval: 2.0, delay: 14 }] },
  { groups: [{ kind: 'spider', count: 9, interval: 0.9, delay: 0 }, { kind: 'wasp', count: 8, interval: 0.9, delay: 6 }, { kind: 'blackAnt', count: 6, interval: 0.7, delay: 12 }] },
  { groups: [{ kind: 'slug', count: 2, interval: 4.0, delay: 0 }, { kind: 'beetle', count: 5, interval: 1.7, delay: 4 }, { kind: 'hornet', count: 3, interval: 1.6, delay: 12 }] },
  { groups: [{ kind: 'soldierTermite', count: 6, interval: 1.5, delay: 0 }, { kind: 'blackAnt', count: 8, interval: 0.7, delay: 8 }, { kind: 'wasp', count: 5, interval: 1.1, delay: 14 }, { kind: 'hornet', count: 2, interval: 1.6, delay: 20 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'beetle', count: 3, interval: 2.2, delay: 8 }, { kind: 'hornet', count: 3, interval: 1.4, delay: 12 }, { kind: 'spider', count: 5, interval: 1.1, delay: 18 }, { kind: 'slug', count: 1, interval: 3.0, delay: 24 }] },
];

/** Тропа 0 идёт слева, тропа 1 снизу; сходятся у восточного входа. */
const LEVEL2_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 6, interval: 1.3, delay: 0 }] },
  { groups: [{ kind: 'termite', count: 6, interval: 1.2, delay: 0 }, { kind: 'blackAnt', count: 4, interval: 0.9, delay: 4, path: 1 }] },
  { groups: [{ kind: 'spider', count: 4, interval: 1.3, delay: 0, path: 1 }, { kind: 'termite', count: 8, interval: 0.9, delay: 3 }] },
  { groups: [{ kind: 'soldierTermite', count: 3, interval: 2.0, delay: 0 }, { kind: 'blackAnt', count: 6, interval: 0.8, delay: 5, path: 1 }] },
  { groups: [{ kind: 'wasp', count: 6, interval: 1.2, delay: 0 }, { kind: 'spider', count: 4, interval: 1.2, delay: 4, path: 1 }] },
  { groups: [{ kind: 'beetle', count: 3, interval: 2.2, delay: 0, path: 1 }, { kind: 'termite', count: 12, interval: 0.7, delay: 4 }, { kind: 'blackAnt', count: 6, interval: 0.8, delay: 10, path: 1 }] },
  { groups: [{ kind: 'slug', count: 2, interval: 4.0, delay: 0 }, { kind: 'wasp', count: 6, interval: 1.1, delay: 5, path: 1 }] },
  { groups: [{ kind: 'soldierTermite', count: 6, interval: 1.6, delay: 0 }, { kind: 'spider', count: 8, interval: 0.9, delay: 4, path: 1 }, { kind: 'hornet', count: 2, interval: 2.0, delay: 12 }] },
  { groups: [{ kind: 'blackAnt', count: 14, interval: 0.6, delay: 0 }, { kind: 'beetle', count: 4, interval: 2.0, delay: 6, path: 1 }] },
  { groups: [{ kind: 'slug', count: 3, interval: 4.0, delay: 0, path: 1 }, { kind: 'hornet', count: 4, interval: 1.5, delay: 6 }, { kind: 'termite', count: 14, interval: 0.6, delay: 10 }] },
  { groups: [{ kind: 'beetle', count: 6, interval: 1.6, delay: 0 }, { kind: 'soldierTermite', count: 6, interval: 1.5, delay: 4, path: 1 }, { kind: 'wasp', count: 8, interval: 0.9, delay: 12 }] },
  { groups: [{ kind: 'spider', count: 10, interval: 0.8, delay: 0, path: 1 }, { kind: 'blackAnt', count: 10, interval: 0.6, delay: 4 }, { kind: 'hornet', count: 4, interval: 1.4, delay: 12, path: 1 }] },
  { groups: [{ kind: 'slug', count: 3, interval: 3.5, delay: 0 }, { kind: 'beetle', count: 5, interval: 1.6, delay: 5, path: 1 }, { kind: 'hornet', count: 5, interval: 1.3, delay: 12 }, { kind: 'soldierTermite', count: 6, interval: 1.3, delay: 16, path: 1 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'hornet', count: 5, interval: 1.3, delay: 8, path: 1 }, { kind: 'blackAnt', count: 10, interval: 0.7, delay: 14 }, { kind: 'slug', count: 2, interval: 3.0, delay: 20, path: 1 }, { kind: 'rhino', count: 1, interval: 1, delay: 34, path: 1 }] },
];

export const LEVEL1: LevelDef = {
  id: 'oak-edge',
  name: 'Опушка у старого дуба',
  subtitle: 'Первая осада: одна тропа, 12 волн',
  story:
    'Старый дуб рухнул в грозу, и лесная подстилка вздрогнула. Из гнилого пня полезли термиты, ' +
    'с упавшего гнезда поднялись осы, а из-под корней выползли жуки. Королева кладёт новый выводок, ' +
    'и колония должна выстоять до конца сезона. Ты воевода муравейника: расставь стрелков, ' +
    'подними казармы и не пропусти ни одного врага к личинкам.',
  // Все точки на центрах клеток (40 + 80·k), повороты строго на 90°.
  paths: [[
    { x: -70, y: 120 },
    { x: 280, y: 120 },
    { x: 280, y: 360 },
    { x: 120, y: 360 },
    { x: 120, y: 600 },
    { x: 520, y: 600 },
    { x: 520, y: 280 },
    { x: 760, y: 280 },
    { x: 760, y: 520 },
    { x: 1000, y: 520 },
    { x: 1000, y: 360 },
    { x: 1160, y: 360 },
  ]],
  anthill: { x: 1160, y: 352 },
  seed: 20251108,
  startGold: 300,
  lives: 20,
  waves: LEVEL1_WAVES,
  theme: MEADOW,
};

export const LEVEL2: LevelDef = {
  id: 'oak-roots',
  name: 'Корни павшего дуба',
  subtitle: 'Две тропы, одно гнездо, 14 волн',
  story:
    'Разведчики нашли, откуда лезут термиты: из гнилого пня под корнями павшего дуба. ' +
    'Теперь враг идёт двумя тропами сразу, слева и снизу, и обе сходятся у восточного входа. ' +
    'Королева велела держать корни, пока чужая матка не вывела новое войско. ' +
    'Говорят, под корнями проснулись два жука-носорога, и оба голодны.',
  // Тропа 0 слева, тропа 1 снизу; сходятся в (760,440) и 400 px идут вместе к восточному входу.
  paths: [
    [
      { x: -70, y: 200 },
      { x: 280, y: 200 },
      { x: 280, y: 440 },
      { x: 760, y: 440 },
      { x: 1160, y: 440 },
    ],
    [
      { x: 600, y: 790 },
      { x: 600, y: 600 },
      { x: 760, y: 600 },
      { x: 760, y: 440 },
      { x: 1160, y: 440 },
    ],
  ],
  anthill: { x: 1160, y: 432 },
  seed: 777,
  startGold: 300,
  lives: 20,
  waves: LEVEL2_WAVES,
  theme: ROOTS,
  // Первый акт проходится и без заклинаний: без этой скидки робот без них падал здесь на 8-й волне.
  hpMul: (n) => (1 + HP_GROWTH_PER_WAVE * (n - 1)) * 0.85,
};

/** Тропа 0 выходит из норы в пне слева, тропа 1 из темноты справа; обе ведут к муравейнику в центре. */
const LEVEL3_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 8, interval: 1.1, delay: 0 }] },
  { groups: [{ kind: 'termite', count: 10, interval: 0.9, delay: 0 }, { kind: 'spider', count: 2, interval: 1.5, delay: 6 }] },
  { groups: [{ kind: 'termite', count: 8, interval: 1.0, delay: 0, path: 1 }, { kind: 'termite', count: 8, interval: 0.9, delay: 3 }] },
  { groups: [{ kind: 'soldierTermite', count: 3, interval: 2.0, delay: 0 }, { kind: 'spider', count: 4, interval: 1.2, delay: 4, path: 1 }, { kind: 'termite', count: 8, interval: 0.8, delay: 9 }] },
  { groups: [{ kind: 'blackAnt', count: 5, interval: 1.0, delay: 0 }, { kind: 'wasp', count: 3, interval: 1.3, delay: 5, path: 1 }, { kind: 'termite', count: 8, interval: 0.8, delay: 8, path: 1 }] },
  { groups: [{ kind: 'beetle', count: 3, interval: 2.2, delay: 0, path: 1 }, { kind: 'termite', count: 12, interval: 0.7, delay: 3 }] },
  { groups: [{ kind: 'slug', count: 1, interval: 1, delay: 0 }, { kind: 'blackAnt', count: 5, interval: 0.9, delay: 4, path: 1 }, { kind: 'spider', count: 4, interval: 1.1, delay: 10 }, { kind: 'termite', count: 8, interval: 0.8, delay: 12 }] },
  { groups: [{ kind: 'wasp', count: 5, interval: 1.1, delay: 0 }, { kind: 'soldierTermite', count: 5, interval: 1.6, delay: 4, path: 1 }, { kind: 'termite', count: 8, interval: 0.8, delay: 10 }] },
  { groups: [{ kind: 'hornet', count: 2, interval: 1.6, delay: 0, path: 1 }, { kind: 'termite', count: 12, interval: 0.6, delay: 3 }, { kind: 'blackAnt', count: 6, interval: 0.8, delay: 8, path: 1 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'spider', count: 6, interval: 1.0, delay: 4, path: 1 }, { kind: 'termite', count: 10, interval: 0.7, delay: 10, path: 1 }] },
  { groups: [{ kind: 'beetle', count: 4, interval: 1.9, delay: 0, path: 1 }, { kind: 'slug', count: 1, interval: 3.5, delay: 4 }, { kind: 'wasp', count: 6, interval: 1.0, delay: 10 }] },
  { groups: [{ kind: 'soldierTermite', count: 8, interval: 1.4, delay: 0 }, { kind: 'blackAnt', count: 8, interval: 0.7, delay: 5, path: 1 }, { kind: 'hornet', count: 3, interval: 1.4, delay: 12 }] },
  { groups: [{ kind: 'slug', count: 3, interval: 3.5, delay: 0, path: 1 }, { kind: 'beetle', count: 6, interval: 1.6, delay: 4 }, { kind: 'hornet', count: 4, interval: 1.3, delay: 12, path: 1 }] },
  { groups: [{ kind: 'blackAnt', count: 12, interval: 0.6, delay: 0 }, { kind: 'soldierTermite', count: 8, interval: 1.3, delay: 5, path: 1 }, { kind: 'wasp', count: 8, interval: 0.9, delay: 12 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2, path: 1 }, { kind: 'termite', count: 16, interval: 0.6, delay: 4 }, { kind: 'hornet', count: 5, interval: 1.2, delay: 12 }, { kind: 'slug', count: 2, interval: 3.0, delay: 16, path: 1 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3 }, { kind: 'hornet', count: 6, interval: 1.2, delay: 8, path: 1 }, { kind: 'blackAnt', count: 10, interval: 0.6, delay: 14, path: 1 }, { kind: 'slug', count: 2, interval: 3.0, delay: 24, path: 1 }] },
];

export const LEVEL3: LevelDef = {
  id: 'rotten-stump-night',
  name: 'Ночь у гнилого пня',
  subtitle: 'Финал акта: термитная матка, 16 волн',
  story:
    'Разведчики подобрались к самому пню, и ночью он ожил: наружу вышла термитная матка, огромная ' +
    'и медленная, и каждый её шаг рождает новых солдат. Войско идёт с двух сторон, из норы в пне слева ' +
    'и из темноты справа, а муравейник стоит посередине. Это последняя ночь первого акта: продержись ' +
    'до рассвета, и утром колония сама пойдёт в поход.',
  // Тропа 0 выходит из норы в пне, тропа 1 из темноты справа; сливаются в (600,360) над муравейником.
  paths: [
    [
      { x: 100, y: 170 },
      { x: 120, y: 200 },
      { x: 120, y: 360 },
      { x: 360, y: 360 },
      { x: 360, y: 200 },
      { x: 600, y: 200 },
      { x: 600, y: 568 },
    ],
    [
      { x: 1350, y: 200 },
      { x: 1160, y: 200 },
      { x: 1160, y: 440 },
      { x: 920, y: 440 },
      { x: 920, y: 360 },
      { x: 600, y: 360 },
      { x: 600, y: 568 },
    ],
  ],
  anthill: { x: 600, y: 560 },
  seed: 31337,
  startGold: 500,
  lives: 20,
  waves: LEVEL3_WAVES,
  theme: NIGHT,
};

export const STREAM: LevelTheme = {
  grass: '#5f9d4a', grassLight: '#7bb45e', grassDark: '#4a7f38',
  dirt: '#b68a56', dirtDark: '#75502b',
  flowers: 0.18, mushrooms: 0.06, puddles: 0.06, oak: false, night: false, water: { y: 320, h: 80 },
};

export const MOUND: LevelTheme = {
  grass: '#b5a06c', grassLight: '#c9b683', grassDark: '#9a8656',
  dirt: '#8f6a40', dirtDark: '#5e4327',
  flowers: 0.02, mushrooms: 0.04, puddles: 0, oak: false, night: false, wall: { h: 140 },
};

export const CAVE: LevelTheme = {
  grass: '#4a3b30', grassLight: '#5a4a3c', grassDark: '#3a2d24',
  dirt: '#7a6552', dirtDark: '#4a3b2e',
  flowers: 0, mushrooms: 0.35, puddles: 0.08, oak: false, night: true, cave: true,
};

/** Тропа 0 слева, тропа 1 справа; обе через брёвна-мосты к лагерю на южном берегу. */
const LEVEL4_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 8, interval: 1.1, delay: 0 }] },
  { groups: [{ kind: 'termite', count: 8, interval: 1.0, delay: 0, path: 1 }, { kind: 'spider', count: 3, interval: 1.3, delay: 4 }] },
  { groups: [{ kind: 'blackAnt', count: 6, interval: 0.9, delay: 0 }, { kind: 'termite', count: 8, interval: 0.9, delay: 3, path: 1 }] },
  { groups: [{ kind: 'dragonfly', count: 1, interval: 2.0, delay: 0 }, { kind: 'soldierTermite', count: 3, interval: 1.8, delay: 3, path: 1 }, { kind: 'termite', count: 8, interval: 0.8, delay: 8 }] },
  { groups: [{ kind: 'leech', count: 1, interval: 1, delay: 0 }, { kind: 'spider', count: 4, interval: 1.1, delay: 3, path: 1 }, { kind: 'wasp', count: 3, interval: 1.1, delay: 8 }, { kind: 'termite', count: 6, interval: 0.8, delay: 12 }] },
  { groups: [{ kind: 'beetle', count: 3, interval: 2.0, delay: 0, path: 1 }, { kind: 'blackAnt', count: 8, interval: 0.8, delay: 3 }, { kind: 'dragonfly', count: 1, interval: 2.0, delay: 10, path: 1 }] },
  { groups: [{ kind: 'termite', count: 14, interval: 0.6, delay: 0 }, { kind: 'soldierTermite', count: 5, interval: 1.6, delay: 4, path: 1 }, { kind: 'leech', count: 2, interval: 3.0, delay: 12, path: 1 }] },
  { groups: [{ kind: 'dragonfly', count: 2, interval: 1.6, delay: 0 }, { kind: 'hornet', count: 2, interval: 1.5, delay: 4, path: 1 }, { kind: 'spider', count: 6, interval: 0.9, delay: 8 }, { kind: 'termite', count: 8, interval: 0.7, delay: 12, path: 1 }] },
  { groups: [{ kind: 'slug', count: 1, interval: 3.5, delay: 0, path: 1 }, { kind: 'beetle', count: 4, interval: 1.8, delay: 3 }, { kind: 'blackAnt', count: 8, interval: 0.7, delay: 8, path: 1 }, { kind: 'wasp', count: 5, interval: 1.0, delay: 12 }, { kind: 'termite', count: 8, interval: 0.7, delay: 16 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'leech', count: 2, interval: 3.0, delay: 4, path: 1 }, { kind: 'termite', count: 12, interval: 0.6, delay: 8, path: 1 }] },
  { groups: [{ kind: 'dragonfly', count: 3, interval: 1.6, delay: 0, path: 1 }, { kind: 'soldierTermite', count: 6, interval: 1.4, delay: 3 }, { kind: 'termite', count: 10, interval: 0.7, delay: 8, path: 1 }, { kind: 'hornet', count: 2, interval: 1.4, delay: 14 }] },
  { groups: [{ kind: 'leech', count: 2, interval: 3.0, delay: 0 }, { kind: 'beetle', count: 5, interval: 1.6, delay: 4, path: 1 }, { kind: 'blackAnt', count: 10, interval: 0.6, delay: 10 }, { kind: 'termite', count: 8, interval: 0.7, delay: 12, path: 1 }, { kind: 'dragonfly', count: 1, interval: 1.5, delay: 16, path: 1 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2, path: 1 }, { kind: 'slug', count: 3, interval: 3.5, delay: 4 }, { kind: 'hornet', count: 4, interval: 1.3, delay: 10, path: 1 }, { kind: 'spider', count: 10, interval: 0.8, delay: 14 }, { kind: 'soldierTermite', count: 8, interval: 1.3, delay: 18, path: 1 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3 }, { kind: 'dragonfly', count: 3, interval: 1.4, delay: 8, path: 1 }, { kind: 'leech', count: 2, interval: 3.0, delay: 14, path: 1 }, { kind: 'blackAnt', count: 12, interval: 0.6, delay: 18 }] },
];

/** Три хода в стене термитника: тропы 0, 1, 2 слева направо. */
const LEVEL5_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 8, interval: 1.1, delay: 0, path: 1 }] },
  { groups: [{ kind: 'termite', count: 6, interval: 1.1, delay: 0 }, { kind: 'termite', count: 6, interval: 1.1, delay: 4, path: 2 }] },
  { groups: [{ kind: 'bomber', count: 4, interval: 1.4, delay: 0, path: 1 }, { kind: 'termite', count: 8, interval: 0.9, delay: 3 }, { kind: 'spider', count: 3, interval: 1.3, delay: 6, path: 2 }] },
  { groups: [{ kind: 'soldierTermite', count: 3, interval: 1.8, delay: 0 }, { kind: 'blackAnt', count: 4, interval: 0.9, delay: 4, path: 2 }, { kind: 'termite', count: 8, interval: 0.8, delay: 9, path: 1 }] },
  { groups: [{ kind: 'bomber', count: 2, interval: 1.2, delay: 0 }, { kind: 'wasp', count: 2, interval: 1.1, delay: 4, path: 1 }, { kind: 'termite', count: 6, interval: 0.7, delay: 8, path: 2 }] },
  { groups: [{ kind: 'beetle', count: 2, interval: 2.2, delay: 0, path: 1 }, { kind: 'soldierTermite', count: 3, interval: 1.6, delay: 3, path: 2 }, { kind: 'bomber', count: 3, interval: 1.2, delay: 8 }, { kind: 'spider', count: 4, interval: 1.0, delay: 12, path: 1 }] },
  { groups: [{ kind: 'dragonfly', count: 2, interval: 1.6, delay: 0 }, { kind: 'leech', count: 2, interval: 3.0, delay: 4, path: 2 }, { kind: 'termite', count: 12, interval: 0.6, delay: 8, path: 1 }] },
  { groups: [{ kind: 'blackAnt', count: 10, interval: 0.7, delay: 0, path: 2 }, { kind: 'bomber', count: 8, interval: 1.0, delay: 4, path: 1 }, { kind: 'soldierTermite', count: 6, interval: 1.5, delay: 10 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2, path: 1 }, { kind: 'termite', count: 10, interval: 0.6, delay: 4 }, { kind: 'wasp', count: 5, interval: 1.0, delay: 8, path: 2 }, { kind: 'bomber', count: 4, interval: 1.1, delay: 14 }] },
  { groups: [{ kind: 'slug', count: 1, interval: 3.5, delay: 0 }, { kind: 'beetle', count: 4, interval: 1.6, delay: 3, path: 2 }, { kind: 'hornet', count: 2, interval: 1.4, delay: 10, path: 1 }, { kind: 'spider', count: 5, interval: 0.9, delay: 14 }] },
  { groups: [{ kind: 'soldierTermite', count: 6, interval: 1.3, delay: 0, path: 1 }, { kind: 'bomber', count: 6, interval: 1.0, delay: 4, path: 2 }, { kind: 'blackAnt', count: 8, interval: 0.7, delay: 10 }, { kind: 'dragonfly', count: 2, interval: 1.5, delay: 16, path: 2 }] },
  { groups: [{ kind: 'leech', count: 1, interval: 3.0, delay: 0, path: 1 }, { kind: 'beetle', count: 5, interval: 1.6, delay: 4 }, { kind: 'termite', count: 12, interval: 0.6, delay: 8, path: 2 }, { kind: 'hornet', count: 3, interval: 1.3, delay: 14 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3, path: 1 }, { kind: 'bomber', count: 8, interval: 1.0, delay: 6 }, { kind: 'soldierTermite', count: 6, interval: 1.3, delay: 10, path: 2 }, { kind: 'dragonfly', count: 3, interval: 1.5, delay: 16 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'slug', count: 2, interval: 3.5, delay: 8, path: 1 }, { kind: 'blackAnt', count: 10, interval: 0.6, delay: 12, path: 2 }, { kind: 'wasp', count: 6, interval: 0.9, delay: 16 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3 }, { kind: 'bomber', count: 8, interval: 0.9, delay: 8, path: 1 }, { kind: 'soldierTermite', count: 5, interval: 1.2, delay: 16, path: 2 }, { kind: 'slug', count: 2, interval: 3.0, delay: 26 }, { kind: 'hornet', count: 3, interval: 1.3, delay: 30, path: 1 }] },
];

/** Два хода в сердце термитника; королева выходит по тропе 0 с дальнего края. */
const LEVEL6_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'soldierTermite', count: 4, interval: 1.8, delay: 0 }, { kind: 'termite', count: 10, interval: 0.8, delay: 3, path: 1 }] },
  { groups: [{ kind: 'bomber', count: 6, interval: 1.2, delay: 0, path: 1 }, { kind: 'spider', count: 6, interval: 1.0, delay: 4 }] },
  { groups: [{ kind: 'blackAnt', count: 8, interval: 0.8, delay: 0 }, { kind: 'soldierTermite', count: 5, interval: 1.6, delay: 4, path: 1 }, { kind: 'termite', count: 10, interval: 0.7, delay: 10 }] },
  { groups: [{ kind: 'leech', count: 2, interval: 3.0, delay: 0, path: 1 }, { kind: 'bomber', count: 8, interval: 1.0, delay: 4 }, { kind: 'wasp', count: 6, interval: 1.0, delay: 10, path: 1 }] },
  { groups: [{ kind: 'beetle', count: 5, interval: 1.8, delay: 0 }, { kind: 'dragonfly', count: 3, interval: 1.6, delay: 4, path: 1 }, { kind: 'termite', count: 14, interval: 0.6, delay: 8, path: 1 }] },
  { groups: [{ kind: 'soldierTermite', count: 8, interval: 1.4, delay: 0, path: 1 }, { kind: 'bomber', count: 8, interval: 1.0, delay: 4 }, { kind: 'hornet', count: 3, interval: 1.5, delay: 12 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2 }, { kind: 'blackAnt', count: 12, interval: 0.6, delay: 4, path: 1 }, { kind: 'leech', count: 3, interval: 3.0, delay: 10 }] },
  { groups: [{ kind: 'slug', count: 3, interval: 3.5, delay: 0, path: 1 }, { kind: 'spider', count: 10, interval: 0.8, delay: 4 }, { kind: 'bomber', count: 10, interval: 1.0, delay: 10, path: 1 }, { kind: 'dragonfly', count: 4, interval: 1.5, delay: 16 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3, path: 1 }, { kind: 'soldierTermite', count: 12, interval: 1.3, delay: 6 }, { kind: 'wasp', count: 10, interval: 0.9, delay: 14 }] },
  { groups: [{ kind: 'beetle', count: 8, interval: 1.5, delay: 0, path: 1 }, { kind: 'bomber', count: 14, interval: 0.9, delay: 4 }, { kind: 'hornet', count: 6, interval: 1.3, delay: 12, path: 1 }, { kind: 'leech', count: 3, interval: 3.0, delay: 18 }] },
  { groups: [{ kind: 'soldierTermite', count: 14, interval: 1.2, delay: 0 }, { kind: 'blackAnt', count: 16, interval: 0.6, delay: 5, path: 1 }, { kind: 'dragonfly', count: 5, interval: 1.4, delay: 14 }, { kind: 'slug', count: 3, interval: 3.0, delay: 18, path: 1 }] },
  { groups: [{ kind: 'rhino', count: 1, interval: 1, delay: 2, path: 1 }, { kind: 'rhino', count: 1, interval: 1, delay: 10 }, { kind: 'bomber', count: 16, interval: 0.9, delay: 6, path: 1 }, { kind: 'termite', count: 22, interval: 0.5, delay: 12 }] },
  { groups: [{ kind: 'queen', count: 1, interval: 1, delay: 3 }, { kind: 'leech', count: 5, interval: 3.0, delay: 6, path: 1 }, { kind: 'soldierTermite', count: 14, interval: 1.2, delay: 12, path: 1 }, { kind: 'hornet', count: 8, interval: 1.2, delay: 18 }, { kind: 'dragonfly', count: 6, interval: 1.4, delay: 22, path: 1 }] },
  { groups: [{ kind: 'empress', count: 1, interval: 1, delay: 4 }, { kind: 'bomber', count: 14, interval: 0.9, delay: 8, path: 1 }, { kind: 'soldierTermite', count: 12, interval: 1.2, delay: 16, path: 1 }, { kind: 'dragonfly', count: 7, interval: 1.3, delay: 24, path: 1 }, { kind: 'slug', count: 3, interval: 3.0, delay: 30 }, { kind: 'leech', count: 4, interval: 3.0, delay: 38, path: 1 }] },
];

export const LEVEL4: LevelDef = {
  id: 'stream-crossing',
  name: 'Переправа через ручей',
  subtitle: 'Поход начинается: два моста, стрекозы и пиявки',
  story:
    'Утром колония вышла в поход. Путь к термитнику лежит через ручей: две упавшие ветки служат ' +
    'мостами, и по ним же идут термиты. Лагерь разбит на нашем берегу; удержи переправу, пока обоз ' +
    'с личинками и запасами не переберётся. Над водой кружат стрекозы, быстрые и крепкие, а из ила ' +
    'лезут пиявки, которых почти не берёт яд времени: они зарастают на глазах.',
  // Мосты в столбцах 3 и 12, слияние в (600,440), общий спуск к лагерю.
  paths: [
    [{ x: -70, y: 120 }, { x: 280, y: 120 }, { x: 280, y: 440 }, { x: 600, y: 440 }, { x: 600, y: 658 }],
    [{ x: 1350, y: 120 }, { x: 1000, y: 120 }, { x: 1000, y: 440 }, { x: 600, y: 440 }, { x: 600, y: 658 }],
  ],
  anthill: { x: 600, y: 650 },
  seed: 4404,
  startGold: 580,
  lives: 20,
  waves: LEVEL4_WAVES,
  theme: STREAM,
};

export const LEVEL5: LevelDef = {
  id: 'mound-foot',
  name: 'Подножие термитника',
  subtitle: 'Три хода в стене, термиты-подрывники',
  story:
    'Термитник встал стеной до самого неба. Из трёх ходов у подножия валом валят его защитники, ' +
    'и среди них термиты-подрывники: лопаются рядом с нашими солдатами и героем, так что казармы ' +
    'здесь дорого обходятся. Лагерь прямо под стеной, отступать некуда. Выстой, и ход внутрь открыт.',
  // Три норы в стене (столбцы 2, 8 и 13); все тропы сходятся в (600,440) и спускаются к лагерю.
  paths: [
    [{ x: 200, y: 150 }, { x: 200, y: 440 }, { x: 600, y: 440 }, { x: 600, y: 618 }],
    [{ x: 680, y: 150 }, { x: 680, y: 280 }, { x: 520, y: 280 }, { x: 520, y: 440 }, { x: 600, y: 440 }, { x: 600, y: 618 }],
    [{ x: 1080, y: 150 }, { x: 1080, y: 440 }, { x: 600, y: 440 }, { x: 600, y: 618 }],
  ],
  anthill: { x: 600, y: 610 },
  seed: 5505,
  startGold: 620,
  lives: 20,
  waves: LEVEL5_WAVES,
  theme: MOUND,
};

export const LEVEL6: LevelDef = {
  id: 'mound-heart',
  name: 'Сердце термитника',
  subtitle: 'Финал похода: королева термитов',
  story:
    'Внутри темно и душно, стены светятся грибницей. Королева термитов сидит в самой глубине и не ' +
    'выйдет сама, пока у неё есть солдаты. Два хода ведут к развилке, где стоит наш лагерь. ' +
    'Когда королева всё же поползёт на тебя, за ней пойдёт вся её гвардия. Это последняя битва похода.',
  // Тропа 0 с дальнего правого края, тропа 1 сверху; сходятся в (760,440) и идут к лагерю слева.
  paths: [
    [{ x: 1350, y: 200 }, { x: 1080, y: 200 }, { x: 1080, y: 440 }, { x: 760, y: 440 }, { x: 760, y: 520 }, { x: 360, y: 520 }],
    [{ x: 680, y: -70 }, { x: 680, y: 360 }, { x: 760, y: 360 }, { x: 760, y: 520 }, { x: 360, y: 520 }],
  ],
  anthill: { x: 360, y: 512 },
  seed: 6606,
  startGold: 420,
  lives: 20,
  waves: LEVEL6_WAVES,
  theme: CAVE,
};

/** Шесть уровней, нарисованных вручную: начала и финалы первых двух актов (см. campaign.ts). */
export const HANDMADE: readonly LevelDef[] = [LEVEL1, LEVEL2, LEVEL3, LEVEL4, LEVEL5, LEVEL6];

/** Пять коротких волн обучения: каждая показывает одну новую вещь. */
const TUTORIAL_WAVES: readonly WaveDef[] = [
  { groups: [{ kind: 'termite', count: 4, interval: 1.8, delay: 0 }] },
  { groups: [{ kind: 'termite', count: 5, interval: 1.2, delay: 0 }, { kind: 'spider', count: 2, interval: 1.6, delay: 4 }] },
  { groups: [{ kind: 'wasp', count: 3, interval: 1.4, delay: 0 }, { kind: 'termite', count: 4, interval: 1.1, delay: 2 }] },
  { groups: [{ kind: 'termite', count: 12, interval: 0.4, delay: 0 }, { kind: 'blackAnt', count: 3, interval: 0.7, delay: 3 }] },
  { groups: [{ kind: 'beetle', count: 1, interval: 1, delay: 0 }, { kind: 'termite', count: 5, interval: 0.8, delay: 4 }, { kind: 'spider', count: 2, interval: 1.2, delay: 7 }] },
];

/**
 * Учебный плац: короткая тропа с тремя поворотами. Клетки для подсказок (см. tutorial.ts):
 * стрелки в углу первого поворота (360,360), казарма под тропой (600,600), грибница в углу (760,440).
 */
export const TUTORIAL: LevelDef = {
  id: 'tutorial',
  name: 'Учебный плац',
  subtitle: 'Обучение: пять коротких волн',
  story:
    'Короткая учёба для нового воеводы: пять быстрых волн, и ты знаешь всё нужное. Башни, волны, ' +
    'нектар и заклинания покажет сам воевода Жвал, подсказки будут прямо на поле. Пока ты не готов, ' +
    'следующая волна подождёт.',
  paths: [[
    { x: -70, y: 280 },
    { x: 440, y: 280 },
    { x: 440, y: 520 },
    { x: 840, y: 520 },
    { x: 840, y: 360 },
    { x: 1080, y: 360 },
  ]],
  anthill: { x: 1080, y: 352 },
  seed: 1101,
  startGold: 120,
  lives: 20,
  waves: TUTORIAL_WAVES,
  theme: MEADOW,
  waveDelay: 10,
  // Учебные враги слабее обычных: одна башня на первой волне должна справиться без потерь.
  hpMul: (n) => 0.6 + 0.05 * (n - 1),
};

