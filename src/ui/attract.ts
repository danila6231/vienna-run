import type { GameConfig } from '../config';
import type { Features } from '../core/settings';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from '../core/types';
import { el } from './dom';
import { formatPoints, ITEM_LABELS } from './labels';

export class AttractScreen {
  readonly root = el('div', 'screen attract');
  private legend = el('ul', 'legend');
  private ladder = el('ol', 'ladder');

  constructor(parent: HTMLElement, private readonly icons: Record<ItemType, string>, logoUrl: string | null) {
    const card = el('div', 'paper-card attract-card');
    if (logoUrl) {
      const logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = 'Vienna Run';
      card.append(logo);
    } else {
      card.append(el('h1', '', 'Vienna Run'));
    }
    card.append(el('p', 'tagline', 'Race the waiter from Stephansdom to the Riesenrad. Grab Viennese treats and dodge Krampus and the bombs.'));
    this.ladder.hidden = true;
    card.append(this.legend, this.ladder, el('p', 'cta', 'Tap anywhere to play'));
    this.root.append(card);
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Point values, and the gift ladder when gifts are switched on, from the current settings. */
  configure(cfg: GameConfig, features: Features): void {
    this.legend.replaceChildren(
      ...[...GOOD_TYPES, ...BAD_TYPES].map((type) => {
        const li = el('li', cfg.items[type].good ? '' : 'bad');
        const img = el('img');
        img.src = this.icons[type];
        img.alt = '';
        li.append(img, el('span', '', ITEM_LABELS[type]), el('b', '', formatPoints(cfg.items[type].points)));
        return li;
      }),
    );
    this.ladder.replaceChildren(
      ...(features.showGifts ? cfg.tiers : []).map((t) => {
        const li = el('li');
        li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
        return li;
      }),
    );
    this.ladder.hidden = !features.showGifts;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
