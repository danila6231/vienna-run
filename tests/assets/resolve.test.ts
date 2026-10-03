import { describe, expect, it } from 'vitest';
import { baseName, edgeRadius, groupIds } from '../../src/assets/resolve';

describe('art resolution', () => {
  it('turns a glob path into an asset id', () => {
    expect(baseName('./art/facade-01.png')).toBe('facade-01');
    expect(baseName('/src/assets/art/logo.svg')).toBe('logo');
    expect(baseName('./art/item-sacher.WEBP')).toBe('item-sacher');
  });
  it('prefers designer files for a whole group', () => {
    expect(groupIds('facade-', ['facade-02', 'facade-01', 'item-bomb'], ['facade-01', 'facade-03']))
      .toEqual({ ids: ['facade-01', 'facade-02'], fromDesigner: true });
  });
  it('falls back to placeholders when the designer has none in a group', () => {
    expect(groupIds('waiter-run-', ['facade-01'], ['waiter-run-01', 'waiter-run-02']))
      .toEqual({ ids: ['waiter-run-01', 'waiter-run-02'], fromDesigner: false });
  });
  it('accepts a single-frame group and an empty optional group', () => {
    expect(groupIds('waiter-run-', ['waiter-run-01'], ['waiter-run-01', 'waiter-run-02']).ids).toEqual(['waiter-run-01']);
    expect(groupIds('waiter-stumble-', [], ['waiter-run-01']).ids).toEqual([]);
  });
  it('scales the paper edge with image size but keeps it visible', () => {
    expect(edgeRadius(0.045, 512, 512)).toBe(23);
    expect(edgeRadius(0.001, 100, 50)).toBe(2);
  });
});
