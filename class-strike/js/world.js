import * as THREE from 'three';

export const r2 = v => Math.round(v * 100) / 100;

// ============ 地图 ============
// 对称竞技场：T 出生在西侧，CT 出生在东侧，中央高台 + 箱子 + 掩体墙
export function buildWorld(scene) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const matSand  = new THREE.MeshLambertMaterial({ color: 0xcdb488 });
  const matWall  = new THREE.MeshLambertMaterial({ color: 0xbfa878 });
  const matCrate = new THREE.MeshLambertMaterial({ color: 0x9c7a4f });
  const matCrate2= new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const matConc  = new THREE.MeshLambertMaterial({ color: 0x9a9a98 });
  const matPil   = new THREE.MeshLambertMaterial({ color: 0x8b8f96 });

  function box(x, y, z, w, h, d, mat, collide = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    group.add(m);
    if (collide) colliders.push({ min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + h, z + d / 2] });
    return m;
  }

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(52, 40), new THREE.MeshLambertMaterial({ color: 0xc9b17f }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  // 地面暗色装饰带
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(52, 3), new THREE.MeshLambertMaterial({ color: 0xb59f6e }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.01; strip.position.x = -18;
  group.add(strip);
  const strip2 = strip.clone(); strip2.position.x = 18; group.add(strip2);

  // 四周围墙（X: -24..24, Z: -18..18）
  box(0, 0, -18.5, 50, 5, 1, matWall);
  box(0, 0,  18.5, 50, 5, 1, matWall);
  box(-24.5, 0, 0, 1, 5, 38, matWall);
  box( 24.5, 0, 0, 1, 5, 38, matWall);

  // 中央高台 + 两侧台阶（可走上去）
  box(0, 0, 0, 8, 1.2, 8, matConc);
  for (let i = 0; i < 3; i++) {
    const h = 0.3 * (i + 1);
    box(-4.3 - i * 0.6, 0, 0, 0.6, h, 3, matConc);
    box( 4.3 + i * 0.6, 0, 0, 0.6, h, 3, matConc);
  }

  // 中央前后立柱
  box(0, 0, -7, 2, 3, 2, matPil);
  box(0, 0,  7, 2, 3, 2, matPil);

  // 四角箱子群（1.2 立方体，部分堆叠两层）
  const crates = [
    [-8, -6], [-6.8, -6], [-8, -4.8], [-8, -6, 1.2],
    [ 8,  6], [ 6.8,  6], [ 8,  4.8], [ 8,  6, 1.2],
    [-8,  6], [-6.8,  6],
    [ 8, -6], [ 6.8, -6], [ 8, -4.8],
  ];
  for (const [cx, cz, cy] of crates) box(cx, cy || 0, cz, 1.2, 1.2, 1.2, (cy ? matCrate2 : matCrate));
  box(-8, 0, 6, 1.2, 2.4, 1.2, matCrate2);   // T 侧北角双层柱
  box(-6.8, 1.2, 6, 1.2, 1.2, 1.2, matCrate);

  // 侧翼掩体墙
  box(-11, 0, -10, 6, 2.6, 0.6, matSand);
  box( 11, 0,  10, 6, 2.6, 0.6, matSand);
  box(-11, 0,  10, 6, 2.6, 0.6, matSand);
  box( 11, 0, -10, 6, 2.6, 0.6, matSand);

  // 出生点矮墙
  box(-19, 0, -4, 4, 1.1, 0.6, matConc);
  box(-19, 0,  4, 4, 1.1, 0.6, matConc);
  box( 19, 0, -4, 4, 1.1, 0.6, matConc);
  box( 19, 0,  4, 4, 1.1, 0.6, matConc);

  const spawns = {
    0: [[-21, 0, -6, -Math.PI / 2], [-21, 0, -3, -Math.PI / 2], [-21, 0, 0, -Math.PI / 2], [-21, 0, 3, -Math.PI / 2], [-21, 0, 6, -Math.PI / 2]],
    1: [[ 21, 0, -6,  Math.PI / 2], [ 21, 0, -3,  Math.PI / 2], [ 21, 0, 0,  Math.PI / 2], [ 21, 0, 3,  Math.PI / 2], [ 21, 0, 6,  Math.PI / 2]],
  };

  const nav = [
    [-16, 0], [-8, 0], [0, 0], [8, 0], [16, 0],
    [-11, -6], [-11, 6], [11, -6], [11, 6],
    [0, -12], [0, 12], [-16, -8], [-16, 8], [16, -8], [16, 8],
    [-5, -13], [5, 13], [13, 0], [-13, 0],
  ];

  return { colliders, spawns, nav, bounds: { x: 24, z: 18 } };
}

// ============ 射线检测 ============
export function rayAABB(o, d, mn, mx) {
  const ox = o.x, oy = o.y, oz = o.z, dx = d.x, dy = d.y, dz = d.z;
  let t0 = 0, t1 = 1e9;
  let ta = (mn[0] - ox) / dx, tb = (mx[0] - ox) / dx;
  if (ta > tb) { const t = ta; ta = tb; tb = t; }
  if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
  if (t0 > t1) return Infinity;
  ta = (mn[1] - oy) / dy; tb = (mx[1] - oy) / dy;
  if (ta > tb) { const t = ta; ta = tb; tb = t; }
  if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
  if (t0 > t1) return Infinity;
  ta = (mn[2] - oz) / dz; tb = (mx[2] - oz) / dz;
  if (ta > tb) { const t = ta; ta = tb; tb = t; }
  if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
  if (t0 > t1) return Infinity;
  return t0 > 0.001 ? t0 : Infinity;
}

export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0.001 ? t : Infinity;
}

