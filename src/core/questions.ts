import { shuffle, type Rng } from './rng';
import type { Lang, Question, QuestionText } from './types';

export function shuffleOptions(rng: Rng, q: Question): Question {
  const order = shuffle(rng, [0, 1, 2]);
  const reorder = (t: QuestionText): QuestionText => ({ q: t.q, options: order.map((i) => t.options[i]) as [string, string, string] });
  return { ...q, vi: reorder(q.vi), en: reorder(q.en), answer: order.indexOf(q.answer) as 0 | 1 | 2 };
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

function validateText(id: string, lang: Lang, raw: unknown): QuestionText {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Partial<QuestionText>;
  if (typeof t.q !== 'string' || !t.q.trim()) throw new Error(`question ${id} (${lang}): empty text`);
  if (!Array.isArray(t.options) || t.options.length !== 3 || t.options.some((s) => typeof s !== 'string' || !s.trim())) {
    throw new Error(`question ${id} (${lang}): needs exactly 3 options`);
  }
  if (new Set(t.options).size !== 3) throw new Error(`question ${id} (${lang}): options must differ`);
  return { q: t.q, options: [t.options[0], t.options[1], t.options[2]] };
}

/** Checks the bank file: unique ids, a level, a valid answer index, and full text in both languages. */
export function validateBank(raw: unknown): Question[] {
  if (!Array.isArray(raw)) throw new Error('question bank must be an array');
  const seen = new Set<string>();
  return raw.map((entry, i) => {
    const o = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) throw new Error(`question ${i}: missing or duplicate id`);
    if (o.level !== 1 && o.level !== 2) throw new Error(`question ${o.id}: level must be 1 or 2`);
    if (o.answer !== 0 && o.answer !== 1 && o.answer !== 2) throw new Error(`question ${o.id}: answer must be 0, 1 or 2`);
    seen.add(o.id);
    return { id: o.id, level: o.level, answer: o.answer, vi: validateText(o.id, 'vi', o.vi), en: validateText(o.id, 'en', o.en) };
  });
}
