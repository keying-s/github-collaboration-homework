import * as THREE from 'three';
import { buildWorld, rayWalls, moveBody, hitTestBody, r2 } from './world.js';
import { Avatars } from './entities.js';
import { SFX } from './audio.js';
import { WEAPONS, ViewModel } from './weapons.js';
import { Host, Client } from './net.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ============ 全局渲染器 ============
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const SFX_ = new SFX();

// ============ 输入 ============
const keys = {};
let mouseDown = false, clickQueued = false, locked = false, sens = parseFloat(localStorage.getItem('cs_sens') || '1');
let CUR = null; // 当前游戏实例

addEventListener('keydown', e => {
  if (e.code === 'Tab') { e.preventDefault(); if (CUR) CUR.showBoard(true); }
  if (!CUR) return;
  keys[e.code] = true;
  if (e.code === 'Escape' && CUR.buyOpen) { CUR.closeBuy(); return; }
  if (e.code === 'KeyB') { CUR.toggleBuy(); return; }
  if (!locked) return;
  if (e.code === 'KeyR') CUR.startReload();
  const keymap = { Digit1: 'ak', Digit2: 'usp', Digit3: 'mp5', Digit4: 'awp' };
  if (keymap[e.code]) CUR.switchTo(keymap[e.code]);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Tab' && CUR) CUR.showBoard(false);
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  if (e.button !== 0 || !CUR) return;
  SFX_.ensure();
  if (!locked) { canvas.requestPointerLock(); return; }
  mouseDown = true; clickQueued = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('wheel', e => {
  if (!CUR || !locked) return;
  const list = CUR.ownedList();
  const i = list.indexOf(CUR.player.weapon);
  CUR.switchTo(list[(i + 1) % list.length]);
});
addEventListener('mousemove', e => {
  if (!locked || !CUR) return;
  const p = CUR.player;
  p.yaw -= e.movementX * 0.0022 * sens;
  p.pitch = clamp(p.pitch - e.movementY * 0.0022 * sens, -1.55, 1.55);
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && CUR && !CUR.joining && !CUR.buyOpen) CUR.showPause(true);
  if (locked) CUR && CUR.showPause(false);
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (CUR) { CUR.camera.aspect = innerWidth / innerHeight; CUR.camera.updateProjectionMatrix(); }
});

// ============ 特效池 ============
class FX {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.parts = [];
    // 曳光弹
    for (let i = 0; i < 26; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0 }));
      m.visible = false; scene.add(m);
      this.tracers.push({ m, life: 0 });
    }
    // 火花 / 血粒子
    const pgeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0xffcc66 }));
      m.visible = false; scene.add(m);
      this.parts.push({ m, life: 0, vel: new THREE.Vector3() });
    }
    this._tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  }

  tracer(from, to, color = 0xffe0a0) {
    const t = this.tracers.find(t => t.life <= 0) || this.tracers[0];
    const pos = t.m.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.m.material.color.setHex(color);
    t.m.material.opacity = 0.9;
    t.m.visible = true;
    t.life = 0.07;
  }

  burst(at, color, n = 6, spd = 3) {
    let c = 0;
    for (const p of this.parts) {
      if (p.life > 0) continue;
      p.m.material.color.setHex(color);
      p.m.position.copy(at);
      p.m.visible = true;
      p.life = 0.22 + Math.random() * 0.12;
      p.vel.set(Math.random() * 2 - 1, Math.random() * 1.6, Math.random() * 2 - 1).normalize().multiplyScalar(spd * (0.5 + Math.random()));
      if (++c >= n) break;
    }
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) t.m.visible = false;
    }
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.life <= 0) p.m.visible = false;
    }
  }

  clear() {
    for (const t of this.tracers) { t.life = 0; t.m.visible = false; }
    for (const p of this.parts) { p.life = 0; p.m.visible = false; }
  }
}

