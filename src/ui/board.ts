import type { I18n } from '../i18n/i18n';
import type { BoardRow } from '../scores/types';
import { el } from './dom';

/** A ranked list (place, name, score), or an invitation when it is empty. Names are always plain text. */
export function boardList(rows: readonly BoardRow[], i18n: I18n, highlight: string | null = null): HTMLElement {
  if (rows.length === 0) return el('p', 'board-empty', i18n.t('board.empty'));
  const list = el('ol', 'board-list');
  rows.forEach((r, i) => {
    const li = el('li', r.id === highlight ? 'me' : '');
    li.append(el('b', 'board-rank', String(i + 1)), el('span', 'board-name', r.name), el('span', 'board-score', String(r.score)));
    list.append(li);
  });
  return list;
}
