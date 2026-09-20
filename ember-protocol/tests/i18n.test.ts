import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, UPGRADES, WEAPONS } from '../src/game/config';
import type { LocalizedText } from '../src/game/types';
import { localize, TRANSLATIONS } from '../src/i18n';

function assertBilingual(value: LocalizedText, label: string) {
  assert.ok(value.zh.trim(), `${label} is missing Chinese text`);
  assert.ok(value.en.trim(), `${label} is missing English text`);
  assert.equal(localize(value, 'zh-CN'), value.zh);
  assert.equal(localize(value, 'en'), value.en);
}

test('every configured level, weapon and upgrade axis has Chinese and English copy', () => {
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    assertBilingual(weapon.name, `weapon ${id} name`);
    assertBilingual(weapon.label, `weapon ${id} label`);
    assertBilingual(weapon.description, `weapon ${id} description`);
  }
  for (const option of UPGRADES) {
    assertBilingual(option.label, `upgrade ${option.id} label`);
    assertBilingual(option.effect, `upgrade ${option.id} effect`);
  }
  for (const [index, level] of LEVELS.entries()) {
    assertBilingual(level.name, `level ${index + 1} name`);
    assertBilingual(level.subtitle, `level ${index + 1} subtitle`);
  }
});

test('the UI catalogs expose the same keys and interpolation variables', () => {
  const chineseKeys = Object.keys(TRANSLATIONS['zh-CN']).sort();
  const englishKeys = Object.keys(TRANSLATIONS.en).sort();
  assert.deepEqual(englishKeys, chineseKeys);

  const variables = (value: string) =>
    [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
  for (const key of chineseKeys) {
    const translationKey = key as keyof (typeof TRANSLATIONS)['zh-CN'];
    assert.deepEqual(
      variables(TRANSLATIONS.en[translationKey]),
      variables(TRANSLATIONS['zh-CN'][translationKey]),
      `${key} must use the same variables in both languages`,
    );
  }
});
