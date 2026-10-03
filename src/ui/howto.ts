import { el } from './dom';

export class HowtoScreen {
  readonly root = el('div', 'screen howto');
  private card = el('div', 'paper-card howto-card');
  private count = el('div', 'countdown');

  constructor(parent: HTMLElement) {
    const steps = el('ol');
    for (const s of [
      'Tap the left or right side of the screen to switch lanes.',
      'Grab the treats. Dodge Krampus and the bombs.',
      'Some treats hide a bonus question. Answer right for double points.',
    ]) steps.append(el('li', '', s));
    this.card.append(el('h2', '', 'How to play'), steps);
    this.root.append(this.card, this.count);
    this.root.hidden = true;
    parent.append(this.root);
  }

  showHowto(): void {
    this.root.hidden = false;
    this.card.hidden = false;
    this.count.hidden = true;
  }

  /** 3, 2, 1… and "Go!" for 0. */
  showCount(n: number): void {
    const text = n > 0 ? String(n) : 'Go!';
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
}
