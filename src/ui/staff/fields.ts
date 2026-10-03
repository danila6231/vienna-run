import { el } from '../dom';

export function button(label: string, onClick: () => void, cls = 'st-btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** One settings line: the name on the left, its controls on the right. */
export function row(label: string, ...controls: HTMLElement[]): HTMLElement {
  const r = el('div', 'st-row');
  const box = el('div', 'st-controls');
  box.append(...controls);
  r.append(el('span', 'st-label', label), box);
  return r;
}

export function note(text: string): HTMLElement {
  return el('p', 'st-note', text);
}

/** A whole-number field with − and + buttons for touch. Typed values are clamped into range when the field is left. */
export function numberField(label: string, value: number, range: readonly [number, number], onChange: (v: number) => void, unit = ''): HTMLElement {
  const input = el('input', 'st-num');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = String(range[0]);
  input.max = String(range[1]);
  input.step = '1';
  input.value = String(value);
  input.setAttribute('aria-label', label);
  const commit = (v: number) => {
    const c = Math.min(range[1], Math.max(range[0], Math.round(Number.isFinite(v) ? v : range[0])));
    input.value = String(c);
    onChange(c);
  };
  input.addEventListener('input', () => {
    const v = Number(input.value);
    if (input.value.trim() !== '' && Number.isInteger(v) && v >= range[0] && v <= range[1]) onChange(v);
  });
  input.addEventListener('change', () => commit(Number(input.value)));
  const down = button('−', () => commit(Number(input.value) - 1), 'st-step');
  down.setAttribute('aria-label', `${label} down`);
  const up = button('+', () => commit(Number(input.value) + 1), 'st-step');
  up.setAttribute('aria-label', `${label} up`);
  return row(label, down, input, up, el('span', 'st-unit', unit));
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const b = el('button', 'st-toggle');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  let on = value;
  const paint = () => {
    b.textContent = on ? 'On' : 'Off';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
  };
  paint();
  b.addEventListener('click', () => {
    on = !on;
    paint();
    onChange(on);
  });
  return row(label, b);
}

export function choice<T extends string>(label: string, options: ReadonlyArray<{ value: T; label: string }>, value: T, onChange: (v: T) => void): HTMLElement {
  const box = el('div', 'st-choice');
  const buttons: HTMLButtonElement[] = [];
  for (const o of options) {
    const b = button(o.label, () => {
      for (const x of buttons) x.classList.toggle('on', x === b);
      onChange(o.value);
    });
    b.classList.toggle('on', o.value === value);
    buttons.push(b);
  }
  box.append(...buttons);
  return row(label, box);
}

export function textField(label: string, value: string, opts: { maxLength: number; inputMode?: string; secret?: boolean }, onChange: (v: string) => void): HTMLElement {
  const input = el('input', 'st-text');
  input.type = opts.secret ? 'password' : 'text';
  input.value = value;
  input.maxLength = opts.maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (opts.inputMode) input.inputMode = opts.inputMode;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => onChange(input.value));
  return row(label, input);
}
