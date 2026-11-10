/**
 * Звук без файлов: эффекты и музыка синтезируются WebAudio на лету, так что сборка остаётся одним файлом.
 * AudioContext создаётся по первому жесту пользователя (требование браузеров), до этого вызовы молча пропускаются.
 * Модуль только для браузера: симуляция его не импортирует.
 */
import type { SoundId } from '../game/types';
import { isIOS } from './device';

export type MusicMode = 'menu' | 'battle';

/** На сколько секунд вперёд планируем ноты и как часто проверяем очередь. */
const LOOKAHEAD = 0.3;
const TICK_MS = 90;

/** Нота MIDI → частота. */
function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Детерминированный генератор: мелодия одна и та же при каждом запуске. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Chord { root: number; tones: readonly number[] }
const chord = (root: number, minor: boolean): Chord => ({ root, tones: [root, root + (minor ? 3 : 4), root + 7] });

/** Ре минор: натуральная гамма от D5 для мелодии, индекс k → полтора октавы вверх. */
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const LEAD_BASE = 74;

interface ModeDef {
  bpm: number;
  prog: readonly Chord[];
  bassSteps: readonly number[];
  restChance: number;
  leadDur: number;
  drums: boolean;
}
const MODES: Record<MusicMode, ModeDef> = {
  // Меню: спокойно, Dm · Bb · F · C, бас на сильных долях.
  menu: { bpm: 80, prog: [chord(62, true), chord(58, false), chord(65, false), chord(60, false)], bassSteps: [0, 4], restChance: 0.42, leadDur: 0.6, drums: false },
  // Бой: быстрее и тревожнее, Dm · Dm · Gm · A, синкопы и ударные.
  battle: { bpm: 116, prog: [chord(62, true), chord(62, true), chord(55, true), chord(57, false)], bassSteps: [0, 3, 4, 6], restChance: 0.25, leadDur: 0.32, drums: true },
};

type Phrase = (number | null)[];
interface Phrases { a: Phrase; b: Phrase; a2: Phrase }

interface Graph { ctx: AudioContext; music: GainNode; sfx: GainNode; noise: AudioBuffer }

/** Четверть секунды тишины в WAV (8 кГц, 8 бит): собираем на лету, звуковой файл не нужен. */
function silentWav(): string {
  const n = 2000;
  const v = new DataView(new ArrayBuffer(44 + n));
  const str = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }));
}

/** Минимальная пауза между одинаковыми эффектами, чтобы залп десяти башен не превращался в треск. */
const GAPS: Partial<Record<SoundId, number>> = {
  click: 0.03, hit: 0.09, hammer: 0.1, shotAcid: 0.05, shotCatapult: 0.08, impact: 0.06, acidHit: 0.05,
  spore: 0.5, die: 0.06, build: 0.1, wave: 0.5, stomp: 0.3, dieBig: 0.3, win: 1, lose: 1,
};

/** Ближайшая к ноте n нота аккорда (в любой октаве): сильные доли мелодии ложатся на гармонию. */
function nearestTone(n: number, ch: Chord): number {
  const pcs = ch.tones.map((x) => ((x % 12) + 12) % 12);
  for (let d = 0; d <= 6; d++) {
    if (pcs.includes((((n - d) % 12) + 12) % 12)) return n - d;
    if (pcs.includes((n + d) % 12)) return n + d;
  }
  return n;
}

