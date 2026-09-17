export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export type WeaponId = 'rifle' | 'shotgun' | 'arc';
export type SkillId = 'chain' | 'cryo' | 'pierce' | 'nova' | 'leech' | 'haste';
export type EnemyKind = 'crawler' | 'spitter' | 'brute' | 'boss';
export type Phase = 'menu' | 'combat' | 'upgrade' | 'exit' | 'won' | 'lost';
export interface Weapon {
  id: WeaponId;
  name: string;
  label: string;
  description: string;
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
export interface Skill {
  id: SkillId;
  name: string;
  tag: string;
  description: string;
  color: string;
  icon: string;
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
  deathHandled?: boolean;
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
}
export interface Pickup extends Vec {
  id: number;
  kind: 'weapon' | 'health' | 'module';
  weapon?: WeaponId;
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
  switchWeapon: boolean;
}
export interface GameEvent extends Vec {
  type:
    | 'shot'
    | 'hit'
    | 'kill'
    | 'explosion'
    | 'dash'
    | 'hurt'
    | 'chain'
    | 'pickup'
    | 'wave'
    | 'clear'
    | 'reload'
    | 'win';
  color?: number;
  value?: number;
  target?: Vec;
  text?: string;
  loud?: boolean;
}
export interface Level {
  name: string;
  en: string;
  subtitle: string;
  accent: number;
  floor: number;
  obstacles: Rect[];
  barrels: Vec[];
  waves: EnemyKind[][];
}
