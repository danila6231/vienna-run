import type { Preset } from '../core/settings';
import type { Lang } from '../core/types';

export type Range = 'today' | 'all';

/** One finished round, as kept on this device. */
export interface ScoreEntry {
  id: string;
  /** When the round finished (ISO time). */
  at: string;
  board: string;
  score: number;
  /** Code name, or null if the player did not save one. Only named rounds appear on boards. */
  name: string | null;
  preset: Preset;
  lang: Lang;
  questionsOn: boolean;
  device: string;
  /** The results screen has closed, so the round is ready to upload. */
  final: boolean;
  uploaded: boolean;
}

/** One line of a leaderboard. */
export interface BoardRow {
  id: string;
  at: string;
  name: string;
  score: number;
}

export interface SyncStatus {
  /** 'connecting' until the first attempt finishes; 'local-only' without Supabase details (USB copy). */
  mode: 'online' | 'offline' | 'local-only' | 'connecting';
  /** Finished rounds not uploaded yet. */
  pending: number;
  lastSyncAt: string | null;
}
