import { LOGICAL_W, LOGICAL_H } from '../game/config';

/**
 * Экран: один canvas на видимую часть окна. Игра рисуется в логических координатах
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
  /** Левый верхний угол холста в координатах окна, в которых приходят clientX/clientY. */
  private left = 0;
  private top = 0;
  /** Последний применённый размер: холст пересоздаётся только при изменении. */
  private applied = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    document.body.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.sync();
    const sync = (): void => this.sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    document.addEventListener('fullscreenchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
  }

  /**
   * Подгоняет холст под видимую область окна. Размер берётся из visualViewport, а не из
   * window.innerWidth/innerHeight: Chrome на Android после поворота телефона оставлял высоту
   * от вертикального положения, холст выходил выше экрана, и игра уезжала вниз за край.
   * Вызывается каждый кадр, поэтому не зависит от того, пришло ли событие resize и когда.
   */
  sync(): void {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    const left = vv ? Math.round(vv.offsetLeft) : 0;
    const top = vv ? Math.round(vv.offsetTop) : 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${w}x${h}+${left}+${top}@${dpr}`;
    if (key === this.applied) return;
    this.applied = key;
    this.cssW = w;
    this.cssH = h;
    this.left = left;
    this.top = top;
    this.dpr = dpr;
    const s = this.canvas.style;
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.width = `${w}px`;
    s.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(w / LOGICAL_W, h / LOGICAL_H);
    this.offX = (w - LOGICAL_W * this.scale) / 2;
    this.offY = (h - LOGICAL_H * this.scale) / 2;
  }

  /** Пикселей экрана на один логический пиксель. */
  get pixelScale(): number {
    return this.dpr * this.scale;
  }

  begin(): void {
    this.sync();
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
    return { x: (clientX - this.left - this.offX) / this.scale, y: (clientY - this.top - this.offY) / this.scale };
  }
}
