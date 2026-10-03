import { describe, expect, it } from 'vitest';
import { BOARD_RE } from '../../src/core/settings';
import { cleanNameInput, finalName, nextBoardName } from '../../src/scores/names';

describe('cleanNameInput', () => {
  it.each([
    ['Anna', 'Anna'],
    ['Đức Anh', 'Duc Anh'],
    ['Nguyễn Thị Hương', 'Nguyen Thi H'],
    ['a!@#b', 'ab'],
    ['  lead', 'lead'],
    ['x  y', 'x y'],
    ['team_7-B', 'team_7-B'],
    ['😀Ok', 'Ok'],
    ['<b>x</b>', 'bxb'],
  ])('%s → %s', (raw, out) => {
    expect(cleanNameInput(raw)).toBe(out);
  });
});

describe('finalName', () => {
  it('trims and accepts 1–12 allowed characters', () => {
    expect(finalName(' Bo ')).toBe('Bo');
    expect(finalName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });
  it('returns null when nothing usable is left', () => {
    expect(finalName('   ')).toBeNull();
    expect(finalName('!!!')).toBeNull();
    expect(finalName('')).toBeNull();
  });
});

describe('nextBoardName', () => {
  it.each([
    ['booth', 'booth-2'],
    ['booth-2', 'booth-3'],
    ['test-9', 'test-10'],
    ['a-b', 'a-b-2'],
  ])('%s → %s', (board, next) => {
    expect(nextBoardName(board)).toBe(next);
  });
  it('always gives a valid board name', () => {
    const long = 'x'.repeat(24);
    expect(nextBoardName(long)).toMatch(BOARD_RE);
    expect(nextBoardName(long)).toHaveLength(24);
  });
});
