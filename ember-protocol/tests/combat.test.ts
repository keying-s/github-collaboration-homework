import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/simulation.ts';
import { LEVELS, WEAPONS } from '../src/game/config.ts';
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
  switchWeapon: false,
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
test('pickup changes weapon and can switch back without losing inventory', () => {
  const m = game();
  m.player.x = 494;
  m.player.y = 425;
  m.tick(1 / 60, { ...idle, interact: true });
  assert.equal(m.player.weapon, 'shotgun');
  assert.equal(m.player.ammo, 8);
  assert.deepEqual(m.inventory, ['rifle', 'shotgun']);
  m.tick(1 / 60, { ...idle, switchWeapon: true });
  assert.equal(m.player.weapon, 'rifle');
  assert.ok(m.player.reloadRemaining > 0);
});
test('module pickup freezes combat; choice applies once and resumes combat', () => {
  const m = game();
  m.pickups = [{ id: 100, x: m.player.x, y: m.player.y, kind: 'module', age: 0 }];
  m.tick(1 / 60, { ...idle, interact: true });
  assert.equal(m.phase, 'upgrade');
  const chosen = m.options[0].id;
  m.chooseSkill(chosen);
  assert.equal(m.phase, 'combat');
  assert.deepEqual(m.skills, [chosen]);
  m.chooseSkill(chosen);
  assert.equal(m.skills.length, 1);
});
test('cryo slows enemies and pierce hits multiple aligned targets', () => {
  const m = game();
  m.skills = ['cryo', 'pierce'];
  const a = enemy(725),
    b = enemy(800);
  b.id = 901;
  m.enemies = [a, b];
  m.tick(1 / 60, { ...idle, firing: true });
  step(m, 0.24);
  assert.ok(a.hp < 500 && b.hp < 500);
  assert.ok(a.slow > 0 && b.slow > 0);
});
test('every third player hit chains to nearby enemies', () => {
  const m = game();
  m.skills = ['chain'];
  m.enemies = [enemy(740), { ...enemy(780, 510), id: 901 }];
  step(m, 0.42, { firing: true });
  assert.ok(m.drainEvents().some((e) => e.type === 'chain'));
});
test('nova gives dash area damage, leech heals on a kill, haste accelerates reload', () => {
  const m = game();
  m.skills = ['nova', 'leech', 'haste'];
  m.player.hp = 60;
  const e = enemy(710);
  e.hp = 20;
  m.enemies = [e];
  m.tick(1 / 60, { ...idle, dash: true, move: { x: -1, y: 0 } });
  assert.equal(m.kills, 1);
  assert.equal(m.player.hp, 63);
  assert.equal(m.player.dashCooldown, 1.65);
  m.player.ammo = 1;
  m.tick(1 / 60, { ...idle, reload: true });
  assert.ok(m.player.reloadRemaining < WEAPONS.rifle.reload);
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
  m.skills = ['chain'];
  m.player.weapon = 'shotgun';
  m.inventory.push('shotgun');
  m.player.hp = 12;
  m.player.ammo = 1;
  m.player.dashCooldown = 2;
  m.phase = 'exit';
  m.nextLevel();
  assert.equal(m.levelIndex, 1);
  assert.equal(m.player.hp, 100);
  assert.equal(m.player.ammo, 8);
  assert.equal(m.player.dashCooldown, 0);
  assert.deepEqual(m.skills, ['chain']);
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
      m.chooseSkill(m.options[0].id);
      m.player.x = 640;
      m.player.y = 445;
      continue;
    }
    const module = m.pickups.find((p) => p.kind === 'module');
    if (module && m.skills.length < 4) {
      m.player.x = module.x;
      m.player.y = module.y;
      m.tick(1 / 60, { ...idle, interact: true });
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
  assert.equal(m.kills, 60);
  assert.equal(m.skills.length, 4);
});

test('every room keeps the spawn, weapon drop and portal clear of cover and reachable', () => {
  // Adding or editing a room must never bury a spawn point behind cover.
  const spawn: Vec = { x: 640, y: 445 };
  const weaponDrop: Vec = { x: 494, y: 425 };
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
  const reachable = (level: (typeof LEVELS)[number], from: Vec, to: Vec) => {
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
      if (distance(p, to) <= step * 2) return true;
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
    assert.ok(clearOf(level, weaponDrop, 17), `${room} weapon drop is inside cover`);
    assert.ok(clearOf(level, portal, 17), `${room} portal is inside cover`);
    for (const point of enemySpawns)
      assert.ok(clearOf(level, point, 31), `${room} enemy spawn is inside cover`);
    assert.ok(reachable(level, spawn, weaponDrop), `${room} weapon drop is unreachable`);
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

test('random module drafts can offer all six skills, stay stable and never repeat owned skills', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const m = new Simulation(seededRandom(seed));
    m.start();
    m.waveDelay = 100;
    m.pickups = [{ id: 99, x: m.player.x, y: m.player.y, kind: 'module', age: 0 }];
    m.tick(1 / 60, { ...idle, interact: true });
    const first = m.options.map((s) => s.id);
    assert.equal(first.length, 3);
    assert.deepEqual(
      m.options.map((s) => s.id),
      first,
    );
    first.forEach((id) => seen.add(id));
    m.chooseSkill(first[0]);
    assert.ok(!m.options.some((s) => s.id === first[0]));
  }
  assert.equal(seen.size, 6);
});
