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
  private echo?: DelayNode;
  private noise?: AudioBuffer;
  private musicTimer?: number;
  private step = 0;
  private nextStepTime = 0;
  private combat = false;
  /** Tempo 124 BPM; one step is a sixteenth note. */
  private static readonly STEP = 60 / 124 / 4;
  /** A-minor pentatonic pluck pool: A3 C4 D4 E4 G4. */
  private static readonly PENTATONIC = [220, 261.63, 293.66, 329.63, 392];
  private static readonly ARP_MENUS = [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 2, -1, 4, -1, 3, -1];
  private static readonly ARP_COMBAT = [0, 2, 4, 2, 0, 2, 4, 3, 0, 2, 4, 2, 1, 3, 4, 3];
  private static readonly BAR_ROOTS = [55, 55, 43.65, 49];
  private static readonly BAR_PADS = [
    [110, 130.81, 164.81],
    [110, 130.81, 164.81],
    [87.31, 110, 130.81],
    [82.41, 103.83, 123.47],
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
        this.musicBus.connect(this.context.destination);
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
  /** Combat switches the loop to the denser drum-driven arrangement. */
  setCombat(combat: boolean) {
    this.combat = combat;
  }
  play(event: GameEvent) {
    if (this.sfxMuted || this.sfxVolume <= 0 || !this.context || !this.bus) return;
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
  /** Lookahead scheduler keeping ~150ms of music queued on the audio clock. */
  private startMusic() {
    if (this.musicTimer || !this.context) return;
    this.step = 0;
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
    while (this.nextStepTime < this.context.currentTime + 0.15) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += AudioEngine.STEP;
    }
  }
  private scheduleStep(step: number, t: number) {
    const bar = Math.floor(step / 16),
      inBar = step % 16,
      stepDur = AudioEngine.STEP,
      barDur = stepDur * 16;
    if (inBar === 0) {
      if (bar % 2 === 0) this.pad(AudioEngine.BAR_PADS[bar], t, barDur * 2);
      if (this.combat && step === 48) this.riser(t, stepDur * 16);
    }
    // Driving eighth-note bass; jumps an octave on the last off-beat in combat.
    if (inBar % 2 === 0) {
      const root = AudioEngine.BAR_ROOTS[bar];
      this.bass(this.combat && inBar === 14 ? root * 2 : root, t, stepDur * 1.7);
    }
    if (this.combat) {
      if (inBar % 4 === 0) this.kick(t);
      if (inBar === 4 || inBar === 12) this.snare(t);
      if (inBar % 2 === 1) this.hat(t, inBar % 4 === 3 ? 0.11 : 0.06);
    } else {
      if (inBar === 0 || inBar === 8) this.kick(t);
      if (inBar % 4 === 2) this.hat(t, 0.05);
    }
    const arp = this.combat ? AudioEngine.ARP_COMBAT : AudioEngine.ARP_MENUS;
    if (arp[inBar] >= 0) this.pluck(AudioEngine.PENTATONIC[arp[inBar]], t);
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
  private pluck(freq: number, t: number) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 1900;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus!);
    if (this.echo) gain.connect(this.echo);
    osc.start(t);
    osc.stop(t + 0.2);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
