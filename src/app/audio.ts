export type SoundId = 'collect' | 'hit' | 'question' | 'finish';

/** Silent for the MVP. Load and play sounds here later; the game already calls every cue. */
export const audio = {
  play(_id: SoundId): void {},
};
