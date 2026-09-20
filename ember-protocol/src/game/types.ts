export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export type WeaponId = 'rifle' | 'flamer';
/** The five additive upgrade axes from the weapon-upgrade redesign spec (#24). */
export type UpgradeId = 'shots' | 'damage' | 'rate' | 'pierce' | 'mag';
export type EnemyKind = 'crawler' | 'spitter' | 'brute' | 'boss';
export type BossId = 'flower' | 'zombie' | 'doll' | 'scorpion' | 'crow';
/** Visual skin of an enemy. Purely cosmetic: behavior still comes from `kind`. */
export type EnemySkin = 'spider' | 'bat' | 'alien';
export type LevelTheme = 'grass' | 'hollow' | 'moon' | 'arena';
export type KillCause = 'bullet' | 'explosion' | 'chain';
export type Phase = 'menu' | 'combat' | 'upgrade' | 'bossSelect' | 'exit' | 'won' | 'lost';
export type Locale = 'zh-CN' | 'en';
export type StatusMessageKey =
  | 'stateReady'
  | 'upgradeActive'
  | 'portalReady'
  | 'runInterrupted'
  | 'waveIncoming'
  | 'finalPortal'
  | 'clearPortal'
  | 'crateFound';
export interface LocalizedText {
  zh: string;
  en: string;
}
export interface StatusMessage {
  key: StatusMessageKey;
  values?: Record<string, string | number>;
}
export interface Weapon {
  id: WeaponId;
  name: LocalizedText;
  label: LocalizedText;
  description: LocalizedText;
  color: number;
  damage: number;
  interval: number;
  pellets: number;
  spread: number;
  speed: number;
  magazine: number;
  reload: number;
  range: number;
}
export interface UpgradeOption {
  id: UpgradeId;
  /** Short phrase only — the redesign bans lore sentences on combat-facing cards. */
  label: LocalizedText;
}
export interface Player extends Vec {
  hp: number;
  maxHp: number;
  angle: number;
  weapon: WeaponId;
  ammo: number;
  shotCooldown: number;
  reloadRemaining: number;
  dashCooldown: number;
  dashRemaining: number;
  dashDirection: Vec;
  invincible: number;
  moving: boolean;
}
export interface Enemy extends Vec {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  radius: number;
  angle: number;
  cooldown: number;
  slow: number;
  flash: number;
  age: number;
  windup: number;
  target: Vec;
  charge: number;
  skin?: EnemySkin;
  bossId?: BossId;
  elite?: boolean;
  atk?: number;
  deathHandled?: boolean;
  knock?: Vec;
  cause?: KillCause;
  stuck?: number;
  home?: Vec;
}
export interface Bullet extends Vec {
  id: number;
  vx: number;
  vy: number;
  damage: number;
  ttl: number;
  enemy: boolean;
  radius: number;
  color: number;
  pierce: number;
  hits: Set<number>;
  owner: 'player' | 'ally' | 'enemy';
  /** Flame particles render as a soft cone spray instead of tracer lines. */
  flame?: boolean;
}
export interface Pickup extends Vec {
  id: number;
  kind: 'health' | 'crate';
  age: number;
}
export interface Barrel extends Vec {
  id: number;
  hp: number;
}
export interface InputState {
  move: Vec;
  aim: Vec;
  firing: boolean;
  dash: boolean;
  reload: boolean;
  interact: boolean;
}
export interface GameEvent extends Vec {
  type:
    | 'shot'
    | 'hit'
    | 'kill'
    | 'explosion'
    | 'dash'
    | 'hurt'
    | 'pickup'
    | 'wave'
    | 'clear'
    | 'reload'
    | 'win';
  color?: number;
  value?: number;
  target?: Vec;
  text?: LocalizedText;
  loud?: boolean;
  kind?: EnemyKind;
  cause?: KillCause;
}
export interface Level {
  name: LocalizedText;
  code: string;
  subtitle: LocalizedText;
  accent: number;
  floor: number;
  theme: LevelTheme;
  obstacles: Rect[];
  barrels: Vec[];
  /** A trailing "!" on a wave entry marks it as an elite. */
  waves: string[][];
}
/** Cosmetic + tuning profile for the final boss the player picks. */
export interface BossConfig {
  id: BossId;
  glyph: string;
  name: LocalizedText;
  tag: LocalizedText;
  description: LocalizedText;
  color: number;
  hp: number;
  /** Bosses that hold position instead of chasing. */
  stationary?: boolean;
}
