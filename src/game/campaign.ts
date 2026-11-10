import { Rng } from '../engine/rng';
import { HP_GROWTH_PER_WAVE, type EnemyKind, type WaveDef, type WaveGroup } from './config';
import { threat } from './endless';
import { CAVE, HANDMADE, MEADOW, MOUND, NIGHT, ROOTS, STREAM, type BandKind, type Biome, type LevelDef, type LevelTheme } from './levels';
import { GENERATED } from './maps.gen';
import { MAP_TEXTS } from './maptexts';

/**
 * Кампания: восемь актов по девять карт. Первые два акта — нынешние уровни, нарисованные вручную
 * (начала и финалы), между ними сгенерированные карты в тех же темах. Акты с третьего по восьмой —
 * новые ландшафты: пустыня, горы, джунгли, снега, лес, Азия. Карты новых актов сгенерированы
 * sim/campaign.ts: тропы по клеткам, препятствия и сложность, подобранная игроком-роботом.
 * Следующий акт открывается, когда на каждой карте предыдущего есть хотя бы одна звезда.
 */

/** Тема карты: шесть тем первых двух актов и шесть ландшафтов новых. */
export type ThemeKey = 'meadow' | 'roots' | 'night' | 'stream' | 'mound' | 'cave' | Biome;

/** Пустыня: песок, барханы, кактусы, выбеленные кости; тропа плотнее и темнее песка. */
const DESERT: LevelTheme = {
  grass: '#e2c37d', grassLight: '#eed598', grassDark: '#cfac65',
  dirt: '#b88a52', dirtDark: '#86602f',
  flowers: 0.06, mushrooms: 0, puddles: 0, oak: false, night: false, biome: 'desert',
};
/** Горы: альпийский луг с камнями, галечная тропа, ущелья с мостиками. */
const MOUNTAINS: LevelTheme = {
  grass: '#8fa57a', grassLight: '#a5b88f', grassDark: '#768e60',
  dirt: '#a39d90', dirtDark: '#6c675c',
  flowers: 0.12, mushrooms: 0.02, puddles: 0.03, oak: false, night: false, biome: 'mountains',
};
/** Джунгли: густая зелень, огромные листья, папоротники, орхидеи, грязь и реки. */
const JUNGLE: LevelTheme = {
  grass: '#3f8b3b', grassLight: '#57a54b', grassDark: '#2e6b2c',
  dirt: '#8b5b30', dirtDark: '#5a381a',
  flowers: 0.18, mushrooms: 0.1, puddles: 0.1, oak: false, night: false, biome: 'jungle',
};
/** Снега: наст с голубыми тенями, сугробы, лёд, шишки; тропа утоптана. */
const SNOW: LevelTheme = {
  grass: '#e7eff7', grassLight: '#ffffff', grassDark: '#cad8e7',
  dirt: '#b6c6d7', dirtDark: '#8496aa',
  flowers: 0, mushrooms: 0, puddles: 0.06, oak: false, night: false, biome: 'snow',
};
/** Лес: тёмная хвоя, мох, папоротники, шишки, стволы деревьев. */
const FOREST: LevelTheme = {
  grass: '#4f7f3b', grassLight: '#63944b', grassDark: '#3e6730',
  dirt: '#7b5533', dirtDark: '#4e341c',
  flowers: 0.05, mushrooms: 0.2, puddles: 0.05, oak: false, night: false, biome: 'forest',
};
/** Азия: мягкая зелень, гравийная тропа, бамбук, сакура, фонари, пруды с карпами. */
const ASIA: LevelTheme = {
  grass: '#7db35a', grassLight: '#93c46e', grassDark: '#679a47',
  dirt: '#cbb791', dirtDark: '#978263',
  flowers: 0.12, mushrooms: 0.03, puddles: 0.03, oak: false, night: false, biome: 'asia',
};

export const THEMES: Record<ThemeKey, LevelTheme> = {
  meadow: MEADOW, roots: ROOTS, night: NIGHT, stream: STREAM, mound: MOUND, cave: CAVE,
  desert: DESERT, mountains: MOUNTAINS, jungle: JUNGLE, snow: SNOW, forest: FOREST, asia: ASIA,
};

