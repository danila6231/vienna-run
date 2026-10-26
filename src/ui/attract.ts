import type { GameConfig } from '../config';
import type { Features } from '../core/settings';
import { BAD_TYPES, GOOD_TYPES, LANGS, type ItemType, type RoadType } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { BoardRow } from '../scores/types';
import { boardList } from './board';
import { el } from './dom';
import { formatPoints, itemLabel } from './labels';

/** What the start-screen panel shows; null hides it (leaderboard switched off). */
export interface BoardView {
  today: BoardRow[];
  all: BoardRow[];
  state: 'ok' | 'offline' | 'unavailable';
}

export class AttractScreen {
  readonly root = el('div', 'screen attract');
  private card = el('div', 'paper-card attract-card');
  private tagline = el('p', 'tagline');
  private legend = el('ul', 'legend');
  private ladder = el('ol', 'ladder');
  private cta = el('p', 'cta');
  private pill = el('button', 'lang-pill');
  private cfg: GameConfig | null = null;
  private features: Features = { showGifts: false, leaderboard: false };
  private boardPanel = el('div', 'paper-card board-panel');
  private boardBody = el('div', 'board-body');
  private boardNote = el('p', 'board-note');
  private board: BoardView | null = null;

  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly icons: Record<RoadType, string>, logoUrl: string | null) {
    if (logoUrl) {
      const logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = 'Step into Vienna';
      this.card.append(logo);
    } else {
      this.card.append(el('h1', '', 'Step into Vienna'));
    }
    this.ladder.hidden = true;
    this.card.append(this.tagline, this.legend, this.ladder, this.cta);
    // Language switch: an on-screen control, so pressing it never starts a game.
    this.pill.type = 'button';
    this.pill.dataset.ui = '';
    for (const lang of LANGS) {
      const s = el('span', '', lang.toUpperCase());
      s.dataset.lang = lang;
      this.pill.append(s);
    }
    this.pill.addEventListener('click', () => i18n.set(i18n.lang === 'vi' ? 'en' : 'vi'));
    this.boardPanel.hidden = true;
    this.boardPanel.append(this.boardBody, this.boardNote);
    this.root.append(this.card, this.boardPanel, this.pill);
    this.root.hidden = true;
    parent.append(this.root);
    this.render();
    i18n.onChange(() => this.render());
  }

  /** Point values, and the gift ladder when gifts are switched on, from the current settings. */
  configure(cfg: GameConfig, features: Features): void {
    this.cfg = cfg;
    this.features = features;
    this.render();
  }

  /** Today's and the all-time top 10 beside the title card, or null to hide the panel (leaderboard switched off). */
  setBoard(view: BoardView | null): void {
    this.board = view;
    this.renderBoard();
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private render(): void {
    const { i18n } = this;
    this.tagline.textContent = i18n.t('attract.tagline');
    this.cta.textContent = i18n.t('attract.cta');
    this.pill.setAttribute('aria-label', i18n.t('lang.switch'));
    for (const s of this.pill.querySelectorAll<HTMLElement>('[data-lang]')) s.classList.toggle('on', s.dataset.lang === i18n.lang);
    this.renderBoard();
    const cfg = this.cfg;
    if (!cfg) return;
    const entry = (type: RoadType, cls: string, text: string, points: string) => {
      const li = el('li', cls);
      const img = el('img');
      img.src = this.icons[type];
      img.alt = '';
      // "Krampus · quỷ Krampus" shows as the name with the hint on a second, smaller line.
      const [name, hint] = text.split(' · ');
      const label = el('span', '', name);
      if (hint) label.append(el('small', '', hint));
      li.append(img, label, el('b', '', points));
      return li;
    };
    const item = (type: ItemType) => entry(type, cfg.items[type].good ? '' : 'bad', itemLabel(i18n, type), formatPoints(cfg.items[type].points));
    const q = cfg.questions;
    this.legend.replaceChildren(
      ...GOOD_TYPES.map(item),
      ...(q.enabled ? [entry('question', '', i18n.t('item.question'), `${formatPoints(q.points[1])} / ${formatPoints(q.points[2])}`)] : []),
      ...BAD_TYPES.map(item),
    );
    this.ladder.replaceChildren(
      ...(this.features.showGifts ? cfg.tiers : []).map((t) => {
        const li = el('li');
        li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
        return li;
      }),
    );
    this.ladder.hidden = !this.features.showGifts;
  }

  /** Only the leaderboard panel (it changes after every sync; the card does not). */
  private renderBoard(): void {
    const { i18n } = this;
    const view = this.board;
    this.root.classList.toggle('with-board', view !== null);
    this.boardPanel.hidden = view === null;
    if (!view) return;
    const section = (title: string, rows: BoardRow[]) => {
      const s = el('section', 'board-section');
      s.append(el('h2', '', title), boardList(rows, i18n));
      return s;
    };
    this.boardBody.replaceChildren(
      ...(view.state === 'unavailable'
        ? [el('p', 'board-empty', i18n.t('board.unavailable'))]
        : [section(i18n.t('board.todayTop'), view.today), section(i18n.t('board.allTop'), view.all)]),
    );
    this.boardNote.textContent = view.state === 'offline' ? i18n.t('board.offline') : '';
  }
}
