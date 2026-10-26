// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/** Normal difficulty: the panel tests below start from it, not from the booth defaults. */
function normal(): Settings {
  return applyPreset(defaultSettings(), 'normal');
}

function setup(current: Settings = normal(), sections?: Section[]) {
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
    const treats = field(root, 'Rewards per round');
    type(treats, '500');
    expect(treats.value).toBe('80');
    click(root, 'Rewards per round up');
    expect(treats.value).toBe('80');
  });
  it('refuses to save settings that cannot work, and says why', () => {
    const { root, onSave } = setup();
    type(field(root, 'Settings PIN'), '12');
    expect(buttonNamed(root, 'Save').disabled).toBe(true);
    expect(root.textContent).toContain('The PIN must be exactly 4 digits.');
    buttonNamed(root, 'Save').click();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('warns, without blocking Save, when the counts cannot fit the round', () => {
    const { root } = setup();
    type(field(root, 'Rewards per round'), '80');
    type(field(root, 'Obstacles per round'), '40');
    expect(root.querySelector('.st-warnings')?.textContent).toMatch(/rewards fit/);
    expect(buttonNamed(root, 'Save').disabled).toBe(false);
    type(field(root, 'Rewards per round'), '31');
    type(field(root, 'Obstacles per round'), '11');
    expect(root.querySelector('.st-warnings')?.textContent).toBe('');
  });
  it('changes the layout seed', () => {
    const { root, onSave } = setup();
    click(root, 'Layout seed up');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0]).toMatchObject({ seed: 2, preset: 'normal' });
  });
  it('switches questions off', () => {
    const { root, onSave } = setup();
    click(root, 'Questions');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].questions.enabled).toBe(false);
  });
  it('sets the points for each question level', () => {
    const { root, onSave } = setup();
    expect(field(root, 'Level 1 points').value).toBe('15');
    expect(field(root, 'Level 2 points').value).toBe('20');
    type(field(root, 'Level 1 points'), '18');
    click(root, 'Level 2 points up');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].questions).toMatchObject({ level1Points: 18, level2Points: 21 });
    expect(root.textContent).not.toContain('Questions per round');
  });
  it('mutes the sound', () => {
    const { root, onSave } = setup();
    click(root, 'Sound');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].sound).toBe(false);
  });
  it('switches the street to the paper look', () => {
    const { root, onSave } = setup();
    click(root, 'Paper (lighter)');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].street).toBe('paper');
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
  it('Reset to defaults keeps the PIN, the board name, the street look and the sound switch', () => {
    const { root, onSave } = setup({ ...applyPreset(defaultSettings(), 'hard'), pin: '1357', leaderboard: { enabled: true, board: 'booth-2' }, street: 'paper', sound: false });
    click(root, 'Reset to defaults');
    click(root, 'Save');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom', obstacles: 50, pin: '1357', leaderboard: { enabled: true, board: 'booth-2' }, street: 'paper', sound: false }));
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
  describe('left open by mistake', () => {
    afterEach(() => vi.useRealTimers());

    it('closes by itself after a few idle minutes, without saving', () => {
      vi.useFakeTimers();
      const { root, onSave, onClose } = setup();
      click(root, 'Hard');
      vi.advanceTimersByTime(SettingsPanel.IDLE_MS - 1_000);
      expect(root.hidden).toBe(false);
      root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(SettingsPanel.IDLE_MS - 1_000);
      expect(root.hidden).toBe(false);
      vi.advanceTimersByTime(2_000);
      expect(root.hidden).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
    });
    it('does not show the PIN in plain text', () => {
      const { root } = setup();
      expect(field(root, 'Settings PIN').type).toBe('password');
    });
  });
});
