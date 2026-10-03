import type { GameConfig } from '../config';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from '../core/types';
import { el } from './dom';
import { formatPoints, ITEM_LABELS } from './labels';

export class AttractScreen {
  readonly root = el('div', 'screen attract');

  constructor(parent: HTMLElement, cfg: GameConfig, icons: Record<ItemType, string>, logoUrl: string | null) {
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

    const legend = el('ul', 'legend');
    for (const type of [...GOOD_TYPES, ...BAD_TYPES]) {
      const li = el('li', cfg.items[type].good ? '' : 'bad');
      const img = el('img');
      img.src = icons[type];
      img.alt = '';
      li.append(img, el('span', '', ITEM_LABELS[type]), el('b', '', formatPoints(cfg.items[type].points)));
      legend.append(li);
    }

    card.append(legend, el('p', 'cta', 'Tap anywhere to play'));
    this.root.append(card);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
