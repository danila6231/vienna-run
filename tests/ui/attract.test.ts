// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { I18n } from '../../src/i18n/i18n';
import { AttractScreen } from '../../src/ui/attract';

const icons = { piano: 'a.png', violin: 'b.png', sheet: 'c.png', notes: 'd.png', question: 'q.png', krampus: 'e.png', bomb: 'f.png' };
const noGifts = { showGifts: false, leaderboard: false };

describe('AttractScreen', () => {
  it('lists every item with its points', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.configure(CONFIG, noGifts);
    const text = s.root.textContent ?? '';
    expect(text).toContain('Tap anywhere to play');
    expect(text).toContain('Piano');
    expect(text).toContain('Race the musician');
    expect(text).toContain('+15');
    expect(text).toContain('−20');
    expect(text).toContain('Question+15 / +20');
    expect(s.root.querySelectorAll('.legend img')).toHaveLength(7);
  });
  it('shows the points from the current settings', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.configure(CONFIG, noGifts);
    s.configure({ ...CONFIG, items: { ...CONFIG.items, piano: { points: 25, good: true } } }, noGifts);
    expect(s.root.textContent).toContain('+25');
    expect(s.root.querySelectorAll('.legend li')).toHaveLength(7);
    s.configure({ ...CONFIG, questions: { ...CONFIG.questions, enabled: false } }, noGifts);
    expect(s.root.querySelectorAll('.legend li')).toHaveLength(6);
  });
  it('does not mention gifts while they are switched off', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.configure(CONFIG, noGifts);
    const text = (s.root.textContent ?? '').toLowerCase();
    for (const t of CONFIG.tiers) expect(text).not.toContain(t.name.toLowerCase());
    expect(text).not.toMatch(/prize|gift/);
  });
  it('shows the gift ladder when gifts are switched on', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.configure(CONFIG, { showGifts: true, leaderboard: false });
    const ladder = s.root.querySelector('.ladder');
    expect(ladder?.hasAttribute('hidden')).toBe(false);
    expect(ladder?.textContent).toContain('80+');
    expect(ladder?.textContent).toContain(CONFIG.tiers[1].name);
  });
  it('uses the logo image when one is provided', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, 'logo.svg');
    expect(s.root.querySelector('img.logo')?.getAttribute('src')).toBe('logo.svg');
  });
  it('is in Vietnamese by default, with a hint next to Krampus', () => {
    const s = new AttractScreen(document.body, new I18n(), icons, null);
    s.configure(CONFIG, noGifts);
    expect(s.root.textContent).toContain('Chạm vào màn hình để chơi');
    const labels = [...s.root.querySelectorAll('.legend li span')].map((x) => x.textContent);
    expect(labels.slice(0, 4)).toEqual(['Đàn piano', 'Đàn vĩ cầm', 'Bản nhạc', 'Nốt nhạc']);
    expect(s.root.querySelector('.legend li.bad small')?.textContent).toBe('quỷ Krampus');
  });
  it('switches language with the VI | EN pill without starting a game', () => {
    const i18n = new I18n();
    const s = new AttractScreen(document.body, i18n, icons, null);
    s.configure(CONFIG, noGifts);
    const pill = s.root.querySelector<HTMLButtonElement>('.lang-pill')!;
    expect(pill.closest('[data-ui]')).not.toBeNull();
    pill.click();
    expect(i18n.lang).toBe('en');
    expect(s.root.textContent).toContain('Tap anywhere to play');
    expect(pill.querySelector('.on')?.textContent).toBe('EN');
    pill.click();
    expect(i18n.lang).toBe('vi');
  });
});
