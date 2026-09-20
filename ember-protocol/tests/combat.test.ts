import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/simulation.ts';
import { LEVELS, WEAPONS, WORLD } from '../src/game/config.ts';
import {
  circleRect,
  distance,
  seededRandom,
  segmentCircle,
  segmentRect,
} from '../src/game/math.ts';
import type { Enemy, InputState } from '../src/game/types.ts';

const idle: InputState = {
  move: { x: 0, y: 0 },
  aim: { x: 950, y: 445 },
  firing: false,
  dash: false,
  reload: false,
  interact: false,
};
function game() {
  const m = new Simulation(seededRandom(123));
  m.start();
  m.waveDelay = 100;
  m.barrels = [];
  return m;
}
function step(m: Simulation, seconds: number, input: Partial<InputState> = {}) {
  for (let t = 0; t < seconds; t += 1 / 60) m.tick(1 / 60, { ...idle, ...input });
}
/** Force a room into its cleared state so the clear branch runs on the next tick. */
function clearRoom(m: Simulation) {
  m.enemies = [];
  m.queue = [];
  m.waveIndex = m.level.waves.length;
  m.waveDelay = 0;
}
function enemy(x = 760, y = 445, kind: Enemy['kind'] = 'crawler'): Enemy {
  return {
    id: 900,
    x,
    y,
    kind,
    hp: 500,
    maxHp: 500,
    radius: 20,
    angle: 0,
    cooldown: 100,
    slow: 0,
    flash: 0,
    age: 10,
    windup: 0,
    target: { x: 0, y: 0 },
    charge: 0,
  };
}

