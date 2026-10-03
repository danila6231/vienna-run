import { describe, expect, it } from 'vitest';
import { initialPositions, recycle } from '../../src/render/rows';

describe('pooled rows', () => {
  it('starts the first slot just behind the camera', () => {
    expect(initialPositions({ count: 3, spacing: 8, offset: 4 })).toEqual([-12, -4, 4]);
  });
  it('moves a slot that fell behind the camera to the front of the row', () => {
    expect(recycle(0, 20, 216)).toBe(216);
    expect(recycle(0, 500, 216)).toBe(648);
  });
  it('leaves slots in front of the camera alone', () => {
    expect(recycle(30, 20, 216)).toBe(30);
  });
});
