import type { I18n } from '../i18n/i18n';
import { el } from './dom';

export class Hud {
  readonly root = el('div', 'hud');
  private scoreLabel = el('span', 'lbl');
  private routeLabel = el('span', 'lbl');
  private scoreEl = el('b', '', '0');
  private fill = el('i');
  private lastScore = -1;
  private lastFill = -1;

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    const score = el('div', 'hud-score');
    score.append(this.scoreLabel, this.scoreEl);
    const bar = el('div', 'bar');
    bar.append(this.fill);
    const route = el('div', 'hud-route');
    route.append(this.routeLabel, bar);
    this.root.append(score, route);
    this.root.hidden = true;
    parent.append(this.root);
    this.relabel();
    i18n.onChange(() => this.relabel());
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

  private relabel(): void {
    this.scoreLabel.textContent = this.i18n.t('hud.points');
    this.routeLabel.textContent = this.i18n.t('hud.route');
  }
}
