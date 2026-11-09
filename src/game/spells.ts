import { dist, type Vec } from '../engine/math';
import { HERO, SPELLS, type SpellDef } from './config';
import type { GameCtx } from './types';
import { Soldier, type SoldierHost } from './soldier';
import type { Hero } from './hero';
import type { Perks } from './perks';
import { PAL } from '../render/palette';

/**
 * Заклинания колонии: три кнопки в хотбаре с перезарядкой, цель выбирается тапом по полю.
 * Заменяют ручное управление героем: он теперь выходит на поле «Дружиной».
 */
export class SpellBook {
  readonly cooldowns: number[] = SPELLS.map(() => 0);
  /** Солдаты дружины на поле (сам герой живёт в World.hero). */
  recruits: Soldier[] = [];
  private retinueLeft = 0;
  /** Сколько заклинаний применено: для отчёта симуляции. */
  casts = 0;

  constructor(private readonly perks: Perks) {}

  cooldownOf(i: number): number {
    return Math.round(SPELLS[i].cooldown * this.perks.spellCdMul);
  }
  ready(i: number): boolean {
    return this.cooldowns[i] <= 0;
  }

  update(dt: number, g: GameCtx): void {
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    if (this.recruits.length) {
      this.retinueLeft -= dt;
      for (const s of this.recruits) s.update(dt, g);
      if (this.retinueLeft <= 0) {
        for (const s of this.recruits) {
          s.dropTarget();
          if (!s.dead) g.effects.burst(s.x, s.y, 6, 'rgba(255,240,200,0.9)', 80, 2.5, 0.35, 0);
        }
        this.recruits = [];
      }
    }
  }

  /** Применить заклинание i в точке p; false, если оно ещё перезаряжается. */
  cast(i: number, p: Vec, g: GameCtx, hero: Hero): boolean {
    if (!this.ready(i)) return false;
    const def = SPELLS[i];
    switch (def.id) {
      case 'acid': this.acidRain(def, p, g); break;
      case 'retinue': this.retinue(def, p, g, hero); break;
      case 'spores': this.sporeCloud(def, p, g); break;
    }
    this.cooldowns[i] = this.cooldownOf(i);
    this.casts++;
    return true;
  }

  /** Кислотный дождь: рабочие разом плюют в точку, урон всем в круге, панцирь не спасает. */
  private acidRain(def: SpellDef, p: Vec, g: GameCtx): void {
    const dmg = def.damage ?? 0;
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (dist(e.x, e.y, p.x, p.y) <= def.radius + e.def.radius) e.damage(dmg, 'true', g, false, 0, 'spell');
    }
    g.effects.ring(p.x, p.y, def.radius, 'rgba(155,229,58,0.95)', 0.5);
    g.effects.burst(p.x, p.y, 26, PAL.acid, 220, 4, 0.6, 320);
    g.effects.text(def.name, p.x, p.y - 40, PAL.uiGreen, 20);
  }

  /** Дружина: Жвал и двое солдат выходят в точку и держат врагов, пока не выйдет время. */
  private retinue(def: SpellDef, p: Vec, g: GameCtx, hero: Hero): void {
    const dur = def.duration ?? HERO.summonDuration;
    hero.summon(p, dur, g);
    const host: SoldierHost = {
      x: p.x,
      y: p.y,
      rally: { x: p.x, y: p.y },
      rallyAngle: -Math.PI / 2,
      stats: { soldierHp: Math.round(HERO.retinueHp * this.perks.soldierHp), soldierDmg: HERO.retinueDmg, respawn: 1e9 },
      specDef: null,
    };
    for (const s of this.recruits) s.dropTarget();
    this.recruits = [new Soldier(host, 1), new Soldier(host, 2)];
    this.retinueLeft = dur;
    g.effects.ring(p.x, p.y, def.radius, 'rgba(255,217,90,0.9)', 0.5);
    g.effects.text(def.name, p.x, p.y - 44, PAL.uiGold, 20);
  }

  /** Споровая туча: облако грибницы в точке, замедляет, травит и оглушает на входе. */
  private sporeCloud(def: SpellDef, p: Vec, g: GameCtx): void {
    const dur = (def.duration ?? 6) * (1 + (this.perks.sporeMul - 1) * 0.5);
    g.clouds.push({
      x: p.x, y: p.y, r: def.radius, life: dur, max: dur,
      slow: 0.5, dps: Math.round(10 * this.perks.sporeMul), poisonDur: 3, stun: 1, stunned: new Set(), variant: 1,
    });
    g.effects.sporePuff(p.x, p.y);
    g.effects.text(def.name, p.x, p.y - 40, PAL.spore, 20);
  }
}
