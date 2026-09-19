import { LEVELS, SKILLS, WEAPONS } from '../game/config';
import { distance } from '../game/math';
import type { AudioEngine } from '../game/audio';
import type { Simulation } from '../game/simulation';
import type { SkillId } from '../game/types';
import type { I18n, TranslationKey } from '../i18n';
import { gunIcon, icon } from './icons';

export class Interface {
  private squad = false;
  private soundPanelOpen = false;
  private overlayKey = '';
  private weaponKey = '';
  private skillKey = '';
  private soundKey = '';
  private notice = '';
  private noticeTimer?: number;
  private timer: number;
  private unsubscribeLanguage: () => void = () => undefined;
  private nodes: Record<string, HTMLElement> = {};

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
          <nav class="route" data-i18n-aria="progressLabel" aria-label="${t('progressLabel')}">${LEVELS.map((level, i) => `<div class="route-node" data-room="${i}"><span>0${i + 1}</span><div data-level-name="${i}">${this.i18n.text(level.name)}</div></div>${i < 2 ? '<i></i>' : ''}`).join('')}</nav>
          <div class="tools"><span class="build-tag">PLAYABLE DEMO <b>0.2</b></span><button class="icon-button language-button" data-action="language" data-i18n-title="languageTitle" data-i18n-aria="languageTitle" title="${t('languageTitle')}" aria-label="${t('languageTitle')}"><span id="language-label">${this.i18n.isChinese ? 'EN' : '中文'}</span></button><button class="icon-button" data-action="sound" data-i18n-title="soundToggle" data-i18n-aria="soundToggle" title="${t('soundToggle')}" aria-label="${t('soundToggle')}">${icon('volume')}</button><div class="sound-panel" id="sound-panel"></div><button class="icon-button" data-action="pause" data-i18n-aria="pauseGame" data-i18n-title="pauseTitle" aria-label="${t('pauseGame')}" title="${t('pauseTitle')}">${icon('pause')}</button><button class="icon-button" data-action="fullscreen" data-i18n-aria="fullscreen" data-i18n-title="fullscreen" aria-label="${t('fullscreen')}" title="${t('fullscreen')}">${icon('full')}</button></div>
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
              </div>
              <div id="overlay" class="overlay"></div>
            </div></div>
            <div class="field-bottom"><span><i class="small-dot"></i><span id="mission-line">${t('chooseMode')}</span></span><span id="run-clock">00:00</span></div>
          </section>
          <aside class="sidebar">
            <section class="mission-panel"><div class="panel-eyebrow"><span data-i18n="briefing">${t('briefing')}</span><span>BRIEFING / 01</span></div><h2><span data-i18n="missionTitle">${t('missionTitle')}</span><span data-i18n="missionSubtitle">${t('missionSubtitle')}</span></h2><div class="mission-route">${LEVELS.map((level, i) => `<div class="mission-step" data-step="${i}"><span class="step-marker">${i + 1}</span><div><b data-level-name="${i}">${this.i18n.text(level.name)}</b><small data-objective="${i}">${t(`levelObjective${i + 1}` as TranslationKey)}</small></div><span class="step-check"></span></div>`).join('')}</div><div class="run-stats"><div><small data-i18n="clearedCount">${t('clearedCount')}</small><b id="kills">00</b></div><div><small data-i18n="bestCombo">${t('bestCombo')}</small><b id="best-combo">00</b></div><div><small data-i18n="operationMode">${t('operationMode')}</small><b id="mode-label" class="mode-stat">${t('solo')}</b></div></div></section>
            <section class="loadout-panel"><div class="panel-eyebrow"><span data-i18n="currentLoadout">${t('currentLoadout')}</span><kbd data-i18n="switchWeapon">${t('switchWeapon')}</kbd></div><div id="weapon-card"></div></section>
            <section class="skills-panel"><div class="panel-eyebrow"><span data-i18n="skillModules">${t('skillModules')}</span><span id="skill-count">0 / 4</span></div><div id="skills-list"></div><p class="panel-note" data-i18n="skillNote">${t('skillNote')}</p></section>
            <div class="fair-note">${icon('shield', 18)}<div><span data-i18n="fullState">${t('fullState')}</span><small data-i18n="noEconomy">${t('noEconomy')}</small></div></div>
          </aside>
        </main>
        <footer><div class="controls"><span><kbd>W A S D</kbd> <span data-i18n="move">${t('move')}</span></span><span>${icon('mouse', 15)} <span data-i18n="aimFire">${t('aimFire')}</span></span><span><kbd>SPACE</kbd> <span data-i18n="dash">${t('dash')}</span></span><span><kbd>E</kbd> <span data-i18n="pickupEnter">${t('pickupEnter')}</span></span><span><kbd>R</kbd> <span data-i18n="reload">${t('reload')}</span></span><span><kbd>ESC</kbd> <span data-i18n="pause">${t('pause')}</span></span></div><span class="footer-note" data-i18n="footerMotto">${t('footerMotto')}</span></footer>
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
      this.model.start(this.squad);
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
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document
          .querySelector('.shell')!
          .requestFullscreen()
          .catch(() => this.showNotice(this.i18n.t('fullscreenUnavailable')));
    }
    if (action === 'skill') this.model.chooseSkill(button.dataset.skill as SkillId);
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
    this.skillKey = '';
    this.updateSound();
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
    this.nodes['dash-fill'].style.width =
      `${Math.max(0, 1 - p.dashCooldown / (m.skills.includes('nova') ? 1.65 : 2.2)) * 100}%`;
    this.set('ammo-name', this.i18n.text(m.weapon.name));
    this.set('ammo-value', p.reloadRemaining > 0 ? '··' : String(p.ammo).padStart(2, '0'));
    this.set('ammo-max', p.reloadRemaining > 0 ? text('reloading') : `/ ${m.weapon.magazine}`);
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
    if (m.boss) this.nodes['boss-fill'].style.width = `${(m.boss.hp / m.boss.maxHp) * 100}%`;

    const item = m.nearestPickup;
    let prompt = '';
    if (item && distance(item, p) < 78)
      prompt = `<kbd>E</kbd> ${item.kind === 'module' ? text('pickupModule') : text('equipWeapon', { name: this.i18n.text(WEAPONS[item.weapon!].name) })}`;
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

    const weaponKey = `${p.weapon}-${m.inventory.join()}-${this.i18n.locale}`;
    if (weaponKey !== this.weaponKey) {
      this.weaponKey = weaponKey;
      this.nodes['weapon-card'].innerHTML =
        `<div class="weapon-art">${gunIcon(p.weapon)}<span>0${m.inventory.indexOf(p.weapon) + 1}</span></div><div class="weapon-name"><h3>${this.i18n.text(m.weapon.name)}</h3><span>${m.weapon.id.toUpperCase()}</span></div><div class="weapon-type">${this.i18n.text(m.weapon.label)}</div><p>${this.i18n.text(m.weapon.description)}</p><div class="weapon-bars"><span>${text('firepower')} <i><b style="width:${p.weapon === 'shotgun' ? 90 : p.weapon === 'arc' ? 43 : 62}%"></b></i></span><span>${text('fireRate')} <i><b style="width:${p.weapon === 'shotgun' ? 28 : p.weapon === 'arc' ? 96 : 69}%"></b></i></span></div>`;
    }
    const skillKey = `${m.skills.join()}-${this.i18n.locale}`;
    if (skillKey !== this.skillKey || !this.nodes['skills-list'].innerHTML) {
      this.skillKey = skillKey;
      this.set('skill-count', `${m.skills.length} / 4`);
      this.nodes['skills-list'].innerHTML = m.skills.length
        ? m.skills
            .map((id) => {
              const skill = SKILLS.find((candidate) => candidate.id === id)!;
              return `<div class="equipped-skill" title="${this.i18n.text(skill.description)}"><i style="color:${skill.color}">${icon(skill.icon, 19)}</i><div><b>${this.i18n.text(skill.name)}</b><small>${this.i18n.text(skill.tag)}</small></div></div>`;
            })
            .join('')
        : `<div class="empty-slots"><span>+</span><span>+</span><span>+</span><span>+</span></div><div class="empty-label">${text('emptySkill')}</div>`;
    }
    this.renderSoundPanel();
    this.renderOverlay();
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
    const key = `${m.phase}-${m.paused}-${this.squad}-${m.skills.join()}-${this.i18n.locale}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const overlay = this.nodes.overlay;
    overlay.className = 'overlay';
    overlay.innerHTML = '';
    if (m.phase === 'menu') {
      overlay.classList.add('menu-overlay');
      overlay.innerHTML = `<div class="menu-content"><div class="eyebrow"><span></span> ${t('menuEyebrow')}</div><h1>${t('heroLine1')}<br><em>${t('heroLine2')}</em></h1><p class="menu-description">${t('menuDescription1')}<br>${t('menuDescription2')}</p><div class="mode-switch" role="group" aria-label="${t('operationMode')}"><button data-action="solo" class="${!this.squad ? 'selected' : ''}">${icon('person', 18)} ${t('soloAction')}</button><button data-action="squad" class="${this.squad ? 'selected' : ''}">${icon('people', 19)} ${t('aiCompanion')}</button></div><button class="start-button" data-action="start"><span>${t('enterZone')}</span>${icon('arrow', 22)}</button><div class="menu-meta"><span>${t('threeAreas')}</span><i></i><span>${t('threeWeapons')}</span><i></i><span>${t('sixSkills')}</span></div><div class="menu-tip">${icon('info', 14)} ${t('desktopTip')}</div></div><div class="arena-stamp"><span>FIELD TEST</span><strong>01—03</strong><small>${t('runMotto')}</small></div>`;
    } else if (m.phase === 'upgrade') {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="upgrade-modal"><div class="eyebrow">${t('upgradeEyebrow')}</div><h2>${t('upgradeTitle1')}<em>${t('upgradeTitle2')}</em></h2><p>${t('upgradeDescription')}</p><div class="upgrade-options">${m.options.map((skill, i) => `<button class="upgrade-option" data-action="skill" data-skill="${skill.id}"><span class="option-index">MODULE / 0${i + 1}</span><i style="color:${skill.color}">${icon(skill.icon, 34)}</i><span class="skill-tag" style="color:${skill.color}">${this.i18n.text(skill.tag)}</span><h3>${this.i18n.text(skill.name)}</h3><p>${this.i18n.text(skill.description)}</p><span class="choose-label">${t('equipModule')} ${icon('arrow', 17)}</span></button>`).join('')}</div><small>${t('upgradePaused')}</small></div>`;
    } else if (m.phase === 'won' || m.phase === 'lost') {
      const won = m.phase === 'won';
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="result-modal"><div class="result-emblem">${icon(won ? 'flag' : 'shield', 44)}</div><div class="eyebrow">${won ? 'MISSION COMPLETE' : 'SIGNAL LOST'}</div><h2>${t(won ? 'wonTitle' : 'lostTitle')}</h2><p>${t(won ? 'wonDescription' : 'lostDescription')}</p><div class="result-stats"><div><b>${m.kills}</b><small>${t('enemiesCleared')}</small></div><div><b>${m.bestCombo}</b><small>${t('bestCombo')}</small></div><div><b>${Math.floor(m.elapsed / 60)}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}</b><small>${t('runTime')}</small></div></div><button class="start-button" data-action="start"><span>${t('retry')}</span>${icon('reset')}</button><button class="text-button" data-action="home">${t('returnHome')}</button></div>`;
    } else if (m.paused) {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="pause-modal"><div class="eyebrow">TAKE A BREATH</div><h2>${t('pauseHeading')}</h2><p>${t('pauseDescription')}</p><button class="start-button" data-action="resume"><span>${t('resume')}</span>${icon('play')}</button><button class="text-button" data-action="home">${t('endRun')}</button><div class="pause-controls"><span>${t('controlMoveFire')}</span><span>${t('controlDashReload')}</span><span>${t('controlPickupSwitch')}</span></div></div>`;
    }
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
