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
];

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
 * Угроза одного врага: здоровье с поправкой на панцирь, регенерацию, полёт и взрыв. Бюджет волны
 * в этих единицах, а не в награде: у слизня на единицу награды втрое больше здоровья, чем у осы,
 * и волна из одних слизней иначе была бы втрое тяжелее волны из ос.
 */
function threat(kind: EnemyKind): number {
  const d = ENEMIES[kind];
  let v = d.hp / (1 - d.armor * 0.6) + (d.regen ?? 0) * 20;
  if (d.flying) v *= 1.3;
  if (d.explode) v *= 1.2;
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
  const weights = unlocked.map((t) => {
    let w = t.weight;
    // Новичок волны: только что открытый враг выходит чаще, чтобы его успели разглядеть.
    if (n - t.from < 3) w *= 1.8;
    if (air && ENEMIES[t.kind].flying) w *= 3;
    if (armor && ENEMIES[t.kind].armor >= 0.3) w *= 3;
    return w;
  });
  const nGroups = Math.min(5, 2 + Math.floor((n - 1) / 6));
  const shares: number[] = [];
  for (let i = 0; i < nGroups; i++) shares.push(rng.range(0.7, 1.3));
  const sum = shares.reduce((a, s) => a + s, 0);
  for (let i = 0; i < nGroups; i++) {
    const tier = pickWeighted(rng, unlocked, weights);
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
    'его спиралью. Волны не кончаются, каждая крепче прежней, а каждую десятую ведёт босс. Башни между ' +
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
