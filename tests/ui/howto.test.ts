// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { HowtoScreen } from '../../src/ui/howto';

const visibleSteps = (s: HowtoScreen) => [...s.root.querySelectorAll('li')].filter((li) => !li.hidden);

describe('HowtoScreen', () => {
  it('explains bonus questions only when they are switched on', () => {
    const s = new HowtoScreen(document.body);
    s.showHowto(true);
    expect(visibleSteps(s)).toHaveLength(3);
    s.showHowto(false);
    expect(visibleSteps(s)).toHaveLength(2);
    expect(visibleSteps(s).map((li) => li.textContent).join(' ')).not.toMatch(/question/i);
  });
});
