// A pausable requestAnimationFrame loop. Replaces the hand-rolled tick/pause
// pattern duplicated across the prototype's bioLab.js and physicsLab.js.

export class SimLoop {
  private running = false;
  private raf = 0;
  private last = 0;

  constructor(private readonly onTick: (dtMs: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(now - this.last, 50); // clamp to avoid huge jumps after tab blur
      this.last = now;
      this.onTick(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
