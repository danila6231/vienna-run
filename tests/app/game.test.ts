import { describe, expect, it, vi } from 'vitest';
import { Game, type GameUi, type GameWorld } from '../../src/app/game';
import { CONFIG } from '../../src/config';
import { validateBank } from '../../src/core/questions';
import type { Question } from '../../src/core/types';
import bankJson from '../../src/data/questions.json';

const bank = validateBank(bankJson);

function fakes() {
  const world: GameWorld = { reset: vi.fn(), render: vi.fn(), shake: vi.fn(), playerScreen: () => ({ x: 0.5, y: 0.6 }) };
  const ui = {
    hud: { show: vi.fn(), update: vi.fn() },
    fx: { popup: vi.fn(), flash: vi.fn(), banner: vi.fn(), confetti: vi.fn(), clear: vi.fn() },
    attract: { show: vi.fn(), hide: vi.fn() },
    howto: { showHowto: vi.fn(), showCount: vi.fn(), hide: vi.fn() },
    question: { show: vi.fn(), tick: vi.fn(), reveal: vi.fn(), hide: vi.fn() },
    results: { show: vi.fn(), hide: vi.fn() },
  } satisfies GameUi;
  return { world, ui };
}

function clock(game: Game) {
  let t = 0;
  return {
    now: () => t,
    run(seconds: number, each?: (step: number) => void) {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        each?.(i);
        game.update(1 / 60);
        t += 1 / 60;
      }
    },
  };
}

describe('Game', () => {
  it('plays complete autoplay rounds back to the attract screen', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true });
    clock(game).run(150);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(ui.results.show).toHaveBeenCalled();
    expect(ui.question.show).toHaveBeenCalled();
  });

  it('returns the booth to attract when a player walks away mid-game', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    game.press();
    clock(game).run(200);
    expect(game.flow.screen).toBe('attract');
    expect(game.cycles).toBe(1);
    expect(ui.question.reveal).toHaveBeenCalledTimes((ui.question.show as ReturnType<typeof vi.fn>).mock.calls.length);
  });

  it('survives frantic tapping: no skipped screens, no early results dismissal', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 9 });
    const c = clock(game);
    const resultsAt: number[] = [];
    const attractAt: number[] = [];
    (ui.results.show as ReturnType<typeof vi.fn>).mockImplementation(() => resultsAt.push(c.now()));
    (ui.attract.show as ReturnType<typeof vi.fn>).mockImplementation(() => attractAt.push(c.now()));
    expect(() =>
      c.run(220, (i) => {
        game.press();
        game.lane(i % 2 ? 1 : -1);
      }),
    ).not.toThrow();
    expect(resultsAt.length).toBeGreaterThanOrEqual(1);
    const backToAttract = attractAt.find((t) => t > resultsAt[0]);
    expect(backToAttract).toBeDefined();
    expect(backToAttract! - resultsAt[0]).toBeGreaterThanOrEqual(CONFIG.flow.resultsFallbackSeconds - 0.1);
  });

  it('keeps recent questions away from the next players', () => {
    const { world, ui } = fakes();
    let history: string[][] = [];
    const recent = { read: () => history, write: (h: string[][]) => { history = h; } };
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 21, autoplay: true, recent });
    clock(game).run(400);
    expect(game.cycles).toBeGreaterThanOrEqual(2);
    const shown = (ui.question.show as ReturnType<typeof vi.fn>).mock.calls.map((call) => (call[0] as Question).id);
    const perRun = CONFIG.questions.perRun;
    const first = new Set(shown.slice(0, perRun));
    const second = shown.slice(perRun, perRun * 2);
    for (const id of second) expect(first.has(id)).toBe(false);
  });
});
