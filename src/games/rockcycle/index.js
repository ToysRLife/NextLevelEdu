import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
// Rock cycle (MS-ESS2-1): rocks change from one type to another through Earth's
// processes — cooling, weathering, compacting, heat & pressure, and melting.
// Apply the right processes to transform a starting rock into the target rock.
const W = 800;
const H = 600;
const PROCESSES = [
    { key: "cool", label: "❄️ Cool & crystallize" },
    { key: "weather", label: "💨 Weather & erode" },
    { key: "compact", label: "🧱 Compact & cement" },
    { key: "metamorph", label: "🔥 Heat & pressure" },
    { key: "melt", label: "🌋 Melt" },
];
// Transition table: rock + process -> next rock (undefined = no change)
const NEXT = {
    Magma: { cool: "Igneous" },
    Igneous: { weather: "Sediment", metamorph: "Metamorphic", melt: "Magma" },
    Sediment: { compact: "Sedimentary" },
    Sedimentary: { metamorph: "Metamorphic", weather: "Sediment", melt: "Magma" },
    Metamorphic: { melt: "Magma", weather: "Sediment" },
};
const ROCK_EMOJI = {
    Magma: "🌋",
    Igneous: "🪨",
    Sediment: "🏖️",
    Sedimentary: "🧱",
    Metamorphic: "💎",
};
const ROUNDS = [
    { start: "Igneous", target: "Sedimentary" },
    { start: "Sedimentary", target: "Magma" },
    { start: "Magma", target: "Metamorphic" },
];
// Shortest number of process steps from start to target (BFS) — used by the
// build-time solvability guard via the exported helper below.
export function shortestPath(start, target) {
    if (start === target)
        return [];
    const queue = [{ rock: start, path: [] }];
    const seen = new Set([start]);
    while (queue.length) {
        const { rock, path } = queue.shift();
        for (const [proc, next] of Object.entries(NEXT[rock])) {
            if (seen.has(next))
                continue;
            const newPath = [...path, proc];
            if (next === target)
                return newPath;
            seen.add(next);
            queue.push({ rock: next, path: newPath });
        }
    }
    return null;
}
class RockCycle {
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
        Object.defineProperty(this, "steps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "current", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Igneous"
        });
        Object.defineProperty(this, "flash", {
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
        Object.defineProperty(this, "stepEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.current = ROUNDS[0].start;
        this.buildPanel();
        ctx.services.hints.setHints([
            "Rocks aren't forever — Earth recycles them. Each process turns one rock type into another.",
            "Cooling magma makes igneous rock. Weathering breaks rock into sediment, which compacts into sedimentary rock.",
            "Heat & pressure make metamorphic rock; melting any rock turns it back into magma. Chain the steps to reach the target.",
        ]);
        this.renderLoop();
    }
    round() {
        return ROUNDS[this.idx];
    }
    buildPanel() {
        const btns = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...PROCESSES.map((p) => el("button", { class: "btn secondary", onclick: () => this.apply(p.key) }, p.label)));
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
        this.stepEl = el("span", {}, `${this.steps}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Apply processes to transform this rock into the target.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target rock"), el("span", {}, `${ROCK_EMOJI[this.round().target]} ${this.round().target}`)), el("div", { class: "metric" }, el("span", {}, "🪨 Current rock"), el("span", {}, `${ROCK_EMOJI[this.current]} ${this.current}`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Apply a process"), btns, el("div", { class: "metric" }, el("span", {}, "🔁 Steps used"), this.stepEl), el("div", { class: "metric" }, el("span", {}, "✅ Rocks made"), this.statusEl), this.coachEl);
    }
    apply(p) {
        if (this.ended)
            return;
        const next = NEXT[this.current][p];
        if (!next) {
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `That process doesn't change ${this.current}. Try another.`;
            return;
        }
        this.current = next;
        this.steps += 1;
        this.flash = 1;
        this.stepEl.textContent = `${this.steps}`;
        this.ctx.services.audio.play("tick");
        if (this.current === this.round().target) {
            this.hits += 1;
            this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
            this.ctx.services.audio.play("reward");
            if (this.hits >= ROUNDS.length)
                this.win();
            else {
                this.idx += 1;
                this.current = this.round().start;
                this.coachEl.textContent = `💎 Made it! Next: turn ${this.current} into ${this.round().target}.`;
                this.buildPanel();
            }
        }
        else {
            this.coachEl.textContent = `Now it's ${this.current}. Keep going toward ${this.round().target}.`;
            // refresh the "current rock" metric
            this.buildPanel();
        }
    }
    win() {
        this.ended = true;
        const stars = this.steps <= 7 ? 3 : this.steps <= 10 ? 2 : 1;
        this.ctx.services.score.event("rockcycle_done", { steps: this.steps });
        this.ctx.services.outcome.succeed({
            message: "Rock recycler! Earth never makes new rock from nothing — it transforms old rock through cooling, weathering, compacting, heat & pressure, and melting. That's the rock cycle.",
            stars,
            resources: { Rock: 60 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.flash > 0)
                this.flash -= 0.04;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#1c1917";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#fbbf24";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Rock cycle mastered! 💎", W / 2, H / 2);
            return;
        }
        // cycle ring of the 5 rock types
        const order = ["Magma", "Igneous", "Sediment", "Sedimentary", "Metamorphic"];
        const cx = W / 2;
        const cy = 310;
        const R = 180;
        c.strokeStyle = "#44403c";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, R, 0, Math.PI * 2);
        c.stroke();
        order.forEach((rock, i) => {
            const a = -Math.PI / 2 + (i / order.length) * Math.PI * 2;
            const x = cx + Math.cos(a) * R;
            const y = cy + Math.sin(a) * R;
            const isCur = rock === this.current;
            c.fillStyle = isCur ? "#f59e0b" : "#292524";
            c.beginPath();
            c.arc(x, y, isCur ? 46 + this.flash * 10 : 40, 0, Math.PI * 2);
            c.fill();
            c.font = "30px serif";
            c.textAlign = "center";
            c.fillText(ROCK_EMOJI[rock], x, y + 4);
            c.fillStyle = isCur ? "#fff7ed" : "#a8a29e";
            c.font = "bold 13px Nunito, sans-serif";
            c.fillText(rock, x, y + 60);
        });
        c.fillStyle = "#fde68a";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`Transform ${this.current} → ${this.round().target}`, W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.hits = 0;
        this.steps = 0;
        this.current = ROUNDS[0].start;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const rockCycleGame = {
    meta: {
        id: "rockcycle",
        conceptId: "ess-29",
        title: "Rock Cycle",
        stream: "earth-space",
        gradeBand: "6-8",
        emoji: "🪨",
        blurb: "Cool, weather, compact, and melt rocks to transform one type into another around the rock cycle.",
        mission: "Apply Earth's processes to turn each starting rock into the target rock.",
        estMinutes: 4,
    },
    create: (ctx) => new RockCycle(ctx),
};
