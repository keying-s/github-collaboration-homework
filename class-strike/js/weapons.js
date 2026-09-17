import * as THREE from 'three';

export const WEAPONS = {
  ak:  { label: 'AK-47', price: 2700, dmg: 33, hs: 4, itv: 0.100, mag: 30, res: 90, rel: 2.3,
        spr: 0.008, bloom: 0.013, bmax: 0.055, bdec: 0.09, kick: 0.017,
        auto: true, sndf: 850, sndgain: 1.0 },
  usp: { label: 'USP-S', price: 0, dmg: 26, hs: 4, itv: 0.170, mag: 12, res: 48, rel: 1.9,
        spr: 0.005, bloom: 0.010, bmax: 0.045, bdec: 0.11, kick: 0.011,
        auto: false, sndf: 1300, sndgain: 0.65 },
  mp5: { label: 'MP5-SD', price: 1500, dmg: 24, hs: 4, itv: 0.075, mag: 30, res: 120, rel: 2.0,
        spr: 0.006, bloom: 0.008, bmax: 0.040, bdec: 0.12, kick: 0.009,
        auto: true, sndf: 1000, sndgain: 0.7 },
  awp: { label: 'AWP', price: 4750, dmg: 112, hs: 2, itv: 1.25, mag: 5, res: 20, rel: 3.2,
        spr: 0.002, bloom: 0.02, bmax: 0.05, bdec: 0.2, kick: 0.05,
        auto: false, sndf: 420, sndgain: 1.3 },
};

const matBody = new THREE.MeshLambertMaterial({ color: 0x2a2d31 });
const matWood = new THREE.MeshLambertMaterial({ color: 0x6e4a26 });
const matMetal = new THREE.MeshLambertMaterial({ color: 0x17191c });

function part(g, mat, w, h, d, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m;
}

function makeAK() {
  const g = new THREE.Group();
  part(g, matBody, 0.07, 0.09, 0.5, 0, 0, -0.1);        // 机匣
  part(g, matMetal, 0.03, 0.03, 0.34, 0, 0.01, -0.5);   // 枪管
  part(g, matWood, 0.06, 0.07, 0.22, 0, -0.01, -0.42);  // 护木
  part(g, matWood, 0.05, 0.08, 0.2, 0, -0.02, 0.22, 0.18); // 枪托
  part(g, matMetal, 0.05, 0.16, 0.07, 0, -0.11, -0.12, 0.5); // 弹匣（弧形近似）
  part(g, matWood, 0.04, 0.09, 0.05, 0, -0.1, 0.05, 0.3);   // 握把
  return { group: g, muzzle: new THREE.Vector3(0, 0.01, -0.68) };
}

function makeUSP() {
  const g = new THREE.Group();
  part(g, matBody, 0.05, 0.08, 0.26, 0, 0, -0.05);      // 套筒
  part(g, matMetal, 0.03, 0.03, 0.1, 0, 0.005, -0.2);   // 消音管
  part(g, matMetal, 0.045, 0.13, 0.06, 0, -0.09, 0.04, 0.25); // 握把
  return { group: g, muzzle: new THREE.Vector3(0, 0.005, -0.27) };
}

function makeMP5() {
  const g = new THREE.Group();
  part(g, matBody, 0.06, 0.08, 0.36, 0, 0, -0.08);       // 机匣
  part(g, matMetal, 0.026, 0.026, 0.16, 0, 0.008, -0.32); // 消音枪管
  part(g, matMetal, 0.045, 0.14, 0.055, 0, -0.1, -0.05, 0.15); // 直弹匣
  part(g, matBody, 0.04, 0.08, 0.05, 0, -0.09, 0.1, 0.3);  // 握把
  part(g, matBody, 0.045, 0.06, 0.18, 0, -0.005, 0.2);     // 枪托
  return { group: g, muzzle: new THREE.Vector3(0, 0.008, -0.42) };
}

function makeAWP() {
  const g = new THREE.Group();
  const matOlive = new THREE.MeshLambertMaterial({ color: 0x4a5d3a });
  part(g, matOlive, 0.06, 0.09, 0.55, 0, 0, -0.1);       // 枪身
  part(g, matMetal, 0.026, 0.026, 0.5, 0, 0.012, -0.6);  // 长枪管
  part(g, matMetal, 0.04, 0.05, 0.22, 0, 0.085, -0.12);  // 瞄准镜
  part(g, matBody, 0.04, 0.09, 0.05, 0, -0.1, 0.12, 0.3); // 握把
  part(g, matOlive, 0.05, 0.09, 0.24, 0, -0.01, 0.3);    // 枪托
  part(g, matMetal, 0.05, 0.1, 0.06, 0, -0.12, -0.02, 0.1); // 弹匣
  return { group: g, muzzle: new THREE.Vector3(0, 0.012, -0.87) };
}

function flashTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,240,180,1)');
  gr.addColorStop(0.4, 'rgba(255,180,60,.85)');
  gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export class ViewModel {
  constructor(camera) {
    this.root = new THREE.Group();
    this.base = new THREE.Vector3(0.26, -0.24, -0.5);
    this.root.position.copy(this.base);
    camera.add(this.root);

    this.models = { ak: makeAK(), usp: makeUSP(), mp5: makeMP5(), awp: makeAWP() };
    for (const k in this.models) { this.models[k].group.visible = false; this.root.add(this.models[k].group); }

    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flash.visible = false;
    this.root.add(this.flash);

    this.cur = 'ak'; this.show('ak');
    this.bobT = 0; this.kick = 0; this.flashT = 0; this.reloadT = 0;
    this._muzzleWorld = new THREE.Vector3();
  }

  show(w) {
    this.cur = w;
    for (const k in this.models) this.models[k].group.visible = (k === w);
    const m = this.models[w].muzzle;
    this.flash.position.copy(m);
  }

  fire() { this.kick = 1; this.flashT = 0.045; this.flash.rotation.z = Math.random() * 6.28; }

  update(dt, { moving = false, grounded = true, reloadT = 0 }) {
    this.bobT += dt * (moving && grounded ? 9 : 2);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.flashT -= dt; this.flash.visible = this.flashT > 0;
    this.reloadT = reloadT;
    const bob = moving && grounded ? 1 : 0;
    const model = this.models[this.cur].group;
    model.position.z = this.kick * 0.09;
    model.rotation.x = this.kick * 0.14 + (reloadT > 0 ? 0.65 : 0);
    model.rotation.z = (reloadT > 0 ? 0.25 : 0);
    this.root.position.set(
      this.base.x + Math.sin(this.bobT) * 0.008 * bob,
      this.base.y + Math.abs(Math.cos(this.bobT)) * 0.01 * bob + this.kick * 0.012,
      this.base.z
    );
  }

  muzzleWorld(camera) {
    const m = this.models[this.cur].muzzle;
    this._muzzleWorld.copy(m).applyMatrix4(this.root.matrixWorld);
    return this._muzzleWorld;
  }
}
