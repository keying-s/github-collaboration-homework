import type { GameEvent } from './types';

const STORAGE_KEY = 'ember-protocol-audio';

interface AudioPrefs {
  music: number;
  sfx: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPrefs> & { muted?: boolean };
      // Migrate the earlier single "muted" switch to per-channel mutes.
      const legacyMuted = parsed.muted === true;
      return {
        music: clampVolume(parsed.music, 0.6),
        sfx: clampVolume(parsed.sfx, 1),
        musicMuted: parsed.musicMuted ?? legacyMuted,
        sfxMuted: parsed.sfxMuted ?? legacyMuted,
      };
    }
  } catch {
    /* Storage can be unavailable in privacy modes; defaults still apply. */
  }
  return { music: 0.6, sfx: 1, musicMuted: false, sfxMuted: false };
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
}

/** Small synthesized sound bank: no external assets or network dependency. */
export class AudioEngine {
  musicMuted = false;
  sfxMuted = false;
  musicVolume: number;
  sfxVolume: number;
  private context?: AudioContext;
  private bus?: GainNode;
  private musicBus?: GainNode;
  private musicFilter?: BiquadFilterNode;
  private echo?: DelayNode;
  private noise?: AudioBuffer;
  private musicTimer?: number;
  private stepCounter = 0;
  private nextStepTime = 0;
  private combat = false;
  private bossPhase2 = false;
  /** Rate-limit so a shotgun's many pellet impacts don't machine-gun the hit sound. */
  private lastHitAt = 0;
  /** Tempo 112 BPM; one step is a sixteenth note. */
  private static readonly STEP = 60 / 112 / 4;
  /**
   * Battle riff in the style of top-down shooter grooves (Hotline Miami,
   * Enter the Gungeon): a short two-bar motif answered by a variation, with
   * long rests so the bass and drums carry the drive. Stays in D minor.
   */
  private static readonly MELODY: { step: number; freq: number; len: number }[] = [
    { step: 0, freq: 293.66, len: 2 },
    { step: 4, freq: 349.23, len: 2 },
    { step: 8, freq: 440, len: 3 },
    { step: 14, freq: 392, len: 2 },
    { step: 20, freq: 349.23, len: 6 },
    { step: 32, freq: 293.66, len: 2 },
    { step: 36, freq: 349.23, len: 2 },
    { step: 40, freq: 466.16, len: 3 },
    { step: 46, freq: 440, len: 2 },
    { step: 52, freq: 392, len: 6 },
  ];
  private static readonly BAR_ROOTS = [73.42, 73.42, 58.27, 55];
  private static readonly BAR_PADS = [
    [146.83, 174.61, 220],
    [146.83, 174.61, 220],
    [116.54, 146.83, 174.61],
    [110, 138.59, 164.81],
  ];
  /** Landing-page piece: eight bars, two per chord, bells over a slow drone. */
  private static readonly MENU_ROOTS = [73.42, 58.27, 49, 55];
  private static readonly MENU_PADS = [
    [146.83, 174.61, 220],
    [116.54, 146.83, 174.61],
    [98, 116.54, 146.83],
    [110, 138.59, 164.81],
  ];
  private static readonly MENU_BELLS: { step: number; freq: number }[] = [
    { step: 0, freq: 587.33 },
    { step: 22, freq: 440 },
    { step: 44, freq: 698.46 },
    { step: 74, freq: 466.16 },
    { step: 98, freq: 392 },
    { step: 116, freq: 440 },
  ];
  constructor() {
    const prefs = loadPrefs();
    this.musicVolume = prefs.music;
    this.sfxVolume = prefs.sfx;
    this.musicMuted = prefs.musicMuted;
    this.sfxMuted = prefs.sfxMuted;
  }
  /** Both channels silenced — drives the top-bar icon and M key semantics. */
  get muted() {
    return this.musicMuted && this.sfxMuted;
  }
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (!this.bus) {
        this.bus = this.context.createGain();
        this.bus.gain.value = 0.17;
        this.bus.connect(this.context.destination);
      }
      if (!this.musicBus) {
        this.musicBus = this.context.createGain();
        this.applyMusicGain();
        this.musicFilter = this.context.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 18000;
        this.musicBus.connect(this.musicFilter);
        this.musicFilter.connect(this.context.destination);
        const echo = this.context.createDelay(1);
        echo.delayTime.value = AudioEngine.STEP * 2;
        const feedback = this.context.createGain();
        feedback.gain.value = 0.3;
        echo.connect(feedback);
        feedback.connect(echo);
        const echoOut = this.context.createGain();
        echoOut.gain.value = 0.35;
        echo.connect(echoOut);
        echoOut.connect(this.musicBus);
        this.echo = echo;
        const noise = this.context.createBuffer(
          1,
          this.context.sampleRate * 0.1,
          this.context.sampleRate,
        );
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = noise;
      }
      void this.context.resume();
      if (!this.musicMuted) this.startMusic();
    } catch {
      /* Audio is optional; gameplay remains available. */
    }
  }
  /** Mute-all: silence both channels; a second call restores their remembered levels. */
  toggle() {
    if (this.muted) {
      this.musicMuted = false;
      this.sfxMuted = false;
    } else {
      this.musicMuted = true;
      this.sfxMuted = true;
    }
    this.persist();
    this.unlock();
    this.applyMusicGain();
    if (this.musicMuted) this.stopMusic();
    return this.muted;
  }
  setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    this.applyMusicGain();
    if (this.musicMuted) this.stopMusic();
    else if (this.context) this.startMusic();
    this.persist();
  }
  setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
    this.persist();
  }
  setMusicVolume(volume: number) {
    this.musicVolume = clampVolume(volume, this.musicVolume);
    this.applyMusicGain();
    this.persist();
  }
  setSfxVolume(volume: number) {
    this.sfxVolume = clampVolume(volume, this.sfxVolume);
    this.persist();
  }
  /** Menu bass drone: one soft sustained note per chord. */
  private drone(freq: number, t: number, dur: number) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.9);
    gain.gain.setTargetAtTime(0.0001, t + dur - 0.7, 0.3);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + dur);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  /** Soft bell ping with a long echo tail for the landing-page motif. */
  private bell(freq: number, t: number) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(gain);
    gain.connect(this.musicBus!);
    if (this.echo) gain.connect(this.echo);
    osc.start(t);
    osc.stop(t + 1.7);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  /** Entering or leaving combat restarts the track: each area owns its song. */
  setCombat(combat: boolean) {
    if (combat === this.combat) return;
    this.combat = combat;
    if (!combat) this.setBossPhase(false);
    this.stopMusic();
    if (!this.musicMuted && this.context) this.startMusic();
  }
  /** Boss phase 2: the music darkens (filter dive) and the drum layer doubles. */
  setBossPhase(phase2: boolean) {
    if (phase2 === this.bossPhase2) return;
    this.bossPhase2 = phase2 && this.combat;
    if (this.musicFilter && this.context) {
      this.musicFilter.frequency.setTargetAtTime(
        this.bossPhase2 ? 800 : 18000,
        this.context.currentTime,
        0.12,
      );
    }
  }
  play(event: GameEvent) {
    if (this.sfxMuted || this.sfxVolume <= 0 || !this.context || !this.bus) return;
    if (event.type === 'hit') {
      this.playHit();
      return;
    }
    const bank: Partial<Record<GameEvent['type'], [number, number, number, OscillatorType]>> = {
      shot: [event.loud ? 190 : 300, 70, 0.06, 'sawtooth'],
      kill: [210, 95, 0.09, 'triangle'],
      explosion: [90, 25, 0.3, 'sawtooth'],
      dash: [250, 550, 0.16, 'sine'],
      hurt: [130, 50, 0.2, 'square'],
      pickup: [430, 920, 0.22, 'sine'],
      chain: [650, 220, 0.1, 'triangle'],
      reload: [240, 320, 0.05, 'triangle'],
      clear: [390, 780, 0.4, 'sine'],
      win: [520, 1040, 0.65, 'sine'],
    };
    const sound = bank[event.type];
    if (!sound) return;
    const [start, end, duration, type] = sound,
      ctx = this.context,
      t = ctx.currentTime;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime((event.type === 'shot' ? 0.35 : 0.5) * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(t);
    osc.stop(t + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  /**
   * Bullet-on-enemy impact: a crisp noise transient plus a short low body thump.
   * Rate-limited so dense firefights stay punchy instead of turning into a Buzz.
   */
  private playHit() {
    const ctx = this.context!,
      bus = this.bus!,
      t = ctx.currentTime;
    if (t - this.lastHitAt < 0.03) return;
    this.lastHitAt = t;
    const vol = this.sfxVolume;
    if (this.noise) {
      const src = ctx.createBufferSource(),
        hp = ctx.createBiquadFilter(),
        g = ctx.createGain();
      src.buffer = this.noise;
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      g.gain.setValueAtTime(0.22 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(hp);
      hp.connect(g);
      g.connect(bus);
      src.start(t);
      src.stop(t + 0.06);
      src.onended = () => {
        src.disconnect();
        hp.disconnect();
        g.disconnect();
      };
    }
    const osc = ctx.createOscillator(),
      og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    og.gain.setValueAtTime(0.16 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(og);
    og.connect(bus);
    osc.start(t);
    osc.stop(t + 0.08);
    osc.onended = () => {
      osc.disconnect();
      og.disconnect();
    };
  }
  /**
   * Kill-streak escalation chime. `tier` is 1-3 (combo 4 / 8 / 12); the pitch
   * climbs C5 -> E5 -> G5 with a bright upward bend so each tier-up feels earned.
   */
  playCombo(tier: number) {
    if (this.sfxMuted || this.sfxVolume <= 0 || !this.context || !this.bus) return;
    const ctx = this.context,
      bus = this.bus,
      t = ctx.currentTime;
    const base = [523.25, 659.25, 783.99, 1046.5][Math.max(0, Math.min(3, tier))];
    const osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(bus);
    if (this.echo) g.connect(this.echo);
    osc.start(t);
    osc.stop(t + 0.25);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
  /** Low-HP heartbeat: a soft "lub-dub" that loops while the player is critical. */
  playHeartbeat() {
    if (this.sfxMuted || this.sfxVolume <= 0 || !this.context || !this.bus) return;
    const ctx = this.context,
      bus = this.bus;
    const beat = (delay: number, level: number) => {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator(),
        g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(72, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level * this.sfxVolume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(bus);
      osc.start(t);
      osc.stop(t + 0.2);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    };
    beat(0, 0.5);
    beat(0.22, 0.32);
  }
  /** Lookahead scheduler keeping ~150ms of music queued on the audio clock. */
  private startMusic() {
    if (this.musicTimer || !this.context) return;
    this.stepCounter = 0;
    this.nextStepTime = this.context.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 40);
  }
  private stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }
  }
  private scheduleMusic() {
    if (!this.context || !this.musicBus) return;
    const loopLen = this.combat ? 64 : 128;
    while (this.nextStepTime < this.context.currentTime + 0.15) {
      this.scheduleStep(
        this.stepCounter % loopLen,
        this.nextStepTime,
        Math.floor(this.stepCounter / loopLen),
      );
      this.stepCounter++;
      this.nextStepTime += AudioEngine.STEP;
    }
  }
  private scheduleStep(step: number, t: number, loopIndex: number) {
    const stepDur = AudioEngine.STEP,
      barDur = stepDur * 16;
    if (this.combat) {
      const bar = Math.floor(step / 16),
        inBar = step % 16;
      const note = AudioEngine.MELODY.find((n) => n.step === step);
      if (note) this.melody(note.freq, t, note.len * stepDur);
      if (inBar === 0) {
        this.pad(AudioEngine.BAR_PADS[bar], t, barDur);
        if (loopIndex % 4 === 0) this.crash(t);
        else if (bar === 3 && loopIndex % 4 === 3) this.riser(t, barDur);
      }
      // Steady root-note eighth groove; no octave jumps to keep it calm.
      if (inBar % 2 === 0) this.bass(AudioEngine.BAR_ROOTS[bar], t, stepDur * 1.8);
      if (
        inBar === 0 ||
        inBar === 4 ||
        inBar === 8 ||
        inBar === 12 ||
        (this.bossPhase2 && inBar === 14)
      )
        this.kick(t);
      if (inBar === 4 || inBar === 12) this.snare(t);
      if (inBar % 4 === 2 || this.bossPhase2) this.hat(t, inBar % 4 === 3 ? 0.09 : 0.05);
    } else {
      // Landing page: its own slow ambient piece — two-bar chords over a deep
      // drone with a sparse bell motif, no drums.
      const bar = Math.floor(step / 32),
        inBar = step % 32;
      if (inBar === 0) {
        this.pad(AudioEngine.MENU_PADS[bar], t, barDur * 2);
        this.drone(AudioEngine.MENU_ROOTS[bar], t, barDur * 2);
      }
      const bell = AudioEngine.MENU_BELLS.find((n) => n.step === step);
      if (bell && loopIndex % 2 === 0) this.bell(bell.freq, t);
    }
  }
  private applyMusicGain() {
    if (this.musicBus && this.context) {
      const target = this.musicMuted ? 0 : 0.7 * this.musicVolume;
      this.musicBus.gain.setTargetAtTime(target, this.context.currentTime, 0.05);
    }
  }
  private persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          music: this.musicVolume,
          sfx: this.sfxVolume,
          musicMuted: this.musicMuted,
          sfxMuted: this.sfxMuted,
        }),
      );
    } catch {
      /* Persistence is best-effort; volume still works for the session. */
    }
  }
  private bass(freq: number, t: number, dur: number) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  private pad(notes: number[], t: number, dur: number) {
    const ctx = this.context!;
    const gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.085, t + 1.4);
    gain.gain.setTargetAtTime(0.0001, t + dur - 0.6, 0.35);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    for (const freq of notes)
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + dur);
        osc.onended = () => osc.disconnect();
      }
  }
  private kick(t: number) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + 0.2);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private snare(t: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(),
      tone = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      toneGain = ctx.createGain();
    source.buffer = this.noise ?? null;
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(210, t);
    toneGain.gain.setValueAtTime(0.16, t);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    tone.connect(toneGain);
    toneGain.connect(this.musicBus!);
    source.start(t);
    source.stop(t + 0.15);
    tone.start(t);
    tone.stop(t + 0.1);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      tone.disconnect();
      toneGain.disconnect();
    };
  }
  private hat(t: number, level: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise ?? null;
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    source.start(t);
    source.stop(t + 0.05);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  /** Noise sweep across the last bar of the loop so each restart hits harder. */
  private riser(t: number, dur: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise ?? null;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(5200, t + dur);
    filter.Q.value = 1.1;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.1, t + dur * 0.85);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    source.start(t);
    source.stop(t + dur + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  /** The theme voice: two detuned saws with a slow vibrato, brass-adjacent. */
  private melody(freq: number, t: number, dur: number) {
    const ctx = this.context!;
    const filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.03);
    gain.gain.setTargetAtTime(0.07, t + 0.08, 0.3);
    gain.gain.setTargetAtTime(0.0001, t + dur - 0.06, 0.04);
    lfo.frequency.value = 4.8;
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(4, t + 0.25);
    lfo.connect(lfoGain);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    if (this.echo) gain.connect(this.echo);
    for (const detune of [-3, 3]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      lfoGain.connect(osc.detune);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.12);
      osc.onended = () => osc.disconnect();
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.12);
    lfo.onended = () => {
      filter.disconnect();
      gain.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
    };
  }
  /** Cymbal-style splash at the top of each combat loop. */
  private crash(t: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise ?? null;
    source.loop = true;
    filter.type = 'highpass';
    filter.frequency.value = 2600;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    source.start(t);
    source.stop(t + 1.25);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
