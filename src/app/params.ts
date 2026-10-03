import type { QualityLevel } from '../render/world';

export interface Params {
  seed?: number;
  /** The bot plays whole rounds by itself (soak tests, unattended demos). `?bot=1` works too. */
  autoplay: boolean;
  /** Simulation speed multiplier, 0.25 to 16. */
  speed: number;
  quality?: QualityLevel;
  /** Opens the booth self-check screen. */
  check: boolean;
  /** Shows the mouse cursor. */
  cursor: boolean;
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const num = (k: string): number | undefined => {
    const v = q.get(k);
    if (v === null || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const flag = (k: string): boolean => {
    const v = q.get(k);
    return v !== null && v !== '0' && v !== 'false';
  };
  const quality = q.get('quality');
  return {
    seed: num('seed'),
    autoplay: flag('autoplay') || flag('bot'),
    speed: Math.min(16, Math.max(0.25, num('speed') ?? 1)),
    quality: quality === 'high' || quality === 'med' || quality === 'low' ? quality : undefined,
    check: flag('check'),
    cursor: flag('cursor'),
  };
}
