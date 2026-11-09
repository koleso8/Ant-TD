import { SHEET } from '../sprites/layout';
import { setSpriteDrawer, type SpriteKind } from './art';
import antWorkerUrl from '../assets/sprites/ant_worker.webp';
import antSoldierUrl from '../assets/sprites/ant_soldier.webp';
import antHeroUrl from '../assets/sprites/ant_hero.webp';
import antBlackUrl from '../assets/sprites/ant_black.webp';
import termiteUrl from '../assets/sprites/termite.webp';
import termiteSoldierUrl from '../assets/sprites/termite_soldier.webp';
import termiteBomberUrl from '../assets/sprites/termite_bomber.webp';
import spiderUrl from '../assets/sprites/spider.webp';
import beetleUrl from '../assets/sprites/beetle.webp';
import rhinoUrl from '../assets/sprites/rhino.webp';
import waspUrl from '../assets/sprites/wasp.webp';
import hornetUrl from '../assets/sprites/hornet.webp';
import slugUrl from '../assets/sprites/slug.webp';
import leechUrl from '../assets/sprites/leech.webp';
import dragonflyUrl from '../assets/sprites/dragonfly.webp';
import queenUrl from '../assets/sprites/queen.webp';
import empressUrl from '../assets/sprites/empress.webp';

/**
 * Спрайт-листы в игре. Модуль только для браузера: симуляция в Node его не импортирует,
 * поэтому art.ts получает рисовальщик через setSpriteDrawer, а не импортом.
 * Пока лист не загрузился, art.ts рисует существо векторно.
 */
class SpriteSheet {
  readonly img = new Image();
  ready = false;

  constructor(url: string) {
    this.img.onload = () => { this.ready = true; };
    this.img.src = url;
  }

  /**
   * Нарисовать кадр: `angle` — куда смотрит существо (радианы, ось y вниз), `phase` — фаза шага
   * (2π на один шаг), `s` — масштаб к игровому (1 = кадр 64 логических px).
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, phase: number, s: number): boolean {
    if (!this.ready) return false;
    const F = SHEET.frame;
    const dirs = SHEET.directions.length;
    const dir = (((Math.round(angle / (Math.PI / 4)) % dirs) + dirs) % dirs);
    const n = SHEET.frames;
    const frame = ((Math.floor((phase / (Math.PI * 2)) * n) % n) + n) % n;
    const k = SHEET.gameScale * s;
    ctx.drawImage(this.img, frame * F, dir * F, F, F, x - SHEET.anchor[0] * k, y - SHEET.anchor[1] * k, F * k, F * k);
    return true;
  }
}

let sheets: Record<SpriteKind, SpriteSheet> | null = null;

/** Создать листы и подключить их к art.ts. Вызывается один раз при старте игры. */
export function installSprites(): void {
  if (sheets) return;
  sheets = {
    antWorker: new SpriteSheet(antWorkerUrl),
    antSoldier: new SpriteSheet(antSoldierUrl),
    antHero: new SpriteSheet(antHeroUrl),
    antBlack: new SpriteSheet(antBlackUrl),
    termite: new SpriteSheet(termiteUrl),
    termiteSoldier: new SpriteSheet(termiteSoldierUrl),
    termiteBomber: new SpriteSheet(termiteBomberUrl),
    spider: new SpriteSheet(spiderUrl),
    beetle: new SpriteSheet(beetleUrl),
    rhino: new SpriteSheet(rhinoUrl),
    wasp: new SpriteSheet(waspUrl),
    hornet: new SpriteSheet(hornetUrl),
    slug: new SpriteSheet(slugUrl),
    leech: new SpriteSheet(leechUrl),
    dragonfly: new SpriteSheet(dragonflyUrl),
    queen: new SpriteSheet(queenUrl),
    empress: new SpriteSheet(empressUrl),
  };
  const s = sheets;
  setSpriteDrawer((kind, ctx, x, y, angle, scale, phase) => s[kind].draw(ctx, x, y, angle, phase, scale));
}
