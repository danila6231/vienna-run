import type { GameConfig } from '../config';
import { Bot, BOT_SKILLS } from '../core/bot';
import { pickQuestions, updateRecent } from '../core/questions';
import { createRng, randomSeed } from '../core/rng';
import { Run } from '../core/run';
import { layoutSeed, questionRows } from '../core/spawner';
import { tierIndex } from '../core/scoring';
import type { Features } from '../core/settings';
import type { Lang, Question, QuestionLevel, RunEvent } from '../core/types';
import { I18n } from '../i18n/i18n';
import { formatPoints } from '../ui/labels';
import type { GiftInfo, ResultsInfo } from '../ui/results';
import { audio } from './audio';
import { Flow, type Screen } from './flow';

type At = { x: number; y: number };

export interface GameWorld {
  reset(): void;
  render(run: Run, frameDt: number): void;
  shake(): void;
  playerScreen(): At;
}

export interface GameUi {
  hud: { show(on: boolean): void; update(score: number, progress: number): void };
  fx: {
    popup(text: string, kind: 'plus' | 'minus' | 'neutral', at: At): void;
    flash(): void;
    banner(title: string, sub: string, seconds: number): void;
    confetti(): void;
    clear(): void;
  };
  attract: { show(): void; hide(): void; configure(cfg: GameConfig, features: Features): void };
  /** `questionPoints` is null when questions are off. */
  howto: { showHowto(questionPoints: Record<QuestionLevel, number> | null): void; showCount(n: number): void; hide(): void };
  question: {
    /** `n` of `total`: which ❓ row this is; `points` for a right answer. */
    show(q: Question, info: { n: number; total: number; points: number }, onPick: (index: number) => void): void;
    tick(fraction: number, secondsLeft: number): void;
    reveal(correct: number, picked: number | null): void;
    hide(): void;
  };
  results: { show(info: ResultsInfo, onDone: () => void): void; hide(): void };
}

export interface RecentStore {
  read(): string[][];
  write(history: string[][]): void;
}

/** What the game records about a finished round (the difficulty preset is added by the caller). */
export interface RoundRecord {
  score: number;
  lang: Lang;
  questionsOn: boolean;
}

export interface RoundLog {
  addRound(r: RoundRecord): string;
  /** The results screen closed: the round can be uploaded. */
  finalize(id: string): void;
}

export interface GameOptions {
  cfg: GameConfig;
  bank: readonly Question[];
  world: GameWorld;
  ui: GameUi;
  /** The booth language; reset to Vietnamese after every round. */
  i18n?: I18n;
  /** What the screens show (gift ladder, leaderboard); both off unless given. */
  features?: Features;
  /** Designer gift card image for a tier, if there is one. */
  giftUrl?: (tier: number) => string | null;
  seed?: number;
  /** The bot plays whole rounds: presses start, answers, and dismisses results by itself. */
  autoplay?: boolean;
  recent?: RecentStore;
  /** Where finished rounds are logged; left out in autoplay so test rounds never reach the leaderboard. */
  scores?: RoundLog;
  /** Called every time the attract screen opens, with the number of finished rounds. */
  onAttract?: (cycles: number) => void;
}

/** Connects the run, the screen flow, the 3D world and the DOM screens. */
export class Game {
  readonly flow: Flow;
  run: Run;
  cycles = 0;
  private cfg: GameConfig;
  private features: Features;
  /** Settings saved while a round was running; applied when the booth is back on the start screen. */
  private next: { cfg: GameConfig; features: Features } | null = null;
  private readonly i18n: I18n;
  private seed: number;
  private demoBot: Bot | null = null;
  private playerBot: Bot | null = null;
  /** This round's question for each ❓ row, picked at random when the round starts. */
  private questions: Partial<Record<QuestionLevel, Question>> = {};
  private asked: string[] = [];
  private current: Question | null = null;
  private picked: number | null = null;
  private goTimer = 0;
  private autoTimer = 0;
  private entryId: string | null = null;

