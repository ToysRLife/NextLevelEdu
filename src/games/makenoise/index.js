import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
class MakeNoise {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ctx
        });
        Object.defineProperty(this, "ctx2d", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "detach", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "anim", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "ended", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "things", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "done", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "statusEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "coachEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.spawn();
        this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
        this.buildPanel();
        ctx.services.hints.setHints([
            "Every sound is made by something vibrating — wobbling back and forth very fast.",
            "Tap an object to make it vibrate, and you'll hear it. Hold it still and the sound stops.",
            "Tap each instrument to make it sing — the wobbling is what creates the sound.",
        ]);
        this.renderLoop();
    }
    spawn() {
        // A friendly pentatonic scale (C–D–E–G–A) so any combination sounds nice,
        // each with its own tone colour so the instruments feel distinct.
        this.things = [
            {
                name: "Drum",
                emoji: "🥁",
                x: 200,
                y: 280,
                vib: 0,
                done: false,
                freq: 131,
                wave: "triangle",
                dur: 220,
            },
            {
                name: "Guitar",
                emoji: "🎸",
                x: 400,
                y: 280,
                vib: 0,
                done: false,
                freq: 294,
                wave: "sawtooth",
                dur: 420,
            },
            {
                name: "Bell",
                emoji: "🔔",
                x: 600,
                y: 280,
                vib: 0,
                done: false,
                freq: 988,
                wave: "sine",
                dur: 700,
            },
            {
                name: "Cymbal",
                emoji: "🥽",
                x: 300,
                y: 430,
                vib: 0,
                done: false,
                freq: 660,
                wave: "square",
                dur: 300,
            },
            {
                name: "Xylophone",
                emoji: "🎹",
                x: 500,
                y: 430,
                vib: 0,
                done: false,
                freq: 880,
                wave: "triangle",
                dur: 480,
            },
        ];
    }
    buildPanel() {
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${this.things.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Tap each instrument to make it vibrate and sing!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Make them all sing")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap the instruments on screen"), el("div", { class: "metric" }, el("span", {}, "🎵 Singing"), this.statusEl), this.coachEl);
    }
    tap(p) {
        if (this.ended)
            return;
        for (const t of this.things) {
            if (Math.hypot(p.x - t.x, p.y - t.y) < 60) {
                t.vib = 1;
                this.ctx.services.audio.tone(t.freq, t.dur, t.wave);
                if (!t.done) {
                    t.done = true;
                    this.done += 1;
                    this.statusEl.textContent = `${this.done} / ${this.things.length}`;
                    this.coachEl.textContent = `🎵 The ${t.name.toLowerCase()} vibrates — and that makes sound!`;
                    if (this.done >= this.things.length)
                        this.win();
                }
                return;
            }
        }
    }
    win() {
        this.ended = true;
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("makenoise_done", {});
        this.ctx.services.outcome.succeed({
            message: "What a band! Every sound is made by something vibrating fast. No vibration means no sound.",
            stars,
            resources: { Fuel: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.3;
            for (const t of this.things)
                t.vib = Math.max(0, t.vib - 0.02);
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#fff7ed";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#9a3412";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("The whole band is playing! 🎶", W / 2, H / 2);
            return;
        }
        for (const t of this.things) {
            const wob = Math.sin(this.anim) * t.vib * 6;
            // sound waves
            if (t.vib > 0.05) {
                c.strokeStyle = `rgba(249,115,22,${t.vib})`;
                c.lineWidth = 3;
                for (let i = 1; i <= 3; i++) {
                    c.beginPath();
                    c.arc(t.x, t.y, 50 + i * 14 * (1 - t.vib + 0.3), 0, Math.PI * 2);
                    c.stroke();
                }
            }
            c.fillStyle = t.done ? "#fed7aa" : "#fff";
            c.strokeStyle = "#fdba74";
            c.lineWidth = 4;
            c.beginPath();
            c.arc(t.x + wob, t.y, 46, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.font = "48px serif";
            c.textAlign = "center";
            c.fillText(t.emoji, t.x + wob, t.y + 16);
            if (t.done) {
                c.font = "20px serif";
                c.fillText("🎵", t.x + 36, t.y - 36);
            }
        }
        c.fillStyle = "#9a3412";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Tap to make each one vibrate and sing 🎵", W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.done = 0;
        this.spawn();
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const makeNoiseGame = {
    meta: {
        id: "makenoise",
        conceptId: "phys-16",
        title: "Make Some Noise",
        stream: "physics",
        gradeBand: "1-4",
        emoji: "🥁",
        blurb: "Tap the instruments to make them vibrate — and discover that vibration is sound.",
        mission: "Make every instrument sing by getting it to vibrate.",
        estMinutes: 2,
    },
    create: (ctx) => new MakeNoise(ctx),
};