/** Сгенерированная карта: геометрия из генератора и сложность, подобранная роботом. */
export interface MapGen {
  id: string;
  /** Номер акта с нуля и место карты в нём (0..8). */
  act: number;
  slot: number;
  theme: ThemeKey;
  seed: number;
  /** Тропы точками [x, y]: первая за краем карты или у норы, последняя у входа в муравейник. */
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  anthill: readonly [number, number];
  /** Полоса поперёк карты (верх, высота 80): вода, лёд или ущелье. */
  band?: number;
  bandKind?: BandKind;
  /** Стена термитника вдоль верхнего края, высота. */
  wall?: number;
  /** Гнилой пень с норой (ночные карты). */
  stump?: readonly [number, number];
  /** Препятствия: x, y, радиус. */
  blobs?: ReadonlyArray<readonly [number, number, number]>;
  waves: number;
  /**
   * Множитель здоровья врагов карты: его подбирает робот (sim/campaign.ts). Именно здоровье, а не
   * численность: лишние враги приносят нектар, и доход рос бы вместе с угрозой.
   */
  diff: number;
  gold: number;
}

export interface ActDef {
  id: string;
  title: string;
  /** Ландшафт акта: по нему цвет вкладки и стиль построек. */
  theme: ThemeKey;
  from: number;
  to: number;
  /** Строка на экране победы, когда пройдена последняя карта акта. */
  finale: string;
}

const ACT_SPECS: ReadonlyArray<Omit<ActDef, 'from' | 'to'>> = [
  { id: 'defense', title: 'Акт 1 · Оборона муравейника', theme: 'meadow', finale: ' Акт 1 завершён: утром колония сама выступает в поход на термитник.' },
  { id: 'march', title: 'Акт 2 · Поход на термитник', theme: 'mound', finale: ' Термитник пал, королева мертва. Колония отправляет разведчиков за край леса.' },
  { id: 'desert', title: 'Акт 3 · Пустыня', theme: 'desert', finale: ' Пески позади: караван дошёл до оазиса, впереди синеют горы.' },
  { id: 'mountains', title: 'Акт 4 · Горы', theme: 'mountains', finale: ' Перевал взят. С гор видно море зелени — джунгли.' },
  { id: 'jungle', title: 'Акт 5 · Джунгли', theme: 'jungle', finale: ' Джунгли расступились, и потянуло холодом: дальше лежат снега.' },
  { id: 'snow', title: 'Акт 6 · Снега', theme: 'snow', finale: ' Зима отступила. Впереди родной лес, но и туда пришли чужие.' },
  { id: 'forest', title: 'Акт 7 · Лес', theme: 'forest', finale: ' Лес снова наш. Последний путь колонии лежит на восток, к бамбуковым рощам.' },
  { id: 'asia', title: 'Акт 8 · Азия', theme: 'asia', finale: ' Великий поход окончен: от пустыни до бамбуковых рощ муравейники стоят нерушимо.' },
];

/** Враги акта: вид, с какой карты акта появляется, вес в волнах; и боссы финальных волн. */
interface Roster {
  kinds: ReadonlyArray<readonly [EnemyKind, number, number]>;
}

const ALL: Roster['kinds'] = [
  ['termite', 0, 3], ['spider', 0, 2], ['blackAnt', 0, 2], ['wasp', 0, 1.6], ['soldierTermite', 0, 1.8],
  ['beetle', 1, 1.4], ['bomber', 1, 1.2], ['hornet', 2, 1.2], ['dragonfly', 2, 1], ['slug', 3, 0.7], ['leech', 3, 0.7],
];

/** Свой акцент у каждого акта: кто чаще выходит в волнах. Новые враги актов добавятся сюда. */
function flavored(boost: Partial<Record<EnemyKind, number>>): Roster['kinds'] {
  return ALL.map(([k, from, w]) => [k, from, w * (boost[k] ?? 1)] as const);
}

