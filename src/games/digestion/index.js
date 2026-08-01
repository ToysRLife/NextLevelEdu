import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
// Slots laid out along the body, top to bottom.
const STEPS = [
    {
        key: "mouth",
        name: "Mouth",
        emoji: "👄",
        note: "Teeth chew the food and spit softens it.",
        x: 400,
        y: 130,
    },
    {
        key: "stomach",
        name: "Stomach",
        emoji: "🫃",
        note: "Acids churn the food into a mush.",
        x: 340,
        y: 270,
    },
    {
        key: "small",
        name: "Small intestine",
        emoji: "🌀",
        note: "Nutrients soak into the blood here.",
        x: 440,
        y: 380,
    },
    {
        key: "large",
        name: "Large intestine",
        emoji: "♻️",
        note: "Leftover water is taken out; waste leaves.",
        x: 360,
        y: 480,
    },
];
class Digestion {
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
        Object.defineProperty(this, "placed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "tray", {
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
        this.tray = [...STEPS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Digestion is how your body breaks food into tiny bits it can use, then gets rid of the rest.",
            "The food travels on a journey: it starts in the mouth and ends at the large intestine.",
            "Order: Mouth → Stomach → Small intestine → Large intestine.",
        ]);
        this.renderLoop();
    }
    buildPanel() {
        const next = STEPS[this.placed];
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...this.tray.map((s) => el("button", { class: "chip", onclick: () => this.pick(s.key) }, `${s.emoji} ${s.name}`)));
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.placed} / ${STEPS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = next
            ? `What's step #${this.placed + 1} of the journey?`
            : "Journey complete!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Trace the food's path")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the next stop"), chips, el("div", { class: "metric" }, el("span", {}, "🍎 Steps placed"), this.statusEl), this.coachEl);
    }
    pick(key) {
        if (this.ended)
            return;
        const correct = STEPS[this.placed];
        if (key === correct.key) {
            this.placed += 1;
            this.tray = this.tray.filter((s) => s.key !== key);
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${correct.name}: ${correct.note}`;
            if (this.placed >= STEPS.length)
                this.win();
            else
                this.buildPanel();
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ Not yet. ${correct.name}: ${correct.note}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("digestion_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Journey complete! Food is chewed in the mouth, mashed in the stomach, absorbed in the small intestine, and the leftovers pass through the large intestine.",
            stars,
            resources: { Biomass: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#fff7ed";
        c.fillRect(0, 0, W, H);
        // body outline
        c.fillStyle = "rgba(251,146,60,0.12)";
        c.beginPath();
        c.ellipse(400, 120, 44, 50, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(330, 160, 150, 360);
        // path arrows between consecutive placed steps
        for (let i = 1; i < STEPS.length; i++) {
            if (i > this.placed - 1)
                continue;
            const a = STEPS[i - 1];
            const b = STEPS[i];
            c.strokeStyle = "#f59e0b";
            c.lineWidth = 4;
            c.setLineDash([8, 6]);
            c.lineDashOffset = -this.anim * 8;
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.stroke();
            c.setLineDash([]);
        }
        for (let i = 0; i < STEPS.length; i++) {
            const s = STEPS[i];
            const done = i < this.placed;
            const isNext = i === this.placed;
            c.fillStyle = done ? "#fff" : isNext ? "#fef3c7" : "rgba(255,255,255,0.4)";
            c.strokeStyle = isNext ? "#f59e0b" : "#fdba74";
            c.lineWidth = isNext ? 4 : 2;
            c.beginPath();
            c.arc(s.x, s.y, 44, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.textAlign = "center";
            if (done) {
                c.font = "34px serif";
                c.fillText(s.emoji, s.x, s.y + 12);
                c.fillStyle = "#9a3412";
                c.font = "bold 12px Nunito, sans-serif";
                c.fillText(s.name, s.x, s.y + 58);
            }
            else {
                c.fillStyle = isNext ? "#b45309" : "#94a3b8";
                c.font = "bold 22px Nunito, sans-serif";
                c.fillText(isNext ? "?" : String(i + 1), s.x, s.y + 8);
            }
        }
        c.fillStyle = "#9a3412";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Trace the food's journey through the body 🍎", W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.placed = 0;
        this.mistakes = 0;
        this.tray = [...STEPS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const digestionGame = {
    meta: {
        id: "digestion",
        conceptId: "bio-23",
        title: "Food Journey",
        stream: "biology",
        gradeBand: "3-4",
        emoji: "🍎",
        blurb: "Follow a bite of food on its journey through the digestive system.",
        mission: "Put the stops of digestion in the right order.",
        estMinutes: 2,
    },
    create: (ctx) => new Digestion(ctx),
};
