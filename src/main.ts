import { Screen } from './engine/canvas';
import { Input } from './engine/input';
import { Game } from './game/game';

function boot(): void {
  const screen = new Screen();
  const input = new Input(screen);
  const game = new Game(screen, input);

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;

  const frame = (now: number): void => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = 0;
    game.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.autoPause();
    last = performance.now();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
