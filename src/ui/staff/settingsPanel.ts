import {
  applyPreset, defaultSettings, detectPreset, fromShareCode, LIMITS, sanitize, toShareCode, validate, warnings, type Settings,
} from '../../core/settings';
import { BAD_TYPES, GOOD_TYPES, isGood } from '../../core/types';
import { el } from '../dom';
import { ITEM_LABELS } from '../labels';
import { button, choice, note, numberField, row, textField, toggle } from './fields';

export interface PanelContext {
  /** The settings being edited. Nothing is stored until Save. */
  readonly draft: Settings;
  /** Changes the draft. `rerender` rebuilds every section (for edits that change other fields, like presets). */
  edit(change: (draft: Settings) => void, rerender?: boolean): void;
  /** A short message in the footer. */
  notice(text: string): void;
}

export interface Section {
  title: string;
  render(ctx: PanelContext): HTMLElement;
}

export interface PanelOptions {
  /** Extra sections, shown after the bonus-question section. */
  sections?: Section[];
  onSave(settings: Settings): void;
  onClose(): void;
}

const difficulty: Section = {
  title: 'Difficulty',
  render({ draft: d, edit }) {
    const presets = el('div', 'st-choice');
    for (const p of ['easy', 'normal', 'hard'] as const) {
      const b = button(p[0].toUpperCase() + p.slice(1), () => edit((x) => Object.assign(x, applyPreset(x, p)), true));
      b.dataset.preset = p;
      presets.append(b);
    }
    const custom = el('span', 'st-chip', 'Custom');
    custom.dataset.preset = 'custom';
    presets.append(custom);
    const box = el('div');
    box.append(
      row('Preset', presets),
      numberField('Round length', d.roundSeconds, LIMITS.roundSeconds, (v) => edit((x) => { x.roundSeconds = v; }), 's'),
      numberField('Start speed', d.startSpeedKmh, LIMITS.startSpeedKmh, (v) => edit((x) => { x.startSpeedKmh = v; }), 'km/h'),
      numberField('End speed', d.endSpeedKmh, LIMITS.endSpeedKmh, (v) => edit((x) => { x.endSpeedKmh = v; }), 'km/h'),
      choice('Item layout', [{ value: 'random', label: 'Random each round' }, { value: 'fixed', label: 'Same for everyone' }] as const, d.mode, (v) => edit((x) => { x.mode = v; })),
      numberField('Obstacles per round', d.obstacles, LIMITS.obstacles, (v) => edit((x) => { x.obstacles = v; })),
      numberField('Treats per round', d.treats, LIMITS.treats, (v) => edit((x) => { x.treats = v; })),
      note('Random each round: the counts vary by up to a third either way. Same for everyone: exactly these counts; only their places change.'),
    );
    return box;
  },
};

const pointsAndGifts: Section = {
  title: 'Points and gifts',
  render({ draft: d, edit }) {
    const box = el('div');
    for (const t of [...GOOD_TYPES, ...BAD_TYPES]) {
      box.append(numberField(ITEM_LABELS[t], d.points[t], isGood(t) ? LIMITS.goodPoints : LIMITS.badPoints, (v) => edit((x) => { x.points[t] = v; }), 'points'));
    }
    box.append(toggle('Show gifts to players', d.showGifts, (v) => edit((x) => { x.showGifts = v; })));
    const tiers = el('div', 'st-tiers');
    d.tiers.forEach((tier, i) => {
      const min = el('input', 'st-num');
      min.type = 'number';
      min.inputMode = 'numeric';
      min.value = String(tier.min);
      min.disabled = i === 0;
      min.setAttribute('aria-label', `Gift ${i + 1} minimum score`);
      min.addEventListener('input', () => {
        const v = Number(min.value);
        if (min.value.trim() !== '' && Number.isInteger(v)) edit((x) => { x.tiers[i].min = v; });
      });
      const name = el('input', 'st-text');
      name.type = 'text';
      name.maxLength = 24;
      name.value = tier.name;
      name.setAttribute('aria-label', `Gift ${i + 1} name`);
      name.addEventListener('input', () => edit((x) => { x.tiers[i].name = name.value; }));
      const remove = button('Remove', () => edit((x) => {
        x.tiers.splice(i, 1);
        x.tiers[0].min = 0;
      }, true), 'st-btn small');
      remove.setAttribute('aria-label', `Remove gift ${i + 1}`);
      remove.disabled = d.tiers.length <= 1;
      const line = el('div', 'st-tier');
      line.append(el('span', 'st-unit', 'from'), min, name, remove);
      tiers.append(line);
    });
    const add = button('Add gift tier', () => edit((x) => {
      const last = x.tiers[x.tiers.length - 1];
      x.tiers.push({ name: `Gift ${x.tiers.length + 1}`, min: last.min + 20 });
    }, true));
    add.disabled = d.tiers.length >= 6;
    box.append(row('Gift tiers', tiers), row('', add), note('Each tier needs a name and a higher minimum score than the one before. The first tier starts at 0, so everyone gets something.'));
    return box;
  },
};

const questions: Section = {
  title: 'Bonus questions',
  render({ draft: d, edit }) {
    const box = el('div');
    box.append(
      toggle('Bonus questions', d.questions.enabled, (v) => edit((x) => { x.questions.enabled = v; })),
      numberField('Questions per round', d.questions.perRun, LIMITS.perRun, (v) => edit((x) => { x.questions.perRun = v; })),
      numberField('Time to answer', d.questions.timeLimit, LIMITS.timeLimit, (v) => edit((x) => { x.questions.timeLimit = v; }), 's'),
      note("A right answer doubles that treat's points; a wrong answer or no answer gives 0."),
    );
    return box;
  },
};

