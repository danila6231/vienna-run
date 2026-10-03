// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { Hud } from '../../src/ui/hud';

describe('Hud', () => {
  it('shows the score and route progress', () => {
    const hud = new Hud(document.body, new I18n('en'));
    hud.show(true);
    hud.update(25, 0.5);
    expect(hud.root.hidden).toBe(false);
    expect(hud.root.textContent).toContain('25');
    expect(hud.root.textContent).toContain('Points');
    expect(hud.root.querySelector<HTMLElement>('.bar i')?.style.width).toBe('50%');
  });
  it('re-labels when the language changes', () => {
    const i18n = new I18n('en');
    const hud = new Hud(document.body, i18n);
    i18n.set('vi');
    expect(hud.root.textContent).toContain('Điểm');
  });
});
