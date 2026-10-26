export type Lane = -1 | 0 | 1;
export type GoodType = 'piano' | 'violin' | 'sheet' | 'notes';
export type BadType = 'krampus' | 'bomb';
/** Items with points of their own: the rewards and the obstacles. */
export type ItemType = GoodType | BadType;
/** Everything that lies on the road: the items, and the ❓ that open a question. */
export type RoadType = ItemType | 'question';
/** Level 1 questions are easy and come halfway; Level 2 questions come just before the finish. */
export type QuestionLevel = 1 | 2;

export const GOOD_TYPES: readonly GoodType[] = ['piano', 'violin', 'sheet', 'notes'];
export const BAD_TYPES: readonly BadType[] = ['krampus', 'bomb'];
export const isGood = (t: ItemType): t is GoodType => (GOOD_TYPES as readonly string[]).includes(t);

export type ItemState = 'live' | 'taken' | 'hit';

export interface Item {
  id: number;
  /** Distance along the route, in metres. */
  at: number;
  lane: Lane;
  type: RoadType;
  state: ItemState;
  /** Seconds since the item was taken or hit (drives its exit animation). */
  t: number;
  /** For a ❓: which question row it belongs to. */
  level?: QuestionLevel;
}

export type RunEvent =
  | { kind: 'collect'; item: Item; points: number }
  | { kind: 'hit'; item: Item; points: number }
  | { kind: 'question'; item: Item }
  | { kind: 'answer'; item: Item; correct: boolean; points: number }
  | { kind: 'finish'; score: number };

export interface QuestionText {
  q: string;
  options: [string, string, string];
}

/** A bonus question in both languages; `answer` indexes the options of either language. */
export interface Question {
  id: string;
  level: QuestionLevel;
  answer: 0 | 1 | 2;
  vi: QuestionText;
  en: QuestionText;
}
export type Lang = 'vi' | 'en';
export const LANGS: readonly Lang[] = ['vi', 'en'];
