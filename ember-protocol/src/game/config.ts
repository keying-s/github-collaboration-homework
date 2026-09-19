import type { Level, Skill, Weapon, WeaponId } from './types';

export const WORLD = { width: 1280, height: 800, inset: 62 };
export const WEAPONS: Record<WeaponId, Weapon> = {
  rifle: {
    id: 'rifle',
    name: { zh: '游骑兵', en: 'RANGER' },
    label: { zh: 'MK.01 / 突击步枪', en: 'MK.01 / ASSAULT RIFLE' },
    description: { zh: '稳定连射 · 中距离压制', en: 'STEADY AUTO FIRE · MID-RANGE CONTROL' },
    color: 0xf9bd7e,
    damage: 21,
    interval: 0.13,
    pellets: 1,
    spread: 0.035,
    speed: 920,
    magazine: 30,
    reload: 1.15,
    range: 760,
  },
  flamer: {
    id: 'flamer',
    name: { zh: '焚化者', en: 'INCINERATOR' },
    label: { zh: 'FL.02 / 喷火枪', en: 'FL.02 / FLAMETHROWER' },
    description: { zh: '锥形火焰 · 贴脸洗怪', en: 'CONE OF FIRE · POINT-BLANK PURGE' },
    color: 0xff8a5c,
    damage: 7,
    interval: 0.05,
    pellets: 1,
    spread: 0.3,
    speed: 620,
    magazine: 100,
    reload: 1.6,
    range: 230,
  },
};
export const SKILLS: Skill[] = [
  {
    id: 'chain',
    name: { zh: '连锁电弧', en: 'CHAIN ARC' },
    tag: { zh: '连锁 / 群体伤害', en: 'CHAIN / CROWD DAMAGE' },
    description: {
      zh: '每 3 次命中释放电弧，跳向附近 2 个敌人。霰弹命中也能触发。',
      en: 'Every third hit arcs to 2 nearby enemies. Shotgun pellets can trigger it.',
    },
    color: '#9ed6d7',
    icon: 'bolt',
  },
  {
    id: 'cryo',
    name: { zh: '霜冻弹芯', en: 'CRYO CORE' },
    tag: { zh: '控制 / 安全空间', en: 'CONTROL / SAFE SPACE' },
    description: {
      zh: '子弹使敌人减速 45%。拉开距离，让追击者变成活靶。',
      en: 'Shots slow enemies by 45%. Create distance and turn pursuers into targets.',
    },
    color: '#b5daef',
    icon: 'snow',
  },
  {
    id: 'pierce',
    name: { zh: '贯穿弹道', en: 'PIERCING TRAJECTORY' },
    tag: { zh: '穿透 / 火力效率', en: 'PIERCE / FIREPOWER EFFICIENCY' },
    description: {
      zh: '子弹额外穿透 2 个敌人，伤害提高 15%。在狭窄通道尤其有效。',
      en: 'Shots pierce 2 additional enemies and deal 15% more damage. Excels in corridors.',
    },
    color: '#d7bcf5',
    icon: 'arrow',
  },
  {
    id: 'nova',
    name: { zh: '闪避新星', en: 'DASH NOVA' },
    tag: { zh: '机动 / 爆发', en: 'MOBILITY / BURST' },
    description: {
      zh: '冲刺起点引发范围爆破，造成 65 点伤害。冲刺冷却缩短 25%。',
      en: 'Dashing detonates a 65-damage nova at the start and reduces dash cooldown by 25%.',
    },
    color: '#f6be91',
    icon: 'sun',
  },
  {
    id: 'leech',
    name: { zh: '战地修复', en: 'FIELD REPAIR' },
    tag: { zh: '续航 / 反击', en: 'SUSTAIN / COUNTERATTACK' },
    description: {
      zh: '每击败一个敌人恢复 3 点生命。生命低于一半时伤害提高 30%。',
      en: 'Restore 3 health per kill. Deal 30% more damage while below half health.',
    },
    color: '#b6ddae',
    icon: 'plus',
  },
  {
    id: 'haste',
    name: { zh: '过载机匣', en: 'OVERDRIVE MAG' },
    tag: { zh: '射速 / 节奏', en: 'FIRE RATE / TEMPO' },
    description: {
      zh: '射速提高 25%，换弹加快 30%。把持续火力变成你的优势。',
      en: 'Fire 25% faster and reload 30% faster. Turn sustained fire into an advantage.',
    },
    color: '#efce80',
    icon: 'fast',
  },
];
export const LEVELS: Level[] = [
  {
    name: { zh: '孢子中庭', en: 'THE OVERGROWN ATRIUM' },
    code: 'THE OVERGROWN ATRIUM',
    subtitle: {
      zh: '清除感染群，重新接通传送门',
      en: 'Clear the infected swarm and reconnect the gate',
    },
    accent: 0x91c9ac,
    floor: 0x263936,
    obstacles: [
      { x: 287, y: 232, w: 132, h: 66 },
      { x: 856, y: 484, w: 136, h: 68 },
      { x: 324, y: 510, w: 76, h: 94 },
      { x: 882, y: 212, w: 74, h: 92 },
    ],
    barrels: [
      { x: 450, y: 245 },
      { x: 825, y: 553 },
      { x: 945, y: 397 },
    ],
    waves: [
      ['crawler', 'crawler', 'crawler', 'spitter', 'crawler', 'crawler', 'spitter'],
      ['crawler', 'spitter', 'crawler', 'brute', 'crawler', 'spitter', 'crawler', 'crawler'],
    ],
  },
  {
    name: { zh: '冷却回廊', en: 'THE COOLANT PASSAGE' },
    code: 'THE COOLANT PASSAGE',
    subtitle: {
      zh: '利用掩体，突破重甲防线',
      en: 'Use cover and break through the armored line',
    },
    accent: 0x94bfd1,
    floor: 0x26363e,
    obstacles: [
      { x: 355, y: 175, w: 85, h: 140 },
      { x: 355, y: 492, w: 85, h: 135 },
      { x: 845, y: 175, w: 85, h: 140 },
      { x: 845, y: 492, w: 85, h: 135 },
      { x: 580, y: 352, w: 125, h: 60 },
    ],
    barrels: [
      { x: 485, y: 242 },
      { x: 793, y: 561 },
      { x: 753, y: 347 },
    ],
    waves: [
      ['crawler', 'spitter', 'spitter', 'brute', 'crawler', 'crawler', 'spitter', 'crawler'],
      [
        'brute',
        'spitter',
        'crawler',
        'brute',
        'spitter',
        'crawler',
        'spitter',
        'crawler',
        'crawler',
      ],
    ],
  },
  {
    name: { zh: '排热竖井', en: 'THE VENT SHAFT' },
    code: 'THE VENT SHAFT',
    subtitle: {
      zh: '穿越排气区，别让重甲冲锋把你逼进死角',
      en: 'Cross the exhaust gauntlet and never let a charge corner you',
    },
    accent: 0xd9a273,
    floor: 0x3a2e26,
    obstacles: [
      { x: 232, y: 205, w: 128, h: 62 },
      { x: 918, y: 205, w: 128, h: 62 },
      { x: 232, y: 545, w: 128, h: 62 },
      { x: 918, y: 545, w: 128, h: 62 },
      { x: 560, y: 190, w: 160, h: 56 },
      { x: 560, y: 590, w: 160, h: 56 },
    ],
    barrels: [
      { x: 398, y: 296 },
      { x: 884, y: 300 },
      { x: 745, y: 560 },
    ],
    waves: [
      ['crawler', 'crawler', 'spitter', 'brute', 'crawler', 'spitter', 'crawler', 'crawler'],
      [
        'brute',
        'spitter',
        'crawler',
        'spitter',
        'crawler',
        'brute',
        'spitter',
        'crawler',
        'crawler',
      ],
    ],
  },
  {
    name: { zh: '反应堆之心', en: 'HEART OF THE REACTOR' },
    code: 'HEART OF THE REACTOR',
    subtitle: {
      zh: '击败孢核守卫，终止感染',
      en: 'Defeat the Spore Warden and end the infection',
    },
    accent: 0xda999b,
    floor: 0x3b3037,
    obstacles: [
      { x: 282, y: 248, w: 84, h: 95 },
      { x: 910, y: 248, w: 84, h: 95 },
      { x: 282, y: 500, w: 84, h: 70 },
      { x: 910, y: 500, w: 84, h: 70 },
    ],
    barrels: [
      { x: 413, y: 323 },
      { x: 858, y: 525 },
    ],
    waves: [
      ['brute', 'crawler', 'spitter', 'crawler', 'spitter', 'brute'],
      ['boss', 'crawler', 'crawler', 'spitter', 'crawler'],
    ],
  },
];
