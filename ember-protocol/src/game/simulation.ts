import { LEVELS, SKILLS, WEAPONS, WORLD } from './config';
import { circleRect, clamp, distance, normalize, segmentCircle, segmentRect } from './math';
import type {
  Barrel,
  Bullet,
  Enemy,
  EnemyKind,
  GameEvent,
  InputState,
  Phase,
  Pickup,
  Player,
  SkillId,
  StatusMessage,
  Vec,
  WeaponId,
} from './types';

const RADII = { crawler: 20, spitter: 23, brute: 31, boss: 58 };
const HP = { crawler: 48, spitter: 66, brute: 185, boss: 1250 };
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
  skills: SkillId[] = [];
  events: GameEvent[] = [];
  kills = 0;
  elapsed = 0;
  combo = 0;
  bestCombo = 0;
  comboTime = 0;
  damageTaken = 0;
  hint: StatusMessage = { key: 'stateReady' };
  waveDelay = 1.5;
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private nextId = 1;
  private hitCount = 0;
  private flow: number[] = [];
  private flowTimer = 0;
  private upgradeSource: 'field' | 'clear' = 'field';
  private fieldModuleDropped = false;
  private roomKills = 0;
  private offeredSkills: SkillId[] = [];
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
    if (this.skills.length >= 4) return [];
    const available = SKILLS.filter((s) => !this.skills.includes(s.id));
    return this.offeredSkills.length
      ? this.offeredSkills.map((id) => available.find((s) => s.id === id)!).filter(Boolean)
      : available.slice(0, 3);
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
    this.skills = [];
    this.offeredSkills = [];
    this.player = this.newPlayer();
    this.player.weapon = weapon;
    this.kills = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.damageTaken = 0;
    this.hitCount = 0;
    this.levelIndex = 0;
    this.paused = false;
    this.phase = 'combat';
    this.prepareRoom();
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
    this.roomKills = 0;
    this.fieldModuleDropped = false;
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
    this.phase = 'combat';
    this.prepareRoom();
  }
  chooseSkill(id: SkillId) {
    if (this.phase !== 'upgrade' || !this.options.some((s) => s.id === id)) return;
    this.skills.push(id);
    this.emit('pickup', this.player, {
      text: SKILLS.find((s) => s.id === id)!.name,
      color: 0xade3b7,
    });
    this.offeredSkills = [];
    this.phase = this.upgradeSource === 'clear' ? 'exit' : 'combat';
    this.hint = { key: this.phase === 'exit' ? 'portalReady' : 'skillActive' };
    this.player.invincible = 1.2;
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
    if (this.phase === 'combat') this.elapsed += dt;
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    this.updatePlayer(dt, input);
    if (this.phase !== 'combat' && this.phase !== 'exit') return;
    this.pickups.forEach((p) => (p.age += dt));
    this.updateAlly(dt);
    if (this.phase === 'combat') {
      this.updateWaves(dt);
      this.flowTimer -= dt;
      if (this.flowTimer <= 0) {
        this.buildFlow();
        this.flowTimer = 0.4;
      }
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.cleanupEnemies();
    }
    if (this.player.hp <= 0) {
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
        p.ammo = this.weapon.magazine;
      }
    }
    if (input.reload) this.reload();
    const move = normalize(input.move);
    p.moving = move.x !== 0 || move.y !== 0;
    if (input.dash && p.dashCooldown <= 0) {
      p.dashDirection = p.moving ? move : { x: Math.cos(p.angle), y: Math.sin(p.angle) };
      p.dashRemaining = 0.17;
      p.dashCooldown = this.skills.includes('nova') ? 1.65 : 2.2;
      p.invincible = 0.32;
      this.emit('dash', p, { color: 0xfab583 });
      if (this.skills.includes('nova')) this.explode({ ...p }, 145, 65, false);
    }
    if (p.dashRemaining > 0) {
      this.move(p, p.dashDirection, 840 * dt, 17);
      p.dashRemaining = Math.max(0, p.dashRemaining - dt);
    } else this.move(p, move, 245 * dt, 17);
    if (input.firing && this.phase === 'combat' && p.shotCooldown <= 0 && p.reloadRemaining <= 0) {
      if (p.ammo > 0) {
        this.fire(p, p.angle, p.weapon, 'player');
        p.ammo--;
        p.shotCooldown = this.weapon.interval / (this.skills.includes('haste') ? 1.25 : 1);
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
    if (input.interact) {
      const item = this.nearestPickup;
      if (item && distance(item, p) < 78) {
        this.pickups = this.pickups.filter((v) => v.id !== item.id);
        if (item.kind === 'module') {
          this.upgradeSource = this.phase === 'exit' ? 'clear' : 'field';
          const available = SKILLS.filter((s) => !this.skills.includes(s.id)).map((s) => s.id);
          for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
          }
          this.offeredSkills = available.slice(0, 3);
          if (this.options.length) this.phase = 'upgrade';
          this.emit('pickup', p, { color: 0xa5e0bd });
        }
      } else if (this.phase === 'exit' && distance(p, { x: 1160, y: 400 }) < 100) this.nextLevel();
    }
  }
  private reload() {
    if (this.player.reloadRemaining > 0 || this.player.ammo === this.weapon.magazine) return;
    this.player.reloadRemaining = this.weapon.reload * (this.skills.includes('haste') ? 0.7 : 1);
    this.emit('reload', this.player);
  }
  private move(p: Vec, d: Vec, amount: number, r: number) {
    const edge = WORLD.inset + r;
    const nx = clamp(p.x + d.x * amount, edge, WORLD.width - edge);
    if (!this.level.obstacles.some((b) => circleRect({ x: nx, y: p.y }, r, b))) p.x = nx;
    const ny = clamp(p.y + d.y * amount, edge, WORLD.height - edge);
    if (!this.level.obstacles.some((b) => circleRect({ x: p.x, y: ny }, r, b))) p.y = ny;
  }
  private fire(p: Vec, angle: number, id: WeaponId, owner: 'player' | 'ally') {
    const w = WEAPONS[id],
      isPlayer = owner === 'player',
      isFlame = id === 'flamer';
    for (let i = 0; i < w.pellets; i++) {
      const a =
        angle +
        (w.pellets > 1
          ? (i / (w.pellets - 1) - 0.5) * w.spread * 2
          : (this.random() - 0.5) * w.spread);
      let damage = w.damage * (isPlayer ? 1 : 0.48);
      if (isPlayer && this.skills.includes('pierce')) damage *= 1.15;
      if (isPlayer && this.skills.includes('leech') && this.player.hp < 50) damage *= 1.3;
      this.bullets.push({
        id: this.nextId++,
        x: p.x + Math.cos(angle) * 29,
        y: p.y + Math.sin(angle) * 29,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        damage,
        ttl: w.range / w.speed,
        enemy: false,
        radius: isFlame ? 5 : 3,
        color: isPlayer ? w.color : 0xa5e1cf,
        pierce: isPlayer && this.skills.includes('pierce') && !isFlame ? 2 : 0,
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
      this.phase = 'exit';
      this.hint = { key: this.isLastLevel ? 'finalPortal' : 'clearPortal' };
      if (!this.isLastLevel && this.options.length)
        this.pickups.push({ id: this.nextId++, x: 640, y: 365, kind: 'module', age: 0 });
      this.emit(
        'clear',
        { x: 640, y: 365 },
        {
          text: { zh: '区域肃清', en: 'AREA CLEARED' },
        },
      );
    }
  }
  private spawn(kind: EnemyKind) {
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
    if (kind === 'boss') p = { x: 640, y: 190 };
    const hp = HP[kind] * (this.squad ? 1.2 : 1);
    this.enemies.push({
      ...p,
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      radius: RADII[kind],
      angle: 0,
      cooldown: 1.1 + this.random(),
      slow: 0,
      flash: 0,
      age: 0,
      windup: 0,
      target: { ...this.player },
      charge: 0,
    });
  }
  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
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
          if (e.kind === 'boss') {
            const phase = e.hp < e.maxHp / 2;
            const count = phase ? 18 : 12;
            for (let i = 0; i < count; i++)
              this.enemyBullet(e, (i / count) * Math.PI * 2 + e.age * 0.3, phase ? 195 : 165);
            e.cooldown = phase ? 1.6 : 2.5;
            this.emit('explosion', e, { color: 0xe89aaa, value: 65 });
          }
        }
      } else if (e.charge > 0) {
        this.move(e, normalize({ x: e.target.x - e.x, y: e.target.y - e.y }), 470 * dt, e.radius);
        e.charge -= dt;
      } else if (e.kind === 'spitter') {
        if (d > 310 || !this.lineClear(e, this.player))
          this.move(e, this.directionTo(e, this.player), 70 * slow * dt, e.radius);
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
          e.cooldown = 3.6;
        } else this.move(e, this.directionTo(e, this.player), 62 * slow * dt, e.radius);
      } else if (e.kind === 'boss') {
        if (e.cooldown <= 0) {
          e.windup = 1.0;
          e.target = { ...this.player };
        }
        if (d > 220) this.move(e, this.directionTo(e, this.player), 26 * slow * dt, e.radius);
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
          this.move(e, n, 35 * dt, e.radius);
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
  private enemyBullet(e: Enemy, a: number, speed: number) {
    this.bullets.push({
      id: this.nextId++,
      x: e.x + Math.cos(a) * (e.radius + 8),
      y: e.y + Math.sin(a) * (e.radius + 8),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage: 10,
      ttl: 5,
      enemy: true,
      radius: 6,
      color: 0xf19bac,
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
        if (b.owner === 'player') {
          if (this.skills.includes('cryo')) e.slow = 1.8;
          this.hitCount++;
          if (this.skills.includes('chain') && this.hitCount % 3 === 0) {
            let source: Vec = e;
            const hit = new Set([e.id]);
            for (let j = 0; j < 2; j++) {
              const t = this.enemies
                .filter((v) => v.hp > 0 && !hit.has(v.id) && distance(source, v) < 210)
                .sort((a, c) => distance(source, a) - distance(source, c))[0];
              if (!t) break;
              this.emit('chain', source, { target: { x: t.x, y: t.y }, color: 0xb3eaf2 });
              this.damageEnemy(t, 24, 0xb3eaf2);
              hit.add(t.id);
              source = t;
            }
          }
        }
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
  private damageEnemy(e: Enemy, damage: number, color: number) {
    e.hp -= damage;
    e.flash = 0.08;
    this.emit('hit', e, { color, value: Math.round(damage) });
  }
  private explode(p: Vec, r: number, damage: number, hurtPlayer: boolean) {
    this.emit('explosion', p, { value: r, color: 0xf7b280 });
    for (const e of this.enemies)
      if (e.hp > 0 && distance(p, e) < r + e.radius) this.damageEnemy(e, damage, 0xf7b280);
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
      e.deathHandled = true;
      this.kills++;
      this.roomKills++;
      this.combo++;
      this.comboTime = 3.2;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.emit('kill', e, { color: e.kind === 'boss' ? 0xe8a1b4 : 0x94c598, value: e.radius });
      if (this.skills.includes('leech'))
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      if (this.random() < 0.16)
        this.pickups.push({ id: this.nextId++, x: e.x, y: e.y, kind: 'health', age: 0 });
      if (this.levelIndex < 2 && this.roomKills >= 5 && !this.fieldModuleDropped) {
        this.fieldModuleDropped = true;
        this.pickups.push({ id: this.nextId++, x: e.x, y: e.y, kind: 'module', age: 0 });
        this.hint = { key: 'moduleFound' };
      }
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