class AudioEngine {
  private g: Graph | null = null;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private mode: MusicMode | null = null;
  private pendingMode: MusicMode | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private phraseCache = new Map<MusicMode, Phrases>();
  private lastPlayed = new Map<SoundId, number>();
  /** iPhone или iPad: там звук глушится переключателем беззвучного режима. */
  private ios = false;
  /** Тихий звуковой элемент для старых iOS без navigator.audioSession. */
  private silent: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.ios = isIOS();
    const unlock = (): void => this.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      const g = this.g;
      if (!g) return;
      if (document.hidden) {
        void g.ctx.suspend();
        this.silent?.pause();
      }
      else void g.ctx.resume();
    });
  }

  /** Громкость 0..1 для музыки и эффектов; применяется сразу. */
  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applySession();
    const g = this.g;
    if (!g) return;
    this.syncSilent();
    g.music.gain.setTargetAtTime(this.musicLevel(), g.ctx.currentTime, 0.03);
    g.sfx.gain.setTargetAtTime(this.sfxLevel(), g.ctx.currentTime, 0.03);
  }

  /** Музыка меню или боя; переключение ждёт границы такта. null выключает музыку. */
  setMusic(mode: MusicMode | null): void {
    if (mode === this.mode) { this.pendingMode = null; return; }
    if (mode === null) {
      this.mode = null;
      this.pendingMode = null;
      this.stopScheduler();
      return;
    }
    if (this.mode === null) {
      this.mode = mode;
      if (this.g) this.startScheduler();
    } else {
      this.pendingMode = mode;
    }
  }

  /** Сыграть эффект; до первого жеста пользователя и при нулевой громкости ничего не делает. */
  play(id: SoundId): void {
    const g = this.g;
    if (!g || this.sfxVol <= 0) return;
    const now = g.ctx.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -1) < (GAPS[id] ?? 0.05)) return;
    this.lastPlayed.set(id, now);
    const t = now + 0.005;
    const bus = g.sfx;
    /** Лёгкий разброс высоты, чтобы повторяющиеся звуки не были одинаковыми. */
    const v = 1 + (Math.random() - 0.5) * 0.12;
    switch (id) {
      case 'click':
        this.tone(bus, t, 900, 0.06, 0.22, 'sine', 600);
        this.tone(bus, t, 1800, 0.03, 0.08, 'triangle');
        break;
      case 'build':
        this.noise(bus, t, 0.16, 0.35, 'lowpass', 900);
        this.tone(bus, t, 220, 0.12, 0.25, 'sine', 140);
        break;
      case 'hammer':
        this.tone(bus, t, 1600 * v, 0.03, 0.08, 'square', 1200 * v, 3000);
        this.noise(bus, t, 0.04, 0.2, 'highpass', 3000);
        this.tone(bus, t, 300 * v, 0.05, 0.15, 'sine');
        break;
      case 'done':
        this.tone(bus, t, 880, 0.18, 0.2, 'triangle');
        this.tone(bus, t + 0.12, 1320, 0.32, 0.2, 'triangle');
        this.tone(bus, t + 0.12, 660, 0.3, 0.08, 'sine');
        break;
      case 'upgrade':
        [660, 880, 1320].forEach((f, i) => this.tone(bus, t + i * 0.09, f, 0.35, 0.18, 'triangle'));
        break;
      case 'sell':
        [2200, 2700, 3200].forEach((f, i) => this.tone(bus, t + i * 0.06, f, 0.08, 0.14, 'sine'));
        this.noise(bus, t, 0.05, 0.1, 'highpass', 5000);
        break;
      case 'noGold':
        this.tone(bus, t, 220, 0.14, 0.12, 'square', 180, 1200);
        this.tone(bus, t + 0.16, 200, 0.16, 0.12, 'square', 160, 1200);
        break;
      case 'shotAcid':
        this.noise(bus, t, 0.12, 0.18, 'bandpass', 2500 * v, 1.2, 900);
        this.tone(bus, t, 700 * v, 0.1, 0.12, 'sine', 350 * v);
        break;
      case 'shotCatapult':
        this.noise(bus, t, 0.25, 0.3, 'lowpass', 400, 1, 1800);
        this.tone(bus, t, 120, 0.15, 0.2, 'sine', 60);
        break;
      case 'impact':
        this.tone(bus, t, 110 * v, 0.2, 0.45, 'sine', 50);
        this.noise(bus, t, 0.15, 0.35, 'lowpass', 600);
        break;
      case 'acidHit':
        this.noise(bus, t, 0.12, 0.15, 'bandpass', 3500 * v, 2);
        this.tone(bus, t, 500 * v, 0.08, 0.06, 'sine', 300);
        break;
      case 'spore':
        this.noise(bus, t, 0.35, 0.1, 'lowpass', 700, 1, undefined, 0.1);
        break;
      case 'hit':
        this.noise(bus, t, 0.05, 0.12, 'bandpass', 1200 * v, 1);
        this.tone(bus, t, 200 * v, 0.06, 0.1, 'sine', 120);
        break;
      case 'die':
        this.tone(bus, t, 600 * v, 0.18, 0.2, 'sine', 120);
        this.noise(bus, t, 0.12, 0.15, 'lowpass', 1200);
        break;
      case 'dieBig':
        this.tone(bus, t, 150, 0.6, 0.5, 'sine', 40);
        this.noise(bus, t, 0.5, 0.4, 'lowpass', 500);
        this.tone(bus, t, 900, 0.3, 0.15, 'sine', 200);
        break;
      case 'leak':
        this.tone(bus, t, 523, 0.25, 0.3, 'triangle', 392, 2000);
        this.tone(bus, t + 0.2, 392, 0.35, 0.3, 'triangle', 262, 2000);
        break;
      case 'wave':
        for (const [f, d, dur] of [[196, 0, 0.5], [294, 0.18, 0.5], [392, 0.36, 0.6]] as const) {
          this.tone(bus, t + d, f, dur, 0.09, 'sawtooth', undefined, 1200, 0.03, -6);
          this.tone(bus, t + d, f, dur, 0.09, 'sawtooth', undefined, 1200, 0.03, 6);
        }
        break;
      case 'spellAcid':
        this.noise(bus, t, 0.5, 0.35, 'bandpass', 1500, 1, 500);
        this.tone(bus, t, 900, 0.4, 0.15, 'sine', 300);
        for (let i = 1; i <= 3; i++) this.noise(bus, t + i * 0.1, 0.05, 0.1, 'highpass', 4000);
        break;
      case 'spellRetinue':
        [440, 587, 880].forEach((f, i) => this.tone(bus, t + i * 0.12, f, i === 2 ? 0.35 : 0.12, 0.12, 'square', undefined, 2000));
        this.tone(bus, t + 0.24, 100, 0.2, 0.3, 'sine', 50);
        break;
      case 'spellSpores':
        this.noise(bus, t, 0.6, 0.25, 'lowpass', 900, 1, undefined, 0.15);
        this.tone(bus, t, 300, 0.5, 0.1, 'sine', 150);
        break;
      case 'summon':
        this.tone(bus, t, 300, 0.3, 0.2, 'triangle', 900);
        this.noise(bus, t, 0.2, 0.1, 'highpass', 2000);
        break;
      case 'ability':
        this.tone(bus, t, 180, 0.25, 0.4, 'sine', 60);
        this.noise(bus, t, 0.2, 0.3, 'lowpass', 800);
        this.tone(bus, t, 1200, 0.03, 0.08, 'square', undefined, 3000);
        break;
      case 'fell':
        this.tone(bus, t, 440, 0.5, 0.25, 'triangle', 220);
        this.tone(bus, t + 0.15, 330, 0.5, 0.2, 'triangle', 165);
        break;
      case 'stomp':
        this.tone(bus, t, 90, 0.5, 0.6, 'sine', 35);
        this.noise(bus, t, 0.4, 0.45, 'lowpass', 400);
        this.tone(bus, t, 200, 0.2, 0.2, 'sine', 80);
        break;
      case 'win':
        [[587, 0, 0.2], [740, 0.15, 0.2], [880, 0.3, 0.2], [1175, 0.45, 0.9]].forEach(([f, d, dur]) => {
          this.tone(bus, t + d, f, dur, 0.22, 'triangle');
          this.tone(bus, t + d, f / 2, dur, 0.1, 'sine');
        });
        this.noise(bus, t + 0.45, 0.8, 0.12, 'highpass', 6000);
        break;
      case 'lose':
        [[440, 0, 0.3], [349, 0.3, 0.3], [294, 0.6, 0.9]].forEach(([f, d, dur]) => {
          this.tone(bus, t + d, f, dur, 0.25, 'triangle', undefined, 1500);
          this.tone(bus, t + d, f / 2, dur, 0.12, 'sine');
        });
        break;
    }
  }

  // ───────────── внутреннее ─────────────

  private musicLevel(): number { return this.musicVol * this.musicVol * 0.9; }
  private sfxLevel(): number { return this.sfxVol * this.sfxVol; }

  /** Первый жест пользователя: создаём контекст и граф, запускаем ожидающую музыку. */
  private unlock(): void {
    this.applySession();
    if (!this.g) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);
      const music = ctx.createGain();
      music.gain.value = this.musicLevel();
      music.connect(comp);
      const sfx = ctx.createGain();
      sfx.gain.value = this.sfxLevel();
      sfx.connect(comp);
      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.g = { ctx, music, sfx, noise };
    }
    if (this.g.ctx.state !== 'running') void this.g.ctx.resume();
    if (this.mode !== null && this.timer === null) this.startScheduler();
    this.syncSilent();
  }

  /** В настройках включены музыка или звуки. */
  private get audible(): boolean {
    return this.musicVol > 0 || this.sfxVol > 0;
  }

  /**
   * iPhone глушит Web Audio переключателем беззвучного режима. Safari умеет перевести страницу
   * в режим воспроизведения, как у плеера, и тогда звук есть и при беззвучном режиме. Если звук
   * в настройках выключен, режим обычный: музыка других приложений не прерывается.
   */
  private applySession(): void {
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (!s) return;
    const want = this.audible ? 'playback' : 'ambient';
    try {
      if (s.type !== want) s.type = want;
    } catch {
      // Тип не поддерживается: остаётся как есть.
    }
  }

  /**
   * Старые iOS без audioSession: зацикленная тишина в обычном звуковом элементе переводит страницу
   * в режим воспроизведения, и Web Audio перестаёт зависеть от беззвучного режима. Запуск только
   * по жесту пользователя: из unlock и из настроек громкости.
   */
  private syncSilent(): void {
    if (!this.ios || 'audioSession' in navigator) return;
    if (!this.audible || document.hidden) {
      this.silent?.pause();
      return;
    }
    if (!this.silent) {
      const a = document.createElement('audio');
      a.src = silentWav();
      a.loop = true;
      a.setAttribute('playsinline', '');
      a.setAttribute('x-webkit-airplay', 'deny');
      a.disableRemotePlayback = true;
      this.silent = a;
    }
    if (this.silent.paused) this.silent.play().catch(() => {});
  }

  private startScheduler(): void {
    if (!this.g || this.timer !== null) return;
    this.step = 0;
    this.nextTime = this.g.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  private stopScheduler(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Планировщик: держим очередь нот на LOOKAHEAD секунд вперёд. */
  private schedule(): void {
    const g = this.g;
    if (!g || this.mode === null) return;
    const now = g.ctx.currentTime;
    if (this.musicVol <= 0 || this.nextTime < now - 0.05) {
      // Музыка выключена или вкладка спала: продолжаем с начала такта, когда очередь снова пойдёт.
      this.nextTime = now + 0.05;
      this.step -= this.step % 8;
      if (this.musicVol <= 0) return;
    }
    while (this.nextTime < now + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 30 / MODES[this.mode].bpm;
      this.step++;
    }
  }

  private phrases(mode: MusicMode): Phrases {
    const cached = this.phraseCache.get(mode);
    if (cached) return cached;
    const def = MODES[mode];
    const r = rng(mode === 'menu' ? 7 : 11);
    const gen = (): Phrase => {
      const p: Phrase = [];
      let k = 2 + Math.floor(r() * 3);
      for (let i = 0; i < 8; i++) {
        if (i > 0 && r() < def.restChance) { p.push(null); continue; }
        k = Math.max(0, Math.min(8, k + Math.floor(r() * 5) - 2));
        p.push(k);
      }
      return p;
    };
    const a = gen();
    const a2 = [...a];
    a2[6] = null;
    a2[7] = 0;
    const ph = { a, b: gen(), a2 };
    this.phraseCache.set(mode, ph);
    return ph;
  }

  /** Одна восьмая: такт из 8 шагов, фразы идут A A B A'. */
  private playStep(step: number, t: number): void {
    const g = this.g;
    if (!g || this.mode === null) return;
    const bar = Math.floor(step / 8);
    const i = step % 8;
    if (i === 0 && this.pendingMode !== null) {
      this.mode = this.pendingMode;
      this.pendingMode = null;
    }
    const mode = this.mode;
    const def = MODES[mode];
    const eighth = 30 / def.bpm;
    const ch = def.prog[bar % def.prog.length];
    if (i === 0) this.pad(t, ch, eighth * 8);
    if (def.bassSteps.includes(i)) this.tone(g.music, t, hz(ch.root - 12), eighth * 2.2, 0.2, 'triangle', undefined, 700, 0.005);
    const ph = this.phrases(mode);
    const k = [ph.a, ph.a, ph.b, ph.a2][bar % 4][i];
    if (k !== null) {
      let n = LEAD_BASE + 12 * Math.floor(k / 7) + SCALE[k % 7];
      if (i % 4 === 0) n = nearestTone(n, ch);
      this.tone(g.music, t, hz(n), def.leadDur, 0.055, 'triangle', undefined, 2400, 0.01, -5);
      this.tone(g.music, t, hz(n), def.leadDur, 0.055, 'triangle', undefined, 2400, 0.01, 5);
    }
    if (def.drums) {
      if (i === 0 || i === 4 || (i === 7 && bar % 2 === 1)) this.tone(g.music, t, 160, 0.18, 0.5, 'sine', 45);
      if (i === 2 || i === 6) {
        this.noise(g.music, t, 0.12, 0.18, 'bandpass', 1800, 0.8);
        this.tone(g.music, t, 200, 0.06, 0.12, 'sine', 120);
      }
      this.noise(g.music, t, 0.04, i % 2 === 0 ? 0.06 : 0.035, 'highpass', 7000);
    } else if (i === 2 || i === 6) {
      this.noise(g.music, t, 0.05, 0.02, 'highpass', 6000);
    }
  }

  /** Подложка: три ноты аккорда парами расстроенных треугольников через низкочастотный фильтр, на весь такт. */
  private pad(t: number, ch: Chord, dur: number): void {
    const g = this.g;
    if (!g) return;
    const filt = g.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    filt.connect(g.music);
    const env = g.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.035, t + 0.7);
    env.gain.setValueAtTime(0.035, t + dur - 0.5);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    env.connect(filt);
    for (const m of ch.tones) {
      for (const det of [-6, 6]) {
        const o = g.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz(m);
        o.detune.value = det;
        o.connect(env);
        o.start(t);
        o.stop(t + dur + 0.15);
      }
    }
  }

  /** Осциллятор с огибающей: быстрая атака, экспоненциальное затухание; slideTo скользит по частоте, lp режет верх. */
  private tone(bus: GainNode, t: number, freq: number, dur: number, gain: number, type: OscillatorType, slideTo?: number, lp?: number, attack = 0.004, detune = 0): void {
    const g = this.g;
    if (!g) return;
    const o = g.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (detune) o.detune.value = detune;
    const env = g.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = env;
    if (lp !== undefined) {
      const f = g.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      env.connect(f);
      out = f;
    }
    out.connect(bus);
    o.connect(env);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Шум через фильтр с огибающей; freqEnd скользит частотой фильтра. */
  private noise(bus: GainNode, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, freqEnd?: number, attack = 0.003): void {
    const g = this.g;
    if (!g) return;
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = g.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const env = g.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(env);
    env.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}

/** Единственный движок звука на игру. */
export const audio = new AudioEngine();