  constructor(private readonly o: GameOptions) {
    this.i18n = o.i18n ?? new I18n('vi');
    this.cfg = o.cfg;
    this.features = o.features ?? { showGifts: false, leaderboard: false };
    this.seed = o.seed ?? randomSeed();
    o.ui.attract.configure(this.cfg, this.features);
    this.run = this.newRun();
    this.flow = new Flow(this.cfg, { enter: (s, prev) => this.enter(s, prev), answered: (c) => this.answered(c) });
    this.flow.start();
  }

  /** The rules in use right now. */
  get config(): GameConfig {
    return this.cfg;
  }

  /**
   * New settings from the staff menu. On the start screen they apply at once (the demo restarts with them);
   * otherwise when the booth next reaches the start screen. A round in progress never changes.
   */
  configure(cfg: GameConfig, features: Features): void {
    this.next = { cfg, features };
    if (this.flow.screen === 'attract') {
      this.applyNext();
      this.startDemo();
    }
  }

  /** One fixed simulation step. */
  update(dt: number): void {
    const { ui } = this.o;
    const cfg = this.cfg;
    this.flow.update(dt);
    switch (this.flow.screen) {
      case 'attract':
        this.updateDemo(dt);
        break;
      case 'countdown':
        ui.howto.showCount(Math.ceil(cfg.flow.countdownSeconds - this.flow.elapsed));
        break;
      case 'run':
        if (this.goTimer > 0) {
          this.goTimer -= dt;
          if (this.goTimer <= 0) ui.howto.hide();
        }
        this.playerBot?.step(this.run, dt);
        for (const e of this.run.update(dt)) this.onRunEvent(e);
        break;
      case 'question': {
        const left = this.flow.questionRemaining;
        ui.question.tick(left / cfg.questions.timeLimit, left);
        if (this.o.autoplay && this.flow.elapsed > 1 && this.current) {
          const correct = this.playerBot?.answer() ?? true;
          this.picked = correct ? this.current.answer : (this.current.answer + 1) % 3;
          this.flow.answer(correct);
        }
        break;
      }
      case 'finish':
        this.run.update(dt); // coast to a stop under the banner
        break;
      case 'results':
        if (this.o.autoplay && this.flow.elapsed > 2) this.flow.nextPlayer();
        break;
      default:
        break;
    }
    ui.hud.update(this.run.score, this.run.progress);
  }

  render(frameDt: number): void {
    const frozen = this.flow.screen === 'question' || this.flow.screen === 'feedback';
    this.o.world.render(this.run, frozen ? 0 : frameDt);
  }

  /** Lane input from touch or keys; only the player's own run listens. */
  lane(dir: -1 | 1): void {
    if (this.flow.screen === 'run' && !this.o.autoplay) this.run.move(dir);
  }

  /** Any press on the game surface; only the attract screen reacts (it starts a game). */
  press(): void {
    if (!this.o.autoplay) this.flow.press();
  }

  private applyNext(): void {
    if (!this.next) return;
    this.cfg = this.next.cfg;
    this.features = this.next.features;
    this.next = null;
    this.flow.setConfig(this.cfg);
    this.o.ui.attract.configure(this.cfg, this.features);
  }

  private newRun(): Run {
    // "Same for everyone": the street comes from the settings alone; the round seed still moves on for the bots and questions.
    const seed = this.seed++;
    const run = new Run({ seed: this.cfg.spawn.mode === 'fixed' ? layoutSeed(this.cfg) : seed, config: this.cfg });
    this.o.world.reset();
    return run;
  }

  private startDemo(): void {
    this.run = this.newRun();
    this.demoBot = new Bot(createRng(this.seed * 3 + 11), BOT_SKILLS.skilled);
    this.playerBot = null;
  }

  private updateDemo(dt: number): void {
    this.demoBot?.step(this.run, dt);
    for (const e of this.run.update(dt)) if (e.kind === 'question') this.run.answer(true);
    if (this.run.finished && this.run.speed < 1) this.startDemo();
    if (this.o.autoplay) {
      this.autoTimer += dt;
      if (this.autoTimer > 1) {
        this.autoTimer = 0;
        this.flow.press();
      }
    }
  }

