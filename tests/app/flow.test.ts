import { describe, expect, it, vi } from 'vitest';
import { Flow, type Screen } from '../../src/app/flow';
import { CONFIG } from '../../src/config';

function setup() {
  const entered: Screen[] = [];
  const answered = vi.fn();
  const flow = new Flow(CONFIG, { enter: (s) => entered.push(s), answered });
  flow.start();
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60) + 2; i++) flow.update(1 / 60);
  };
  return { flow, entered, answered, tick };
}

describe('Flow', () => {
  it('starts on the attract screen and only a press there starts a game', () => {
    const { flow, entered } = setup();
    expect(flow.screen).toBe('attract');
    flow.press();
    flow.press();
    expect(entered).toEqual(['attract', 'howto']);
  });

  it('runs how-to and countdown on its own clock', () => {
    const { flow, tick } = setup();
    flow.press();
    tick(CONFIG.flow.howtoSeconds);
    expect(flow.screen).toBe('countdown');
    tick(CONFIG.flow.countdownSeconds);
    expect(flow.screen).toBe('run');
  });

  it('times out an unanswered question as wrong and resumes the run', () => {
    const { flow, answered, tick } = setup();
    flow.press();
    tick(6.1);
    flow.questionAsked();
    expect(flow.screen).toBe('question');
    tick(CONFIG.questions.timeLimit);
    expect(answered).toHaveBeenCalledExactlyOnceWith(false);
    expect(flow.screen).toBe('feedback');
    tick(CONFIG.questions.feedbackSeconds);
    expect(flow.screen).toBe('run');
  });

  it('accepts only the first answer to a question', () => {
    const { flow, answered, tick } = setup();
    flow.press();
    tick(6.1);
    flow.questionAsked();
    flow.answer(true);
    flow.answer(false);
    expect(answered).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('returns to attract by itself when the player walks away from the results', () => {
    const { flow, tick } = setup();
    flow.press();
    tick(6.1);
    flow.runFinished();
    tick(CONFIG.flow.finishSeconds);
    expect(flow.screen).toBe('results');
    flow.press();
    expect(flow.screen).toBe('results');
    tick(CONFIG.flow.resultsFallbackSeconds);
    expect(flow.screen).toBe('attract');
  });

  it('ignores events that do not belong to the current screen', () => {
    const { flow, entered } = setup();
    flow.questionAsked();
    flow.answer(true);
    flow.runFinished();
    flow.nextPlayer();
    expect(entered).toEqual(['attract']);
  });

  it('reports the seconds left on a question', () => {
    const { flow, tick } = setup();
    expect(flow.questionRemaining).toBe(0);
    flow.press();
    tick(6.1);
    flow.questionAsked();
    tick(4);
    expect(flow.questionRemaining).toBeGreaterThan(5.5);
    expect(flow.questionRemaining).toBeLessThan(6.1);
  });
});
