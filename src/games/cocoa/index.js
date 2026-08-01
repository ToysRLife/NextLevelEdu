import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider } from "@core/controls";
import { drawLineGraph } from "@core/graph";
// Heat transfer (MS-PS3-3/4): hot things cool toward room temperature, and
// insulation slows that heat flow. Thicker insulation = smaller cooling rate, so
// the cocoa stays warmer for longer. Add enough insulation to keep it above the
// target temperature at the check time. Newton's law of cooling models it.
const W = 800;
const H = 600;
const T0 = 90; // starting temp °C
const ENV = 20; // room temp °C
const ROUNDS = [
    { target: 55, checkMin: 10 },
    { target: 50, checkMin: 15 },
    { target: 45, checkMin: 20 },
];
// cooling rate per minute as a function of insulation (0..10): more insulation ⇒ slower.
const coolingK = (insul) => 0.12 / (1 + insul * 0.45);
const tempAt = (insul, min) => ENV + (T0 - ENV) * Math.exp(-coolingK(insul) * min);
class Cocoa {
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
        Object.defineProperty(this, "loop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "insul", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "misses", {
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
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "t", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // minutes elapsed in the sim
        Object.defineProperty(this, "points", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "acc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "insulCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "predRead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
        Object.defineProperty(this, "goBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.buildPanel();
        ctx.services.hints.setHints([
            "Heat always flows from hot to cold — your cocoa cools toward room temperature.",
            "Insulation slows heat transfer. More insulation means a gentler cooling curve, so it stays warm longer.",
            "Add enough insulation that the predicted temperature at the check time is still above the target.",
        ]);
        this.loop.start();
        this.render();
    }
    round() {
        return ROUNDS[this.idx];
    }
    buildPanel() {
        this.insulCtl = slider({
            label: "🧥 Insulation",
            min: 0,
            max: 10,
            value: this.insul,
            step: 1,
            unit: "cm",
            color: "var(--accent-orange)",
            onInput: (v) => {
                this.insul = v;
                this.updateReadout();
                this.render();
            },
        });
        this.predRead = readout(`🌡️ Temp at ${this.round().checkMin} min`);
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Add insulation so it stays warm enough, then start the timer.";
        this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.run() }, "⏱️ Start cooling");
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Keep above"), el("span", {}, `${this.round().target}°C at ${this.round().checkMin} min`)), this.insulCtl.el, this.predRead.el, this.goBtn, el("div", { class: "metric" }, el("span", {}, "✅ Mugs saved"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const r = this.round();
        const t = tempAt(this.insul, r.checkMin);
        this.predRead.set(`${t.toFixed(0)}°C ${t >= r.target ? "✓" : "(too cold)"}`);
    }
    run() {
        if (this.ended || this.running)
            return;
        this.running = true;
        this.t = 0;
        this.points = [[0, T0]];
        this.acc = 0;
        this.insulCtl.setEnabled(false);
        this.goBtn.disabled = true;
        this.ctx.services.audio.play("click");
    }
    tick(dtMs) {
        if (this.ended)
            return;
        if (this.running) {
            this.acc += dtMs;
            let steps = 0;
            while (this.running && this.acc >= 16.67 && steps < 30) {
                this.t += 0.12; // minutes per step (fast-forward)
                this.points.push([this.t, tempAt(this.insul, this.t)]);
                if (this.t >= this.round().checkMin)
                    this.evaluate();
                this.acc -= 16.67;
                steps++;
            }
        }
        this.render();
    }
    evaluate() {
        this.running = false;
        this.insulCtl.setEnabled(true);
        this.goBtn.disabled = false;
        const r = this.round();
        const temp = tempAt(this.insul, r.checkMin);
        if (temp >= r.target) {
            this.hits += 1;
            this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
            this.ctx.services.audio.play("reward");
            if (this.hits >= ROUNDS.length)
                this.finish();
            else {
                this.idx += 1;
                this.coachEl.textContent = `☕ Still warm — ${temp.toFixed(0)}°C! Next mug needs to last longer.`;
                this.buildPanel();
            }
        }
        else {
            this.misses += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `🥶 Too cold — ${temp.toFixed(0)}°C, below ${r.target}°C. Add more insulation to slow the heat loss.`;
        }
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
        this.ctx.services.score.event("cocoa_done", { misses: this.misses });
        this.ctx.services.outcome.succeed({
            message: "Toasty! Heat flows from hot to cold, and insulation slows that flow — more insulation means a gentler cooling curve, so the cocoa stays warm longer.",
            stars,
            resources: { Oxygen: 60 },
        });
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#fffbeb";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#9a3412";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All mugs kept warm! ☕", W / 2, H / 2);
            return;
        }
        const r = this.round();
        // mug
        const mugX = 150;
        const temp = this.running ? tempAt(this.insul, this.t) : T0;
        c.fillStyle = "#fff";
        c.fillRect(mugX - 50, 200, 100, 130);
        c.strokeStyle = "#92400e";
        c.lineWidth = 4;
        c.strokeRect(mugX - 50, 200, 100, 130);
        // cocoa fill colored by temperature (hot=red, cold=blue)
        const warmth = Math.max(0, Math.min(1, (temp - ENV) / (T0 - ENV)));
        c.fillStyle = `hsl(${20 + (1 - warmth) * 200}, 70%, 50%)`;
        c.fillRect(mugX - 44, 210, 88, 112);
        // insulation sleeve
        c.fillStyle = "rgba(180,83,9,0.35)";
        c.fillRect(mugX - 50 - this.insul * 2, 200, this.insul * 2, 130);
        c.fillRect(mugX + 50, 200, this.insul * 2, 130);
        c.fillStyle = "#7c2d12";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`${temp.toFixed(0)}°C`, mugX, 270);
        c.font = "13px Nunito, sans-serif";
        c.fillText("🍫 cocoa", mugX, 352);
        // cooling-curve graph
        drawLineGraph(c, 360, 110, 410, 300, {
            points: this.points,
            xMax: r.checkMin,
            yMax: 100,
            color: "#ef4444",
            title: "Temperature vs time",
            xLabel: "minutes",
            yLabel: "°C",
            band: { lo: r.target, hi: 100 }, // stay in the green band
        });
        c.fillStyle = "#9a3412";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Insulate the cocoa so it's still warm at the check time ☕", W / 2, 50);
    }
    start() {
        if (!this.ended)
            this.loop.start();
    }
    pause() {
        this.loop.stop();
    }
    resume() {
        if (!this.ended)
            this.loop.start();
    }
    reset() {
        this.loop.stop();
        this.ended = false;
        this.running = false;
        this.insul = 0;
        this.idx = 0;
        this.hits = 0;
        this.misses = 0;
        this.t = 0;
        this.points = [];
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const cocoaGame = {
    meta: {
        id: "cocoa",
        conceptId: "phys-29",
        title: "Keep the Cocoa Hot",
        stream: "physics",
        gradeBand: "6-8",
        emoji: "☕",
        blurb: "Add insulation to slow heat loss and keep the cocoa above the target temperature.",
        mission: "Use insulation to keep each mug warm enough at the check time.",
        estMinutes: 4,
    },
    create: (ctx) => new Cocoa(ctx),
};
