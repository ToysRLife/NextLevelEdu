import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
class Ecosystem {
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
        Object.defineProperty(this, "plants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 80
        });
        Object.defineProperty(this, "rabbits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 70
        });
        Object.defineProperty(this, "foxes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60
        });
        Object.defineProperty(this, "hold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "balanceEl", {
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
            "In an ecosystem, living things depend on each other. Plants feed plant-eaters, which feed predators.",
            "It forms a pyramid: lots of plants at the bottom, fewer plant-eaters above, and fewest predators at the top.",
            "Each level should be smaller than the one below — about half. Too many foxes starve; too few plants and the rabbits go hungry.",
        ]);
        this.renderLoop();
    }
    balanced() {
        const { plants: P, rabbits: R, foxes: F } = this;
        return P >= 50 && R >= P * 0.3 && R <= P * 0.6 && F >= R * 0.3 && F <= R * 0.6;
    }
    feedback() {
        const { plants: P, rabbits: R, foxes: F } = this;
        if (P < 50)
            return "🌿 Not enough plants — grow more to feed the ecosystem.";
        if (R < P * 0.3)
            return "🐰 Too few rabbits for all these plants — add some plant-eaters.";
        if (R > P * 0.6)
            return "🐰 Too many rabbits — they'll eat all the plants. Fewer rabbits or more plants.";
        if (F < R * 0.3)
            return "🦊 Too few foxes — rabbits will overrun the land. Add a few predators.";
        if (F > R * 0.6)
            return "🦊 Too many foxes — they'll eat all the rabbits and then starve.";
        return "✅ Balanced! A healthy pyramid: most plants, fewer rabbits, fewest foxes.";
    }
    slider(label, accent, get, set) {
        const input = el("input", {
            type: "range",
            min: "0",
            max: "100",
            value: String(get()),
            "aria-label": label,
            style: { accentColor: accent },
            oninput: (e) => {
                set(Number(e.target.value));
                this.updateReadout();
            },
        });
        return el("div", {}, el("div", { class: "control-label" }, label), input);
    }
    buildPanel() {
        this.balanceEl = el("span", {}, "");
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Balance the pyramid")), this.slider("🌿 Plants", "#22c55e", () => this.plants, (v) => (this.plants = v)), this.slider("🐰 Rabbits", "#f59e0b", () => this.rabbits, (v) => (this.rabbits = v)), this.slider("🦊 Foxes", "#ef4444", () => this.foxes, (v) => (this.foxes = v)), el("div", { class: "metric" }, el("span", {}, "⚖️ Status"), this.balanceEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const ok = this.balanced();
        this.balanceEl.textContent = ok ? "balanced ✅" : "unbalanced";
        this.balanceEl.style.color = ok ? "var(--accent-green)" : "var(--accent-red)";
        this.coachEl.textContent = this.feedback();
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (!this.ended) {
                if (this.balanced()) {
                    this.hold += 1;
                    if (this.hold > byTier(this.ctx.tier, 34, 48, 64))
                        this.win();
                }
                else {
                    this.hold = 0;
                }
            }
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    win() {
        this.ended = true;
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("ecosystem_done", {});
        this.ctx.services.outcome.succeed({
            message: "A thriving ecosystem! Living things depend on each other in a pyramid — many plants feed fewer plant-eaters, which feed even fewer predators. Balance keeps it healthy.",
            stars,
            resources: { Biomass: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#dbeafe");
        grad.addColorStop(1, "#dcfce7");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        // pyramid tiers (width ∝ population)
        const tiers = [
            { pop: this.plants, color: "#22c55e", emoji: "🌿", name: "Plants" },
            { pop: this.rabbits, color: "#f59e0b", emoji: "🐰", name: "Rabbits" },
            { pop: this.foxes, color: "#ef4444", emoji: "🦊", name: "Foxes" },
        ];
        const baseY = 480;
        const tierH = 90;
        for (let i = 0; i < tiers.length; i++) {
            const t = tiers[i];
            const wdt = 80 + (t.pop / 100) * 360;
            const y = baseY - (i + 1) * tierH;
            c.fillStyle = t.color;
            this.roundRect(c, W / 2 - wdt / 2, y, wdt, tierH - 10, 10);
            c.globalAlpha = 0.9;
            c.fill();
            c.globalAlpha = 1;
            // emojis across the tier showing count
            c.font = "22px serif";
            c.textAlign = "center";
            const n = Math.max(1, Math.round(t.pop / 14));
            for (let k = 0; k < n; k++) {
                const ex = W / 2 - wdt / 2 + 20 + ((wdt - 40) * (k + 0.5)) / n;
                c.fillText(t.emoji, ex, y + 50);
            }
            c.fillStyle = "#fff";
            c.font = "bold 14px Nunito, sans-serif";
            c.fillText(`${t.name}: ${t.pop}`, W / 2, y + tierH - 22);
        }
        // status banner
        const ok = this.balanced();
        c.fillStyle = ok ? "#16a34a" : "#b91c1c";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(ok ? "Ecosystem balanced! ⚖️" : "Balance the food pyramid", W / 2, 50);
        if (this.hold > 0 && !this.ended) {
            c.fillStyle = "#16a34a";
            c.font = "bold 14px Nunito, sans-serif";
            c.fillText("holding steady…", W / 2, 76);
        }
    }
    roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
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
        this.plants = 80;
        this.rabbits = 70;
        this.foxes = 60;
        this.hold = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const ecosystemGame = {
    meta: {
        id: "ecosystem",
        conceptId: "bio-25",
        title: "Balance the Ecosystem",
        stream: "biology",
        gradeBand: "5",
        emoji: "⚖️",
        blurb: "Adjust plants, plant-eaters, and predators into a healthy, balanced pyramid.",
        mission: "Set the populations so the ecosystem forms a stable food pyramid.",
        estMinutes: 3,
    },
    create: (ctx) => new Ecosystem(ctx),
};
