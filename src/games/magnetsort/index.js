import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ITEMS = [
    {
        name: "Iron nail",
        emoji: "🔩",
        magnetic: true,
        why: "Iron is magnetic — the magnet grabs it.",
    },
    {
        name: "Paperclip",
        emoji: "📎",
        magnetic: true,
        why: "Paperclips are steel (iron), so they stick to magnets.",
    },
    { name: "Steel can", emoji: "🥫", magnetic: true, why: "Steel cans contain iron — magnetic." },
    { name: "Scissors", emoji: "✂️", magnetic: true, why: "The steel blades are magnetic." },
    {
        name: "Plastic toy",
        emoji: "🧸",
        magnetic: false,
        why: "Plastic isn't magnetic — nothing sticks.",
    },
    { name: "Wooden block", emoji: "🪵", magnetic: false, why: "Wood isn't magnetic." },
    { name: "Rubber band", emoji: "⭕", magnetic: false, why: "Rubber isn't magnetic." },
    {
        name: "Gold ring",
        emoji: "💍",
        magnetic: false,
        why: "Most metals (like gold) are NOT magnetic — only iron, steel, nickel are.",
    },
];
class MagnetSort {
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
            "Magnets pull on some materials but not others.",
            "Only a few metals are magnetic: iron, steel, and nickel. Plastic, wood, rubber — and even most metals like gold — are not.",
            "If it's made of iron or steel, the magnet grabs it.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const choices = el("div", { class: "chip-row" }, el("button", {
            class: "btn",
            style: { background: "var(--accent-red)" },
            onclick: () => this.choose(true),
        }, "🧲 Sticks"), el("button", { class: "btn secondary", onclick: () => this.choose(false) }, "🚫 Doesn't stick"));
        this.progressEl = el("span", { style: { color: "var(--accent-red)" } }, `${this.idx + 1} / ${ITEMS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-red)", background: "#fef2f2" },
        });
        this.coachEl.textContent = "Will the magnet stick to this?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🧲 Test"), el("span", {}, this.current().name)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Magnetic or not?"), choices, el("div", { class: "metric" }, el("span", {}, "🔧 Object"), this.progressEl), this.coachEl);
    }
    choose(saysMagnetic) {
        if (this.ended)
            return;
        const it = this.current();
        if (saysMagnetic === it.magnetic) {
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
        this.ctx.services.score.event("magnetsort_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Sorted! Magnets only stick to iron, steel, and a few metals like nickel — not plastic, wood, rubber, or most other metals.",
            stars,
            resources: { Alloy: 40 },
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
        c.fillStyle = "#fef2f2";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#991b1b";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All tested! 🧲", W / 2, H / 2);
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
        c.strokeStyle = "#fca5a5";
        c.lineWidth = 6;
        this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
        c.fill();
        c.stroke();
        c.font = "120px serif";
        c.textAlign = "center";
        c.fillText(it.emoji, cx, cy + 20);
        c.fillStyle = "#991b1b";
        c.font = "bold 26px Nunito, sans-serif";
        c.fillText(it.name, cx, cy + 100);
        // a magnet hovering above
        c.font = "44px serif";
        c.fillText("🧲", cx, cy - 130);
        c.fillStyle = "#991b1b";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText("Does the magnet stick? 🧲", W / 2, 60);
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
export const magnetSortGame = {
    meta: {
        id: "magnetsort",
        conceptId: "phys-06",
        title: "Magnet Test",
        stream: "physics",
        gradeBand: "3",
        emoji: "🧲",
        blurb: "Test objects with a magnet to find which are magnetic.",
        mission: "Sort each object into magnetic or non-magnetic.",
        estMinutes: 2,
    },
    create: (ctx) => new MagnetSort(ctx),
};
