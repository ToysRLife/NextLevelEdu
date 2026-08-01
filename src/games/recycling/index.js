import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const BINS = [
    { key: "paper", label: "Paper", emoji: "📄", color: "#3b82f6" },
    { key: "plastic", label: "Plastic", emoji: "🧴", color: "#f59e0b" },
    { key: "glass", label: "Glass", emoji: "🫙", color: "#10b981" },
    { key: "metal", label: "Metal", emoji: "🥫", color: "#64748b" },
    { key: "compost", label: "Compost", emoji: "🍎", color: "#84cc16" },
];
const ITEMS = [
    { emoji: "📰", name: "Newspaper", bin: "paper" },
    { emoji: "📦", name: "Cardboard box", bin: "paper" },
    { emoji: "🧴", name: "Shampoo bottle", bin: "plastic" },
    { emoji: "🛍️", name: "Plastic bag", bin: "plastic" },
    { emoji: "🫙", name: "Glass jar", bin: "glass" },
    { emoji: "🍾", name: "Glass bottle", bin: "glass" },
    { emoji: "🥫", name: "Tin can", bin: "metal" },
    { emoji: "🥤", name: "Soda can", bin: "metal" },
    { emoji: "🍌", name: "Banana peel", bin: "compost" },
    { emoji: "🍎", name: "Apple core", bin: "compost" },
];
class Recycling {
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
        Object.defineProperty(this, "flyTo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
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
            "Recycling turns used materials into new things instead of throwing them away — saving resources.",
            "Sort by what the item is MADE of: paper, plastic, glass, or metal. Food scraps go to compost.",
            "Cans are metal, bottles and jars are glass, boxes and newspaper are paper, and peels and cores compost.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const binRow = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...BINS.map((b) => el("button", { class: "chip", onclick: () => this.sort(b.key) }, `${b.emoji} ${b.label}`)));
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${ITEMS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Which bin does this belong in? Sort by what it's made of.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Sort all 10 items")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drop it in the right bin"), binRow, el("div", { class: "metric" }, el("span", {}, "♻️ Item"), this.progressEl), this.coachEl);
    }
    sort(bin) {
        if (this.ended)
            return;
        const item = this.current();
        const target = BINS.find((b) => b.key === bin);
        if (bin === item.bin) {
            this.flash = 1;
            this.flyTo = { x: this.binX(bin), color: target.color };
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${item.name} is ${bin} — nicely sorted!`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${item.name} isn't ${bin}. It's made of ${item.bin}.`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${ITEMS.length}`;
        }
    }
    binX(bin) {
        const i = BINS.findIndex((b) => b.key === bin);
        return 110 + i * 145;
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("recycling_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Great sorting! Recycling gives materials a second life — paper, plastic, glass, and metal become new things, and food scraps become compost for soil.",
            stars,
            resources: { Materials: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.flash > 0)
                this.flash = Math.max(0, this.flash - 0.04);
            if (this.flash < 0)
                this.flash = Math.min(0, this.flash + 0.04);
            if (this.flash === 0)
                this.flyTo = null;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#ecfdf5";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#166534";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Everything recycled! ♻️", W / 2, H / 2);
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
        const item = this.current();
        // conveyor belt
        const beltY = 250;
        c.fillStyle = "#475569";
        c.fillRect(0, beltY, W, 60);
        c.fillStyle = "#334155";
        for (let x = 0; x < W; x += 30) {
            const off = (x + this.anim * 30) % W;
            c.fillRect(off, beltY, 14, 60);
        }
        // current item on belt (or flying to bin)
        const itemY = this.flyTo
            ? beltY - 40 + this.flash * 0
            : beltY - 30 + Math.sin(this.anim * 2) * 4;
        const itemX = this.flyTo ? this.flyTo.x : W / 2;
        c.font = "70px serif";
        c.textAlign = "center";
        c.fillText(item.emoji, itemX, itemY);
        if (!this.flyTo) {
            c.fillStyle = "#166534";
            c.font = "bold 20px Nunito, sans-serif";
            c.fillText(item.name, W / 2, beltY - 90);
        }
        // bins
        for (let i = 0; i < BINS.length; i++) {
            const b = BINS[i];
            const x = 110 + i * 145;
            const y = 430;
            c.fillStyle = b.color;
            this.roundRect(c, x - 55, y, 110, 120, 12);
            c.fill();
            c.fillStyle = "rgba(255,255,255,0.85)";
            this.roundRect(c, x - 55, y, 110, 30, 12);
            c.fill();
            c.font = "40px serif";
            c.textAlign = "center";
            c.fillText(b.emoji, x, y + 80);
            c.fillStyle = "#fff";
            c.font = "bold 14px Nunito, sans-serif";
            c.fillText(b.label, x, y + 108);
        }
        c.fillStyle = "#166534";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Sort the waste into the right bin ♻️", W / 2, 50);
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
        this.flyTo = null;
        this.order = [...ITEMS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const recyclingGame = {
    meta: {
        id: "recycling",
        conceptId: "chem-25",
        title: "Sort It Right",
        stream: "chemistry",
        gradeBand: "2-4",
        emoji: "♻️",
        blurb: "Sort the waste streaming down the belt into paper, plastic, glass, metal, and compost.",
        mission: "Recycle every item by sorting it into the correct bin.",
        estMinutes: 2,
    },
    create: (ctx) => new Recycling(ctx),
};
