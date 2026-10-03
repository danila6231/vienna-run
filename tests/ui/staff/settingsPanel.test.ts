// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyPreset, defaultSettings, toShareCode, type Settings } from '../../../src/core/settings';
import { el } from '../../../src/ui/dom';
import { SettingsPanel, type Section } from '../../../src/ui/staff/settingsPanel';

const buttonNamed = (root: ParentNode, name: string) => {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name);
  if (!b) throw new Error(`no button "${name}"`);
  return b;
};
const click = (root: ParentNode, name: string) => buttonNamed(root, name).click();
const field = (root: ParentNode, label: string) => {
  const f = root.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!f) throw new Error(`no field "${label}"`);
  return f;
};
const type = (f: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  f.value = value;
  f.dispatchEvent(new Event('input', { bubbles: true }));
  f.dispatchEvent(new Event('change', { bubbles: true }));
};

function setup(current: Settings = defaultSettings(), sections?: Section[]) {
  const onSave = vi.fn<(s: Settings) => void>();
  const onClose = vi.fn();
  const panel = new SettingsPanel(document.body, { onSave, onClose, sections });
  panel.open(current);
  return { panel, root: panel.root, onSave, onClose };
}

describe('SettingsPanel', () => {
  it('opens on the current settings with the preset marked', () => {
    const { root, panel } = setup();
    expect(panel.isOpen).toBe(true);
    expect(root.querySelector('[data-preset="normal"]')?.classList.contains('on')).toBe(true);
    expect(field(root, 'Obstacles per round').value).toBe('11');
  });
  it('fills every difficulty value from a preset and saves it', () => {
    const { root, onSave, onClose } = setup();
    click(root, 'Hard');
    expect(field(root, 'Obstacles per round').value).toBe('16');
    click(root, 'Save');
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ preset: 'hard', startSpeedKmh: 58, endSpeedKmh: 76, obstacles: 16 }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(root.hidden).toBe(true);
  });
  it('marks the difficulty Custom as soon as one value changes', () => {
    const { root } = setup();
    type(field(root, 'Obstacles per round'), '13');
    expect(root.querySelector('[data-preset="custom"]')?.classList.contains('on')).toBe(true);
    expect(root.querySelector('[data-preset="normal"]')?.classList.contains('on')).toBe(false);
  });
  it('keeps typed numbers inside their range', () => {
    const { root } = setup();
    const treats = field(root, 'Treats per round');
    type(treats, '500');
    expect(treats.value).toBe('80');
    click(root, 'Treats per round up');
    expect(treats.value).toBe('80');
  });
  it('refuses to save settings that cannot work, and says why', () => {
    const { root, onSave } = setup();
    type(field(root, 'Round length'), '20');
    type(field(root, 'Questions per round'), '5');
    expect(buttonNamed(root, 'Save').disabled).toBe(true);
    expect(root.textContent).toContain('5 questions need a round of at least 28 s.');
    buttonNamed(root, 'Save').click();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('switches bonus questions off', () => {
    const { root, onSave } = setup();
    click(root, 'Bonus questions');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].questions.enabled).toBe(false);
  });
  it('edits the gift ladder', () => {
    const { root, onSave } = setup();
    click(root, 'Show gifts to players');
    click(root, 'Add gift tier');
    type(field(root, 'Gift 5 name'), 'Teddy bear');
    type(field(root, 'Gift 5 minimum score'), '200');
    click(root, 'Save');
    const saved = onSave.mock.calls[0][0];
    expect(saved.showGifts).toBe(true);
    expect(saved.tiers.at(-1)).toEqual({ name: 'Teddy bear', min: 200 });
  });
  it('Cancel throws the edits away', () => {
    const { root, onSave, onClose } = setup();
    click(root, 'Hard');
    click(root, 'Cancel');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('Reset to defaults keeps the PIN and the board name', () => {
    const { root, onSave } = setup({ ...applyPreset(defaultSettings(), 'hard'), pin: '1357', leaderboard: { enabled: true, board: 'booth-2' } });
    click(root, 'Reset to defaults');
    click(root, 'Save');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ preset: 'normal', pin: '1357', leaderboard: { enabled: true, board: 'booth-2' } }));
  });
  it('loads a share code, and rejects a bad one without changing anything', () => {
    const { root } = setup();
    type(field(root, 'Share code to load'), 'nonsense');
    click(root, 'Load code');
    expect(root.textContent).toContain('That code is not valid');
    expect(field(root, 'Obstacles per round').value).toBe('11');
    type(field(root, 'Share code to load'), toShareCode({ ...defaultSettings(), obstacles: 25 }));
    click(root, 'Load code');
    expect(field(root, 'Obstacles per round').value).toBe('25');
  });
  it('shows a copyable code for this setup', () => {
    const { root } = setup();
    click(root, 'Copy code');
    expect(field(root, 'Share code for this device').value.startsWith('VR1-')).toBe(true);
  });
  it('shows extra sections', () => {
    const extra: Section = { title: 'Leaderboard', render: () => el('p', '', 'board controls') };
    const { root } = setup(defaultSettings(), [extra]);
    expect(root.textContent).toContain('board controls');
  });
});
