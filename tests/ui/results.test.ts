// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { I18n } from '../../src/i18n/i18n';
import { ResultsScreen } from '../../src/ui/results';

const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('ResultsScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the score and nothing about gifts while gifts are switched off', () => {
    const s = new ResultsScreen(document.body, new I18n('en'), 1000);
    s.show({ score: 105, gift: null }, () => undefined);
    expect(s.root.querySelector('.r-score')?.textContent).toBe('105');
    expect((s.root.textContent ?? '').toLowerCase()).not.toMatch(/prize|gift/);
    expect(s.root.querySelector('.ladder, .r-tier, .r-gift')).toBeNull();
  });

  it('shows the prize and the ladder, with the reached tier marked, when gifts are on', () => {
    const s = new ResultsScreen(document.body, new I18n('en'), 1000);
    s.show({ score: 105, gift: { tiers: CONFIG.tiers, index: 2, url: 'gift-2.png' } }, () => undefined);
    expect(s.root.querySelector('.r-tier')?.textContent).toBe(CONFIG.tiers[2].name);
    expect(s.root.querySelector('img.r-gift')?.getAttribute('src')).toBe('gift-2.png');
    expect(s.root.querySelector('.ladder li.on')?.textContent).toContain(CONFIG.tiers[2].name);
    s.show({ score: 10, gift: null }, () => undefined);
    expect(s.root.querySelector('.ladder')).toBeNull();
  });

  it('needs a full one-second hold; a tap or a short press does nothing', () => {
    const s = new ResultsScreen(document.body, new I18n('en'), 1000);
    const done = vi.fn();
    s.show({ score: 50, gift: null }, done);
    const hold = s.root.querySelector('.r-hold')!;
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(500);
    press(hold, 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('thanks the player in Vietnamese by default', () => {
    const s = new ResultsScreen(document.body, new I18n(), 1000);
    s.show({ score: 7, gift: null }, () => undefined);
    expect(s.root.textContent).toContain('Cảm ơn bạn đã chơi!');
    expect(s.root.textContent).toContain('Điểm của bạn');
  });
  function nameSetup(entryId: string | null = 'r1', saveResult: number | null | false = 3) {
    const names = { save: vi.fn<(id: string, name: string) => number | null | false>(() => saveResult), open: vi.fn<(id: string) => void>() };
    const s = new ResultsScreen(document.body, new I18n('en'), 1000, names);
    s.show({ score: 90, gift: null, entryId }, () => undefined);
    const input = s.root.querySelector<HTMLInputElement>('.r-name')!;
    const save = s.root.querySelector<HTMLButtonElement>('.r-save')!;
    return { s, names, input, save };
  }
  const typeInto = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('offers name entry only for a round that can be saved', () => {
    expect(nameSetup(null).s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(true);
    expect(nameSetup('r1').s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(false);
  });

  it('keeps only code-name characters as the player types', () => {
    const { input, save } = nameSetup();
    expect(save.disabled).toBe(true);
    typeInto(input, 'Đức Anh!!');
    expect(input.value).toBe('Duc Anh');
    expect(save.disabled).toBe(false);
    expect(input.maxLength).toBe(12);
    expect(input.placeholder).toBe('Your name');
  });

  it("saves once, shows today's place, then locks", () => {
    const { s, names, input, save } = nameSetup();
    typeInto(input, 'Anna');
    save.click();
    expect(names.save).toHaveBeenCalledExactlyOnceWith('r1', 'Anna');
    expect(s.root.textContent).toContain("You're #3 today!");
    expect(input.disabled).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    save.click();
    expect(names.save).toHaveBeenCalledTimes(1);
    s.root.querySelector<HTMLButtonElement>('.r-view')!.click();
    expect(names.open).toHaveBeenCalledWith('r1');
  });

  it('saves with the Enter key, and says "Saved!" outside the top 10', () => {
    const { s, names, input } = nameSetup('r2', null);
    typeInto(input, 'Bo');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(names.save).toHaveBeenCalledTimes(1);
    expect(s.root.querySelector('.r-name-msg')?.textContent).toBe('Saved!');
  });

  it('keeps the screen open while someone types, and lets go 20 seconds after the last key', () => {
    const { s, input } = nameSetup();
    expect(s.busy()).toBe(false);
    input.dispatchEvent(new FocusEvent('focus'));
    expect(s.busy()).toBe(true);
    typeInto(input, 'An');
    vi.advanceTimersByTime(19_000);
    expect(s.busy()).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(s.busy()).toBe(false);
    typeInto(input, 'Ann');
    expect(s.busy()).toBe(true);
  });

  it('is not busy once the name is saved, or when name entry is off', () => {
    const { s, input, save } = nameSetup();
    input.dispatchEvent(new FocusEvent('focus'));
    typeInto(input, 'Anna');
    save.click();
    expect(s.busy()).toBe(false);
    expect(nameSetup(null).s.busy()).toBe(false);
  });

  it('lets go of the keyboard when the screen closes, so the touch keyboard goes away', () => {
    const { s, input } = nameSetup();
    input.focus();
    expect(document.activeElement).toBe(input);
    s.hide();
    expect(document.activeElement).not.toBe(input);
  });
});
