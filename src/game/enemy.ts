import { angleTo, lerpAngle, roll, TAU } from '../engine/math';
import { ENEMIES, type BossDef, type EnemyDef, type EnemyKind } from './config';
import type { Blocker, GameCtx } from './types';
import type { Path } from './path';
import {
  ANT_BLACK, circle, drawAnt, drawArmyAnt, drawBeetle, drawCentipede, drawCocoon, drawDragonfly, drawDungBall, drawFirefly, drawFrostAura, drawGrasshopper, drawHealthBar, drawIceBug, drawIceSnail, drawLeech, drawLouseBall, drawMantis, drawMendMark, drawScarab, drawScorpion, drawShadow, drawSilkMoth, drawSilkworm, drawSlug,
  drawSpider, drawTermite, drawTermiteQueen, drawTick, drawWasp, drawWoodlouse,
} from '../render/art';
import { PAL } from '../render/palette';
import { t } from './i18n';

export type DamageKind = 'physical' | 'poison' | 'true';

/** Сколько секунд враг проявляется, если на полях экрана его не было видно на подходе. */
export const FADE_IN = 0.35;
/** Насколько шар скарабея впереди его точки на тропе, px (жук — на 9 px позади). */
const BALL_AHEAD = 19.5;
/** Насколько позади своей точки на тропе улитка стелет лёд, px: дорожка выходит из-под хвоста. */
const TRAIL_BACK = 24;
/** Сколько секунд бабочка выбирается из кокона и набирает высоту: только для отрисовки. */
const EMERGE = 0.5;
/** Во сколько раз шире обычной россыпи стаи (lane) расходятся поперёк тропы клещи и богомолы. */
const LANE_SPREAD = 1.3;

export class Enemy {
  readonly def: EnemyDef;
  hp: number;
  maxHp: number;
  progress = 0;
  x: number;
  y: number;
  angle: number;
  /** Направление тропы в точке врага: angle в бою поворачивается к защитнику, а это — нет. */
  pathAngle: number;
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
  /** Остаток проявления, с: только для отрисовки, на симуляцию не влияет. */
  fadeIn = 0;
  /** Номер волны (с 1), из которой враг; 0 у врагов, выпущенных вне волн. */
  wave = 0;
  spawnTimer: number;
  /** Босс: сколько секунд его держат; дойдя до `boss.hold`, он делает «Напор». */
  heldTime = 0;
  /** Босс: сколько ещё секунд после «Напора» его нельзя остановить. */
  chargeTimer = 0;
  /** Шар скарабея: остаток прочности (0 — разбит или шара нет) и полная прочность. */
  ballHp = 0;
  ballMax = 0;
  /** Только для отрисовки: поворот катящегося шара и вспышка удара по нему. */
  ballRoll = 0;
  ballFlash = 0;
  /** Скорпион: сколько секунд удержания осталось до следующего укола жалом. */
  stingCd = 0;
  /** Мокрица: сколько ещё секунд она свёрнута в шар и сколько ждать до следующего раза. */
  curlTimer = 0;
  curlCd = 0;
  /** Кузнечик: сколько секунд прыжка осталось и сколько ждать до следующего. */
  leapTimer = 0;
  leapCd = 0;
  /** Армейский муравей: множитель скорости от соседей по стае и таймер его пересчёта. */
  packMul = 1;
  packTimer = 0;
  /** Прибавка к скорости на ледяной дорожке улитки (0 — не на льду) и таймер ледяной крошки из-под ног. */
  slide = 0;
  slideFx = 0;
  /** Кокон: сколько секунд осталось до вылупления. */
  hatchTimer = 0;
  /** Бабочка из кокона: остаток взлёта, с; только для отрисовки. */
  emerge = 0;
  /** Клещ: насколько он напился (0..1), только для отрисовки, и вцепился ли уже в нынешнего защитника. */
  fed = 0;
  latched = false;
  /** Свет светлячка: сколько здоровья в секунду враг восстанавливает и сколько секунд ещё; у самого светлячка — таймер обхода соседей. */
  mendRate = 0;
  mendTimer = 0;
  mendTick = 0;
  /** Сдвиг поперёк тропы в отрисовке стаи, px: из начальной фазы шага, без лишнего случайного числа. У образца для карточки 0. */
  lane = Math.sin(this.legPhase * 7.3) * 8;
  readonly hpMul: number;

