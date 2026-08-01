import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ITEMS = [
    {
        name: "Fruit salad",
        emoji: "🥗",
        mixture: true,
        why: "You can pick the pieces back out — it's a mixture.",
    },
    {
        name: "Trail mix",
        emoji: "🥜",
        mixture: true,
        why: "The nuts and raisins keep their own properties — a mixture.",
    },
    {
        name: "Sand + iron filings",
        emoji: "🧲",
        mixture: true,
        why: "A magnet pulls the iron out — they were just mixed, not joined.",
    },
    {
        name: "Salt in water",
        emoji: "🧂",
        mixture: true,
        why: "Evaporate the water and the salt comes back — it's a mixture (a solution).",
    },
    {
        name: "Cereal + milk",
        emoji: "🥣",
        mixture: true,
        why: "The cereal and milk stay themselves — a mixture.",
    },
    {
        name: "Baked cake",
        emoji: "🎂",
        mixture: false,
        why: "Baking made a brand-new substance — you can't get the eggs and flour back.",
    },
    {
        name: "Burnt toast",
        emoji: "🍞",
        mixture: false,
        why: "Burning created new stuff (carbon) — not a mixture you can separate.",
    },
    {
        name: "Cooked egg",
        emoji: "🍳",
        mixture: false,
        why: "Cooking changed the egg into a new substance for good.",
    },
];
class MixItUp {
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
        this.order = [...ITEMS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "A mixture is two or more things combined but NOT chemically joined — so you can separate them again.",
            "If you can pick, sieve, magnet, or evaporate the parts back out, it's a mixture.",
            "Cooking and burning make brand-new substances you can't separate — those are not mixtures.",
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
        }, "🥣 Mixture"), el("button", {
            class: "btn",
            style: { background: "var(--accent-red)" },
            onclick: () => this.choose(false),
        }, "🆕 New substance"));
        this.progressEl = el("span", { style: { color: "var(--accent-pink)" } }, `${this.idx + 1} / ${ITEMS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
        });
        this.coachEl.textContent = "Can you separate it back into its parts?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🥣 Is it a"), el("span", {}, this.current().name)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Mixture, or a new substance?"), choices, el("div", { class: "metric" }, el("span", {}, "🧪 Item"), this.progressEl), this.coachEl);
    }
    choose(saysMixture) {
        if (this.ended)
            return;
        const it = this.current();
        if (saysMixture === it.mixture) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${it.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${it.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
            this.win();
        }
        else
            this.progressEl.textContent = `${this.idx + 1} / ${ITEMS.length}`;
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("mixitup_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Mix master! A mixture's parts stay themselves, so you can separate them again. Cooking and burning make new substances you can't un-make.",
            stars,
            resources: { Compounds: 40 },
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
        c.fillStyle = "#fdf2f8";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#831843";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All sorted! 🥣", W / 2, H / 2);
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
        const it = this.current();
        const cx = W / 2, cy = 280 + Math.sin(this.anim) * 6;
        c.fillStyle = "#fff";
        c.strokeStyle = "#f9a8d4";
        c.lineWidth = 6;
        this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
        c.fill();
        c.stroke();
        c.font = "120px serif";
        c.textAlign = "center";
        c.fillText(it.emoji, cx, cy + 20);
        c.fillStyle = "#831843";
        c.font = "bold 24px Nunito, sans-serif";
        c.fillText(it.name, cx, cy + 100);
        c.fillStyle = "#831843";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText("Can you separate it back out? 🥣", W / 2, 60);
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
        this.order = [...ITEMS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const mixItUpGame = {
    meta: {
        id: "mixitup",
        conceptId: "chem-10",
        title: "Mix It Up",
        stream: "chemistry",
        gradeBand: "5",
        emoji: "🥣",
        blurb: "Decide which things are mixtures you can separate and which are brand-new substances.",
        mission: "Sort each one into mixture or new substance.",
        estMinutes: 2,
    },
    create: (ctx) => new MixItUp(ctx),
};
