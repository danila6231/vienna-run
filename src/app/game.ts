import type { GameConfig } from '../config';
import { Bot, BOT_SKILLS } from '../core/bot';
import { pickQuestions, updateRecent } from '../core/questions';
import { createRng, randomSeed } from '../core/rng';
import { Run } from '../core/run';
import type { Question, RunEvent } from '../core/types';
import { formatPoints } from '../ui/labels';
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
  attract: { show(): void; hide(): void };
  howto: { showHowto(): void; showCount(n: number): void; hide(): void };
  question: {
    show(q: Question, basePoints: number, onPick: (index: number) => void): void;
    tick(fraction: number, secondsLeft: number): void;
    reveal(correct: number, picked: number | null): void;
    hide(): void;
  };
  results: { show(score: number, onDone: () => void): void; hide(): void };
}

export interface RecentStore {
  read(): string[][];
  write(history: string[][]): void;
}

export interface GameOptions {
  cfg: GameConfig;
  bank: readonly Question[];
  world: GameWorld;
  ui: GameUi;
  seed?: number;
  /** The bot plays whole rounds: presses start, answers, and dismisses results by itself. */
  autoplay?: boolean;
  recent?: RecentStore;
  /** Called every time the attract screen opens, with the number of finished rounds. */
  onAttract?: (cycles: number) => void;
}

/** Connects the run, the screen flow, the 3D world and the DOM screens. */
export class Game {
  readonly flow: Flow;
  run: Run;
  cycles = 0;
  private seed: number;
  private demoBot: Bot | null = null;
  private playerBot: Bot | null = null;
  private questions: Question[] = [];
  private asked = 0;
  private current: Question | null = null;
  private picked: number | null = null;
  private goTimer = 0;
  private autoTimer = 0;

  constructor(private readonly o: GameOptions) {
    this.seed = o.seed ?? randomSeed();
    this.run = this.newRun();
    this.flow = new Flow(o.cfg, { enter: (s, prev) => this.enter(s, prev), answered: (c) => this.answered(c) });
    this.flow.start();
  }

  /** One fixed simulation step. */
  update(dt: number): void {
    const { ui, cfg } = this.o;
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

  private newRun(): Run {
    const run = new Run({ seed: this.seed++, config: this.o.cfg });
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
    const { ui, cfg } = this.o;
    switch (s) {
      case 'attract':
        ui.results.hide();
        ui.question.hide();
        ui.howto.hide();
        ui.hud.show(false);
        ui.fx.clear();
        this.autoTimer = 0;
        this.startDemo();
        ui.attract.show();
        if (prev === 'results') this.cycles++;
        this.o.onAttract?.(this.cycles);
        break;
      case 'howto':
        ui.attract.hide();
        ui.fx.clear();
        this.demoBot = null;
        this.run = this.newRun();
        this.playerBot = this.o.autoplay ? new Bot(createRng(this.seed * 7 + 1), BOT_SKILLS.average) : null;
        this.questions = pickQuestions(createRng(this.seed * 13 + 5), this.o.bank, cfg.questions.perRun, (this.o.recent?.read() ?? []).flat());
        this.asked = 0;
        ui.howto.showHowto();
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
          ui.fx.popup('Go!', 'neutral', this.o.world.playerScreen());
        }
        break;
      case 'question': {
        this.current = this.questions[this.asked] ?? null;
        this.picked = null;
        const item = this.run.pending;
        if (!this.current || !item) {
          this.flow.answer(true);
          break;
        }
        this.asked++;
        audio.play('question');
        const q = this.current;
        ui.question.show(q, cfg.items[item.type].points, (i) => {
          this.picked = i;
          this.flow.answer(i === q.answer);
        });
        break;
      }
      case 'feedback':
        if (this.current) ui.question.reveal(this.current.answer, this.picked);
        break;
      case 'finish':
        audio.play('finish');
        ui.fx.banner('Finish!', `${this.run.score} points`, cfg.flow.finishSeconds);
        ui.fx.confetti();
        if (this.o.recent) {
          const used = this.questions.slice(0, this.asked).map((q) => q.id);
          this.o.recent.write(updateRecent(this.o.recent.read(), used, cfg.questions.recentRuns));
        }
        break;
      case 'results': {
        ui.hud.show(false);
        ui.results.show(this.run.score, () => this.flow.nextPlayer());
        break;
      }
    }
  }

  private answered(correct: boolean): void {
    for (const e of this.run.answer(correct)) {
      if (e.kind !== 'answer') continue;
      this.o.ui.fx.popup(e.points > 0 ? formatPoints(e.points) : 'No points', e.points > 0 ? 'plus' : 'neutral', this.o.world.playerScreen());
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
