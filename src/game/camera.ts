import { clamp, type Vec } from '../engine/math';
import type { ViewRect } from '../engine/canvas';
import { LOGICAL_H, LOGICAL_W } from './config';

/** Центр кадра 1280x720 в координатах экрана: камера вращается вокруг него. */
const CX = LOGICAL_W / 2;
const CY = LOGICAL_H / 2;

/**
 * Камера над картой. Обычные уровни ровно в кадр, и камера стоит на месте: мир и экран совпадают.
 * Большая карта (бесконечная осада) двигается пальцем или мышью, щипок и колесо меняют масштаб;
 * интерфейс рисуется поверх в координатах экрана и от камеры не зависит.
 */
export class Camera {
  /** Точка мира в центре кадра. */
  x = CX;
  y = CY;
  zoom = 1;
  /** Двигается ли камера: только на картах больше кадра. */
  free = false;
  /** Какую часть мира можно показать: карта и поля вокруг неё. */
  area: ViewRect = { x0: 0, y0: 0, x1: LOGICAL_W, y1: LOGICAL_H };
  readonly maxZoom = 1.4;

  /** Обычный уровень: камера в кадре и стоит. */
  fixed(): void {
    this.free = false;
    this.x = CX;
    this.y = CY;
    this.zoom = 1;
  }

  /** Большая карта: камера свободна в пределах area, начинает с вида на точку focus. */
  open(area: ViewRect, focus: Vec, zoom: number): void {
    this.free = true;
    this.area = { ...area };
    this.x = focus.x;
    this.y = focus.y;
    this.zoom = zoom;
  }

  toWorld(sx: number, sy: number): Vec {
    return { x: (sx - CX) / this.zoom + this.x, y: (sy - CY) / this.zoom + this.y };
  }

  toScreen(wx: number, wy: number): Vec {
    return { x: (wx - this.x) * this.zoom + CX, y: (wy - this.y) * this.zoom + CY };
  }

  /** Видимая часть мира, если на экране видна область v. */
  visible(v: ViewRect): ViewRect {
    const a = this.toWorld(v.x0, v.y0);
    const b = this.toWorld(v.x1, v.y1);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }

  apply(ctx: CanvasRenderingContext2D): void {
    if (!this.free) return;
    ctx.translate(CX, CY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Самый мелкий масштаб: видимая область не выходит за карту с полями. */
  minZoom(v: ViewRect): number {
    const a = this.area;
    return Math.max((v.x1 - v.x0) / (a.x1 - a.x0), (v.y1 - v.y0) / (a.y1 - a.y0));
  }

  /** Масштаб, при котором карта без полей видна целиком (насколько позволяет экран). */
  fitZoom(v: ViewRect, w: number, h: number): number {
    return clamp(Math.min((v.x1 - v.x0) / w, (v.y1 - v.y0) / h), this.minZoom(v), 1);
  }

  /** Держит масштаб в пределах и не даёт увести взгляд за поля карты. */
  clamp(v: ViewRect): void {
    if (!this.free) {
      this.fixed();
      return;
    }
    const lo = this.minZoom(v);
    this.zoom = clamp(this.zoom, lo, Math.max(lo, this.maxZoom));
    const vis = this.visible(v);
    const a = this.area;
    const fit = (lo0: number, hi0: number, vlo: number, vhi: number, c: number): number => {
      if (vhi - vlo >= hi0 - lo0) return (lo0 + hi0) / 2 + (c - (vlo + vhi) / 2);
      if (vlo < lo0) return c + (lo0 - vlo);
      if (vhi > hi0) return c - (vhi - hi0);
      return c;
    };
    this.x = fit(a.x0, a.x1, vis.x0, vis.x1, this.x);
    this.y = fit(a.y0, a.y1, vis.y0, vis.y1, this.y);
  }

  /** Сдвиг на (dx, dy) пикселей экрана: мир едет за пальцем. */
  pan(dx: number, dy: number): void {
    if (!this.free) return;
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Масштаб в f раз вокруг точки экрана: точка мира под пальцем остаётся на месте. */
  zoomAt(f: number, sx: number, sy: number, v: ViewRect): void {
    if (!this.free) return;
    const before = this.toWorld(sx, sy);
    const lo = this.minZoom(v);
    this.zoom = clamp(this.zoom * f, lo, Math.max(lo, this.maxZoom));
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }
}
