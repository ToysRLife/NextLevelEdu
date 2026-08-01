import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider } from "@core/controls";
// Star life cycle (MS-ESS1): a star's mass decides its fate. Small stars fade to
// white dwarfs; heavy stars explode as supernovae, leaving neutron stars or
// black holes. Set the star's mass to build a star with the target ending.
const W = 800;
const H = 600;
const fateFor = (mass) => mass < 0.5 ? "Red Dwarf" : mass < 8 ? "White Dwarf" : mass < 20 ? "Neutron Star" : "Black Hole";
const FATE_EMOJI = {
    "Red Dwarf": "🔴",
    "White Dwarf": "⚪",
    "Neutron Star": "✨",
    "Black Hole": "⚫",
};
const ROUNDS = ["White Dwarf", "Black Hole", "Neutron Star"];
class StarLife {
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
        Object.defineProperty(this, "mass", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
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
        Object.defineProperty(this, "evolving", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "prog", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "acc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "massCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fateRead", {
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
            "A star's whole life is decided by one thing: how much mass it starts with.",
            "Low-mass stars gently puff off their layers and leave a white dwarf. Heavy stars explode as a supernova.",
            "The biggest stars collapse into a black hole; medium-heavy ones leave a neutron star.",
        ]);
        this.loop.start();
        this.render();
    }
    target() {
        return ROUNDS[this.idx];
    }
    buildPanel() {
        this.massCtl = slider({
            label: "⭐ Star mass",
            min: 0.1,
            max: 30,
            value: this.mass,
            step: 0.1,
            unit: "☉",
            color: "var(--accent-yellow)",
            onInput: (v) => {
                this.mass = v;
                this.updateReadout();
                this.render();
            },
        });
        this.fateRead = readout("🔭 This star will become");
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#f5f3ff" },
        });
        this.coachEl.textContent =
            "Pick a mass so the star ends as the target — then let it live its life.";
        this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-purple)" }, onclick: () => this.evolve() }, "⏩ Evolve the star");
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target ending"), el("span", {}, `${FATE_EMOJI[this.target()]} ${this.target()}`)), this.massCtl.el, this.fateRead.el, this.goBtn, el("div", { class: "metric" }, el("span", {}, "✅ Stars built"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const f = fateFor(this.mass);
        this.fateRead.set(`${FATE_EMOJI[f]} ${f}${f === this.target() ? " ✓" : ""}`);
    }
    evolve() {
        if (this.ended || this.evolving)
            return;
        this.evolving = true;
        this.prog = 0;
        this.acc = 0;
        this.massCtl.setEnabled(false);
        this.goBtn.disabled = true;
        this.ctx.services.audio.play("click");
    }
    tick(dtMs) {
        if (this.ended)
            return;
        if (this.evolving) {
            this.acc += dtMs;
            let steps = 0;
            while (this.evolving && this.acc >= 16.67 && steps < 30) {
                this.prog = Math.min(1, this.prog + 0.012);
                if (this.prog >= 1) {
                    this.evolving = false;
                    this.evaluate();
                }
                this.acc -= 16.67;
                steps++;
            }
        }
        this.render();
    }
    evaluate() {
        this.massCtl.setEnabled(true);
        this.goBtn.disabled = false;
        const f = fateFor(this.mass);
        if (f === this.target()) {
            this.hits += 1;
            this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
            this.ctx.services.audio.play("reward");
            if (this.hits >= ROUNDS.length)
                this.finish();
            else {
                this.idx += 1;
                this.coachEl.textContent = `${FATE_EMOJI[f]} ${f}! Next target needs a different mass.`;
                this.buildPanel();
            }
        }
        else {
            this.misses += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `That star became a ${f}, not a ${this.target()}. ${this.massForTargetHint()}`;
        }
    }
    massForTargetHint() {
        const t = this.target();
        return t === "Red Dwarf"
            ? "Try a much smaller mass."
            : t === "White Dwarf"
                ? "Try a sun-like mass (under 8 ☉)."
                : t === "Neutron Star"
                    ? "Try a heavy star (8–20 ☉)."
                    : "Try a truly massive star (over 20 ☉).";
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
        this.ctx.services.score.event("starlife_done", { misses: this.misses });
        this.ctx.services.outcome.succeed({
            message: "Stellar! A star's mass decides its destiny: light stars fade into white dwarfs, while heavy ones explode as supernovae and leave neutron stars or black holes.",
            stars,
            resources: { Minerals: 60 },
        });
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#0b1026";
        c.fillRect(0, 0, W, H);
        c.fillStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 60; i++)
            c.fillRect((i * 137) % W, (i * 89) % H, 2, 2);
        if (this.ended) {
            c.fillStyle = "#fff";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("A galaxy of stars built! ✨", W / 2, H / 2);
            return;
        }
        const cx = W / 2;
        const cy = 300;
        const f = fateFor(this.mass);
        // base star size grows with mass
        const baseR = 30 + Math.min(80, this.mass * 4);
        let r = baseR;
        let color = "#fde047";
        let label = "main-sequence star";
        if (this.evolving) {
            // first half: swell into a giant; second half: end state
            if (this.prog < 0.5) {
                r = baseR * (1 + this.prog * 2);
                color = "#f97316";
                label = "red giant…";
            }
            else {
                const p2 = (this.prog - 0.5) * 2;
                if (f === "White Dwarf") {
                    r = baseR * (1.6 - p2 * 1.4);
                    color = "#e0f2fe";
                    label = "shedding into a white dwarf";
                }
                else if (f === "Red Dwarf") {
                    r = baseR;
                    color = "#ef4444";
                    label = "tiny, long-lived red dwarf";
                }
                else {
                    // supernova → remnant
                    if (p2 < 0.5) {
                        r = baseR * (2 + p2 * 4);
                        color = "#fff";
                        label = "💥 SUPERNOVA";
                    }
                    else {
                        r = f === "Black Hole" ? 18 : 26;
                        color = f === "Black Hole" ? "#000" : "#a5f3fc";
                        label = f;
                    }
                }
            }
        }
        c.fillStyle = color;
        c.beginPath();
        c.arc(cx, cy, Math.max(4, r), 0, Math.PI * 2);
        c.fill();
        if (f === "Black Hole" && this.evolving && this.prog > 0.75) {
            c.strokeStyle = "#7c3aed";
            c.lineWidth = 3;
            c.beginPath();
            c.arc(cx, cy, 30, 0, Math.PI * 2);
            c.stroke();
        }
        c.fillStyle = "#e9d5ff";
        c.font = "bold 16px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(label, cx, cy + Math.max(r, 30) + 30);
        c.fillStyle = "#fff";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText("Set the star's mass to choose its fate ⭐", W / 2, 44);
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
        this.evolving = false;
        this.mass = 1;
        this.idx = 0;
        this.hits = 0;
        this.misses = 0;
        this.prog = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const starLifeGame = {
    meta: {
        id: "starlife",
        conceptId: "ess-27",
        title: "Star Life Cycle",
        stream: "earth-space",
        gradeBand: "6-8",
        emoji: "⭐",
        blurb: "Set a star's mass and watch its life unfold — from giant to white dwarf, neutron star, or black hole.",
        mission: "Choose a mass so each star ends as the target type.",
        estMinutes: 3,
    },
    create: (ctx) => new StarLife(ctx),
};
