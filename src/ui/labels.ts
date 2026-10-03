import type { ItemType } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';

/** Original names, used on the English staff screens. */
export const ITEM_LABELS: Record<ItemType, string> = {
  sacher: 'Sachertorte',
  kipferl: 'Kipferl',
  melange: 'Melange',
  mozart: 'Mozartkugel',
  krampus: 'Krampus',
  bomb: 'Bomb',
};

const ITEM_KEYS: Record<ItemType, StringKey> = {
  sacher: 'item.sacher',
  kipferl: 'item.kipferl',
  melange: 'item.melange',
  mozart: 'item.mozart',
  krampus: 'item.krampus',
  bomb: 'item.bomb',
};

/** Visitor-facing item name: the original name, plus a Vietnamese hint in Vietnamese. */
export const itemLabel = (i18n: I18n, type: ItemType): string => i18n.t(ITEM_KEYS[type]);

/** +15, −10 (true minus sign), 0 */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
