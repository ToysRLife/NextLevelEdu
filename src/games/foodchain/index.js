import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
// Energy flows from the Sun up through producers and consumers.
const CHAIN = [
    { key: "sun", name: "Sun", emoji: "☀️", role: "the source of all the energy" },
    { key: "grass", name: "Grass", emoji: "🌱", role: "a producer — makes food from sunlight" },
    { key: "grasshopper", name: "Grasshopper", emoji: "🦗", role: "eats plants (primary consumer)" },
    { key: "frog", name: "Frog", emoji: "🐸", role: "eats insects (secondary consumer)" },
    { key: "snake", name: "Snake", emoji: "🐍", role: "eats frogs (tertiary consumer)" },
    { key: "hawk", name: "Hawk", emoji: "🦅", role: "the top predator" },
];
class FoodChain {
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
        this.tray = [...CHAIN].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "A food chain shows how energy passes from one living thing to the next as they eat.",
            "It always starts with the Sun, then a plant (producer), then animals that eat the one before.",
            "Order: Sun → grass → grasshopper → frog → snake → hawk. Each arrow means 'energy passes to'.",
        ]);
        this.renderLoop();
    }
    buildPanel() {
        const next = CHAIN[this.placed];
        const trayChips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...this.tray.map((l) => el("button", { class: "chip", onclick: () => this.pick(l.key) }, `${l.emoji} ${l.name}`)));
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.placed} / ${CHAIN.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = next
            ? `What comes next in the chain (link #${this.placed + 1})?`
            : "Chain complete!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Build the food chain")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the next link (energy flows up)"), trayChips, el("div", { class: "metric" }, el("span", {}, "🔗 Links placed"), this.statusEl), this.coachEl);
    }
    pick(key) {
        if (this.ended)
            return;
        const correct = CHAIN[this.placed];
        if (key === correct.key) {
            this.placed += 1;
            this.tray = this.tray.filter((l) => l.key !== key);
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${correct.name} — ${correct.role}.`;
            if (this.placed >= CHAIN.length)
                this.win();
            else
                this.buildPanel();
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            const picked = CHAIN.find((l) => l.key === key);
            this.coachEl.textContent = `❌ Not ${picked.name} yet. Think about what eats the link before it. Next is ${correct.role}.`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("foodchain_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Chain complete! Energy flows from the Sun to plants and up through the animals that eat them. Remove any link and everything above it would go hungry.",
            stars,
            resources: { Biomass: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.06;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#bbf7d0");
        grad.addColorStop(1, "#dcfce7");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        // chain laid out in a zig-zag of 6 slots
        const cols = 3;
        for (let i = 0; i < CHAIN.length; i++) {
            const row = Math.floor(i / cols);
            let col = i % cols;
            if (row % 2 === 1)
                col = cols - 1 - col; // snake layout
            const x = 160 + col * 240;
            const y = 200 + row * 200;
            const placed = i < this.placed;
            const isNext = i === this.placed;
            // arrow from previous
            if (i > 0) {
                const prow = Math.floor((i - 1) / cols);
                let pcol = (i - 1) % cols;
                if (prow % 2 === 1)
                    pcol = cols - 1 - pcol;
                const px = 160 + pcol * 240;
                const py = 200 + prow * 200;
                if (placed) {
                    c.strokeStyle = "#f59e0b";
                    c.lineWidth = 4;
                    c.setLineDash([10, 6]);
                    c.lineDashOffset = -this.anim * 8;
                    c.beginPath();
                    c.moveTo(px, py);
                    c.lineTo(x, y);
                    c.stroke();
                    c.setLineDash([]);
                }
            }
            // node
            c.fillStyle = placed ? "#fff" : isNext ? "#fef9c3" : "rgba(255,255,255,0.4)";
            c.strokeStyle = isNext ? "#22c55e" : "#86efac";
            c.lineWidth = isNext ? 4 : 2;
            c.beginPath();
            c.arc(x, y, 56, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.textAlign = "center";
            if (placed) {
                c.font = "52px serif";
                c.fillText(CHAIN[i].emoji, x, y + 16);
                c.fillStyle = "#166534";
                c.font = "bold 14px Nunito, sans-serif";
                c.fillText(CHAIN[i].name, x, y + 78);
            }
            else {
                c.fillStyle = isNext ? "#15803d" : "#94a3b8";
                c.font = "bold 28px Nunito, sans-serif";
                c.fillText(isNext ? "?" : String(i + 1), x, y + 10);
            }
        }
        c.fillStyle = "#166534";
        c.font = "bold 20px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Build the food chain — energy flows along the arrows", W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.placed = 0;
        this.mistakes = 0;
        this.tray = [...CHAIN].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const foodChainGame = {
    meta: {
        id: "foodchain",
        conceptId: "bio-13",
        title: "Who Eats Whom",
        stream: "biology",
        gradeBand: "3-4",
        emoji: "🦗",
        blurb: "Order the living things to show how energy flows up a food chain.",
        mission: "Build the food chain from the Sun up to the top predator.",
        estMinutes: 3,
    },
    create: (ctx) => new FoodChain(ctx),
};
