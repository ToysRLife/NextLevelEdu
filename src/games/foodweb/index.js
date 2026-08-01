import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const R = 46; // node radius
// Energy flows FROM the eaten TO the eater. These are the correct links.
const ORGANISMS = [
    { id: "sun", label: "Sun", emoji: "☀️", x: 130, y: 120 },
    { id: "grass", label: "Grass", emoji: "🌿", x: 130, y: 330 },
    { id: "flower", label: "Flowers", emoji: "🌼", x: 130, y: 500 },
    { id: "rabbit", label: "Rabbit", emoji: "🐰", x: 400, y: 230 },
    { id: "grasshopper", label: "Grasshopper", emoji: "🦗", x: 400, y: 470 },
    { id: "fox", label: "Fox", emoji: "🦊", x: 670, y: 230 },
    { id: "frog", label: "Frog", emoji: "🐸", x: 670, y: 470 },
];
const CORRECT = [
    ["sun", "grass"],
    ["sun", "flower"],
    ["grass", "rabbit"],
    ["flower", "grasshopper"],
    ["rabbit", "fox"],
    ["grasshopper", "frog"],
    ["grasshopper", "fox"],
];
function keyOf(a, b) {
    return `${a}->${b}`;
}
class FoodWeb {
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
            value: null
        });
        Object.defineProperty(this, "correctSet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set(CORRECT.map(([a, b]) => keyOf(a, b)))
        });
        Object.defineProperty(this, "placed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "wrongFlash", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dragFrom", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dragPos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "ended", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "mistakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "coachEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "progressEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Energy flows from the eaten to the eater. Drag from a food source to whatever eats it.",
            "Start at the Sun — it feeds the plants. Then plants feed the plant-eaters, who feed the predators.",
            "The fox eats both the rabbit and the grasshopper. The frog eats the grasshopper. Every plant is fed by the Sun.",
        ]);
        this.attach();
        this.renderLoop();
    }
    buildPanel() {
        this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / ${CORRECT.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent =
            "Drag from a food source to the animal that eats it to draw an energy arrow.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "control-label" }, "Build the energy flow"), el("div", { class: "metric" }, el("span", {}, "🔗 Links"), this.progressEl), el("div", { class: "metric" }, el("span", {}, "🌐 How"), el("span", {}, "drag node → node")), this.coachEl);
    }
    nodeAt(p) {
        for (const o of ORGANISMS) {
            if (Math.hypot(o.x - p.x, o.y - p.y) <= R)
                return o;
        }
        return null;
    }
    attach() {
        this.detach = onPointer(this.ctx.canvas, W, H, {
            down: (p) => {
                if (this.ended)
                    return;
                const n = this.nodeAt(p);
                if (n) {
                    this.dragFrom = n;
                    this.dragPos = p;
                }
            },
            move: (p) => {
                if (this.dragFrom)
                    this.dragPos = p;
            },
            up: (p) => {
                if (!this.dragFrom)
                    return;
                const target = this.nodeAt(p);
                if (target && target.id !== this.dragFrom.id)
                    this.tryLink(this.dragFrom.id, target.id);
                this.dragFrom = null;
                this.dragPos = null;
            },
        });
    }
    tryLink(a, b) {
        const k = keyOf(a, b);
        if (this.placed.has(k))
            return;
        if (this.correctSet.has(k)) {
            this.placed.add(k);
            this.ctx.services.audio.play("tick");
            this.progressEl.textContent = `${this.placed.size} / ${CORRECT.length}`;
            if (this.placed.size === this.correctSet.size)
                this.win();
        }
        else {
            this.mistakes += 1;
            this.wrongFlash = { key: k, t: 1 };
            this.ctx.services.audio.play("fail");
            // Reversed link is the classic misconception — name it.
            this.coachEl.textContent = this.correctSet.has(keyOf(b, a))
                ? "⚠️ Energy flows the other way! Drag FROM the food TO the eater."
                : "⚠️ That animal doesn't eat that. Think about who eats whom.";
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("foodweb_complete", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "You mapped the whole food web! Energy flows from the Sun, to plants, to plant-eaters, to predators.",
            stars,
            resources: { Biomass: 50 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.render();
            if (this.wrongFlash) {
                this.wrongFlash.t -= 0.03;
                if (this.wrongFlash.t <= 0)
                    this.wrongFlash = null;
            }
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    node(id) {
        return ORGANISMS.find((o) => o.id === id);
    }
    arrow(c, a, b, color, width) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const sx = a.x + Math.cos(ang) * R;
        const sy = a.y + Math.sin(ang) * R;
        const ex = b.x - Math.cos(ang) * R;
        const ey = b.y - Math.sin(ang) * R;
        c.strokeStyle = color;
        c.fillStyle = color;
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(ex, ey);
        c.stroke();
        c.beginPath();
        c.moveTo(ex, ey);
        c.lineTo(ex - Math.cos(ang - 0.4) * 14, ey - Math.sin(ang - 0.4) * 14);
        c.lineTo(ex - Math.cos(ang + 0.4) * 14, ey - Math.sin(ang + 0.4) * 14);
        c.fill();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#052e16";
        c.fillRect(0, 0, W, H);
        c.fillStyle = "rgba(255,255,255,0.04)";
        for (let i = 0; i < 30; i++)
            c.fillRect((i * 173) % W, (i * 211) % H, 3, 3);
        // placed links
        for (const k of this.placed) {
            const [a, b] = k.split("->");
            this.arrow(c, this.node(a), this.node(b), "#fde047", 4);
        }
        // dragging line
        if (this.dragFrom && this.dragPos) {
            c.strokeStyle = "rgba(255,255,255,0.6)";
            c.lineWidth = 3;
            c.setLineDash([6, 6]);
            c.beginPath();
            c.moveTo(this.dragFrom.x, this.dragFrom.y);
            c.lineTo(this.dragPos.x, this.dragPos.y);
            c.stroke();
            c.setLineDash([]);
        }
        // wrong flash
        if (this.wrongFlash) {
            const [a, b] = this.wrongFlash.key.split("->");
            c.globalAlpha = this.wrongFlash.t;
            this.arrow(c, this.node(a), this.node(b), "#ef4444", 4);
            c.globalAlpha = 1;
        }
        // nodes
        for (const o of ORGANISMS) {
            c.fillStyle = o.id === "sun" ? "#fbbf24" : "#166534";
            c.strokeStyle = this.dragFrom?.id === o.id ? "#fde047" : "#22c55e";
            c.lineWidth = 4;
            c.beginPath();
            c.arc(o.x, o.y, R, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.font = "30px serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(o.emoji, o.x, o.y - 4);
            c.fillStyle = "#fff";
            c.font = "bold 13px Nunito, sans-serif";
            c.fillText(o.label, o.x, o.y + R - 6);
        }
        c.textBaseline = "alphabetic";
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.mistakes = 0;
        this.placed.clear();
        this.wrongFlash = null;
        this.dragFrom = null;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach?.();
    }
}
export const foodwebGame = {
    meta: {
        id: "foodweb",
        conceptId: "bio-14",
        title: "Web of Life",
        stream: "biology",
        gradeBand: "5",
        emoji: "🕸️",
        blurb: "Draw the arrows that show how energy flows from the Sun through every living thing.",
        mission: "Connect the food web: drag from each food source to whatever eats it until every energy link is drawn.",
        estMinutes: 4,
    },
    create: (ctx) => new FoodWeb(ctx),
};
