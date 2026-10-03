// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../../src/core/types';
import { QuestionScreen } from '../../src/ui/question';

const q: Question = { id: 'x', q: 'Which river flows through Vienna?', options: ['Danube', 'Rhine', 'Seine'], answer: 0 };
const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('QuestionScreen', () => {
  it('shows the question, the doubling, and three answers', () => {
    const s = new QuestionScreen(document.body);
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('10 → 20');
    expect([...s.root.querySelectorAll('.q-option')].map((b) => b.textContent)).toEqual(['Danube', 'Rhine', 'Seine']);
  });
  it('takes only the first pick, even when a tap fires both pointerdown and click', () => {
    const s = new QuestionScreen(document.body);
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    const b = s.root.querySelectorAll('.q-option')[1];
    press(b, 'pointerdown');
    press(b, 'click');
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('marks the right and the wrong answer and locks the buttons', () => {
    const s = new QuestionScreen(document.body);
    s.show(q, 10, () => undefined);
    s.reveal(0, 1);
    const buttons = [...s.root.querySelectorAll<HTMLButtonElement>('.q-option')];
    expect(buttons[0].classList.contains('right')).toBe(true);
    expect(buttons[1].classList.contains('wrong')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
