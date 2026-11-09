import { angleTo, lerpAngle, roll, TAU } from '../engine/math';
import { ENEMIES, type BossDef, type EnemyDef, type EnemyKind } from './config';
import type { Blocker, GameCtx } from './types';
import type { Path } from './path';
import {
  ANT_BLACK, circle, drawAnt, drawBeetle, drawDragonfly, drawHealthBar, drawLeech, drawShadow, drawSlug, drawSpider,
  drawTermite, drawTermiteQueen, drawWasp,
} from '../render/art';
import { PAL } from '../render/palette';

export type DamageKind = 'physical' | 'poison' | 'true';

export class Enemy {
  readonly def: EnemyDef;
  hp: number;
  maxHp: number;
  progress = 0;
  x: number;
  y: number;
  angle: number;
  slowAmount = 0;
  slowTimer = 0;
  poisonDps = 0;
  poisonTimer = 0;
  blockedBy: Blocker | null = null;
  attackCd = 0.6;
  stunTimer = 0;
  lastHitByHero = false;
  dead = false;
  escaped = false;
  legPhase = Math.random() * TAU;
  bob = Math.random() * TAU;
  hitFlash = 0;
  spawnTimer: number;
  /** Босс: сколько секунд его держат; дойдя до `boss.hold`, он делает «Напор». */
  heldTime = 0;
  /** Босс: сколько ещё секунд после «Напора» его нельзя остановить. */
  chargeTimer = 0;
  readonly hpMul: number;

  constructor(kind: EnemyKind, hpMul: number, readonly path: Path, progress = 0) {
    this.def = ENEMIES[kind];
    this.hpMul = hpMul;
    this.maxHp = this.hp = Math.round(this.def.hp * hpMul);
    this.progress = Math.max(0, progress);
    const p = path.at(this.progress);
    this.x = p.x;
    this.y = p.y;
    this.angle = p.angle;
    this.spawnTimer = this.def.spawn ? this.def.spawn.every * 0.6 : 0;
  }

  get speed(): number {
    const slow = this.slowTimer > 0 ? 1 - this.slowAmount : 1;
    const charge = this.chargeTimer > 0 && this.def.boss ? this.def.boss.speedMul : 1;
    return this.def.speed * slow * charge;
  }
  /** Пока босс идёт «Напором», солдаты и герой не могут встать у него на пути. */
  get unstoppable(): boolean {
    return this.chargeTimer > 0;
  }
  /** Летающие рисуются выше своей точки на тропе. */
  get visualY(): number {
    return this.def.flying ? this.y - 26 + Math.sin(this.bob) * 3 : this.y;
  }
  get deathColor(): string {
    switch (this.def.kind) {
      case 'termite': return PAL.termite;
      case 'spider': return PAL.spiderLight;
      case 'beetle': return PAL.beetleLight;
      case 'wasp': return PAL.wasp;
      case 'rhino': return PAL.rhinoLight;
      case 'soldierTermite': return PAL.termiteHead;
      case 'blackAnt': return '#6a6a7a';
      case 'hornet': return '#d98a1f';
      case 'slug': return '#8e9b45';
      case 'queen': return PAL.termiteLight;
      case 'dragonfly': return '#6fd0e0';
      case 'leech': return '#7a2e2e';
      case 'bomber': return '#ffd54f';
      case 'empress': return '#d9c7a6';
    }
  }

