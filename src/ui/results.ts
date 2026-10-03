import type { Tier } from '../config';
import { el } from './dom';

export interface GiftInfo {
  tiers: readonly Tier[];
  /** The tier this score reached. */
  index: number;
  /** Designer gift card image, or null. */
  url: string | null;
}

export interface ResultsInfo {
  score: number;
  /** Null while gifts are switched off. */
  gift: GiftInfo | null;
}

/** End of a round: the score, the prize when gifts are on, and a hold-to-reset button for staff. */
export class ResultsScreen {
  readonly root = el('div', 'screen results');
  private score = el('b', 'r-score');
  private thanks = el('p', 'r-thanks', 'Thanks for playing!');
  private giftBox = el('div', 'r-giftbox');
  private hold = el('button', 'r-hold');
  private holdFill = el('i');
  private holdTimer = 0;
  private onDone: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly holdMs: number) {
    const card = el('div', 'paper-card results-card');
    const scoreBox = el('div', 'r-scorebox');
    scoreBox.append(el('span', 'lbl', 'Your score'), this.score);
    card.append(scoreBox, this.thanks, this.giftBox);
    this.hold.type = 'button';
    this.hold.append(this.holdFill, el('span', '', 'Hold for next player'));
    const start = (e: Event) => {
      e.preventDefault();
      this.startHold();
    };
    const cancel = () => this.cancelHold();
    this.hold.addEventListener('pointerdown', start);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) this.hold.addEventListener(ev, cancel);
    this.hold.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.startHold();
    });
    this.hold.addEventListener('keyup', cancel);
    this.root.append(card, this.hold);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(info: ResultsInfo, onDone: () => void): void {
    this.score.textContent = String(info.score);
    this.showGift(info.gift);
    this.cancelHold();
    this.onDone = onDone;
    this.root.hidden = false;
  }

  hide(): void {
    this.cancelHold();
    this.onDone = null;
    this.root.hidden = true;
  }

  private showGift(g: GiftInfo | null): void {
    this.thanks.hidden = g !== null;
    this.giftBox.hidden = g === null;
    if (!g) {
      this.giftBox.replaceChildren();
      return;
    }
    const parts: HTMLElement[] = [el('p', 'lbl', 'Your prize'), el('h2', 'r-tier', g.tiers[g.index].name)];
    if (g.url) {
      const img = el('img', 'r-gift');
      img.src = g.url;
      img.alt = '';
      parts.push(img);
    }
    const ladder = el('ol', 'ladder r-ladder');
    g.tiers.forEach((t, i) => {
      const li = el('li', i === g.index ? 'on' : i < g.index ? 'passed' : '');
      li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
      ladder.append(li);
    });
    parts.push(ladder);
    this.giftBox.replaceChildren(...parts);
  }

  private startHold(): void {
    if (!this.onDone || this.holdTimer) return;
    this.holdFill.style.transitionDuration = `${this.holdMs}ms`;
    this.hold.classList.add('holding');
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = 0;
      this.hold.classList.remove('holding');
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
    }, this.holdMs);
  }

  private cancelHold(): void {
    if (this.holdTimer) window.clearTimeout(this.holdTimer);
    this.holdTimer = 0;
    this.hold.classList.remove('holding');
  }
}
