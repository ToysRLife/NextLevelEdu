import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const THINGS = [
    {
        name: "Dog",
        emoji: "🐶",
        living: true,
        why: "A dog grows, eats, and has puppies — it's living.",
    },
    {
        name: "Tree",
        emoji: "🌳",
        living: true,
        why: "A tree grows, needs water and sunlight, and makes seeds — living.",
    },
    {
        name: "Fish",
        emoji: "🐟",
        living: true,
        why: "A fish breathes, eats, and grows — it's living.",
    },
    { name: "Bee", emoji: "🐝", living: true, why: "A bee moves, eats, and breeds — it's living." },
    {
        name: "Rock",
        emoji: "🪨",
        living: false,
        why: "A rock doesn't grow, eat, or reproduce — it's non-living.",
    },
    {
        name: "Car",
        emoji: "🚗",
        living: false,
        why: "A car moves, but it doesn't grow or eat — it's non-living.",
    },
    {
        name: "Cloud",
        emoji: "☁️",
        living: false,
        why: "A cloud changes shape but doesn't eat or grow — non-living.",
    },
    {
        name: "Robot",
        emoji: "🤖",
        living: false,
        why: "A robot can move, but it doesn't grow, eat, or have babies — non-living.",
    },
];
class Living {
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
        Object.defineProperty(this, "mistakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "flash", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "progressEl", {
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
        this.order = [...THINGS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Living things do special things: they grow, need food and water, and can make more of themselves.",
            "Some non-living things move (like cars and clouds), but moving alone doesn't make something alive.",
            "Ask: does it grow, eat, and have young? If yes, it's living.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const choices = el("div", { class: "chip-row" }, el("button", {
            class: "btn",
            style: { background: "var(--accent-green)" },
            onclick: () => this.choose(true),
        }, "🌱 Living"), el("button", { class: "btn secondary", onclick: () => this.choose(false) }, "🪨 Non-living"));
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${THINGS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Is this thing alive?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Sort all 8")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Living or non-living?"), choices, el("div", { class: "metric" }, el("span", {}, "🔎 Thing"), this.progressEl), this.coachEl);
    }
    choose(saysLiving) {
        if (this.ended)
            return;
        const t = this.current();
        if (saysLiving === t.living) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${t.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${t.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${THINGS.length} / ${THINGS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${THINGS.length}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("living_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Great sorting! Living things grow, need food and water, and make more of themselves. Non-living things don't — even if they can move.",
            stars,
            resources: { Species: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.flash > 0)
                this.flash = Math.max(0, this.flash - 0.03);
            if (this.flash < 0)
                this.flash = Math.min(0, this.flash + 0.03);
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#f0fdf4";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#166534";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All sorted! 🌱", W / 2, H / 2);
            return;
        }
        if (this.flash > 0) {
            c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
            c.fillRect(0, 0, W, H);
        }
        else if (this.flash < 0) {
            c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
            c.fillRect(0, 0, W, H);
        }
        const t = this.current();
        const cx = W / 2;
        const cy = 280 + Math.sin(this.anim) * 6;
        c.fillStyle = "#fff";
        c.strokeStyle = "#86efac";
        c.lineWidth = 6;
        this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
        c.fill();
        c.stroke();
        c.font = "120px serif";
        c.textAlign = "center";
        c.fillText(t.emoji, cx, cy + 20);
        c.fillStyle = "#166534";
        c.font = "bold 26px Nunito, sans-serif";
        c.fillText(t.name, cx, cy + 100);
        c.fillStyle = "#166534";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText("Living 🌱 or non-living 🪨?", W / 2, 60);
    }
    roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.mistakes = 0;
        this.flash = 0;
        this.order = [...THINGS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const livingGame = {
    meta: {
        id: "living",
        conceptId: "bio-01",
        title: "Alive or Not?",
        stream: "biology",
        gradeBand: "K-1",
        emoji: "🌱",
        blurb: "Sort things into living and non-living.",
        mission: "Decide whether each thing is living or non-living.",
        estMinutes: 2,
    },
    create: (ctx) => new Living(ctx),
};
