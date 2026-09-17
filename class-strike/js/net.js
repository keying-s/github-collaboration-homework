import * as THREE from 'three';
import { moveBody, rayWalls, hitTestBody, r2 } from './world.js';

// ============ PeerJS 加载（免费公共信令服务器，无需自建） ============
let peerLibP = null;
export function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLibP) return peerLibP;
  peerLibP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(window.Peer);
    s.onerror = () => { peerLibP = null; rej(new Error('无法加载联机组件（PeerJS CDN），请检查网络')); };
    document.head.appendChild(s);
  });
  return peerLibP;
}

const ICE = {
  debug: 0,
  config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]},
};

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
const angNorm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ============ 房主（权威服务端 + 中继） ============
export class Host {
  constructor(game, { solo = false } = {}) {
    this.game = game;
    this.solo = solo;
    this.players = new Map();   // id -> {id,name,team,hp,k,d,st,body?,bot?}
    this.bots = [];
    this.score = [0, 0];
    this.respawnQ = [];         // {id, at}
    this.snapT = 0;
    this.spawnIdx = [0, 0];
    this.cid = 0;
    this.bid = 0;
    this.conns = new Map();     // conn -> pid
    this.resetAt = 0;
    this.ready = true;
    this.destroyed = false;

    // 房主自己
    const sp = this.pickSpawn(game.myTeam);
    this.players.set('H', { id: 'H', name: game.myName, team: game.myTeam, hp: 100, k: 0, d: 0,
      st: { x: sp[0], y: sp[1], z: sp[2], ry: sp[3] } });

    if (!solo) {
      this.ready = false;
      this.code = genCode();
      this._startPeer(0);
    }
  }

  _startPeer(attempt) {
    loadPeerJS().then(Peer => {
      if (this.destroyed) return;
      this.fullId = 'zcsx-' + this.code;
      this.peer = new Peer(this.fullId, ICE);
      this.peer.on('open', () => { this.ready = true; this.game.onRoomCode(this.code); });
      this.peer.on('error', e => {
        if (this.destroyed) return;
        if (e.type === 'unavailable-id' && attempt < 3) { // 房间码撞了，换一个
          this.code = genCode();
          this._startPeer(attempt + 1);
        } else if (['peer-unavailable', 'disconnected', 'network', 'server-error', 'socket-error'].includes(e.type)) {
          this.game.onNetError('联机服务连接失败：' + e.type + '（需要能访问 peerjs.com）');
        }
      });
      this.peer.on('connection', conn => this._onConn(conn));
    }).catch(e => this.game.onNetError(e.message));
  }