// 对所有墙体 + 地面求交，返回最近距离（无交点为 Infinity）
export function rayWalls(o, d, maxT, colliders) {
  let best = maxT;
  for (const c of colliders) {
    const t = rayAABB(o, d, c.min, c.max);
    if (t < best) best = t;
  }
  if (d.y < -1e-6) { // 地面
    const t = -o.y / d.y;
    if (t > 0.001 && t < best) best = t;
  }
  return best;
}

// ============ 玩家/机器人 移动物理（AABB 碰撞 + 上台阶） ============
// body: { pos(脚底中心 Vector3), vel(Vector3), half(半宽), h(当前身高), onGround }
export function moveBody(body, dt, colliders) {
  const p = body.pos, v = body.vel, hw = body.half, h = body.h;
  v.y -= 20 * dt; // 重力

  function overlaps(y) {
    for (const c of colliders) {
      if (p.x + hw > c.min[0] && p.x - hw < c.max[0] &&
          p.z + hw > c.min[2] && p.z - hw < c.max[2] &&
          y + h > c.min[1] && y < c.max[1]) return c;
    }
    return null;
  }

  // 水平 X
  p.x += v.x * dt;
  if (Math.abs(v.x) > 0.0001) {
    let c = overlaps(p.y);
    if (c) {
      const top = c.max[1] - p.y;
      if (top > 0 && top <= 0.55 && !overlaps(c.max[1] + 0.01)) p.y = c.max[1] + 0.001; // 上台阶
      else p.x = v.x > 0 ? c.min[0] - hw - 0.001 : c.max[0] + hw + 0.001;
    }
  }
  // 水平 Z
  p.z += v.z * dt;
  if (Math.abs(v.z) > 0.0001) {
    let c = overlaps(p.y);
    if (c) {
      const top = c.max[1] - p.y;
      if (top > 0 && top <= 0.55 && !overlaps(c.max[1] + 0.01)) p.y = c.max[1] + 0.001;
      else p.z = v.z > 0 ? c.min[2] - hw - 0.001 : c.max[2] + hw + 0.001;
    }
  }
  // 垂直
  p.y += v.y * dt;
  body.onGround = false;
  if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; body.onGround = true; }
  let c = overlaps(p.y);
  if (c) {
    if (v.y <= 0) { p.y = c.max[1] + 0.001; v.y = 0; body.onGround = true; }
    else { p.y = c.min[1] - h - 0.001; v.y = 0; }
  }
}

// 命中盒：头（球）+ 身体（AABB），yaw 无关
export function hitTestBody(o, d, feetPos, crouched = false) {
  const headY = crouched ? 1.0 : 1.53;
  const bodyTop = crouched ? 1.0 : 1.42;
  const hc = new THREE.Vector3(feetPos.x, feetPos.y + headY, feetPos.z);
  const tH = raySphere(o, d, hc, 0.26);
  const mn = [feetPos.x - 0.34, feetPos.y, feetPos.z - 0.34];
  const mx = [feetPos.x + 0.34, feetPos.y + bodyTop, feetPos.z + 0.34];
  const tB = rayAABB(o, d, mn, mx);
  if (tH < tB) return { t: tH, head: true };
  if (tB < Infinity) return { t: tB, head: false };
  return null;
}
