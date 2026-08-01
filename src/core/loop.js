// A pausable requestAnimationFrame loop. Replaces the hand-rolled tick/pause
// pattern duplicated across the prototype's bioLab.js and physicsLab.js.
export class SimLoop {
    constructor(onTick) {
        Object.defineProperty(this, "onTick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: onTick
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "last", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.last = performance.now();
        const frame = (now) => {
            if (!this.running)
                return;
            const dt = Math.min(now - this.last, 50); // clamp to avoid huge jumps after tab blur
            this.last = now;
            this.onTick(dt);
            this.raf = requestAnimationFrame(frame);
        };
        this.raf = requestAnimationFrame(frame);
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }
    get isRunning() {
        return this.running;
    }
}
