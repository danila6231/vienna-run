import { nextBoardName } from '../../scores/names';
import type { ScoreEntry, SyncStatus } from '../../scores/types';
import { el } from '../dom';
import { button, note, row, textField, toggle } from './fields';
import type { Section } from './settingsPanel';

export interface LogSource {
  status(): SyncStatus;
  syncNow(): Promise<void>;
  log(): ScoreEntry[];
  remove(id: string): void;
  clearLog(): void;
  exportCsv(): string;
}

const SHOWN_ROWS = 100;
const pad = (n: number) => String(n).padStart(2, '0');
const time = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function statusText(s: SyncStatus): string {
  const waiting = `${s.pending} waiting to upload`;
  const last = s.lastSyncAt ? `last sync ${time(s.lastSyncAt)}` : 'not synced yet';
  switch (s.mode) {
    case 'local-only':
      return 'Not connected to Supabase (USB copy or local build): scores stay on this device.';
    case 'connecting':
      return `Connecting… · ${waiting}`;
    case 'online':
      return `Online · ${waiting} · ${last}`;
    case 'offline':
      return `Offline · ${waiting} · ${last}. Scores upload by themselves when the internet is back.`;
  }
}

/** A button that asks inline before acting (no browser dialogs on a kiosk). */
function confirmAction(label: string, question: () => string, yesLabel: string, onYes: () => void): HTMLElement {
  const box = el('div', 'st-confirm');
  const ask = () => {
    const yes = button(yesLabel, () => {
      box.replaceChildren(start);
      onYes();
    }, 'st-btn danger');
    const no = button('Keep it', () => box.replaceChildren(start));
    box.replaceChildren(el('span', 'st-note', question()), yes, no);
  };
  const start = button(label, ask, 'st-btn danger');
  box.append(start);
  return box;
}

/** Leaderboard switch, board name, sync state and this device's score log. Log actions apply at once (no Save). */
export function leaderboardSection(source: LogSource, download: (filename: string, text: string) => void, now: () => Date = () => new Date()): Section {
  return {
    title: 'Leaderboard and score log',
    render(ctx) {
      const d = ctx.draft;
      const status = el('span', 'st-status', statusText(source.status()));
      const refreshStatus = () => {
        status.textContent = statusText(source.status());
      };
      const sync = button('Sync now', () => {
        sync.disabled = true;
        status.textContent = 'Syncing…';
        void source.syncNow().then(() => {
          refreshStatus();
          sync.disabled = source.status().mode === 'local-only';
        });
      });
      sync.disabled = source.status().mode === 'local-only';

      const logBox = el('div', 'st-log');
      const renderLog = () => {
        const entries = source.log();
        const rows = entries.slice(0, SHOWN_ROWS).map((e) => {
          const line = el('div', 'st-logrow');
          const del = button('Delete', () => {
            source.remove(e.id);
            renderLog();
            refreshStatus();
          }, 'st-btn small');
          del.setAttribute('aria-label', `Delete round ${e.id}`);
          line.append(
            el('span', '', time(e.at)),
            el('b', '', String(e.score)),
            el('span', '', e.name ?? '—'),
            el('span', 'st-unit', `${e.preset} · ${e.lang} · questions ${e.questionsOn ? 'on' : 'off'}`),
            el('span', e.uploaded ? 'st-ok' : 'st-wait', e.uploaded ? '✓ uploaded' : e.final ? '⏳ waiting' : '… on results'),
            del,
          );
          return line;
        });
        const count = entries.length === 0 ? 'No rounds on this device yet.' : `${entries.length} rounds on this device${entries.length > SHOWN_ROWS ? ` (newest ${SHOWN_ROWS} shown)` : ''}.`;
        logBox.replaceChildren(note(count), ...rows);
      };
      renderLog();

      const newBoard = confirmAction(
        'Clear leaderboard',
        () => `Start a new, empty board "${nextBoardName(ctx.draft.leaderboard.board)}"? Old scores stay in the database.`,
        'Start new board',
        () => {
          const next = nextBoardName(ctx.draft.leaderboard.board);
          ctx.edit((x) => { x.leaderboard.board = next; }, true);
          ctx.notice(`New board "${next}" starts when you press Save.`);
        },
      );
      const clear = confirmAction(
        'Clear log',
        () => `Delete all ${source.log().length} rounds from this device? Rounds not uploaded yet are lost.`,
        'Delete all',
        () => {
          source.clearLog();
          renderLog();
          refreshStatus();
        },
      );
      const exportCsv = button('Export CSV', () => download(`vienna-run-scores-${day(now())}.csv`, source.exportCsv()));

      const box = el('div');
      box.append(
        toggle('Leaderboard', d.leaderboard.enabled, (v) => ctx.edit((x) => { x.leaderboard.enabled = v; })),
        textField('Board name', d.leaderboard.board, { maxLength: 24 }, (v) => ctx.edit((x) => { x.leaderboard.board = v; })),
        note('This device shows and uploads scores for this board: "booth" on the booth PC, "test" on team laptops.'),
        row('', newBoard),
        row('Sync', status, sync),
        el('h4', 'st-subhead', 'Score log (this device)'),
        note('These actions happen at once (no Save needed) and only on this device; uploaded scores stay in Supabase.'),
        row('', exportCsv, clear),
        logBox,
      );
      return box;
    },
  };
}