const ROSTERS: readonly Roster[] = [
  { kinds: [['termite', 0, 3], ['spider', 0, 2], ['blackAnt', 2, 2], ['wasp', 2, 1.6], ['soldierTermite', 3, 1.8], ['beetle', 4, 1.4], ['hornet', 5, 1.2], ['slug', 6, 0.7]] },
  { kinds: [['termite', 0, 3], ['spider', 0, 2], ['blackAnt', 0, 2], ['wasp', 0, 1.6], ['soldierTermite', 0, 1.8], ['beetle', 2, 1.4], ['bomber', 2, 1.4], ['dragonfly', 3, 1.2], ['leech', 4, 0.8], ['hornet', 4, 1.2], ['slug', 5, 0.7]] },
  { kinds: flavored({ beetle: 1.6, spider: 1.5, wasp: 1.4, leech: 0.3, slug: 0.4 }) },
  { kinds: flavored({ soldierTermite: 1.6, beetle: 1.5, hornet: 1.4, dragonfly: 0.6 }) },
  { kinds: flavored({ leech: 1.8, slug: 1.6, dragonfly: 1.5, spider: 1.3, bomber: 0.7 }) },
  { kinds: flavored({ blackAnt: 1.5, soldierTermite: 1.5, beetle: 1.3, wasp: 0.5, dragonfly: 0.5 }) },
  { kinds: flavored({ termite: 1.4, bomber: 1.6, beetle: 1.2, hornet: 1.2 }) },
  { kinds: flavored({ hornet: 1.5, dragonfly: 1.4, soldierTermite: 1.3, bomber: 1.2 }) },
];

/** Здоровье врагов по актам: в дальних актах они крепче, а не только многочисленнее. */
const ACT_HP: readonly number[] = [1, 1.05, 1.15, 1.25, 1.35, 1.45, 1.55, 1.7];

/** Промежуток между врагами группы на первых волнах, с. */
const INTERVAL: Partial<Record<EnemyKind, number>> = {
  termite: 0.7, spider: 0.9, blackAnt: 0.7, wasp: 1.0, soldierTermite: 1.3, beetle: 1.8,
  bomber: 0.9, hornet: 1.4, slug: 3.5, dragonfly: 1.5, leech: 3.0,
};

/** Боссы последней волны карты: чем дальше по акту и по кампании, тем тяжелее. */
function bossesOf(act: number, slot: number): EnemyKind[] {
  if (act === 0) return slot >= 2 ? ['rhino'] : [];
  if (act === 1) return slot <= 4 ? ['rhino'] : ['queen'];
  if (slot <= 2) return ['rhino'];
  if (slot <= 5) return ['queen'];
  if (slot <= 7) return ['rhino', 'queen'];
  return act >= 5 ? ['empress', 'queen'] : ['empress'];
}

function pick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Волны сгенерированной карты. Детерминированы: зерно карты и её множитель угрозы diff всегда
 * дают те же волны. Угроза волны растёт с номером; каждая пятая волна воздушная, каждая седьмая
 * бронированная, в последней выходят боссы. На картах с несколькими тропами группы чередуют тропы.
 */
export function mapWaves(m: MapGen): WaveDef[] {
  const rng = new Rng(m.seed * 7 + 13);
  const kinds = ROSTERS[m.act].kinds.filter(([, from]) => m.slot >= from);
  const nPaths = m.paths.length;
  const out: WaveDef[] = [];
  for (let n = 1; n <= m.waves; n++) {
    const groups: WaveGroup[] = [];
    // Численность растёт с номером волны и немного с актом; трудность карты задаёт здоровье (diff).
    let b = (1 + 0.08 * m.act) * (260 + 175 * (n - 1));
    let delay = 0;
    if (n === m.waves) {
      bossesOf(m.act, m.slot).forEach((kind, i) => {
        groups.push({ kind, count: 1, interval: 1, delay: 2 + i * 10, path: i % nPaths });
      });
      if (groups.length) {
        b *= 0.6;
        delay = 5;
      }
    }
    const air = n % 5 === 0;
    const armor = n % 7 === 0;
    const weights = kinds.map(([k, , w]) => {
      let v = w;
      if (air && (k === 'wasp' || k === 'hornet' || k === 'dragonfly')) v *= 3;
      if (armor && (k === 'beetle' || k === 'soldierTermite')) v *= 3;
      return v;
    });
    const nGroups = Math.min(4, 1 + Math.floor((n + 1) / 4));
    const shares: number[] = [];
    for (let i = 0; i < nGroups; i++) shares.push(rng.range(0.7, 1.3));
    const sum = shares.reduce((a, s) => a + s, 0);
    for (let i = 0; i < nGroups; i++) {
      // В группе хотя бы двое: дорогой враг на маленькую долю не выпадает (иначе первая волна — один слизень).
      const share = (b * shares[i]) / sum;
      const fits = kinds.map(([k], j) => (threat(k) * 2 <= share ? weights[j] : 0));
      const [kind] = fits.some((w) => w > 0) ? pick(rng, kinds, fits) : (['termite', 0, 1] as const);
      const count = Math.max(1, Math.min(30, Math.round(share / threat(kind))));
      const interval = Math.max(0.35, (INTERVAL[kind] ?? 1) * Math.max(0.6, 1 - n * 0.012));
      const path = n === 1 ? 0 : (i + n) % nPaths;
      groups.push({ kind, count, interval: Math.round(interval * 100) / 100, delay: Math.round(delay * 10) / 10, path });
      delay += rng.range(2.5, 5);
    }
    out.push({ groups });
  }
  return out;
}

