/**
 * Проверка обучения: игрок делает ровно то, что велят подсказки, и ничего сверх.
 * Он должен пройти плац легко, почти без потерь: обучение не должно наказывать.
 * Запуск: `npx tsx sim/tutorial.ts [зёрен]`.
 */
import { Rng } from '../src/engine/rng';
import { TUTORIAL } from '../src/game/levels';
import { World } from '../src/game/world';
import { TOWERS, type TowerKind } from '../src/game/config';

declare const process: { argv: string[] };

function topUp(w: World, n: number): void {
  if (w.gold < n) w.addGold(n - w.gold);
}

function build(w: World, kind: TowerKind, x: number, y: number): void {
  const p = w.plotAt(x, y);
  if (!p) throw new Error(`нет клетки ${x},${y}`);
  topUp(w, TOWERS[kind].levels[0].cost);
  if (!w.build(kind, p)) throw new Error(`не построить ${kind}`);
}

function run(seed: number): { lives: number; time: number; leaks: number[] } {
  const rng = new Rng(seed);
  Math.random = () => rng.next();
  const w = new World(TUTORIAL);
  const dt = 1 / 60;
  // Игрок думает не мгновенно: на каждое задание пара секунд.
  const think = 2.5;
  let step = 0;
  let wait = think;
  const alive = () => w.enemies.filter((e) => !e.dead);
  while (w.state === 'playing' && w.time < 600) {
    wait -= dt;
    const ready = wait <= 0;
    const next = (): void => { step++; wait = think; };
    w.waves.hold = ![1, 4, 8, 10, 13].includes(step);
    switch (step) {
      case 0: if (ready) { build(w, 'acid', 360, 360); next(); } break;
      case 1: if (ready) { w.callWave(); next(); } break;
      case 2: if (w.clearedWaves >= 1) next(); break;
      case 3: if (ready) { build(w, 'barracks', 600, 600); next(); } break;
      case 4: if (ready) { w.callWave(); next(); } break;
      case 5: if (w.clearedWaves >= 2) next(); break;
      case 6: if (ready) { const a = w.towers.find((t) => t.kind === 'acid')!; topUp(w, a.upgradeCost ?? 0); w.upgrade(a); next(); } break;
      case 7: if (ready) { build(w, 'spore', 760, 440); next(); } break;
      case 8: if (ready) { w.callWave(); next(); } break;
      case 9: if (w.clearedWaves >= 3) next(); break;
      case 10: if (ready) { w.callWave(); next(); } break;
      case 11: {
        // Время замирает на толпе: игрок жмёт кнопку и тапает по середине толпы.
        const list = alive();
        if (list.length >= 7 || (!w.waves.spawning && list.length >= 2) || w.clearedWaves >= 4) {
          let x = 0;
          let y = 0;
          for (const e of list) { x += e.x; y += e.y; }
          w.spells.cooldowns[0] = 0;
          w.castSpell(0, list.length ? { x: x / list.length, y: y / list.length } : { x: 640, y: 520 });
          next();
        }
        break;
      }
      case 12: if (w.clearedWaves >= 4) next(); break;
      case 13: if (ready) { w.callWave(); next(); } break;
      case 14: {
        const b = alive().find((e) => e.def.kind === 'beetle');
        if (b ? b.progress > b.path.length * 0.3 : !w.waves.queue.some((s) => s.kind === 'beetle')) {
          const path = b ? b.path : w.paths[0];
          const p = path.at(b ? b.progress + 110 : path.length * 0.6);
          w.spells.cooldowns[1] = 0;
          w.castSpell(1, { x: p.x, y: p.y });
          next();
        }
        break;
      }
      default: break;
    }
    w.step(dt);
  }
  const leaks: number[] = [];
  for (let i = 1; i <= TUTORIAL.waves.length; i++) leaks.push(w.stats.leaksByWave[i] ?? 0);
  if (w.state !== 'won') throw new Error(`обучение не пройдено: ${w.state}, шаг ${step}`);
  return { lives: w.lives, time: w.time, leaks };
}

const seeds = Number(process.argv[2] ?? 5);
for (let s = 1; s <= seeds; s++) {
  const r = run(1000 + s * 7919);
  console.log(`зерно ${s}: личинок ${r.lives}/20, время ${Math.round(r.time)} с, утечки по волнам [${r.leaks.join(' ')}]`);
}
