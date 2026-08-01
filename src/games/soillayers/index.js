import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
// Correct order is top (index 0) to bottom.
const LAYERS = [
    {
        key: "humus",
        name: "Humus",
        emoji: "🍂",
        color: "#4d3b1f",
        note: "The top layer of rotting leaves and twigs.",
    },
    {
        key: "topsoil",
        name: "Topsoil",
        emoji: "🌱",
        color: "#6b4423",
        note: "Dark, rich soil where plant roots grow.",
    },
    {
        key: "subsoil",
        name: "Subsoil",
        emoji: "🟫",
        color: "#a87c4f",
        note: "Lighter soil with clay and minerals.",
    },
    {
        key: "bedrock",
        name: "Bedrock",
        emoji: "🪨",
        color: "#6b7280",
        note: "Solid rock at the very bottom.",
    },
];
class SoilLayers {
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
        this.tray = [...LAYERS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Soil is layered, and each layer is different. We dig down to see them.",
            "The top has rotting leaves, then rich dark soil, then lighter soil, then solid rock at the bottom.",
            "Order from top down: Humus → Topsoil → Subsoil → Bedrock.",
        ]);
        this.renderLoop();
    }
    buildPanel() {
        const next = LAYERS[this.placed];
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...this.tray.map((l) => el("button", { class: "chip", onclick: () => this.pick(l.key) }, `${l.emoji} ${l.name}`)));
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.placed} / ${LAYERS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = next
            ? this.placed === 0
                ? "Which layer is right at the TOP?"
                : "What's the next layer down?"
            : "Soil profile complete!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Stack the soil layers")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the next layer (top → bottom)"), chips, el("div", { class: "metric" }, el("span", {}, "🪏 Layers placed"), this.statusEl), this.coachEl);
    }
    pick(key) {
        if (this.ended)
            return;
        const correct = LAYERS[this.placed];
        if (key === correct.key) {
            this.placed += 1;
            this.tray = this.tray.filter((l) => l.key !== key);
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${correct.name}: ${correct.note}`;
            if (this.placed >= LAYERS.length)
                this.win();
            else
                this.buildPanel();
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ Not next. ${correct.name}: ${correct.note}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
        this.ctx.services.score.event("soillayers_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Soil sorted! Soil is built in layers — rotting leaves on top, then rich topsoil, then mineral subsoil, and solid bedrock at the bottom.",
            stars,
            resources: { Minerals: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.04;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#bae6fd";
        c.fillRect(0, 0, W, H);
        // cross-section pit
        const px = 250, pw = 300, top = 130, layerH = 95;
        for (let i = 0; i < LAYERS.length; i++) {
            const y = top + i * layerH;
            const done = i < this.placed;
            const isNext = i === this.placed;
            if (done) {
                c.fillStyle = LAYERS[i].color;
                c.fillRect(px, y, pw, layerH);
                c.font = "34px serif";
                c.textAlign = "left";
                c.fillText(LAYERS[i].emoji, px + 16, y + layerH / 2 + 12);
                c.fillStyle = "#fff";
                c.font = "bold 18px Nunito, sans-serif";
                c.textAlign = "left";
                c.fillText(LAYERS[i].name, px + 70, y + layerH / 2 + 6);
            }
            else {
                c.fillStyle = isNext ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.4)";
                c.fillRect(px, y, pw, layerH);
                c.strokeStyle = isNext ? "#f59e0b" : "#cbd5e1";
                c.lineWidth = isNext ? 4 : 2;
                c.setLineDash(isNext ? [] : [6, 6]);
                c.strokeRect(px, y, pw, layerH);
                c.setLineDash([]);
                c.fillStyle = isNext ? "#b45309" : "#94a3b8";
                c.font = "bold 22px Nunito, sans-serif";
                c.textAlign = "center";
                c.fillText(isNext ? "? (place here)" : `layer ${i + 1}`, px + pw / 2, y + layerH / 2 + 8);
            }
        }
        // border
        c.strokeStyle = "#78350f";
        c.lineWidth = 4;
        c.strokeRect(px, top, pw, layerH * LAYERS.length);
        // top/bottom labels
        c.fillStyle = "#1e3a8a";
        c.font = "bold 14px Nunito, sans-serif";
        c.textAlign = "right";
        c.fillText("⬆ surface", px - 12, top + 16);
        c.fillText("⬇ deep down", px - 12, top + layerH * LAYERS.length - 6);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Build the soil from the top down 🪏", W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.placed = 0;
        this.mistakes = 0;
        this.tray = [...LAYERS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const soilLayersGame = {
    meta: {
        id: "soillayers",
        conceptId: "ess-15",
        title: "Soil Layers",
        stream: "earth-space",
        gradeBand: "2-4",
        emoji: "🪏",
        blurb: "Stack the layers of soil in order, from leaf litter down to bedrock.",
        mission: "Put the soil layers in the right order, top to bottom.",
        estMinutes: 2,
    },
    create: (ctx) => new SoilLayers(ctx),
};
