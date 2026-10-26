// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { HowtoScreen } from '../../src/ui/howto';

const visibleSteps = (s: HowtoScreen) => [...s.root.querySelectorAll('li')].filter((li) => !li.hidden);

describe('HowtoScreen', () => {
  it('explains the ❓ rows and their points only when questions are switched on', () => {
    const s = new HowtoScreen(document.body, new I18n('en'));
    s.showHowto({ 1: 15, 2: 20 });
    expect(visibleSteps(s)).toHaveLength(3);
    expect(visibleSteps(s)[2].textContent).toMatch(/❓.*\+15 or \+20/);
    s.showHowto(null);
    expect(visibleSteps(s)).toHaveLength(2);
    expect(visibleSteps(s).map((li) => li.textContent).join(' ')).not.toMatch(/question/i);
  });
  it('speaks Vietnamese, including the "go" of the countdown', () => {
    const s = new HowtoScreen(document.body, new I18n('vi'));
    s.showHowto({ 1: 15, 2: 20 });
    expect(s.root.textContent).toContain('Cách chơi');
    expect(s.root.textContent).toContain('+15 hoặc +20 điểm');
    s.showCount(0);
    expect(s.root.querySelector('.countdown')?.textContent).toBe('Chạy!');
  });
});
