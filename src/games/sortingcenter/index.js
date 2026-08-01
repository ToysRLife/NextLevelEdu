import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const START = { x: W / 2, y: 520 };
const ITEMS = [
    { name: "Key", emoji: "🔑", metal: true },
    { name: "Spoon", emoji: "🥄", metal: true },
    { name: "Can", emoji: "🥫", metal: true },
    { name: "Coin", emoji: "🪙", metal: true },
    { name: "Book", emoji: "📕", metal: false },
    { name: "Apple", emoji: "🍎", metal: false },
    { name: "Ball", emoji: "⚽", metal: false },
    { name: "Sock", emoji: "🧦", metal: false },
];
const BIN_METAL = { x: 60, y: 110, w: 300, h: 150 };
const BIN_NOT = { x: 440, y: 110, w: 300, h: 150 };
class SortingCenter {
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
        Object.defineProperty(this, "tok", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { x: START.x, y: START.y }
        });
        Object.defineProperty(this, "dragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
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
        this.detach = onPointer(ctx.canvas, W, H, {
            down: (p) => {
                if (Math.hypot(p.x - this.tok.x, p.y - this.tok.y) < 46)
                    this.dragging = true;
            },
            move: (p) => {
                if (this.dragging) {
                    this.tok.x = p.x;
                    this.tok.y = p.y;
                }
            },
            up: (p) => {
                if (this.dragging) {
                    this.dragging = false;
                    this.drop(p);
                }
            },
        });
        this.buildPanel();
        ctx.services.hints.setHints([
            "We can group objects by a shared property — here, what they're made of.",
            "Metal objects are often shiny, hard, and cold to the touch.",
            "Drag each thing into the metal bin or the not-metal bin.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        this.progressEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.idx + 1} / ${ITEMS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Drag the object into the right bin: metal or not.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Sort by"), el("span", {}, "Made of metal?")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag into the matching bin"), el("div", { class: "metric" }, el("span", {}, "📦 Object"), this.progressEl), this.coachEl);
    }
    inBin(p, b) {
        return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    }
    drop(p) {
        if (this.ended)
            return;
        const it = this.current();
        let chosen = null;
        if (this.inBin(p, BIN_METAL))
            chosen = true;
        else if (this.inBin(p, BIN_NOT))
            chosen = false;
        if (chosen === null) {
            this.tok = { x: START.x, y: START.y };
            return;
        }
        if (chosen === it.metal) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${it.name} is ${it.metal ? "metal" : "not metal"}.`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${it.name} is ${it.metal ? "metal" : "not metal"}.`;
        }
        this.idx += 1;
        this.tok = { x: START.x, y: START.y };
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
        this.ctx.services.score.event("sortingcenter_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Sorted! Grouping things by a property — like what they're made of — helps us organise and understand them.",
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
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#fff7ed";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#9a3412";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All sorted! 📦", W / 2, H / 2);
            return;
        }
        const bin = (b, label, color) => {
            c.fillStyle = color;
            c.globalAlpha = 0.85;
            this.roundRect(c, b.x, b.y, b.w, b.h, 16);
            c.fill();
            c.globalAlpha = 1;
            c.fillStyle = "#fff";
            c.font = "bold 22px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 8);
        };
        bin(BIN_METAL, "🔩 Metal", "#64748b");
        bin(BIN_NOT, "🚫 Not metal", "#a78bfa");
        const it = this.current();
        c.fillStyle = "#fff";
        c.strokeStyle = this.dragging ? "#22c55e" : "#fdba74";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(this.tok.x, this.tok.y, 42, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.font = "46px serif";
        c.textAlign = "center";
        c.fillText(it.emoji, this.tok.x, this.tok.y + 16);
        if (!this.dragging) {
            c.fillStyle = "#9a3412";
            c.font = "bold 16px Nunito, sans-serif";
            c.fillText(`Drag the ${it.name}`, this.tok.x, this.tok.y + 66);
        }
        c.fillStyle = "#9a3412";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Sort by what it's made of 📦", W / 2, 50);
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
        this.tok = { x: START.x, y: START.y };
        this.dragging = false;
        this.order = [...ITEMS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const sortingCenterGame = {
    meta: {
        id: "sortingcenter",
        conceptId: "chem-16",
        title: "Sorting Center",
        stream: "chemistry",
        gradeBand: "K-2",
        emoji: "📦",
        blurb: "Drag objects into bins by a shared property — metal or not metal.",
        mission: "Sort every object by what it's made of.",
        estMinutes: 2,
    },
    create: (ctx) => new SortingCenter(ctx),
};
