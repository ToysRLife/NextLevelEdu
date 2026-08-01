import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const GROUND = 470;
const SOURCES = [
    {
        key: "solar",
        label: "Solar",
        emoji: "☀️",
        output: 25,
        renewable: true,
        why: "Sunlight never runs out — solar power is renewable.",
    },
    {
        key: "wind",
        label: "Wind",
        emoji: "🌬️",
        output: 25,
        renewable: true,
        why: "The wind keeps blowing — wind power is renewable.",
    },
    {
        key: "hydro",
        label: "Hydro",
        emoji: "💧",
        output: 30,
        renewable: true,
        why: "Flowing water is refilled by rain — hydro is renewable.",
    },
    {
        key: "geo",
        label: "Geothermal",
        emoji: "🌋",
        output: 30,
        renewable: true,
        why: "Earth's inner heat lasts forever — geothermal is renewable.",
    },
    {
        key: "coal",
        label: "Coal",
        emoji: "🪨",
        output: 40,
        renewable: false,
        why: "Coal took millions of years to form and runs out — it's non-renewable and pollutes.",
    },
    {
        key: "oil",
        label: "Oil",
        emoji: "🛢️",
        output: 40,
        renewable: false,
        why: "Oil is a fossil fuel that runs out — non-renewable and polluting.",
    },
    {
        key: "gas",
        label: "Gas",
        emoji: "⛽",
        output: 40,
        renewable: false,
        why: "Natural gas is a fossil fuel — non-renewable and polluting.",
    },
];
class EnergySources {
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
        Object.defineProperty(this, "power", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // 0..100
        Object.defineProperty(this, "built", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "mistakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "smog", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "powerEl", {
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
        this.buildPanel();
        ctx.services.hints.setHints([
            "Renewable energy comes from sources that never run out — like the sun, wind, water, and Earth's heat.",
            "Non-renewable fossil fuels — coal, oil, and gas — took millions of years to form, will run out, and pollute the air.",
            "Power the city to 100% using only renewable sources. Avoid the fossil fuels!",
        ]);
        this.renderLoop();
    }
    buildPanel() {
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...SOURCES.map((s) => el("button", { class: "chip", onclick: () => this.add(s.key) }, `${s.emoji} ${s.label}`)));
        this.powerEl = el("span", { style: { color: "var(--accent-green)" } }, "0%");
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Add clean power plants until the city hits 100% — no fossil fuels!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "100% clean power")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Add a power source"), chips, el("div", { class: "metric" }, el("span", {}, "⚡ City power"), this.powerEl), this.coachEl);
    }
    add(key) {
        if (this.ended)
            return;
        const s = SOURCES.find((x) => x.key === key);
        if (!s.renewable) {
            this.mistakes += 1;
            this.smog = Math.min(1, this.smog + 0.34);
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${s.why}`;
            return;
        }
        this.power = Math.min(100, this.power + s.output);
        this.built.push({ emoji: s.emoji, x: 120 + this.built.length * 95 });
        this.ctx.services.audio.play("tick");
        this.powerEl.textContent = `${this.power}%`;
        this.coachEl.textContent = `✅ ${s.why}`;
        if (this.power >= 100)
            this.win();
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("energysources_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "City powered — cleanly! Renewable sources like sun, wind, water, and Earth's heat never run out and don't pollute, unlike coal, oil, and gas.",
            stars,
            resources: { Climate: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            this.smog = Math.max(0, this.smog - 0.004);
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        const sky = c.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, "#7dd3fc");
        sky.addColorStop(1, "#e0f2fe");
        c.fillStyle = sky;
        c.fillRect(0, 0, W, GROUND);
        // smog overlay if fossil fuels were tried
        if (this.smog > 0) {
            c.fillStyle = `rgba(120,113,108,${this.smog * 0.5})`;
            c.fillRect(0, 0, W, GROUND);
        }
        c.fillStyle = "#4d7c0f";
        c.fillRect(0, GROUND, W, H - GROUND);
        // city skyline; windows light up as power rises
        const litFrac = this.power / 100;
        const buildings = [
            { x: 300, w: 60, h: 200 },
            { x: 370, w: 70, h: 270 },
            { x: 450, w: 55, h: 160 },
            { x: 515, w: 75, h: 230 },
            { x: 600, w: 60, h: 190 },
        ];
        for (const b of buildings) {
            c.fillStyle = "#334155";
            c.fillRect(b.x, GROUND - b.h, b.w, b.h);
            for (let wy = GROUND - b.h + 14; wy < GROUND - 10; wy += 26) {
                for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 20) {
                    // deterministic per-window threshold, so lights switch on steadily with power
                    const threshold = ((wx * 7 + wy * 13) % 100) / 100;
                    c.fillStyle = threshold < litFrac ? "#fde047" : "#1e293b";
                    c.fillRect(wx, wy, 10, 14);
                }
            }
        }
        // built renewable sources along the ground
        c.font = "40px serif";
        c.textAlign = "center";
        for (const b of this.built) {
            c.fillText(b.emoji, b.x, GROUND + 50);
        }
        // power bar
        c.fillStyle = "rgba(255,255,255,0.7)";
        this.roundRect(c, W / 2 - 160, 40, 320, 26, 13);
        c.fill();
        c.fillStyle = "#22c55e";
        this.roundRect(c, W / 2 - 160, 40, 320 * (this.power / 100), 26, 13);
        c.fill();
        c.fillStyle = "#14532d";
        c.font = "bold 15px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`City power: ${this.power}% (clean)`, W / 2, 60);
        c.fillStyle = this.smog > 0.1 ? "#7c2d12" : "#0c4a6e";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText("Power the city with clean energy ⚡", W / 2, 100);
    }
    roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        if (w <= 0)
            return;
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.power = 0;
        this.built = [];
        this.mistakes = 0;
        this.smog = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const energySourcesGame = {
    meta: {
        id: "energysources",
        conceptId: "ess-21",
        title: "Power Up",
        stream: "earth-space",
        gradeBand: "4-5",
        emoji: "⚡",
        blurb: "Power a whole city using only renewable energy — and spot the fossil fuels.",
        mission: "Reach 100% city power using clean, renewable sources only.",
        estMinutes: 3,
    },
    create: (ctx) => new EnergySources(ctx),
};
