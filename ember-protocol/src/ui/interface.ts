import { LEVELS, SKILLS, WEAPONS } from '../game/config';
import { distance } from '../game/math';
import type { Simulation } from '../game/simulation';
import type { AudioEngine } from '../game/audio';
import type { SkillId } from '../game/types';
import { gunIcon, icon } from './icons';

export class Interface {
  private squad = false;
  private overlayKey = '';
  private weaponKey = '';
  private skillKey = '';
  private timer: number;
  private nodes: Record<string, HTMLElement> = {};
  constructor(
    private model: Simulation,
    private audio: AudioEngine,
  ) {
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <a class="brand" href="#" data-action="home" aria-label="余烬协议首页"><span class="brand-mark">${icon('bolt', 27)}</span><span>余烬协议<small>EMBER PROTOCOL</small></span></a>
          <nav class="route" aria-label="关卡进度">${LEVELS.map((l, i) => `<div class="route-node" data-room="${i}"><span>0${i + 1}</span><div>${l.name}</div></div>${i < 2 ? '<i></i>' : ''}`).join('')}</nav>
          <div class="tools"><span class="build-tag">PLAYABLE DEMO <b>0.1</b></span><button class="icon-button" data-action="sound" aria-label="关闭音效" title="音效开关">${icon('volume')}</button><button class="icon-button" data-action="pause" aria-label="暂停游戏" title="暂停 · Esc">${icon('pause')}</button><button class="icon-button" data-action="fullscreen" aria-label="全屏" title="全屏">${icon('full')}</button></div>
        </header>
        <main class="workspace">
          <section class="field-wrap">
            <div class="field-top"><div><span class="live-dot"></span><span id="field-status">训练模拟 / 待命</span></div><span>TOP-DOWN ROGUELITE <i>✦</i> SECTOR <b id="sector-number">01</b></span></div>
            <div class="arena-shell">
              <div id="game" aria-label="游戏画面：WASD 移动，鼠标瞄准开火，空格闪避，E 拾取"></div>
              <div class="arena-ui" id="arena-hud">
                <div class="room-label"><span id="room-code">SECTOR 01 / THE OVERGROWN ATRIUM</span><h2 id="room-name">孢子中庭</h2><p id="room-hint">清除感染群，重新接通传送门</p></div>
                <div class="wave-pill" id="wave-pill"></div>
                <div class="boss-bar" id="boss-bar"><div><b>孢核守卫</b><span>THE SPORE WARDEN</span></div><i><em id="boss-fill"></em></i></div>
                <div class="combat-hud"><div class="health-card"><div class="health-title">${icon('plus', 15)}<span>生命值</span><b id="health-value">100 <small>/ 100</small></b></div><div class="health-track"><i id="health-fill"></i></div><div class="dash-line"><span>闪避推进器 <kbd>SPACE</kbd></span><b id="dash-value">就绪</b></div><div class="dash-track"><i id="dash-fill"></i></div></div><div class="ammo-card"><div class="ammo-icon">${icon('target', 16)} <span id="ammo-name">游骑兵</span></div><div><strong id="ammo-value">30</strong><span id="ammo-max">/ 30</span><kbd>R</kbd></div></div></div>
                <div id="interaction" class="interaction"></div><div id="combo" class="combo"></div>
              </div>
              <div id="overlay" class="overlay"></div>
            </div>
            <div class="field-bottom"><span><i class="small-dot"></i><span id="mission-line">选择行动模式，进入第 01 号隔离区</span></span><span id="run-clock">00:00</span></div>
          </section>
          <aside class="sidebar">
            <section class="mission-panel"><div class="panel-eyebrow"><span>行动简报</span><span>BRIEFING / 01</span></div><h2>深入隔离区<span>熄灭最后的感染源。</span></h2><div class="mission-route">${LEVELS.map((l, i) => `<div class="mission-step" data-step="${i}"><span class="step-marker">${i + 1}</span><div><b>${l.name}</b><small>${i === 0 ? '清除感染群' : i === 1 ? '突破重甲防线' : '击败孢核守卫'}</small></div><span class="step-check"></span></div>`).join('')}</div><div class="run-stats"><div><small>已清除</small><b id="kills">00</b></div><div><small>最高连击</small><b id="best-combo">00</b></div><div><small>行动模式</small><b id="mode-label" class="mode-stat">单人</b></div></div></section>
            <section class="loadout-panel"><div class="panel-eyebrow"><span>当前装备</span><kbd>Q 切换</kbd></div><div id="weapon-card"></div></section>
            <section class="skills-panel"><div class="panel-eyebrow"><span>技能模块</span><span id="skill-count">0 / 4</span></div><div id="skills-list"></div><p class="panel-note">拾取模块，组合属于你的战斗风格。</p></section>
            <div class="fair-note">${icon('shield', 18)}<div>每关满状态出发<small>无金币 · 无商店 · 只靠火力与配合</small></div></div>
          </aside>
        </main>
        <footer><div class="controls"><span><kbd>W A S D</kbd> 移动</span><span>${icon('mouse', 15)} 瞄准 / 开火</span><span><kbd>SPACE</kbd> 闪避</span><span><kbd>E</kbd> 拾取 / 进入</span><span><kbd>R</kbd> 换弹</span><span><kbd>ESC</kbd> 暂停</span></div><span class="footer-note">一个房间。一次选择。再向前一步。</span></footer>
      </div>`;
    document.querySelectorAll<HTMLElement>('[id]').forEach((e) => (this.nodes[e.id] = e));
    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ['combat', 'exit'].includes(this.model.phase))
        this.model.paused = true;
    });
    this.timer = window.setInterval(() => this.refresh(), 70);
    this.refresh();
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
    }
    if (e.code === 'KeyM') {
      this.audio.toggle();
      this.updateSound();
    }
  };
  private onClick = (e: MouseEvent) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) return;
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
      this.audio.toggle();
      this.updateSound();
    }
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document
          .querySelector('.shell')!
          .requestFullscreen()
          .catch(() => {
            this.nodes['mission-line'].textContent = '当前预览不支持全屏；可在浏览器打开试玩链接。';
          });
    }
    if (action === 'skill') this.model.chooseSkill(button.dataset.skill as SkillId);
    this.refresh();
  };
  private updateSound() {
    const b = document.querySelector<HTMLElement>('[data-action="sound"]')!;
    b.innerHTML = icon(this.audio.muted ? 'mute' : 'volume');
    b.setAttribute('aria-label', this.audio.muted ? '开启音效' : '关闭音效');
  }
  private togglePause() {
    if (['combat', 'exit'].includes(this.model.phase)) this.model.paused = !this.model.paused;
    this.refresh();
  }
  private set(id: string, text: string) {
    if (this.nodes[id].textContent !== text) this.nodes[id].textContent = text;
  }
  refresh() {
    const m = this.model,
      p = m.player,
      menu = m.phase === 'menu';
    this.nodes['arena-hud'].classList.toggle('hidden', menu);
    this.set(
      'field-status',
      menu
        ? '训练模拟 / 待命'
        : m.paused
          ? '行动已暂停'
          : m.phase === 'exit'
            ? '区域安全 / 传送门开启'
            : '现场信号 / 已连接',
    );
    this.set('sector-number', String(m.levelIndex + 1).padStart(2, '0'));
    this.set('room-code', `SECTOR 0${m.levelIndex + 1} / ${m.level.en}`);
    this.set('room-name', m.level.name);
    this.set('room-hint', m.level.subtitle);
    this.set(
      'wave-pill',
      m.phase === 'exit'
        ? '✓  区域肃清'
        : `WAVE ${String(m.waveIndex).padStart(2, '0')} / 02  ·  ${m.remaining} 个目标`,
    );
    this.nodes['health-value'].innerHTML = `${Math.ceil(p.hp)} <small>/ ${p.maxHp}</small>`;
    this.nodes['health-fill'].style.width = `${(p.hp / p.maxHp) * 100}%`;
    this.nodes['health-fill'].classList.toggle('critical', p.hp < 35);
    this.set('dash-value', p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : '就绪');
    this.nodes['dash-fill'].style.width =
      `${Math.max(0, 1 - p.dashCooldown / (m.skills.includes('nova') ? 1.65 : 2.2)) * 100}%`;
    this.set('ammo-name', m.weapon.name);
    this.set('ammo-value', p.reloadRemaining > 0 ? '··' : String(p.ammo).padStart(2, '0'));
    this.set('ammo-max', p.reloadRemaining > 0 ? '换弹中' : `/ ${m.weapon.magazine}`);
    this.set('mission-line', menu ? '选择行动模式，进入第 01 号隔离区' : m.hint);
    this.set(
      'run-clock',
      `${String(Math.floor(m.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}`,
    );
    this.set('kills', String(m.kills).padStart(2, '0'));
    this.set('best-combo', String(m.bestCombo).padStart(2, '0'));
    this.set('mode-label', (menu ? this.squad : m.squad) ? 'AI 协作' : '单人');
    this.nodes['boss-bar'].style.display = m.boss ? 'block' : 'none';
    if (m.boss) this.nodes['boss-fill'].style.width = `${(m.boss.hp / m.boss.maxHp) * 100}%`;
    const item = m.nearestPickup;
    let prompt = '';
    if (item && distance(item, p) < 78)
      prompt = `<kbd>E</kbd> ${item.kind === 'module' ? '拾取技能模块' : `装备 ${WEAPONS[item.weapon!].name}`}`;
    else if (m.phase === 'exit' && distance(p, { x: 1160, y: 400 }) < 110)
      prompt = `<kbd>E</kbd> ${m.isLastLevel ? '完成行动 · 撤离' : '进入下一关'}`;
    else if (m.phase === 'exit') prompt = '前往右侧传送门 <span>→</span>';
    this.nodes['interaction'].innerHTML = prompt;
    this.nodes['interaction'].classList.toggle('visible', !!prompt);
    this.set('combo', m.combo >= 2 ? `${m.combo} × 连击` : '');
    document.querySelectorAll<HTMLElement>('[data-room]').forEach((el) => {
      el.classList.toggle('current', Number(el.dataset.room) === m.levelIndex);
      el.classList.toggle('complete', Number(el.dataset.room) < m.levelIndex);
    });
    document.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
      const i = Number(el.dataset.step);
      el.classList.toggle('current', i === m.levelIndex);
      el.classList.toggle('complete', i < m.levelIndex);
      el.querySelector('.step-check')!.innerHTML =
        i < m.levelIndex
          ? icon('check', 15)
          : i === m.levelIndex
            ? '<span class="small-dot"></span>'
            : '';
    });
    const wk = p.weapon + m.inventory.join();
    if (wk !== this.weaponKey) {
      this.weaponKey = wk;
      this.nodes['weapon-card'].innerHTML =
        `<div class="weapon-art">${gunIcon(p.weapon)}<span>0${m.inventory.indexOf(p.weapon) + 1}</span></div><div class="weapon-name"><h3>${m.weapon.name}</h3><span>${m.weapon.id.toUpperCase()}</span></div><div class="weapon-type">${m.weapon.label}</div><p>${m.weapon.description}</p><div class="weapon-bars"><span>火力 <i><b style="width:${p.weapon === 'shotgun' ? 90 : p.weapon === 'arc' ? 43 : 62}%"></b></i></span><span>射速 <i><b style="width:${p.weapon === 'shotgun' ? 28 : p.weapon === 'arc' ? 96 : 69}%"></b></i></span></div>`;
    }
    const sk = m.skills.join();
    if (sk !== this.skillKey || !this.nodes['skills-list'].innerHTML) {
      this.skillKey = sk;
      this.set('skill-count', `${m.skills.length} / 4`);
      this.nodes['skills-list'].innerHTML = m.skills.length
        ? m.skills
            .map((id) => {
              const s = SKILLS.find((s) => s.id === id)!;
              return `<div class="equipped-skill" title="${s.description}"><i style="color:${s.color}">${icon(s.icon, 19)}</i><div><b>${s.name}</b><small>${s.tag}</small></div></div>`;
            })
            .join('')
        : `<div class="empty-slots"><span>+</span><span>+</span><span>+</span><span>+</span></div><div class="empty-label">等待发现第一个模块</div>`;
    }
    this.renderOverlay();
  }
  private renderOverlay() {
    const m = this.model,
      key = `${m.phase}-${m.paused}-${this.squad}-${m.skills.join()}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const overlay = this.nodes.overlay;
    overlay.className = 'overlay';
    overlay.innerHTML = '';
    if (m.phase === 'menu') {
      overlay.classList.add('menu-overlay');
      overlay.innerHTML = `<div class="menu-content"><div class="eyebrow"><span></span> PROJECT EMBER / 战斗原型</div><h1>余烬之下，<br><em>火力全开。</em></h1><p class="menu-description">深入被遗忘的隔离区。闪避、开火、重组技能。<br>带上你的战友，把下一扇门打穿。</p><div class="mode-switch" role="group" aria-label="行动模式"><button data-action="solo" class="${!this.squad ? 'selected' : ''}">${icon('person', 18)} 单人行动</button><button data-action="squad" class="${this.squad ? 'selected' : ''}">${icon('people', 19)} AI 战友</button></div><button class="start-button" data-action="start"><span>进入隔离区</span>${icon('arrow', 22)}</button><div class="menu-meta"><span>3 个区域</span><i></i><span>3 把枪械</span><i></i><span>6 种技能模块</span></div><div class="menu-tip">${icon('info', 14)} 桌面键鼠体验 · 首关满血出发 · 拾取无需花费</div></div><div class="arena-stamp"><span>FIELD TEST</span><strong>01—03</strong><small>一场行动，无数种打法。</small></div>`;
    } else if (m.phase === 'upgrade') {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="upgrade-modal"><div class="eyebrow">A NEW POSSIBILITY / 模块已回收</div><h2>让下一次开火，<em>有点不同。</em></h2><p>选择一个技能。本次行动持续生效，可以与枪械自由组合。</p><div class="upgrade-options">${m.options.map((s, i) => `<button class="upgrade-option" data-action="skill" data-skill="${s.id}"><span class="option-index">MODULE / 0${i + 1}</span><i style="color:${s.color}">${icon(s.icon, 34)}</i><span class="skill-tag" style="color:${s.color}">${s.tag}</span><h3>${s.name}</h3><p>${s.description}</p><span class="choose-label">装配模块 ${icon('arrow', 17)}</span></button>`).join('')}</div><small>战斗已暂停 · 做好选择，再出发</small></div>`;
    } else if (m.phase === 'won' || m.phase === 'lost') {
      const won = m.phase === 'won';
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="result-modal"><div class="result-emblem">${icon(won ? 'flag' : 'shield', 44)}</div><div class="eyebrow">${won ? 'MISSION COMPLETE' : 'SIGNAL LOST'}</div><h2>${won ? '余烬尚在，行动完成。' : '这次，先到这里。'}</h2><p>${won ? '三个隔离区已肃清。下一次，试试另一套技能组合。' : '换一把枪，利用掩体，记得用闪避穿过弹幕。'}</p><div class="result-stats"><div><b>${m.kills}</b><small>感染体已清除</small></div><div><b>${m.bestCombo}</b><small>最高连击</small></div><div><b>${Math.floor(m.elapsed / 60)}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}</b><small>行动用时</small></div></div><button class="start-button" data-action="start"><span>再来一次</span>${icon('reset')}</button><button class="text-button" data-action="home">返回行动准备</button></div>`;
    } else if (m.paused) {
      overlay.classList.add('modal-overlay');
      overlay.innerHTML = `<div class="pause-modal"><div class="eyebrow">TAKE A BREATH</div><h2>喘口气，再继续。</h2><p>战斗已暂停。切换窗口时也会自动暂停。</p><button class="start-button" data-action="resume"><span>继续行动</span>${icon('play')}</button><button class="text-button" data-action="home">结束本次行动，返回准备</button><div class="pause-controls"><span>WASD 移动 · 鼠标左键 开火</span><span>Space / Shift 闪避 · R 换弹</span><span>E 拾取 / 传送 · Q 切换枪械</span></div></div>`;
    }
  }
  destroy() {
    window.clearInterval(this.timer);
    document.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKey);
  }
}
