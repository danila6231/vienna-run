// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { AttractScreen } from '../../src/ui/attract';

const icons = { sacher: 'a.png', kipferl: 'b.png', melange: 'c.png', mozart: 'd.png', krampus: 'e.png', bomb: 'f.png' };
const noGifts = { showGifts: false, leaderboard: false };

describe('AttractScreen', () => {
  it('lists every item with its points', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    const text = s.root.textContent ?? '';
    expect(text).toContain('Tap anywhere to play');
    expect(text).toContain('Sachertorte');
    expect(text).toContain('+15');
    expect(text).toContain('−10');
    expect(s.root.querySelectorAll('.legend img')).toHaveLength(6);
  });
  it('shows the points from the current settings', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    s.configure({ ...CONFIG, items: { ...CONFIG.items, sacher: { points: 25, good: true } } }, noGifts);
    expect(s.root.textContent).toContain('+25');
    expect(s.root.querySelectorAll('.legend li')).toHaveLength(6);
  });
  it('does not mention gifts while they are switched off', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    const text = (s.root.textContent ?? '').toLowerCase();
    for (const t of CONFIG.tiers) expect(text).not.toContain(t.name.toLowerCase());
    expect(text).not.toMatch(/prize|gift/);
  });
  it('shows the gift ladder when gifts are switched on', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, { showGifts: true, leaderboard: false });
    const ladder = s.root.querySelector('.ladder');
    expect(ladder?.hasAttribute('hidden')).toBe(false);
    expect(ladder?.textContent).toContain('80+');
    expect(ladder?.textContent).toContain(CONFIG.tiers[1].name);
  });
  it('uses the logo image when one is provided', () => {
    const s = new AttractScreen(document.body, icons, 'logo.svg');
    expect(s.root.querySelector('img.logo')?.getAttribute('src')).toBe('logo.svg');
  });
});
