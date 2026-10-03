import type { GameConfig } from '../config';

export type Screen = 'attract' | 'howto' | 'countdown' | 'run' | 'question' | 'feedback' | 'finish' | 'results';

export interface FlowHooks {
  enter(screen: Screen, prev: Screen): void;
  answered(correct: boolean): void;
}

/**
 * The booth's screen sequence. Every screen except 'run' ends on its own clock, and the run always reaches
 * its finish line, so a player who walks away can never leave the booth stuck.
 */
export class Flow {
  screen: Screen = 'attract';
  elapsed = 0;

  constructor(private cfg: GameConfig, private readonly hooks: FlowHooks) {}

  /** New timings from the settings menu (the game only calls this on the start screen). */
  setConfig(cfg: GameConfig): void {
    this.cfg = cfg;
  }

  start(): void {
    this.elapsed = 0;
    this.hooks.enter('attract', 'attract');
  }

  update(dt: number): void {
    this.elapsed += dt;
    const f = this.cfg.flow, e = this.elapsed;
    switch (this.screen) {
      case 'howto':
        if (e >= f.howtoSeconds) this.go('countdown');
        break;
      case 'countdown':
        if (e >= f.countdownSeconds) this.go('run');
        break;
      case 'question':
        if (e >= this.cfg.questions.timeLimit) this.answer(false);
        break;
      case 'feedback':
        if (e >= this.cfg.questions.feedbackSeconds) this.go('run');
        break;
      case 'finish':
        if (e >= f.finishSeconds) this.go('results');
        break;
      case 'results':
        if (e >= f.resultsFallbackSeconds) this.go('attract');
        break;
      default:
        break;
    }
  }

  press(): void {
    if (this.screen === 'attract') this.go('howto');
  }

  questionAsked(): void {
    if (this.screen === 'run') this.go('question');
  }

  answer(correct: boolean): void {
    if (this.screen !== 'question') return;
    this.hooks.answered(correct);
    this.go('feedback');
  }

  runFinished(): void {
    if (this.screen === 'run') this.go('finish');
  }

  nextPlayer(): void {
    if (this.screen === 'results') this.go('attract');
  }

  /** Keeps the results screen from timing out (someone is typing a name). */
  holdResults(): void {
    if (this.screen === 'results') this.elapsed = 0;
  }

  get questionRemaining(): number {
    return this.screen === 'question' ? Math.max(0, this.cfg.questions.timeLimit - this.elapsed) : 0;
  }

  private go(next: Screen): void {
    const prev = this.screen;
    this.screen = next;
    this.elapsed = 0;
    this.hooks.enter(next, prev);
  }
}
