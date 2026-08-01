import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const CLAIMS = [
    {
        text: "Gives us light to see by day",
        emoji: "☀️",
        yes: true,
        why: "Yes — the Sun lights up the daytime.",
    },
    {
        text: "Warms the Earth with heat",
        emoji: "🔥",
        yes: true,
        why: "Yes — the Sun's heat keeps us warm.",
    },
    {
        text: "Helps plants make food",
        emoji: "🌱",
        yes: true,
        why: "Yes — plants use sunlight to make their food.",
    },
    {
        text: "Dries up wet puddles",
        emoji: "💨",
        yes: true,
        why: "Yes — the Sun's heat evaporates the water.",
    },
    {
        text: "Shines brightly at midnight",
        emoji: "🌙",
        yes: false,
        why: "No — at night your side of Earth faces away from the Sun.",
    },
    {
        text: "Makes ice colder",
        emoji: "❄️",
        yes: false,
        why: "No — the Sun gives heat, which melts ice, not cools it.",
    },
];
class SunHeat {
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
        this.order = [...CLAIMS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "The Sun is our nearest star. It gives Earth two big gifts: light and heat.",
            "Sunlight lets us see and helps plants grow; the Sun's heat warms the land, air, and water.",
            "Remember: the Sun only shines on us during the day, and it warms things rather than cooling them.",
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
        }, "👍 Yes, the Sun"), el("button", { class: "btn secondary", onclick: () => this.choose(false) }, "👎 No"));
        this.progressEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.idx + 1} / ${CLAIMS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Does the Sun really do this?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "☀️ Does the Sun…"), el("span", {}, `${this.idx + 1}/${CLAIMS.length}`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, `${this.current().text}?`), choices, el("div", { class: "metric" }, el("span", {}, "🌞 Claim"), this.progressEl), this.coachEl);
    }
    choose(saysYes) {
        if (this.ended)
            return;
        const cl = this.current();
        if (saysYes === cl.yes) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${cl.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${cl.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${CLAIMS.length} / ${CLAIMS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${CLAIMS.length}`;
            this.buildPanel();
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
        this.ctx.services.score.event("sunheat_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Bright thinking! The Sun gives Earth light and heat — lighting the day, warming the world, and helping plants grow.",
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
        grad.addColorStop(0, "#7dd3fc");
        grad.addColorStop(1, "#fef9c3");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#854d0e";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Sunshine sorted! ☀️", W / 2, H / 2);
            return;
        }
        if (this.flash > 0) {
            c.fillStyle = `rgba(34,197,94,${this.flash * 0.22})`;
            c.fillRect(0, 0, W, H);
        }
        else if (this.flash < 0) {
            c.fillStyle = `rgba(255,90,95,${-this.flash * 0.22})`;
            c.fillRect(0, 0, W, H);
        }
        // sun
        c.fillStyle = "#fbbf24";
        c.beginPath();
        c.arc(W / 2, 200, 70, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(251,191,36,0.6)";
        c.lineWidth = 5;
        for (let i = 0; i < 12; i++) {
            const a = this.anim * 0.3 + (i / 12) * Math.PI * 2;
            c.beginPath();
            c.moveTo(W / 2 + Math.cos(a) * 80, 200 + Math.sin(a) * 80);
            c.lineTo(W / 2 + Math.cos(a) * 105, 200 + Math.sin(a) * 105);
            c.stroke();
        }
        c.font = "60px serif";
        c.textAlign = "center";
        c.fillText(this.current().emoji, W / 2, 220);
        // claim card
        c.fillStyle = "#fff";
        c.strokeStyle = "#fde047";
        c.lineWidth = 5;
        this.roundRect(c, W / 2 - 250, 340, 500, 90, 16);
        c.fill();
        c.stroke();
        c.fillStyle = "#854d0e";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`${this.current().text}?`, W / 2, 392);
        c.fillStyle = "#854d0e";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText("Does the Sun give us this? ☀️", W / 2, 60);
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
        this.order = [...CLAIMS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const sunHeatGame = {
    meta: {
        id: "sunheat",
        conceptId: "ess-04",
        title: "Sunshine",
        stream: "earth-space",
        gradeBand: "K-2",
        emoji: "☀️",
        blurb: "Discover what the Sun gives Earth — light, heat, and the energy plants need.",
        mission: "Decide which things the Sun really does for us.",
        estMinutes: 2,
    },
    create: (ctx) => new SunHeat(ctx),
};
