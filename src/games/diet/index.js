import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ANIMALS = [
    {
        name: "Rabbit",
        emoji: "🐰",
        diet: "herbivore",
        why: "Rabbits eat only plants — they're herbivores.",
    },
    { name: "Cow", emoji: "🐮", diet: "herbivore", why: "Cows graze on grass — herbivores." },
    { name: "Deer", emoji: "🦌", diet: "herbivore", why: "Deer eat leaves and plants — herbivores." },
    { name: "Lion", emoji: "🦁", diet: "carnivore", why: "Lions hunt and eat meat — carnivores." },
    { name: "Shark", emoji: "🦈", diet: "carnivore", why: "Sharks eat other animals — carnivores." },
    { name: "Eagle", emoji: "🦅", diet: "carnivore", why: "Eagles catch and eat prey — carnivores." },
    { name: "Bear", emoji: "🐻", diet: "omnivore", why: "Bears eat berries AND fish — omnivores." },
    { name: "Pig", emoji: "🐷", diet: "omnivore", why: "Pigs eat plants and meat — omnivores." },
];
class DietGame {
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
        this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Animals are grouped by what they eat.",
            "Herbivores eat only plants, carnivores eat only meat, and omnivores eat both.",
            "Rabbits and cows are herbivores; lions and sharks are carnivores; bears and pigs are omnivores.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const choices = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, el("button", {
            class: "btn",
            style: { background: "var(--accent-green)" },
            onclick: () => this.choose("herbivore"),
        }, "🌿 Herbivore"), el("button", {
            class: "btn",
            style: { background: "var(--accent-red)" },
            onclick: () => this.choose("carnivore"),
        }, "🍖 Carnivore"), el("button", {
            class: "btn",
            style: { background: "var(--accent-orange)" },
            onclick: () => this.choose("omnivore"),
        }, "🍽️ Omnivore"));
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${ANIMALS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "What does this animal eat?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Sort all 8 by diet")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick its diet"), choices, el("div", { class: "metric" }, el("span", {}, "🍽️ Animal"), this.progressEl), this.coachEl);
    }
    choose(d) {
        if (this.ended)
            return;
        const a = this.current();
        if (d === a.diet) {
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
            this.progressEl.textContent = `${ANIMALS.length} / ${ANIMALS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${ANIMALS.length}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("diet_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Dinner sorted! Herbivores eat only plants, carnivores eat only meat, and omnivores eat both.",
            stars,
            resources: { Biomass: 40 },
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
            c.fillText("Everyone's fed! 🍽️", W / 2, H / 2);
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
        const a = this.current();
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
        c.fillText(a.emoji, cx, cy + 20);
        c.fillStyle = "#166534";
        c.font = "bold 26px Nunito, sans-serif";
        c.fillText(a.name, cx, cy + 100);
        c.fillStyle = "#166534";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText("What's for dinner? 🍽️", W / 2, 60);
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
        this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const dietGame = {
    meta: {
        id: "diet",
        conceptId: "bio-12",
        title: "What's for Dinner",
        stream: "biology",
        gradeBand: "2-3",
        emoji: "🍽️",
        blurb: "Sort animals into herbivores, carnivores, and omnivores by what they eat.",
        mission: "Match every animal to the right diet.",
        estMinutes: 2,
    },
    create: (ctx) => new DietGame(ctx),
};