  update(dt: number, g: GameCtx): void {
    if (this.dead) return;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      const tick = this.poisonDps * dt;
      g.recordDamage('spore', Math.min(this.hp, tick));
      this.hp -= tick;
      if (this.hp <= 0) { this.die(g); return; }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.bob += dt * 7;
    if (this.def.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt);
    const sp = this.def.spawn;
    if (sp) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = sp.every;
        for (let i = 0; i < sp.count; i++) g.spawnEnemyAt(sp.kind, this.hpMul, this.path, this.progress - 30 - i * 22);
        g.effects.burst(this.x, this.y, 10, PAL.termiteLight, 90, 3.5, 0.5, 120);
      }
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }
    const boss = this.def.boss;
    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) this.heldTime = 0;
    }

    const b = this.blockedBy;
    if (b && b.dead) {
      this.blockedBy = null;
    } else if (b && boss && this.heldTime >= boss.hold) {
      this.stomp(g, boss);
    } else if (b) {
      if (boss) this.heldTime += dt;
      this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, b.x, b.y), Math.min(1, dt * 10));
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = this.def.meleeInterval;
        b.takeDamage(roll(this.def.meleeDmg), g);
        g.effects.hitSpark(b.x, b.y);
      }
      this.legPhase += dt * 3;
      return;
    } else if (this.heldTime > 0) {
      // Отпустили раньше срока: накопленное удержание спадает, но вдвое медленнее, чем копится.
      this.heldTime = Math.max(0, this.heldTime - dt * 0.5);
    }

    this.progress += this.speed * dt;
    const p = this.path.at(this.progress);
    this.x = p.x;
    this.y = p.y;
    this.angle = p.angle;
    this.legPhase += dt * this.speed * 0.14;
    if (this.progress >= this.path.length - 0.5) {
      this.escaped = true;
      this.dead = true;
      this.release();
      g.loseLives(this.def.livesCost);
    }
  }

  /**
   * «Напор» босса: сбрасывает того, кто его держит, бьёт и оглушает защитников вокруг
   * и несколько секунд идёт сквозь строй. Без этого казарма с героем держали бы его вечно.
   */
  private stomp(g: GameCtx, boss: BossDef): void {
    this.release();
    this.heldTime = 0;
    this.chargeTimer = boss.charge;
    g.damageDefenders(this.x, this.y, boss.radius, boss.damage, boss.stagger);
    g.effects.ring(this.x, this.y, boss.radius, 'rgba(255,150,90,0.95)', 0.5);
    g.effects.burst(this.x, this.y, 16, 'rgba(120,70,30,0.9)', 170, 5, 0.5, 220);
    g.effects.text('Напор!', this.x, this.visualY - this.def.radius - 26, PAL.uiRed, 22);
  }

  damage(amount: number, kind: DamageKind, g: GameCtx, byHero = false, pierce = 0, source = byHero ? 'hero' : 'other'): void {
    if (this.dead) return;
    const m = kind === 'physical' ? 1 - this.def.armor * (1 - pierce) : 1;
    const dealt = Math.min(this.hp, amount * m);
    this.hp -= amount * m;
    this.hitFlash = 0.12;
    this.lastHitByHero = byHero;
    g.recordDamage(source, dealt);
    if (this.hp <= 0) this.die(g);
  }
  stun(dur: number): void {
    this.stunTimer = Math.max(this.stunTimer, dur);
  }
  applySlow(amount: number, dur: number): void {
    if (amount >= this.slowAmount || this.slowTimer <= 0) this.slowAmount = amount;
    this.slowTimer = Math.max(this.slowTimer, dur);
  }
  applyPoison(dps: number, dur: number): void {
    this.poisonDps = this.poisonTimer > 0 ? Math.max(this.poisonDps, dps) : dps;
    this.poisonTimer = Math.max(this.poisonTimer, dur);
  }

  private die(g: GameCtx): void {
    this.dead = true;
    this.hp = 0;
    g.addGold(Math.max(1, Math.round(this.def.bounty * g.bountyMul)), this.x, this.visualY);
    g.effects.death(this.x, this.visualY, this.deathColor);
    const ex = this.def.explode;
    if (ex) {
      g.effects.explosion(this.x, this.y, ex.radius);
      g.damageDefenders(this.x, this.y, ex.radius, ex.damage);
    }
    g.onEnemyKilled(this);
    this.release();
  }

  /** Отпустить солдата, который держал этого врага. */
  release(): void {
    const s = this.blockedBy;
    if (s) {
      if (s.target === this) { s.target = null; s.blocking = false; }
      this.blockedBy = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const vy = this.visualY;
    const r = this.def.radius;
    const fly = this.def.flying;
    drawShadow(ctx, this.x, this.y + (fly ? 8 : 5), r * 1.1, r * 0.5, fly ? 0.16 : 0.26);
    switch (this.def.kind) {
      case 'termite': drawTermite(ctx, this.x, vy, this.angle, 1.05, this.legPhase); break;
      case 'spider': drawSpider(ctx, this.x, vy, this.angle, 1.1, this.legPhase); break;
      case 'beetle': drawBeetle(ctx, this.x, vy, this.angle, 1.1, this.legPhase, false); break;
      case 'wasp': drawWasp(ctx, this.x, vy, this.angle, 1.1, time + this.bob); break;
      case 'rhino': drawBeetle(ctx, this.x, vy, this.angle, 1.85, this.legPhase, true); break;
      case 'soldierTermite': drawTermite(ctx, this.x, vy, this.angle, 1.2, this.legPhase, true); break;
      case 'blackAnt': drawAnt(ctx, this.x, vy, this.angle, 0.95, ANT_BLACK, this.legPhase, false); break;
      case 'hornet': drawWasp(ctx, this.x, vy, this.angle, 1.35, time + this.bob, true); break;
      case 'slug': drawSlug(ctx, this.x, vy, this.angle, 1, this.legPhase); break;
      case 'queen': drawTermiteQueen(ctx, this.x, vy, this.angle, 1, this.legPhase, time, false); break;
      case 'empress': drawTermiteQueen(ctx, this.x, vy, this.angle, 1.3, this.legPhase, time, true); break;
      case 'dragonfly': drawDragonfly(ctx, this.x, vy, this.angle, 1, time + this.bob); break;
      case 'leech': drawLeech(ctx, this.x, vy, this.angle, 1, this.legPhase); break;
      case 'bomber': drawTermite(ctx, this.x, vy, this.angle, 1.05, this.legPhase, false, true, time); break;
    }
    if (this.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(181,123,214,0.85)';
      ctx.lineWidth = 2.5;
      circle(ctx, this.x, vy, r + 7);
      ctx.stroke();
    }
    if (this.poisonTimer > 0) {
      ctx.fillStyle = 'rgba(155,229,58,0.9)';
      for (let i = 0; i < 3; i++) {
        const a = time * 3 + i * (TAU / 3);
        circle(ctx, this.x + Math.cos(a) * (r + 4), vy - 6 + Math.sin(a) * 4, 2.2);
        ctx.fill();
      }
    }
    if (this.stunTimer > 0) {
      ctx.fillStyle = PAL.honey;
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + i * (TAU / 3);
        circle(ctx, this.x + Math.cos(a) * (r + 2), vy - r - 10 + Math.sin(a) * 3, 2.6);
        ctx.fill();
      }
    }
    if (this.chargeTimer > 0) {
      // «Напор»: пульсирующее кольцо, пока босса нельзя остановить.
      ctx.strokeStyle = `rgba(255,120,70,${(0.55 + 0.35 * Math.sin(time * 12)).toFixed(2)})`;
      ctx.lineWidth = 3;
      circle(ctx, this.x, vy, r + 9);
      ctx.stroke();
    }
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#fff';
      circle(ctx, this.x, vy, r);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.hp < this.maxHp) drawHealthBar(ctx, this.x, vy - r - 16, Math.max(26, r * 2), this.hp / this.maxHp);
    const boss = this.def.boss;
    if (boss && this.heldTime > 0 && this.chargeTimer <= 0) {
      // Дуга удержания справа от полоски здоровья: замкнётся — будет «Напор».
      const cx = this.x + Math.max(26, r * 2) / 2 + 12;
      const cy = vy - r - 16;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 4;
      circle(ctx, cx, cy, 6);
      ctx.stroke();
      ctx.strokeStyle = PAL.uiRed;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, this.heldTime / boss.hold));
      ctx.stroke();
    }
  }
}
