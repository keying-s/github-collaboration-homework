import type { Locale, LocalizedText } from './game/types';

const STORAGE_KEY = 'ember-protocol-locale';

export const TRANSLATIONS = {
  'zh-CN': {
    pageTitle: '余烬协议 · 俯视角射击原型',
    brandName: '余烬协议',
    brandSubtitle: 'EMBER PROTOCOL',
    homeLabel: '余烬协议首页',
    progressLabel: '关卡进度',
    soundOff: '关闭音乐与音效',
    soundOn: '开启音乐与音效',
    soundToggle: '音乐与音效开关',
    soundPanelTitle: '音量设置',
    musicVolume: '音乐音量',
    sfxVolume: '音效音量',
    testSfx: '试听一声枪响',
    muteAll: '全部静音',
    pauseGame: '暂停游戏',
    pauseTitle: '暂停 · Esc',
    fullscreen: '全屏',
    languageTitle: '切换到 English',
    gameLabel: '游戏画面：WASD 移动，鼠标瞄准开火，空格闪避，E 拾取',
    trainingStandby: '训练模拟 / 待命',
    operationPaused: '行动已暂停',
    areaSafe: '区域安全 / 传送门开启',
    signalConnected: '现场信号 / 已连接',
    areaCleared: '区域肃清',
    targets: '{count} 个目标',
    bossName: '孢核守卫',
    health: '生命值',
    dashThruster: '闪避推进器',
    ready: '就绪',
    reloading: '换弹中',
    briefing: '行动简报',
    missionTitle: '深入隔离区',
    missionSubtitle: '熄灭最后的感染源。',
    levelObjective1: '清除感染群',
    levelObjective2: '突破重甲防线',
    levelObjective3: '击败孢核守卫',
    clearedCount: '已清除',
    bestCombo: '最高连击',
    operationMode: '行动模式',
    solo: '单人',
    soloAction: '单人行动',
    aiCoop: 'AI 协作',
    aiCompanion: 'AI 战友',
    currentLoadout: '当前装备',
    switchWeapon: 'Q 切换',
    skillModules: '技能模块',
    skillNote: '拾取模块，组合属于你的战斗风格。',
    emptySkill: '等待发现第一个模块',
    fullState: '每关满状态出发',
    noEconomy: '无金币 · 无商店 · 只靠火力与配合',
    move: '移动',
    aimFire: '瞄准 / 开火',
    dash: '闪避',
    pickupEnter: '拾取 / 进入',
    reload: '换弹',
    pause: '暂停',
    footerMotto: '一个房间。一次选择。再向前一步。',
    chooseMode: '选择行动模式，进入第 01 号隔离区',
    pickupModule: '拾取技能模块',
    equipWeapon: '装备 {name}',
    evacuate: '完成行动 · 撤离',
    nextLevel: '进入下一关',
    goPortal: '前往右侧传送门',
    combo: '{count} × 连击',
    firepower: '火力',
    fireRate: '射速',
    menuEyebrow: 'PROJECT EMBER / 战斗原型',
    heroLine1: '余烬之下，',
    heroLine2: '火力全开。',
    menuDescription1: '深入被遗忘的隔离区。闪避、开火、重组技能。',
    menuDescription2: '带上你的战友，把下一扇门打穿。',
    enterZone: '进入隔离区',
    threeAreas: '3 个区域',
    threeWeapons: '3 把枪械',
    sixSkills: '6 种技能模块',
    desktopTip: '桌面键鼠体验 · 首关满血出发 · 拾取无需花费',
    runMotto: '一场行动，无数种打法。',
    upgradeEyebrow: 'A NEW POSSIBILITY / 模块已回收',
    upgradeTitle1: '让下一次开火，',
    upgradeTitle2: '有点不同。',
    upgradeDescription: '选择一个技能。本次行动持续生效，可以与枪械自由组合。',
    equipModule: '装配模块',
    upgradePaused: '战斗已暂停 · 做好选择，再出发',
    wonTitle: '余烬尚在，行动完成。',
    lostTitle: '这次，先到这里。',
    wonDescription: '三个隔离区已肃清。下一次，试试另一套技能组合。',
    lostDescription: '换一把枪，利用掩体，记得用闪避穿过弹幕。',
    enemiesCleared: '感染体已清除',
    runTime: '行动用时',
    retry: '再来一次',
    returnHome: '返回行动准备',
    pauseHeading: '喘口气，再继续。',
    pauseDescription: '战斗已暂停。切换窗口时也会自动暂停。',
    resume: '继续行动',
    endRun: '结束本次行动，返回准备',
    controlMoveFire: 'WASD 移动 · 鼠标左键 开火',
    controlDashReload: 'Space / Shift 闪避 · R 换弹',
    controlPickupSwitch: 'E 拾取 / 传送 · Q 切换枪械',
    fullscreenUnavailable: '当前预览不支持全屏；可在浏览器打开试玩链接。',
    stateReady: '状态已补满 · 清除全部感染体',
    skillActive: '模块已激活 · 继续清除感染体',
    portalReady: '传送门已接通 · 前往右侧，按 E 进入下一关',
    runInterrupted: '行动中断',
    waveIncoming: '第 {wave} 波感染体接近',
    finalPortal: '核心已净化 · 进入右侧传送门撤离',
    clearPortal: '区域已肃清 · 拾取模块，再前往右侧传送门',
    moduleFound: '发现技能模块 · 靠近后按 E 拾取',
    healthPickup: '+25 生命',
  },
  en: {
    pageTitle: 'Ember Protocol · Top-down Shooter Demo',
    brandName: 'EMBER PROTOCOL',
    brandSubtitle: 'TOP-DOWN SHOOTER',
    homeLabel: 'Ember Protocol home',
    progressLabel: 'Level progress',
    soundOff: 'Mute music & sound',
    soundOn: 'Enable music & sound',
    soundToggle: 'Music & sound toggle',
    soundPanelTitle: 'SOUND SETTINGS',
    musicVolume: 'MUSIC',
    sfxVolume: 'SFX',
    testSfx: 'Preview one gunshot',
    muteAll: 'MUTE ALL',
    pauseGame: 'Pause game',
    pauseTitle: 'Pause · Esc',
    fullscreen: 'Fullscreen',
    languageTitle: '切换到中文',
    gameLabel: 'Game: WASD to move, mouse to aim and fire, Space to dash, E to interact',
    trainingStandby: 'TRAINING SIM / STANDBY',
    operationPaused: 'OPERATION PAUSED',
    areaSafe: 'AREA SECURE / GATE ONLINE',
    signalConnected: 'FIELD SIGNAL / CONNECTED',
    areaCleared: 'AREA CLEARED',
    targets: '{count} TARGETS',
    bossName: 'SPORE WARDEN',
    health: 'HEALTH',
    dashThruster: 'DASH THRUSTER',
    ready: 'READY',
    reloading: 'RELOADING',
    briefing: 'MISSION BRIEF',
    missionTitle: 'ENTER THE QUARANTINE',
    missionSubtitle: 'Extinguish the last infection source.',
    levelObjective1: 'Clear the infected swarm',
    levelObjective2: 'Break the armored line',
    levelObjective3: 'Defeat the Spore Warden',
    clearedCount: 'CLEARED',
    bestCombo: 'BEST COMBO',
    operationMode: 'MODE',
    solo: 'SOLO',
    soloAction: 'SOLO RUN',
    aiCoop: 'AI CO-OP',
    aiCompanion: 'AI COMPANION',
    currentLoadout: 'CURRENT LOADOUT',
    switchWeapon: 'Q SWITCH',
    skillModules: 'SKILL MODULES',
    skillNote: 'Collect modules and shape your own combat style.',
    emptySkill: 'Awaiting first module',
    fullState: 'FULLY RESTORED EACH LEVEL',
    noEconomy: 'NO GOLD · NO SHOP · ONLY FIREPOWER AND TEAMWORK',
    move: 'MOVE',
    aimFire: 'AIM / FIRE',
    dash: 'DASH',
    pickupEnter: 'INTERACT / ENTER',
    reload: 'RELOAD',
    pause: 'PAUSE',
    footerMotto: 'One room. One choice. One more step.',
    chooseMode: 'Choose a mode and enter Quarantine Sector 01',
    pickupModule: 'Collect skill module',
    equipWeapon: 'Equip {name}',
    evacuate: 'Complete run · Evacuate',
    nextLevel: 'Enter next level',
    goPortal: 'Proceed to the portal on the right',
    combo: '{count} × COMBO',
    firepower: 'POWER',
    fireRate: 'FIRE RATE',
    menuEyebrow: 'PROJECT EMBER / COMBAT PROTOTYPE',
    heroLine1: 'BENEATH THE EMBERS,',
    heroLine2: 'OPEN FIRE.',
    menuDescription1: 'Enter a forgotten quarantine. Dash, fire, rebuild your skills.',
    menuDescription2: 'Bring a companion and blast through the next door.',
    enterZone: 'ENTER QUARANTINE',
    threeAreas: '3 SECTORS',
    threeWeapons: '3 WEAPONS',
    sixSkills: '6 SKILL MODULES',
    desktopTip: 'DESKTOP CONTROLS · FULL HEALTH AT START · PICKUPS ARE FREE',
    runMotto: 'One operation. Countless builds.',
    upgradeEyebrow: 'A NEW POSSIBILITY / MODULE RECOVERED',
    upgradeTitle1: 'MAKE THE NEXT SHOT',
    upgradeTitle2: 'FEEL DIFFERENT.',
    upgradeDescription: 'Choose one skill. It lasts for this run and combines with every weapon.',
    equipModule: 'EQUIP MODULE',
    upgradePaused: 'COMBAT PAUSED · CHOOSE, THEN MOVE',
    wonTitle: 'THE EMBER HOLDS. MISSION COMPLETE.',
    lostTitle: 'THE SIGNAL ENDS HERE.',
    wonDescription: 'All three sectors are clear. Try a different build next time.',
    lostDescription: 'Switch weapons, use cover, and dash through incoming fire.',
    enemiesCleared: 'INFECTED CLEARED',
    runTime: 'RUN TIME',
    retry: 'RUN AGAIN',
    returnHome: 'RETURN TO BRIEFING',
    pauseHeading: 'TAKE A BREATH.',
    pauseDescription: 'Combat is paused. Switching windows pauses automatically.',
    resume: 'RESUME OPERATION',
    endRun: 'END RUN AND RETURN',
    controlMoveFire: 'WASD Move · Left Click Fire',
    controlDashReload: 'Space / Shift Dash · R Reload',
    controlPickupSwitch: 'E Interact / Portal · Q Switch Weapon',
    fullscreenUnavailable: 'Fullscreen is unavailable in this preview. Open the game in a browser.',
    stateReady: 'STATE RESTORED · CLEAR ALL INFECTED',
    skillActive: 'MODULE ACTIVE · CONTINUE THE PURGE',
    portalReady: 'GATE ONLINE · GO RIGHT AND PRESS E',
    runInterrupted: 'OPERATION INTERRUPTED',
    waveIncoming: 'WAVE {wave} INCOMING',
    finalPortal: 'CORE PURIFIED · ENTER THE RIGHT GATE TO EVACUATE',
    clearPortal: 'AREA CLEAR · COLLECT THE MODULE, THEN GO RIGHT',
    moduleFound: 'SKILL MODULE FOUND · APPROACH AND PRESS E',
    healthPickup: '+25 HEALTH',
  },
} as const;

