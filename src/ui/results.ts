import type { Tier } from '../config';
import type { I18n } from '../i18n/i18n';
import { cleanNameInput, finalName } from '../scores/names';
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
  /** The logged round a code name can be saved to; null or missing hides name entry. */
  entryId?: string | null;
}

export interface NameEntry {
  /** Saves the code name: today's place (1–10), null when saved outside the top 10, or false when refused. */
  save(id: string, name: string): number | null | false;
  /** Opens the full leaderboard with this round highlighted. */
  open(id: string): void;
}

/** End of a round: the score, the prize when gifts are on, and a hold-to-reset button for staff. */
export class ResultsScreen {
  readonly root = el('div', 'screen results');
  private score = el('b', 'r-score');
  private thanks = el('p', 'r-thanks');
  private scoreLabel = el('span', 'lbl');
  private holdLabel = el('span');
  private giftBox = el('div', 'r-giftbox');
  private hold = el('button', 'r-hold');
  private holdFill = el('i');
  private holdTimer = 0;
  private onDone: (() => void) | null = null;
  /** Without a key press for this long, a half-typed name stops holding the screen open. */
  static readonly TYPING_GRACE_MS = 20_000;
  private nameBox = el('div', 'r-namebox');
  private nameHint = el('p', 'r-name-hint');
  private nameInput = el('input', 'r-name');
  private saveButton = el('button', 'r-save');
  private nameMsg = el('p', 'r-name-msg');
  private viewButton = el('button', 'r-view');
  private entryId: string | null = null;
  private saved = false;
  private focused = false;
  private lastTyped = 0;

  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly holdMs: number, private readonly names: NameEntry | null = null) {
    const card = el('div', 'paper-card results-card');
    const scoreBox = el('div', 'r-scorebox');
    scoreBox.append(this.scoreLabel, this.score);
    card.append(scoreBox, this.thanks, this.nameBox, this.giftBox);
    this.hold.type = 'button';
    this.hold.append(this.holdFill, this.holdLabel);
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
    const input = this.nameInput;
    input.type = 'text';
    input.maxLength = 12;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.lang = 'en';
    input.enterKeyHint = 'done';
    input.addEventListener('input', () => {
      const clean = cleanNameInput(input.value);
      if (clean !== input.value) input.value = clean;
      this.lastTyped = Date.now();
      this.saveButton.disabled = finalName(clean) === null;
    });
    input.addEventListener('focus', () => {
      this.focused = true;
      this.lastTyped = Date.now();
    });
    input.addEventListener('blur', () => {
      this.focused = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveName();
      }
    });
    this.saveButton.type = 'button';
    this.saveButton.addEventListener('click', () => this.saveName());
    this.viewButton.type = 'button';
    this.viewButton.addEventListener('click', () => {
      if (this.entryId) this.names?.open(this.entryId);
    });
    const field = el('div', 'r-namefield');
    field.append(input, this.saveButton);
    this.nameBox.append(this.nameHint, field, this.nameMsg, this.viewButton);
    this.root.append(card, this.hold);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    this.relabel();
    i18n.onChange(() => this.relabel());
  }

  show(info: ResultsInfo, onDone: () => void): void {
    this.score.textContent = String(info.score);
    this.showGift(info.gift);
    this.entryId = this.names ? info.entryId ?? null : null;
    this.saved = false;
    this.focused = false;
    this.lastTyped = 0;
    this.nameInput.value = '';
    this.nameInput.disabled = false;
    this.saveButton.disabled = true;
    this.saveButton.hidden = false;
    this.nameMsg.textContent = '';
    this.viewButton.hidden = true;
    this.nameBox.hidden = this.entryId === null;
    this.cancelHold();
    this.onDone = onDone;
    this.root.hidden = false;
  }

  hide(): void {
    this.cancelHold();
    this.onDone = null;
    this.root.hidden = true;
  }

  /** True while a player is typing a name, so the results screen should not time out under them. */
  busy(now = Date.now()): boolean {
    if (!this.entryId || this.saved || this.root.hidden) return false;
    const active = this.focused || this.nameInput.value.length > 0;
    return active && now - this.lastTyped < ResultsScreen.TYPING_GRACE_MS;
  }

  private saveName(): void {
    if (!this.names || !this.entryId || this.saved) return;
    const place = this.names.save(this.entryId, this.nameInput.value);
    if (place === false) {
      this.nameMsg.textContent = this.i18n.t('results.nameHint');
      return;
    }
    this.saved = true;
    this.nameInput.disabled = true;
    this.nameInput.blur();
    this.saveButton.hidden = true;
    this.nameMsg.textContent = place === null ? this.i18n.t('results.saved') : this.i18n.t('results.rank', { rank: place });
    this.viewButton.hidden = false;
  }

  private showGift(g: GiftInfo | null): void {
    this.thanks.hidden = g !== null;
    this.giftBox.hidden = g === null;
    if (!g) {
      this.giftBox.replaceChildren();
      return;
    }
    const parts: HTMLElement[] = [el('p', 'lbl', this.i18n.t('results.prize')), el('h2', 'r-tier', g.tiers[g.index].name)];
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

  private relabel(): void {
    this.scoreLabel.textContent = this.i18n.t('results.score');
    this.thanks.textContent = this.i18n.t('results.thanks');
    this.holdLabel.textContent = this.i18n.t('results.hold');
    this.nameHint.textContent = this.i18n.t('results.nameHint');
    this.nameInput.placeholder = this.i18n.t('results.namePlaceholder');
    this.saveButton.textContent = this.i18n.t('results.save');
    this.viewButton.textContent = this.i18n.t('results.viewBoard');
  }
}
