import { BOSSES, LEVELS, UPGRADES, WEAPONS, WORLD } from './config';
import { circleRect, clamp, distance, normalize, segmentCircle, segmentRect } from './math';
import type {
  Barrel,
  Bullet,
  BossId,
  Enemy,
  EnemyKind,
  EnemySkin,
  GameEvent,
  InputState,
  KillCause,
  Phase,
  Pickup,
  Player,
  UpgradeId,
  StatusMessage,
  Vec,
  Weapon,
  WeaponId,
} from './types';

const RADII = { crawler: 20, spitter: 23, brute: 31, boss: 58 };
const HP = { crawler: 48, spitter: 66, brute: 185, boss: 1250 };
/** Visual theme of the regular enemies, ordered by level. */
const SKINS: EnemySkin[] = ['spider', 'bat', 'alien'];
const EMPTY_INPUT: InputState = {
  move: { x: 0, y: 0 },
  aim: { x: 800, y: 400 },
  firing: false,
  dash: false,
  reload: false,
  interact: false,
};

/** Engine-independent model. All gameplay state is here; rendering never changes combat rules. */
export class Simulation {
  phase: Phase = 'menu';
  paused = false;
  squad = false;
  levelIndex = 0;
  waveIndex = 0;
  player: Player = this.newPlayer();
  ally = { x: 560, y: 485, angle: 0, cooldown: 0 };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  barrels: Barrel[] = [];
  upgrades: UpgradeId[] = [];
  events: GameEvent[] = [];
  kills = 0;
  elapsed = 0;
  combo = 0;
  bestCombo = 0;
  comboTime = 0;
  damageTaken = 0;
  freeze = 0;
  training = false;
  trainingDone = new Set<string>();
  shotsFired = 0;
  dashed = false;
  hint: StatusMessage = { key: 'stateReady' };
  waveDelay = 1.5;
  /** Final-boss choice, picked in the pre-arena selection window. */
  bossId: BossId | null = null;
  private queue: string[] = [];
  private spawnTimer = 0;
  private nextId = 1;
  private flow: number[] = [];
  private flowTimer = 0;
  offeredUpgrades: UpgradeId[] = [];
  private flameTick = 0;
  constructor(private random: () => number = Math.random) {
    this.prepareRoom();
  }
  get level() {
    return LEVELS[this.levelIndex];
  }
  get weapon() {
    return WEAPONS[this.player.weapon];
  }
  get remaining() {
    return this.enemies.filter((e) => e.hp > 0).length + this.queue.length;
  }
  get isLastLevel() {
    return this.levelIndex === LEVELS.length - 1;
  }
  get boss() {
    return this.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
  }
  get options() {
    return this.offeredUpgrades.length
      ? this.offeredUpgrades.map((id) => UPGRADES.find((u) => u.id === id)!)
      : UPGRADES.slice(0, 3);
  }
  /** Power-fantasy pass (#49): every axis pick DOUBLES the stat (2^stacks).
   * Stacking one axis and spreading picks multiply total output equally, but feel
   * completely different — extreme builds are loud and visible, balanced builds even. */
  get stats(): Weapon {
    const base = WEAPONS[this.player.weapon];
    const n = (id: UpgradeId) => 2 ** this.upgrades.filter((u) => u === id).length;
    const rifle = this.player.weapon === 'rifle';
    return {
      ...base,
      pellets: rifle ? base.pellets * n('shots') : base.pellets,
      spread: rifle ? base.spread : Math.min(base.spread * n('shots'), 1.4),
      damage: base.damage * n('damage'),
      interval: Math.max(base.interval / n('rate'), 0.035),
      range: rifle ? base.range : base.range * n('pierce'),
      magazine: Math.round(base.magazine * n('mag')),
    };
  }
  get pierceCount() {
    return this.player.weapon === 'rifle'
      ? 2 ** this.upgrades.filter((u) => u === 'pierce').length
      : 0;
  }
  get nearestPickup() {
    return this.pickups
      .filter((p) => p.kind !== 'health')
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
  }
  private newPlayer(): Player {
    return {
      x: 640,
      y: 445,
      hp: 100,
      maxHp: 100,
      angle: -0.4,
      weapon: 'rifle',
      ammo: 30,
      shotCooldown: 0,
      reloadRemaining: 0,
      dashCooldown: 0,
      dashRemaining: 0,
      dashDirection: { x: 1, y: 0 },
      invincible: 0,
      moving: false,
    };
  }

