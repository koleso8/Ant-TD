import { Rng } from '../engine/rng';
import { ENEMIES, type EnemyKind, type WaveDef, type WaveGroup } from './config';
import type { LevelDef, LevelTheme } from './levels';

/**
 * Бесконечная осада: большая поляна 28×16 клеток (втрое больше обычной карты), одна тропа
 * спиралью к муравейнику в центре и волны без конца. Каждая волна собирается на лету из бюджета,
 * который растёт с номером, а здоровье врагов растёт быстрее, чем доход: рано или поздно колония
 * падает, и вопрос только в том, на какой волне.
 */
export const ENDLESS_W = 2240;
export const ENDLESS_H = 1280;

interface Tier {
  kind: EnemyKind;
  /** С какой волны появляется. */
  from: number;
  weight: number;
  /** Промежуток между врагами группы на первых волнах, с. */
  interval: number;
}

const TIERS: readonly Tier[] = [
  { kind: 'termite', from: 1, weight: 3, interval: 0.7 },
  { kind: 'spider', from: 2, weight: 2, interval: 0.9 },
  { kind: 'blackAnt', from: 3, weight: 2, interval: 0.7 },
  { kind: 'wasp', from: 4, weight: 2, interval: 1.0 },
  { kind: 'soldierTermite', from: 5, weight: 2, interval: 1.3 },
  { kind: 'beetle', from: 7, weight: 1.5, interval: 1.8 },
  { kind: 'bomber', from: 8, weight: 1.5, interval: 0.9 },
  { kind: 'hornet', from: 9, weight: 1.2, interval: 1.4 },
  { kind: 'slug', from: 11, weight: 0.8, interval: 3.5 },
  { kind: 'dragonfly', from: 12, weight: 1, interval: 1.5 },
  { kind: 'leech', from: 14, weight: 0.8, interval: 3.0 },
  // Гости из дальних земель: с GUESTS_FROM каждые три волны приходят два врага очередного
  // ландшафта, в порядке актов кампании. Промежутки те же, что у них в кампании.
  { kind: 'scorpion', from: 16, weight: 1.5, interval: 1.0 },
  { kind: 'scarab', from: 16, weight: 1.2, interval: 1.9 },
  { kind: 'woodlouse', from: 19, weight: 1.4, interval: 1.2 },
  { kind: 'grasshopper', from: 19, weight: 1.3, interval: 0.9 },
  { kind: 'centipede', from: 22, weight: 1.3, interval: 2.2 },
  { kind: 'armyAnt', from: 22, weight: 0.8, interval: 0.3 },
  { kind: 'iceBug', from: 25, weight: 1.2, interval: 2.0 },
  { kind: 'iceSnail', from: 25, weight: 0.9, interval: 3.0 },
  { kind: 'silkworm', from: 28, weight: 1.3, interval: 1.6 },
  { kind: 'tick', from: 28, weight: 1.2, interval: 0.9 },
  { kind: 'mantis', from: 31, weight: 1.2, interval: 1.5 },
  { kind: 'firefly', from: 31, weight: 1.3, interval: 2.2 },
];

/** С этой волны приходят враги актов; в волне своего появления гость выходит наверняка. */
const GUESTS_FROM = 16;

/** Боссы каждой десятой волны по кругу; на каждом следующем круге их на одного больше. */
const BOSSES: readonly EnemyKind[] = ['rhino', 'queen', 'empress'];

/** Здоровье врагов растёт на 5% за волну, сложными процентами: доход растёт линейно, и рано или поздно его не хватит. */
export function endlessHpMul(n: number): number {
  return Math.pow(1.06, n - 1);
}

/**
 * Угроза волны: сколько «здоровья с поправками» в ней выходит (без роста здоровья от номера,
 * его добавляет endlessHpMul). Восемь термитов первой волны — это около 370.
 */
function budget(n: number): number {
  return 420 + 135 * (n - 1);
}

/**
 * Угроза одного врага: здоровье с поправкой на панцирь, регенерацию, шар, полёт, взрыв, жало,
 * сворачивание, прыжок, распад на половинки, стаю, морозную ауру, ледяную дорожку, бабочку
 * из кокона, лечение укусом, взмах по всему заслону и целебный свет. Бюджет волны
 * в этих единицах, а не в награде: у слизня на единицу награды втрое больше здоровья, чем у осы,
 * и волна из одних слизней иначе была бы втрое тяжелее волны из ос.
 */
export function threat(kind: EnemyKind): number {
  const d = ENEMIES[kind];
  let v = d.hp / (1 - d.armor * 0.6) + (d.regen ?? 0) * 20 + (d.ball?.hp ?? 0);
  if (d.flying) v *= 1.3;
  if (d.explode) v *= 1.2;
  if (d.sting) v *= 1.15;
  if (d.curl) v *= 1.2;
  if (d.leap) v *= 1.2;
  if (d.split) v += d.split.count * threat(d.split.kind);
  if (d.pack) v *= 1.3;
  if (d.chill) v *= 1.3;
  if (d.trail) v *= 1.3;
  if (d.drain) v *= 1.25;
  if (d.cleave) v *= 1.5;
  if (d.mend) v *= 1.5;
  // Кокон сам не опасен: его угроза — бабочка, которая вылетит, если его не успеют разбить.
  if (d.hatch) v = threat(d.hatch.kind) * 0.8;
  if (d.pupate) v += threat(d.pupate.kind);
  return v;
}

