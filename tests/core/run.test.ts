import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Run } from '../../src/core/run';
import type { Item, Lane, QuestionLevel, RoadType, RunEvent } from '../../src/core/types';

const mk = (at: number, lane: Lane, type: RoadType, level?: QuestionLevel): Item => ({ id: at * 10 + lane + 2, at, lane, type, state: 'live', t: 0, level });
/** A ❓ row across all three lanes. */
const row = (at: number, level: QuestionLevel): Item[] => ([-1, 0, 1] as Lane[]).map((l) => mk(at, l, 'question', level));
const advance = (run: Run, seconds: number): RunEvent[] => {
  const ev: RunEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) ev.push(...run.update(1 / 60));
  return ev;
};
const kinds = (ev: RunEvent[]) => ev.map((e) => e.kind);

describe('Run', () => {
  it('moves forward at roughly the base speed', () => {
    const run = new Run({ seed: 1, items: [] });
    advance(run, 1);
    expect(run.dist).toBeGreaterThan(14);
    expect(run.dist).toBeLessThan(14.4);
  });

  it('clamps lane changes to the three lanes', () => {
    const run = new Run({ seed: 1, items: [] });
    run.move(1); run.move(1);
    expect(run.lane).toBe(1);
    run.move(-1); run.move(-1); run.move(-1);
    expect(run.lane).toBe(-1);
  });

  it('slides smoothly to the new lane', () => {
    const run = new Run({ seed: 1, items: [] });
    run.move(1);
    advance(run, 0.3);
    expect(run.x).toBeGreaterThan(0.9);
  });

  it('collects a reward in its lane and puts it on the stack', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'piano')] });
    const ev = advance(run, 1);
    expect(run.score).toBe(15);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'collect', points: 15 }));
    expect(run.tray).toEqual(['piano']);
    expect(run.items[0].state).toBe('taken');
  });

  it('holds at most two rewards above the baton, keeping the latest', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'piano'), mk(10, 0, 'violin'), mk(15, 0, 'notes')] });
    advance(run, 1.5);
    expect(run.tray).toEqual(['violin', 'notes']);
    expect(run.score).toBe(30);
  });

  it('ignores items in other lanes', () => {
    const run = new Run({ seed: 1, items: [mk(5, 1, 'piano')] });
    advance(run, 1);
    expect(run.score).toBe(0);
    expect(run.items[0].state).toBe('live');
  });

  it('costs points on an obstacle, never below zero, and knocks a reward off the stack', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'piano'), mk(15, 0, 'bomb')] });
    advance(run, 1.1);
    expect(run.score).toBe(0);
    expect(run.tray).toEqual([]);
    expect(run.stumble).toBeGreaterThan(0);
    const run2 = new Run({ seed: 1, items: [mk(5, 0, 'krampus')] });
    advance(run2, 1);
    expect(run2.score).toBe(0);
  });

  it('asks a question at a ❓ row whatever the lane, pauses, and clears the rest of the row', () => {
    for (const lane of [-1, 0, 1] as const) {
      const run = new Run({ seed: 1, items: row(10, 1) });
      if (lane) run.move(lane);
      const ev = advance(run, 1);
      expect(ev.filter((e) => e.kind === 'question')).toHaveLength(1);
      expect(run.paused).toBe(true);
      expect(run.pending?.level).toBe(1);
      expect(run.items.every((i) => i.state === 'taken')).toBe(true);
      expect(run.tray).toEqual([]);
      const d = run.dist;
      advance(run, 1);
      expect(run.dist).toBe(d);
    }
  });

  it("gives the question's level points for a right answer", () => {
    const easy = new Run({ seed: 1, items: row(10, 1) });
    advance(easy, 1);
    expect(easy.answer(true)).toEqual([expect.objectContaining({ kind: 'answer', correct: true, points: 15 })]);
    expect(easy.score).toBe(15);
    expect(easy.paused).toBe(false);
    const medium = new Run({ seed: 1, items: row(10, 2) });
    advance(medium, 1);
    medium.answer(true);
    expect(medium.score).toBe(20);
  });

  it('gives nothing for a wrong answer', () => {
    const run = new Run({ seed: 1, items: row(10, 2) });
    advance(run, 1);
    run.answer(false);
    expect(run.score).toBe(0);
    expect(run.answer(true)).toEqual([]);
  });

  it('asks both rows, one question each', () => {
    const run = new Run({ seed: 1, items: [...row(10, 1), ...row(25, 2)] });
    const levels: number[] = [];
    for (let i = 0; i < 60 * 4; i++) {
      for (const e of run.update(1 / 60)) if (e.kind === 'question') { levels.push(e.item.level ?? 0); run.answer(true); }
    }
    expect(levels).toEqual([1, 2]);
    expect(run.score).toBe(35);
  });

  it('finishes exactly once and then coasts to a stop', () => {
    const run = new Run({ seed: 1, config: { ...CONFIG, runLength: 30 }, items: [] });
    const ev = advance(run, 5);
    expect(kinds(ev).filter((k) => k === 'finish')).toHaveLength(1);
    expect(run.finished).toBe(true);
    expect(run.speed).toBeLessThan(CONFIG.baseSpeed);
    const d = run.dist;
    expect(advance(run, 1)).toEqual([]);
    expect(run.dist).toBeGreaterThanOrEqual(d);
  });

  it('builds the same run from the same seed', () => {
    const a = new Run({ seed: 5 }), b = new Run({ seed: 5 });
    expect(a.items.map((i) => [i.at, i.lane, i.type])).toEqual(b.items.map((i) => [i.at, i.lane, i.type]));
  });
  it('builds its route from the run length', () => {
    const run = new Run({ seed: 1, config: { ...CONFIG, runLength: 900 }, items: [] });
    expect(run.route.landmarks.at(-1)?.at).toBe(900);
  });
});
