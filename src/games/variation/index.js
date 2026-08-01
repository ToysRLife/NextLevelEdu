import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const POS = [170, 330, 490, 650];
const CY = 320;
const ROUNDS = [
    {
        prompt: "the BIGGEST puppy",
        pups: [
            { size: 38, color: "#b45309", spotted: false },
            { size: 56, color: "#b45309", spotted: false },
            { size: 44, color: "#b45309", spotted: false },
            { size: 33, color: "#b45309", spotted: false },
        ],
        answer: 1,
        why: "Even in the same litter, pups come in different sizes — that's variation.",
    },
    {
        prompt: "the SMALLEST puppy",
        pups: [
            { size: 50, color: "#92400e", spotted: false },
            { size: 44, color: "#92400e", spotted: false },
            { size: 58, color: "#92400e", spotted: false },
            { size: 34, color: "#92400e", spotted: false },
        ],
        answer: 3,
        why: "Size varies between individuals of the same kind.",
    },
    {
        prompt: "the SPOTTED puppy",
        pups: [
            { size: 46, color: "#a16207", spotted: false },
            { size: 46, color: "#a16207", spotted: false },
            { size: 46, color: "#a16207", spotted: true },
            { size: 46, color: "#a16207", spotted: false },
        ],
        answer: 2,
        why: "Markings vary too — only one of these has spots.",
    },
    {
        prompt: "the DARKEST puppy",
        pups: [
            { size: 46, color: "#d6a55c", spotted: false },
            { size: 46, color: "#8a5a1e", spotted: false },
            { size: 46, color: "#4a2f12", spotted: false },
            { size: 46, color: "#b07a36", spotted: false },
        ],
        answer: 2,
        why: "Colour varies — these pups are the same kind but different shades.",
    },
];
class Variation {
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
        Object.defineProperty(this, "detach", {
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
        this.order = [...ROUNDS].sort(() => Math.random() - 0.5);
        this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
        this.buildPanel();
        ctx.services.hints.setHints([
            "Living things of the same kind are not all identical — they vary in size, colour, and markings.",
            "These are all puppies, but each one is a little different. That's called variation.",
            "Look closely and tap the one the question describes.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = `Tap ${this.current().prompt}.`;
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "👉 Find"), el("span", {}, this.current().prompt)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap it among the puppies"), el("div", { class: "metric" }, el("span", {}, "🐶 Round"), this.progressEl), this.coachEl);
    }
    tap(p) {
        if (this.ended)
            return;
        for (let i = 0; i < 4; i++) {
            if (Math.hypot(p.x - POS[i], p.y - CY) < this.current().pups[i].size + 14) {
                if (i === this.current().answer) {
                    this.flash = 1;
                    this.ctx.services.audio.play("tick");
                    this.coachEl.textContent = `✅ ${this.current().why}`;
                    this.next();
                }
                else {
                    this.flash = -1;
                    this.mistakes += 1;
                    this.ctx.services.audio.play("fail");
                    this.coachEl.textContent = `❌ Look again — find ${this.current().prompt}.`;
                }
                return;
            }
        }
    }
    next() {
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${ROUNDS.length} / ${ROUNDS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${ROUNDS.length}`;
            this.buildPanel();
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
        this.ctx.services.score.event("variation_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Spot on! Living things of the same kind still vary — different sizes, colours, and markings. That variation makes every individual unique.",
            stars,
            resources: { Biomass: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.flash > 0)
                this.flash = Math.max(0, this.flash - 0.04);
            if (this.flash < 0)
                this.flash = Math.min(0, this.flash + 0.04);
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
            c.fillText("You spotted the differences! 🐶", W / 2, H / 2);
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
        const r = this.current();
        for (let i = 0; i < 4; i++) {
            const pup = r.pups[i];
            const x = POS[i], y = CY + Math.sin(this.anim + i) * 4;
            // body
            c.fillStyle = pup.color;
            c.beginPath();
            c.arc(x, y, pup.size, 0, Math.PI * 2);
            c.fill();
            // ears
            c.beginPath();
            c.ellipse(x - pup.size * 0.7, y - pup.size * 0.4, pup.size * 0.3, pup.size * 0.5, -0.4, 0, Math.PI * 2);
            c.ellipse(x + pup.size * 0.7, y - pup.size * 0.4, pup.size * 0.3, pup.size * 0.5, 0.4, 0, Math.PI * 2);
            c.fill();
            // eyes + nose
            c.fillStyle = "#1e293b";
            c.beginPath();
            c.arc(x - pup.size * 0.3, y - pup.size * 0.1, 4, 0, Math.PI * 2);
            c.arc(x + pup.size * 0.3, y - pup.size * 0.1, 4, 0, Math.PI * 2);
            c.fill();
            c.beginPath();
            c.arc(x, y + pup.size * 0.2, 5, 0, Math.PI * 2);
            c.fill();
            // spots
            if (pup.spotted) {
                c.fillStyle = "rgba(0,0,0,0.35)";
                c.beginPath();
                c.arc(x - 10, y + 8, 7, 0, Math.PI * 2);
                c.arc(x + 14, y - 6, 5, 0, Math.PI * 2);
                c.fill();
            }
        }
        c.fillStyle = "#166534";
        c.font = "bold 20px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`Tap ${r.prompt}`, W / 2, 80);
        c.font = "14px Nunito, sans-serif";
        c.fillText("They're all the same kind — but each is a little different!", W / 2, 110);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.mistakes = 0;
        this.flash = 0;
        this.order = [...ROUNDS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const variationGame = {
    meta: {
        id: "variation",
        conceptId: "bio-19",
        title: "Spot the Difference",
        stream: "biology",
        gradeBand: "3",
        emoji: "🐶",
        blurb: "Find the puppy that matches each clue — and see how the same kind of animal varies.",
        mission: "Pick out the puppy described in each round.",
        estMinutes: 2,
    },
    create: (ctx) => new Variation(ctx),
};
