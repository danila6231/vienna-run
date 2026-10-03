import type { GameConfig } from '../config';
import { shuffle, type Rng } from './rng';
import type { Question } from './types';

/**
 * Secret run-time moments (seconds) after which the next treat collected asks a question.
 * Samples in a shrunken window, then re-inserts the gaps, so every slot set is valid.
 */
export function scheduleSlots(rng: Rng, q: GameConfig['questions']): number[] {
  const free = q.windowEnd - q.windowStart - (q.perRun - 1) * q.minGap;
  if (free < 0) throw new Error('question window too small for perRun slots with minGap');
  const base = Array.from({ length: q.perRun }, () => rng() * free).sort((a, b) => a - b);
  return base.map((b, i) => q.windowStart + b + i * q.minGap);
}

export function shuffleOptions(rng: Rng, q: Question): Question {
  const order = shuffle(rng, [0, 1, 2]);
  const options = order.map((i) => q.options[i]) as [string, string, string];
  return { ...q, options, answer: order.indexOf(q.answer) as 0 | 1 | 2 };
}

/** Picks `count` distinct questions, avoiding recent ones while enough fresh ones remain. */
export function pickQuestions(rng: Rng, bank: readonly Question[], count: number, recent: readonly string[]): Question[] {
  const recentSet = new Set(recent);
  const fresh = bank.filter((q) => !recentSet.has(q.id));
  const pool = fresh.length >= count ? fresh : [...bank];
  return shuffle(rng, [...pool]).slice(0, count).map((q) => shuffleOptions(rng, q));
}

export function updateRecent(history: readonly string[][], used: readonly string[], keep: number): string[][] {
  return [...history, [...used]].slice(-keep);
}

export function validateBank(raw: unknown): Question[] {
  if (!Array.isArray(raw)) throw new Error('question bank must be an array');
  const seen = new Set<string>();
  return raw.map((entry, i) => {
    const o = entry as Partial<Question>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) throw new Error(`question ${i}: missing or duplicate id`);
    if (typeof o.q !== 'string' || !o.q.trim()) throw new Error(`question ${o.id}: empty text`);
    if (!Array.isArray(o.options) || o.options.length !== 3 || o.options.some((s) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`question ${o.id}: needs exactly 3 options`);
    }
    if (new Set(o.options).size !== 3) throw new Error(`question ${o.id}: options must differ`);
    if (o.answer !== 0 && o.answer !== 1 && o.answer !== 2) throw new Error(`question ${o.id}: answer must be 0, 1 or 2`);
    seen.add(o.id);
    return { id: o.id, q: o.q, options: [o.options[0], o.options[1], o.options[2]], answer: o.answer };
  });
}
