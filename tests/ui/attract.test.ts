// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { AttractScreen } from '../../src/ui/attract';

const icons = { sacher: 'a.png', kipferl: 'b.png', melange: 'c.png', mozart: 'd.png', krampus: 'e.png', bomb: 'f.png' };

describe('AttractScreen', () => {
  it('lists every item with its points and every gift tier', () => {
    const s = new AttractScreen(document.body, CONFIG, icons, null);
    const text = s.root.textContent ?? '';
    expect(text).toContain('Tap anywhere to play');
    expect(text).toContain('Sachertorte');
    expect(text).toContain('+15');
    expect(text).toContain('−10');
    for (const t of CONFIG.tiers) expect(text).toContain(t.name);
    expect(s.root.querySelectorAll('.legend img')).toHaveLength(6);
  });
  it('uses the logo image when one is provided', () => {
    const s = new AttractScreen(document.body, CONFIG, icons, 'logo.svg');
    expect(s.root.querySelector('img.logo')?.getAttribute('src')).toBe('logo.svg');
  });
});
