import Phaser from 'phaser';
import { WEAPONS } from './config';
import { distance, seededRandom } from './math';
import type { Simulation } from './simulation';
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

export class ArenaRenderer {
  private floor: Graphics;
  private ink: Graphics;
  private effects: Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private arcs: Arc[] = [];
  private drawnLevel = -1;
  private random = seededRandom(42);
  constructor(
    private scene: Phaser.Scene,
    private model: Simulation,
    private i18n: I18n,
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
    // Inset service lanes and worn reactor markings.
    g.lineStyle(2, l.accent, 0.07).strokeRoundedRect(130, 120, 1020, 552, 28);
    g.lineStyle(2, l.accent, 0.1).strokeCircle(640, 400, 145);
    g.lineStyle(1, l.accent, 0.08).strokeCircle(640, 400, 159);
    g.lineStyle(2, l.accent, 0.11);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(
        640 + Math.cos(a) * 151,
        400 + Math.sin(a) * 151,
        640 + Math.cos(a) * 174,
        400 + Math.sin(a) * 174,
      );
    }
    g.fillStyle(l.accent, 0.045).fillTriangle(602, 435, 640, 355, 678, 435);
    g.lineStyle(2, l.accent, 0.1).lineBetween(78, 400, 460, 400).lineBetween(820, 400, 1150, 400);
    for (let i = 0; i < 22; i++) {
      const x = 142 + i * 46;
      g.fillStyle(0xc2c4a0, 0.15).fillRect(x, 86, 18, 3).fillRect(x, 705, 18, 3);
    }
    // Border conduits, soft light pools and a little reclaimed vegetation.
    for (const x of [174, 446, 834, 1106]) {
      g.fillStyle(0x111e20)
        .fillRoundedRect(x - 38, 40, 76, 17, 4)
        .fillRoundedRect(x - 38, 735, 76, 17, 4);
      g.fillStyle(l.accent, 0.09).fillEllipse(x, 87, 142, 110).fillEllipse(x, 706, 142, 110);
      g.fillStyle(l.accent, 0.22)
        .fillRoundedRect(x - 27, 51, 54, 8, 3)
        .fillRoundedRect(x - 27, 733, 54, 8, 3);
      g.fillStyle(0xc1dbc2)
        .fillRect(x - 24, 50, 48, 3)
        .fillRect(x - 24, 736, 48, 3);
    }
    for (let i = 0; i < 100; i++) {
      const left = rng() < 0.5,
        x = left ? 70 + rng() * 73 : 1145 + rng() * 64,
        y = 90 + rng() * 612;
      g.fillStyle(0x080f11, 0.1).fillEllipse(x + 5, y + 5, 14, 5);
      g.fillStyle([0x60785c, 0x476851, 0x385648][Math.floor(rng() * 3)], 0.6).fillEllipse(
        x,
        y,
        4 + rng() * 10,
        3 + rng() * 5,
      );
    }
    for (const b of l.obstacles) {
      g.fillStyle(0x061418, 0.3).fillRoundedRect(b.x + 10, b.y + 14, b.w + 4, b.h + 4, 8);
      g.fillStyle(0x18282b).fillRoundedRect(b.x, b.y, b.w, b.h + 6, 5);
      g.fillStyle(0x50605a).fillRoundedRect(b.x, b.y - 8, b.w, b.h, 5);
      g.fillStyle(0x3a4d49).fillRoundedRect(b.x + 5, b.y - 4, b.w - 10, b.h - 9, 3);
      g.lineStyle(2, 0x708374, 0.4).strokeRoundedRect(b.x + 7, b.y - 2, b.w - 14, b.h - 13, 2);
      g.fillStyle(0x172e2d).fillRect(b.x + 12, b.y + 9, b.w - 24, 18);
      for (let j = 0; j < Math.floor((b.w - 20) / 12); j++)
        g.fillStyle(0x263e3c).fillRect(b.x + 15 + j * 12, b.y + 11, 5, 14);
      g.fillStyle(l.accent, 0.7).fillRect(b.x + 10, b.y + b.h - 19, 14, 3);
      g.fillStyle(0xf1c285, 0.65).fillRect(b.x + b.w - 16, b.y + 2, 5, 5);
      g.lineStyle(1, 0x172d2d, 0.6).lineBetween(
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
      this.drawAgent(g, p, p.angle, p.weapon, time, false, p.moving);
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
    const c =
      e.flash > 0
        ? 0xf3e5d3
        : e.slow > 0
          ? 0x9bc9d8
          : e.kind === 'spitter'
            ? 0xab8797
            : e.kind === 'brute'
              ? 0xb69379
              : e.kind === 'boss'
                ? 0xa87086
                : 0x9aaa74;
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
    g.fillStyle(0x081517, 0.38).fillEllipse(e.x + 4, e.y + r * 0.5, r * 2.1, r * 1.05);
    g.save().translateCanvas(e.x, e.y).rotateCanvas(e.angle);
    if (e.kind === 'boss') {
      for (let i = 0; i < 6; i++) {
        g.save().rotateCanvas((i * Math.PI) / 3 + t * 0.1);
        g.lineStyle(9, 0x584253).lineBetween(29, 0, 60, Math.sin(t * 2 + i) * 13);
        g.fillStyle(c).fillCircle(62, Math.sin(t * 2 + i) * 13, 10);
        g.restore();
      }
      g.fillStyle(0x392e41).fillCircle(0, 0, 49);
      g.lineStyle(5, c).strokeCircle(0, 0, 43);
      g.fillStyle(c).fillCircle(0, 0, 31);
      g.fillStyle(0x442c3f).fillCircle(0, 0, 23);
      g.fillStyle(0xf5c1be).fillCircle(0, 0, 13 + Math.sin(t * 4) * 3);
      g.lineStyle(2, 0xeec4b8, 0.7).strokeCircle(0, 0, 35);
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
  handle(event: GameEvent) {
    const color = event.color ?? 0xc6d5b0;
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
          event.type === 'explosion' ? (event.value ?? 120) : event.type === 'clear' ? 220 : 50,
        color,
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
    if (event.type === 'hurt') this.scene.cameras.main.shake(110, 0.004);
    if (event.type === 'explosion') this.scene.cameras.main.shake(130, 0.003);
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
