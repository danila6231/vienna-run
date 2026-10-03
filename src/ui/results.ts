import { el } from './dom';

/** End of a round: the score, and a hold-to-reset button for staff. */
export class ResultsScreen {
  readonly root = el('div', 'screen results');
  private score = el('b', 'r-score');
  private hold = el('button', 'r-hold');
  private holdFill = el('i');
  private holdTimer = 0;
  private onDone: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly holdMs: number) {
    const card = el('div', 'paper-card results-card');
    const scoreBox = el('div', 'r-scorebox');
    scoreBox.append(el('span', 'lbl', 'Your score'), this.score);
    card.append(scoreBox, el('p', 'r-thanks', 'Thanks for playing!'));
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

  show(score: number, onDone: () => void): void {
    this.score.textContent = String(score);
    this.cancelHold();
    this.onDone = onDone;
    this.root.hidden = false;
  }

  hide(): void {
    this.cancelHold();
    this.onDone = null;
    this.root.hidden = true;
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
