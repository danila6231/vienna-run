// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Settings } from '../../../src/core/settings';
import type { ScoreEntry, SyncStatus } from '../../../src/scores/types';
import { leaderboardSection, type LogSource } from '../../../src/ui/staff/leaderboardSection';
import { SettingsPanel } from '../../../src/ui/staff/settingsPanel';

const entry = (id: string, uploaded: boolean): ScoreEntry => ({
  id, at: '2026-10-03T08:00:00.000Z', board: 'booth', score: 42, name: uploaded ? 'Anna' : null, preset: 'normal', lang: 'vi',
  questionsOn: true, device: 'dev', final: true, uploaded,
});

function setup(status: SyncStatus = { mode: 'offline', pending: 1, lastSyncAt: null }) {
  let entries = [entry('a', false), entry('b', true)];
  const source = {
    status: vi.fn(() => status),
    syncNow: vi.fn(async () => undefined),
    log: () => entries,
    remove: vi.fn((id: string) => { entries = entries.filter((e) => e.id !== id); }),
    clearLog: vi.fn(() => { entries = []; }),
    exportCsv: vi.fn(() => 'time,board\r\n'),
  } satisfies LogSource;
  const download = vi.fn<(name: string, text: string) => void>();
  const onSave = vi.fn<(s: Settings) => void>();
  const panel = new SettingsPanel(document.body, { onSave, onClose: vi.fn(), sections: [leaderboardSection(source, download, () => new Date(2026, 9, 3))] });
  panel.open(defaultSettings());
  const click = (name: string) => {
    const b = [...panel.root.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name);
    if (!b) throw new Error(`no button "${name}"`);
    b.click();
  };
  return { panel, root: panel.root, source, download, onSave, click };
}

describe('leaderboard settings', () => {
  it('shows the sync state and syncs on request', async () => {
    const { root, source, click } = setup();
    expect(root.textContent).toContain('Offline · 1 waiting to upload');
    click('Sync now');
    await Promise.resolve();
    expect(source.syncNow).toHaveBeenCalledTimes(1);
  });
  it('explains the USB copy and disables syncing there', () => {
    const { root } = setup({ mode: 'local-only', pending: 2, lastSyncAt: null });
    expect(root.textContent).toContain('Not connected to Supabase');
    expect([...root.querySelectorAll('button')].find((b) => b.textContent === 'Sync now')!.disabled).toBe(true);
  });
  it('starts a fresh board after a confirm, saved with the settings', () => {
    const { root, click, onSave } = setup();
    click('Clear leaderboard');
    expect(root.textContent).toContain('booth-2');
    click('Start new board');
    click('Save');
    expect(onSave.mock.calls[0][0].leaderboard).toEqual({ enabled: true, board: 'booth-2' });
  });
  it('switches the leaderboard off', () => {
    const { click, onSave } = setup();
    click('Leaderboard');
    click('Save');
    expect(onSave.mock.calls[0][0].leaderboard.enabled).toBe(false);
  });
  it('refuses a board name with capitals or spaces', () => {
    const { root } = setup();
    const f = root.querySelector<HTMLInputElement>('[aria-label="Board name"]')!;
    f.value = 'Booth 1';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...root.querySelectorAll('button')].find((b) => b.textContent === 'Save')!.disabled).toBe(true);
  });
  it('lists the log with upload state, deletes a round, clears after a confirm, and exports CSV', () => {
    const { root, source, download, click } = setup();
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(2);
    expect(root.textContent).toContain('waiting');
    expect(root.textContent).toContain('uploaded');
    click('Delete round a');
    expect(source.remove).toHaveBeenCalledWith('a');
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(1);
    click('Export CSV');
    expect(download).toHaveBeenCalledWith('vienna-run-scores-2026-10-03.csv', 'time,board\r\n');
    click('Clear log');
    expect(source.clearLog).not.toHaveBeenCalled();
    click('Delete all');
    expect(source.clearLog).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(0);
  });
});
