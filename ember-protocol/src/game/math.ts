import type { Rect, Vec } from './types';
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function normalize(v: Vec): Vec {
  const d = Math.hypot(v.x, v.y);
  return d > 0 ? { x: v.x / d, y: v.y / d } : { x: 0, y: 0 };
}
export function circleRect(p: Vec, r: number, b: Rect): boolean {
  return Math.hypot(p.x - clamp(p.x, b.x, b.x + b.w), p.y - clamp(p.y, b.y, b.y + b.h)) < r;
}
/** Segment/circle collision keeps fast projectiles from tunnelling between simulation ticks. */
export function segmentCircle(a: Vec, b: Vec, c: Vec, r: number): boolean {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : clamp(((c.x - a.x) * dx + (c.y - a.y) * dy) / l, 0, 1);
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y) <= r;
}
export function segmentRect(a: Vec, b: Vec, r: Rect, padding = 0): boolean {
  let lo = 0,
    hi = 1;
  for (const [origin, delta, min, max] of [
    [a.x, b.x - a.x, r.x - padding, r.x + r.w + padding],
    [a.y, b.y - a.y, r.y - padding, r.y + r.h + padding],
  ]) {
    if (Math.abs(delta) < 0.00001) {
      if (origin < min || origin > max) return false;
    } else {
      const v1 = (min - origin) / delta,
        v2 = (max - origin) / delta;
      lo = Math.max(lo, Math.min(v1, v2));
      hi = Math.min(hi, Math.max(v1, v2));
      if (lo > hi) return false;
    }
  }
  return true;
}
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
