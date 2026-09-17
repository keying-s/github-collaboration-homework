// WebAudio 程序合成音效 —— 无需任何音频素材
export class SFX {
  constructor() { this.ctx = null; }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 0.3;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _out(pan = 0, gain = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = gain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(ctx.destination);
    } else g.connect(ctx.destination);
    return g;
  }

  // 枪声：噪声 + 带通 + 低频砰
  shot(freq = 850, vol = 1, pan = 0) {
    if (!this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.25), t + 0.09);
    bp.Q.value = 0.8;
    const g = this._out(pan, 0.5 * vol);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(bp); bp.connect(env); env.connect(g);
    src.start(t); src.stop(t + 0.12);
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + 0.08);
  }

  _beep(f0, f1, dur, vol, type = 'square', pan = 0) {
    if (!this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this._out(pan, 1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(env); env.connect(g);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hit(head) { this._beep(head ? 1700 : 1250, head ? 1100 : 900, 0.05, 0.22); }
  kill() { this._beep(880, 0, 0.07, 0.25); setTimeout(() => this._beep(1320, 0, 0.1, 0.25), 80); }
  hurt() { this._beep(110, 55, 0.16, 0.4, 'sawtooth'); }
  reload() { this._beep(500, 300, 0.04, 0.15); setTimeout(() => this._beep(700, 900, 0.04, 0.15), 140); }
  empty() { this._beep(2200, 1800, 0.03, 0.12); }
  step() {}
}
