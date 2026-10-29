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
    const name = s.root.querySelector<HTMLElement>('.r-name')!;
    const save = s.root.querySelector<HTMLButtonElement>('.r-save')!;
    return { s, names, name, save };
  }

  it('offers name saving only for a round that can be saved', () => {
    expect(nameSetup(null).s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(true);
    expect(nameSetup('r1').s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(false);
  });

  it('has no text field: every player gets a ready-made preset name', () => {
    const { s, name } = nameSetup();
    expect(s.root.querySelector('input')).toBeNull();
    expect(name.textContent).toMatch(/^[A-Za-z]+\d{3}$/);
  });

  it('picks a fresh name for each player', () => {
    const rand = vi.spyOn(Math, 'random');
    rand.mockReturnValue(0);
    const { s, name } = nameSetup();
    const first = name.textContent;
    rand.mockReturnValue(0.5);
    s.show({ score: 10, gift: null, entryId: 'r2' }, () => undefined);
    expect(name.textContent).not.toBe(first);
    rand.mockRestore();
  });

  it("saves the shown name once, shows today's place, then locks", () => {
    const { s, names, name, save } = nameSetup();
    save.click();
    expect(names.save).toHaveBeenCalledExactlyOnceWith('r1', name.textContent);
    expect(s.root.textContent).toContain("You're #3 today!");
    expect(save.hidden).toBe(true);
    save.click();
    expect(names.save).toHaveBeenCalledTimes(1);
    s.root.querySelector<HTMLButtonElement>('.r-view')!.click();
    expect(names.open).toHaveBeenCalledWith('r1');
  });

  it('says "Saved!" outside the top 10', () => {
    const { s, save } = nameSetup('r2', null);
    save.click();
    expect(s.root.querySelector('.r-name-msg')?.textContent).toBe('Saved!');
  });
});
