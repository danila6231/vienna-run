import { el } from './dom';

export class Hud {
  readonly root = el('div', 'hud');
  private scoreEl = el('b', '', '0');
  private fill = el('i');
  private lastScore = -1;
  private lastFill = -1;

  constructor(parent: HTMLElement, routeLabel: string) {
    const score = el('div', 'hud-score');
    score.append(el('span', 'lbl', 'Points'), this.scoreEl);
    const bar = el('div', 'bar');
    bar.append(this.fill);
    const route = el('div', 'hud-route');
    route.append(el('span', 'lbl', routeLabel), bar);
    this.root.append(score, route);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  update(score: number, progress: number): void {
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.scoreEl.textContent = String(score);
    }
    const f = Math.round(progress * 200) / 2;
    if (f !== this.lastFill) {
      this.lastFill = f;
      this.fill.style.width = `${f}%`;
    }
  }
}
