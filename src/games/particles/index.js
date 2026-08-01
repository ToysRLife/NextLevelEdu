import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
const BOX = { x: 280, y: 170, w: 300, h: 320 };
const TARGETS = [
    { state: "solid", label: "Solid", emoji: "🧊" },
    { state: "liquid", label: "Liquid", emoji: "💧" },
    { state: "gas", label: "Gas", emoji: "💨" },
];
class Particles {
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
        Object.defineProperty(this, "temp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.1
        }); // 0..1
        Object.defineProperty(this, "parts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "order", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "matched", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hold", {
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
        Object.defineProperty(this, "stateEl", {
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
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.initParticles();
        this.order = [...TARGETS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "All matter is made of tiny particles too small to see. How they move decides if something is a solid, liquid, or gas.",
            "Heat gives particles energy to move. Cold = locked tight (solid); warm = sliding past each other (liquid); hot = flying free (gas).",
            "Slide the heat to match the state: low for a solid, middle for a liquid, high for a gas — then hold it there.",
        ]);
        this.loop.start();
        this.render();
    }
    initParticles() {
        this.parts = [];
        const cols = 6;
        const rows = 6;
        const gap = 34;
        const startX = BOX.x + BOX.w / 2 - ((cols - 1) * gap) / 2;
        const startY = BOX.y + BOX.h - 30 - (rows - 1) * gap;
        for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
                const hx = startX + cc * gap;
                const hy = startY + r * gap;
                this.parts.push({ x: hx, y: hy, vx: 0, vy: 0, hx, hy });
            }
        }
    }
    state() {
        if (this.temp < 0.34)
            return "solid";
        if (this.temp < 0.7)
            return "liquid";
        return "gas";
    }
    buildPanel() {
        const slider = el("input", {
            type: "range",
            min: "0",
            max: "100",
            value: String(this.temp * 100),
            "aria-label": "Heat",
            style: { accentColor: "var(--accent-orange)" },
            oninput: (e) => {
                this.temp = Number(e.target.value) / 100;
                this.updateReadout();
            },
        });
        this.stateEl = el("span", {}, "");
        this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `0 / ${TARGETS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Make a"), el("span", {}, `${this.target().emoji} ${this.target().label}`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔥 Heat (energy)"), slider, el("div", { class: "metric" }, el("span", {}, "🔬 State now"), this.stateEl), el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    target() {
        return this.order[this.idx];
    }
    updateReadout() {
        const s = this.state();
        this.stateEl.textContent = s === "solid" ? "🧊 Solid" : s === "liquid" ? "💧 Liquid" : "💨 Gas";
        this.coachEl.textContent =
            s === "solid"
                ? "Cold: particles are locked in a tight pattern, only wobbling."
                : s === "liquid"
                    ? "Warmer: particles slip past each other and flow."
                    : "Hot: particles break free and zoom around, filling the space.";
    }
    tick(dtMs) {
        if (this.ended)
            return;
        const f = dtMs / 16.67;
        const s = this.state();
        for (const p of this.parts) {
            if (s === "solid") {
                // spring back to lattice home + small vibration
                p.vx += (p.hx - p.x) * 0.08 * f + (Math.random() - 0.5) * 0.6 * this.temp;
                p.vy += (p.hy - p.y) * 0.08 * f + (Math.random() - 0.5) * 0.6 * this.temp;
                p.vx *= 0.6;
                p.vy *= 0.6;
            }
            else if (s === "liquid") {
                p.vy += 0.25 * f; // gravity — pools at the bottom
                p.vx += (Math.random() - 0.5) * 0.6 * f;
                p.vx *= 0.96;
                p.vy *= 0.96;
            }
            else {
                // gas — energetic free motion
                p.vx += (Math.random() - 0.5) * 1.4 * f;
                p.vy += (Math.random() - 0.5) * 1.4 * f;
                const sp = Math.hypot(p.vx, p.vy);
                const max = 4.5;
                if (sp > max) {
                    p.vx = (p.vx / sp) * max;
                    p.vy = (p.vy / sp) * max;
                }
            }
            p.x += p.vx * f;
            p.y += p.vy * f;
            // walls
            if (p.x < BOX.x + 8) {
                p.x = BOX.x + 8;
                p.vx = Math.abs(p.vx) * 0.6;
            }
            if (p.x > BOX.x + BOX.w - 8) {
                p.x = BOX.x + BOX.w - 8;
                p.vx = -Math.abs(p.vx) * 0.6;
            }
            if (p.y < BOX.y + 8) {
                p.y = BOX.y + 8;
                p.vy = Math.abs(p.vy) * 0.6;
            }
            if (p.y > BOX.y + BOX.h - 8) {
                p.y = BOX.y + BOX.h - 8;
                p.vy = -Math.abs(p.vy) * (s === "gas" ? 0.8 : 0.2);
            }
        }
        // matching: hold the right state
        if (s === this.target().state) {
            this.hold += f;
            if (this.hold > byTier(this.ctx.tier, 28, 40, 55))
                this.matchOne();
        }
        else {
            this.hold = 0;
        }
        this.render();
    }
    matchOne() {
        this.matched += 1;
        this.hold = 0;
        this.ctx.services.audio.play("tick");
        this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
        this.idx += 1;
        if (this.matched >= TARGETS.length) {
            this.finish();
        }
        else {
            this.buildPanel();
        }
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("particles_done", {});
        this.ctx.services.outcome.succeed({
            message: "You see it now! Matter is made of tiny particles. Add heat and they move more — locked solid, flowing liquid, then free-flying gas.",
            stars,
            resources: { Elements: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#eff6ff";
        c.fillRect(0, 0, W, H);
        // container
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        c.strokeStyle = "#475569";
        c.lineWidth = 5;
        c.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
        // heat glow at the base
        c.fillStyle = `rgba(249,115,22,${this.temp * 0.5})`;
        c.fillRect(BOX.x, BOX.y + BOX.h - 14, BOX.w, 14);
        const s = this.state();
        const col = s === "solid" ? "#2563eb" : s === "liquid" ? "#0ea5e9" : "#93c5fd";
        for (const p of this.parts) {
            c.fillStyle = col;
            c.beginPath();
            c.arc(p.x, p.y, 11, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "rgba(255,255,255,0.4)";
            c.beginPath();
            c.arc(p.x - 3, p.y - 3, 4, 0, Math.PI * 2);
            c.fill();
        }
        // thermometer
        const tx = 150;
        c.fillStyle = "rgba(255,255,255,0.7)";
        this.roundRect(c, tx, 180, 30, 300, 15);
        c.fill();
        c.fillStyle = "#f97316";
        const fillH = 300 * this.temp;
        this.roundRect(c, tx, 180 + 300 - fillH, 30, fillH, 15);
        c.fill();
        c.fillStyle = "#1e293b";
        c.font = "12px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("🔥", tx + 15, 500);
        c.fillText("❄️", tx + 15, 170);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`Make a ${this.target().label} ${this.target().emoji} — heat the particles`, W / 2, 60);
        if (this.hold > 0 && !this.ended) {
            c.fillStyle = "#16a34a";
            c.font = "bold 15px Nunito, sans-serif";
            c.fillText("hold it…", BOX.x + BOX.w / 2, BOX.y - 12);
        }
    }
    roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        if (h <= 0)
            return;
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
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
        this.temp = 0.1;
        this.idx = 0;
        this.matched = 0;
        this.hold = 0;
        this.initParticles();
        this.order = [...TARGETS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const particlesGame = {
    meta: {
        id: "particles",
        conceptId: "chem-19",
        title: "Inside Matter",
        stream: "chemistry",
        gradeBand: "5",
        emoji: "🔬",
        blurb: "Heat the tiny particles and watch matter change between solid, liquid, and gas.",
        mission: "Set the heat to make the particles form a solid, a liquid, and a gas.",
        estMinutes: 3,
    },
    create: (ctx) => new Particles(ctx),
};
