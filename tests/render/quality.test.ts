import { describe, expect, it } from 'vitest';
import { pixelRatioFor, QualityMonitor } from '../../src/render/quality';

const feed = (m: QualityMonitor, fps: number, seconds: number) => {
  const changes: string[] = [];
  for (let i = 0; i < fps * seconds; i++) {
    const c = m.sample(1 / fps);
    if (c) changes.push(c);
  }
  return changes;
};

describe('QualityMonitor', () => {
  it('keeps high quality on a smooth machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 60, 20)).toEqual([]);
    expect(m.level).toBe('high');
  });
  it('steps down one level at a time on a so-so machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 40, 20)).toEqual(['med', 'low']);
  });
  it('drops straight to low on a weak machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 20, 20)).toEqual(['low']);
  });
  it('ignores the warm-up seconds', () => {
    const m = new QualityMonitor();
    expect(feed(m, 20, 2.5)).toEqual([]);
  });
});

describe('pixelRatioFor', () => {
  it('renders fewer pixels at each lower level, even on a 100%-scaling screen', () => {
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('med', 1)).toBeCloseTo(0.8);
    expect(pixelRatioFor('low', 1)).toBeCloseTo(0.6);
  });
  it('caps sharp screens at 2x and keeps low cheap there too', () => {
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('low', 2)).toBeCloseTo(0.75);
  });
});
