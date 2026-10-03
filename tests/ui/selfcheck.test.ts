// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTouchTest } from '../../src/ui/selfcheck';

describe('createTouchTest', () => {
  it('turns each of the nine zones green and reports when all were touched', () => {
    const done = vi.fn();
    const grid = createTouchTest(document.body, done);
    const cells = [...grid.querySelectorAll('.sc-cell')];
    expect(cells).toHaveLength(9);
    cells.slice(0, 8).forEach((c) => c.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(done).not.toHaveBeenCalled();
    cells[8].dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(cells.every((c) => c.classList.contains('hit'))).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
