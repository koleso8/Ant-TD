import { PAL } from './palette';

export function font(size: number, weight = 'bold'): string {
  return `${weight} ${size}px "Trebuchet MS", "Segoe UI", Tahoma, Arial, sans-serif`;
}

export interface TextOpts {
  size?: number;
  color?: string;
  stroke?: string | null;
  strokeWidth?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: string;
  alpha?: number;
}

/** Текст с мультяшной обводкой. */
export function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {},
): void {
  const size = o.size ?? 20;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.font = font(size, o.weight ?? 'bold');
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  const stroke = o.stroke === undefined ? PAL.outline : o.stroke;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = o.strokeWidth ?? Math.max(2, size * 0.18);
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = o.color ?? PAL.uiLight;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function measure(ctx: CanvasRenderingContext2D, text: string, size: number, weight = 'bold'): number {
  ctx.save();
  ctx.font = font(size, weight);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

export function wrapText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 'normal',
): string[] {
  ctx.save();
  ctx.font = font(size, weight);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}
