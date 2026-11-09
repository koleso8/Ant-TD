/**
 * Прогон баланса без браузера: игрок-робот играет каждый уровень несколькими
 * стратегиями и разными зёрнами случайности.
 * Запуск: `npm run sim [номер уровня|all] [зёрен] [easy|normal|hard]`.
 */
import { Rng } from '../src/engine/rng';
import { LEVELS } from '../src/game/levels';
import { World } from '../src/game/world';
import { NO_PERKS, type Perks } from '../src/game/perks';
import { DIFFICULTIES, type DifficultyDef, type TowerKind } from '../src/game/config';
import { GreedyPolicy, type PolicyOptions } from './policy';

declare const process: { argv: string[] };

interface RunResult {
  won: boolean;
  lives: number;
  wavesDone: number;
  total: number;
  time: number;
  leaks: number[];
  damage: Record<string, number>;
  goldEarned: number;
  heroDeaths: number;
  spells: number;
}

function runOnce(levelIndex: number, opts: PolicyOptions, seed: number, difficulty: DifficultyDef, perks: Perks = NO_PERKS): RunResult {
  const rng = new Rng(seed);
  Math.random = () => rng.next();
  const level = LEVELS[levelIndex];
  const w = new World(level, perks, difficulty);
  const policy = new GreedyPolicy(w, opts);
  const dt = 1 / 60;
  while (w.state === 'playing' && w.time < 2400) {
    policy.act(dt);
    w.step(dt);
  }
  const leaks: number[] = [];
  for (let i = 1; i <= level.waves.length; i++) leaks.push(w.stats.leaksByWave[i] ?? 0);
  return {
    won: w.state === 'won',
    lives: w.lives,
    wavesDone: w.state === 'won' ? w.waves.total : Math.max(0, w.waves.index - 1),
    total: w.waves.total,
    time: w.time,
    leaks,
    damage: w.stats.damage,
    goldEarned: w.stats.goldEarned,
    heroDeaths: w.stats.heroDeaths,
    spells: w.spells.casts,
  };
}

const MIX: TowerKind[] = ['acid', 'barracks', 'acid', 'spore', 'catapult', 'acid', 'barracks', 'spore'];
const POLICIES: PolicyOptions[] = [
  { name: 'mix-early', early: true, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: true },
  { name: 'mix-patient', early: false, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: true },
  { name: 'upgrader', early: true, order: MIX, towersBeforeUpgrades: 4, buildFraction: 0.45, maxTowers: 9, specPick: 'alt', useSpells: true },
  { name: 'acid-heavy', early: true, order: ['acid', 'acid', 'barracks', 'acid', 'spore', 'acid', 'catapult'], towersBeforeUpgrades: 6, buildFraction: 0.6, maxTowers: 12, specPick: 0, useSpells: true },
  { name: 'no-spells', early: true, order: MIX, towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: false },
];

function damageShare(d: Record<string, number>): string {
  const total = Object.values(d).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
    .join(', ');
}

const args = process.argv.slice(2);
const onlyLevel = args[0] !== undefined && args[0] !== 'all' && Number(args[0]) > 0 ? Number(args[0]) - 1 : null;
const seeds = args[1] !== undefined ? Number(args[1]) : 3;
const difficulty = DIFFICULTIES.find((d) => d.id === (args[2] ?? 'normal')) ?? DIFFICULTIES[1];

for (let li = 0; li < LEVELS.length; li++) {
  if (onlyLevel !== null && li !== onlyLevel) continue;
  const lv = LEVELS[li];
  const cells = new World(lv).plots.length;
  console.log(`\n=== Уровень ${li + 1}: ${lv.name} (${lv.waves.length} волн, ${cells} клеток, сложность: ${difficulty.name}) ===`);
  for (const pol of POLICIES) {
    const results: RunResult[] = [];
    for (let s = 1; s <= seeds; s++) results.push(runOnce(li, pol, 1000 + s * 7919, difficulty));
    const wins = results.filter((r) => r.won).length;
    const avgLives = results.reduce((a, r) => a + r.lives, 0) / results.length;
    const avgWaves = results.reduce((a, r) => a + r.wavesDone, 0) / results.length;
    const r0 = results[0];
    console.log(
      `${pol.name.padEnd(12)} побед ${wins}/${results.length}  личинок ${avgLives.toFixed(1)}  волн ${avgWaves.toFixed(1)}/${r0.total}` +
      `  нектар ${Math.round(r0.goldEarned)}  заклинаний ${r0.spells}  герой пал ${r0.heroDeaths}  время ${Math.round(r0.time)}с`,
    );
    console.log(`             утечки по волнам: [${r0.leaks.join(' ')}]`);
    console.log(`             урон: ${damageShare(r0.damage)}`);
  }
}
