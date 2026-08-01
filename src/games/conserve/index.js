import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ACTIONS = [
    {
        text: "Turn off lights you're not using",
        emoji: "💡",
        helps: true,
        why: "Saving electricity helps the planet.",
    },
    {
        text: "Recycle bottles and paper",
        emoji: "♻️",
        helps: true,
        why: "Recycling reuses materials instead of wasting them.",
    },
    {
        text: "Plant a tree",
        emoji: "🌳",
        helps: true,
        why: "Trees clean the air and give homes to animals.",
    },
    {
        text: "Ride a bike instead of a car",
        emoji: "🚲",
        helps: true,
        why: "Bikes don't pollute — better for the air.",
    },
    {
        text: "Leave the tap running",
        emoji: "🚿",
        helps: false,
        why: "Running the tap wastes precious clean water.",
    },
    {
        text: "Drop litter on the ground",
        emoji: "🗑️",
        helps: false,
        why: "Litter harms animals and pollutes nature.",
    },
    {
        text: "Throw away food you didn't eat",
        emoji: "🍽️",
        helps: false,
        why: "Wasting food wastes all the water and energy used to grow it.",
    },
    {
        text: "Leave the TV on all night",
        emoji: "📺",
        helps: false,
        why: "Leaving things on wastes electricity.",
    },
];
class Conserve {
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
        this.order = [...ACTIONS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Conservation means looking after our planet by not wasting its resources.",
            "Helpful habits save energy, water, and materials. Wasteful ones throw them away or pollute.",
            "Ask: does this save resources and protect nature, or waste and harm them?",
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
        }, "🌍 Helps the planet"), el("button", {
            class: "btn",
            style: { background: "var(--accent-red)" },
            onclick: () => this.choose(false),
        }, "🚯 Wastes / harms"));
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${ACTIONS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Is this good or bad for the planet?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🌍 Action"), el("span", {}, `${this.idx + 1}/${ACTIONS.length}`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Helps or harms the planet?"), choices, el("div", { class: "metric" }, el("span", {}, "♻️ Habit"), this.progressEl), this.coachEl);
    }
    choose(saysHelps) {
        if (this.ended)
            return;
        const a = this.current();
        if (saysHelps === a.helps) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${a.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${a.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${ACTIONS.length} / ${ACTIONS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${ACTIONS.length}`;
            this.buildPanel();
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("conserve_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Planet protector! Conservation means saving energy, water, and materials — and not polluting — so Earth stays healthy for everyone.",
            stars,
            resources: { Climate: 40 },
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
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#bbf7d0");
        grad.addColorStop(1, "#dbeafe");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#166534";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Planet protected! 🌍", W / 2, H / 2);
            return;
        }
        if (this.flash > 0) {
            c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
            c.fillRect(0, 0, W, H);
        }
        else if (this.flash < 0) {
            c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
            c.fillRect(0, 0, W, H);
        }
        // earth
        c.fillStyle = "#2f6fb0";
        c.beginPath();
        c.arc(W / 2, 200, 64, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3f8f4f";
        c.beginPath();
        c.arc(W / 2 - 18, 186, 22, 0, Math.PI * 2);
        c.arc(W / 2 + 22, 214, 16, 0, Math.PI * 2);
        c.fill();
        c.font = "40px serif";
        c.textAlign = "center";
        c.fillText(this.current().emoji, W / 2, 214);
        const a = this.current();
        c.fillStyle = "#fff";
        c.strokeStyle = "#86efac";
        c.lineWidth = 5;
        this.roundRect(c, W / 2 - 270, 320, 540, 90, 16);
        c.fill();
        c.stroke();
        c.fillStyle = "#166534";
        c.font = "bold 21px Nunito, sans-serif";
        c.textAlign = "center";
        this.wrap(c, a.text, W / 2, 360, 500, 28);
        c.fillStyle = "#166534";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText("Good for the planet — or not? 🌍", W / 2, 60);
    }
    wrap(c, text, x, y, maxW, lh) {
        const words = text.split(" ");
        let line = "";
        let yy = y;
        for (const w of words) {
            const t = line ? `${line} ${w}` : w;
            if (c.measureText(t).width > maxW && line) {
                c.fillText(line, x, yy);
                line = w;
                yy += lh;
            }
            else
                line = t;
        }
        c.fillText(line, x, yy);
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
        this.order = [...ACTIONS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const conserveGame = {
    meta: {
        id: "conserve",
        conceptId: "ess-22",
        title: "Planet Protector",
        stream: "earth-space",
        gradeBand: "2-5",
        emoji: "🌍",
        blurb: "Sort everyday habits into ones that help the planet and ones that waste or harm it.",
        mission: "Decide whether each habit helps or harms the environment.",
        estMinutes: 2,
    },
    create: (ctx) => new Conserve(ctx),
};