  _onConn(conn) {
    conn.on('data', m => this._onData(conn, m));
    conn.on('open', () => {
      if (this.conns.size >= 7) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }
    });
    conn.on('close', () => this._dropConn(conn));
    conn.on('error', () => this._dropConn(conn));
  }

  _dropConn(conn) {
    const pid = this.conns.get(conn);
    if (!pid) return;
    this.conns.delete(conn);
    const p = this.players.get(pid);
    if (p) {
      this.players.delete(pid);
      this.broadcast({ t: 'leave', id: pid });
      this.game.onPeerLeave(pid);
      this.broadcastRoster();
    }
  }

  _onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': {
        if (this.conns.has(conn)) return;
        if (this.conns.size >= 7) { conn.send({ t: 'full' }); return; }
        const id = 'C' + (++this.cid);
        const team = this._weakerTeam();
        const sp = this.pickSpawn(team);
        const p = { id, name: String(m.name || '玩家').slice(0, 12), team, hp: 100, k: 0, d: 0,
          st: { x: sp[0], y: sp[1], z: sp[2], ry: sp[3] } };
        this.players.set(id, p);
        this.conns.set(conn, id);
        conn.send({ t: 'init', you: id, team, sc: this.score,
          roster: this.rosterList(), spawn: sp });
        this.broadcast({ t: 'join', p: { id, name: p.name, team } }, id);
        this.game.onPeerJoin(p);
        this.broadcastRoster();
        break;
      }
      case 'st': {
        const p = this.players.get(this.conns.get(conn));
        if (p && typeof m.x === 'number') p.st = { x: m.x, y: m.y, z: m.z, ry: m.ry || 0 };
        break;
      }
      case 'hit': {
        this.applyDamage(m.id, m.dmg, this.conns.get(conn), m.hs, m.w);
        break;
      }
      case 'shot': {
        const pid = this.conns.get(conn);
        if (!pid) return;
        this.broadcast({ t: 'shot', id: pid, o: m.o, d: m.d, w: m.w }, pid);
        this.game.onShot(pid, m.o, m.d, m.w);
        break;
      }
    }
  }

  _weakerTeam() {
    let t = 0, c = 0;
    for (const p of this.players.values()) { if (p.team === 0) t++; else c++; }
    return t <= c ? 0 : 1;
  }

  rosterList() {
    const l = [];
    for (const p of this.players.values()) l.push({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d });
    return l;
  }
  broadcastRoster() {
    const l = this.rosterList();
    this.broadcast({ t: 'roster', ps: l });
    this.game.onRoster(l);
  }

  pickSpawn(team) {
    const arr = this.game.world.spawns[team];
    const i = (this.spawnIdx[team]++) % arr.length;
    const s = arr[i];
    return [s[0] + (Math.random() - 0.5), s[1], s[2] + (Math.random() - 0.5), s[3]];
  }

  broadcast(m, except) {
    for (const [conn, pid] of this.conns) {
      if (pid === except) continue;
      try { if (conn.open) conn.send(m); } catch (e) {}
    }
  }

  setHostState(st) {
    const p = this.players.get('H');
    if (p) p.st = st;
  }

  // ---- 机器人 ----
  addBot() {
    if (this.destroyed) return;
    const id = 'B' + (++this.bid);
    const team = this._weakerTeam();
    const name = 'BOT ' + BOT_NAMES[this.bid % BOT_NAMES.length];
    const bot = new Bot(this, id, team, name);
    this.bots.push(bot);
    const p = { id, name, team, hp: 100, k: 0, d: 0, st: bot.st(), bot };
    this.players.set(id, p);
    this.broadcast({ t: 'join', p: { id, name, team } });
    this.game.onPeerJoin(p);
    this.broadcastRoster();
  }

  removeBot() {
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const b = this.bots[i];
      this.bots.splice(i, 1);
      this.players.delete(b.id);
      this.broadcast({ t: 'leave', id: b.id });
      this.game.onPeerLeave(b.id);
      this.broadcastRoster();
      return;
    }
  }

  // ---- 伤害 / 击杀 ----
  applyDamage(vid, dmg, shid, hs, w) {
    const p = this.players.get(vid);
    if (!p || p.hp <= 0) return;
    const sh = this.players.get(shid);
    if (sh && sh.team === p.team && shid !== vid) return; // 无队友伤害
    p.hp = Math.max(0, p.hp - dmg);
    this.broadcast({ t: 'hp', id: vid, hp: p.hp });
    this.game.onHp(vid, p.hp);
    if (p.hp <= 0) this._kill(p, sh, hs, w);
  }

  _kill(p, sh, hs, w) {
    p.d++;
    const kt = sh ? sh.team : p.team;
    if (sh && sh !== p) sh.k++;
    this.score[kt]++;
    this.broadcast({ t: 'kill', k: sh ? sh.id : p.id, v: p.id, hs: !!hs, w: w || 'AK-47', kt, sc: this.score });
    this.game.onKill({ k: sh ? sh.id : p.id, v: p.id, hs: !!hs, w: w || 'AK-47', kt, sc: this.score });
    this.respawnQ.push({ id: p.id, at: performance.now() / 1000 + 3 });
    if (p.id === 'H') this.game.localDied(performance.now() / 1000 + 3);
    this.broadcastRoster();
    if (this.score[0] >= 30 || this.score[1] >= 30) {
      const winner = this.score[0] >= 30 ? 0 : 1;
      this.broadcast({ t: 'over', winner });
      this.game.onOver(winner);
      this.resetAt = performance.now() / 1000 + 8;
    }
  }

  respawn(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.hp = 100;
    const sp = this.pickSpawn(p.team);
    if (p.bot) { p.bot.respawnAt(sp); p.st = p.bot.st(); }
    else p.st = { x: sp[0], y: sp[1], z: sp[2], ry: sp[3] };
    this.broadcast({ t: 'resp', id, x: sp[0], y: sp[1], z: sp[2], ry: sp[3] });
    this.broadcast({ t: 'hp', id, hp: 100 });
    this.game.onRespawn(id, sp[0], sp[1], sp[2], sp[3]);
    this.game.onHp(id, 100);
  }

  emitShot(pid, o, d, w) {
    this.broadcast({ t: 'shot', id: pid, o, d, w });
    this.game.onShot(pid, o, d, w);
  }

  update(dt) {
    if (this.destroyed) return;
    const now = performance.now() / 1000;

    for (const b of this.bots) b.update(dt);

    // 重生队列
    for (let i = this.respawnQ.length - 1; i >= 0; i--) {
      if (this.respawnQ[i].at <= now) {
        const { id } = this.respawnQ[i];
        this.respawnQ.splice(i, 1);
        this.respawn(id);
      }
    }

    // 比赛重置
    if (this.resetAt && now >= this.resetAt) {
      this.resetAt = 0;
      this.score = [0, 0];
      for (const p of this.players.values()) { p.k = 0; p.d = 0; }
      this.broadcast({ t: 'reset' });
      this.game.onReset();
      for (const p of [...this.players.keys()]) this.respawn(p);
      this.broadcastRoster();
    }

    // 房主本机：直接按权威状态刷新其他玩家的模型（每帧，保证平滑）
    for (const p of this.players.values()) {
      const av = this.game.avatars.get(p.id);
      if (av) av.snap(p.st.x, p.st.y, p.st.z, p.st.ry, p.hp);
    }

    // 快照广播
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 0.08;
      const ps = [];
      for (const p of this.players.values()) {
        ps.push([p.id, p.st.x, p.st.y, p.st.z, p.st.ry, p.hp]);
      }
      this.broadcast({ t: 'snap', ps, sc: this.score });
    }
  }

  destroy() {
    this.destroyed = true;
    for (const [conn] of this.conns) { try { conn.close(); } catch (e) {} }
    this.conns.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
  }
}

