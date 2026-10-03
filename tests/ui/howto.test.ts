// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { HowtoScreen } from '../../src/ui/howto';

const visibleSteps = (s: HowtoScreen) => [...s.root.querySelectorAll('li')].filter((li) => !li.hidden);

describe('HowtoScreen', () => {
  it('explains bonus questions only when they are switched on', () => {
    const s = new HowtoScreen(document.body, new I18n('en'));
    s.showHowto(true);
    expect(visibleSteps(s)).toHaveLength(3);
    s.showHowto(false);
    expect(visibleSteps(s)).toHaveLength(2);
    expect(visibleSteps(s).map((li) => li.textContent).join(' ')).not.toMatch(/question/i);
  });
  it('speaks Vietnamese, including the "go" of the countdown', () => {
    const s = new HowtoScreen(document.body, new I18n('vi'));
    s.showHowto(true);
    expect(s.root.textContent).toContain('Cách chơi');
    s.showCount(0);
    expect(s.root.querySelector('.countdown')?.textContent).toBe('Chạy!');
  });
});
