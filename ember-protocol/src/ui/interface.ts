import { BOSSES, LEVELS, UPGRADES, WEAPONS } from '../game/config';
import { distance } from '../game/math';
import type { AudioEngine } from '../game/audio';
import type { Simulation } from '../game/simulation';
import type { BossId, UpgradeId, WeaponId } from '../game/types';
import type { I18n, TranslationKey } from '../i18n';
import { gunIcon, icon } from './icons';

export class Interface {
  private squad = false;
  private lastWeapon: WeaponId = 'rifle';
  private soundPanelOpen = false;
  private overlayKey = '';
  private weaponKey = '';
  private upgradeKey = '';
  private soundKey = '';
  private notice = '';
  private noticeTimer?: number;
  private timer: number;
  private unsubscribeLanguage: () => void = () => undefined;
  private nodes: Record<string, HTMLElement> = {};
  private guideOpen = false;
  private guideOpenedFromPause = false;
  private guideTab: 'story' | 'controls' | 'practice' = 'story';
  private guideStep = 0;
  private readonly guideChapters = 4;
  private trainKey = '';
  /** Card order in the nemesis window, reshuffled every visit. */
  private bossOrder: BossId[] = [];

  constructor(
    private model: Simulation,
    private audio: AudioEngine,
    private i18n: I18n,
  ) {
    const t = (key: TranslationKey) => this.i18n.t(key);
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <a class="brand" href="#" data-action="home" data-i18n-aria="homeLabel" aria-label="${t('homeLabel')}"><span class="brand-mark">${icon('bolt', 27)}</span><span><span data-i18n="brandName">${t('brandName')}</span><small data-i18n="brandSubtitle">${t('brandSubtitle')}</small></span></a>
          <nav class="route" data-i18n-aria="progressLabel" aria-label="${t('progressLabel')}">${LEVELS.map((level, i) => `<div class="route-node" data-room="${i}"><span>0${i + 1}</span><div data-level-name="${i}">${this.i18n.text(level.name)}</div></div>${i < LEVELS.length - 1 ? '<i></i>' : ''}`).join('')}</nav>
          <div class="tools"><span class="build-tag">PLAYABLE DEMO <b>0.2</b></span><button class="icon-button language-button" data-action="language" data-i18n-title="languageTitle" data-i18n-aria="languageTitle" title="${t('languageTitle')}" aria-label="${t('languageTitle')}"><span id="language-label">${this.i18n.isChinese ? 'EN' : '中文'}</span></button><button class="icon-button" data-action="sound" data-i18n-title="soundToggle" data-i18n-aria="soundToggle" title="${t('soundToggle')}" aria-label="${t('soundToggle')}">${icon('volume')}</button><div class="sound-panel" id="sound-panel"></div><button class="icon-button" data-action="guide" data-i18n-title="guideButton" data-i18n-aria="guideButton" title="${t('guideButton')}" aria-label="${t('guideButton')}">${icon('book', 18)}</button><button class="icon-button" data-action="pause" data-i18n-aria="pauseGame" data-i18n-title="pauseTitle" aria-label="${t('pauseGame')}" title="${t('pauseTitle')}">${icon('pause')}</button><button class="icon-button" data-action="fullscreen" data-i18n-aria="fullscreen" data-i18n-title="fullscreen" aria-label="${t('fullscreen')}" title="${t('fullscreen')}">${icon('full')}</button></div>
        </header>
        <main class="workspace">
          <section class="field-wrap">
            <div class="field-top"><div><span class="live-dot"></span><span id="field-status">${t('trainingStandby')}</span></div><span>TOP-DOWN ROGUELITE <i>✦</i> SECTOR <b id="sector-number">01</b></span></div>
            <div class="field-stage"><div class="arena-shell">
              <div id="game" data-i18n-aria="gameLabel" aria-label="${t('gameLabel')}"></div>
              <div class="arena-ui" id="arena-hud">
                <div class="room-label"><span id="room-code"></span><h2 id="room-name"></h2><p id="room-hint"></p></div>
                <div class="wave-pill" id="wave-pill"></div>
                <div class="boss-bar" id="boss-bar"><div><b data-i18n="bossName">${t('bossName')}</b><span>THE SPORE WARDEN</span></div><i><em id="boss-fill"></em></i></div>
                <div class="combat-hud"><div class="health-card"><div class="health-title">${icon('plus', 15)}<span data-i18n="health">${t('health')}</span><b id="health-value">100 <small>/ 100</small></b></div><div class="health-track"><i id="health-fill"></i></div><div class="dash-line"><span><span data-i18n="dashThruster">${t('dashThruster')}</span> <kbd>SPACE</kbd></span><b id="dash-value">${t('ready')}</b></div><div class="dash-track"><i id="dash-fill"></i></div></div><div class="ammo-card"><div class="ammo-icon">${icon('target', 16)} <span id="ammo-name"></span></div><div><strong id="ammo-value">30</strong><span id="ammo-max">/ 30</span><kbd>R</kbd></div></div></div>
                <div id="interaction" class="interaction"></div><div id="combo" class="combo"></div>
                <div id="training" class="training-panel hidden"></div>
                <div id="coach" class="coach-layer"></div>
              </div>
              <div id="overlay" class="overlay"></div>
            </div></div>
            <div class="field-bottom"><span><i class="small-dot"></i><span id="mission-line">${t('chooseMode')}</span></span><span id="run-clock">00:00</span></div>
          </section>
          <aside class="sidebar">
            <section class="mission-panel"><div class="panel-eyebrow"><span data-i18n="briefing">${t('briefing')}</span><span>BRIEFING / 01</span></div><h2><span data-i18n="missionTitle">${t('missionTitle')}</span><span data-i18n="missionSubtitle">${t('missionSubtitle')}</span></h2><div class="mission-route">${LEVELS.map((level, i) => `<div class="mission-step" data-step="${i}"><span class="step-marker">${i + 1}</span><div><b data-level-name="${i}">${this.i18n.text(level.name)}</b><small data-objective="${i}">${t(`levelObjective${i + 1}` as TranslationKey)}</small></div><span class="step-check"></span></div>`).join('')}</div><div class="run-stats"><div><small data-i18n="clearedCount">${t('clearedCount')}</small><b id="kills">00</b></div><div><small data-i18n="bestCombo">${t('bestCombo')}</small><b id="best-combo">00</b></div><div><small data-i18n="operationMode">${t('operationMode')}</small><b id="mode-label" class="mode-stat">${t('solo')}</b></div></div></section>
            <section class="loadout-panel"><div class="panel-eyebrow"><span data-i18n="currentLoadout">${t('currentLoadout')}</span></div><div id="weapon-card"></div></section>
            <section class="skills-panel"><div class="panel-eyebrow"><span data-i18n="upgradeAxes">${t('upgradeAxes')}</span><span id="upgrade-total">0</span></div><div id="upgrades-list"></div><p class="panel-note" data-i18n="upgradeNote">${t('upgradeNote')}</p></section>
            <div class="fair-note">${icon('shield', 18)}<div><span data-i18n="fullState">${t('fullState')}</span><small data-i18n="noEconomy">${t('noEconomy')}</small></div></div>
          </aside>
        </main>
        <footer><div class="controls"><span><kbd>W A S D</kbd> <span data-i18n="move">${t('move')}</span></span><span>${icon('mouse', 15)} <span data-i18n="aimFire">${t('aimFire')}</span></span><span><kbd>SPACE</kbd> <span data-i18n="dash">${t('dash')}</span></span><span><kbd>E</kbd> <span data-i18n="pickupEnter">${t('pickupEnter')}</span></span><span><kbd>R</kbd> <span data-i18n="reload">${t('reload')}</span></span><span><kbd>ESC</kbd> <span data-i18n="pause">${t('pause')}</span></span></div><span class="footer-note" data-i18n="footerMotto">${t('footerMotto')}</span></footer>
      <div id="guide" class="guide-overlay hidden"></div>
      </div>`;

    document.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
      this.nodes[element.id] = element;
    });
    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('input', this.onInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.unsubscribeLanguage = this.i18n.subscribe(() => this.applyLanguage());
    this.timer = window.setInterval(() => this.refresh(), 70);
    this.applyLanguage();
    try {
      if (!localStorage.getItem('ember-protocol-onboarded')) this.openGuide();
    } catch {
      this.openGuide();
    }
  }

  private onVisibilityChange = () => {
    if (document.hidden && ['combat', 'exit'].includes(this.model.phase)) this.model.paused = true;
  };

  private onKey = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && this.soundPanelOpen) {
      this.soundPanelOpen = false;
      this.refresh();
      return;
    }
    if (event.code === 'Escape' && this.guideOpen) {
      this.closeGuide();
      return;
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      this.togglePause();
    }
    if (event.code === 'KeyM') {
      this.audio.toggle();
      this.updateSound();
    }
    if (event.code === 'KeyL') this.i18n.toggle();
  };

  private onInput = (event: Event) => {
    const slider = event.target as HTMLElement;
    if (!(slider instanceof HTMLInputElement) || !slider.dataset.setting) return;
    const volume = Number(slider.value) / 100;
    if (slider.dataset.setting === 'music') {
      this.audio.setMusicVolume(volume);
      if (this.audio.musicMuted) {
        this.audio.setMusicMuted(false);
        this.syncSoundToggleUi('toggleMusic', false);
      }
    }
    if (slider.dataset.setting === 'sfx') {
      this.audio.setSfxVolume(volume);
      if (this.audio.sfxMuted) {
        this.audio.setSfxMuted(false);
        this.syncSoundToggleUi('toggleSfx', false);
      }
    }
    const label = document.getElementById(`${slider.dataset.setting}-value`);
    if (label) label.textContent = `${slider.value}%`;
  };

  private syncSoundToggleUi(action: string, muted: boolean) {
    const button = document.querySelector<HTMLElement>(`[data-action="${action}"]`);
    if (!button) return;
    button.classList.toggle('muted', muted);
    button.innerHTML = icon(muted ? 'mute' : 'volume', 13);
    button.title = this.i18n.t(muted ? 'unmuteChannel' : 'muteChannel');
  }

  private onClick = (event: MouseEvent) => {
    if (
      this.soundPanelOpen &&
      !(event.target as HTMLElement).closest('.sound-panel, [data-action="sound"]')
    ) {
      this.soundPanelOpen = false;
    }
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) {
      this.refresh();
      return;
    }
    this.audio.unlock();
    const action = button.dataset.action;
    if (action === 'start') {
      // Retry buttons carry no weapon; remember the run's choice so "RUN AGAIN"
      // keeps the loadout the player picked at the menu.
      const weapon = (button.dataset.weapon as WeaponId) ?? this.lastWeapon;
      this.lastWeapon = weapon;
      this.model.start(this.squad, weapon);
      this.overlayKey = '';
      (document.activeElement as HTMLElement)?.blur();
    }
    if (action === 'solo' || action === 'squad') {
      this.squad = action === 'squad';
      this.overlayKey = '';
    }
    if (action === 'pause' || action === 'resume') this.togglePause();
    if (action === 'home') {
      this.model.start(this.squad);
      this.model.phase = 'menu';
    }
    if (action === 'sound') {
      this.soundPanelOpen = !this.soundPanelOpen;
    }
    if (action === 'muteAll') {
      this.audio.toggle();
      this.updateSound();
    }
    if (action === 'toggleMusic') this.audio.setMusicMuted(!this.audio.musicMuted);
    if (action === 'toggleSfx') this.audio.setSfxMuted(!this.audio.sfxMuted);
    if (action === 'language') this.i18n.toggle();
    if (action === 'guide') this.openGuide();
    if (action === 'guideClose' || action === 'guideSkip') this.closeGuide();
    if (action === 'guideLang') this.i18n.toggle();
    if (action === 'guideTab')
      this.guideTab = (button.dataset.tab as 'story' | 'controls' | 'practice') ?? this.guideTab;
    if (action === 'guideStep') {
      const dir = button.dataset.dir === 'next' ? 1 : -1;
      this.guideStep = Math.min(this.guideChapters - 1, Math.max(0, this.guideStep + dir));
      if (dir > 0 && this.guideStep === this.guideChapters - 1) this.guideTab = 'controls';
    }
    if (action === 'guideStart') {
      this.closeGuide();
      this.model.start(this.squad);
      this.overlayKey = '';
    }
    if (action === 'train') {
      this.closeGuide();
      this.model.beginTraining();
      this.overlayKey = '';
    }
    if (action === 'trainEnd') this.model.endTraining();
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document
          .querySelector('.shell')!
          .requestFullscreen()
          .catch(() => this.showNotice(this.i18n.t('fullscreenUnavailable')));
    }
    if (action === 'upgrade') this.model.chooseUpgrade(button.dataset.upgrade as UpgradeId);
    if (action === 'bossPick') this.model.chooseBoss(button.dataset.boss as BossId);
    // Guide navigation (Next/Prev/chapter + tab switch) changes state but the
    // 70ms refresh() loop does not repaint the guide, so repaint it explicitly
    // here — otherwise the buttons appear unresponsive.
    if (this.guideOpen && action === 'guideStep') this.renderGuide();
    if (this.guideOpen && action === 'guideTab') this.renderGuide();
    this.refresh();
  };

  private showNotice(message: string) {
    this.notice = message;
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      this.notice = '';
      this.refresh();
    }, 3500);
    this.refresh();
  }

  private applyLanguage() {
    document.title = this.i18n.t('pageTitle');
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      element.textContent = this.i18n.t(element.dataset.i18n as TranslationKey);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', this.i18n.t(element.dataset.i18nAria as TranslationKey));
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
      element.title = this.i18n.t(element.dataset.i18nTitle as TranslationKey);
    });
    document.querySelectorAll<HTMLElement>('[data-level-name]').forEach((element) => {
      element.textContent = this.i18n.text(LEVELS[Number(element.dataset.levelName)].name);
    });
    document.querySelectorAll<HTMLElement>('[data-objective]').forEach((element) => {
      const index = Number(element.dataset.objective) + 1;
      element.textContent = this.i18n.t(`levelObjective${index}` as TranslationKey);
    });
    this.set('language-label', this.i18n.isChinese ? 'EN' : '中文');
    this.overlayKey = '';
    this.weaponKey = '';
    this.upgradeKey = '';
    this.updateSound();
    if (this.guideOpen) this.renderGuide();
    this.refresh();
  }

  private updateSound() {
    const button = document.querySelector<HTMLElement>('[data-action="sound"]')!;
    button.innerHTML = icon(this.audio.muted ? 'mute' : 'volume');
    button.setAttribute('aria-label', this.i18n.t(this.audio.muted ? 'soundOn' : 'soundOff'));
  }

  private togglePause() {
    if (['combat', 'exit'].includes(this.model.phase)) this.model.paused = !this.model.paused;
    this.refresh();
  }

  private set(id: string, text: string) {
    if (this.nodes[id].textContent !== text) this.nodes[id].textContent = text;
  }

  refresh() {
    const m = this.model;
    const p = m.player;
    const menu = m.phase === 'menu';
    this.audio.setCombat(['combat', 'exit', 'upgrade'].includes(m.phase));
    this.audio.setBossPhase(!!m.boss && m.boss.hp < m.boss.maxHp / 2);
    const text = (key: TranslationKey, values: Record<string, string | number> = {}) =>
      this.i18n.t(key, values);
    this.nodes['arena-hud'].classList.toggle('hidden', menu);
    this.set(
      'field-status',
      menu
        ? text('trainingStandby')
        : m.paused
          ? text('operationPaused')
          : m.phase === 'exit'
            ? text('areaSafe')
            : text('signalConnected'),
    );
    this.set('sector-number', String(m.levelIndex + 1).padStart(2, '0'));
    this.set('room-code', `SECTOR 0${m.levelIndex + 1} / ${m.level.code}`);
    this.set('room-name', this.i18n.text(m.level.name));
    this.set('room-hint', this.i18n.text(m.level.subtitle));
    this.set(
      'wave-pill',
      m.phase === 'exit'
        ? `✓  ${text('areaCleared')}`
        : `WAVE ${String(m.waveIndex).padStart(2, '0')} / 02  ·  ${text('targets', { count: m.remaining })}`,
    );
    this.nodes['health-value'].innerHTML = `${Math.ceil(p.hp)} <small>/ ${p.maxHp}</small>`;
    this.nodes['health-fill'].style.width = `${(p.hp / p.maxHp) * 100}%`;
    this.nodes['health-fill'].classList.toggle('critical', p.hp < 35);
    this.set('dash-value', p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : text('ready'));
    this.nodes['dash-fill'].style.width = `${Math.max(0, 1 - p.dashCooldown / 2.2) * 100}%`;
    this.set('ammo-name', this.i18n.text(m.weapon.name));
    this.set('ammo-value', p.reloadRemaining > 0 ? '··' : String(p.ammo).padStart(2, '0'));
    this.set('ammo-max', p.reloadRemaining > 0 ? text('reloading') : `/ ${m.stats.magazine}`);
    this.set(
      'mission-line',
      this.notice || (menu ? text('chooseMode') : text(m.hint.key, m.hint.values)),
    );
    this.set(
      'run-clock',
      `${String(Math.floor(m.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}`,
    );
    this.set('kills', String(m.kills).padStart(2, '0'));
    this.set('best-combo', String(m.bestCombo).padStart(2, '0'));
    this.set('mode-label', (menu ? this.squad : m.squad) ? text('aiCoop') : text('solo'));
    this.nodes['boss-bar'].style.display = m.boss ? 'block' : 'none';
    if (m.boss) {
      this.nodes['boss-fill'].style.width = `${(m.boss.hp / m.boss.maxHp) * 100}%`;
      const cfg = BOSSES.find((b) => b.id === (m.boss!.bossId ?? 'flower'))!;
      const nameEl = this.nodes['boss-bar'].querySelector('b')!;
      const enEl = this.nodes['boss-bar'].querySelector('span')!;
      if (nameEl.textContent !== this.i18n.text(cfg.name))
        nameEl.textContent = this.i18n.text(cfg.name);
      if (enEl.textContent !== cfg.name.en) enEl.textContent = cfg.name.en;
    }
    if (m.phase !== 'bossSelect') this.bossOrder = [];

    const item = m.nearestPickup;
    let prompt = '';
    if (item && distance(item, p) < 78) prompt = `<kbd>E</kbd> ${text('openCrate')}`;
    else if (m.phase === 'exit' && distance(p, { x: 1160, y: 400 }) < 110)
      prompt = `<kbd>E</kbd> ${text(m.isLastLevel ? 'evacuate' : 'nextLevel')}`;
    else if (m.phase === 'exit') prompt = `${text('goPortal')} <span>→</span>`;
    this.nodes['interaction'].innerHTML = prompt;
    this.nodes['interaction'].classList.toggle('visible', !!prompt);
    this.set('combo', m.combo >= 2 ? text('combo', { count: m.combo }) : '');

    document.querySelectorAll<HTMLElement>('[data-room]').forEach((element) => {
      element.classList.toggle('current', Number(element.dataset.room) === m.levelIndex);
      element.classList.toggle('complete', Number(element.dataset.room) < m.levelIndex);
    });
    document.querySelectorAll<HTMLElement>('[data-step]').forEach((element) => {
      const index = Number(element.dataset.step);
      element.classList.toggle('current', index === m.levelIndex);
      element.classList.toggle('complete', index < m.levelIndex);
      element.querySelector('.step-check')!.innerHTML =
        index < m.levelIndex
          ? icon('check', 15)
          : index === m.levelIndex
            ? '<span class="small-dot"></span>'
            : '';
    });

    const weaponKey = `${p.weapon}-${this.i18n.locale}`;
    if (weaponKey !== this.weaponKey) {
      this.weaponKey = weaponKey;
      this.nodes['weapon-card'].innerHTML =
        `<div class="weapon-art">${gunIcon(p.weapon)}</div><div class="weapon-name"><h3>${this.i18n.text(m.weapon.name)}</h3><span>${m.weapon.id.toUpperCase()}</span></div><div class="weapon-type">${this.i18n.text(m.weapon.label)}</div><p>${this.i18n.text(m.weapon.description)}</p><div class="weapon-bars"><span>${text('firepower')} <i><b style="width:${p.weapon === 'flamer' ? 78 : 62}%"></b></i></span><span>${text('fireRate')} <i><b style="width:${p.weapon === 'flamer' ? 96 : 69}%"></b></i></span></div>`;
    }
    const upgradeKey = `${m.upgrades.join()}-${this.i18n.locale}`;
    if (upgradeKey !== this.upgradeKey || !this.nodes['upgrades-list'].innerHTML) {
      this.upgradeKey = upgradeKey;
      this.set('upgrade-total', String(m.upgrades.length));
      this.nodes['upgrades-list'].innerHTML = m.upgrades.length
        ? UPGRADES.map((axis) => {
            const stacks = m.upgrades.filter((u) => u === axis.id).length;
            if (!stacks) return '';
            return `<div class="equipped-skill"><i>${icon('bolt', 19)}</i><div><b>${this.i18n.text(axis.label)}</b><small>×${stacks}</small></div></div>`;
          }).join('')
        : `<div class="empty-slots"><span>+</span></div><div class="empty-label">${text('awaitCrate')}</div>`;
    }
    this.renderSoundPanel();
    this.renderOverlay();
    this.renderTraining();
    this.renderCoach();
  }

  private renderSoundPanel() {
    const panel = this.nodes['sound-panel'];
    if (!panel) return;
    const key = `${this.soundPanelOpen}-${this.audio.musicMuted}-${this.audio.sfxMuted}-${this.i18n.locale}`;
    if (key === this.soundKey) return;
    this.soundKey = key;
    this.updateSound();
    if (!this.soundPanelOpen) {
      panel.innerHTML = '';
      return;
    }
    const t = (key: TranslationKey) => this.i18n.t(key);
    const label = (muted: boolean, volume: number) =>
      muted ? '0%' : `${Math.round(volume * 100)}%`;
    const sliderValue = (muted: boolean, volume: number) => (muted ? 0 : Math.round(volume * 100));
    const toggle = (action: string, muted: boolean) =>
      `<button class="sound-toggle${muted ? ' muted' : ''}" data-action="${action}" title="${muted ? t('unmuteChannel') : t('muteChannel')}">${icon(muted ? 'mute' : 'volume', 13)}</button>`;
    panel.innerHTML = `<div class="sound-panel-card"><div class="sound-panel-title">${t('soundPanelTitle')}</div><div class="sound-row"><span data-i18n="musicVolume">${t('musicVolume')}</span><b id="music-value">${label(this.audio.musicMuted, this.audio.musicVolume)}</b></div><div class="sound-slider-row">${toggle('toggleMusic', this.audio.musicMuted)}<input id="slider-music" type="range" min="0" max="100" step="1" value="${sliderValue(this.audio.musicMuted, this.audio.musicVolume)}" data-setting="music" aria-label="${t('musicVolume')}"></div><div class="sound-row"><span data-i18n="sfxVolume">${t('sfxVolume')}</span><b id="sfx-value">${label(this.audio.sfxMuted, this.audio.sfxVolume)}</b></div><div class="sound-slider-row">${toggle('toggleSfx', this.audio.sfxMuted)}<input id="slider-sfx" type="range" min="0" max="100" step="1" value="${sliderValue(this.audio.sfxMuted, this.audio.sfxVolume)}" data-setting="sfx" aria-label="${t('sfxVolume')}"></div><button class="mute-switch${this.audio.muted ? ' muted' : ''}" data-action="muteAll">${this.audio.muted ? icon('mute', 13) : icon('volume', 13)} <span data-i18n="muteAll">${t('muteAll')}</span></button></div>`;
  }

  private renderOverlay() {
    const m = this.model;
    const t = (key: TranslationKey) => this.i18n.t(key);
    const key = `${m.phase}-${m.paused}-${this.squad}-${m.upgrades.join()}-${this.i18n.locale}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const overlay = this.nodes.overlay;
    overlay.className = 'overlay';
    overlay.innerHTML = '';
    if (m.phase === 'menu') {
      const weapons: WeaponId[] = ['flamer', 'rifle'];
      overlay.classList.add('menu-overlay');
      overlay.innerHTML = `<div class="menu-content"><div class="eyebrow"><span></span> ${t('menuEyebrow')}</div><h1>${t('heroLine1')}<br><em>${t('heroLine2')}</em></h1><p class="menu-description">${t('menuDescription1')}<br>${t('menuDescription2')}</p><div class="mode-switch" role="group" aria-label="${t('operationMode')}"><button data-action="solo" class="${!this.squad ? 'selected' : ''}">${icon('person', 18)} ${t('soloAction')}</button><button data-action="squad" class="${this.squad ? 'selected' : ''}">${icon('people', 19)} ${t('aiCompanion')}</button></div><div class="weapon-choice" role="group" aria-label="${t('chooseLoadout')}"><span class="choice-label">${t('chooseLoadout')}</span>${weapons.map((id) => `<button class="weapon-pick" data-action="start" data-weapon="${id}"><span class="pick-art">${gunIcon(id)}</span><b>${this.i18n.text(WEAPONS[id].name)}</b><small>${this.i18n.text(WEAPONS[id].description)}</small></button>`).join('')}</div><button class="start-button how-to-play" data-action="guide"><span>${t('howToPlay')}</span>${icon('book', 16)}</button><div class="menu-meta"><span>${t('fourAreas')}</span><i></i><span>${t('twoLoadouts')}</span><i></i><span>${t('fiveAxes')}</span></div><div class="menu-tip">${icon('info', 14)} ${t('desktopTip')}</div></div><div class="arena-stamp"><span>FIELD TEST</span><strong>01—${String(LEVELS.length).padStart(2, '0')}</strong><small>${t('runMotto')}</small></div>`;
    } else if (m.phase === 'upgrade') {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="upgrade-modal"><div class="eyebrow">${t('upgradeEyebrow')}</div><h2>${t('upgradeTitle1')}<em>${t('upgradeTitle2')}</em></h2><p>${t('upgradeDescription')}</p><div class="upgrade-options">${m.options
        .map((option, i) => {
          const stacks = m.upgrades.filter((u) => u === option.id).length;
          return `<button class="upgrade-option" data-action="upgrade" data-upgrade="${option.id}"><span class="option-index">SUPPLY / 0${i + 1}</span><i>${icon('bolt', 34)}</i><h3>${this.i18n.text(option.label)}</h3>${stacks ? `<span class="skill-tag">×${stacks}</span>` : ''}<span class="choose-label">${t('takeUpgrade')} ${icon('arrow', 17)}</span></button>`;
        })
        .join('')}</div><small>${t('upgradePaused')}</small></div>`;
    } else if (m.phase === 'bossSelect') {
      overlay.classList.add('modal-overlay');
      if (!this.bossOrder.length) {
        this.bossOrder = [...BOSSES].map((b) => b.id);
        for (let i = this.bossOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bossOrder[i], this.bossOrder[j]] = [this.bossOrder[j], this.bossOrder[i]];
        }
      }
      const cards = this.bossOrder
        .map((id) => BOSSES.find((b) => b.id === id)!)
        .map((cfg) => {
          const hex = `#${cfg.color.toString(16).padStart(6, '0')}`;
          return `<button class="upgrade-option boss-card" data-action="bossPick" data-boss="${cfg.id}"><span class="option-index">NEMESIS / ${cfg.id.toUpperCase()}</span><i class="boss-glyph">${cfg.glyph}</i><span class="skill-tag" style="color:${hex}">${this.i18n.text(cfg.tag)}</span><h3>${this.i18n.text(cfg.name)}</h3><p>${this.i18n.text(cfg.description)}</p><span class="choose-label">${t('bossFight')} ${icon('arrow', 17)}</span></button>`;
        })
        .join('');
      overlay.innerHTML = `<div class="upgrade-modal boss-modal"><div class="eyebrow">${t('bossSelectEyebrow')}</div><h2>${t('bossSelectTitle')}<em>FINAL DUEL</em></h2><p>${t('bossSelectDesc')}</p><div class="boss-options">${cards}</div><small>${t('bossSelectNote')}</small></div>`;
    } else if (m.phase === 'won' || m.phase === 'lost') {
      const won = m.phase === 'won';
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="result-modal"><div class="result-emblem">${icon(won ? 'flag' : 'shield', 44)}</div><div class="eyebrow">${won ? 'MISSION COMPLETE' : 'SIGNAL LOST'}</div><h2>${t(won ? 'wonTitle' : 'lostTitle')}</h2><p>${t(won ? 'wonDescription' : 'lostDescription')}</p><div class="result-stats"><div><b>${m.kills}</b><small>${t('enemiesCleared')}</small></div><div><b>${m.bestCombo}</b><small>${t('bestCombo')}</small></div><div><b>${Math.floor(m.elapsed / 60)}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}</b><small>${t('runTime')}</small></div></div><button class="start-button" data-action="start"><span>${t('retry')}</span>${icon('reset')}</button><button class="text-button" data-action="home">${t('returnHome')}</button></div>`;
    } else if (m.paused) {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="pause-modal"><div class="eyebrow">TAKE A BREATH</div><h2>${t('pauseHeading')}</h2><p>${t('pauseDescription')}</p><button class="start-button" data-action="resume"><span>${t('resume')}</span>${icon('play')}</button><button class="text-button" data-action="guide"><span>${icon('book', 16)}</span><span>${t('guideButton')}</span></button><button class="text-button" data-action="home">${t('endRun')}</button><div class="pause-controls"><span>${t('controlMoveFire')}</span><span>${t('controlDashReload')}</span><span>${t('controlInteract')}</span></div></div>`;
    }
  }

  private openGuide() {
    this.guideOpen = true;
    this.guideOpenedFromPause = this.model.paused;
    if (['combat', 'exit'].includes(this.model.phase) && !this.model.paused)
      this.model.paused = true;
    this.guideTab = 'story';
    this.guideStep = 0;
    this.renderGuide();
  }
  private closeGuide() {
    this.guideOpen = false;
    const wasFromPause = this.guideOpenedFromPause;
    this.guideOpenedFromPause = false;
    if (['combat', 'exit'].includes(this.model.phase) && !this.model.training && !wasFromPause)
      this.model.paused = false;
    try {
      localStorage.setItem('ember-protocol-onboarded', '1');
    } catch {
      // Onboarding flag is a convenience; ignoring storage is safe.
    }
    this.renderGuide();
  }
  private guideTabBtn(tab: 'story' | 'controls' | 'practice', label: string) {
    return `<button class="guide-tab ${this.guideTab === tab ? 'on' : ''}" data-action="guideTab" data-tab="${tab}">${label}</button>`;
  }
  private ctrlRow(key: string, label: string) {
    return `<div class="ctrl-row"><kbd>${key}</kbd><span>${label}</span></div>`;
  }
  /** Thematic vector art for each story chapter (background of the game). */
  private storyArt(step: number): string {
    const c = {
      ink: '#8fa580',
      glow: '#efb58a',
      peach: '#f0c79c',
      line: '#34493e',
      leaf: '#c8d6b1',
      dim: '#5c715f',
      mono: "Consolas, 'Microsoft YaHei', monospace",
    };
    if (step === 0)
      return `<svg viewBox="0 0 320 140" role="img" aria-hidden="true">
        <line x1="18" y1="118" x2="302" y2="118" stroke="${c.line}" stroke-width="2"/>
        <circle cx="104" cy="98" r="42" fill="${c.glow}" opacity="0.13"/>
        <circle cx="104" cy="98" r="15" fill="${c.peach}"/>
        <g stroke="${c.ink}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round">
          <path d="M104 98 L86 44 M104 98 L122 44 M86 44 L122 44"/>
          <path d="M93 70 L111 70 M90 86 L118 86 M104 98 L104 118"/>
        </g>
        <g fill="${c.glow}"><circle cx="150" cy="40" r="2.4"/><circle cx="168" cy="28" r="1.8"/><circle cx="186" cy="46" r="2"/><circle cx="202" cy="32" r="1.6"/></g>
        <line x1="34" y1="58" x2="288" y2="58" stroke="${c.glow}" stroke-width="2" stroke-dasharray="9 9" opacity="0.6"/>
        <text x="288" y="52" text-anchor="end" font-size="9" fill="${c.dim}" font-family="${c.mono}" letter-spacing="1">CORDON</text>
      </svg>`;
    if (step === 1)
      return `<svg viewBox="0 0 320 140" role="img" aria-hidden="true">
        <circle cx="160" cy="70" r="28" fill="${c.glow}" opacity="0.14"/>
        <circle cx="160" cy="70" r="14" fill="${c.peach}"/>
        <circle cx="160" cy="70" r="22" fill="none" stroke="${c.ink}" stroke-width="2" stroke-dasharray="4 5"/>
        <g stroke="${c.ink}" stroke-width="2" opacity="0.75">
          <line x1="160" y1="70" x2="64" y2="40"/><line x1="160" y1="70" x2="252" y2="44"/>
          <line x1="160" y1="70" x2="70" y2="108"/><line x1="160" y1="70" x2="250" y2="104"/>
        </g>
        <g fill="${c.leaf}"><path d="M58 34 l8 10 l-8 10 l-8 -10 z"/><path d="M256 38 l7 9 l-7 9 l-7 -9 z"/><path d="M64 102 l7 9 l-7 9 l-7 -9 z"/><path d="M252 100 l7 9 l-7 9 l-7 -9 z"/></g>
        <g fill="${c.glow}"><circle cx="110" cy="52" r="2"/><circle cx="210" cy="54" r="2"/><circle cx="112" cy="92" r="1.8"/><circle cx="208" cy="90" r="1.8"/></g>
      </svg>`;
    if (step === 2)
      return `<svg viewBox="0 0 320 140" role="img" aria-hidden="true">
        <path d="M40 100 C90 40 150 40 180 70 S260 110 284 56" fill="none" stroke="${c.line}" stroke-width="2" stroke-dasharray="6 7"/>
        <circle cx="40" cy="100" r="7" fill="${c.peach}"/>
        <circle cx="120" cy="64" r="6" fill="${c.ink}"/><circle cx="186" cy="74" r="6" fill="${c.ink}"/><circle cx="244" cy="86" r="6" fill="${c.ink}"/>
        <circle cx="284" cy="56" r="10" fill="${c.glow}" opacity="0.2"/><circle cx="284" cy="56" r="8" fill="none" stroke="${c.glow}" stroke-width="2"/>
        <path d="M278 50 l14 6 l-14 6 z" fill="${c.leaf}"/>
        <text x="40" y="122" text-anchor="middle" font-size="8" fill="${c.dim}" font-family="${c.mono}">YOU</text>
        <text x="284" y="82" text-anchor="middle" font-size="8" fill="${c.glow}" font-family="${c.mono}">WARDEN</text>
      </svg>`;
    return `<svg viewBox="0 0 320 140" role="img" aria-hidden="true">
      <line x1="18" y1="120" x2="302" y2="120" stroke="${c.line}" stroke-width="2"/>
      <g fill="${c.peach}"><circle cx="160" cy="40" r="12"/><path d="M142 98 q0 -40 18 -40 q18 0 18 40 z"/></g>
      <g transform="translate(96,74)"><circle r="14" fill="none" stroke="${c.ink}" stroke-width="2"/><line x1="-15" y1="-15" x2="15" y2="15" stroke="${c.glow}" stroke-width="2"/></g>
      <text x="96" y="104" text-anchor="middle" font-size="8" fill="${c.dim}" font-family="${c.mono}">NO GOLD</text>
      <g transform="translate(160,74)" fill="${c.leaf}"><path d="M-9 -12 h11 v13 h9 v7 h-20 z"/></g>
      <text x="160" y="104" text-anchor="middle" font-size="8" fill="${c.dim}" font-family="${c.mono}">FOOTING</text>
      <g transform="translate(224,74)" fill="${c.leaf}"><circle cy="-7" r="6"/><path d="M-8 12 q0 -16 8 -16 q8 0 8 16 z"/></g>
      <text x="224" y="104" text-anchor="middle" font-size="8" fill="${c.dim}" font-family="${c.mono}">ALLY</text>
    </svg>`;
  }
  private renderGuide() {
    const g = this.nodes['guide'];
    if (!g) return;
    g.classList.toggle('hidden', !this.guideOpen);
    if (!this.guideOpen) {
      g.innerHTML = '';
      return;
    }
    const t = (key: TranslationKey) => this.i18n.t(key);
    const chapterTitle = `storyCh${this.guideStep + 1}Title` as TranslationKey;
    const chapterBody = `storyCh${this.guideStep + 1}` as TranslationKey;
    const storyTab = `
      <div class="story-wrap">
        <div class="eyebrow"><span></span> ${t('storyEyebrow')}</div>
        <div class="chapter in">
          <div class="chapter-art">${this.storyArt(this.guideStep)}</div>
          <h3>${t(chapterTitle)}</h3>
          <p>${t(chapterBody)}</p>
        </div>
        <div class="progress">${[1, 2, 3, 4].map((i) => `<i class="${i - 1 === this.guideStep ? 'on' : ''}"></i>`).join('')}</div>
        <div class="guide-nav">
          <button class="text-button" data-action="guideStep" data-dir="prev" ${this.guideStep === 0 ? 'disabled' : ''}>${icon('arrow', 14)} ${t('guidePrev')}</button>
          ${
            this.guideStep < this.guideChapters - 1
              ? `<button class="start-button guide-next" data-action="guideStep" data-dir="next"><span>${t('guideNext')}</span>${icon('arrow', 18)}</button>`
              : `<button class="start-button guide-next" data-action="guideTab" data-tab="controls"><span>${t('controlsTitle')}</span>${icon('arrow', 18)}</button>`
          }
        </div>
      </div>`;
    const controlsTab = `
      <div class="controls-wrap">
        <div class="eyebrow"><span></span> ${t('controlsTitle')}</div>
        <div class="controls-list">
          ${this.ctrlRow('W A S D', t('ctrlMove'))}
          ${this.ctrlRow(icon('mouse', 15) + ' L', t('ctrlAim'))}
          ${this.ctrlRow('SPACE / SHIFT', t('ctrlDash'))}
          ${this.ctrlRow('R', t('ctrlReload'))}
          ${this.ctrlRow('E', t('ctrlInteract'))}
          ${this.ctrlRow('ESC', t('ctrlPause'))}
        </div>
        <div class="practice-actions">
          <button class="start-button" data-action="guideStart"><span>${t('guideStart')}</span>${icon('arrow', 18)}</button>
          <button class="text-button" data-action="guideTab" data-tab="practice">${t('guidePractice')}</button>
        </div>
      </div>`;
    const practiceTab = `
      <div class="practice-wrap">
        <div class="eyebrow"><span></span> ${t('practiceTitle')}</div>
        <p class="guide-lead">${t('practiceIntro')}</p>
        <div class="practice-actions">
          <button class="start-button" data-action="train"><span>${t('guidePractice')}</span>${icon('arrow', 18)}</button>
          <button class="text-button" data-action="guideStart">${t('guideStart')}</button>
        </div>
      </div>`;
    const tabContent =
      this.guideTab === 'story'
        ? storyTab
        : this.guideTab === 'controls'
          ? controlsTab
          : practiceTab;
    g.innerHTML = `
      <div class="guide-card">
        <div class="guide-head">
          <div class="guide-brand">${icon('book', 18)} <b>${t('guideTitle')}</b></div>
          <div class="guide-head-tools">
            <button class="icon-button language-button" data-action="guideLang" title="${t('languageTitle')}">${this.i18n.isChinese ? 'EN' : '中文'}</button>
            <button class="icon-button" data-action="guideClose" aria-label="${t('guideClose')}" title="${t('guideClose')}">✕</button>
          </div>
        </div>
        <div class="guide-tabs">
          ${this.guideTabBtn('story', t('tabStory'))}
          ${this.guideTabBtn('controls', t('tabControls'))}
          ${this.guideTabBtn('practice', t('tabPractice'))}
        </div>
        <div class="guide-body">${tabContent}</div>
      </div>`;
  }
  private renderTraining() {
    const el = this.nodes['training'];
    if (!el) return;
    const show = this.model.training;
    el.classList.toggle('hidden', !show);
    if (!show) {
      el.innerHTML = '';
      this.trainKey = '';
      return;
    }
    const t = (key: TranslationKey) => this.i18n.t(key);
    const done = this.model.trainingDone;
    const complete = done.has('shoot') && done.has('dash') && done.has('crate');
    const key = `${complete}|${[...done].sort().join(',')}`;
    if (key === this.trainKey) return;
    this.trainKey = key;
    const step = (id: string, k: TranslationKey) =>
      `<div class="train-step ${done.has(id) ? 'done' : ''}"><span class="train-check">${done.has(id) ? icon('check', 14) : ''}</span><span>${t(k)}</span></div>`;
    el.innerHTML = `
      <div class="train-head"><b>${t('trainTitle')}</b><span>${t('trainHint')}</span></div>
      <div class="train-steps">
        ${step('shoot', 'trainShoot')}
        ${step('dash', 'trainDash')}
        ${step('crate', 'trainCrate')}
        ${step('reload', 'trainReload')}
      </div>
      ${
        complete
          ? `<div class="train-done">${t('trainDone')}</div><button class="start-button train-exit" data-action="trainEnd"><span>${t('trainExit')}</span>${icon('arrow', 18)}</button>`
          : ''
      }`;
  }
  private renderCoach() {
    const el = this.nodes['coach'];
    if (!el) return;
    const m = this.model;
    if (m.levelIndex !== 0 || m.phase === 'won' || m.phase === 'lost') {
      el.innerHTML = '';
      return;
    }
    const t = (key: TranslationKey) => this.i18n.t(key);
    const shell = document.querySelector('.arena-shell') as HTMLElement | null;
    if (!shell) return;
    const r = shell.getBoundingClientRect();
    const sx = r.width / 1280;
    const sy = r.height / 800;
    const place = (wx: number, wy: number) =>
      `left:${(wx * sx).toFixed(1)}px;top:${(wy * sy).toFixed(1)}px;`;
    let html = '';
    // Crates are the E-interactable pickup the coach layer points at.
    const wp = m.pickups.find((p) => p.kind === 'crate');
    if (wp)
      html += `<div class="coach-pickup" style="${place(wp.x, wp.y - 50)}"><kbd>E</kbd><span>${t('ctrlInteract')}</span></div>`;
    if (m.phase === 'exit')
      html += `<div class="coach-portal" style="${place(1145, 330)}"><span>→</span><small>${t('roomPortalHint')}</small></div>`;
    if (m.shotsFired === 0 && !m.training)
      html += `<div class="coach-shoot">${t('roomShootHint')}</div>`;
    else if (!m.dashed && !m.training)
      html += `<div class="coach-shoot">${t('roomDashHint')}</div>`;
    el.innerHTML = html;
  }

  destroy() {
    window.clearInterval(this.timer);
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
    this.unsubscribeLanguage();
    document.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('input', this.onInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