test('continuous collision detects fast bullets passing through targets and cover', () => {
  assert.equal(segmentCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 3), true);
  assert.equal(segmentCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 8 }, 3), false);
  assert.equal(
    segmentRect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 40, y: -10, w: 10, h: 20 }),
    true,
  );
});
test('diagonal movement is normalized to the same speed', () => {
  const a = game(),
    b = game();
  const start = { ...a.player };
  step(a, 0.3, { move: { x: 1, y: 0 } });
  step(b, 0.3, { move: { x: 1, y: 1 } });
  assert.ok(Math.abs(distance(a.player, start) - distance(b.player, start)) < 0.001);
});
test('dash cannot cross solid cover or the arena boundary', () => {
  const m = game();
  m.player.x = 440;
  m.player.y = 260;
  m.tick(1 / 60, { ...idle, move: { x: -1, y: 0 }, dash: true });
  step(m, 0.3, { move: { x: -1, y: 0 } });
  assert.ok(!m.level.obstacles.some((b) => circleRect(m.player, 17, b)));
  assert.ok(m.player.x >= 436);
  m.player.x = 85;
  step(m, 1, { move: { x: -1, y: 0 } });
  assert.ok(m.player.x >= 79);
});
test('a shot consumes ammunition, hits a monster, then reload restores the magazine', () => {
  const m = game(),
    e = enemy();
  m.enemies = [e];
  m.tick(1 / 60, { ...idle, firing: true });
  step(m, 0.15);
  assert.equal(m.player.ammo, 29);
  assert.ok(e.hp < 500);
  m.tick(1 / 60, { ...idle, reload: true });
  step(m, 1.3);
  assert.equal(m.player.ammo, 30);
  assert.equal(m.player.reloadRemaining, 0);
});
test('paused and upgrade states freeze combat and input', () => {
  const m = game();
  m.paused = true;
  const before = { ...m.player };
  step(m, 2, { move: { x: 1, y: 0 }, firing: true });
  assert.deepEqual(m.player, before);
  m.paused = false;
  m.phase = 'upgrade';
  step(m, 2, { move: { x: 1, y: 0 }, firing: true });
  assert.deepEqual(m.player, before);
});
test('the starting weapon choice configures the whole run and refills its own magazine', () => {
  const rifleRun = game();
  assert.equal(rifleRun.player.weapon, 'rifle');
  assert.equal(rifleRun.player.ammo, WEAPONS.rifle.magazine);
  const flamerRun = new Simulation(seededRandom(123));
  flamerRun.start(false, 'flamer');
  flamerRun.waveDelay = 100;
  flamerRun.barrels = [];
  assert.equal(flamerRun.player.weapon, 'flamer');
  assert.equal(flamerRun.player.ammo, WEAPONS.flamer.magazine);
  const e = enemy(760, 445);
  flamerRun.enemies = [e];
  step(flamerRun, 0.25, { firing: true });
  assert.ok(flamerRun.player.ammo < WEAPONS.flamer.magazine);
  assert.ok(e.hp < 500);
  assert.ok(
    flamerRun.bullets.every((b) => b.enemy || b.flame),
    'flamer projectiles must be flagged as flame particles',
  );
  // Flame particles die at the flamer's short range instead of crossing the arena.
  assert.ok(
    flamerRun.bullets.every(
      (b) => b.enemy || Math.hypot(b.vx, b.vy) * b.ttl <= WEAPONS.flamer.range,
    ),
  );
  flamerRun.tick(1 / 60, { ...idle, reload: true });
  assert.ok(flamerRun.player.reloadRemaining > 0);
});
test('room clear auto-opens the two-axis choice without any pickup (#49)', () => {
  const m = game();
  clearRoom(m);
  m.tick(1 / 60, idle);
  assert.equal(m.phase, 'upgrade');
  assert.equal(m.options.length, 2);
  const [first, second] = m.options.map((o) => o.id);
  assert.notEqual(first, second);
  // The offer stays stable until a choice is made.
  assert.deepEqual(
    m.options.map((o) => o.id),
    [first, second],
  );
  m.chooseUpgrade(first);
  assert.equal(m.phase, 'exit');
  assert.deepEqual(m.upgrades, [first]);
  m.chooseUpgrade(first);
  assert.equal(m.upgrades.length, 1);
});
test('every axis pick DOUBLES the stat: 2^stacks per weapon mapping (#49)', () => {
  const m = game();
  // rifle: shots double the streams, pierce doubles the pierce count
  m.upgrades = ['shots', 'shots', 'damage', 'rate', 'pierce', 'mag'];
  const rifle = m.stats;
  assert.equal(rifle.pellets, WEAPONS.rifle.pellets * 4);
  assert.ok(Math.abs(rifle.damage - WEAPONS.rifle.damage * 2) < 1e-9);
  assert.ok(Math.abs(rifle.interval - WEAPONS.rifle.interval / 2) < 1e-9);
  assert.equal(rifle.magazine, WEAPONS.rifle.magazine * 2);
  assert.equal(m.pierceCount, 2);
  // flamer: shots double the cone, pierce doubles range, never bullet-pierce
  const flamerRun = new Simulation(seededRandom(5));
  flamerRun.start(false, 'flamer');
  flamerRun.upgrades = ['shots', 'shots', 'pierce'];
  const flamer = flamerRun.stats;
  assert.ok(Math.abs(flamer.spread - WEAPONS.flamer.spread * 4) < 1e-9);
  assert.ok(Math.abs(flamer.range - WEAPONS.flamer.range * 2) < 1e-9);
  assert.equal(flamerRun.pierceCount, 0);
  assert.equal(flamer.pellets, WEAPONS.flamer.pellets);
});
test('rifle pierce upgrades let one bullet hit aligned targets', () => {
  const m = game();
  m.upgrades = ['pierce'];
  const a = enemy(725),
    b = enemy(800);
  b.id = 901;
  m.enemies = [a, b];
  m.tick(1 / 60, { ...idle, firing: true });
  step(m, 0.24);
  assert.ok(a.hp < 500 && b.hp < 500, 'both aligned targets must take damage');
});
test('explosive barrels damage enemies and chain to adjacent barrels', () => {
  const m = game();
  m.barrels = [
    { id: 11, x: 725, y: 445, hp: 20 },
    { id: 12, x: 790, y: 445, hp: 35 },
  ];
  m.enemies = [enemy(820, 460)];
  m.tick(1 / 60, { ...idle, firing: true });
  step(m, 0.17);
  assert.equal(m.barrels.length, 0);
  assert.ok(m.enemies[0].hp < 500);
});
test('new rooms refill health, ammunition and dash while retaining chosen build', () => {
  const m = game();
  m.upgrades = ['damage'];
  m.player.weapon = 'flamer';
  m.player.hp = 12;
  m.player.ammo = 1;
  m.player.dashCooldown = 2;
  m.phase = 'exit';
  m.nextLevel();
  assert.equal(m.levelIndex, 1);
  assert.equal(m.player.hp, 100);
  assert.equal(m.player.ammo, WEAPONS.flamer.magazine);
  assert.equal(m.player.dashCooldown, 0);
  assert.deepEqual(m.upgrades, ['damage']);
});
test('AI partner fires at visible enemies; defeat is final until restart', () => {
  const m = game();
  m.squad = true;
  m.enemies = [enemy(700, 500)];
  step(m, 0.3);
  assert.ok(m.bullets.some((b) => b.owner === 'ally') || m.enemies[0].hp < 500);
  m.player.hp = 0;
  m.tick(1 / 60, idle);
  assert.equal(m.phase, 'lost');
  step(m, 1, { firing: true });
  assert.equal(m.phase, 'lost');
  m.start();
  assert.equal(m.player.hp, 100);
  assert.equal(m.kills, 0);
  assert.equal(m.phase, 'combat');
});
test('all six waves, boss, modules and exits form a complete three-room campaign', () => {
  const m = game();
  m.waveDelay = 0;
  // High-health fixture isolates progression correctness from player skill/balance.
  m.player.maxHp = 100000;
  m.player.hp = 100000;
  let reachedBoss = false,
    roomExits = 0;
  for (let frame = 0; frame < 60 * 360 && m.phase !== 'won'; frame++) {
    if (m.phase === 'upgrade') {
      m.chooseUpgrade(m.options[0].id);
      m.player.x = 640;
      m.player.y = 445;
      continue;
    }
    if (m.phase === 'bossSelect') {
      m.chooseBoss('flower');
      continue;
    }
    if (m.phase === 'exit') {
      roomExits++;
      m.player.x = 1160;
      m.player.y = 400;
      m.tick(1 / 60, { ...idle, interact: true });
      continue;
    }
    const targets = m.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => distance(m.player, a) - distance(m.player, b));
    if (m.boss) reachedBoss = true;
    m.tick(1 / 60, { ...idle, aim: targets[0] ?? idle.aim, firing: true });
  }
  assert.equal(
    m.phase,
    'won',
    `stuck at room ${m.levelIndex + 1}, wave ${m.waveIndex}, remaining ${m.remaining}, enemies: ${JSON.stringify(m.enemies.map((e) => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp })))}`,
  );
  assert.equal(roomExits, 4);
  assert.equal(reachedBoss, true);
  // Power-fantasy waves: 15 + 26 + 30 + 19 base enemies; splits and summons only add.
  assert.ok(m.kills >= 90, `expected at least 90 kills, got ${m.kills}`);
  // Four rooms currently: crates spawn after rooms 1-3 (cap 5, spec #24).
  assert.equal(m.upgrades.length, 3);
});

