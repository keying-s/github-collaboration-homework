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
    muteAll: '全部静音',
    muteChannel: '静音',
    unmuteChannel: '取消静音',
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
    levelObjective1: '清除草野蛛群',
    levelObjective2: '驱散树洞蝠群',
    levelObjective3: '捣毁月面巢穴',
    levelObjective4: '击败你选定的宿敌',
    bossSelectEyebrow: '最终决战 · 宿敌遴选',
    bossSelectTitle: '选定你的宿敌',
    bossSelectDesc: '角斗场的大门只为你和它打开。每一位宿敌都有独特的战法——慎重选择。',
    bossSelectNote: '选择后立即开战 · 本局结束后可换一位再战',
    bossFight: '迎战',
    clearedCount: '已清除',
    bestCombo: '最高连击',
    operationMode: '行动模式',
    solo: '单人',
    soloAction: '单人行动',
    aiCoop: 'AI 协作',
    aiCompanion: 'AI 战友',
    currentLoadout: '当前装备',
    upgradeAxes: '火力强化',
    upgradeNote: '清房开箱，二选一强化，均衡搭配最凶。',
    awaitCrate: '等待第一个道具箱',
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
    openCrate: '打开道具箱',
    evacuate: '完成行动 · 撤离',
    nextLevel: '进入下一关',
    goPortal: '前往右侧传送门',
    combo: '{count} × 连击',
    firepower: '火力',
    fireRate: '射速',
    menuEyebrow: 'PROJECT EMBER / 战斗原型',
    heroLine1: '余烬之下，',
    heroLine2: '火力全开。',
    menuDescription1: '选择你的武器，深入被遗忘的隔离区。',
    menuDescription2: '带上你的战友，把下一扇门打穿。',
    chooseLoadout: '选择初始武器',
    fourAreas: '4 个区域',
    twoLoadouts: '2 种初始武器',
    fiveAxes: '5 轴强化',
    desktopTip: '桌面键鼠体验 · 首关满血出发 · 拾取无需花费',
    runMotto: '一场行动，无数种打法。',
    upgradeEyebrow: 'SUPPLY CRATE / 补给箱已回收',
    upgradeTitle1: '让下一次开火，',
    upgradeTitle2: '更凶一点。',
    upgradeDescription: '二选一强化，本次行动持续叠加。',
    takeUpgrade: '取用',
    upgradePaused: '战斗已暂停 · 做好选择，再出发',
    wonTitle: '余烬尚在，行动完成。',
    lostTitle: '这次，先到这里。',
    wonDescription: '所有隔离区已肃清。下一次，试试另一把武器开局。',
    lostDescription: '换一把武器开局，利用掩体，记得用闪避穿过弹幕。',
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
    controlInteract: 'E 拾取模块 / 进入传送门',
    fullscreenUnavailable: '当前预览不支持全屏；可在浏览器打开试玩链接。',
    stateReady: '状态已补满 · 清除全部感染体',
    upgradeActive: '强化已装备 · 继续清除感染体',
    portalReady: '传送门已接通 · 前往右侧，按 E 进入下一关',
    runInterrupted: '行动中断',
    waveIncoming: '第 {wave} 波感染体接近',
    finalPortal: '核心已净化 · 进入右侧传送门撤离',
    clearPortal: '区域已肃清 · 开箱强化，再前往右侧传送门',
    crateFound: '发现补给箱 · 靠近后按 E 打开',
    healthPickup: '+25 生命',
    guideButton: '指南',
    howToPlay: '玩法说明',
    guideTitle: '新兵简报',
    guideClose: '关闭',
    guideStart: '开始行动',
    guidePractice: '进入训练场',
    guideSkip: '跳过',
    guideNext: '继续',
    guidePrev: '返回',
    tabStory: '故事',
    tabControls: '操作',
    tabPractice: '训练',
    storyEyebrow: '行动前 · 你必须知道的事',
    storyCh1Title: '余烬之后',
    storyCh1: '“余烬事件”烧毁了城市边缘的能源枢纽。封锁线落下，整片隔离区被外界遗忘。',
    storyCh2Title: '沉默的感染',
    storyCh2: '一种以孢核为源的感染在废墟中蔓延，把残存设备与守卫者同化成猎手。',
    storyCh3Title: '你的任务',
    storyCh3: '深入 4 个隔离区——草野、树洞、月面与角斗场，击败你选定的宿敌，在混乱扩散前终结它。',
    storyCh4Title: '没有退路',
    storyCh4: '没有金币，没有商店——只有你的火力、走位，和与战友的配合。每一步都是选择。',
    missionBriefTitle: '行动目标',
    missionBrief: '逐区肃清感染体，接通传送门，最终净化反应堆之心。',
    controlsTitle: '操作说明',
    ctrlMove: 'WASD 移动角色',
    ctrlAim: '移动鼠标瞄准，按住左键开火',
    ctrlDash: 'Space 或 Shift 闪避，带短暂无敌',
    ctrlReload: 'R 换弹',
    ctrlInteract: 'E 打开补给箱，或进入传送门',
    ctrlPause: 'Esc 暂停 / 随时查看指南',
    practiceTitle: '训练场',
    practiceIntro:
      '安全沙盒：你不会受到伤害。试着开火、闪避、换弹，靠近补给箱按 E。完成要点即可离开。',
    trainShoot: '开火：按住鼠标左键',
    trainDash: '闪避：按 Space',
    trainCrate: '开箱：靠近补给箱按 E',
    trainReload: '换弹：按 R（可选）',
    trainTitle: '训练中',
    trainHint: '安全模式 · 无伤害 · 随意练习',
    trainDone: '训练完成！你已掌握基础操作。',
    trainExit: '结束训练',
    roomShootHint: '按住鼠标左键开火',
    roomDashHint: '开火后，按 SPACE 闪避躲避敌人',
    roomPortalHint: '前往右侧传送门',
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
    muteAll: 'MUTE ALL',
    muteChannel: 'MUTE',
    unmuteChannel: 'UNMUTE',
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
    levelObjective1: 'Clear the meadow spiders',
    levelObjective2: 'Scatter the hollow bats',
    levelObjective3: 'Raze the lunar nest',
    levelObjective4: 'Defeat your chosen nemesis',
    bossSelectEyebrow: 'FINAL DUEL · NEMESIS',
    bossSelectTitle: 'Choose Your Nemesis',
    bossSelectDesc:
      'The arena gate opens for you and it alone. Every nemesis fights differently — choose with care.',
    bossSelectNote: 'The duel starts immediately · pick another one next run',
    bossFight: 'FIGHT',
    clearedCount: 'CLEARED',
    bestCombo: 'BEST COMBO',
    operationMode: 'MODE',
    solo: 'SOLO',
    soloAction: 'SOLO RUN',
    aiCoop: 'AI CO-OP',
    aiCompanion: 'AI COMPANION',
    currentLoadout: 'CURRENT LOADOUT',
    upgradeAxes: 'UPGRADES',
    upgradeNote: 'Clear rooms, open crates, pick one boost. Balanced stacks hit hardest.',
    awaitCrate: 'Awaiting the first supply crate',
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
    openCrate: 'Open supply crate',
    evacuate: 'Complete run · Evacuate',
    nextLevel: 'Enter next level',
    goPortal: 'Proceed to the portal on the right',
    combo: '{count} × COMBO',
    firepower: 'POWER',
    fireRate: 'FIRE RATE',
    menuEyebrow: 'PROJECT EMBER / COMBAT PROTOTYPE',
    heroLine1: 'BENEATH THE EMBERS,',
    heroLine2: 'OPEN FIRE.',
    menuDescription1: 'Pick your weapon and enter a forgotten quarantine.',
    menuDescription2: 'Bring a companion and blast through the next door.',
    chooseLoadout: 'CHOOSE YOUR WEAPON',
    fourAreas: '4 SECTORS',
    twoLoadouts: '2 STARTING WEAPONS',
    fiveAxes: '5 UPGRADE AXES',
    desktopTip: 'DESKTOP CONTROLS · FULL HEALTH AT START · PICKUPS ARE FREE',
    runMotto: 'One operation. Countless builds.',
    upgradeEyebrow: 'SUPPLY CRATE / RECOVERED',
    upgradeTitle1: 'MAKE THE NEXT SHOT',
    upgradeTitle2: 'HIT HARDER.',
    upgradeDescription: 'Pick one boost. Stacks last for the whole run.',
    takeUpgrade: 'TAKE',
    upgradePaused: 'COMBAT PAUSED · CHOOSE, THEN MOVE',
    wonTitle: 'THE EMBER HOLDS. MISSION COMPLETE.',
    lostTitle: 'THE SIGNAL ENDS HERE.',
    wonDescription: 'All sectors are clear. Start the next run with the other weapon.',
    lostDescription: 'Try the other weapon, use cover, and dash through incoming fire.',
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
    controlInteract: 'E Collect Module / Enter Portal',
    fullscreenUnavailable: 'Fullscreen is unavailable in this preview. Open the game in a browser.',
    stateReady: 'STATE RESTORED · CLEAR ALL INFECTED',
    upgradeActive: 'UPGRADE INSTALLED · CONTINUE THE PURGE',
    portalReady: 'GATE ONLINE · GO RIGHT AND PRESS E',
    runInterrupted: 'OPERATION INTERRUPTED',
    waveIncoming: 'WAVE {wave} INCOMING',
    finalPortal: 'CORE PURIFIED · ENTER THE RIGHT GATE TO EVACUATE',
    clearPortal: 'AREA CLEAR · OPEN THE CRATE, THEN GO RIGHT',
    crateFound: 'SUPPLY CRATE FOUND · APPROACH AND PRESS E',
    healthPickup: '+25 HEALTH',
    guideButton: 'GUIDE',
    howToPlay: 'HOW TO PLAY',
    guideTitle: 'ROOKIE BRIEF',
    guideClose: 'CLOSE',
    guideStart: 'BEGIN OPERATION',
    guidePractice: 'ENTER TRAINING',
    guideSkip: 'SKIP',
    guideNext: 'NEXT',
    guidePrev: 'BACK',
    tabStory: 'STORY',
    tabControls: 'CONTROLS',
    tabPractice: 'TRAINING',
    storyEyebrow: 'BEFORE YOU DEPLOY · WHAT YOU MUST KNOW',
    storyCh1Title: 'AFTER THE EMBER',
    storyCh1:
      'The Ember Event burned the edge-of-city power hub. The cordon dropped and the whole quarantine was forgotten by the outside world.',
    storyCh2Title: 'THE SILENT INFECTION',
    storyCh2:
      'A spore-core infection spreads through the ruins, turning salvage and wardens into hunters.',
    storyCh3Title: 'YOUR MISSION',
    storyCh3:
      'Push through 4 sectors — meadow, hollow, moon and arena — and defeat the nemesis you choose before the chaos spreads.',
    storyCh4Title: 'NO WAY BACK',
    storyCh4:
      'No gold, no shop — only your firepower, your footing, and your ally. Every step is a choice.',
    missionBriefTitle: 'OBJECTIVE',
    missionBrief:
      'Clear each sector, reconnect the gate, and finally purify the Heart of the Reactor.',
    controlsTitle: 'CONTROLS',
    ctrlMove: 'WASD to move',
    ctrlAim: 'Move mouse to aim, hold left click to fire',
    ctrlDash: 'Space or Shift to dash with brief i-frames',
    ctrlReload: 'R to reload',
    ctrlInteract: 'E to open supply crates or enter the portal',
    ctrlPause: 'Esc to pause / open the guide anytime',
    practiceTitle: 'TRAINING RANGE',
    practiceIntro:
      'A safe sandbox: you take no damage. Try firing, dashing, reloading, and pressing E near a supply crate. Finish the drills to leave.',
    trainShoot: 'FIRE: hold left mouse',
    trainDash: 'DASH: press Space',
    trainCrate: 'CRATE: press E near a supply crate',
    trainReload: 'RELOAD: press R (optional)',
    trainTitle: 'IN TRAINING',
    trainHint: 'SAFE MODE · NO DAMAGE · PRACTICE FREELY',
    trainDone: 'TRAINING COMPLETE! You have the basics down.',
    trainExit: 'EXIT TRAINING',
    roomShootHint: 'HOLD LEFT MOUSE TO FIRE',
    roomDashHint: 'AFTER FIRING, PRESS SPACE TO DASH OUT OF DANGER',
    roomPortalHint: 'GO TO THE PORTAL ON THE RIGHT',
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
