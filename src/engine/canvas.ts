import { LOGICAL_W, LOGICAL_H } from '../game/config';

/**
 * Насколько мир может выйти за кадр 1280x720: по ширине до 21.6:9, по высоте до 5:4.
 * Игровое поле всегда кадр, а поля вокруг него дорисовываются; на ещё более вытянутых экранах
 * (и в портрете) за этими пределами остаются тёмные полосы.
 */
export const MAX_EXTRA_X = 224;
export const MAX_EXTRA_Y = 152;

/** Прямоугольник в логических координатах. */
export interface ViewRect { x0: number; y0: number; x1: number; y1: number }

/**
 * Экран: один canvas на видимую часть окна. Кадр 1280x720 вписывается целиком
 * («contain»), а остаток экрана заполняется продолжением мира (view шире или выше кадра).
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
  /** Видимая часть мира в логических координатах: кадр плюс поля по краям экрана. */
  view: ViewRect = { x0: 0, y0: 0, x1: LOGICAL_W, y1: LOGICAL_H };
  /** Вырез камеры и полоска «домой»: отступы от краёв view в логических пикселях. */
  safe = { l: 0, t: 0, r: 0, b: 0 };
  /** Левый верхний угол холста в координатах окна, в которых приходят clientX/clientY. */
  private left = 0;
  private top = 0;
  /** Последний применённый размер: холст пересоздаётся только при изменении. */
  private applied = '';
  /** Невидимый элемент с padding: env(safe-area-inset-*): так браузер сообщает размеры выреза. */
  private readonly probe: HTMLDivElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    document.body.appendChild(this.canvas);
    this.probe = document.createElement('div');
    this.probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(this.probe);
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
    // Ориентация в ключе: на iPhone при повороте на 180° размер тот же, а вырез переезжает на другую сторону.
    const orient = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.type : '';
    const key = `${w}x${h}+${left}+${top}@${dpr}/${orient}`;
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
    // Края экрана в логических координатах и видимая часть мира в пределах допустимых полей.
    const sx0 = -this.offX / this.scale;
    const sx1 = (w - this.offX) / this.scale;
    const sy0 = -this.offY / this.scale;
    const sy1 = (h - this.offY) / this.scale;
    const v: ViewRect = {
      x0: Math.max(Math.floor(sx0), -MAX_EXTRA_X),
      y0: Math.max(Math.floor(sy0), -MAX_EXTRA_Y),
      x1: Math.min(Math.ceil(sx1), LOGICAL_W + MAX_EXTRA_X),
      y1: Math.min(Math.ceil(sy1), LOGICAL_H + MAX_EXTRA_Y),
    };
    this.view = v;
    // Вырез считается от края экрана; если там тёмная полоса, она его уже частично закрывает.
    const cs = getComputedStyle(this.probe);
    const inset = (px: string, gap: number): number => Math.max(0, (parseFloat(px) || 0) / this.scale - Math.max(0, gap));
    this.safe = {
      l: inset(cs.paddingLeft, v.x0 - sx0),
      r: inset(cs.paddingRight, sx1 - v.x1),
      t: inset(cs.paddingTop, v.y0 - sy0),
      b: inset(cs.paddingBottom, sy1 - v.y1),
    };
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
    const v = this.view;
    c.rect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    c.clip();
  }

  end(): void {
    this.ctx.restore();
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return { x: (clientX - this.left - this.offX) / this.scale, y: (clientY - this.top - this.offY) / this.scale };
  }
}