// ============ 游戏实例 ============
class Game {
  constructor(opts) {
    this.mode = opts.mode; // 'solo' | 'host' | 'join'
    this.myName = opts.name;
    this.myId = this.mode === 'join' ? '?' : 'H';
    this.myTeam = 0;
    this.joining = this.mode === 'join';
    this.score = [0, 0];
    this.roster = [];
    this.names = new Map();
    this.teams = new Map();
    this.quitFlag = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb8d0e8);
    this.scene.fog = new THREE.Fog(0xb8d0e8, 35, 95);
    this.scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x8a7a5c, 1.05));
    const dir = new THREE.DirectionalLight(0xfff2d9, 1.5);
    dir.position.set(20, 30, 10);
    this.scene.add(dir);

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.world = buildWorld(this.scene);
    this.avatars = new Avatars(this.scene);
    this.fx = new FX(this.scene);
    this.vm = new ViewModel(this.camera);

    this.player = {
      pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(),
      half: 0.35, h: 1.7, onGround: false,
      yaw: 0, pitch: 0, recoil: 0, bloom: 0,
      alive: true, hp: 100, team: 0,
      weapon: 'ak', mags: { ak: 30, usp: 12 }, res: { ak: 90, usp: 48 },
      nextShot: 0, reloading: false, reloadEnd: 0, eyeSmooth: 1.58,
      money: 1000, owned: { ak: true, usp: true },
    };
    this.buyOpen = false;
    this.respawnAt = 0;
    this.lastSendT = 0;
    this.hudT = 0;

    renderer.setSize(innerWidth, innerHeight);

    // 出生（加入模式等 init 再放）
    if (this.mode !== 'join') {
      const sp = this.world.spawns[0][2];
      this.player.pos.set(sp[0], sp[1], sp[2]);
      this.player.yaw = sp[3];
    }

    // 网络
    if (this.mode === 'solo') {
      this.net = new Host(this, { solo: true });
      for (let i = 0; i < 7; i++) this.net.addBot();
    } else if (this.mode === 'host') {
      this.net = new Host(this, {});
    } else {
      this.net = new Client(this, opts.code);
    }

    $('hud').style.display = 'block';
    $('menu').style.display = 'none';
    $('scMode').textContent = '团队死斗 · 30 杀获胜';
    if (this.mode !== 'join') $('pause').classList.add('host');
    if (this.mode === 'join') $('connstatus').style.display = 'flex';
    if (this.mode === 'solo') this.toast('已进入单人练习：你 vs 7 个机器人 · 按 B 打开武器商店');
  }

  // ---------- 网络回调 ----------
  netPlayers() { return this.net instanceof Host ? [...this.net.players.values()] : []; }

  onRoomCode(code) {
    this.roomCode = code;
    $('roombanner').style.display = 'block';
    $('roomcode').textContent = code;
    $('pause').classList.add('host');
    this.toast(`房间创建成功！房间码 ${code}，发给朋友一起玩`);
  }

  onNetError(msg) {
    if (this.quitFlag) return;
    this.quitFlag = true;
    $('connstatus').style.display = 'flex';
    $('connstatus').querySelector('.spin').style.display = 'none';
    $('connText').textContent = msg;
    setTimeout(() => quitToMenu(), 2600);
  }

  onHostGone() {
    if (this.quitFlag) return;
    this.quitFlag = true;
    this.toast('房主已退出，返回菜单');
    setTimeout(() => quitToMenu(), 1500);
  }

  clientInit(m) {
    this.myId = m.you;
    this.myTeam = m.team;
    this.player.team = m.team;
    this.player.pos.set(m.spawn[0], m.spawn[1], m.spawn[2]);
    this.player.yaw = m.spawn[3];
    this.score = m.sc || [0, 0];
    this.onRoster(m.roster || []);
    this.joining = false;
    $('connstatus').style.display = 'none';
    $('connstatus').querySelector('.spin').style.display = 'block';
    this.toast(`已加入房间，你在 ${m.team === 0 ? '恐怖分子（T）' : '反恐精英（CT）'} 队`);
  }

  onPeerJoin(p) {
    this.names.set(p.id, p.name);
    this.teams.set(p.id, p.team);
    if (p.id !== this.myId) this.avatars.ensure(p.id, p.name, p.team);
    this.feed(`<b>${esc(p.name)}</b> 加入了战斗`);
  }

  onPeerLeave(id) {
    const n = this.names.get(id) || '玩家';
    this.names.delete(id); this.teams.delete(id);
    this.avatars.remove(id);
    this.feed(`<b>${esc(n)}</b> 离开了`);
  }

  applySnapshot(ps, sc) {
    if (sc) this.score = sc;
    for (const [id, x, y, z, ry, hp] of ps) {
      if (id === this.myId) {
        if (hp < this.player.hp && this.player.alive) { this.damageFlash(); SFX_.hurt(); }
        this.player.hp = hp;
        continue;
      }
      const name = this.names.get(id) || '…';
      const team = this.teams.get(id) || 0;
      this.avatars.ensure(id, name, team).target(x, y, z, ry, hp);
    }
  }

  onRoster(list) {
    this.roster = list;
    for (const p of list) { this.names.set(p.id, p.name); this.teams.set(p.id, p.team); }
    if (this.boardVisible) this.renderBoard();
  }

  onShot(pid, o, d, w) {
    if (pid === this.myId) return;
    const origin = new THREE.Vector3(o[0], o[1], o[2]);
    const dirV = new THREE.Vector3(d[0], d[1], d[2]);
    const t = rayWalls(origin, dirV, 200, this.world.colliders);
    const end = this._tmpA.copy(origin).addScaledVector(dirV, Math.min(t, 200));
    this.fx.tracer(origin, end, w === 'usp' ? 0xcfe8ff : 0xffe0a0);
    // 位置音效
    const rel = this._tmpB.copy(origin).sub(this.camera.position);
    const dist = rel.length();
    const right = this._tmpC.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const pan = dist > 0.1 ? clamp(rel.normalize().dot(right), -1, 1) * 0.8 : 0;
    const gain = clamp(2.5 / Math.max(dist, 1), 0.06, 0.7);
    const wp = WEAPONS[w] || WEAPONS.ak;
    SFX_.shot(wp.sndf, wp.sndgain * gain, pan);
  }

  onHp(id, hp) {
    if (id === this.myId) {
      if (hp < this.player.hp && this.player.alive) { this.damageFlash(); SFX_.hurt(); }
      this.player.hp = hp;
    } else {
      const a = this.avatars.get(id);
      if (a) a.setHp(hp);
    }
  }

  onKill(m) {
    if (m.sc) this.score = m.sc;
    const kn = m.k === this.myId ? '你' : esc(this.names.get(m.k) || '?');
    const vn = m.v === this.myId ? '你' : esc(this.names.get(m.v) || '?');
    const cls = (m.k === this.myId || m.v === this.myId) ? ' class="me"' : '';
    this.feed(`<span${cls}>${kn} ${m.hs ? '<span class="hs">爆头</span>击杀' : '击杀'} ${vn}</span>`);
    const av = this.avatars.get(m.v);
    if (av) av.die();
    if (m.k === this.myId) { SFX_.kill(); this.addMoney(300); }
    if (m.v === this.myId) this.localDied(performance.now() / 1000 + 3);
  }

  onRespawn(id, x, y, z, ry) {
    if (id === this.myId) {
      const p = this.player;
      p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = ry; p.pitch = 0;
      p.hp = 100; p.alive = true; p.recoil = 0; p.bloom = 0;
      p.mags = {}; p.res = {};
      for (const w in WEAPONS) if (p.owned[w]) { p.mags[w] = WEAPONS[w].mag; p.res[w] = WEAPONS[w].res; }
      p.reloading = false;
      $('death').style.display = 'none';
      $('reload-tip').style.display = 'none';
    } else {
      const a = this.avatars.get(id);
      if (a) { a.revive(); a.target(x, y, z, ry, 100); }
    }
  }

  onOver(winner) {
    $('winov').style.display = 'flex';
    const won = winner === this.myTeam;
    $('winTitle').textContent = winner === 0 ? '恐怖分子获胜！' : '反恐精英获胜！';
    $('winTitle').style.color = won ? '#3dff6e' : '#ff6b6b';
  }

  onReset() {
    $('winov').style.display = 'none';
    this.fx.clear();
  }

  localDied(at) {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.respawnAt = at;
    $('death').style.display = 'flex';
    SFX_.hurt();
  }

  // ---------- 武器 ----------
  ownedList() {
    return ['ak', 'usp', 'mp5', 'awp'].filter(w => this.player.owned[w]);
  }

  switchTo(w) {
    const p = this.player;
    if (p.weapon === w || !p.alive || !p.owned[w]) return;
    p.weapon = w;
    p.reloading = false;
    $('reload-tip').style.display = 'none';
    p.nextShot = performance.now() / 1000 + 0.3;
    this.vm.show(w);
    $('wname').textContent = WEAPONS[w].label;
  }

  // ---------- 商店 ----------
  addMoney(n) {
    const p = this.player;
    p.money = clamp(p.money + n, 0, 16000);
    this.updateMoneyHud();
  }

  updateMoneyHud() {
    $('moneyhud').textContent = '$' + this.player.money;
    $('buymoney').textContent = '$' + this.player.money;
  }

  toggleBuy() {
    if (this.buyOpen) this.closeBuy();
    else this.openBuy();
  }

  openBuy() {
    if (this.player.alive === false || this.joining || this.quitFlag) return;
    this.buyOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderBuyList();
    this.updateMoneyHud();
    $('buymenu').style.display = 'flex';
  }

  closeBuy() {
    this.buyOpen = false;
    $('buymenu').style.display = 'none';
    canvas.requestPointerLock();
  }

  renderBuyList() {
    const p = this.player;
    $('buylist').innerHTML = Object.entries(WEAPONS).map(([k, w]) => {
      const owned = p.owned[k];
      const afford = p.money >= w.price;
      const stat = `${w.mag} 发弹匣 · ${w.dmg} 伤害${w.auto ? ' · 全自动' : ' · 半自动'}`;
      return `<div class="buyitem ${owned ? 'owned' : ''}">
        <div class="bi-l"><b>${w.label}</b><span>${stat}</span></div>
        <div class="bi-r">$${w.price}</div>
        ${owned ? `<div class="bi-btn">已拥有</div>`
                : `<button class="bi-btn buy" data-w="${k}" ${afford ? '' : 'disabled'}>购买</button>`}
      </div>`;
    }).join('');
    $('buylist').querySelectorAll('button.buy').forEach(b => {
      b.onclick = () => this.buy(b.dataset.w);
    });
  }

  buy(w) {
    const p = this.player;
    const spec = WEAPONS[w];
    if (p.owned[w] || p.money < spec.price) return;
    this.addMoney(-spec.price);
    p.owned[w] = true;
    p.mags[w] = spec.mag;
    p.res[w] = spec.res;
    this.toast(`已购买 ${spec.label}`);
    SFX_.reload();
    this.closeBuy();
    this.switchTo(w);
  }

  startReload() {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    if (p.reloading || !p.alive || p.mags[p.weapon] >= w.mag || p.res[p.weapon] <= 0) return;
    p.reloading = true;
    p.reloadEnd = performance.now() / 1000 + w.rel;
    SFX_.reload();
    $('reload-tip').style.display = 'block';
  }

  tryFire() {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    const now = performance.now() / 1000;
    if (!p.alive || p.reloading || now < p.nextShot) return;
    if (p.mags[p.weapon] <= 0) {
      if (clickQueued) { SFX_.empty(); this.startReload(); }
      return;
    }
    if (!w.auto && !clickQueued) return;
    if (w.auto && !mouseDown && !clickQueued) return;
    p.mags[p.weapon]--;
    p.nextShot = now + w.itv;

    // 散布
    const moving = Math.hypot(p.vel.x, p.vel.z) > 1.5;
    let spr = w.spr + p.bloom + (moving ? w.spr * 1.2 : 0) + (!p.onGround ? w.spr * 2.5 : 0);
    if (keys.ControlLeft || keys.KeyC) spr *= 0.75;
    const fwd = this.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const rx = (Math.random() + Math.random() - 1) * spr;
    const ry = (Math.random() + Math.random() - 1) * spr;
    const dir = fwd.addScaledVector(right, rx).addScaledVector(up, ry).normalize();
    const origin = this.camera.position.clone();

    // 命中判定：先找最近敌人，再和墙比较
    const wallT = rayWalls(origin, dir, 250, this.world.colliders);
    let bestT = wallT, bestId = null, bestHead = false;
    this.avatars.forEach(a => {
      if (a.dead || a.team === p.team) return;
      const hit = hitTestBody(origin, dir, a.pos);
      if (hit && hit.t < bestT) { bestT = hit.t; bestId = a.id; bestHead = hit.head; }
    });

    let end;
    if (bestId) {
      const dist = bestT;
      const fall = dist > 25 ? Math.max(0.55, 1 - (dist - 25) / 150) : 1;
      const dmg = Math.round(w.dmg * (bestHead ? w.hs : 1) * fall);
      end = origin.clone().addScaledVector(dir, bestT);
      this.fx.burst(end, 0xc21f1f, 7, 2.5);
      this.hitmark(bestHead);
      SFX_.hit(bestHead);
      if (this.net instanceof Host) this.net.applyDamage(bestId, dmg, 'H', bestHead, w.label);
      else this.net.sendHit(bestId, dmg, bestHead, w.label);
    } else {
      end = origin.clone().addScaledVector(dir, Math.min(wallT, 250));
      if (wallT < 250) this.fx.burst(end, 0xd8c49a, 5, 2);
    }

    this.fx.tracer(this.vm.muzzleWorld(this.camera).clone(), end, p.weapon === 'usp' ? 0xcfe8ff : 0xffe0a0);
    this.vm.fire();
    SFX_.shot(w.sndf, 1.0, 0);
    p.bloom = Math.min(w.bmax, p.bloom + w.bloom);
    p.recoil += w.kick;
    if (this.net instanceof Host) this.net.emitShot('H', [r2(origin.x), r2(origin.y), r2(origin.z)], [r2(dir.x), r2(dir.y), r2(dir.z)], p.weapon);
    else this.net.sendShot(origin, dir, p.weapon);
  }

  hitmark(head) {
    const h = $('hitmark');
    h.classList.toggle('hs', !!head);
    h.style.opacity = 1;
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => h.style.opacity = 0, 90);
  }

  damageFlash() {
    const f = $('dmgflash');
    f.style.transition = 'none'; f.style.opacity = 1;
    requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = 0; });
  }

  feed(html) {
    const kf = $('killfeed');
    const div = document.createElement('div');
    div.innerHTML = html;
    kf.prepend(div);
    while (kf.children.length > 5) kf.removeChild(kf.lastChild);
    setTimeout(() => div.remove(), 4500);
  }

  toast(msg) {
    const t = $('toast');
    const div = document.createElement('div');
    div.textContent = msg;
    t.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // ---------- 记分板 ----------
  showBoard(v) {
    this.boardVisible = v;
    $('board').style.display = v ? 'block' : 'none';
    if (v) this.renderBoard();
  }

  renderBoard() {
    let list = this.roster;
    if (this.net instanceof Host) {
      list = this.net.rosterList();
      this.roster = list;
    }
    const mk = (team, label, cls) => {
      const rows = list.filter(p => p.team === team).sort((a, b) => b.k - a.k)
        .map(p => `<tr${p.id === this.myId ? ' class="me"' : ''}><td>${esc(p.name)}</td><td>${p.k}</td><td>${p.d}</td></tr>`).join('');
      return `<div class="${cls}"><h2>${label} · ${this.score[team]} 杀</h2><table><tr><th>玩家</th><th>击杀</th><th>死亡</th></tr>${rows}</table></div>`;
    };
    $('board').innerHTML = mk(0, '恐怖分子（T）', 'tt') + mk(1, '反恐精英（CT）', 'ctt');
  }

  // ---------- 暂停 ----------
  showPause(v) {
    if (!this.player.alive && v) return; // 死亡时不弹暂停
    $('pause').style.display = v ? 'flex' : 'none';
  }

  // ---------- 主循环 ----------
  frame(dt) {
    const p = this.player;
    const now = performance.now() / 1000;

    // 本地移动
    if (p.alive && !this.joining) {
      const crouching = keys.ControlLeft || keys.ControlRight || keys.KeyC;
      const targetH = crouching ? 1.2 : 1.7;
      p.h += (targetH - p.h) * Math.min(1, 12 * dt);

      let ix = 0, iz = 0;
      if (keys.KeyW) iz -= 1;
      if (keys.KeyS) iz += 1;
      if (keys.KeyA) ix -= 1;
      if (keys.KeyD) ix += 1;
      const il = Math.hypot(ix, iz) || 1;
      const speed = crouching ? 2.8 : (keys.ShiftLeft || keys.ShiftRight) ? 3.4 : 6.0;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const rx = -fz, rz = fx;
      const wx = (fx * -iz + rx * ix) / il * speed;
      const wz = (fz * -iz + rz * ix) / il * speed;
      const rate = p.onGround ? 10 : 2.2;
      p.vel.x += (wx - p.vel.x) * Math.min(1, rate * dt);
      p.vel.z += (wz - p.vel.z) * Math.min(1, rate * dt);
      if (keys.Space && p.onGround) { p.vel.y = 7; p.onGround = false; }

      moveBody(p, dt, this.world.colliders);
      p.pos.x = clamp(p.pos.x, -23.8, 23.8);
      p.pos.z = clamp(p.pos.z, -17.8, 17.8);

      // 换弹完成
      if (p.reloading && now >= p.reloadEnd) {
        p.reloading = false;
        const w = WEAPONS[p.weapon];
        const need = w.mag - p.mags[p.weapon];
        const take = Math.min(need, p.res[p.weapon]);
        p.mags[p.weapon] += take;
        p.res[p.weapon] -= take;
        $('reload-tip').style.display = 'none';
      }
      this.tryFire();
    }
    clickQueued = false;

    // 武器散布恢复 / 后坐恢复
    const w = WEAPONS[p.weapon];
    p.bloom = Math.max(0, p.bloom - w.bdec * dt);
    p.recoil = Math.max(0, p.recoil - p.recoil * 9 * dt - 0.0005);

    // 相机（先更新，保证射击时枪口位置正确）
    const eyeTarget = p.alive ? p.h - 0.12 : 0.45;
    p.eyeSmooth += (eyeTarget - p.eyeSmooth) * Math.min(1, 8 * dt);
    this.camera.position.set(p.pos.x, p.pos.y + p.eyeSmooth, p.pos.z);
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch + p.recoil;
    this.camera.rotation.z = 0;
    this.camera.updateMatrixWorld();

    // 房主：上报自身状态 + 驱动机器人/快照；客户端：发送状态
    if (this.net) this.net.update(dt);
    if (this.net instanceof Host) {
      this.net.setHostState({ x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), ry: r2(p.yaw) });
    }

    this.avatars.update(dt);
    this.fx.update(dt);

    // 视角模型
    const moving = p.alive && Math.hypot(p.vel.x, p.vel.z) > 1.2;
    this.vm.update(dt, { moving, grounded: p.onGround, reloadT: p.reloading ? 1 : 0 });

    // HUD（降频）
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      $('hp-num').textContent = Math.max(0, Math.round(p.hp));
      const bar = $('hp-bar').firstElementChild;
      const hpr = clamp(p.hp / 100, 0, 1);
      bar.style.width = hpr * 100 + '%';
      bar.style.background = hpr > 0.5 ? '#3dff6e' : hpr > 0.25 ? '#ffd23d' : '#ff4d4d';
      $('ammo').innerHTML = `${p.mags[p.weapon]} <small>/ ${p.res[p.weapon]}</small>`;
      this.updateMoneyHud();
      $('scT').textContent = this.score[0];
      $('scCT').textContent = this.score[1];
      document.documentElement.style.setProperty('--gap', (5 + p.bloom * 900) + 'px');
    }
    if (!p.alive) {
      $('deathTimer').textContent = Math.max(0, Math.ceil(this.respawnAt - now)) + ' 秒后重生';
    }
  }

  dispose() {
    this.quitFlag = true;
    this.buyOpen = false;
    if (this.net) this.net.destroy();
    this.avatars.clear();
    this.fx.clear();
    $('hud').style.display = 'none';
    $('menu').style.display = 'flex';
    $('pause').style.display = 'none';
    $('buymenu').style.display = 'none';
    $('death').style.display = 'none';
    $('winov').style.display = 'none';
    $('roombanner').style.display = 'none';
    $('connstatus').style.display = 'none';
    $('connstatus').querySelector('.spin').style.display = 'block';
    $('connText').textContent = '正在连接房间…';
    $('killfeed').innerHTML = '';
    $('pause').classList.remove('host');
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

// 临时向量（避免每帧分配）
Game.prototype._tmpA = new THREE.Vector3();
Game.prototype._tmpB = new THREE.Vector3();
Game.prototype._tmpC = new THREE.Vector3();

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============ 菜单 ============
function randName() { return '玩家' + Math.floor(100 + Math.random() * 900); }
const nameInput = $('nameInput');
nameInput.value = localStorage.getItem('cs_name') || randName();

function getName() {
  const n = nameInput.value.trim().slice(0, 12) || randName();
  localStorage.setItem('cs_name', n);
  return n;
}

function startGame(opts) {
  if (CUR) return;
  SFX_.ensure();
  opts.name = getName();
  CUR = new Game(opts);
  window.__game = CUR; // 调试/测试钩子
}

function quitToMenu() {
  if (!CUR) return;
  CUR.dispose();
  CUR = null;
  window.__game = null;
}

$('btnSolo').onclick = () => startGame({ mode: 'solo' });
$('btnHost').onclick = () => startGame({ mode: 'host' });
$('btnJoin').onclick = () => {
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) { alert('请输入至少 4 位房间码'); return; }
  startGame({ mode: 'join', code });
};
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });

$('btnResume').onclick = () => { canvas.requestPointerLock(); };
$('btnQuit').onclick = () => quitToMenu();
$('btnAddBot').onclick = () => { if (CUR && CUR.net instanceof Host) CUR.net.addBot(); };
$('btnDelBot').onclick = () => { if (CUR && CUR.net instanceof Host) CUR.net.removeBot(); };
$('btnCopyCode').onclick = async () => {
  if (!CUR || !CUR.roomCode) return;
  try { await navigator.clipboard.writeText(CUR.roomCode); CUR.toast('房间码已复制：' + CUR.roomCode); }
  catch (e) { CUR.toast('房间码：' + CUR.roomCode); }
};

const sensEl = $('sens');
sensEl.value = sens;
$('sensVal').textContent = sens.toFixed(2);
sensEl.oninput = () => {
  sens = parseFloat(sensEl.value);
  $('sensVal').textContent = sens.toFixed(2);
  localStorage.setItem('cs_sens', sens);
};

addEventListener('beforeunload', () => { if (CUR) CUR.dispose(); });

// 自动化测试钩子（正常游玩不依赖）
window.__test = {
  lock: v => { locked = v; },
  mdown: () => { mouseDown = true; clickQueued = true; },
  mup: () => { mouseDown = false; },
  key: (code, down) => { keys[code] = down; },
};

// ============ 主循环 ============
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (CUR) {
    CUR.frame(dt);
    renderer.render(CUR.scene, CUR.camera);
  }
  requestAnimationFrame(loop);
}
renderer.setSize(innerWidth, innerHeight);
requestAnimationFrame(loop);