export type TranslationKey = keyof (typeof TRANSLATIONS)['zh-CN'];

function browserLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh'))
    return 'zh-CN';
  return 'en';
}

export function localize(value: LocalizedText, locale: Locale): string {
  return locale === 'zh-CN' ? value.zh : value.en;
}

export class I18n {
  locale: Locale;
  private listeners = new Set<() => void>();

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy modes; language switching still works for this session.
    }
    this.locale = saved === 'zh-CN' || saved === 'en' ? saved : browserLocale();
    this.applyDocumentLanguage();
  }

  get isChinese() {
    return this.locale === 'zh-CN';
  }

  t(key: TranslationKey, values: Record<string, string | number> = {}): string {
    let result: string = TRANSLATIONS[this.locale][key];
    for (const [name, value] of Object.entries(values))
      result = result.replaceAll(`{${name}}`, String(value));
    return result;
  }

  text(value: LocalizedText): string {
    return localize(value, this.locale);
  }

  toggle() {
    this.setLocale(this.isChinese ? 'en' : 'zh-CN');
  }

  setLocale(locale: Locale) {
    if (this.locale === locale) return;
    this.locale = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Keep the in-memory choice when storage is unavailable.
    }
    this.applyDocumentLanguage();
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private applyDocumentLanguage() {
    document.documentElement.lang = this.locale;
  }
}
