import type { ItemType } from '../core/types';

export const ITEM_LABELS: Record<ItemType, string> = {
  sacher: 'Sachertorte',
  kipferl: 'Kipferl',
  melange: 'Melange',
  mozart: 'Mozartkugel',
  krampus: 'Krampus',
  bomb: 'Bomb',
};

/** +15, −10 (true minus sign), 0 */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