  private enter(s: Screen, prev: Screen): void {
    const { ui } = this.o;
    const cfg = this.cfg;
    switch (s) {
      case 'attract':
        ui.results.hide();
        ui.question.hide();
        ui.howto.hide();
        ui.hud.show(false);
        ui.fx.clear();
        this.applyNext();
        this.autoTimer = 0;
        this.startDemo();
        ui.attract.show();
        if (prev === 'results') {
          this.cycles++;
          if (this.entryId) this.o.scores?.finalize(this.entryId);
          this.entryId = null;
          this.i18n.set('vi');
        }
        this.o.onAttract?.(this.cycles);
        break;
      case 'howto':
        ui.attract.hide();
        ui.fx.clear();
        this.demoBot = null;
        this.run = this.newRun();
        this.playerBot = this.o.autoplay ? new Bot(createRng(this.seed * 7 + 1), BOT_SKILLS.average) : null;
        {
          const rng = createRng(this.seed * 13 + 5);
          const recent = (this.o.recent?.read() ?? []).flat();
          const pick = (level: QuestionLevel) => pickQuestions(rng, this.o.bank.filter((q) => q.level === level), 1, recent)[0];
          this.questions = { 1: pick(1), 2: pick(2) };
        }
        this.asked = [];
        ui.howto.showHowto(cfg.questions.enabled ? cfg.questions.points : null);
        ui.hud.update(0, 0);
        ui.hud.show(true);
        break;
      case 'countdown':
        ui.howto.showCount(Math.ceil(cfg.flow.countdownSeconds));
        break;
      case 'run':
        if (prev === 'countdown') {
          ui.howto.showCount(0);
          this.goTimer = 0.7;
        } else {
          ui.question.hide();
          ui.fx.popup(this.i18n.t('fx.go'), 'neutral', this.o.world.playerScreen());
        }
        break;
      case 'question': {
        const item = this.run.pending;
        const level = item?.level ?? 1;
        this.current = this.questions[level] ?? null;
        this.picked = null;
        if (!this.current || !item) {
          this.flow.answer(true);
          break;
        }
        this.asked.push(this.current.id);
        audio.play('question');
        const q = this.current;
        ui.question.show(q, { n: level, total: questionRows(cfg).length, points: cfg.questions.points[level] }, (i) => {
          this.picked = i;
          this.flow.answer(i === q.answer);
        });
        break;
      }
      case 'feedback':
        if (this.current) ui.question.reveal(this.current.answer, this.picked);
        break;
      case 'finish':
        this.entryId = this.o.scores?.addRound({ score: this.run.score, lang: this.i18n.lang, questionsOn: cfg.questions.enabled }) ?? null;
        audio.play('finish');
        ui.fx.banner(this.i18n.t('finish.title'), this.i18n.t('finish.points', { score: this.run.score }), cfg.flow.finishSeconds);
        ui.fx.confetti();
        if (this.o.recent) {
          this.o.recent.write(updateRecent(this.o.recent.read(), this.asked, cfg.questions.recentRuns));
        }
        break;
      case 'results': {
        ui.hud.show(false);
        const score = this.run.score;
        let gift: GiftInfo | null = null;
        if (this.features.showGifts) {
          const index = tierIndex(score, cfg.tiers);
          gift = { tiers: cfg.tiers, index, url: this.o.giftUrl?.(index) ?? null };
        }
        ui.results.show({ score, gift, entryId: this.features.leaderboard ? this.entryId : null }, () => this.flow.nextPlayer());
        break;
      }
    }
  }

  private answered(correct: boolean): void {
    for (const e of this.run.answer(correct)) {
      if (e.kind !== 'answer') continue;
      this.o.ui.fx.popup(e.points > 0 ? formatPoints(e.points) : this.i18n.t('fx.noPoints'), e.points > 0 ? 'plus' : 'neutral', this.o.world.playerScreen());
    }
  }

  private onRunEvent(e: RunEvent): void {
    const { ui, world } = this.o;
    switch (e.kind) {
      case 'collect':
        audio.play('collect');
        ui.fx.popup(formatPoints(e.points), 'plus', world.playerScreen());
        break;
      case 'hit':
        audio.play('hit');
        ui.fx.popup(formatPoints(e.points), 'minus', world.playerScreen());
        ui.fx.flash();
        world.shake();
        break;
      case 'question':
        this.flow.questionAsked();
        break;
      case 'finish':
        this.flow.runFinished();
        break;
      default:
        break;
    }
  }
}
