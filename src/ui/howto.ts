import type { I18n } from '../i18n/i18n';
import { el } from './dom';

export class HowtoScreen {
  readonly root = el('div', 'screen howto');
  private card = el('div', 'paper-card howto-card');
  private count = el('div', 'countdown');
  private title = el('h2');
  private lanes = el('li');
  private items = el('li');
  private bonus = el('li');

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    const steps = el('ol');
    steps.append(this.lanes, this.items, this.bonus);
    this.card.append(this.title, steps);
    this.root.append(this.card, this.count);
    this.root.hidden = true;
    parent.append(this.root);
    this.relabel();
    i18n.onChange(() => this.relabel());
  }

  /** The rules card; the bonus-question line only shows when questions are switched on. */
  showHowto(questionsOn: boolean): void {
    this.bonus.hidden = !questionsOn;
    this.root.hidden = false;
    this.card.hidden = false;
    this.count.hidden = true;
  }

  /** 3, 2, 1… and "Go!" for 0. */
  showCount(n: number): void {
    const text = n > 0 ? String(n) : this.i18n.t('howto.go');
    this.root.hidden = false;
    this.card.hidden = true;
    this.count.hidden = false;
    if (this.count.textContent !== text) {
      this.count.textContent = text;
      this.count.style.animation = 'none';
      void this.count.offsetWidth;
      this.count.style.animation = '';
    }
  }

  hide(): void {
    this.root.hidden = true;
  }

  private relabel(): void {
    this.title.textContent = this.i18n.t('howto.title');
    this.lanes.textContent = this.i18n.t('howto.lanes');
    this.items.textContent = this.i18n.t('howto.items');
    this.bonus.textContent = this.i18n.t('howto.bonus');
  }
}
