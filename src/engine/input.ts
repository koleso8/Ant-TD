import type { Vec } from './math';
import type { Screen } from './canvas';

/** Сдвиг пальца или мыши, после которого нажатие уже не тап, а перетаскивание. */
const DRAG_START = 16;

/**
 * Единый ввод: мышь и палец через Pointer Events. Тап = нажал и отпустил без сдвига.
 * Сдвиг дальше DRAG_START — перетаскивание, два пальца — щипок, колесо мыши — масштаб;
 * их слушает только камера большой карты, на обычных уровнях они ничего не делают.
 */
export class Input {
  hover: Vec | null = null;
  onTap: (p: Vec) => void = () => {};
  /** Правая кнопка мыши: быстрый приказ герою на ПК. */
  onSecondaryTap: (p: Vec) => void = () => {};
  onKey: (key: string) => void = () => {};
  /** Перетаскивание: сдвиг в логических пикселях экрана с прошлого вызова. */
  onDrag: (dx: number, dy: number) => void = () => {};
  /** Щипок или колесо: во сколько раз изменить масштаб и вокруг какой точки экрана. */
  onZoom: (factor: number, at: Vec) => void = () => {};
  private down: { x: number; y: number; t: number; id: number; dragging: boolean; lx: number; ly: number } | null = null;
  /** Пальцы на экране: для щипка нужны два. */
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; mx: number; my: number } | null = null;

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
      if (e.pointerType !== 'mouse') {
        this.hover = null;
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touches.size === 2) {
          // Второй палец: это щипок, а не тап и не перетаскивание первым пальцем.
          this.down = null;
          this.pinch = this.pinchState();
          return;
        }
        if (this.touches.size > 2) return;
      }
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, dragging: false, lx: e.clientX, ly: e.clientY };
    });
    c.addEventListener('pointerup', (e) => {
      e.preventDefault();
      this.release(e.pointerId);
      if (e.button === 2) { this.down = null; return; }
      const d = this.down;
      if (d && d.id === e.pointerId) {
        const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (!d.dragging && moved < DRAG_START && performance.now() - d.t < 700) {
          this.onTap(this.screen.toLogical(e.clientX, e.clientY));
        }
        this.down = null;
      }
    });
    c.addEventListener('pointercancel', (e) => {
      this.release(e.pointerId);
      if (this.down?.id === e.pointerId) this.down = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.hover = this.screen.toLogical(e.clientX, e.clientY);
      const t = this.touches.get(e.pointerId);
      if (t) {
        t.x = e.clientX;
        t.y = e.clientY;
      }
      if (this.pinch && this.touches.size === 2) {
        const p = this.pinchState();
        const k = this.screen.scale;
        if (this.pinch.d > 0 && p.d > 0) this.onZoom(p.d / this.pinch.d, this.screen.toLogical(p.mx, p.my));
        this.onDrag((p.mx - this.pinch.mx) / k, (p.my - this.pinch.my) / k);
        this.pinch = p;
        return;
      }
      const d = this.down;
      if (!d || d.id !== e.pointerId) return;
      if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= DRAG_START) d.dragging = true;
      if (d.dragging) {
        const k = this.screen.scale;
        this.onDrag((e.clientX - d.lx) / k, (e.clientY - d.ly) / k);
      }
      d.lx = e.clientX;
      d.ly = e.clientY;
    });
    c.addEventListener('pointerleave', () => { this.hover = null; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Колесо и щипок тачпада: deltaY с шагом около 100 на щелчок колеса.
      const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 33 : 1));
      this.onZoom(f, this.screen.toLogical(e.clientX, e.clientY));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.onKey(e.key);
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    });
  }

  /** Расстояние между двумя пальцами и середина между ними, в пикселях окна. */
  private pinchState(): { d: number; mx: number; my: number } {
    const [a, b] = [...this.touches.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  /** Палец поднят: щипок кончился, оставшийся палец дальше тянет карту, но тапом уже не станет. */
  private release(id: number): void {
    if (!this.touches.delete(id)) return;
    if (this.pinch) {
      this.pinch = null;
      const rest = [...this.touches.entries()][0];
      if (rest) {
        const [rid, p] = rest;
        this.down = { x: p.x, y: p.y, t: 0, id: rid, dragging: true, lx: p.x, ly: p.y };
      }
    }
  }
}
