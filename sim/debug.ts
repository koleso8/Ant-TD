/** Отладка одного уровня: клетки, постройки робота и утечки. Запуск: npx tsx sim/debug.ts 4 */
import { Rng } from '../src/engine/rng';
import { LEVELS } from '../src/game/campaign';
import { World } from '../src/game/world';
import { GreedyPolicy } from './policy';

declare const process: { argv: string[] };

const li = Number(process.argv[2] ?? '4') - 1;
const level = LEVELS[li];
const rng = new Rng(7919);
Math.random = () => rng.next();
const w = new World(level);
console.log(`${level.name}: ${w.plots.length} клеток`);
const rows = new Map<number, number[]>();
for (const p of w.plots) {
  if (!rows.has(p.row)) rows.set(p.row, []);
  rows.get(p.row)!.push(p.col);
}
for (const [r, cols] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
  let line = '';
  for (let c = 0; c < 16; c++) line += cols.includes(c) ? ' .' : ' #';
  console.log(`row ${r} (y=${r * 80 + 40}):${line}`);
}
console.log('тропы:', w.paths.map((p) => Math.round(p.length)).join(' / '));
const policy = new GreedyPolicy(w, { name: 'dbg', early: true, order: ['acid', 'barracks', 'acid', 'spore', 'catapult', 'acid', 'barracks', 'spore'], towersBeforeUpgrades: 5, buildFraction: 0.6, maxTowers: 12, specPick: 'alt', useSpells: true });
const dt = 1 / 60;
let lastWave = 0;
while (w.state === 'playing' && w.time < 2400) {
  policy.act(dt);
  w.step(dt);
  if (w.waves.index !== lastWave) {
    lastWave = w.waves.index;
    const t = w.towers.map((x) => `${x.kind[0]}${x.level}@(${x.x},${x.y})`).join(' ');
    console.log(`волна ${lastWave}: нектар ${Math.round(w.gold)} личинок ${w.lives} башни [${t}]`);
  }
}
console.log(`итог: ${w.state}, личинок ${w.lives}, заклинаний ${w.spells.casts}`);
console.log('утечки:', w.stats.leaksByWave.map((v, i) => (v ? `w${i}:${v}` : '')).filter(Boolean).join(' '));
