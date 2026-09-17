import type { GameEvent } from './types';

/** Small synthesized sound bank: no external assets or network dependency. */
export class AudioEngine {
  muted = false;
  private context?: AudioContext;
  private bus?: GainNode;
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (!this.bus) {
        this.bus = this.context.createGain();
        this.bus.gain.value = 0.17;
        this.bus.connect(this.context.destination);
      }
      void this.context.resume();
    } catch {
      /* Audio is optional; gameplay remains available. */
    }
  }
  toggle() {
    this.muted = !this.muted;
    this.unlock();
    return this.muted;
  }
  play(event: GameEvent) {
    if (this.muted || !this.context || !this.bus) return;
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
    gain.gain.setValueAtTime(event.type === 'shot' ? 0.35 : 0.5, t);
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
}
