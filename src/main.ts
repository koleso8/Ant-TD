import { Screen } from './engine/canvas';
import { Input } from './engine/input';
import { Game } from './game/game';

/** Офлайн и установка как приложение: только в собранной игре, в dev service worker мешал бы горячей перезагрузке. */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const go = (): void => { navigator.serviceWorker.register('./sw.js').catch(() => {}); };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
}

function boot(): void {
  registerServiceWorker();
  const screen = new Screen();
  const input = new Input(screen);
  const game = new Game(screen, input);
  // Дев: игра доступна из консоли для проверок; в сборку не попадает.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

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