// ============ 客户端（加入房间） ============
export class Client {
  constructor(game, code) {
    this.game = game;
    this.code = code.toUpperCase().trim();
    this.stateT = 0;
    this.destroyed = false;
    loadPeerJS().then(Peer => {
      if (this.destroyed) return;
      this.peer = new Peer(ICE);
      this.peer.on('open', () => {
        if (this.destroyed) return;
        this.conn = this.peer.connect('zcsx-' + this.code, { reliable: true });
        this.conn.on('open', () => {
          this.conn.send({ t: 'hello', name: game.myName });
          this.timeout = setTimeout(() => {
            if (!this.gotInit) this.game.onNetError('连接超时：房主未响应');
          }, 8000);
        });
        this.conn.on('data', m => this._onData(m));
        this.conn.on('close', () => { if (!this.destroyed) this.game.onHostGone(); });
        this.conn.on('error', () => { if (!this.destroyed) this.game.onHostGone(); });
      });
      this.peer.on('error', e => {
        if (this.destroyed) return;
        if (e.type === 'peer-unavailable') this.game.onNetError('房间不存在或房主已关闭，请核对房间码');
        else this.game.onNetError('联机错误：' + e.type);
      });
    }).catch(e => this.game.onNetError(e.message));
  }

  _onData(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'full': this.game.onNetError('房间已满（最多 8 人）'); break;
      case 'init': this.gotInit = true; clearTimeout(this.timeout); this.game.clientInit(m); break;
      case 'join': this.game.onPeerJoin(m.p); break;
      case 'leave': this.game.onPeerLeave(m.id); break;
      case 'snap': this.game.applySnapshot(m.ps, m.sc); break;
      case 'roster': this.game.onRoster(m.ps); break;
      case 'shot': this.game.onShot(m.id, m.o, m.d, m.w); break;
      case 'hp': this.game.onHp(m.id, m.hp); break;
      case 'kill': this.game.onKill(m); break;
      case 'resp': this.game.onRespawn(m.id, m.x, m.y, m.z, m.ry); break;
      case 'over': this.game.onOver(m.winner); break;
      case 'reset': this.game.onReset(); break;
    }
  }

  send(m) { if (this.conn && this.conn.open) { try { this.conn.send(m); } catch (e) {} } }
  sendState(x, y, z, ry) { this.send({ t: 'st', x: r2(x), y: r2(y), z: r2(z), ry: r2(ry) }); }
  sendShot(o, d, w) { this.send({ t: 'shot', o: [r2(o.x), r2(o.y), r2(o.z)], d: [r2(d.x), r2(d.y), r2(d.z)], w }); }
  sendHit(id, dmg, hs, w) { this.send({ t: 'hit', id, dmg, hs: !!hs, w }); }

  update(dt) {
    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.stateT = 1 / 15;
      const g = this.game;
      if (g.player) this.sendState(g.player.pos.x, g.player.pos.y, g.player.pos.z, g.player.yaw);
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timeout);
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
  }
}

