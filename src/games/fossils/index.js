import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const DIG_TOP = 150;
const DIG_BOTTOM = 548;
const COLS = 24;
const ROWS = 14;
const CW = W / COLS;
const CH = (DIG_BOTTOM - DIG_TOP) / ROWS;
class Fossils {
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
        Object.defineProperty(this, "frames", {
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
        Object.defineProperty(this, "dirt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "fossils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "found", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "brush", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
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
        this.setup();
        this.detach = onPointer(ctx.canvas, W, H, {
            down: (p) => {
                this.dragging = true;
                this.brush = p;
                this.dig(p);
            },
            move: (p) => {
                this.brush = p;
                if (this.dragging)
                    this.dig(p);
            },
            up: () => {
                this.dragging = false;
            },
        });
        this.buildPanel();
        ctx.services.hints.setHints([
            "Fossils are the preserved remains or prints of living things from long ago, buried in layers of rock.",
            "Rock builds up layer by layer over time, so the deeper a fossil is, the older it is.",
            "Brush away the dirt to uncover each fossil. The one at the bottom is the most ancient of all.",
        ]);
        this.renderLoop();
    }
    setup() {
        this.dirt = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 1));
        this.fossils = [
            {
                emoji: "🦴",
                name: "Ice-age bone",
                age: "newest — near the top",
                row: 2,
                col: 6,
                revealed: false,
            },
            {
                emoji: "🐚",
                name: "Ancient sea shell",
                age: "older — buried deeper",
                row: 7,
                col: 16,
                revealed: false,
            },
            {
                emoji: "🦕",
                name: "Dinosaur fossil",
                age: "oldest — deepest layer",
                row: 11,
                col: 10,
                revealed: false,
            },
        ];
    }
    buildPanel() {
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / 3`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Drag across the rock to brush away dirt and uncover the fossils.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Uncover 3 fossils")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Brush over the rock to dig"), el("div", { class: "metric" }, el("span", {}, "🦴 Found"), this.statusEl), this.coachEl);
    }
    dig(p) {
        if (this.ended)
            return;
        if (p.y < DIG_TOP)
            return;
        const cc = (p.x - 0) / CW;
        const cr = (p.y - DIG_TOP) / CH;
        let dug = false;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (Math.hypot(c + 0.5 - cc, r + 0.5 - cr) < 1.6) {
                    if (this.dirt[r][c] > 0) {
                        this.dirt[r][c] = Math.max(0, this.dirt[r][c] - 0.34);
                        dug = true;
                    }
                }
            }
        }
        if (dug)
            this.checkReveals();
    }
    checkReveals() {
        for (const f of this.fossils) {
            if (f.revealed)
                continue;
            let revealedCount = 0;
            let total = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = f.row + dr;
                    const c = f.col + dc;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS)
                        continue;
                    total++;
                    if (this.dirt[r][c] < 0.25)
                        revealedCount++;
                }
            }
            if (total > 0 && revealedCount / total >= 0.78) {
                f.revealed = true;
                this.found += 1;
                this.ctx.services.audio.play("reward");
                this.statusEl.textContent = `${this.found} / 3`;
                this.coachEl.textContent = `🦴 Found the ${f.name} — ${f.age}!`;
                if (this.found >= 3)
                    this.win();
            }
        }
    }
    win() {
        this.ended = true;
        const secs = this.frames / 60;
        const stars = secs < 25 ? 3 : secs < 50 ? 2 : 1;
        this.ctx.services.score.event("fossils_done", { seconds: Math.round(secs) });
        this.ctx.services.outcome.succeed({
            message: "Dig complete! Fossils are clues to life long ago. Rock piles up in layers over time, so the deeper you dig, the older the fossils you find.",
            stars,
            resources: { Rock: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            if (!this.ended)
                this.frames++;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        // sky strip
        c.fillStyle = "#bae6fd";
        c.fillRect(0, 0, W, DIG_TOP);
        c.fillStyle = "#78350f";
        c.fillRect(0, DIG_TOP, W, DIG_BOTTOM - DIG_TOP);
        // rock strata bands (lighter near top, darker/older deeper)
        for (let r = 0; r < ROWS; r++) {
            const t = r / ROWS;
            const shade = 90 - t * 45;
            c.fillStyle = `hsl(28, 45%, ${shade}%)`;
            c.fillRect(0, DIG_TOP + r * CH, W, CH);
        }
        // fossils (drawn under the dirt overlay)
        for (const f of this.fossils) {
            const x = f.col * CW + CW / 2;
            const y = DIG_TOP + f.row * CH + CH / 2;
            c.font = "44px serif";
            c.textAlign = "center";
            c.fillText(f.emoji, x, y + 14);
            if (f.revealed) {
                c.fillStyle = "rgba(255,255,255,0.85)";
                c.font = "bold 13px Nunito, sans-serif";
                c.fillText(f.name, x, y + 42);
            }
        }
        // dirt overlay
        for (let r = 0; r < ROWS; r++) {
            for (let cc = 0; cc < COLS; cc++) {
                const d = this.dirt[r][cc];
                if (d <= 0)
                    continue;
                const t = r / ROWS;
                const shade = 50 - t * 22;
                c.fillStyle = `hsla(28, 50%, ${shade}%, ${d})`;
                c.fillRect(cc * CW, DIG_TOP + r * CH, CW + 0.5, CH + 0.5);
            }
        }
        // depth/age axis
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.font = "bold 12px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText("⬆ newer rock", 8, DIG_TOP + 16);
        c.fillText("⬇ older rock", 8, DIG_BOTTOM - 8);
        // brush cursor
        if (this.brush && this.brush.y > DIG_TOP) {
            c.strokeStyle = "rgba(255,255,255,0.8)";
            c.lineWidth = 2;
            c.beginPath();
            c.arc(this.brush.x, this.brush.y, CW * 1.6, 0, Math.PI * 2);
            c.stroke();
            c.font = "20px serif";
            c.textAlign = "center";
            c.fillText("🖌️", this.brush.x, this.brush.y + 6);
        }
        // title
        c.fillStyle = "#0c4a6e";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Brush away the dirt to uncover fossils 🦴", W / 2, 60);
        c.font = "13px Nunito, sans-serif";
        c.fillText("Deeper layers are older — so is what's buried in them.", W / 2, 84);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.frames = 0;
        this.found = 0;
        this.brush = null;
        this.setup();
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const fossilsGame = {
    meta: {
        id: "fossils",
        conceptId: "ess-19",
        title: "Fossil Dig",
        stream: "earth-space",
        gradeBand: "3-4",
        emoji: "🦕",
        blurb: "Brush away rock layers to uncover fossils — the deeper, the older.",
        mission: "Excavate the rock to reveal all three buried fossils.",
        estMinutes: 3,
    },
    create: (ctx) => new Fossils(ctx),
};
