import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const START = { x: 180, y: 520 };
const BONES = [
    { key: "skull", name: "Skull", emoji: "💀", job: "protects the brain", x: 470, y: 130 },
    {
        key: "ribcage",
        name: "Ribcage",
        emoji: "🫁",
        job: "guards the heart and lungs",
        x: 470,
        y: 250,
    },
    { key: "spine", name: "Spine", emoji: "🦴", job: "holds you upright and bends", x: 470, y: 350 },
    { key: "arm", name: "Arm bone", emoji: "💪", job: "lets you reach and lift", x: 340, y: 250 },
    { key: "leg", name: "Leg bone", emoji: "🦵", job: "carries your weight to walk", x: 470, y: 470 },
];
class Skeleton {
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
        Object.defineProperty(this, "placed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
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
        Object.defineProperty(this, "mistakes", {
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
        this.order = [...BONES].sort(() => Math.random() - 0.5);
        this.detach = onPointer(ctx.canvas, W, H, {
            down: (p) => {
                if (Math.hypot(p.x - this.tok.x, p.y - this.tok.y) < 44)
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
            "Your skeleton is the frame of bones that holds your body up and protects the soft parts inside.",
            "Each bone has a job: the skull guards the brain, the ribcage shields the heart and lungs, the spine keeps you upright.",
            "Drag each bone to its glowing place in the body outline.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        this.progressEl = el("span", { style: { color: "var(--accent-purple)" } }, `${this.idx + 1} / ${BONES.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
        });
        this.coachEl.textContent = "Drag each bone to its place in the body.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🦴 Place the"), el("span", {}, this.current().name)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag it to the glowing spot"), el("div", { class: "metric" }, el("span", {}, "🦴 Bones placed"), this.progressEl), this.coachEl);
    }
    drop(p) {
        if (this.ended)
            return;
        const cur = this.current();
        const d = Math.hypot(p.x - cur.x, p.y - cur.y);
        if (d < 56) {
            this.placed.add(cur.key);
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ The ${cur.name.toLowerCase()} ${cur.job}.`;
            this.idx += 1;
            this.tok = { x: START.x, y: START.y };
            if (this.idx >= this.order.length) {
                this.progressEl.textContent = `${BONES.length} / ${BONES.length}`;
                this.win();
            }
            else {
                this.progressEl.textContent = `${this.idx + 1} / ${BONES.length}`;
            }
        }
        else {
            // wrong spot — check if dropped on a different slot
            const onOther = BONES.some((b) => b.key !== cur.key && Math.hypot(p.x - b.x, p.y - b.y) < 56);
            if (onOther) {
                this.mistakes += 1;
                this.ctx.services.audio.play("fail");
                this.coachEl.textContent = `❌ That's not where the ${cur.name.toLowerCase()} goes. Find its glowing spot.`;
            }
            this.tok = { x: START.x, y: START.y };
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("skeleton_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Skeleton built! Your bones form a strong frame that holds you up and protects soft organs — the skull guards the brain, the ribcage the heart and lungs.",
            stars,
            resources: { Species: 40 },
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
        c.fillStyle = "#1e1b4b";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#e9d5ff";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Skeleton complete! 🦴", W / 2, H / 2);
            return;
        }
        // body silhouette guide
        c.fillStyle = "rgba(255,255,255,0.05)";
        c.beginPath();
        c.ellipse(470, 130, 40, 46, 0, 0, Math.PI * 2); // head
        c.fill();
        c.fillRect(420, 180, 100, 230); // torso
        c.fillRect(440, 400, 60, 130); // legs area
        // slots
        for (const b of BONES) {
            const done = this.placed.has(b.key);
            const isCurrent = !done && b.key === this.current().key;
            if (done) {
                c.font = "40px serif";
                c.textAlign = "center";
                c.fillText(b.emoji, b.x, b.y + 12);
            }
            else {
                c.strokeStyle = isCurrent
                    ? `rgba(155,107,255,${0.6 + Math.sin(this.anim * 3) * 0.3})`
                    : "rgba(255,255,255,0.25)";
                c.lineWidth = isCurrent ? 4 : 2;
                c.setLineDash([6, 6]);
                c.beginPath();
                c.arc(b.x, b.y, 34, 0, Math.PI * 2);
                c.stroke();
                c.setLineDash([]);
            }
        }
        // current bone token (draggable)
        const cur = this.current();
        c.fillStyle = "#fff";
        c.strokeStyle = this.dragging ? "#22c55e" : "#a78bfa";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(this.tok.x, this.tok.y, 40, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.font = "42px serif";
        c.textAlign = "center";
        c.fillText(cur.emoji, this.tok.x, this.tok.y + 14);
        if (!this.dragging) {
            c.fillStyle = "#e9d5ff";
            c.font = "bold 14px Nunito, sans-serif";
            c.fillText(`Drag the ${cur.name}`, this.tok.x, this.tok.y + 62);
        }
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Build the skeleton 🦴", W / 2, 40);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.placed = new Set();
        this.tok = { x: START.x, y: START.y };
        this.dragging = false;
        this.mistakes = 0;
        this.order = [...BONES].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const skeletonGame = {
    meta: {
        id: "skeleton",
        conceptId: "bio-22",
        title: "Build the Skeleton",
        stream: "biology",
        gradeBand: "3-4",
        emoji: "🦴",
        blurb: "Drag each bone into place to assemble the body's skeleton.",
        mission: "Place every bone in the body and learn what each one protects.",
        estMinutes: 2,
    },
    create: (ctx) => new Skeleton(ctx),
};