function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * n-я волна (с 1). Детерминирована: одно и то же n всегда даёт ту же волну, поэтому рекорды честные.
 * Каждая пятая волна воздушная, каждая седьмая бронированная, каждая десятая с боссом.
 * Волны до GUESTS_FROM от списка гостей не зависят: начало осады остаётся прежним.
 */
export function endlessWave(n: number): WaveDef {
  if (n <= 1) return { groups: [{ kind: 'termite', count: 8, interval: 1.0, delay: 0 }] };
  const rng = new Rng(9090 + n * 7919);
  const groups: WaveGroup[] = [];
  let b = budget(n);
  let delay = 0;
  if (n % 10 === 0) {
    const k = n / 10;
    groups.push({
      kind: BOSSES[(k - 1) % BOSSES.length],
      count: 1 + Math.floor((k - 1) / BOSSES.length),
      interval: 6,
      delay: 2,
    });
    b *= 0.7;
    delay = 5;
  }
  const air = n % 5 === 0;
  const armor = n % 7 === 0;
  const unlocked = TIERS.filter((t) => n >= t.from);
  const healer = (t: Tier): boolean => !!ENEMIES[t.kind].mend;
  const weightOf = (t: Tier): number => {
    let w = t.weight;
    // Новичок волны: только что открытый враг выходит чаще, чтобы его успели разглядеть.
    if (n - t.from < 3) w *= 1.8;
    // Лекарь в воздушной волне выходит с обычным весом: он поддержка, а не ударная сила.
    if (air && ENEMIES[t.kind].flying && !healer(t)) w *= 3;
    if (armor && ENEMIES[t.kind].armor >= 0.3) w *= 3;
    return w;
  };
  const weights = unlocked.map(weightOf);
  // Лекари не ходят двумя группами: стая летунов, которую лечили полтора десятка светлячков,
  // проходила насквозь на любой сложности. Второй раз жребий тянут без лекарей.
  const plain = unlocked.filter((t) => !healer(t));
  const plainWeights = plain.map(weightOf);
  let healers = 0;
  const nGroups = Math.min(5, 2 + Math.floor((n - 1) / 6));
  const shares: number[] = [];
  for (let i = 0; i < nGroups; i++) shares.push(rng.range(0.7, 1.3));
  const sum = shares.reduce((a, s) => a + s, 0);
  // Гость, который открылся именно на этой волне, занимает первую группу: иначе при двух десятках
  // видов он мог бы не выйти ни разу за свои «волны новичка».
  const debut = n >= GUESTS_FROM ? unlocked.filter((t) => t.from === n) : [];
  for (let i = 0; i < nGroups; i++) {
    // Жребий тянем всегда, чтобы порядок случайных чисел не зависел от дебюта.
    let picked = pickWeighted(rng, unlocked, weights);
    if (healer(picked) && healers > 0) picked = pickWeighted(rng, plain, plainWeights);
    const tier = debut[i] ?? picked;
    if (healer(tier)) healers++;
    const count = Math.max(1, Math.min(36, Math.round((b * shares[i]) / sum / threat(tier.kind))));
    const interval = Math.max(0.3, tier.interval * Math.max(0.55, 1 - n * 0.01));
    groups.push({ kind: tier.kind, count, interval: round2(interval), delay: round1(delay) });
    delay += rng.range(2.5, 5);
  }
  return { groups };
}

/** Поздне-летняя поляна: светлая трава, цветы, грибы и лужи. */
const FIELD: LevelTheme = {
  grass: '#69a646', grassLight: '#84bd5c', grassDark: '#548c37',
  dirt: '#bb8650', dirtDark: '#784c26',
  flowers: 0.22, mushrooms: 0.1, puddles: 0.06, oak: false, night: false,
};

export const ENDLESS: LevelDef = {
  id: 'endless',
  name: 'Бесконечная осада',
  subtitle: 'Спиральная тропа к муравейнику, волнам нет конца',
  story:
    'В самом центре большой поляны стоит новый муравейник, и к нему ведёт одна тропа: она дважды обвивает ' +
    'его спиралью. Волны не кончаются, каждая крепче прежней, а каждую десятую ведёт босс. За каждую десятую ' +
    'отбитую волну королева даёт дар: одно усиление из трёх на выбор. Башни между ' +
    'витками бьют сразу по двум. Карта больше экрана: тяни её пальцем или мышью, щипок и колесо меняют ' +
    'масштаб. Сколько волн продержишься?',
  // Вход слева посередине, затем два витка по часовой стрелке внутрь: вверх, вправо по верхнему
  // краю, вниз, влево по нижнему, и второй виток на три клетки внутри первого. Между витками по два
  // ряда клеток: башня там после улучшений достаёт сразу до двух витков. Последний отрезок
  // идёт по седьмому ряду к муравейнику в центре.
  paths: [[
    { x: -70, y: 680 },
    { x: 120, y: 680 },
    { x: 120, y: 120 },
    { x: 2120, y: 120 },
    { x: 2120, y: 1160 },
    { x: 360, y: 1160 },
    { x: 360, y: 360 },
    { x: 1880, y: 360 },
    { x: 1880, y: 920 },
    { x: 600, y: 920 },
    { x: 600, y: 600 },
    { x: 1160, y: 600 },
  ]],
  anthill: { x: 1160, y: 592 },
  seed: 9090,
  startGold: 450,
  lives: 20,
  waves: [],
  theme: FIELD,
  size: { w: ENDLESS_W, h: ENDLESS_H },
  waveDelay: 20,
  waveGen: endlessWave,
  hpMul: endlessHpMul,
  bountyMul: 1,
};