const pin: Section = {
  title: 'PIN',
  render({ draft: d, edit }) {
    const box = el('div');
    box.append(
      textField('Settings PIN', d.pin, { maxLength: 4, inputMode: 'numeric', secret: true }, (v) => edit((x) => { x.pin = v; })),
      note('4 digits. Write it down: you need it to open this menu. Share codes never include it.'),
    );
    return box;
  },
};

const share: Section = {
  title: 'Share code',
  render(ctx) {
    const out = el('textarea', 'st-code');
    out.readOnly = true;
    out.rows = 3;
    out.hidden = true;
    out.setAttribute('aria-label', 'Share code for this device');
    const copy = button('Copy code', () => {
      const code = toShareCode(ctx.draft);
      out.value = code;
      out.hidden = false;
      out.select();
      const copied = () => ctx.notice('Code copied. Paste it into this menu on the other device.');
      const manual = () => ctx.notice('Select the code below and copy it.');
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(copied, manual);
        else manual();
      } catch {
        manual();
      }
    });
    const input = el('textarea', 'st-code');
    input.rows = 3;
    input.spellcheck = false;
    input.placeholder = 'Paste a VR1-… code here';
    input.setAttribute('aria-label', 'Share code to load');
    const load = button('Load code', () => {
      const loaded = fromShareCode(input.value, ctx.draft);
      if (!loaded) {
        ctx.notice('That code is not valid. Nothing changed.');
        return;
      }
      ctx.edit((x) => Object.assign(x, loaded), true);
      ctx.notice('Code loaded. Check the values, then press Save.');
    });
    const box = el('div');
    box.append(note('Moves these settings to another device: everything except the PIN and the leaderboard board, which stay per device.'), row('This device', copy), out, row('Another device', load), input);
    return box;
  },
};

/** Full-screen staff settings. Edits a copy; Save validates and hands the result back, Cancel throws it away. */
export class SettingsPanel {
  /** Left open and untouched this long, the panel closes without saving, so the booth can never stay paused on it. */
  static readonly IDLE_MS = 180_000;
  readonly root = el('div', 'staff-screen settings');
  private body = el('div', 'st-body');
  private problems = el('ul', 'st-problems');
  private notes = el('ul', 'st-warnings');
  private message = el('p', 'st-message');
  private saveButton: HTMLButtonElement;
  private draft: Settings = defaultSettings();
  private readonly sections: Section[];
  private readonly ctx: PanelContext;
  private idleTimer = 0;

  constructor(parent: HTMLElement, private readonly o: PanelOptions) {
    this.sections = [difficulty, pointsAndGifts, questions, ...(o.sections ?? []), pin, share];
    const panel = this;
    this.ctx = {
      get draft() {
        return panel.draft;
      },
      edit(change, rerender = false) {
        change(panel.draft);
        panel.draft.preset = detectPreset(panel.draft);
        if (rerender) panel.render();
        else panel.refresh();
      },
      notice(text) {
        panel.message.textContent = text;
      },
    };
    this.saveButton = button('Save', () => this.save(), 'st-btn primary');
    const head = el('header', 'st-head');
    head.append(el('h2', '', 'Staff settings'), note('Changes apply from the next round. Only staff should see this screen.'));
    const actions = el('div', 'st-actions');
    actions.append(
      button('Reset to defaults', () => {
        this.ctx.edit((x) => Object.assign(x, { ...defaultSettings(), pin: x.pin, leaderboard: { ...x.leaderboard } }), true);
        this.ctx.notice('Defaults restored (PIN and board name kept). Press Save to keep them.');
      }),
      button('Cancel', () => this.close()),
      this.saveButton,
    );
    const foot = el('footer', 'st-foot');
    foot.append(this.problems, this.notes, this.message, actions);
    this.root.append(head, this.body, foot);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    for (const type of ['pointerdown', 'keydown', 'input', 'wheel']) this.root.addEventListener(type, () => this.armIdle());
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(current: Settings): void {
    this.draft = JSON.parse(JSON.stringify(current)) as Settings;
    this.message.textContent = '';
    this.render();
    this.root.hidden = false;
    this.body.scrollTop = 0;
    this.armIdle();
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.o.onClose();
  }

  private armIdle(): void {
    window.clearTimeout(this.idleTimer);
    if (!this.root.hidden) this.idleTimer = window.setTimeout(() => this.close(), SettingsPanel.IDLE_MS);
  }

  private save(): void {
    if (validate(this.draft).length > 0) return;
    this.o.onSave(sanitize(this.draft));
    this.close();
  }

  private render(): void {
    this.body.replaceChildren(
      ...this.sections.map((s) => {
        const box = el('section', 'st-section');
        box.append(el('h3', '', s.title), s.render(this.ctx));
        return box;
      }),
    );
    this.refresh();
  }

  private refresh(): void {
    for (const b of this.body.querySelectorAll<HTMLElement>('[data-preset]')) b.classList.toggle('on', b.dataset.preset === this.draft.preset);
    const problems = validate(this.draft);
    this.problems.replaceChildren(...problems.map((p) => el('li', '', p)));
    this.notes.replaceChildren(...warnings(this.draft).map((w) => el('li', '', w)));
    this.saveButton.disabled = problems.length > 0;
  }
}
