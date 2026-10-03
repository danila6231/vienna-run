import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Bot, BOT_SKILLS } from '../../src/core/bot';
import { createRng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import type { Item, ItemType, Lane } from '../../src/core/types';
import { simulateRun, summarize } from '../../src/core/simulate';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const mk = (at: number, lane: Lane, type: ItemType): Item => ({ id: at * 10 + lane + 2, at, lane, type, state: 'live', t: 0, question: false });
/** Advance the run alone (no bot) until the runner reaches `dist`. */
const runTo = (run: Run, dist: number) => { while (run.dist < dist) run.update(1 / 60); };

describe('Bot', () => {
  it('never steers into an obstacle that is right beside it, even for treats behind it', () => {
    const run = new Run({ seed: 1, items: [mk(10, 1, 'bomb'), mk(14, 1, 'sacher'), mk(18, 1, 'sacher'), mk(22, 1, 'sacher')], slots: [] });
    runTo(run, 9.5);
    new Bot(createRng(1), { ...BOT_SKILLS.skilled, mistakeRate: 0 }).step(run, 1 / 60);
    expect(run.lane).toBe(0);
  });
  it('does not cut through a lane with an obstacle right beside it on the way to a far lane', () => {
    const run = new Run({ seed: 1, items: [mk(10, 0, 'bomb'), mk(14, 1, 'sacher'), mk(18, 1, 'sacher'), mk(22, 1, 'sacher')], slots: [] });
    run.move(-1);
    runTo(run, 9.5);
    new Bot(createRng(1), { ...BOT_SKILLS.skilled, mistakeRate: 0 }).step(run, 1 / 60);
    expect(run.lane).toBe(-1);
  });

  it('scores higher when more skilled', () => {
    const skilled = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.skilled).score));
    const casual = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.casual).score));
    expect(skilled).toBeGreaterThan(casual);
  });
  it('hits fewer obstacles when more skilled', () => {
    const skilled = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.skilled).hits));
    const casual = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.casual).hits));
    expect(skilled).toBeLessThan(casual);
  });
  it('gives an average player the full set of questions in almost every run', () => {
    const full = Array.from({ length: 100 }, (_, i) => simulateRun(i + 1, BOT_SKILLS.average).questions)
      .filter((n) => n === CONFIG.questions.perRun).length;
    expect(full).toBeGreaterThanOrEqual(85);
  });
});

describe('summarize', () => {
  it('reports percentiles and the share of players per tier', () => {
    const results = [0, 50, 90, 110, 130].map((score) => ({ score, hits: 0, collected: 0, questions: 0 }));
    const s = summarize(results, CONFIG.tiers);
    expect(s.runs).toBe(5);
    expect(s.mean).toBe(76);
    expect(s.tierShare).toEqual([0.4, 0.2, 0.2, 0.2]);
  });
});
