import * as THREE from 'three';

// 简易人形模型：腿 x2 + 躯干 + 头 + 手臂枪械，队伍配色
const TEAM_COLOR = [0xc8862f, 0x3f6fb5];
const TEAM_DARK  = [0x8f5f1c, 0x2c4f83];

function makeTag(name, team, hp) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 72;
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(1.9, 0.53, 1);
  spr.position.y = 2.15;
  spr.renderOrder = 999;
  const api = { spr, redraw(n, h) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 72);
    g.font = 'bold 26px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(28, 4, 200, 34);
    g.fillStyle = '#fff';
    g.fillText(n.slice(0, 10), 128, 30);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(48, 46, 160, 10);
    g.fillStyle = team === 0 ? '#e8a33d' : '#5b8fd6';
    g.fillRect(50, 48, 156 * Math.max(0, h) / 100, 6);
    tex.needsUpdate = true;
  }};
  api.redraw(name, hp);
  return api;
}

class Avatar {
  constructor(scene, id, name, team) {
    this.id = id; this.name = name; this.team = team; this.hp = 100;
    this.pos = new THREE.Vector3(0, -50, 0);   // 藏在地下直到有状态
    this.tgt = { x: 0, y: -50, z: 0, ry: 0 };
    this.yaw = 0; this.speedEst = 0; this.animT = Math.random() * 10;
    this.dying = 0; this.dead = false; this._lastPos = this.pos.clone();

    const g = this.group = new THREE.Group();
    const matT = new THREE.MeshLambertMaterial({ color: TEAM_COLOR[team] });
    const matD = new THREE.MeshLambertMaterial({ color: TEAM_DARK[team] });
    const matSkin = new THREE.MeshLambertMaterial({ color: 0xd9b38c });
    const matGun = new THREE.MeshLambertMaterial({ color: 0x1f2226 });

    const legGeo = new THREE.BoxGeometry(0.17, 0.75, 0.2);
    legGeo.translate(0, -0.375, 0); // 髋部为轴，方便摆腿
    this.legL = new THREE.Mesh(legGeo, matD); this.legL.position.set(-0.12, 0.75, 0);
    this.legR = new THREE.Mesh(legGeo, matD); this.legR.position.set(0.12, 0.75, 0);
    g.add(this.legL, this.legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), matT);
    torso.position.y = 1.06; g.add(torso);
    this.torso = torso;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), matSkin);
    head.position.y = 1.53; g.add(head);
    // 头盔一圈队伍色
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), matT);
    helm.position.y = 1.66; g.add(helm);

    // 手臂 + 枪（前伸）
    const armGeo = new THREE.BoxGeometry(0.13, 0.13, 0.5);
    const armL = new THREE.Mesh(armGeo, matT); armL.position.set(-0.2, 1.22, -0.28); armL.rotation.y = 0.35;
    const armR = new THREE.Mesh(armGeo, matT); armR.position.set(0.2, 1.22, -0.28); armR.rotation.y = -0.35;
    g.add(armL, armR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.72), matGun);
    gun.position.set(0.05, 1.22, -0.5); g.add(gun);

    this.tag = makeTag(name, team, 100);
    g.add(this.tag.spr);
    scene.add(g);
  }

  setNameTeam(name, team) {
    if (name !== this.name || team !== this.team) {
      this.name = name; this.team = team;
      this.group.remove(this.tag.spr);
      this.tag = makeTag(name, team, this.hp);
      this.group.add(this.tag.spr);
    }
  }

  setHp(hp) {
    if (hp !== this.hp) { this.hp = hp; this.tag.redraw(this.name, hp); }
  }

  // 房主直接设置权威位置
  snap(x, y, z, ry, hp) {
    this.pos.set(x, y, z); this.tgt.x = x; this.tgt.y = y; this.tgt.z = z; this.tgt.ry = ry;
    if (hp !== undefined) this.setHp(hp);
  }

  // 客户端设置目标（插值趋近）
  target(x, y, z, ry, hp) {
    this.tgt.x = x; this.tgt.y = y; this.tgt.z = z; this.tgt.ry = ry;
    if (hp !== undefined) this.setHp(hp);
  }

  die() { this.dead = true; this.dying = 0; this.tag.spr.visible = false; }
  revive() {
    this.dead = false; this.dying = 0; this.hp = 100;
    this.group.rotation.x = 0; this.group.visible = true;
    this.tag.spr.visible = true; this.tag.redraw(this.name, 100);
  }

  update(dt) {
    if (this.dead) {
      this.dying = Math.min(1, this.dying + dt * 3.5);
      this.group.rotation.x = -Math.PI / 2 * this.dying;
      return;
    }
    // 平滑趋近目标
    const k = Math.min(1, 14 * dt);
    this.pos.x += (this.tgt.x - this.pos.x) * k;
    this.pos.y += (this.tgt.y - this.pos.y) * k;
    this.pos.z += (this.tgt.z - this.pos.z) * k;
    let dy = this.tgt.ry - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, 12 * dt);

    const moved = this.pos.distanceTo(this._lastPos) / Math.max(dt, 1e-4);
    this.speedEst += (Math.min(moved, 8) - this.speedEst) * Math.min(1, 8 * dt);
    this._lastPos.copy(this.pos);

    this.animT += dt * (2 + this.speedEst * 1.6);
    const sw = Math.sin(this.animT * 4) * Math.min(1, this.speedEst / 4) * 0.55;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.tag.spr.material.opacity = 1;
  }
}

export class Avatars {
  constructor(scene) { this.scene = scene; this.map = new Map(); }
  ensure(id, name, team) {
    let a = this.map.get(id);
    if (!a) { a = new Avatar(this.scene, id, name, team); this.map.set(id, a); }
    else a.setNameTeam(name, team);
    return a;
  }
  get(id) { return this.map.get(id); }
  remove(id) { const a = this.map.get(id); if (a) { this.scene.remove(a.group); this.map.delete(id); } }
  clear() { for (const id of [...this.map.keys()]) this.remove(id); }
  update(dt) { for (const a of this.map.values()) a.update(dt); }
  forEach(fn) { for (const a of this.map.values()) fn(a); }
}