test('every room keeps the spawn and portal clear of cover and reachable', () => {
  // Adding or editing a room must never bury a spawn point behind cover.
  const spawn: Vec = { x: 640, y: 445 };
  const portal: Vec = { x: 1160, y: 400 };
  const bossSpawn: Vec = { x: 640, y: 190 };
  const enemySpawns: Vec[] = [
    { x: 135, y: 160 },
    { x: 640, y: 115 },
    { x: 1145, y: 160 },
    { x: 1145, y: 650 },
    { x: 640, y: 690 },
    { x: 135, y: 650 },
  ];
  const clearOf = (level: (typeof LEVELS)[number], p: Vec, r: number) =>
    !level.obstacles.some((b) => circleRect(p, r, b));
  const reachable = (level: (typeof LEVELS)[number], from: Vec, to: Vec, tolerance = 40) => {
    const step = 20;
    const free = (p: Vec) =>
      p.x >= 80 &&
      p.x <= 1200 &&
      p.y >= 80 &&
      p.y <= 720 &&
      !level.obstacles.some((b) => circleRect(p, 17, b));
    const seen = new Set(['640,445']);
    const queue: Vec[] = [from];
    while (queue.length) {
      const p = queue.shift()!;
      if (distance(p, to) <= tolerance) return true;
      for (const d of [
        { x: step, y: 0 },
        { x: -step, y: 0 },
        { x: 0, y: step },
        { x: 0, y: -step },
      ]) {
        const next = { x: p.x + d.x, y: p.y + d.y };
        const key = `${next.x},${next.y}`;
        if (seen.has(key) || !free(next)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return false;
  };
  LEVELS.forEach((level, index) => {
    const room = `room ${index + 1}`;
    assert.ok(clearOf(level, spawn, 17), `${room} player spawn is inside cover`);
    assert.ok(clearOf(level, portal, 17), `${room} portal is inside cover`);
    for (const point of enemySpawns)
      assert.ok(clearOf(level, point, 31), `${room} enemy spawn is inside cover`);
    assert.ok(reachable(level, spawn, portal), `${room} portal is unreachable`);
    if (index === LEVELS.length - 1)
      assert.ok(clearOf(level, bossSpawn, 58), 'boss spawn is inside cover');
  });
});

test('contact enemies remain outside the muzzle and can be shot at point-blank range', () => {
  const m = game();
  const e = enemy(m.player.x + 1, m.player.y);
  e.hp = 40;
  m.enemies = [e];
  for (let frame = 0; frame < 60; frame++)
    m.tick(1 / 60, { ...idle, aim: { x: e.x, y: e.y }, firing: true });
  assert.equal(m.kills, 1);
});

test('auto-offers draw two distinct axes and the whole pool is reachable', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const m = new Simulation(seededRandom(seed));
    m.start();
    m.waveDelay = 100;
    clearRoom(m);
    m.tick(1 / 60, idle);
    assert.equal(m.phase, 'upgrade');
    const first = m.options.map((o) => o.id);
    assert.equal(first.length, 2);
    assert.notEqual(first[0], first[1]);
    first.forEach((id) => seen.add(id));
    m.chooseUpgrade(first[0]);
    assert.equal(m.offeredUpgrades.length, 0);
  }
  // Every axis shows up across seeds, so no axis can be starved by RNG.
  assert.equal(seen.size, 5);
});

test('knockback pushes hit enemies back without wedging them into cover', () => {
  const m = game();
  m.waveDelay = 100;
  const e = enemy(760, 445, 'crawler');
  e.hp = 100000;
  e.maxHp = 100000;
  e.cooldown = 1000000;
  m.enemies = [e];
  const startX = e.x;
  let pushedBack = false;
  for (let frame = 0; frame < 180; frame++) {
    m.tick(1 / 60, { ...idle, aim: { x: e.x, y: e.y }, firing: true });
    assert.ok(
      !m.level.obstacles.some((b) => circleRect(e, e.radius - 0.5, b)),
      `knockback pushed an enemy into cover at ${e.x},${e.y}`,
    );
    assert.ok(
      e.x >= WORLD.inset - 1 &&
        e.x <= WORLD.width - WORLD.inset + 1 &&
        e.y >= WORLD.inset - 1 &&
        e.y <= WORLD.height - WORLD.inset + 1,
      `knockback pushed an enemy out of the arena at ${e.x},${e.y}`,
    );
    if (e.x > startX + 8) pushedBack = true;
  }
  assert.ok(pushedBack, 'a hit should visibly push the enemy along the bullet');
});

test('kill hitstop is short, bounded and never accumulates across kills', () => {
  const m = game();
  m.waveDelay = 100;
  for (const kind of ['crawler', 'spitter', 'brute'] as const) {
    const e = enemy(700, 445, kind);
    e.hp = 1;
    e.maxHp = 1;
    e.cooldown = 1000000;
    m.enemies = [e];
    m.freeze = 0;
    for (let frame = 0; frame < 40 && m.freeze === 0; frame++)
      m.tick(1 / 60, { ...idle, aim: { x: e.x, y: e.y }, firing: true });
    assert.ok(m.freeze > 0, `${kind} kill should trigger a hitstop`);
    assert.ok(m.freeze <= 0.09 + 1e-9, `${kind} hitstop too long: ${m.freeze}`);
    // The world resumes once the freeze budget is spent.
    for (let frame = 0; frame < 10; frame++) m.tick(1 / 60, idle);
    assert.equal(m.freeze, 0);
  }
});

test('training mode is a safe sandbox: no damage, dummies respawn, drills are tracked', () => {
  const m = new Simulation(seededRandom(7));
  m.beginTraining();
  assert.equal(m.training, true);
  assert.equal(m.phase, 'combat');
  assert.ok(m.player.invincible > 0, 'player is invincible in training');
  assert.ok(m.enemies.length >= 3, 'training spawns stationary dummies');
  // Firing marks the shoot drill and never harms the player.
  step(m, 0.3, { firing: true });
  assert.ok(m.trainingDone.has('shoot'));
  assert.equal(m.player.hp, m.player.maxHp);
  // Dashing marks the dash drill.
  m.tick(1 / 60, { ...idle, move: { x: 1, y: 0 }, dash: true });
  assert.ok(m.trainingDone.has('dash'));
  // Weapon pickups and Q-switching were removed by the starting-weapon rework;
  // reloading is the remaining weapon-handling drill.
  m.player.ammo = 1;
  m.tick(1 / 60, { ...idle, reload: true });
  assert.ok(m.trainingDone.has('reload'));
  // Dummies that reach 0 hp respawn instead of vanishing.
  for (const e of m.enemies) {
    e.hp = 0;
    e.deathHandled = false;
  }
  m.tick(1 / 60, idle);
  assert.equal(
    m.enemies.filter((e) => e.hp > 0).length,
    m.enemies.length,
    'training dummies respawn',
  );
  // Leaving training returns to the menu.
  m.endTraining();
  assert.equal(m.training, false);
  assert.equal(m.phase, 'menu');
});

test('sector-1 hint sequence: firing then dashing is tracked so coach can switch fire -> dash hints', () => {
  const m = game();
  assert.equal(m.shotsFired, 0);
  assert.equal(m.dashed, false);
  // Firing sets the fire flag (drives the "hold left mouse to fire" hint).
  step(m, 0.3, { firing: true });
  assert.ok(m.shotsFired > 0, 'shotsFired increments after firing');
  assert.equal(m.dashed, false, 'dash flag stays false until a real dash');
  // Dashing sets the dash flag (drives the "press space to dash" hint).
  m.tick(1 / 60, { ...idle, move: { x: 1, y: 0 }, dash: true });
  assert.equal(m.dashed, true, 'dashed flips true on first dash');
  // A fresh run resets both flags.
  m.start();
  assert.equal(m.shotsFired, 0);
  assert.equal(m.dashed, false);
});
