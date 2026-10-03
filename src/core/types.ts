export type Lane = -1 | 0 | 1;
export type GoodType = 'sacher' | 'kipferl' | 'melange' | 'mozart';
export type BadType = 'krampus' | 'bomb';
export type ItemType = GoodType | BadType;

export const GOOD_TYPES: readonly GoodType[] = ['sacher', 'kipferl', 'melange', 'mozart'];
export const BAD_TYPES: readonly BadType[] = ['krampus', 'bomb'];
export const isGood = (t: ItemType): t is GoodType => (GOOD_TYPES as readonly string[]).includes(t);

export type ItemState = 'live' | 'taken' | 'hit';

export interface Item {
  id: number;
  /** Distance along the route, in metres. */
  at: number;
  lane: Lane;
  type: ItemType;
  state: ItemState;
  /** Seconds since the item was taken or hit (drives its exit animation). */
  t: number;
  /** True when collecting this item opened a bonus question. */
  question: boolean;
}

export type RunEvent =
  | { kind: 'collect'; item: Item; points: number }
  | { kind: 'hit'; item: Item; points: number }
  | { kind: 'question'; item: Item }
  | { kind: 'answer'; item: Item; correct: boolean; points: number }
  | { kind: 'finish'; score: number };

export interface Question {
  id: string;
  q: string;
  options: [string, string, string];
  answer: 0 | 1 | 2;
}
