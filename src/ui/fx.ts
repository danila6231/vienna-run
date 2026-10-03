import { el } from './dom';

export type PopKind = 'plus' | 'minus' | 'neutral';

export class Fx {
  private layer = el('div', 'fx-layer');
  private flashEl = el('div', 'fx-flash');
  private confettiEl = el('div', 'fx-confetti');
  private bannerEl = el('div', 'fx-banner');
  private bannerTimer = 0;
  private confettiTimer = 0;

  constructor(parent: HTMLElement) {
    this.bannerEl.hidden = true;
    parent.append(this.flashEl, this.layer, this.confettiEl, this.bannerEl);
  }

  popup(text: string, kind: PopKind, at: { x: number; y: number }): void {
    const p = el('div', `fx-pop ${kind}`, text);
    p.style.left = `${at.x * 100}%`;
    p.style.top = `${at.y * 100}%`;
    this.layer.append(p);
    window.setTimeout(() => p.remove(), 950);
    while (this.layer.childElementCount > 12) this.layer.firstElementChild?.remove();
  }

  flash(): void {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth; // restart the CSS animation
    this.flashEl.classList.add('on');
  }

  banner(title: string, sub: string, seconds: number): void {
    this.bannerEl.replaceChildren(el('b', '', title), el('span', '', sub));
    this.bannerEl.hidden = false;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (this.bannerEl.hidden = true), seconds * 1000);
  }

  confetti(): void {
    const colors = ['#c8102e', '#fbf3e2', '#e2c06a', '#6f9f8b'];
    this.confettiEl.replaceChildren(
      ...Array.from({ length: 60 }, (_, i) => {
        const c = el('i');
        c.style.left = `${(i * 37) % 100}%`;
        c.style.animationDelay = `${(i % 10) * 0.06}s`;
        c.style.background = colors[i % colors.length];
        return c;
      }),
    );
    window.clearTimeout(this.confettiTimer);
    this.confettiTimer = window.setTimeout(() => this.confettiEl.replaceChildren(), 3000);
  }

  clear(): void {
    this.layer.replaceChildren();
    this.confettiEl.replaceChildren();
    this.bannerEl.hidden = true;
  }
}
