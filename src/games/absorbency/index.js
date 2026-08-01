import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const PUDDLE = { x: W / 2, y: 380, maxR: 150 };
const MATERIALS = [
    { key: "sponge", label: "Sponge", emoji: "🧽", soak: 0.2 },
    { key: "towel", label: "Paper towel", emoji: "🧻", soak: 0.16 },
    { key: "cloth", label: "Cloth", emoji: "🧶", soak: 0.1 },
    { key: "wood", label: "Wood", emoji: "🪵", soak: 0.03 },
    { key: "foil", label: "Foil", emoji: "🪙", soak: 0 },
    { key: "plastic", label: "Plastic", emoji: "🧴", soak: 0 },
];
class Absorbency {
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
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "sponge"
        });
        Object.defineProperty(this, "volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        }); // 0..1
        Object.defineProperty(this, "wasted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "splashes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "volEl", {
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
        this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.dab(p) });
        this.buildPanel();
        ctx.services.hints.setHints([
            "Absorbent materials soak up water into tiny spaces inside them. Others let water run right off.",
            "Soft, fluffy materials like sponges and paper towels soak up lots. Smooth ones like foil and plastic don't.",
            "Pick an absorbent material, then tap the puddle to soak it up. Foil and plastic won't help!",
        ]);
        this.renderLoop();
    }
    mat() {
        return MATERIALS.find((m) => m.key === this.active);
    }
    buildPanel() {
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...MATERIALS.map((m) => el("button", {
            class: "chip",
            style: this.active === m.key
                ? {
                    background: "var(--accent-blue)",
                    color: "#fff",
                    borderColor: "var(--accent-blue)",
                }
                : {},
            onclick: () => {
                this.active = m.key;
                this.ctx.services.audio.play("click");
                this.buildPanel();
            },
        }, `${m.emoji} ${m.label}`)));
        // Reflect the real spill level — buildPanel() runs on every material switch,
        // so a hardcoded "100%" would wrongly reset the readout after mopping.
        this.volEl = el("span", {}, `${Math.round(this.volume * 100)}%`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        this.coachEl.textContent = "Pick a material, then tap the puddle to soak it up.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Mop up the spill")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Choose a material to mop with"), chips, el("div", { class: "metric" }, el("span", {}, "💧 Spill left"), this.volEl), this.coachEl);
    }
    dab(p) {
        if (this.ended)
            return;
        const r = PUDDLE.maxR * Math.sqrt(this.volume);
        const onPuddle = Math.hypot(p.x - PUDDLE.x, p.y - PUDDLE.y) < r + 20;
        const m = this.mat();
        if (!onPuddle)
            return;
        if (m.soak <= 0) {
            this.wasted += 1;
            this.splashes.push({ x: p.x, y: p.y, life: 1, ok: false });
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${m.label} is waterproof — the water just rolls off. Try something absorbent.`;
            return;
        }
        this.volume = Math.max(0, this.volume - m.soak);
        this.splashes.push({ x: p.x, y: p.y, life: 1, ok: true });
        this.ctx.services.audio.play("tick");
        this.volEl.textContent = `${Math.round(this.volume * 100)}%`;
        this.coachEl.textContent = `🧽 ${m.label} soaks it up! It pulls water into the spaces inside it.`;
        // Count a nearly-dry floor as done, so low-soak materials can't leave a
        // sliver that never reaches exactly zero.
        if (this.volume <= 0.05) {
            this.volume = 0;
            this.volEl.textContent = "0%";
            this.win();
        }
    }
    win() {
        this.ended = true;
        const stars = this.wasted === 0 ? 3 : this.wasted <= 3 ? 2 : 1;
        this.ctx.services.score.event("absorbency_done", { wasted: this.wasted });
        this.ctx.services.outcome.succeed({
            message: "All mopped up! Absorbent materials like sponges and towels soak water into tiny spaces inside them. Smooth, waterproof ones let it run right off.",
            stars,
            resources: { Materials: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            for (const s of this.splashes)
                s.life -= 0.04;
            this.splashes = this.splashes.filter((s) => s.life > 0);
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#f1f5f9";
        c.fillRect(0, 0, W, H);
        // floor tiles
        c.strokeStyle = "#e2e8f0";
        c.lineWidth = 2;
        for (let x = 0; x < W; x += 80) {
            c.beginPath();
            c.moveTo(x, 0);
            c.lineTo(x, H);
            c.stroke();
        }
        for (let y = 0; y < H; y += 80) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(W, y);
            c.stroke();
        }
        // puddle
        if (this.volume > 0) {
            const r = PUDDLE.maxR * Math.sqrt(this.volume);
            c.fillStyle = "rgba(56,189,248,0.7)";
            c.beginPath();
            c.ellipse(PUDDLE.x, PUDDLE.y, r, r * 0.7, 0, 0, Math.PI * 2);
            c.fill();
            // shimmer
            c.fillStyle = "rgba(255,255,255,0.4)";
            c.beginPath();
            c.ellipse(PUDDLE.x - r * 0.3, PUDDLE.y - r * 0.25, r * 0.25, r * 0.12, 0, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = "rgba(14,165,233,0.6)";
            c.lineWidth = 3;
            c.beginPath();
            c.ellipse(PUDDLE.x, PUDDLE.y, r, r * 0.7, 0, 0, Math.PI * 2);
            c.stroke();
        }
        else {
            c.fillStyle = "#16a34a";
            c.font = "bold 26px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All dry! ✨", PUDDLE.x, PUDDLE.y);
        }
        // splashes
        for (const s of this.splashes) {
            c.strokeStyle = s.ok ? `rgba(34,197,94,${s.life})` : `rgba(239,68,68,${s.life})`;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(s.x, s.y, (1 - s.life) * 30 + 6, 0, Math.PI * 2);
            c.stroke();
        }
        // current tool follows nothing; show label
        c.fillStyle = "#0c4a6e";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Tap the puddle to mop it up 🧽", W / 2, 50);
        c.font = "15px Nunito, sans-serif";
        c.fillText(`Mopping with: ${this.mat().emoji} ${this.mat().label}`, W / 2, 76);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.active = "sponge";
        this.volume = 1;
        this.wasted = 0;
        this.splashes = [];
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const absorbencyGame = {
    meta: {
        id: "absorbency",
        conceptId: "chem-20",
        title: "Soak It Up",
        stream: "chemistry",
        gradeBand: "1-3",
        emoji: "🧽",
        blurb: "Pick absorbent materials to mop up a spill — and find out which ones just repel water.",
        mission: "Clean up the whole puddle using materials that soak up water.",
        estMinutes: 2,
    },
    create: (ctx) => new Absorbency(ctx),
};
