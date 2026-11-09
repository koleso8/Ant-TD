import type { Vec } from './math';
import type { Screen } from './canvas';

/** Единый ввод: мышь и палец через Pointer Events. Тап = нажал и отпустил без сдвига. */
export class Input {
  hover: Vec | null = null;
  onTap: (p: Vec) => void = () => {};
  /** Правая кнопка мыши: быстрый приказ герою на ПК. */
  onSecondaryTap: (p: Vec) => void = () => {};
  onKey: (key: string) => void = () => {};
  private down: { x: number; y: number; t: number; id: number } | null = null;

  constructor(private screen: Screen) {
    const c = screen.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.button === 2) {
        this.down = null;
        this.onSecondaryTap(this.screen.toLogical(e.clientX, e.clientY));
        return;
      }
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      if (e.pointerType !== 'mouse') this.hover = null;
    });
    c.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (e.button === 2) { this.down = null; return; }
      const d = this.down;
      if (d && d.id === e.pointerId) {
        const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (moved < 16 && performance.now() - d.t < 700) {
          this.onTap(this.screen.toLogical(e.clientX, e.clientY));
        }
      }
      this.down = null;
    });
    c.addEventListener('pointercancel', () => { this.down = null; });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.hover = this.screen.toLogical(e.clientX, e.clientY);
    });
    c.addEventListener('pointerleave', () => { this.hover = null; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.onKey(e.key);
      if (e.key === ' ') e.preventDefault();
    });
  }
}