  constructor(kind: EnemyKind, hpMul: number, readonly path: Path, progress = 0) {
    this.def = ENEMIES[kind];
    this.hpMul = hpMul;
    this.maxHp = this.hp = Math.round(this.def.hp * hpMul);
    this.progress = Math.max(0, progress);
    const p = path.at(this.progress);
    this.x = p.x;
    this.y = p.y;
    this.angle = this.pathAngle = p.angle;
    this.spawnTimer = this.def.spawn ? this.def.spawn.every * 0.6 : 0;
    if (this.def.ball) this.ballMax = this.ballHp = Math.round(this.def.ball.hp * hpMul);
    if (this.def.sting) this.stingCd = this.def.sting.every * 0.5;
    if (this.def.hatch) this.hatchTimer = this.def.hatch.after;
  }

  get speed(): number {
    const slow = this.slowTimer > 0 ? 1 - this.slowAmount : 1;
    const charge = this.chargeTimer > 0 && this.def.boss ? this.def.boss.speedMul : 1;
    const loose = this.def.ball && this.ballHp <= 0 ? this.def.ball.boost : 1;
    const roll = this.curled && this.def.curl ? this.def.curl.speedMul : 1;
    return this.def.speed * slow * charge * loose * roll * this.packMul * (1 + this.slide);
  }
  /** Мокрица свёрнута: катится быстрее, панцирь крепче, удержать нельзя. */
  get curled(): boolean {
    return this.curlTimer > 0;
  }
  get armor(): number {
    return this.curled && this.def.curl ? this.def.curl.armor : this.def.armor;
  }
  /** Шар ещё цел: удары, кроме яда, достаются ему. */
  get hasBall(): boolean {
    return this.ballHp > 0;
  }
  /**
   * Пока босс идёт «Напором», солдаты и герой не могут встать у него на пути. Кокон тоже никто
   * не держит: он и так стоит, а заслон нужен идущим; свободные солдаты его просто рубят.
   */
  get unstoppable(): boolean {
    return this.chargeTimer > 0 || this.curlTimer > 0 || this.leapTimer > 0 || !!this.def.hatch;
  }
  /** Бабочка из кокона: доля набранной высоты, 0..1 (у остальных всегда 1). */
  get risen(): number {
    return this.emerge > 0 ? 1 - this.emerge / EMERGE : 1;
  }
  /** Летающие рисуются выше своей точки на тропе. */
  get visualY(): number {
    if (this.leapTimer > 0 && this.def.leap) return this.y - Math.sin(Math.PI * (1 - this.leapTimer / this.def.leap.dur)) * 30;
    return this.def.flying ? this.y - (26 - Math.sin(this.bob) * 3) * this.risen : this.y;
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
      case 'scarab': return '#5d6270';
      case 'scorpion': return '#eab466';
      case 'woodlouse': return '#9aa4ac';
      case 'grasshopper': return '#b4dc6a';
      case 'centipede': return '#c8402a';
      case 'centipedeHalf': return '#c8402a';
      case 'armyAnt': return '#e6cf96';
      case 'iceBug': return '#a8dcf8';
      case 'iceSnail': return '#9fe0ee';
      case 'silkworm': return '#efe6c8';
      case 'cocoon': return '#f6f0dc';
      case 'silkMoth': return '#f2e8cf';
      case 'tick': return '#d0502e';
      case 'mantis': return '#6fd89a';
      case 'firefly': return '#e8f58a';
    }
  }

  update(dt: number, g: GameCtx): void {
    if (this.fadeIn > 0) this.fadeIn -= dt;
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
    if (this.ballFlash > 0) this.ballFlash -= dt;
    if (this.emerge > 0) this.emerge -= dt;
    if (this.fed > 0) this.fed = Math.max(0, this.fed - dt * 0.04);
    if (this.mendTimer > 0) {
      this.mendTimer -= dt;
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.mendRate * dt);
    }
    const md = this.def.mend;
    if (md) {
      // Соседей обходим четыре раза в секунду: попавший в свет лечится ещё треть секунды.
      this.mendTick -= dt;
      if (this.mendTick <= 0) {
        this.mendTick = 0.25;
        const rate = md.rate * this.hpMul;
        for (const e of g.enemies) {
          if (e === this || e.dead || Math.hypot(e.x - this.x, e.y - this.y) > md.radius) continue;
          if (e.mendTimer <= 0 || rate > e.mendRate) e.mendRate = rate;
          e.mendTimer = 0.35;
        }
      }
    }
    const ht = this.def.hatch;
    if (ht) {
      // Кокон только ждёт своего срока: не идёт, не дерётся.
      this.bob += dt * 7;
      this.hatchTimer -= dt;
      if (this.hatchTimer <= 0) this.hatch(g, ht.kind);
      return;
    }
    if (this.curlTimer > 0) {
      this.curlTimer -= dt;
      if (this.curlTimer <= 0) this.curlCd = this.def.curl?.cooldown ?? 0;
    } else if (this.curlCd > 0) {
      this.curlCd -= dt;
    }
    if (this.leapCd > 0) this.leapCd -= dt;
    // На льду улитки наземные враги скользят быстрее; сами улитки и летающие — нет.
    const tr = this.def.trail;
    this.slide = tr || this.def.flying ? 0 : this.path.iceAt(this.progress, g.time);
    const pk = this.def.pack;
    if (pk) {
      // Соседей пересчитываем четыре раза в секунду: стая меняется медленно.
      this.packTimer -= dt;
      if (this.packTimer <= 0) {
        this.packTimer = 0.25;
        let mates = 0;
        for (const e of g.enemies) {
          if (e !== this && !e.dead && e.def.kind === this.def.kind && Math.hypot(e.x - this.x, e.y - this.y) <= pk.radius) mates++;
        }
        this.packMul = 1 + Math.min(pk.max, mates * pk.perMate);
      }
    }
    const lp = this.def.leap;
    if (lp && this.leapTimer > 0) {
      // В прыжке: летит вдоль тропы, оглушение и заслон его не останавливают.
      this.leapTimer -= dt;
      this.progress += (lp.dist / lp.dur) * dt;
      this.place(g);
      this.legPhase += dt * 20;
      return;
    }
    this.bob += dt * 7;
    if (this.def.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt);
    const sp = this.def.spawn;
    if (sp) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = sp.every;
        for (let i = 0; i < sp.count; i++) g.spawnEnemyAt(sp.kind, this.hpMul, this.path, this.progress - 30 - i * 22).wave = this.wave;
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
    } else if (b && lp && this.leapCd <= 0) {
      // Перехватили — прыгает через заслон.
      this.release();
      this.leapTimer = lp.dur;
      this.leapCd = lp.every;
      g.effects.burst(this.x, this.y, 8, 'rgba(150,140,110,0.8)', 80, 3.5, 0.4, 60);
      g.effects.text(t('fx.leap'), this.x, this.y - this.def.radius - 26, PAL.uiLight, 16);
      return;
    } else if (b) {
      if (boss) this.heldTime += dt;
      this.angle = lerpAngle(this.angle, angleTo(this.x, this.y, b.x, b.y), Math.min(1, dt * 10));
      this.attackCd -= dt;
      if (this.stingCd > 0) this.stingCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = this.def.meleeInterval;
        const st = this.def.sting;
        if (st && this.stingCd <= 0) {
          this.sting(g, b, st.stun, st.every);
          return;
        }
        const cl = this.def.cleave;
        if (cl) {
          this.slash(g, b, cl.radius);
          return;
        }
        const before = b.hp;
        b.takeDamage(roll(this.def.meleeDmg), g);
        const dr = this.def.drain;
        if (dr) this.feed(g, b, Math.max(0, before - b.hp) * dr.heal);
        g.effects.hitSpark(b.x, b.y);
        g.sound('hit');
      }
      this.legPhase += dt * 3;
      return;
    } else if (this.heldTime > 0) {
      // Отпустили раньше срока: накопленное удержание спадает, но вдвое медленнее, чем копится.
      this.heldTime = Math.max(0, this.heldTime - dt * 0.5);
    }

    this.latched = false;
    const from = this.progress;
    this.progress += this.speed * dt;
    this.place(g);
    if (tr && !this.dead) this.path.layIce(from - TRAIL_BACK, this.progress - TRAIL_BACK, g.time + tr.life, tr.boost);
    if (this.slide > 0) {
      // Ледяная крошка из-под ног: видно, кто разогнался на дорожке.
      this.slideFx -= dt;
      if (this.slideFx <= 0) {
        this.slideFx = 0.2;
        const back = this.def.radius * 0.9;
        g.effects.burst(this.x - Math.cos(this.angle) * back, this.y - Math.sin(this.angle) * back + 3, 2, 'rgba(235,248,255,0.95)', 55, 2.2, 0.3, 90);
      }
    }
    this.legPhase += dt * this.speed * 0.14;
    if (this.hasBall) this.ballRoll += (dt * this.speed) / 11;
    if (this.curled) this.ballRoll += (dt * this.speed) / 12;
  }

  /** Встать на тропу по текущему progress; дошёл до конца — прорвался в муравейник. */
  private place(g: GameCtx): void {
    const p = this.path.at(this.progress);
    this.x = p.x;
    this.y = p.y;
    this.angle = this.pathAngle = p.angle;
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
    g.effects.text(t('fx.stomp'), this.x, this.visualY - this.def.radius - 26, PAL.uiRed, 22);
    g.sound('stomp');
  }

  damage(amount: number, kind: DamageKind, g: GameCtx, byHero = false, pierce = 0, source = byHero ? 'hero' : 'other'): void {
    if (this.dead) return;
    if (this.hasBall && kind !== 'poison') {
      // Шар принимает удар целиком, без панциря; что не поместилось в остаток, идёт в самого жука.
      const taken = Math.min(this.ballHp, amount);
      this.ballHp -= taken;
      this.ballFlash = 0.12;
      g.recordDamage(source, taken);
      if (this.ballHp <= 0) this.breakBall(g);
      amount -= taken;
      if (amount <= 0) return;
    }
    const m = kind === 'physical' ? 1 - this.armor * (1 - pierce) : 1;
    const dealt = Math.min(this.hp, amount * m);
    this.hp -= amount * m;
    this.hitFlash = 0.12;
    this.lastHitByHero = byHero;
    g.recordDamage(source, dealt);
    if (this.hp <= 0) {
      this.die(g);
      return;
    }
    const c = this.def.curl;
    if (c && kind !== 'poison' && !this.curled && this.curlCd <= 0 && amount >= c.hit * this.maxHp) this.curlUp(g, c.dur);
  }

  /** Сильный удар: мокрица сворачивается в шар, вырывается из заслона и катится дальше. */
  private curlUp(g: GameCtx, dur: number): void {
    this.curlTimer = dur;
    this.release();
    g.effects.ring(this.x, this.y, 22, 'rgba(200,210,220,0.9)', 0.3);
    g.effects.text(t('fx.curl'), this.x, this.visualY - this.def.radius - 26, PAL.uiLight, 16);
  }
  /**
   * Укол жалом: защитник получает полуторный удар, оглушён и отлетает, враг свободен и идёт
   * дальше, пока его не перехватит кто-то другой.
   */
  private sting(g: GameCtx, b: Blocker, stun: number, every: number): void {
    this.stingCd = every;
    b.takeDamage(roll(this.def.meleeDmg) * 1.5, g);
    g.effects.burst(b.x, b.y, 9, 'rgba(176,222,90,0.9)', 100, 3, 0.45, 140);
    g.effects.text(t('fx.sting'), b.x, b.y - 30, PAL.honey, 16);
    g.sound('hit');
    b.stagger(stun, this.x, this.y);
    if (this.blockedBy === b) this.blockedBy = null;
  }

  /** Шар разбит: крошки во все стороны, жук без ноши бежит быстрее. */
  private breakBall(g: GameCtx): void {
    this.ballHp = 0;
    const bx = this.x + Math.cos(this.angle) * BALL_AHEAD;
    const by = this.y + Math.sin(this.angle) * BALL_AHEAD;
    g.effects.burst(bx, by, 14, 'rgba(140,100,55,0.95)', 150, 4.5, 0.55, 260);
    g.effects.burst(bx, by, 8, 'rgba(210,180,110,0.9)', 110, 2.5, 0.45, 200);
    g.effects.text(t('fx.ballBroken'), this.x, this.visualY - this.def.radius - 26, PAL.honey, 18);
    g.sound('impact');
  }
  /**
   * Взмах косами: удар получают все защитники в радиусе, а тот, кто держит богомола, — в любом
   * случае, даже если ещё не добежал. Первый взмах по новому заслону отмечен надписью.
   */
  private slash(g: GameCtx, b: Blocker, radius: number): void {
    const dmg = roll(this.def.meleeDmg);
    const far = Math.hypot(b.x - this.x, b.y - this.y) > radius;
    g.damageDefenders(this.x, this.y, radius, dmg);
    if (far) b.takeDamage(dmg, g);
    // След взмаха — там же, где богомол нарисован (со сдвигом поперёк тропы).
    const off = this.lane * LANE_SPREAD;
    g.effects.slash(this.x - Math.sin(this.pathAngle) * off, this.y + Math.cos(this.pathAngle) * off, this.angle, radius);
    if (!this.latched) {
      this.latched = true;
      g.effects.text(t('fx.slash'), this.x, this.y - this.def.radius - 26, PAL.uiRed, 16);
    }
    g.effects.hitSpark(b.x, b.y);
    g.sound('hit');
  }

  /**
   * Клещ укусил защитника: лечится тем, что высосал (amount — урон, который тот получил),
   * и раздувается. Первый укус нового защитника отмечен надписью.
   */
  private feed(g: GameCtx, b: Blocker, amount: number): void {
    if (amount <= 0) return;
    if (!this.latched) {
      this.latched = true;
      g.effects.text(t('fx.latch'), this.x, this.y - this.def.radius - 26, PAL.uiRed, 16);
    }
    const healed = Math.min(this.maxHp - this.hp, amount);
    this.hp += healed;
    this.fed = Math.min(1, this.fed + amount / (this.maxHp * 0.45));
    // Капли от защитника; если было что лечить — зелёная искра над клещом.
    g.effects.burst(b.x, b.y, 3, 'rgba(214,52,52,0.95)', 70, 2.6, 0.35, 160);
    if (healed > 0) g.effects.burst(this.x, this.y - this.def.radius, 2, 'rgba(140,230,120,0.95)', 40, 2.4, 0.5, -60);
  }

  /** Срок кокона вышел: он лопается, бабочка взлетает и летит дальше по тропе. Награды за кокон нет. */
  private hatch(g: GameCtx, kind: EnemyKind): void {
    this.dead = true;
    this.release();
    const moth = g.spawnEnemyAt(kind, this.hpMul, this.path, this.progress);
    moth.wave = this.wave;
    moth.emerge = EMERGE;
    g.effects.burst(this.x, this.y, 12, 'rgba(250,244,226,0.95)', 120, 3.2, 0.55, 160);
    g.effects.text(t('fx.hatch'), this.x, this.y - this.def.radius - 30, PAL.uiLight, 16);
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
    g.sound(this.def.boss ? 'dieBig' : 'die');
    const ex = this.def.explode;
    if (ex) {
      g.effects.explosion(this.x, this.y, ex.radius);
      g.sound('impact');
      g.damageDefenders(this.x, this.y, ex.radius, ex.damage);
    }
    const sp = this.def.split;
    if (sp) {
      // Распалась: половинки появляются чуть впереди и позади и на миг замирают.
      for (let i = 0; i < sp.count; i++) {
        const half = g.spawnEnemyAt(sp.kind, this.hpMul, this.path, this.progress + (i % 2 === 0 ? 12 : -14) - Math.floor(i / 2) * 20);
        half.wave = this.wave;
        half.stunTimer = 0.35;
      }
      g.effects.text(t('fx.split'), this.x, this.visualY - this.def.radius - 26, PAL.uiLight, 16);
    }
    const pu = this.def.pupate;
    if (pu) {
      // Окуклилась: на её месте остаётся кокон, из него вылетит бабочка.
      g.spawnEnemyAt(pu.kind, this.hpMul, this.path, this.progress).wave = this.wave;
      g.effects.text(t('fx.cocoon'), this.x, this.visualY - this.def.radius - 26, PAL.uiLight, 16);
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

  /** bare — только сам враг с тенью, без полосок и значков состояния: так рисуется образец в карточке. */
  draw(ctx: CanvasRenderingContext2D, time: number, bare = false): void {
    const alpha = this.fadeIn > 0 ? Math.max(0, 1 - this.fadeIn / FADE_IN) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
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
      case 'scorpion': drawScorpion(ctx, this.x, vy, this.angle, 1.2, this.legPhase); break;
      case 'iceBug':
        if (this.def.chill && !bare) drawFrostAura(ctx, this.x, this.y, this.def.chill.radius, time + this.bob);
        drawIceBug(ctx, this.x, vy, this.angle, 1, this.legPhase);
        break;
      case 'iceSnail': drawIceSnail(ctx, this.x, vy, this.angle, 1.45, this.legPhase); break;
      case 'silkworm': drawSilkworm(ctx, this.x, vy, this.angle, 1, this.legPhase); break;
      case 'cocoon': {
        const ht = this.def.hatch;
        const age = ht ? ht.after - this.hatchTimer : 1;
        drawCocoon(ctx, this.x, vy, this.angle, 1, ht ? Math.min(1, age / ht.after) : 0, time + this.bob, Math.min(1, age / 0.25));
        break;
      }
      // Вылупившись, бабочка расправляет крылья: растёт, пока набирает высоту.
      case 'silkMoth': drawSilkMoth(ctx, this.x, vy, this.angle, 0.55 + 0.45 * this.risen, time + this.bob); break;
      // Круг его света на земле рисует Game отдельным проходом, под юнитами.
      case 'firefly': drawFirefly(ctx, this.x, vy, this.angle, 1.2, time + this.bob); break;
      case 'mantis': {
        // Как и клещи, богомолы рисуются россыпью поперёк тропы: остановленные одним заслоном не сливаются.
        const off = this.lane * LANE_SPREAD;
        drawMantis(ctx, this.x - Math.sin(this.pathAngle) * off, vy + Math.cos(this.pathAngle) * off, this.angle, 1, this.legPhase);
        break;
      }
      case 'tick': {
        // Вцепившись, клещ тянется к защитнику вплотную; напившись, раздувается. Как и стая муравьёв,
        // клещи идут и стоят россыпью поперёк тропы: остановленные одним заслоном не сливаются в ком.
        const pull = this.blockedBy ? 5 : 0;
        const off = this.lane * LANE_SPREAD;
        drawTick(
          ctx, this.x + Math.cos(this.angle) * pull - Math.sin(this.pathAngle) * off, vy + Math.sin(this.angle) * pull + Math.cos(this.pathAngle) * off,
          this.angle, 0.9, this.legPhase, this.fed,
        );
        break;
      }
      case 'armyAnt':
        // Стая идёт россыпью поперёк тропы, а не в затылок: сдвиг только в отрисовке.
        drawArmyAnt(ctx, this.x - Math.sin(this.angle) * this.lane, vy + Math.cos(this.angle) * this.lane, this.angle, 0.75, this.legPhase);
        break;
      case 'centipede': drawCentipede(ctx, this.x, vy, this.angle, 1, this.legPhase, false); break;
      case 'centipedeHalf': drawCentipede(ctx, this.x, vy, this.angle, 1, this.legPhase, true); break;
      case 'grasshopper': {
        // В прыжке ближе к камере: чуть крупнее.
        const up = this.leapTimer > 0 && this.def.leap ? Math.sin(Math.PI * (1 - this.leapTimer / this.def.leap.dur)) : 0;
        drawGrasshopper(ctx, this.x, vy, this.angle, 1 + up * 0.18, this.legPhase);
        break;
      }
      case 'woodlouse':
        if (this.curled) drawLouseBall(ctx, this.x, vy - 2, 12.5, this.angle, this.ballRoll);
        else drawWoodlouse(ctx, this.x, vy, this.angle, 1.1, this.legPhase);
        break;
      case 'scarab': {
        // С шаром жук идёт позади своей точки, шар впереди: связка в целом стоит на тропе.
        const back = this.hasBall ? 9 : 0;
        const ca = Math.cos(this.angle);
        const sa = Math.sin(this.angle);
        drawScarab(ctx, this.x - ca * back, vy - sa * back, this.angle, 0.85, this.legPhase);
        if (this.hasBall) {
          drawShadow(ctx, this.x + ca * BALL_AHEAD, vy + sa * BALL_AHEAD + 6, 12, 5, 0.22);
          drawDungBall(ctx, this.x + ca * BALL_AHEAD, vy + sa * BALL_AHEAD, 11, this.angle, this.ballRoll, this.ballHp / this.ballMax, this.ballFlash > 0);
        }
        break;
      }
    }
    if (bare) {
      ctx.restore();
      return;
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
    if (this.mendTimer > 0) drawMendMark(ctx, this.x + r * 0.8 + 4, vy - r * 0.7, time + this.bob);
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
      ctx.globalAlpha = 0.45 * alpha;
      ctx.fillStyle = '#fff';
      circle(ctx, this.x, vy, r);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    if (this.hp < this.maxHp) drawHealthBar(ctx, this.x, vy - r - 16, Math.max(26, r * 2), this.hp / this.maxHp);
    if (this.hasBall && this.ballHp < this.ballMax) {
      // Прочность шара: бурая полоска под здоровьем.
      const w = Math.max(26, r * 2);
      const by = vy - r - (this.hp < this.maxHp ? 10 : 16);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.x - w / 2 - 1, by - 2, w + 2, 4);
      ctx.fillStyle = '#c08a4a';
      ctx.fillRect(this.x - w / 2, by - 1.2, w * (this.ballHp / this.ballMax), 2.4);
    }
    const hatch = this.def.hatch;
    if (hatch) {
      // Срок кокона: кольцо над ним замыкается — вылетает бабочка.
      const cy = vy - r - (this.hp < this.maxHp ? 27 : 17);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4.5;
      circle(ctx, this.x, cy, 6);
      ctx.stroke();
      ctx.strokeStyle = PAL.honey;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, cy, 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, 1 - this.hatchTimer / hatch.after));
      ctx.stroke();
    }
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
    ctx.restore();
  }
}
