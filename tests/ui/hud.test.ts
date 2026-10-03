// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/hud';

describe('Hud', () => {
  it('shows the score and route progress', () => {
    const hud = new Hud(document.body, 'Stephansplatz → Riesenrad');
    hud.show(true);
    hud.update(25, 0.5);
    expect(hud.root.hidden).toBe(false);
    expect(hud.root.textContent).toContain('25');
    expect(hud.root.querySelector<HTMLElement>('.bar i')?.style.width).toBe('50%');
  });
});
