// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../../src/core/types';
import { I18n } from '../../src/i18n/i18n';
import { QuestionScreen } from '../../src/ui/question';

const q: Question = {
  id: 'x',
  answer: 0,
  en: { q: 'Which river flows through Vienna?', options: ['Danube', 'Rhine', 'Seine'] },
  vi: { q: 'Con sông nào chảy qua Vienna?', options: ['Sông Danube', 'Sông Rhine', 'Sông Seine'] },
};
const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
const options = (s: QuestionScreen) => [...s.root.querySelectorAll('.q-option')].map((b) => b.textContent);

describe('QuestionScreen', () => {
  afterEach(() => vi.useRealTimers());

  it('ignores a tap that lands in the first moment after the question appears', () => {
    vi.useFakeTimers();
    const s = new QuestionScreen(document.body, new I18n('en'));
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    press(s.root.querySelectorAll('.q-option')[2], 'pointerdown');
    expect(onPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(450);
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('shows the question, the doubling, and three answers in the current language', () => {
    const i18n = new I18n('en');
    const s = new QuestionScreen(document.body, i18n);
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('10 → 20');
    expect(options(s)).toEqual(['Danube', 'Rhine', 'Seine']);
    i18n.set('vi');
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('Câu hỏi thưởng!');
    expect(s.root.textContent).toContain('Con sông nào chảy qua Vienna?');
    expect(options(s)).toEqual(['Sông Danube', 'Sông Rhine', 'Sông Seine']);
  });

  it('takes only the first pick, even when a tap fires both pointerdown and click', () => {
    const s = new QuestionScreen(document.body, new I18n('en'));
    vi.useFakeTimers();
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    vi.advanceTimersByTime(450);
    const b = s.root.querySelectorAll('.q-option')[1];
    press(b, 'pointerdown');
    press(b, 'click');
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('marks the right and the wrong answer and locks the buttons', () => {
    const s = new QuestionScreen(document.body, new I18n('vi'));
    s.show(q, 10, () => undefined);
    s.reveal(0, 1);
    const buttons = [...s.root.querySelectorAll<HTMLButtonElement>('.q-option')];
    expect(buttons[0].classList.contains('right')).toBe(true);
    expect(buttons[1].classList.contains('wrong')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(s.root.textContent).toContain('Chưa đúng.');
  });
});
