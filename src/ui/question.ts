import type { Question } from '../core/types';
import { el } from './dom';

export class QuestionScreen {
  static readonly GRACE_MS = 400;
  readonly root = el('div', 'screen question');
  private title = el('p', 'q-bonus');
  private text = el('h2', 'q-text');
  private ring = el('div', 'q-ring');
  private ringNum = el('span');
  private buttons: HTMLButtonElement[] = [];
  private onPick: ((index: number) => void) | null = null;
  /** Answers are ignored until this time, so a lane tap that coincides with the question popping up can't pick one. */
  private armedAt = 0;

  constructor(parent: HTMLElement) {
    const card = el('div', 'paper-card question-card');
    const options = el('div', 'q-options');
    for (let i = 0; i < 3; i++) {
      const b = el('button', 'q-option');
      b.type = 'button';
      // pointerdown answers instantly on touch frames; click covers mouse and keyboard.
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pick(i);
      });
      b.addEventListener('click', () => this.pick(i));
      this.buttons.push(b);
      options.append(b);
    }
    this.ring.append(this.ringNum);
    card.append(this.title, this.text, options, this.ring);
    this.root.append(card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(q: Question, basePoints: number, onPick: (index: number) => void): void {
    this.title.textContent = `Bonus question! Right answer = double points (${basePoints} → ${basePoints * 2})`;
    this.text.textContent = q.q;
    q.options.forEach((o, i) => {
      const b = this.buttons[i];
      b.textContent = o;
      b.className = 'q-option';
      b.disabled = false;
    });
    this.onPick = onPick;
    this.armedAt = Date.now() + QuestionScreen.GRACE_MS;
    this.tick(1, 10);
    this.root.hidden = false;
  }

  tick(fraction: number, secondsLeft: number): void {
    this.ring.style.setProperty('--p', String(Math.max(0, Math.min(1, fraction))));
    const t = String(Math.ceil(secondsLeft));
    if (this.ringNum.textContent !== t) this.ringNum.textContent = t;
  }

  reveal(correct: number, picked: number | null): void {
    this.onPick = null;
    this.buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add('right');
      else if (i === picked) b.classList.add('wrong');
    });
    this.title.textContent = picked === null ? "Time's up! No points this time." : picked === correct ? 'Right! Double points.' : 'Not quite. No points this time.';
  }

  hide(): void {
    this.onPick = null;
    this.root.hidden = true;
  }

  private pick(i: number): void {
    const cb = this.onPick;
    if (!cb || Date.now() < this.armedAt) return;
    this.onPick = null;
    cb(i);
  }
}