/** Уровень из данных сгенерированной карты (его же собирает генератор, чтобы оценить карту). */
export function levelFromGen(m: MapGen): LevelDef {
  const base = THEMES[m.theme];
  const theme: LevelTheme = {
    ...base,
    water: m.band !== undefined ? { y: m.band, h: 80 } : undefined,
    bandKind: m.bandKind,
    wall: m.wall !== undefined ? { h: m.wall } : undefined,
    stump: m.stump ? { x: m.stump[0], y: m.stump[1] } : undefined,
    blobs: m.blobs?.map(([x, y, r]) => ({ x, y, r })),
  };
  const text = MAP_TEXTS[m.id];
  const hp = ACT_HP[m.act] ?? 1;
  return {
    id: m.id,
    name: text?.name ?? m.id,
    subtitle: text?.name ?? m.id,
    story: text?.story ?? '',
    paths: m.paths.map((p) => p.map(([x, y]) => ({ x, y }))),
    anthill: { x: m.anthill[0], y: m.anthill[1] },
    seed: m.seed,
    startGold: m.gold,
    lives: 20,
    waves: mapWaves(m),
    theme,
    hpMul: (n) => (1 + HP_GROWTH_PER_WAVE * (n - 1)) * hp * m.diff,
  };
}

/** Нарисованные вручную уровни по местам в актах: начала и финалы первых двух актов. */
const HAND_SLOTS: Readonly<Record<string, string>> = {
  '0:0': 'oak-edge', '0:1': 'oak-roots', '0:8': 'rotten-stump-night',
  '1:0': 'stream-crossing', '1:1': 'mound-foot', '1:8': 'mound-heart',
};

function assemble(): { levels: LevelDef[]; acts: ActDef[]; actOf: number[] } {
  const hand = new Map(HANDMADE.map((l) => [l.id, l]));
  const levels: LevelDef[] = [];
  const acts: ActDef[] = [];
  const actOf: number[] = [];
  ACT_SPECS.forEach((spec, a) => {
    const from = levels.length;
    for (let slot = 0; slot < 9; slot++) {
      const handId = HAND_SLOTS[`${a}:${slot}`];
      const gen = handId ? undefined : GENERATED.find((m) => m.act === a && m.slot === slot);
      const lv = handId ? hand.get(handId) : gen ? levelFromGen(gen) : undefined;
      if (!lv) continue;
      levels.push(lv);
      actOf.push(a);
    }
    // Акт есть всегда, даже пока без карт (to < from): номера актов совпадают с ACT_SPECS.
    acts.push({ ...spec, from, to: levels.length - 1 });
  });
  return { levels, acts, actOf };
}

const BUILT = assemble();

/** Все карты кампании по порядку актов. */
export const LEVELS: readonly LevelDef[] = BUILT.levels;
export const ACTS: readonly ActDef[] = BUILT.acts;
/** Номер акта для каждой карты из LEVELS. */
export const LEVEL_ACT: readonly number[] = BUILT.actOf;
