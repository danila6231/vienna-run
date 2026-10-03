import type { I18n } from '../i18n/i18n';
import type { BoardRow, Range, SyncStatus } from '../scores/types';
import { boardList } from './board';
import { el } from './dom';

export interface BoardSource {
  readonly available: boolean;
  top(range: Range, n?: number): BoardRow[];
  status(): SyncStatus;
  onChange(cb: () => void): () => void;
}

/** The full leaderboard over any screen: Today / All time, top 10. It closes itself, so the booth never sticks on it. */
export class BoardModal {
  static readonly IDLE_MS = 45_000;
  readonly root = el('div', 'screen board-modal');
  private title = el('h2');
  private todayTab = el('button');
  private allTab = el('button');
  private body = el('div', 'board-body');
  private note = el('p', 'board-note');
  private closeButton = el('button', 'board-close');
  private range: Range = 'today';
  private highlight: string | null = null;
  private timer = 0;

  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly source: BoardSource) {
    const tabs = el('div', 'board-tabs');
    for (const [b, r] of [[this.todayTab, 'today'], [this.allTab, 'all']] as const) {
      b.type = 'button';
      b.addEventListener('click', () => {
        this.range = r;
        this.render();
        this.arm();
      });
      tabs.append(b);
    }
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.hide());
    const card = el('div', 'paper-card board-card');
    card.append(this.title, tabs, this.body, this.note, this.closeButton);
    this.root.append(card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    source.onChange(() => {
      if (this.isOpen) this.render();
    });
    i18n.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(range: Range = 'today', highlight: string | null = null): void {
    this.range = range;
    this.highlight = highlight;
    this.render();
    this.root.hidden = false;
    this.arm();
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.root.hidden = true;
  }

  private arm(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), BoardModal.IDLE_MS);
  }

  private render(): void {
    const { i18n } = this;
    this.title.textContent = i18n.t('board.title');
    this.todayTab.textContent = i18n.t('board.today');
    this.allTab.textContent = i18n.t('board.all');
    this.todayTab.classList.toggle('on', this.range === 'today');
    this.allTab.classList.toggle('on', this.range === 'all');
    this.closeButton.textContent = i18n.t('board.close');
    this.body.replaceChildren(
      this.source.available ? boardList(this.source.top(this.range, 10), i18n, this.highlight) : el('p', 'board-empty', i18n.t('board.unavailable')),
    );
    this.note.textContent = this.source.status().mode === 'offline' ? i18n.t('board.offline') : '';
  }
}