// ============ 机器人 AI ============
const BOT_NAMES = ['小白', '老王', '阿花', '大强', '铁头', '狙神', '老六', '喵喵', '阿伟', '小美', '狗子', '铁柱'];

class Bot {
  constructor(host, id, team, name) {
    this.host = host; this.id = id; this.team = team;
    this.skill = 0.3 + Math.random() * 0.45;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), half: 0.35, h: 1.7, onGround: true };
    this.yaw = 0;
    this.retarget = 0; this.target = null;
    this.wp = null; this.wpT = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0;
    this.cd = 0; this.burst = 0; this.pause = 0.8; this.reactT = 0;
    this.stuckT = 0;
    this.respawnAt(host.pickSpawn(team));
  }

  respawnAt(sp) {
    this.body.pos.set(sp[0], sp[1], sp[2]);
    this.body.vel.set(0, 0, 0);
    this.yaw = sp[3];
    this.wp = null; this.target = null; this.retarget = 0;
  }

  st() { return { x: r2(this.body.pos.x), y: r2(this.body.pos.y), z: r2(this.body.pos.z), ry: r2(this.yaw) }; }
  eye() { return new THREE.Vector3(this.body.pos.x, this.body.pos.y + 1.55, this.body.pos.z); }

  _targetFeet(p) {
    if (p.bot) return p.bot.body.pos;
    return new THREE.Vector3(p.st.x, p.st.y, p.st.z);
  }

  _los(feet) {
    const o = this.eye();
    const c = new THREE.Vector3(feet.x, feet.y + 1.5, feet.z);
    const d = c.sub(o);
    const dist = d.length();
    if (dist < 0.5) return true;
    d.normalize();
    return rayWalls(o, d, dist, this.host.game.world.colliders) >= dist - 0.4;
  }

  acquire() {
    let best = null, bd = 1e9;
    for (const p of this.host.game.netPlayers()) {
      if (p.team === this.team || p.hp <= 0) continue;
      const feet = this._targetFeet(p);
      const d = this.body.pos.distanceTo(feet);
      if (d > 45 || !this._los(feet)) continue;
      if (d < bd) { bd = d; best = p; }
    }
    if (best && best !== this.target) this.reactT = 0.2 + (1 - this.skill) * 0.55;
    this.target = best;
  }

  update(dt) {
    const host = this.host;
    const P = host.players.get(this.id);
    if (!P || P.hp <= 0) { this.body.vel.x = 0; this.body.vel.z = 0; return; }

    this.retarget -= dt;
    if (this.retarget <= 0) { this.retarget = 0.3 + Math.random() * 0.3; this.acquire(); }
    const tgt = this.target && this.target.hp > 0 ? this.target : null;

    let wx = 0, wz = 0, speed = 4.2;
    if (tgt) {
      const tp = this._targetFeet(tgt);
      const dx = tp.x - this.body.pos.x, dz = tp.z - this.body.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz);
      const turn = (3 + this.skill * 5) * dt;
      this.yaw += Math.max(-turn, Math.min(turn, angNorm(wantYaw - this.yaw)));

      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random(); this.strafe *= -1; }
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = -fz, rz = fx;
      let adv = 0;
      if (dist > 13) adv = 1; else if (dist < 5) adv = -1;
      wx = fx * adv + rx * this.strafe * 0.9;
      wz = fz * adv + rz * this.strafe * 0.9;
      speed = 3.6;
      this._combat(dt, tgt, tp);
    } else {
      this.wpT -= dt;
      const nav = host.game.world.nav;
      if (!this.wp || this.wpT <= 0 || Math.hypot(this.wp[0] - this.body.pos.x, this.wp[1] - this.body.pos.z) < 1.5) {
        this.wp = nav[Math.floor(Math.random() * nav.length)];
        this.wpT = 9;
      }
      const dx = this.wp[0] - this.body.pos.x, dz = this.wp[1] - this.body.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      wx = dx / l; wz = dz / l;
      const wantYaw = Math.atan2(-wx, -wz);
      this.yaw += Math.max(-4 * dt, Math.min(4 * dt, angNorm(wantYaw - this.yaw)));
    }

    const wl = Math.hypot(wx, wz) || 1;
    this.body.vel.x += ((wx / wl) * speed - this.body.vel.x) * Math.min(1, 10 * dt);
    this.body.vel.z += ((wz / wl) * speed - this.body.vel.z) * Math.min(1, 10 * dt);
    moveBody(this.body, dt, host.game.world.colliders);

    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    if (wl > 0.1 && sp < 0.4) {
      this.stuckT += dt;
      if (this.stuckT > 1) { this.stuckT = 0; this.wp = null; this.strafe *= -1; }
    } else this.stuckT = 0;

    P.st = this.st();
  }

  _combat(dt, tgt, tp) {
    this.cd -= dt; this.reactT -= dt;
    if (this.reactT > 0) return;
    const wantYaw = Math.atan2(-(tp.x - this.body.pos.x), -(tp.z - this.body.pos.z));
    if (Math.abs(angNorm(wantYaw - this.yaw)) > 0.13) return;
    if (!this._los(this._targetFeet(tgt))) return;

    if (this.burst > 0 && this.cd <= 0) {
      this.burst--;
      this.cd = 0.105 + Math.random() * 0.03;
      this._fireAt(tgt, tp);
    } else if (this.burst <= 0) {
      this.pause -= dt;
      if (this.pause <= 0) { this.burst = 2 + Math.floor(Math.random() * 5); this.pause = 0.5 + Math.random() * 0.7; }
    }
  }

  _fireAt(tgt, tp) {
    const o = this.eye();
    const aim = new THREE.Vector3(tp.x, tp.y + (Math.random() < 0.22 ? 1.5 : 1.05), tp.z);
    const d = aim.sub(o).normalize();
    const err = (1 - this.skill) * 0.05 + 0.012;
    d.x += (Math.random() * 2 - 1) * err;
    d.y += (Math.random() * 2 - 1) * err * 0.6;
    d.z += (Math.random() * 2 - 1) * err;
    d.normalize();

    const wallT = rayWalls(o, d, 80, this.host.game.world.colliders);
    const hit = hitTestBody(o, d, this._targetFeet(tgt));
    this.host.emitShot(this.id, [r2(o.x), r2(o.y), r2(o.z)], [r2(d.x), r2(d.y), r2(d.z)], 'ak');
    if (hit && hit.t < wallT) {
      const dmg = hit.head ? 30 * 4 : 30;
      this.host.applyDamage(tgt.id, dmg, this.id, hit.head, 'AK-47');
    }
  }
}
