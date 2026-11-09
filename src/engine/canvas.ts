import { LOGICAL_W, LOGICAL_H } from '../game/config';

/**
 * Экран: один canvas на всё окно. Игра рисуется в логических координатах
 * 1280x720 и масштабируется «contain» под любой экран (телефон, планшет, ПК).
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  scale = 1;
  offX = 0;
  offY = 0;
  cssW = 0;
  cssH = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    document.body.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / LOGICAL_W, h / LOGICAL_H);
    this.offX = (w - LOGICAL_W * this.scale) / 2;
    this.offY = (h - LOGICAL_H * this.scale) / 2;
  }

  /** Пикселей экрана на один логический пиксель. */
  get pixelScale(): number {
    return this.dpr * this.scale;
  }

  begin(): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#1f140b';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.pixelScale;
    c.setTransform(k, 0, 0, k, this.offX * this.dpr, this.offY * this.dpr);
    c.save();
    c.beginPath();
    c.rect(0, 0, LOGICAL_W, LOGICAL_H);
    c.clip();
  }

  end(): void {
    this.ctx.restore();
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return { x: (clientX - this.offX) / this.scale, y: (clientY - this.offY) / this.scale };
  }
}
