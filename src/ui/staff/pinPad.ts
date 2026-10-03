import { el } from '../dom';
import { button } from './fields';

export interface PinRequest {
  check(pin: string): boolean;
  onSuccess(): void;
  onCancel(): void;
}

/** Four-digit PIN entry for staff. Three wrong tries, Cancel, Escape or 20 s without input closes it. */
export class PinPad {
  static readonly IDLE_MS = 20_000;
  static readonly MAX_TRIES = 3;
  readonly root = el('div', 'staff-screen pin-pad');
  private card = el('div', 'paper-card pin-card');
  private dots: HTMLElement[] = [];
  private entered = '';
  private tries = 0;
  private idleTimer = 0;
  private req: PinRequest | null = null;

  constructor(parent: HTMLElement) {
    const dotRow = el('div', 'pin-dots');
    for (let i = 0; i < 4; i++) {
      const d = el('i');
      this.dots.push(d);
      dotRow.append(d);
    }
    const keys = el('div', 'pin-keys');
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) keys.append(button(k, () => this.digit(k), 'pin-key'));
    const back = button('⌫', () => this.back(), 'pin-key small');
    back.setAttribute('aria-label', 'Delete');
    keys.append(button('Cancel', () => this.cancel(), 'pin-key small'), button('0', () => this.digit('0'), 'pin-key'), back);
    this.card.append(el('h2', '', 'Staff settings'), el('p', 'st-note', 'Enter the PIN'), dotRow, keys);
    this.root.append(this.card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(req: PinRequest): void {
    this.req = req;
    this.entered = '';
    this.tries = 0;
    this.paint();
    this.root.hidden = false;
    this.armIdle();
  }

  private close(): void {
    window.clearTimeout(this.idleTimer);
    this.root.hidden = true;
    this.req = null;
  }

  private cancel(): void {
    const r = this.req;
    this.close();
    r?.onCancel();
  }

  private digit(d: string): void {
    if (!this.req || this.entered.length >= 4) return;
    this.entered += d;
    this.paint();
    this.armIdle();
    if (this.entered.length === 4) this.submit();
  }

  private back(): void {
    this.entered = this.entered.slice(0, -1);
    this.paint();
    this.armIdle();
  }

  private submit(): void {
    const r = this.req;
    if (!r) return;
    if (r.check(this.entered)) {
      this.close();
      r.onSuccess();
      return;
    }
    this.tries++;
    this.entered = '';
    this.paint();
    this.card.classList.remove('wrong');
    void this.card.offsetWidth; // restart the shake animation
    this.card.classList.add('wrong');
    if (this.tries >= PinPad.MAX_TRIES) this.cancel();
  }

  private paint(): void {
    this.dots.forEach((d, i) => d.classList.toggle('on', i < this.entered.length));
  }

  private armIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.cancel(), PinPad.IDLE_MS);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (/^\d$/.test(e.key)) this.digit(e.key);
    else if (e.key === 'Backspace') this.back();
    else if (e.key === 'Escape') this.cancel();
    else return;
    e.preventDefault();
  }
}
