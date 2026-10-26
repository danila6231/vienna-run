import type { ItemType } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';

/** English names, used on the staff screens. */
export const ITEM_LABELS: Record<ItemType, string> = {
  piano: 'Piano',
  violin: 'Violin',
  sheet: 'Sheet music',
  notes: 'Notes',
  krampus: 'Krampus',
  bomb: 'Bomb',
};

const ITEM_KEYS: Record<ItemType, StringKey> = {
  piano: 'item.piano',
  violin: 'item.violin',
  sheet: 'item.sheet',
  notes: 'item.notes',
  krampus: 'item.krampus',
  bomb: 'item.bomb',
};

/** Visitor-facing item name in the current language (Krampus keeps a Vietnamese hint after " · "). */
export const itemLabel = (i18n: I18n, type: ItemType): string => i18n.t(ITEM_KEYS[type]);

/** +15, −10 (true minus sign), 0 */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
