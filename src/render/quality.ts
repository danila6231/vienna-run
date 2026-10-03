import type { QualityLevel } from './world';

/**
 * Watches real frame times after a warm-up and lowers the graphics level until the booth PC
 * holds about 50 fps. It never raises the level again, so the picture doesn't flicker between modes.
 */
export class QualityMonitor {
  level: QualityLevel;
  private elapsed = 0;
  private frames: number[] = [];
  private settled = false;

  constructor(start: QualityLevel = 'high', private readonly warmup = 3, private readonly window = 3) {
    this.level = start;
  }

  /** Feed one real frame duration; returns the new level when it changes. */
  sample(frameSeconds: number): QualityLevel | null {
    if (this.settled) return null;
    this.elapsed += frameSeconds;
    if (this.elapsed < this.warmup) return null;
    this.frames.push(frameSeconds);
    const total = this.frames.reduce((a, b) => a + b, 0);
    if (total < this.window) return null;
    const fps = this.frames.length / total;
    this.frames = [];
    if (fps >= 50) {
      this.settled = true;
      return null;
    }
    const next: QualityLevel = fps < 30 ? 'low' : this.level === 'high' ? 'med' : 'low';
    if (next === this.level) {
      this.settled = true;
      return null;
    }
    this.level = next;
    if (next === 'low') this.settled = true;
    return next;
  }
}

/**
 * Render resolution for a quality level. Lower levels render fewer pixels even on a plain
 * 100%-scaling screen (devicePixelRatio 1), which is what the booth PC will usually be.
 */
export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  const base = Math.min(devicePixelRatio || 1, 2);
  if (level === 'high') return base;
  if (level === 'med') return base * 0.8;
  return Math.min(base * 0.6, 0.75);
}
