import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const GROUND = 500;
const ROUNDS = [
    { magnitude: 8, needed: 3, label: "a moderate tremor" },
    { magnitude: 16, needed: 5, label: "a strong earthquake" },
];
class Earthquake {
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
        Object.defineProperty(this, "t", {
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
        Object.defineProperty(this, "wideBase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "braced", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lightTop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "roundIdx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "shaking", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "shakeT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "collapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "collapseBlocks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "attempts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "scoreEl", {
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
        Object.defineProperty(this, "collapseSettleT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Earthquakes shake the ground, and tall buildings can topple if they aren't designed to handle it.",
            "Engineers make buildings safer with a wide base, cross-bracing, and keeping heavy weight low (a light top).",
            "Turn on all three safety features to raise your stability score above what the quake needs.",
        ]);
        this.renderLoop();
    }
    score() {
        return (this.wideBase ? 2 : 0) + (this.braced ? 2 : 0) + (this.lightTop ? 2 : 0);
    }
    round() {
        return ROUNDS[this.roundIdx];
    }
    buildPanel() {
        const toggle = (label, get, set) => el("button", {
            class: "chip",
            style: get()
                ? {
                    background: "var(--accent-green)",
                    color: "#fff",
                    borderColor: "var(--accent-green)",
                }
                : {},
            onclick: () => {
                if (this.shaking)
                    return;
                set(!get());
                this.buildPanel();
            },
        }, `${get() ? "✓ " : ""}${label}`);
        const opts = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, toggle("🔻 Wide base", () => this.wideBase, (v) => (this.wideBase = v)), toggle("🔩 Cross-braces", () => this.braced, (v) => (this.braced = v)), toggle("🪶 Light top", () => this.lightTop, (v) => (this.lightTop = v)));
        const shakeBtn = el("button", { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.shake() }, "🌋 Shake it!");
        this.scoreEl = el("span", {}, "");
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.roundIdx} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Survive"), el("span", {}, this.round().label)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Add safety features"), opts, shakeBtn, el("div", { class: "metric" }, el("span", {}, "🏗️ Stability"), this.scoreEl), el("div", { class: "metric" }, el("span", {}, "🏆 Survived"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const sc = this.score();
        this.scoreEl.textContent = `${sc} / 6 (need ${this.round().needed})`;
        this.scoreEl.style.color =
            sc >= this.round().needed ? "var(--accent-green)" : "var(--accent-red)";
        if (!this.shaking && !this.collapsed) {
            this.coachEl.textContent =
                sc >= this.round().needed
                    ? "Looks sturdy enough — hit Shake it! to test your design."
                    : "Add more safety features to raise stability before the quake.";
        }
    }
    shake() {
        if (this.ended || this.shaking || this.collapsed)
            return;
        this.shaking = true;
        this.shakeT = 0;
        this.ctx.services.audio.play("click");
    }
    resolve() {
        this.shaking = false;
        if (this.score() >= this.round().needed) {
            this.roundIdx += 1;
            this.ctx.services.audio.play("tick");
            this.statusEl.textContent = `${this.roundIdx} / ${ROUNDS.length}`;
            if (this.roundIdx >= ROUNDS.length) {
                this.win();
            }
            else {
                this.coachEl.textContent = "🏗️ It stood firm! Next quake is stronger — reinforce more.";
                this.updateReadout();
            }
        }
        else {
            this.attempts += 1;
            this.collapsed = true;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = "🧱 It toppled! Add more safety features and try again.";
            // spawn falling blocks
            this.collapseBlocks = [];
            for (let i = 0; i < 5; i++) {
                this.collapseBlocks.push({
                    x: W / 2 + (Math.random() - 0.5) * 40,
                    y: GROUND - 40 - i * 60,
                    vx: (Math.random() - 0.5) * 8,
                    vy: -2,
                    rot: 0,
                    vr: (Math.random() - 0.5) * 0.3,
                });
            }
        }
    }
    win() {
        this.ended = true;
        const stars = this.attempts === 0 ? 3 : this.attempts <= 2 ? 2 : 1;
        this.ctx.services.score.event("earthquake_done", { attempts: this.attempts });
        this.ctx.services.outcome.succeed({
            message: "Quake-proof! A wide base, cross-bracing, and keeping weight low help a building stand through an earthquake's shaking.",
            stars,
            resources: { Rock: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.t += 1;
            if (this.shaking) {
                this.shakeT += 1;
                if (this.shakeT > 90)
                    this.resolve();
            }
            if (this.collapsed) {
                let settled = true;
                for (const b of this.collapseBlocks) {
                    b.vy += 0.5;
                    b.x += b.vx;
                    b.y += b.vy;
                    b.rot += b.vr;
                    if (b.y < GROUND - 16)
                        settled = false;
                    else {
                        b.y = GROUND - 16;
                        b.vx *= 0.7;
                    }
                }
                if (this.shakeT > 0)
                    this.shakeT = 0;
                // after a moment, reset for retry
                if (settled) {
                    this.collapseSettleT = (this.collapseSettleT || 0) + 1;
                    if (this.collapseSettleT > 50) {
                        this.collapsed = false;
                        this.collapseSettleT = 0;
                        this.buildPanel();
                    }
                }
            }
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#fde68a";
        c.fillRect(0, 0, W, GROUND);
        c.fillStyle = "#92400e";
        c.fillRect(0, GROUND, W, H - GROUND);
        // ground shake offset
        let gx = 0;
        if (this.shaking) {
            gx = Math.sin(this.shakeT * 0.6) * this.round().magnitude;
        }
        if (this.collapsed) {
            for (const b of this.collapseBlocks) {
                c.save();
                c.translate(b.x, b.y);
                c.rotate(b.rot);
                c.fillStyle = "#3b82f6";
                c.fillRect(-30, -16, 60, 32);
                c.strokeStyle = "#1e3a8a";
                c.lineWidth = 2;
                c.strokeRect(-30, -16, 60, 32);
                c.restore();
            }
        }
        else {
            // tower: 5 blocks; sway by height when shaking, reduced by stability
            const cx = W / 2;
            const baseW = this.wideBase ? 130 : 80;
            const stability = this.score();
            for (let i = 0; i < 5; i++) {
                const level = i;
                const by = GROUND - 40 - level * 60;
                const bw = baseW - level * (this.wideBase ? 14 : 4);
                // top block lighter (smaller) if lightTop chosen
                const topAdjust = i === 4 && this.lightTop ? 0.7 : 1;
                const sway = this.shaking
                    ? Math.sin(this.shakeT * 0.6 + level * 0.5) *
                        this.round().magnitude *
                        (level + 1) *
                        0.25 *
                        (1 - stability / 8)
                    : 0;
                c.save();
                c.translate(cx + gx + sway, by);
                c.fillStyle = i === 4 ? "#f59e0b" : "#3b82f6";
                c.fillRect((-bw / 2) * topAdjust, -28, bw * topAdjust, 56);
                c.strokeStyle = "#1e3a8a";
                c.lineWidth = 2;
                c.strokeRect((-bw / 2) * topAdjust, -28, bw * topAdjust, 56);
                // cross-braces drawn on each block if braced
                if (this.braced) {
                    c.strokeStyle = "rgba(255,255,255,0.7)";
                    c.lineWidth = 3;
                    c.beginPath();
                    c.moveTo((-bw / 2) * topAdjust, -28);
                    c.lineTo((bw / 2) * topAdjust, 28);
                    c.moveTo((bw / 2) * topAdjust, -28);
                    c.lineTo((-bw / 2) * topAdjust, 28);
                    c.stroke();
                }
                c.restore();
            }
        }
        c.fillStyle = "#7c2d12";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(this.shaking ? "🌋 Shaking!" : "Design a quake-proof tower 🏗️", W / 2, 40);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.wideBase = false;
        this.braced = false;
        this.lightTop = false;
        this.roundIdx = 0;
        this.shaking = false;
        this.shakeT = 0;
        this.collapsed = false;
        this.collapseBlocks = [];
        this.collapseSettleT = 0;
        this.attempts = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const earthquakeGame = {
    meta: {
        id: "earthquake",
        conceptId: "ess-18",
        title: "Shake-Proof",
        stream: "earth-space",
        gradeBand: "4-5",
        emoji: "🏗️",
        blurb: "Reinforce a tower with smart engineering so it survives the earthquake.",
        mission: "Add safety features so the building withstands stronger and stronger quakes.",
        estMinutes: 3,
    },
    create: (ctx) => new Earthquake(ctx),
};