  start(squad = false, weapon: WeaponId = 'rifle') {
    this.squad = squad;
    this.upgrades = [];
    this.offeredUpgrades = [];
    this.training = false;
    this.trainingDone = new Set();
    this.shotsFired = 0;
    this.dashed = false;
    this.player = this.newPlayer();
    this.player.weapon = weapon;
    this.kills = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.damageTaken = 0;
    this.freeze = 0;
    this.levelIndex = 0;
    this.bossId = null;
    this.paused = false;
    this.phase = 'combat';
    this.prepareRoom();
  }
  /** Safe practice sandbox: invincible player, stationary dummies, no waves. */
  beginTraining() {
    this.start(false);
    this.training = true;
    this.phase = 'combat';
    this.trainingDone = new Set();
    this.shotsFired = 0;
    this.dashed = false;
    this.player.invincible = 999;
    this.barrels = [];
    this.enemies = [];
    this.queue = [];
    this.spawnTrainingDummies();
  }
  endTraining() {
    this.training = false;
    this.trainingDone = new Set();
    this.phase = 'menu';
  }
  private spawnTrainingDummies() {
    const slots = [
      { x: 470, y: 300 },
      { x: 820, y: 320 },
      { x: 640, y: 560 },
      { x: 905, y: 540 },
    ];
    for (const s of slots)
      this.enemies.push({
        ...s,
        id: this.nextId++,
        kind: 'crawler',
        hp: 140,
        maxHp: 140,
        radius: 20,
        angle: 0,
        cooldown: 100,
        slow: 0,
        flash: 0,
        age: 10,
        windup: 0,
        target: { ...this.player },
        charge: 0,
        home: { ...s },
      });
  }
  private prepareRoom() {
    this.enemies = [];
    this.bullets = [];
    this.events = [];
    this.pickups = [];
    this.queue = [];
    this.barrels = this.level.barrels.map((p) => ({ ...p, id: this.nextId++, hp: 35 }));
    Object.assign(this.player, {
      x: 640,
      y: 445,
      hp: this.player.maxHp,
      ammo: this.weapon.magazine,
      reloadRemaining: 0,
      dashCooldown: 0,
      dashRemaining: 0,
      invincible: 1,
      shotCooldown: 0,
    });
    Object.assign(this.ally, { x: 565, y: 495, cooldown: 0 });
    this.waveIndex = 0;
    this.waveDelay = 2.8;
    this.spawnTimer = 0;
    this.flowTimer = 0;
    this.hint = { key: 'stateReady' };
    this.emit('wave', this.player, { text: this.level.name });
  }
  nextLevel() {
    if (this.phase !== 'exit') return;
    if (this.isLastLevel) {
      this.phase = 'won';
      this.emit('win', this.player);
      return;
    }
    this.levelIndex++;
    // Entering the arena: pause behind the boss-selection window until a nemesis is picked.
    this.phase = this.isLastLevel ? 'bossSelect' : 'combat';
    this.prepareRoom();
  }
  /** Confirm the final boss from the pre-arena selection window. */
  chooseBoss(id: BossId) {
    if (this.phase !== 'bossSelect') return;
    this.bossId = id;
    this.phase = 'combat';
    this.hint = { key: 'stateReady' };
    this.player.invincible = 1.2;
  }
  chooseUpgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade' || !this.options.some((o) => o.id === id)) return;
    this.upgrades.push(id);
    this.emit('pickup', this.player, {
      text: UPGRADES.find((u) => u.id === id)!.label,
      color: 0xade3b7,
    });
    this.offeredUpgrades = [];
    // Offers only open on room clear, so the run always resumes at the exit gate.
    this.phase = 'exit';
    this.hint = { key: 'portalReady' };
    this.player.invincible = 1.2;
  }
  /** Two random distinct axes, stable until chosen (#49). */
  private offerUpgrades() {
    const pool = [...UPGRADES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.offeredUpgrades = pool.slice(0, 3).map((u) => u.id);
    this.phase = 'upgrade';
  }
  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
  private emit(type: GameEvent['type'], p: Vec, extra: Partial<GameEvent> = {}) {
    this.events.push({ type, x: p.x, y: p.y, ...extra });
  }
  tick(dt: number, input: InputState = EMPTY_INPUT) {
    if (this.paused || !['combat', 'exit'].includes(this.phase)) return;
    dt = clamp(dt, 0, 0.05);
    // Hitstop: killing blows freeze the world for a few frames so the hit lands.
    if (this.freeze > 0) {
      this.freeze = Math.max(0, this.freeze - dt);
      return;
    }
    if (this.training) {
      this.player.invincible = Math.max(this.player.invincible, 999);
      this.player.hp = this.player.maxHp;
    }
    if (this.phase === 'combat') this.elapsed += dt;
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    this.updatePlayer(dt, input);
    if (this.phase !== 'combat' && this.phase !== 'exit') return;
    this.pickups.forEach((p) => (p.age += dt));
    this.updateAlly(dt);
    if (this.phase === 'combat') {
      if (!this.training) this.updateWaves(dt);
      this.flowTimer -= dt;
      if (this.flowTimer <= 0) {
        this.buildFlow();
        this.flowTimer = 0.4;
      }
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.cleanupEnemies();
    }
    if (!this.training && this.player.hp <= 0) {
      this.player.hp = 0;
      this.phase = 'lost';
      this.hint = { key: 'runInterrupted' };
    }
  }
  private updatePlayer(dt: number, input: InputState) {
    const p = this.player;
    p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    for (const key of ['shotCooldown', 'dashCooldown', 'invincible'] as const)
      p[key] = Math.max(0, p[key] - dt);
    if (p.reloadRemaining > 0) {
      p.reloadRemaining -= dt;
      if (p.reloadRemaining <= 0) {
        p.reloadRemaining = 0;
        p.ammo = this.stats.magazine;
      }
    }
    if (input.reload) {
      this.reload();
      if (this.training) this.trainingDone.add('reload');
    }
    const move = normalize(input.move);
    p.moving = move.x !== 0 || move.y !== 0;
    if (input.dash && p.dashCooldown <= 0) {
      p.dashDirection = p.moving ? move : { x: Math.cos(p.angle), y: Math.sin(p.angle) };
      p.dashRemaining = 0.17;
      p.dashCooldown = 2.2;
      p.invincible = 0.32;
      this.emit('dash', p, { color: 0xfab583 });
      if (this.training) this.trainingDone.add('dash');
      else this.dashed = true;
    }
    if (p.dashRemaining > 0) {
      this.move(p, p.dashDirection, 840 * dt, 17);
      p.dashRemaining = Math.max(0, p.dashRemaining - dt);
    } else this.move(p, move, 245 * dt, 17);
    if (input.firing && this.phase === 'combat' && p.shotCooldown <= 0 && p.reloadRemaining <= 0) {
      if (p.ammo > 0) {
        this.fire(p, p.angle, p.weapon, 'player');
        if (this.training) this.trainingDone.add('shoot');
        p.ammo--;
        p.shotCooldown = this.stats.interval;
      } else this.reload();
    }
    for (const pickup of [...this.pickups]) {
      if (pickup.kind === 'health' && distance(p, pickup) < 34 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 25);
        this.pickups = this.pickups.filter((v) => v.id !== pickup.id);
        this.emit('pickup', p, {
          text: { zh: '+25 生命', en: '+25 HEALTH' },
          color: 0xa6d8a7,
        });
      }
    }
    if (input.interact && this.phase === 'exit' && distance(p, { x: 1160, y: 400 }) < 100)
      this.nextLevel();
  }
  private reload() {
    if (this.player.reloadRemaining > 0 || this.player.ammo === this.stats.magazine) return;
    this.player.reloadRemaining = this.weapon.reload;
    this.emit('reload', this.player);
  }
  private move(p: Vec, d: Vec, amount: number, r: number) {
    const edge = WORLD.inset + r;
    const nx = clamp(p.x + d.x * amount, edge, WORLD.width - edge);
    if (!this.level.obstacles.some((b) => circleRect({ x: nx, y: p.y }, r, b))) p.x = nx;
    const ny = clamp(p.y + d.y * amount, edge, WORLD.height - edge);
    if (!this.level.obstacles.some((b) => circleRect({ x: p.x, y: ny }, r, b))) p.y = ny;
  }
  /** Enemy steering. If cover blocks the way, slide along it instead of pressing. */
  private enemyMove(e: Enemy, d: Vec, speed: number, dt: number) {
    const before = { x: e.x, y: e.y };
    this.move(e, d, speed * dt, e.radius);
    if (distance(e, before) >= 0.3 || speed <= 0) {
      e.stuck = 0;
      return;
    }
    e.stuck = (e.stuck ?? 0) + dt;
    if (e.stuck > 0.25) {
      // Pressed against cover: slide along it. Try both tangents so we never
      // pick the side that pushes deeper into the block.
      for (const side of e.id % 2 === 0 ? [1, -1] : [-1, 1]) {
        const from = { x: e.x, y: e.y };
        this.move(e, { x: -d.y * side, y: d.x * side }, speed * dt, e.radius);
        if (distance(e, from) >= 0.3) break;
      }
    }
  }
  private fire(p: Vec, angle: number, id: WeaponId, owner: 'player' | 'ally') {
    const isPlayer = owner === 'player',
      // The player's shots use upgrade-adjusted stats; the ally always fires a base rifle.
      w = isPlayer ? this.stats : WEAPONS[id],
      isFlame = id === 'flamer';
    for (let i = 0; i < w.pellets; i++) {
      const a =
        angle +
        (w.pellets > 1
          ? (i / (w.pellets - 1) - 0.5) * w.spread * 2
          : (this.random() - 0.5) * w.spread);
      this.bullets.push({
        id: this.nextId++,
        x: p.x + Math.cos(angle) * 29,
        y: p.y + Math.sin(angle) * 29,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        damage: w.damage * (isPlayer ? 1 : 0.48),
        ttl: w.range / w.speed,
        enemy: false,
        radius: isFlame ? 5 : 3,
        color: isPlayer ? w.color : 0xa5e1cf,
        pierce: isPlayer ? this.pierceCount : 0,
        hits: new Set(),
        owner,
        flame: isFlame,
      });
    }
    // The flamer fires ~20 particles per second; throttle its feedback events so
    // audio and particles mark the sustained stream, not every single particle.
    if (!isFlame || this.flameTick++ % 8 === 0)
      this.emit(
        'shot',
        { x: p.x + Math.cos(angle) * 30, y: p.y + Math.sin(angle) * 30 },
        { color: isPlayer ? w.color : 0x99ccbe, value: angle, loud: isPlayer && !isFlame },
      );
    if (isPlayer) this.shotsFired++;
  }
  private updateAlly(dt: number) {
    if (!this.squad) return;
    const a = this.ally;
    a.cooldown -= dt;
    const desired = { x: this.player.x - 60, y: this.player.y + 50 };
    if (distance(a, desired) > 45) this.move(a, this.directionTo(a, desired), 210 * dt, 15);
    if (distance(a, this.player) > 360) {
      a.x = this.player.x - 32;
      a.y = this.player.y + 32;
    }
    const enemy = this.enemies
      .filter((e) => e.hp > 0 && this.lineClear(a, e))
      .sort((u, v) => distance(a, u) - distance(a, v))[0];
    if (enemy) {
      a.angle = Math.atan2(enemy.y - a.y, enemy.x - a.x);
      if (a.cooldown <= 0 && distance(a, enemy) < 580) {
        this.fire(a, a.angle, 'rifle', 'ally');
        a.cooldown = 0.23;
      }
    } else a.angle = this.player.angle;
  }
  private updateWaves(dt: number) {
    if (this.queue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn(this.queue.shift()!);
        this.spawnTimer = 0.58;
      }
      return;
    }
    if (this.enemies.length) return;
    this.waveDelay -= dt;
    if (this.waveDelay > 0) return;
    if (this.waveIndex < this.level.waves.length) {
      this.queue = [...this.level.waves[this.waveIndex]];
      this.waveIndex++;
      this.spawnTimer = 0;
      this.hint = { key: 'waveIncoming', values: { wave: this.waveIndex } };
      this.emit(
        'wave',
        { x: 640, y: 180 },
        {
          text: { zh: `WAVE 0${this.waveIndex}`, en: `WAVE 0${this.waveIndex}` },
        },
      );
    } else {
      this.bullets = [];
      if (!this.isLastLevel && this.upgrades.length < 5) {
        // Power-fantasy pass: the choice pops straight onto the paused screen.
        this.offerUpgrades();
      } else {
        this.phase = 'exit';
        this.hint = { key: this.isLastLevel ? 'finalPortal' : 'clearPortal' };
      }
      this.emit(
        'clear',
        { x: 640, y: 365 },
        {
          text: { zh: '区域肃清', en: 'AREA CLEARED' },
        },
      );
    }
  }
  private spawn(token: string) {
    const points = [
      { x: 135, y: 160 },
      { x: 640, y: 115 },
      { x: 1145, y: 160 },
      { x: 1145, y: 650 },
      { x: 640, y: 690 },
      { x: 135, y: 650 },
    ];
    let p = points[Math.floor(this.random() * points.length)];
    if (distance(p, this.player) < 270) p = points[(points.indexOf(p) + 3) % points.length];
    if (token.startsWith('boss')) p = { x: 640, y: 190 };
    this.spawnAt(p, token);
  }
  /** Shared enemy factory. A trailing "!" on the token marks an elite variant. */
  private spawnAt(p: Vec, token: string, forcedSkin?: EnemySkin) {
    const elite = token.endsWith('!');
    const kind = token.replace(/!$/, '') as EnemyKind;
    const bossCfg =
      kind === 'boss' ? BOSSES.find((b) => b.id === (this.bossId ?? 'flower'))! : null;
    const hp =
      (bossCfg ? bossCfg.hp : HP[kind]) *
      (this.level.hpScale ?? 1) *
      (this.squad ? 1.2 : 1) *
      (elite ? 4 : 1);
    this.enemies.push({
      ...p,
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      radius: RADII[kind] * (elite ? 1.35 : 1),
      angle: 0,
      cooldown: 1.1 + this.random(),
      slow: 0,
      flash: 0,
      age: 0,
      windup: 0,
      target: { ...this.player },
      charge: 0,
      skin:
        forcedSkin ??
        (kind === 'boss'
          ? undefined
          : this.levelIndex < 3
            ? SKINS[this.levelIndex]
            : SKINS[Math.floor(this.random() * SKINS.length)]),
      bossId: bossCfg?.id,
      elite,
      atk: 0,
    });
  }
  /** Bosses call reinforcements. Capped so swarms stay readable. */
  private summon(from: Vec, count: number, kind: EnemyKind, skin: EnemySkin) {
    const alive = this.enemies.filter((e) => e.hp > 0).length;
    const n = Math.min(count, Math.max(0, 9 - alive));
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + this.random();
      const p = {
        x: clamp(from.x + Math.cos(a) * 95, 110, 1170),
        y: clamp(from.y + Math.sin(a) * 95, 120, 690),
      };
      if (this.level.obstacles.some((b) => circleRect(p, 22, b))) continue;
      const hp = HP[kind] * 0.8 * (this.level.hpScale ?? 1);
      this.enemies.push({
        ...p,
        id: this.nextId++,
        kind,
        hp,
        maxHp: hp,
        radius: RADII[kind],
        angle: 0,
        cooldown: 1.1,
        slow: 0,
        flash: 0,
        age: 0,
        windup: 0,
        target: { ...this.player },
        charge: 0,
        skin,
        atk: 0,
      });
      this.emit('wave', p, { text: undefined });
    }
  }
  /** Doll boss: blink to a flank around the player, clear of cover. */
  private bossBlink(e: Enemy) {
    for (let tries = 0; tries < 8; tries++) {
      const a = this.random() * Math.PI * 2,
        d = 210 + this.random() * 90;
      const p = {
        x: clamp(this.player.x + Math.cos(a) * d, 110, 1170),
        y: clamp(this.player.y + Math.sin(a) * d, 120, 690),
      };
      if (!this.level.obstacles.some((b) => circleRect(p, e.radius, b))) {
        e.x = p.x;
        e.y = p.y;
        this.emit('dash', e, { color: 0xe6c9d8 });
        return;
      }
    }
  }
  private enemyFan(
    e: Enemy,
    count: number,
    spread: number,
    speed: number,
    damage = 10,
    radius = 6,
    color = 0xf19bac,
  ) {
    for (let i = 0; i < count; i++)
      this.enemyBullet(
        e,
        e.angle + (count > 1 ? (i / (count - 1) - 0.5) * spread * 2 : 0),
        speed,
        damage,
        radius,
        color,
      );
  }
  private enemyRadial(e: Enemy, count: number, speed: number) {
    for (let i = 0; i < count; i++)
      this.enemyBullet(e, (i / count) * Math.PI * 2 + e.age * 0.3, speed);
    this.emit('explosion', e, { color: 0xe89aaa, value: 65 });
  }
  /** Per-boss attack scripts, executed when the windup finishes. */
  private bossAttack(e: Enemy) {
    const phase2 = e.hp < e.maxHp / 2;
    e.atk = (e.atk ?? 0) + 1;
    switch (e.bossId) {
      case 'zombie':
        this.summon(e, phase2 ? 3 : 2, 'crawler', 'spider');
        if (phase2) this.enemyFan(e, 6, 0.55, 225);
        e.cooldown = phase2 ? 1.9 : 2.6;
        break;
      case 'doll':
        this.bossBlink(e);
        this.enemyFan(e, phase2 ? 9 : 6, phase2 ? 0.5 : 0.35, 265, 9, 4, 0xe8d8e2);
        e.cooldown = phase2 ? 1.5 : 2.2;
        break;
      case 'scorpion':
        if (e.atk % 2 === 1) {
          e.charge = 0.55;
          this.emit('dash', e, { color: 0xc4cfe0 });
        } else this.enemyFan(e, 5, 0.4, 240);
        if (phase2 && e.atk % 3 === 0) this.enemyRadial(e, 14, 190);
        e.cooldown = phase2 ? 1.8 : 2.4;
        break;
      case 'crow':
        this.summon(e, phase2 ? 3 : 2, 'crawler', 'bat');
        this.enemyFan(e, phase2 ? 8 : 5, 0.9, 205);
        e.cooldown = phase2 ? 1.7 : 2.5;
        break;
      case 'flower':
      default:
        if (e.atk % 3 === 0) this.summon(e, 2, 'crawler', 'spider');
        if (e.atk % 2 === 0 || phase2) this.enemyRadial(e, phase2 ? 18 : 12, phase2 ? 195 : 165);
        else this.enemyFan(e, 5, 0.5, 210);
        e.cooldown = phase2 ? 1.7 : 2.4;
    }
  }
  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (this.training) {
        e.age += dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.knock) {
          const speed = Math.hypot(e.knock.x, e.knock.y);
          if (speed > 1) {
            this.move(e, normalize(e.knock), speed * dt, e.radius);
            const decay = Math.exp(-dt * 11);
            e.knock.x *= decay;
            e.knock.y *= decay;
          } else {
            e.knock.x = 0;
            e.knock.y = 0;
          }
        }
        continue;
      }
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      if (e.knock) {
        const speed = Math.hypot(e.knock.x, e.knock.y);
        if (speed > 1) {
          this.move(e, normalize(e.knock), speed * dt, e.radius);
          const decay = Math.exp(-dt * 11);
          e.knock.x *= decay;
          e.knock.y *= decay;
        } else {
          e.knock.x = 0;
          e.knock.y = 0;
        }
      }
      if (e.age < 0.7) continue;
      const d = distance(e, this.player);
      e.angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.cooldown -= dt;
      const slow = e.slow > 0 ? 0.55 : 1;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          if (e.kind === 'brute') {
            e.charge = 0.5;
            this.emit('dash', e, { color: 0xe7a396 });
          }
          if (e.kind === 'boss') this.bossAttack(e);
        }
      } else if (e.charge > 0) {
        this.enemyMove(e, normalize({ x: e.target.x - e.x, y: e.target.y - e.y }), 470, dt);
        e.charge -= dt;
      } else if (e.kind === 'spitter') {
        if (d > 310 || !this.lineClear(e, this.player))
          this.enemyMove(e, this.directionTo(e, this.player), 70 * slow, dt);
        else if (d < 185)
          this.move(
            e,
            normalize({ x: e.x - this.player.x, y: e.y - this.player.y }),
            60 * dt,
            e.radius,
          );
        if (e.cooldown <= 0 && this.lineClear(e, this.player)) {
          for (let i = -1; i <= 1; i++) this.enemyBullet(e, e.angle + i * 0.17, 190);
          e.cooldown = 2.4;
          this.emit('shot', e, { color: 0xed8f9e, loud: false });
        }
      } else if (e.kind === 'brute') {
        if (e.cooldown <= 0 && d < 450 && this.lineClear(e, this.player)) {
          e.windup = 0.85;
          e.target = { ...this.player };
          e.cooldown = e.elite ? 2.3 : 3.6;
        } else this.enemyMove(e, this.directionTo(e, this.player), 62 * slow, dt);
      } else if (e.kind === 'boss') {
        if (e.cooldown <= 0) {
          e.windup = 1.0;
          e.target = { ...this.player };
        }
        const stationary = e.bossId === 'flower';
        const enraged = e.bossId === 'zombie' && e.hp < e.maxHp / 2;
        const speed = (e.bossId === 'crow' ? 38 : 26) * (enraged ? 1.8 : 1);
        if (!stationary && d > 220)
          this.enemyMove(e, this.directionTo(e, this.player), speed * slow, dt);
      } else
        this.move(
          e,
          this.directionTo(e, this.player),
          (96 + this.levelIndex * 9) * slow * dt,
          e.radius,
        );
      for (const other of this.enemies) {
        if (other.id <= e.id || other.hp <= 0) continue;
        const dist = distance(e, other),
          min = e.radius + other.radius - 3;
        if (dist < min && dist > 0) {
          const n = normalize({ x: e.x - other.x, y: e.y - other.y });
          this.enemyMove(e, n, 35, dt);
          this.move(other, { x: -n.x, y: -n.y }, 35 * dt, other.radius);
        }
      }
      const contactDistance = distance(e, this.player);
      if (contactDistance < e.radius + 18) {
        this.hurt(e.kind === 'boss' ? 22 : e.kind === 'brute' ? 18 : 11);
        // Keep bodies outside the muzzle: a pursuing enemy must remain hittable at contact range.
        const away =
          contactDistance > 0
            ? normalize({ x: e.x - this.player.x, y: e.y - this.player.y })
            : { x: 1, y: 0 };
        this.move(e, away, e.radius + 18 - contactDistance, e.radius);
      }
    }
  }
  private enemyBullet(
    e: Enemy,
    a: number,
    speed: number,
    damage = 10,
    radius = 6,
    color = 0xf19bac,
  ) {
    this.bullets.push({
      id: this.nextId++,
      x: e.x + Math.cos(a) * (e.radius + 8),
      y: e.y + Math.sin(a) * (e.radius + 8),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage,
      ttl: 5,
      enemy: true,
      radius,
      color,
      pierce: 0,
      hits: new Set(),
      owner: 'enemy',
    });
  }
  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      const prev = { x: b.x, y: b.y };
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      if (
        b.x < 58 ||
        b.x > 1222 ||
        b.y < 58 ||
        b.y > 742 ||
        this.level.obstacles.some((r) => segmentRect(prev, b, r, b.radius))
      ) {
        b.ttl = 0;
        this.emit('hit', b, { color: b.color });
        continue;
      }
      if (b.enemy) {
        if (segmentCircle(prev, b, this.player, 17 + b.radius)) {
          this.hurt(b.damage);
          b.ttl = 0;
        }
        continue;
      }
      for (const barrel of this.barrels) {
        if (barrel.hp > 0 && segmentCircle(prev, b, barrel, 20)) {
          barrel.hp -= b.damage;
          b.ttl = 0;
          this.emit('hit', barrel, { color: 0xffb47a });
          if (barrel.hp <= 0) this.explode(barrel, 150, 140, true);
          break;
        }
      }
      if (b.ttl <= 0) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0 || b.hits.has(e.id) || !segmentCircle(prev, b, e, e.radius + b.radius))
          continue;
        b.hits.add(e.id);
        this.damageEnemy(e, b.damage, b.color);
        this.knockback(e, b.vx, b.vy, 190);
        if (b.pierce <= 0) {
          b.ttl = 0;
          break;
        }
        b.pierce--;
      }
    }
    this.bullets = this.bullets.filter((b) => b.ttl > 0);
    this.barrels = this.barrels.filter((b) => b.hp > 0);
  }
  private damageEnemy(e: Enemy, damage: number, color: number, cause: KillCause = 'bullet') {
    e.hp -= damage;
    e.flash = 0.08;
    e.cause = cause;
    this.emit('hit', e, { color, value: Math.round(damage) });
  }
  /** Pushes an enemy along a direction. Heavier kinds resist more. */
  private knockback(e: Enemy, dx: number, dy: number, force: number) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const mass =
      e.kind === 'crawler' ? 1 : e.kind === 'spitter' ? 1.3 : e.kind === 'brute' ? 2.8 : 7;
    const k = (e.knock ??= { x: 0, y: 0 });
    k.x += (dx / len) * (force / mass);
    k.y += (dy / len) * (force / mass);
  }
  private explode(p: Vec, r: number, damage: number, hurtPlayer: boolean) {
    this.emit('explosion', p, { value: r, color: 0xf7b280 });
    for (const e of this.enemies)
      if (e.hp > 0 && distance(p, e) < r + e.radius) {
        this.damageEnemy(e, damage, 0xf7b280, 'explosion');
        this.knockback(e, e.x - p.x, e.y - p.y, 340);
      }
    if (hurtPlayer && distance(p, this.player) < r) this.hurt(18);
    for (const b of this.barrels)
      if (b.hp > 0 && b !== p && distance(p, b) < r) {
        b.hp = 0;
        this.explode(b, r, damage, hurtPlayer);
      }
  }
  private hurt(damage: number) {
    if (this.player.invincible > 0) return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.invincible = 0.75;
    this.damageTaken += damage;
    this.combo = 0;
    this.emit('hurt', this.player, { value: damage, color: 0xf58e87 });
  }
  private cleanupEnemies() {
    for (const e of this.enemies.filter((e) => e.hp <= 0 && !e.deathHandled)) {
      if (this.training && e.home) {
        e.hp = e.maxHp;
        e.x = e.home.x;
        e.y = e.home.y;
        e.flash = 0;
        e.knock = undefined;
        e.stuck = 0;
        e.charge = 0;
        e.windup = 0;
        e.deathHandled = false;
        continue;
      }
      e.deathHandled = true;
      this.kills++;
      this.combo++;
      this.comboTime = 3.2;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.emit('kill', e, {
        color: e.kind === 'boss' ? 0xe8a1b4 : 0x94c598,
        value: e.radius,
        kind: e.kind,
        cause: e.cause ?? 'bullet',
        loud: e.kind === 'brute' || e.kind === 'boss',
      });
      // Heavy kills stop the world longer; regular kills only flinch.
      this.freeze = Math.max(this.freeze, e.kind === 'brute' || e.kind === 'boss' ? 0.09 : 0.045);
      // Elite bats split into a pair of screechers when killed.
      if (e.elite && e.skin === 'bat' && !this.training) {
        this.spawnAt({ x: clamp(e.x - 26, 100, 1180), y: e.y }, 'crawler', 'bat');
        this.spawnAt({ x: clamp(e.x + 26, 100, 1180), y: e.y }, 'crawler', 'bat');
      }
      if (this.random() < 0.16)
        this.pickups.push({ id: this.nextId++, x: e.x, y: e.y, kind: 'health', age: 0 });
    }
    const old = this.enemies.length;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (old > 0 && this.enemies.length === 0 && this.queue.length === 0) this.waveDelay = 1.6;
  }
  private lineClear(a: Vec, b: Vec) {
    return !this.level.obstacles.some((r) => segmentRect(a, b, r, 12));
  }
  private buildFlow() {
    const cols = 32,
      rows = 20,
      cell = 40,
      total = cols * rows;
    const blocked = Array.from({ length: total }, (_, i) => {
      const p = { x: (i % cols) * cell + 20, y: Math.floor(i / cols) * cell + 20 };
      return (
        p.x < 80 ||
        p.x > 1200 ||
        p.y < 80 ||
        p.y > 720 ||
        this.level.obstacles.some((b) => circleRect(p, 25, b))
      );
    });
    this.flow = new Array(total).fill(Infinity);
    const start =
      clamp(Math.floor(this.player.y / cell), 0, rows - 1) * cols +
      clamp(Math.floor(this.player.x / cell), 0, cols - 1);
    this.flow[start] = 0;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (const n of [i - 1, i + 1, i - cols, i + cols]) {
        if (
          n < 0 ||
          n >= total ||
          Math.abs((n % cols) - (i % cols)) > 1 ||
          blocked[n] ||
          this.flow[n] !== Infinity
        )
          continue;
        this.flow[n] = this.flow[i] + 1;
        queue.push(n);
      }
    }
  }
  private directionTo(a: Vec, b: Vec): Vec {
    if (this.lineClear(a, b)) return normalize({ x: b.x - a.x, y: b.y - a.y });
    const cols = 32,
      i = clamp(Math.floor(a.y / 40), 0, 19) * cols + clamp(Math.floor(a.x / 40), 0, 31);
    let best = i;
    for (const n of [i - 1, i + 1, i - cols, i + cols])
      if (
        n >= 0 &&
        n < 640 &&
        Math.abs((n % cols) - (i % cols)) <= 1 &&
        this.flow[n] < this.flow[best]
      )
        best = n;
    if (best === i) return normalize({ x: b.x - a.x, y: b.y - a.y });
    return normalize({
      x: (best % cols) * 40 + 20 - a.x,
      y: Math.floor(best / cols) * 40 + 20 - a.y,
    });
  }
}
