import Phaser from 'phaser';
import { ArenaRenderer } from './renderer';
import type { Simulation } from './simulation';
import type { AudioEngine } from './audio';
import type { InputState } from './types';
import type { I18n } from '../i18n';

export class ArenaScene extends Phaser.Scene {
  private arenaRenderer!: ArenaRenderer;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastLevel = -1;
  private actions = new Set<string>();
  private fireRequested = false;
  constructor(
    private model: Simulation,
    private audio: AudioEngine,
    private i18n: I18n,
  ) {
    super('Arena');
  }
  create() {
    this.arenaRenderer = new ArenaRenderer(this, this.model, this.i18n, this.audio);
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,R,E',
    ) as typeof this.keys;
    // Buffer tap actions between frames: short key presses must not disappear on key-up.
    for (const key of ['SPACE', 'SHIFT', 'R', 'E']) {
      this.keys[key].on('down', () => this.actions.add(key));
    }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.fireRequested = true;
    });
    this.input.mouse?.disableContextMenu();
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.model.phase === 'combat' || this.model.phase === 'exit') this.model.paused = true;
      this.input.keyboard?.resetKeys();
      this.actions.clear();
      this.fireRequested = false;
    });
  }
  update(time: number, delta: number) {
    if (!this.arenaRenderer) return;
    const k = this.keys,
      p = this.input.activePointer,
      just = (key: string) => this.actions.delete(key);
    const input: InputState = {
      move: {
        x: Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown),
        y: Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown),
      },
      aim: { x: p.x, y: p.y },
      firing: p.leftButtonDown() || this.fireRequested,
      dash: just('SPACE') || just('SHIFT'),
      reload: just('R'),
      interact: just('E'),
    };
    this.fireRequested = false;
    const dt = Math.min(delta / 1000, 0.04);
    this.model.tick(dt, input);
    if (this.lastLevel !== this.model.levelIndex) {
      this.arenaRenderer.reset();
      this.lastLevel = this.model.levelIndex;
    }
    for (const event of this.model.drainEvents()) {
      this.arenaRenderer.handle(event);
      this.audio.play(event);
    }
    this.arenaRenderer.render(this.model.paused ? 0 : dt, time / 1000);
    if (!this.model.paused && (this.model.phase === 'combat' || this.model.phase === 'exit'))
      this.arenaRenderer.drawAim(input.aim);
  }
}
