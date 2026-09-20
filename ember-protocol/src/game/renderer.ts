import Phaser from 'phaser';
import { WEAPONS } from './config';
import { distance, seededRandom } from './math';
import type { Simulation } from './simulation';
import type { AudioEngine } from './audio';
import type { Enemy, GameEvent, Vec, WeaponId } from './types';
import type { I18n } from '../i18n';

type Graphics = Phaser.GameObjects.Graphics;
interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
}
interface Ring extends Vec {
  life: number;
  max: number;
  radius: number;
  color: number;
}
interface Arc extends Vec {
  target: Vec;
  life: number;
}
/** A corpse left behind by a kill: different causes die in different ways. */
interface Death extends Vec {
  kind: Enemy['kind'];
  cause: NonNullable<GameEvent['cause']>;
  color: number;
  radius: number;
  life: number;
  max: number;
  spin: number;
  vx: number;
  vy: number;
  shards: number;
  spread: number;
}
interface Flash extends Vec {
  angle: number;
  life: number;
  max: number;
  color: number;
}
const DEATH_TIME = { crawler: 0.3, spitter: 0.32, brute: 0.45, boss: 0.62 };

export class ArenaRenderer {
  private floor: Graphics;
  private ink: Graphics;
  private effects: Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private arcs: Arc[] = [];
  private deaths: Death[] = [];
  private flashes: Flash[] = [];
  private recoil = { x: 0, y: 0, life: 0 };
  private edgeFlash = 0;
  private shotShakeAt = -1;
  private shownComboTier = 0;
  private lowHpTimer = 0;
  private drawnLevel = -1;
  private random = seededRandom(42);
  constructor(
    private scene: Phaser.Scene,
    private model: Simulation,
    private i18n: I18n,
    private audio: AudioEngine,
  ) {
    this.floor = scene.add.graphics();
    this.ink = scene.add.graphics();
    this.effects = scene.add.graphics();
  }
  private text(x: number, y: number, text: string, size: number, color: string, alpha = 1) {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'Consolas, monospace',
        fontSize: size,
        color,
        letterSpacing: 2,
      })
      .setAlpha(alpha)
      .setDepth(1);
    this.labels.push(t);
    return t;
  }
  reset() {
    this.particles = [];
    this.rings = [];
    this.arcs = [];
    this.deaths = [];
    this.flashes = [];
    this.recoil = { x: 0, y: 0, life: 0 };
    this.edgeFlash = 0;
    this.drawnLevel = -1;
  }
  private drawFloor() {
    this.drawnLevel = this.model.levelIndex;
    this.labels.forEach((t) => t.destroy());
    this.labels = [];
    const g = this.floor,
      l = this.model.level,
      rng = seededRandom(13 + this.model.levelIndex);
    g.clear();
    g.fillStyle(0x101d1e).fillRect(0, 0, 1280, 800);
    g.fillStyle(0x080f10, 0.5).fillRoundedRect(32, 40, 1220, 742, 22);
    g.fillStyle(0x40534c).fillRoundedRect(36, 30, 1208, 732, 18);
    g.fillStyle(0x1b2929).fillRoundedRect(48, 42, 1184, 708, 13);
    g.fillStyle(l.floor).fillRoundedRect(62, 56, 1156, 680, 8);
    for (let y = 64; y < 736; y += 56)
      for (let x = 64; x < 1216; x += 64) {
        g.fillStyle(rng() > 0.5 ? 0x7e9a88 : 0x0b1c1d, 0.035 + rng() * 0.04).fillRect(
          x + 1,
          y + 1,
          62,
          54,
        );
        g.lineStyle(1, 0x111f21, 0.24).strokeRect(x, y, 64, 56);
        if (rng() < 0.13) {
          g.fillStyle(0xa7b6a1, 0.12)
            .fillCircle(x + 7, y + 7, 1.3)
            .fillCircle(x + 56, y + 48, 1.3);
        }
      }
    // Theme pass: every sector dresses the same frame differently.
    const theme = l.theme;
    if (theme === 'grass') {
      g.lineStyle(3, l.accent, 0.08).strokeRoundedRect(150, 140, 980, 520, 46);
      g.fillStyle(l.accent, 0.04).fillEllipse(640, 400, 760, 380);
      for (let i = 0; i < 90; i++) {
        const x = 90 + rng() * 1100,
          y = 100 + rng() * 600;
        if (rng() < 0.18) {
          const petal = [0xe8b4c8, 0xe7d98b, 0xd8a1e0][Math.floor(rng() * 3)];
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            g.fillStyle(petal, 0.8).fillCircle(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.6);
          }
          g.fillStyle(0xf1e3a0, 0.95).fillCircle(x, y, 2.2);
        } else {
          const h = 5 + rng() * 9,
            sway = Math.sin(rng() * 6) * 2;
          g.lineStyle(2, [0x5f8f4e, 0x7aa860, 0x486f42][Math.floor(rng() * 3)], 0.75);
          g.lineBetween(x, y, x + sway, y - h);
        }
      }
      for (const c of [
        { x: 140, y: 150 },
        { x: 1140, y: 150 },
        { x: 1140, y: 650 },
      ]) {
        g.lineStyle(1, 0xdfe8df, 0.16);
        for (let r = 12; r <= 42; r += 12) g.strokeCircle(c.x, c.y, r);
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          g.lineBetween(c.x, c.y, c.x + Math.cos(a) * 42, c.y + Math.sin(a) * 42);
        }
      }
    } else if (theme === 'hollow') {
      for (let r = 60; r < 640; r += 46)
        g.lineStyle(
          1 + (r % 92 === 0 ? 1 : 0),
          0x8a6b46,
          0.1 + (r % 138 === 0 ? 0.05 : 0),
        ).strokeCircle(640, 400, r);
      for (let i = 0; i < 26; i++) {
        const y = 90 + i * 24;
        g.lineStyle(1, 0x9a7a52, 0.12);
        g.beginPath();
        g.moveTo(90, y);
        for (let x = 90; x <= 1190; x += 40) g.lineTo(x, y + Math.sin(x * 0.013 + i) * 6);
        g.strokePath();
      }
      for (let i = 0; i < 14; i++) {
        const x = 140 + rng() * 1000,
          y = 130 + rng() * 540;
        g.fillStyle(0x3f5e52, 0.5).fillRect(x - 1.5, y, 3, 8);
        g.fillStyle([0x9fd8c8, 0xd8c89a][Math.floor(rng() * 2)], 0.85).fillEllipse(x, y, 9, 5);
      }
      for (let i = 0; i < 16; i++) {
        const x = 90 + rng() * 1100,
          len = 40 + rng() * 90;
        g.lineStyle(2, 0x4f7a4a, 0.5);
        g.beginPath();
        g.moveTo(x, 62);
        for (let s = 1; s <= 4; s++) g.lineTo(x + Math.sin(s * 2 + i) * 4, 62 + (len / 4) * s);
        g.strokePath();
        g.fillStyle(0x77a86b, 0.75).fillCircle(x + Math.sin(8 + i) * 4, 62 + len, 3);
      }
    } else if (theme === 'moon') {
      for (let i = 0; i < 130; i++)
        g.fillStyle(0xcfe0f4, 0.12 + rng() * 0.25).fillCircle(
          80 + rng() * 1120,
          90 + rng() * 620,
          rng() * 1.6,
        );
      for (let i = 0; i < 16; i++) {
        const x = 130 + rng() * 1020,
          y = 130 + rng() * 540,
          r = 12 + rng() * 30;
        g.fillStyle(0x1a2438, 0.75).fillCircle(x, y, r);
        g.fillStyle(0x2b3a56, 0.8).fillCircle(x - r * 0.2, y - r * 0.2, r * 0.82);
        g.lineStyle(1, 0x3d5178, 0.35).strokeCircle(x, y, r);
      }
      g.lineStyle(1, l.accent, 0.06);
      for (let x = 80; x < 1200; x += 64) g.lineBetween(x, 62, x, 736);
      for (let y = 80; y < 720; y += 56) g.lineBetween(62, y, 1218, y);
      g.fillStyle(0x3556a8, 0.9).fillCircle(1090, 150, 26);
      g.fillStyle(0x6f9be0, 0.9).fillCircle(1082, 143, 20);
      g.lineStyle(2, 0xa8c8f0, 0.5).strokeCircle(1090, 150, 30);
    } else {
      const tints = [0x9fd08c, 0xd8a86b, 0x8fb6e8, 0xd977a4];
      tints.forEach((c, i) => {
        const x = 190 + i * 300;
        g.fillStyle(c, 0.05).fillEllipse(x, 400, 130, 460);
        g.fillStyle(c, 0.1).fillEllipse(x, 400, 46, 330);
        g.lineStyle(2, c, 0.35).strokeEllipse(x, 400, 30, 250);
        g.fillStyle(c, 0.5).fillCircle(x, 400, 5);
      });
      for (let y = 64; y < 736; y += 56)
        for (let x = 64; x < 1216; x += 64)
          if (((x / 64 + y / 56) | 0) % 2 === 0)
            g.fillStyle(0xffffff, 0.015).fillRect(x + 1, y + 1, 62, 54);
    }
    const ob =
      theme === 'grass'
        ? { side: 0x2f4a2c, top: 0x47683c, plate: 0x39563a, edge: 0x6f8f5f }
        : theme === 'hollow'
          ? { side: 0x3a2a1a, top: 0x5a4128, plate: 0x4a3520, edge: 0x8a6a45 }
          : theme === 'moon'
            ? { side: 0x1c2436, top: 0x33405e, plate: 0x2a3450, edge: 0x5f7ba8 }
            : { side: 0x2c2136, top: 0x47365a, plate: 0x3a2c4a, edge: 0x8a6fa8 };
    for (const b of l.obstacles) {
      g.fillStyle(0x061418, 0.3).fillRoundedRect(b.x + 10, b.y + 14, b.w + 4, b.h + 4, 8);
      g.fillStyle(0x18282b).fillRoundedRect(b.x, b.y, b.w, b.h + 6, 5);
      g.fillStyle(ob.side).fillRoundedRect(b.x, b.y - 8, b.w, b.h, 5);
      g.fillStyle(ob.top).fillRoundedRect(b.x + 5, b.y - 4, b.w - 10, b.h - 9, 3);
      g.lineStyle(2, ob.edge, 0.4).strokeRoundedRect(b.x + 7, b.y - 2, b.w - 14, b.h - 13, 2);
      g.fillStyle(0x101d20).fillRect(b.x + 12, b.y + 9, b.w - 24, 18);
      for (let j = 0; j < Math.floor((b.w - 20) / 12); j++)
        g.fillStyle(ob.plate).fillRect(b.x + 15 + j * 12, b.y + 11, 5, 14);
      g.fillStyle(l.accent, 0.7).fillRect(b.x + 10, b.y + b.h - 19, 14, 3);
      g.fillStyle(0xf1c285, 0.65).fillRect(b.x + b.w - 16, b.y + 2, 5, 5);
      g.lineStyle(1, 0x0d1a1c, 0.6).lineBetween(
        b.x + 8,
        b.y + b.h - 3,
        b.x + b.w - 8,
        b.y + b.h - 3,
      );
    }
    this.text(90, 113, `SECTOR 0${this.model.levelIndex + 1}`, 13, '#b4c4b4', 0.26);
    this.text(1015, 664, 'RESTRICTED', 11, '#d6b795', 0.35);
    this.text(612, 625, '// 0' + (this.model.levelIndex + 1), 26, '#bbcabb', 0.13);
    // Airlock on the right, visible before it is activated.
    g.fillStyle(0x12272a).fillRoundedRect(1141, 325, 68, 150, 18);
    g.lineStyle(3, 0x607b73, 0.5).strokeRoundedRect(1147, 331, 56, 138, 15);
  }
  render(dt: number, time: number) {
    if (this.drawnLevel !== this.model.levelIndex) this.drawFloor();
    const g = this.ink,
      m = this.model;
    g.clear();
    if (this.recoil.life > 0) this.recoil.life = Math.max(0, this.recoil.life - dt);
    const pl = this.model.player;
    if (this.model.phase === 'combat' && pl.hp > 0 && pl.hp / pl.maxHp < 0.3) {
      this.lowHpTimer -= dt;
      if (this.lowHpTimer <= 0) {
        this.audio.playHeartbeat();
        this.lowHpTimer = 0.9;
        this.edgeFlash = Math.max(this.edgeFlash, 0.14);
      }
    } else this.lowHpTimer = 0;
    this.drawPortal(g, time);
    for (const b of m.barrels) {
      g.fillStyle(0x091619, 0.4).fillEllipse(b.x + 5, b.y + 8, 40, 25);
      g.fillStyle(0x925f42).fillRoundedRect(b.x - 15, b.y - 18, 30, 38, 7);
      g.fillStyle(0xc58c59).fillEllipse(b.x, b.y - 15, 29, 13);
      g.fillStyle(0x4c4937)
        .fillRect(b.x - 16, b.y - 8, 32, 6)
        .fillRect(b.x - 16, b.y + 9, 32, 5);
      g.fillStyle(0xf6bf71).fillTriangle(b.x, b.y - 1, b.x - 6, b.y + 8, b.x + 6, b.y + 8);
    }
    for (const p of m.pickups) {
      const y = p.y + Math.sin(time * 2.6 + p.id) * 4,
        color = p.kind === 'module' ? 0xa5d6bc : 0xb7e699;
      g.fillStyle(color, 0.035).fillCircle(p.x, p.y, 44);
      g.fillStyle(color, 0.07).fillCircle(p.x, p.y, 30);
      g.lineStyle(1, color, 0.4).strokeEllipse(p.x, p.y + 15, 48, 19);
      if (p.kind === 'module') {
        g.fillStyle(0x193c36).fillRoundedRect(p.x - 13, y - 15, 26, 28, 5);
        g.lineStyle(2, color).strokeRoundedRect(p.x - 13, y - 15, 26, 28, 5);
        g.fillStyle(color)
          .fillTriangle(p.x + 3, y - 10, p.x - 7, y + 1, p.x + 1, y + 1)
          .fillTriangle(p.x - 1, y - 1, p.x + 7, y - 1, p.x - 3, y + 9);
      } else {
        g.fillStyle(0x2c5141).fillRoundedRect(p.x - 11, y - 11, 22, 22, 5);
        g.fillStyle(color)
          .fillRect(p.x - 2, y - 7, 4, 14)
          .fillRect(p.x - 7, y - 2, 14, 4);
      }
    }
    for (const e of m.enemies) this.drawEnemy(g, e, time);
    if (m.phase === 'menu') {
      this.drawAgent(g, { x: 850, y: 442 }, -0.4, 'rifle', time, false, false);
      this.drawEnemy(
        g,
        {
          id: 0,
          x: 1047,
          y: 221,
          kind: 'crawler',
          hp: 48,
          maxHp: 48,
          radius: 20,
          angle: 2.6,
          cooldown: 0,
          slow: 0,
          flash: 0,
          age: 10,
          windup: 0,
          target: { x: 0, y: 0 },
          charge: 0,
        },
        time,
      );
      this.drawEnemy(
        g,
        {
          id: 1,
          x: 1030,
          y: 622,
          kind: 'spitter',
          hp: 66,
          maxHp: 66,
          radius: 23,
          angle: -2.2,
          cooldown: 0,
          slow: 0,
          flash: 0,
          age: 10,
          windup: 0,
          target: { x: 0, y: 0 },
          charge: 0,
        },
        time,
      );
      this.drawAgent(g, { x: 750, y: 520 }, -0.65, 'rifle', time, true, false);
    } else {
      if (m.squad) this.drawAgent(g, m.ally, m.ally.angle, 'rifle', time, true, false);
      const p = m.player;
      if (p.dashRemaining > 0) {
        for (let i = 1; i <= 4; i++)
          g.fillStyle(0xf6bd90, 0.1 * (1 - i / 5)).fillCircle(
            p.x - p.dashDirection.x * i * 15,
            p.y - p.dashDirection.y * i * 15,
            20 - i * 2,
          );
      }
      if (p.invincible > 0) {
        g.lineStyle(2, 0xf6cba4, 0.3 + Math.sin(time * 20) * 0.2).strokeCircle(p.x, p.y, 26);
      }
      const maxDash = m.skills.includes('nova') ? 1.65 : 2.2;
      if (p.dashCooldown > 0) {
        g.lineStyle(3, 0x8fd3e6, 0.85).beginPath();
        g.arc(
          p.x,
          p.y,
          33,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / maxDash),
        );
        g.strokePath();
      } else {
        g.lineStyle(2, 0x8fd3e6, 0.3 + Math.sin(time * 6) * 0.15).strokeCircle(p.x, p.y, 33);
      }
      const kick = this.recoil.life > 0;
      if (kick) {
        const k = this.recoil.life / 0.09;
        g.save().translateCanvas(this.recoil.x * k, this.recoil.y * k);
      }
      this.drawAgent(g, p, p.angle, p.weapon, time, false, p.moving);
      if (kick) g.restore();
      if (p.reloadRemaining > 0) {
        g.lineStyle(3, 0xf2c397, 0.9);
        g.beginPath();
        g.arc(
          p.x,
          p.y,
          29,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (1 - p.reloadRemaining / m.weapon.reload),
        );
        g.strokePath();
      }
    }
    // Player projectiles (including flame cones) render first so that enemy
    // bullets always stay visible above the fire — a close-range flamethrower
    // must never hide the projectiles that can hit you.
    for (const b of m.bullets) {
      if (b.enemy) continue;
      if (b.flame) {
        const v = Math.hypot(b.vx, b.vy),
          life = Math.max(0, Math.min(1, b.ttl * 4));
        g.fillStyle(b.color, 0.16 * life).fillCircle(b.x, b.y, 11);
        g.fillStyle(b.color, 0.4 * life).fillCircle(b.x, b.y, 6);
        g.fillStyle(0xffe3b0, 0.75 * life).fillCircle(
          b.x - (b.vx / v) * 3,
          b.y - (b.vy / v) * 3,
          3,
        );
      } else {
        const v = Math.hypot(b.vx, b.vy);
        g.lineStyle(6, b.color, 0.1).lineBetween(
          b.x - (b.vx / v) * 19,
          b.y - (b.vy / v) * 19,
          b.x,
          b.y,
        );
        g.lineStyle(2, b.color, 0.95).lineBetween(
          b.x - (b.vx / v) * 15,
          b.y - (b.vy / v) * 15,
          b.x,
          b.y,
        );
        g.fillStyle(0xfff1d0).fillCircle(b.x, b.y, 2);
      }
    }
    for (const b of m.bullets) {
      if (!b.enemy) continue;
      g.fillStyle(b.color, 0.11).fillCircle(b.x, b.y, 13);
      g.fillStyle(0x3b2330).fillCircle(b.x, b.y, 7);
      g.lineStyle(2, b.color).strokeCircle(b.x, b.y, 5);
      g.fillStyle(0xffe0ce).fillCircle(b.x - 1, b.y - 1, 2);
    }
    this.drawEffects(dt);
  }
  private drawPortal(g: Graphics, t: number) {
    const active =
        this.model.phase === 'exit' ||
        (this.model.phase === 'upgrade' && this.model.remaining === 0),
      c = active ? 0xa9e0c3 : 0x526966;
    if (active) {
      g.fillStyle(c, 0.04).fillEllipse(1174, 400, 120, 196);
      g.fillStyle(c, 0.08).fillEllipse(1174, 400, 62, 135);
    }
    g.lineStyle(3, c, active ? 0.8 : 0.35).strokeEllipse(1174, 400, 36, 112);
    g.lineStyle(1, c, active ? 0.5 : 0.2).strokeEllipse(1174, 400, 24 + Math.sin(t * 2) * 5, 94);
    if (active) {
      for (let i = 0; i < 3; i++) {
        const x = 1138 + ((t * 24 + i * 16) % 50);
        g.lineStyle(2, c, 0.4)
          .lineBetween(x, 393, x + 7, 400)
          .lineBetween(x + 7, 400, x, 407);
      }
    }
  }
  private drawAgent(
    g: Graphics,
    p: Vec,
    a: number,
    weapon: WeaponId,
    t: number,
    ally: boolean,
    moving: boolean,
  ) {
    const c = ally ? 0x8ebdb1 : 0xe3a074,
      step = moving ? Math.sin(t * 19) * 5 : Math.sin(t * 2) * 0.8;
    g.fillStyle(0x071416, 0.46).fillEllipse(p.x + 3, p.y + 12, 45, 23);
    g.lineStyle(1, c, 0.32).strokeEllipse(p.x, p.y + 13, 51, 27);
    g.save().translateCanvas(p.x, p.y).rotateCanvas(a);
    g.fillStyle(0x142c2c)
      .fillRoundedRect(-10 + step, -14, 14, 10, 3)
      .fillRoundedRect(-10 - step, 4, 14, 10, 3);
    g.fillStyle(0x303f39).fillRoundedRect(-21, -12, 12, 24, 4);
    g.fillStyle(c).fillRoundedRect(-13, -15, 26, 30, 7);
    g.fillStyle(0x745744, 0.3).fillRoundedRect(-12, 4, 23, 11, 4);
    g.fillStyle(0x24383a).fillRoundedRect(-7, -10, 20, 20, 6);
    g.fillStyle(0x6e8c87).fillRoundedRect(-5, -9, 16, 17, 5);
    g.fillStyle(0x142c32).fillRoundedRect(2, -9, 12, 18, 4);
    g.fillStyle(0xbbebdc).fillRoundedRect(8, -6, 5, 12, 2);
    g.fillStyle(c).fillCircle(7, 17, 6).fillCircle(18, -9, 5);
    g.translateCanvas(23, 10);
    this.drawGun(g, weapon);
    g.restore();
    g.fillStyle(c, 0.9).fillCircle(p.x, p.y - 34, 2);
  }
  private drawGun(g: Graphics, id: WeaponId) {
    const c = WEAPONS[id].color;
    g.fillStyle(0x101c20).fillRoundedRect(-12, -5, 39, 10, 2).fillRect(-6, 4, 7, 6);
    g.fillStyle(id === 'flamer' ? 0x7a4a38 : 0x697975).fillRoundedRect(-10, -5, 26, 8, 2);
    g.fillStyle(c).fillRect(-7, -4, 10, 3);
    g.fillStyle(0x9baaa0).fillRect(19, -3, 10, 4);
    if (id === 'flamer') {
      // Wide nozzle plus an under-slung fuel tank: reads as a flamethrower at a glance.
      g.fillStyle(0x3c2f28).fillRoundedRect(5, -6, 17, 12, 3);
      g.fillStyle(c).fillRect(21, -4, 8, 8);
      g.fillStyle(0x93502f).fillRoundedRect(-2, 5, 16, 9, 4);
      g.fillStyle(0xd98c5f).fillRect(0, 7, 12, 3);
    }
  }
  private drawEnemy(g: Graphics, e: Enemy, t: number) {
    if (e.age < 0.7) {
      g.lineStyle(2, 0xe69caa, 0.6).strokeCircle(e.x, e.y, (1 - e.age / 0.7) * 35 + e.radius);
      g.fillStyle(0xe69caa, 0.05).fillCircle(e.x, e.y, e.radius + 12);
      return;
    }
    const skin = e.skin ?? 'spider';
    const PAL = {
      spider: { crawler: 0x9aaa74, spitter: 0xab8797, brute: 0xb69379 },
      bat: { crawler: 0x8f6fae, spitter: 0xb98fc4, brute: 0x6b5a8f },
      alien: { crawler: 0x74c7a3, spitter: 0x8fd0e8, brute: 0x6fa8c9 },
    } as const;
    const c =
      e.flash > 0
        ? 0xf3e5d3
        : e.slow > 0
          ? 0x9bc9d8
          : e.kind === 'boss'
            ? 0xa87086
            : PAL[skin][e.kind as 'crawler' | 'spitter' | 'brute'];
    if (e.windup > 0) {
      g.lineStyle(e.kind === 'boss' ? 3 : 28, 0xf4a68b, 0.13);
      if (e.kind === 'boss') {
        g.strokeCircle(e.x, e.y, 85 + (1 - e.windup) * 70);
        g.lineStyle(2, 0xf4a68b, 0.5).strokeCircle(e.x, e.y, 75);
      } else {
        g.lineBetween(e.x, e.y, e.target.x, e.target.y);
        g.lineStyle(2, 0xf2b1a3, 0.45).lineBetween(e.x, e.y, e.target.x, e.target.y);
      }
    }
    const r = e.radius;
    // Bats hover: the body bobs while the shadow stays on the floor.
    const hover = skin === 'bat' && e.kind !== 'boss' ? 7 + Math.sin(t * 3.1 + e.id) * 5 : 0;
    g.fillStyle(0x081517, hover ? 0.22 : 0.38).fillEllipse(
      e.x + 4,
      e.y + r * 0.5,
      r * (hover ? 1.6 : 2.1),
      r * (hover ? 0.8 : 1.05),
    );
    g.save()
      .translateCanvas(e.x, e.y - hover)
      .rotateCanvas(e.angle);
    if (e.kind === 'boss') {
      this.drawBossBody(g, e, c, t);
    } else if (skin === 'bat') {
      const flap = Math.sin(t * 14 + e.id) * (e.kind === 'brute' ? 0.5 : 0.72),
        wing = e.kind === 'brute' ? 1.5 : 1;
      for (const s of [-1, 1]) {
        g.save().rotateCanvas(s * flap * 0.35);
        g.fillStyle(0x2c2240, 0.9);
        g.fillTriangle(
          -r * 0.2,
          s * r * 0.25,
          -r * 0.55,
          s * r * 0.9 * wing,
          r * 0.28,
          s * r * 0.55 * wing,
        );
        g.fillTriangle(
          r * 0.1,
          s * r * 0.28,
          r * 0.55,
          s * r * 1.05 * wing,
          r * 0.5,
          s * r * 0.3 * wing,
        );
        g.fillStyle(c, 0.75);
        g.fillTriangle(
          -r * 0.1,
          s * r * 0.3,
          -r * 0.4,
          s * r * 0.75 * wing,
          r * 0.2,
          s * r * 0.45 * wing,
        );
        g.restore();
      }
      g.fillStyle(0x241b33).fillEllipse(0, 0, r * 1.25, r * 0.95);
      g.fillStyle(c).fillEllipse(r * 0.1, 0, r * 0.95, r * 0.75);
      g.fillStyle(0x241b33)
        .fillTriangle(-r * 0.15, -r * 0.5, -r * 0.05, -r * 0.95, r * 0.18, -r * 0.55)
        .fillTriangle(-r * 0.15, r * 0.5, -r * 0.05, r * 0.95, r * 0.18, r * 0.55);
      g.fillStyle(0xffd9a0)
        .fillCircle(r * 0.42, -r * 0.2, 2.6)
        .fillCircle(r * 0.42, r * 0.2, 2.6);
      if (e.kind === 'spitter') g.fillStyle(0xd2a8ae, 0.95).fillCircle(r * 0.15, 0, 5);
    } else if (skin === 'alien') {
      for (let i = -1; i <= 1; i++) {
        const n = Math.sin(t * 6 + e.id + i) * 5;
        g.lineStyle(e.kind === 'brute' ? 5 : 3, c, 0.85).lineBetween(
          i * 9,
          r * 0.4,
          i * 12 + n,
          r + 6,
        );
      }
      g.fillStyle(c, 0.16).fillCircle(0, 0, r * 1.5 + Math.sin(t * 4 + e.id) * 3);
      g.fillStyle(0x16302e).fillCircle(0, 0, r * 0.95);
      g.fillStyle(c).fillCircle(0, 0, r * 0.8);
      g.fillStyle(0xeafff4).fillCircle(r * 0.28, 0, r * 0.34);
      g.fillStyle(0x0c1c1a).fillCircle(r * 0.36, 0, r * 0.18);
      if (e.kind === 'brute') {
        g.lineStyle(3, 0x3c5f74, 0.8).strokeCircle(0, 0, r * 0.92);
        g.fillStyle(0x9fd8c8, 0.5).fillTriangle(
          -r * 0.6,
          -r * 0.6,
          -r * 0.2,
          -r * 0.9,
          -r * 0.4,
          -r * 0.3,
        );
      }
      if (e.kind === 'spitter')
        g.fillStyle(0xd2e8ff, 0.9)
          .fillCircle(r * 0.5, -r * 0.45, 4)
          .fillCircle(r * 0.5, r * 0.45, 4);
    } else {
      for (let i = -1; i <= 1; i++) {
        const n = Math.sin(t * 10 + e.id + i) * 4;
        g.lineStyle(e.kind === 'brute' ? 6 : 3, c, 0.8)
          .lineBetween(i * 12, -r * 0.5, i * 13 + n, -r - 5)
          .lineBetween(i * 13 + n, -r - 5, i * 13 + 7, -r - 9)
          .lineBetween(i * 12, r * 0.5, i * 13 - n, r + 5)
          .lineBetween(i * 13 - n, r + 5, i * 13 + 7, r + 9);
      }
      if (e.kind === 'brute') {
        g.fillStyle(0x575044).fillRoundedRect(-29, -24, 52, 48, 10);
        g.fillStyle(c).fillRoundedRect(-29, -23, 39, 46, 9);
        g.lineStyle(3, 0x6d6150).lineBetween(-13, -20, -13, 20);
        g.fillStyle(0xd6b795)
          .fillTriangle(20, -20, 38, -17, 22, -8)
          .fillTriangle(20, 20, 38, 17, 22, 8);
      } else {
        g.fillStyle(c).fillEllipse(-3, 0, r * 1.9, r * 1.6);
        g.fillStyle(0x293e37, 0.35).fillEllipse(-7, 2, r * 1.1, r * 1.2);
        g.lineStyle(2, 0x435747, 0.6).lineBetween(-r + 3, 0, 3, 0);
      }
      if (e.kind === 'spitter') {
        for (let i = 0; i < 4; i++)
          g.fillStyle(0xd2a8ae, 0.8).fillCircle(-10 + (i % 2) * 12, -9 + Math.floor(i / 2) * 17, 4);
      }
      g.fillStyle(0x26332e).fillEllipse(r * 0.55, 0, 16, r * 1.12);
      g.fillStyle(0xf4bc9c)
        .fillCircle(r * 0.7, -6, 3)
        .fillCircle(r * 0.7, 6, 3);
    }
    if (e.elite) {
      g.lineStyle(3, 0xf0c060, 0.9).strokeCircle(0, 0, r + 8);
      g.fillStyle(0xf0c060).fillTriangle(-7, -(r + 16), 7, -(r + 16), 0, -(r + 5));
    }
    g.restore();
    if (e.hp < e.maxHp && e.kind !== 'boss') {
      g.fillStyle(0x0b1a1c, 0.8).fillRoundedRect(e.x - 19, e.y - r - 16, 38, 4, 2);
      g.fillStyle(c).fillRoundedRect(
        e.x - 19,
        e.y - r - 16,
        38 * Math.max(0, e.hp / e.maxHp),
        4,
        2,
      );
    }
  }
  /** Final boss silhouettes, one per selectable nemesis. */
  private drawBossBody(g: Graphics, e: Enemy, c: number, t: number) {
    const r = e.radius;
    switch (e.bossId) {
      case 'zombie': {
        g.fillStyle(0x39432c).fillRoundedRect(-r * 0.7, -r * 0.85, r * 1.4, r * 1.7, 14);
        g.fillStyle(c).fillRoundedRect(-r * 0.6, -r * 0.75, r * 1.2, r * 1.5, 12);
        g.fillStyle(0x6f8f56)
          .fillRoundedRect(r * 0.3, -r * 0.95, r * 1.1, r * 0.32, 10)
          .fillRoundedRect(r * 0.3, r * 0.62, r * 1.1, r * 0.32, 10);
        g.fillStyle(0x86a86b)
          .fillCircle(r * 1.35, -r * 0.79, r * 0.17)
          .fillCircle(r * 1.35, r * 0.78, r * 0.17);
        g.fillStyle(0x8fae72).fillCircle(0, 0, r * 0.42);
        g.lineStyle(2, 0x2c331f).lineBetween(-r * 0.2, -r * 0.12, r * 0.24, r * 0.16);
        g.fillStyle(0xffe9c9)
          .fillCircle(-r * 0.08, -r * 0.08, 4.5)
          .fillCircle(r * 0.16, r * 0.05, 4.5);
        break;
      }
      case 'doll': {
        g.lineStyle(5, 0xb0574f, 0.9);
        g.strokeCircle(-r * 0.55, -r * 0.5, r * 0.3);
        g.strokeCircle(-r * 0.55, r * 0.5, r * 0.3);
        g.fillStyle(0xefe3da).fillCircle(0, 0, r * 0.78);
        g.fillStyle(c).fillCircle(0, 0, r * 0.66);
        g.lineStyle(1, 0x9c7f88, 0.8)
          .lineBetween(-r * 0.5, -r * 0.2, -r * 0.2, r * 0.1)
          .lineBetween(-r * 0.2, r * 0.1, -r * 0.35, r * 0.45);
        g.fillStyle(0x5c3b4a)
          .fillCircle(r * 0.22, -r * 0.2, 5.5)
          .fillCircle(r * 0.22, r * 0.2, 5.5);
        g.lineStyle(2, 0x5c3b4a);
        g.beginPath();
        g.arc(r * 0.1, 0, r * 0.3, -0.9, 0.9);
        g.strokePath();
        g.lineStyle(3, 0xd8b6c4, 0.7).strokeCircle(0, 0, r * 0.8);
        break;
      }
      case 'scorpion': {
        g.lineStyle(9, 0x3a4658);
        g.beginPath();
        g.moveTo(-r * 0.7, 0);
        for (let i = 1; i <= 4; i++)
          g.lineTo(-r * 0.7 - i * r * 0.32, Math.sin(t * 3 + i) * r * 0.12 - i * r * 0.18);
        g.strokePath();
        g.fillStyle(0x9fe8c8).fillCircle(-r * 1.98, -r * 0.72 + Math.sin(t * 3 + 4) * r * 0.12, 8);
        for (const s of [-1, 1]) {
          g.fillStyle(0x2c3648).fillRoundedRect(
            r * 0.5,
            s * r * 0.5 - r * 0.16,
            r * 0.7,
            r * 0.32,
            8,
          );
          g.fillStyle(c).fillCircle(r * 1.2, s * r * 0.5, r * 0.22 + Math.sin(t * 5) * 2);
        }
        g.fillStyle(0x2c3648).fillEllipse(0, 0, r * 1.5, r * 1.1);
        g.fillStyle(c).fillEllipse(0, 0, r * 1.25, r * 0.88);
        g.lineStyle(3, 0x54657e, 0.8).strokeEllipse(0, 0, r * 1.25, r * 0.88);
        for (let i = -1; i <= 1; i++) g.fillStyle(0x3a4658).fillCircle(i * r * 0.35, 0, r * 0.2);
        g.fillStyle(0xdff4ff)
          .fillCircle(r * 0.45, -r * 0.16, 3.4)
          .fillCircle(r * 0.45, r * 0.16, 3.4);
        break;
      }
      case 'flower': {
        for (let i = 0; i < 8; i++) {
          g.save().rotateCanvas((i / 8) * Math.PI * 2 + t * 0.25);
          g.fillStyle(i % 2 ? 0xc95c8c : 0xd977a4).fillEllipse(r * 0.78, 0, r * 0.72, r * 0.34);
          g.restore();
        }
        g.fillStyle(0x4c7c4a).fillEllipse(-r * 0.95, 0, r * 0.6, r * 0.28);
        g.fillStyle(0x3d6b3c).fillCircle(0, 0, r * 0.58);
        g.fillStyle(c).fillCircle(0, 0, r * 0.46);
        g.fillStyle(0x5c1f34).fillCircle(0, 0, r * 0.26 + Math.sin(t * 3) * 2);
        g.fillStyle(0xf5c1be).fillCircle(0, 0, 8 + Math.sin(t * 4) * 2);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.fillStyle(0xf5e3b0).fillTriangle(
            Math.cos(a) * r * 0.26,
            Math.sin(a) * r * 0.26,
            Math.cos(a + 0.3) * r * 0.26,
            Math.sin(a + 0.3) * r * 0.26,
            Math.cos(a + 0.15) * r * 0.1,
            Math.sin(a + 0.15) * r * 0.1,
          );
        }
        break;
      }
      case 'crow':
      default: {
        const flap = Math.sin(t * 9) * 0.5;
        for (const s of [-1, 1]) {
          g.save().rotateCanvas(s * flap);
          g.fillStyle(0x2b2438, 0.92).fillTriangle(
            -r * 0.1,
            s * r * 0.3,
            -r * 0.9,
            s * r * 1.05,
            r * 0.3,
            s * r * 0.5,
          );
          g.fillStyle(c, 0.7).fillTriangle(
            -r * 0.05,
            s * r * 0.35,
            -r * 0.7,
            s * r * 0.8,
            r * 0.2,
            s * r * 0.45,
          );
          g.restore();
        }
        g.fillStyle(0xc9a55a).fillEllipse(0, 0, r * 1.7, r * 1.05);
        g.fillStyle(0xb8934c).fillEllipse(0, 0, r * 1.25, r * 0.7);
        g.fillStyle(0xd8b66b).fillTriangle(-r * 0.5, -r * 0.35, r * 0.5, -r * 0.35, 0, -r * 0.95);
        g.fillStyle(0x1e1a2c).fillCircle(0, 0, r * 0.5);
        g.fillStyle(0xffe08a)
          .fillCircle(r * 0.16, -r * 0.12, 4.4)
          .fillCircle(r * 0.16, r * 0.12, 4.4);
        g.lineStyle(2, 0xffe08a, 0.9).lineBetween(r * 0.3, -r * 0.16, r * 0.42, r * 0.16);
        g.lineStyle(2, 0xc9a55a, 0.9);
        for (let i = -2; i <= 2; i++) g.lineBetween(i * r * 0.18, r * 0.42, i * r * 0.26, r * 0.75);
        break;
      }
    }
  }
  /** Camera shake that can be rate-limited, so burst fire stays readable. */
  private shake(duration: number, intensity: number, minInterval: number) {
    const now = this.scene.time.now;
    if (minInterval > 0) {
      if (now - this.shotShakeAt < minInterval * 1000) return;
      this.shotShakeAt = now;
    }
    this.scene.cameras.main.shake(duration, intensity);
  }
  /** 0-3: how hot the current kill streak is. Drives escalating feedback. */
  private comboTier() {
    const c = this.model.combo;
    return c >= 12 ? 3 : c >= 8 ? 2 : c >= 4 ? 1 : 0;
  }
  private warm(base: number, tier: number) {
    if (tier <= 0) return base;
    const mix = tier / 3;
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * mix);
    return (
      (lerp((base >> 16) & 255, 0xf2) << 16) |
      (lerp((base >> 8) & 255, 0xb2) << 8) |
      lerp(base & 255, 0x6b)
    );
  }
  private killFeedback(event: GameEvent) {
    const kind = event.kind ?? 'crawler';
    const cause = event.cause ?? 'bullet';
    const tier = this.comboTier();
    const color = this.warm(event.color ?? 0x94c598, tier);
    const lift = cause === 'explosion' ? -170 : -20;
    const outward = cause === 'explosion' ? 150 : cause === 'chain' ? 40 : 70;
    const angle = this.random() * Math.PI * 2;
    this.deaths.push({
      x: event.x,
      y: event.y,
      kind,
      cause,
      color: cause === 'chain' ? 0x9fd2dd : color,
      radius: (event.value ?? 20) * 0.9,
      life: DEATH_TIME[kind],
      max: DEATH_TIME[kind],
      spin: (this.random() < 0.5 ? -1 : 1) * (1.4 + this.random() * 1.6),
      vx: Math.cos(angle) * outward * 0.35,
      vy: lift + Math.sin(angle) * outward * 0.25,
      shards: cause === 'explosion' ? 7 : cause === 'chain' ? 5 : 4,
      spread: cause === 'explosion' ? 62 : cause === 'chain' ? 34 : 26,
    });
    const heavy = kind === 'brute' || kind === 'boss';
    this.shake(heavy ? 190 : 110, (heavy ? 0.009 : 0.0055) + tier * 0.0016, 0);
    if (tier === 3) this.edgeFlash = 0.34;
  }
  handle(event: GameEvent) {
    if (this.model.combo === 0) this.shownComboTier = 0;
    const color = event.color ?? 0xc6d5b0;
    if (event.type === 'shot' && event.loud && typeof event.value === 'number') {
      this.flashes.push({
        x: event.x,
        y: event.y,
        angle: event.value,
        life: 0.07,
        max: 0.07,
        color,
      });
      this.recoil = { x: -Math.cos(event.value) * 5, y: -Math.sin(event.value) * 5, life: 0.09 };
      this.shake(55, 0.0016, 0.12);
    }
    if (['hit', 'kill', 'shot', 'dash', 'explosion', 'pickup'].includes(event.type)) {
      const count =
        event.type === 'explosion'
          ? 36
          : event.type === 'kill'
            ? 16
            : event.type === 'shot'
              ? 3
              : 6;
      for (let i = 0; i < count; i++) {
        const a = this.random() * Math.PI * 2,
          s = event.type === 'explosion' ? 70 + this.random() * 280 : 25 + this.random() * 110,
          life = 0.13 + this.random() * (event.type === 'kill' ? 0.7 : 0.35);
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life,
          max: life,
          color,
          size: 1.5 + this.random() * 3,
        });
      }
    }
    if (['explosion', 'dash', 'kill', 'pickup', 'clear'].includes(event.type)) {
      const life = event.type === 'clear' ? 1.2 : 0.4;
      this.rings.push({
        x: event.x,
        y: event.y,
        life,
        max: life,
        radius:
          event.type === 'explosion'
            ? (event.value ?? 120)
            : event.type === 'clear'
              ? 220
              : event.type === 'kill'
                ? 50 + this.comboTier() * 20
                : 50,
        color: event.type === 'kill' ? this.warm(color, this.comboTier()) : color,
      });
    }
    if (event.type === 'chain' && event.target)
      this.arcs.push({ x: event.x, y: event.y, target: event.target, life: 0.18 });
    if ((event.type === 'hit' && event.value) || event.type === 'pickup') {
      const t = this.scene.add
        .text(
          event.x + (this.random() - 0.5) * 20,
          event.y - 28,
          event.type === 'pickup'
            ? event.text
              ? this.i18n.text(event.text)
              : this.i18n.t('pickupModule')
            : String(event.value),
          {
            fontFamily: 'Consolas, Microsoft YaHei, monospace',
            fontSize: event.type === 'pickup' ? 17 : 15,
            fontStyle: 'bold',
            color: event.type === 'pickup' ? '#d6f0c9' : '#f5ddbd',
            stroke: '#24332f',
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5)
        .setDepth(8);
      this.scene.tweens.add({
        targets: t,
        y: t.y - 30,
        alpha: 0,
        duration: 650,
        onComplete: () => t.destroy(),
      });
    }
    if (event.type === 'kill') {
      this.killFeedback(event);
      const tier = this.comboTier();
      if (tier > this.shownComboTier) this.audio.playCombo(tier);
      this.shownComboTier = tier;
    }
    if (event.type === 'hit') this.shake(70, 0.0022, 0);
    if (event.type === 'hurt') this.shake(130, 0.0062, 0);
    if (event.type === 'explosion') this.shake(130, 0.0035, 0);
  }
  private drawEffects(dt: number) {
    const g = this.effects;
    g.clear();
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      g.fillStyle(p.color, Math.max(0, p.life / p.max)).fillRect(p.x, p.y, p.size, p.size);
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-650);
    for (const r of this.rings) {
      r.life -= dt;
      g.lineStyle(2, r.color, Math.max(0, r.life / r.max) * 0.65).strokeCircle(
        r.x,
        r.y,
        (1 - r.life / r.max) * r.radius,
      );
      g.fillStyle(r.color, Math.max(0, r.life / r.max) * 0.035).fillCircle(
        r.x,
        r.y,
        (1 - r.life / r.max) * r.radius,
      );
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const a of this.arcs) {
      a.life -= dt;
      g.lineStyle(3, 0xc4f2f2, Math.max(0, a.life / 0.18));
      g.beginPath();
      g.moveTo(a.x, a.y);
      for (let i = 1; i < 6; i++)
        g.lineTo(
          a.x + ((a.target.x - a.x) * i) / 6 + (this.random() - 0.5) * 20,
          a.y + ((a.target.y - a.y) * i) / 6 + (this.random() - 0.5) * 20,
        );
      g.lineTo(a.target.x, a.target.y);
      g.strokePath();
    }
    this.arcs = this.arcs.filter((a) => a.life > 0);
    this.drawDeaths(dt);
    this.drawFlashes(dt);
    if (this.edgeFlash > 0) {
      this.edgeFlash = Math.max(0, this.edgeFlash - dt);
      g.lineStyle(14, 0xf6c9a0, (this.edgeFlash / 0.34) * 0.22).strokeRect(14, 14, 1252, 772);
    }
  }
  /** Corpses: shatter for chain kills, blown apart for blasts, tumble for bullets. */
  private drawDeaths(dt: number) {
    const g = this.effects;
    for (const d of this.deaths) {
      d.life -= dt;
      const t = Math.min(1, 1 - Math.max(0, d.life) / d.max);
      const x = d.x + d.vx * t,
        y = d.y + d.vy * t + (d.cause === 'explosion' ? 0 : t * t * 26);
      const alpha = 1 - t * t;
      const scale = d.cause === 'explosion' ? 1 + t * 0.35 : 1 - t * 0.45;
      g.fillStyle(0x081517, alpha * 0.25).fillEllipse(
        d.x + 4,
        d.y + d.radius * 0.5,
        d.radius * 2,
        d.radius,
      );
      g.save()
        .translateCanvas(x, y)
        .rotateCanvas(d.spin * t * (d.cause === 'chain' ? 0.5 : 1.15))
        .scaleCanvas(scale, scale);
      g.fillStyle(d.color, alpha * 0.92).fillCircle(0, 0, d.radius);
      g.fillStyle(0x16262a, alpha * 0.55).fillCircle(0, 0, d.radius * 0.52);
      g.lineStyle(2, 0x0d1a1c, alpha * 0.5).strokeCircle(0, 0, d.radius * 0.8);
      g.restore();
      const shardColor = d.cause === 'chain' ? 0xc4f2f2 : d.color;
      for (let i = 0; i < d.shards; i++) {
        const a = d.spin + (i * Math.PI * 2) / d.shards,
          reach = t * d.spread,
          size = 3 + (i % 2) * 2;
        g.fillStyle(shardColor, alpha * 0.85).fillRect(
          x + Math.cos(a) * reach - size / 2,
          y + Math.sin(a) * reach - size / 2,
          size,
          size,
        );
      }
    }
    this.deaths = this.deaths.filter((d) => d.life > 0);
  }
  private drawFlashes(dt: number) {
    const g = this.effects;
    for (const f of this.flashes) {
      f.life -= dt;
      const a = Math.max(0, f.life / f.max);
      g.save().translateCanvas(f.x, f.y).rotateCanvas(f.angle);
      g.fillStyle(0xfff1d0, a * 0.95).fillTriangle(0, 0, 30, -10, 30, 10);
      g.fillStyle(f.color, a * 0.5).fillCircle(8, 0, 13);
      g.restore();
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }
  drawAim(aim: Vec) {
    if (this.model.phase === 'menu') return;
    const g = this.effects,
      near = this.model.nearestPickup;
    g.lineStyle(1, 0xece8ce, 0.9).strokeCircle(aim.x, aim.y, 7);
    for (const d of [-1, 1])
      g.lineBetween(aim.x + d * 11, aim.y, aim.x + d * 15, aim.y).lineBetween(
        aim.x,
        aim.y + d * 11,
        aim.x,
        aim.y + d * 15,
      );
    if (near && distance(near, this.model.player) < 78)
      g.lineStyle(1, 0xebd7b6, 0.8).strokeCircle(near.x, near.y, 32);
  }
}
