import { describe, expect, it } from 'vitest';
import { parseParams } from '../../src/app/params';

describe('parseParams', () => {
  it('defaults to a normal booth session', () => {
    expect(parseParams('')).toEqual({ seed: undefined, autoplay: false, speed: 1, quality: undefined, check: false, cursor: false });
  });
  it('reads debug switches', () => {
    expect(parseParams('?seed=7&autoplay=1&speed=8&quality=low&check=1&cursor=1')).toEqual({ seed: 7, autoplay: true, speed: 8, quality: 'low', check: true, cursor: true });
  });
  it('treats bot=1 as autoplay and clamps the speed', () => {
    expect(parseParams('?bot=1&speed=100')).toMatchObject({ autoplay: true, speed: 16 });
  });
  it('ignores junk values', () => {
    expect(parseParams('?seed=abc&quality=ultra&speed=&autoplay=0')).toEqual({ seed: undefined, autoplay: false, speed: 1, quality: undefined, check: false, cursor: false });
  });
});
