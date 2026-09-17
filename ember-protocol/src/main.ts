import Phaser from 'phaser';
import { Simulation } from './game/simulation';
import { AudioEngine } from './game/audio';
import { ArenaScene } from './game/scene';
import { Interface } from './ui/interface';
import { I18n } from './i18n';
import './style.css';

const simulation = new Simulation();
const audio = new AudioEngine();
const i18n = new I18n();
const ui = new Interface(simulation, audio, i18n);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 800,
  backgroundColor: '#142424',
  antialias: true,
  roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new ArenaScene(simulation, audio, i18n)],
  input: { keyboard: true, mouse: true, touch: false },
  fps: { target: 60 },
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    ui.destroy();
    game.destroy(true);
  });
