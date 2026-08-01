import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const GROUND = 480;
const NEEDS = [
    {
        key: "water",
        label: "Water",
        emoji: "💧",
        low: 45,
        high: 75,
        tooLow: "The soil is dry — give it more water.",
        tooHigh: "Too much water! The roots are drowning.",
    },
    {
        key: "sun",
        label: "Sunlight",
        emoji: "☀️",
        low: 50,
        high: 80,
        tooLow: "It's too dark — give it more sunlight.",
        tooHigh: "Too much sun! The leaves are scorching.",
    },
    {
        key: "air",
        label: "Fresh air",
        emoji: "🌬️",
        low: 40,
        high: 70,
        tooLow: "It needs more fresh air to breathe.",
        tooHigh: "Too much wind is drying it out.",
    },
];
class PlantNeeds {
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
        Object.defineProperty(this, "vals", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { water: 20, sun: 20, air: 20 }
        });
        Object.defineProperty(this, "growth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // 0..1
        Object.defineProperty(this, "health", {
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
        Object.defineProperty(this, "growthEl", {
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
        this.buildPanel();
        ctx.services.hints.setHints([
            "Plants are living things — they need water, sunlight, and air to grow.",
            "Each need has a 'just right' amount. Too little OR too much can both hurt the plant.",
            "Slide each control into its green 'just right' zone and hold it there to make the plant grow tall.",
        ]);
        this.loop.start();
        this.render();
    }
    buildPanel() {
        const sliders = NEEDS.map((nd) => {
            const slider = el("input", {
                type: "range",
                min: "0",
                max: "100",
                value: String(this.vals[nd.key]),
                "aria-label": nd.label,
                style: { accentColor: "var(--accent-blue)" },
                oninput: (e) => {
                    this.vals[nd.key] = Number(e.target.value);
                },
            });
            return el("div", {}, el("div", { class: "control-label" }, `${nd.emoji} ${nd.label}`), slider);
        });
        this.growthEl = el("span", { style: { color: "var(--accent-green)" } }, "0%");
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Give the seed just the right amount of each thing to help it grow.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Grow the plant tall")), ...sliders, el("div", { class: "metric" }, el("span", {}, "🌱 Growth"), this.growthEl), this.coachEl);
    }
    tick(dtMs) {
        if (this.ended)
            return;
        const f = dtMs / 16.67;
        this.anim += 0.04 * f;
        // Count how many needs are inside their ideal band.
        let happy = 0;
        let worst = null;
        for (const nd of NEEDS) {
            const v = this.vals[nd.key];
            if (v >= nd.low && v <= nd.high) {
                happy += 1;
            }
            else {
                worst ?? (worst = { msg: v < nd.low ? nd.tooLow : nd.tooHigh });
            }
        }
        if (happy === NEEDS.length) {
            this.growth = Math.min(1, this.growth + 0.0025 * f);
            this.health = Math.min(1, this.health + 0.01 * f);
            this.coachEl.textContent =
                "🌱 Perfect! Everything is just right — keep it steady and watch it grow.";
        }
        else {
            // missing needs stall growth and slowly wilt
            this.health = Math.max(0, this.health - 0.004 * (NEEDS.length - happy) * f);
            if (worst)
                this.coachEl.textContent = `⚠️ ${worst.msg}`;
        }
        this.growthEl.textContent = `${Math.round(this.growth * 100)}%`;
        if (this.growth >= 1)
            this.finish();
        this.render();
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("plantneeds_done", {});
        this.ctx.services.outcome.succeed({
            message: "It bloomed! 🌸 Plants are living things that need water, sunlight, and air — in just the right amounts — to grow.",
            stars,
            resources: { Water: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        // sky changes with sunlight level
        const sun = this.vals.sun;
        c.fillStyle = `hsl(200, 70%, ${55 + sun * 0.25}%)`;
        c.fillRect(0, 0, W, GROUND);
        // sun glow
        c.fillStyle = `rgba(255,210,63,${0.3 + (sun / 100) * 0.6})`;
        c.beginPath();
        c.arc(680, 110, 50 + (sun / 100) * 20, 0, Math.PI * 2);
        c.fill();
        // soil
        c.fillStyle = "#7c4a1e";
        c.fillRect(0, GROUND, W, H - GROUND);
        // water level shading in soil
        c.fillStyle = `rgba(37,99,235,${(this.vals.water / 100) * 0.4})`;
        c.fillRect(0, GROUND, W, H - GROUND);
        // pot/plant base position
        const px = W / 2;
        const wilt = this.health; // 1 healthy, 0 wilted
        // stem grows with growth
        const stemH = 30 + this.growth * 240;
        const topY = GROUND - stemH;
        c.strokeStyle = `hsl(110, ${30 + wilt * 50}%, ${25 + wilt * 15}%)`;
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(px, GROUND);
        const bend = (1 - wilt) * 40 * Math.sin(this.anim);
        c.quadraticCurveTo(px + bend, topY + stemH / 2, px + bend * 0.5, topY);
        c.stroke();
        // leaves along the stem
        const leaves = Math.floor(this.growth * 5);
        for (let i = 1; i <= leaves; i++) {
            const ly = GROUND - (stemH * i) / (leaves + 1);
            const side = i % 2 === 0 ? 1 : -1;
            c.fillStyle = `hsl(120, ${40 + wilt * 40}%, ${30 + wilt * 15}%)`;
            c.save();
            c.translate(px, ly);
            c.rotate(side * 0.5 + (1 - wilt) * 0.4);
            c.beginPath();
            c.ellipse(side * 22, 0, 26, 12, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        // flower when nearly grown
        if (this.growth > 0.85) {
            const fy = topY;
            c.fillStyle = "#ff4fa3";
            for (let p = 0; p < 6; p++) {
                const a = (p / 6) * Math.PI * 2 + this.anim * 0.2;
                c.beginPath();
                c.ellipse(px + bend * 0.5 + Math.cos(a) * 18, fy + Math.sin(a) * 18, 12, 12, 0, 0, Math.PI * 2);
                c.fill();
            }
            c.fillStyle = "#ffd23f";
            c.beginPath();
            c.arc(px + bend * 0.5, fy, 12, 0, Math.PI * 2);
            c.fill();
        }
        // health hearts
        c.font = "24px serif";
        c.textAlign = "left";
        const hearts = Math.ceil(wilt * 3);
        c.fillText("❤️".repeat(Math.max(0, hearts)) || "💔", 20, 40);
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
        this.vals = { water: 20, sun: 20, air: 20 };
        this.growth = 0;
        this.health = 1;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const plantNeedsGame = {
    meta: {
        id: "plantneeds",
        conceptId: "bio-03",
        title: "Grow, Little Seed",
        stream: "biology",
        gradeBand: "K-2",
        emoji: "🌱",
        blurb: "Give a seed just enough water, sunlight, and air to grow into a flower.",
        mission: "Balance water, sunlight, and air in their 'just right' zones to grow the plant.",
        estMinutes: 2,
    },
    create: (ctx) => new PlantNeeds(ctx),
};
