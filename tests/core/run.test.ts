import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Run } from '../../src/core/run';
import type { Item, ItemType, Lane, RunEvent } from '../../src/core/types';

const mk = (at: number, lane: Lane, type: ItemType): Item => ({ id: at * 10 + lane + 2, at, lane, type, state: 'live', t: 0, question: false });
const advance = (run: Run, seconds: number): RunEvent[] => {
  const ev: RunEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) ev.push(...run.update(1 / 60));
  return ev;
};
const kinds = (ev: RunEvent[]) => ev.map((e) => e.kind);

describe('Run', () => {
  it('moves forward at roughly the base speed', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    advance(run, 1);
    expect(run.dist).toBeGreaterThan(14);
    expect(run.dist).toBeLessThan(14.4);
  });

  it('clamps lane changes to the three lanes', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    run.move(1); run.move(1);
    expect(run.lane).toBe(1);
    run.move(-1); run.move(-1); run.move(-1);
    expect(run.lane).toBe(-1);
  });

  it('slides smoothly to the new lane', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    run.move(1);
    advance(run, 0.3);
    expect(run.x).toBeGreaterThan(0.9);
  });

  it('collects a treat in its lane and puts it on the tray', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'sacher')], slots: [] });
    const ev = advance(run, 1);
    expect(run.score).toBe(15);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'collect', points: 15 }));
    expect(run.tray).toEqual(['sacher']);
    expect(run.items[0].state).toBe('taken');
  });

  it('ignores items in other lanes', () => {
    const run = new Run({ seed: 1, items: [mk(5, 1, 'sacher')], slots: [] });
    advance(run, 1);
    expect(run.score).toBe(0);
    expect(run.items[0].state).toBe('live');
  });

  it('costs points on an obstacle, never below zero, and knocks a treat off the tray', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'sacher'), mk(15, 0, 'bomb')], slots: [] });
    advance(run, 1.1);
    expect(run.score).toBe(0);
    expect(run.tray).toEqual([]);
    expect(run.stumble).toBeGreaterThan(0);
    const run2 = new Run({ seed: 1, items: [mk(5, 0, 'krampus')], slots: [] });
    advance(run2, 1);
    expect(run2.score).toBe(0);
  });

  it('turns the first treat after a slot into a question and pauses', () => {
    const run = new Run({ seed: 1, items: [mk(10, 0, 'kipferl')], slots: [0.1] });
    const ev = advance(run, 1);
    expect(kinds(ev)).toContain('question');
    expect(run.paused).toBe(true);
    expect(run.score).toBe(0);
    const d = run.dist;
    advance(run, 1);
    expect(run.dist).toBe(d);
    expect(run.answer(true)).toEqual([expect.objectContaining({ kind: 'answer', correct: true, points: 20 })]);
    expect(run.score).toBe(20);
    expect(run.paused).toBe(false);
  });

  it('gives nothing for a wrong answer', () => {
    const run = new Run({ seed: 1, items: [mk(10, 0, 'kipferl')], slots: [0.1] });
    advance(run, 1);
    run.answer(false);
    expect(run.score).toBe(0);
    expect(run.answer(true)).toEqual([]);
  });

  it('finishes exactly once and then coasts to a stop', () => {
    const run = new Run({ seed: 1, config: { ...CONFIG, runLength: 30 }, items: [], slots: [] });
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
    expect(a.slots).toEqual(b.slots);
  });
});
