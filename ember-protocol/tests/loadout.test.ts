import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/simulation.ts';
import { WEAPONS } from '../src/game/config.ts';
import { seededRandom } from '../src/game/math.ts';
import type { InputState } from '../src/game/types.ts';

const idle: InputState = {
  move: { x: 0, y: 0 },
  aim: { x: 950, y: 445 },
  firing: false,
  dash: false,
  reload: false,
  interact: false,
  switchWeapon: false,
};

test('the run starts with the selected weapon and its full magazine', () => {
  for (const weapon of Object.values(WEAPONS)) {
    const model = new Simulation(seededRandom(7));
    model.start(false, weapon.id);
    assert.deepEqual(model.inventory, [weapon.id]);
    assert.equal(model.player.weapon, weapon.id);
    assert.equal(model.player.ammo, weapon.magazine);
    assert.equal(model.player.maxHp, 100);
  }
});

test('starting without a choice keeps the historical rifle loadout', () => {
  const solo = new Simulation(seededRandom(7));
  solo.start();
  assert.deepEqual(solo.inventory, ['rifle']);
  assert.equal(solo.player.weapon, 'rifle');
  assert.equal(solo.player.ammo, WEAPONS.rifle.magazine);

  const squad = new Simulation(seededRandom(7));
  squad.start(true);
  assert.equal(squad.player.weapon, 'rifle');
  assert.equal(squad.player.ammo, WEAPONS.rifle.magazine);
});

test('the selected starting weapon persists across rooms with unchanged restore rules', () => {
  const model = new Simulation(seededRandom(7));
  model.start(false, 'shotgun');
  model.player.ammo = 1;
  model.player.hp = 12;
  model.phase = 'exit';
  model.player.x = 1160;
  model.player.y = 400;
  model.tick(1 / 60, { ...idle, interact: true });
  assert.equal(model.levelIndex, 1);
  assert.equal(model.player.weapon, 'shotgun');
  assert.equal(model.player.ammo, WEAPONS.shotgun.magazine);
  assert.equal(model.player.hp, model.player.maxHp);
});
