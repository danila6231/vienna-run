/** Turns uneven browser frames into even simulation steps (optionally sped up for tests). */
export class FixedStepper {
  private acc = 0;

  constructor(readonly step = 1 / 60, readonly speed = 1, readonly maxSteps = 5) {}

  /** Runs as many fixed steps as the real time (times speed) allows; returns how many ran. */
  advance(frameSeconds: number, fn: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameSeconds, 0), 0.25) * this.speed;
    const limit = Math.ceil(this.maxSteps * this.speed);
    let n = 0;
    while (this.acc >= this.step - 1e-9 && n < limit) {
      fn(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === limit) this.acc = 0; // drop the backlog after a stall instead of spiralling
    return n;
  }
}

export interface Loop {
  lastFrameAt(): number;
  stop(): void;
}

/** requestAnimationFrame loop: fixed simulation steps, then one render with the real frame time. */
export function startLoop(stepper: FixedStepper, step: (dt: number) => void, render: (realFrameSeconds: number) => void): Loop {
  let last = performance.now(), lastFrame = last, raf = 0, running = true;
  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const sec = Math.max(0, (now - last) / 1000);
    last = now;
    lastFrame = now;
    stepper.advance(sec, step);
    render(sec);
  };
  raf = requestAnimationFrame(frame);
  return {
    lastFrameAt: () => lastFrame,
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
