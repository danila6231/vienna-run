import { describe, expect, it, vi } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { STRINGS, translate } from '../../src/i18n/strings';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translation table', () => {
  it('has every text in both languages, none empty, with the same placeholders', () => {
    const keys = Object.keys(STRINGS.en).sort();
    expect(Object.keys(STRINGS.vi).sort()).toEqual(keys);
    for (const k of keys as (keyof typeof STRINGS.en)[]) {
      expect(STRINGS.en[k].trim(), `en ${k}`).not.toBe('');
      expect(STRINGS.vi[k].trim(), `vi ${k}`).not.toBe('');
      expect(placeholders(STRINGS.vi[k]), `placeholders ${k}`).toEqual(placeholders(STRINGS.en[k]));
    }
  });
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('vi', 'finish.points', { score: 120 })).toBe('120 điểm');
    expect(translate('en', 'finish.points')).toBe('{score} points');
  });
  it('gives the Vietnamese hint next to each treat name', () => {
    expect(translate('vi', 'item.sacher')).toBe('Sachertorte · bánh sô-cô-la');
    expect(translate('en', 'item.sacher')).toBe('Sachertorte');
  });
});

describe('I18n', () => {
  it('starts in Vietnamese and tells listeners only about real changes', () => {
    const i18n = new I18n();
    const cb = vi.fn();
    i18n.onChange(cb);
    expect(i18n.lang).toBe('vi');
    expect(i18n.t('attract.cta')).toBe('Chạm vào màn hình để chơi');
    i18n.set('vi');
    expect(cb).not.toHaveBeenCalled();
    i18n.set('en');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(i18n.t('attract.cta')).toBe('Tap anywhere to play');
  });
  it('stops calling a listener after it unsubscribes', () => {
    const i18n = new I18n('en');
    const cb = vi.fn();
    const off = i18n.onChange(cb);
    off();
    i18n.set('vi');
    expect(cb).not.toHaveBeenCalled();
  });
});
