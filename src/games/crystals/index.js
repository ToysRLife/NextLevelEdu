import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
class Crystals {
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
        Object.defineProperty(this, "slow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // cooling speed below this stays clear (adaptive)
        Object.defineProperty(this, "speed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.25
        });
        Object.defineProperty(this, "size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // 0..1
        Object.defineProperty(this, "clarity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        }); // 0..1
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
        Object.defineProperty(this, "sizeEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "clarityEl", {
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
        this.slow = byTier(ctx.tier, 0.45, 0.35, 0.28);
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.buildPanel();
        ctx.services.hints.setHints([
            "A crystal is a solid whose particles line up in a neat, repeating pattern — that's why it has flat faces.",
            "Crystals grow as a solution slowly cools or dries. Slow growth lets the particles line up into one big, clear crystal.",
            "Cool too fast and you get a cloudy lump of tiny crystals. Keep the cooling slow and be patient!",
        ]);
        this.loop.start();
        this.render();
    }
    buildPanel() {
        const slider = el("input", {
            type: "range",
            min: "0",
            max: "100",
            value: String(this.speed * 100),
            "aria-label": "Cooling speed",
            style: { accentColor: "var(--accent-blue)" },
            oninput: (e) => {
                this.speed = Number(e.target.value) / 100;
                this.updateReadout();
            },
        });
        this.sizeEl = el("span", {}, "0%");
        this.clarityEl = el("span", { style: { color: "var(--accent-blue)" } }, "100%");
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Grow a big clear crystal")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "❄️ Cooling speed (slow → fast)"), slider, el("div", { class: "metric" }, el("span", {}, "💎 Size"), this.sizeEl), el("div", { class: "metric" }, el("span", {}, "✨ Clarity"), this.clarityEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        this.sizeEl.textContent = `${Math.round(this.size * 100)}%`;
        this.clarityEl.textContent = `${Math.round(this.clarity * 100)}%`;
        this.coachEl.textContent =
            this.speed > this.slow
                ? "Cooling too fast — the crystal is turning cloudy! Slow it down to let the particles line up."
                : "Nice and slow — clear crystal growing. Keep it steady (it takes patience).";
    }
    tick(dtMs) {
        if (this.ended)
            return;
        const f = dtMs / 16.67;
        this.anim += 0.04 * f;
        this.size = Math.min(1, this.size + this.speed * 0.004 * f);
        if (this.speed <= this.slow) {
            this.clarity = Math.min(1, this.clarity + 0.004 * f);
        }
        else {
            this.clarity = Math.max(0, this.clarity - (this.speed - this.slow) * 0.02 * f);
        }
        this.sizeEl.textContent = `${Math.round(this.size * 100)}%`;
        this.clarityEl.textContent = `${Math.round(this.clarity * 100)}%`;
        this.clarityEl.style.color = this.clarity >= 0.75 ? "var(--accent-green)" : "var(--accent-red)";
        if (this.size >= 1 && this.clarity >= 0.75)
            this.finish();
        this.render();
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const stars = this.clarity >= 0.92 ? 3 : this.clarity >= 0.82 ? 2 : 1;
        this.ctx.services.score.event("crystals_done", { clarity: Math.round(this.clarity * 100) });
        this.ctx.services.outcome.succeed({
            message: "A beautiful crystal! Cooling slowly let the particles line up into one big, clear crystal with flat faces. Rushing makes a cloudy clump of tiny ones.",
            stars,
            resources: { Compounds: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#0f172a";
        c.fillRect(0, 0, W, H);
        // beaker
        c.fillStyle = "rgba(125,211,252,0.15)";
        c.fillRect(280, 140, 240, 360);
        c.strokeStyle = "#475569";
        c.lineWidth = 5;
        c.strokeRect(280, 140, 240, 360);
        // a string the crystal grows on
        c.strokeStyle = "#cbd5e1";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(400, 140);
        c.lineTo(400, 300);
        c.stroke();
        // crystal: hexagonal bipyramid scaled by size
        const cx = 400;
        const cy = 360;
        const s = 30 + this.size * 120;
        c.save();
        c.translate(cx, cy);
        c.rotate(0.1 * Math.sin(this.anim));
        const grad = c.createLinearGradient(-s, -s, s, s);
        grad.addColorStop(0, "#a5f3fc");
        grad.addColorStop(1, "#22d3ee");
        c.fillStyle = grad;
        c.beginPath();
        c.moveTo(0, -s * 1.3);
        c.lineTo(s * 0.7, -s * 0.5);
        c.lineTo(s * 0.7, s * 0.5);
        c.lineTo(0, s * 1.3);
        c.lineTo(-s * 0.7, s * 0.5);
        c.lineTo(-s * 0.7, -s * 0.5);
        c.closePath();
        c.fill();
        // facet lines
        c.strokeStyle = "rgba(255,255,255,0.6)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -s * 1.3);
        c.lineTo(0, s * 1.3);
        c.moveTo(-s * 0.7, -s * 0.5);
        c.lineTo(s * 0.7, -s * 0.5);
        c.moveTo(-s * 0.7, s * 0.5);
        c.lineTo(s * 0.7, s * 0.5);
        c.stroke();
        // cloudiness overlay when clarity is low
        if (this.clarity < 1) {
            c.fillStyle = `rgba(226,232,240,${(1 - this.clarity) * 0.7})`;
            c.beginPath();
            c.moveTo(0, -s * 1.3);
            c.lineTo(s * 0.7, -s * 0.5);
            c.lineTo(s * 0.7, s * 0.5);
            c.lineTo(0, s * 1.3);
            c.lineTo(-s * 0.7, s * 0.5);
            c.lineTo(-s * 0.7, -s * 0.5);
            c.closePath();
            c.fill();
        }
        // sparkle when clear
        if (this.clarity > 0.8) {
            c.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(this.anim * 4)})`;
            c.beginPath();
            c.arc(-s * 0.2, -s * 0.4, 4, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
        c.fillStyle = "#e2e8f0";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Grow a big, clear crystal 💎", W / 2, 40);
        c.fillStyle = this.speed > this.slow ? "#fca5a5" : "#86efac";
        c.font = "14px Nunito, sans-serif";
        c.fillText(this.speed > this.slow ? "⚠️ cooling too fast" : "✓ cooling gently", W / 2, 64);
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
        this.speed = 0.25;
        this.size = 0;
        this.clarity = 1;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const crystalsGame = {
    meta: {
        id: "crystals",
        conceptId: "chem-17",
        title: "Crystal Garden",
        stream: "chemistry",
        gradeBand: "4-5",
        emoji: "💎",
        blurb: "Cool a solution slowly to grow one big, clear crystal — rush it and it turns cloudy.",
        mission: "Grow a large crystal while keeping it clear by cooling slowly.",
        estMinutes: 3,
    },
    create: (ctx) => new Crystals(ctx),
};
