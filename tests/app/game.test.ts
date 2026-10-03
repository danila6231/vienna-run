import { describe, expect, it, vi } from 'vitest';
import { Game, type GameUi, type GameWorld } from '../../src/app/game';
import { CONFIG } from '../../src/config';
import { applyPreset, buildConfig, defaultSettings } from '../../src/core/settings';
import { validateBank } from '../../src/core/questions';
import type { Question } from '../../src/core/types';
import bankJson from '../../src/data/questions.json';
import { I18n } from '../../src/i18n/i18n';
import type { ResultsInfo } from '../../src/ui/results';

const bank = validateBank(bankJson);

function fakes() {
  const world: GameWorld = { reset: vi.fn(), render: vi.fn(), shake: vi.fn(), playerScreen: () => ({ x: 0.5, y: 0.6 }) };
  const ui = {
    hud: { show: vi.fn(), update: vi.fn() },
    fx: { popup: vi.fn(), flash: vi.fn(), banner: vi.fn(), confetti: vi.fn(), clear: vi.fn() },
    attract: { show: vi.fn(), hide: vi.fn(), configure: vi.fn() },
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
  it('asks no questions and drops the bonus line when questions are off', () => {
    const { world, ui } = fakes();
    const cfg = buildConfig({ ...defaultSettings(), questions: { enabled: false, perRun: 3, timeLimit: 10 } });
    const game = new Game({ cfg, bank, world, ui, seed: 3, autoplay: true });
    clock(game).run(120);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(ui.question.show).not.toHaveBeenCalled();
    expect(ui.howto.showHowto).toHaveBeenCalledWith(false);
  });

  it('restarts the start-screen demo with new settings at once', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    const hard = buildConfig(applyPreset(defaultSettings(), 'hard'));
    const features = { showGifts: true, leaderboard: false };
    game.configure(hard, features);
    expect(game.run.cfg).toBe(hard);
    expect(game.config).toBe(hard);
    expect(ui.attract.configure).toHaveBeenLastCalledWith(hard, features);
  });

  it('never changes the rules of a round in progress', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    const hard = buildConfig(applyPreset(defaultSettings(), 'hard'));
    game.press();
    clock(game).run(10);
    expect(['run', 'question', 'feedback']).toContain(game.flow.screen);
    game.configure(hard, { showGifts: false, leaderboard: false });
    expect(game.run.cfg).toBe(CONFIG);
    clock(game).run(200);
    expect(game.flow.screen).toBe('attract');
    expect(game.run.cfg).toBe(hard);
  });

  it('passes the gift ladder to the results only when gifts are switched on', () => {
    const off = fakes();
    const gameOff = new Game({ cfg: CONFIG, bank, world: off.world, ui: off.ui, seed: 3, autoplay: true });
    clock(gameOff).run(120);
    const infoOff = (off.ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo;
    expect(infoOff.gift).toBeNull();

    const on = fakes();
    const gameOn = new Game({ cfg: CONFIG, bank, world: on.world, ui: on.ui, seed: 3, autoplay: true, features: { showGifts: true, leaderboard: false }, giftUrl: (t) => `gift-${t}.png` });
    clock(gameOn).run(120);
    const infoOn = (on.ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo;
    expect(infoOn.gift?.tiers).toBe(CONFIG.tiers);
    expect(infoOn.gift?.url).toBe(`gift-${infoOn.gift?.index}.png`);
    expect(infoOn.score).toBeGreaterThanOrEqual(0);
  });
  it('goes back to Vietnamese after every round', () => {
    const { world, ui } = fakes();
    const i18n = new I18n('vi');
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true, i18n });
    i18n.set('en');
    clock(game).run(120);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(i18n.lang).toBe('vi');
  });

  it('writes its popups and the finish banner in the current language', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true, i18n: new I18n('vi') });
    clock(game).run(80);
    expect(ui.fx.banner).toHaveBeenCalledWith('Về đích!', expect.stringMatching(/^\d+ điểm$/), CONFIG.flow.finishSeconds);
  });
});
