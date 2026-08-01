import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const SCENARIOS = [
    {
        title: "Ice melts in a sealed cup",
        emoji: "🧊",
        sealed: true,
        answer: "same",
        why: "Melting only changes ice to water — the same particles are still there, so the mass is unchanged.",
    },
    {
        title: "Salt dissolves in a sealed jar",
        emoji: "🧂",
        sealed: true,
        answer: "same",
        why: "The salt spreads out but doesn't disappear — every particle stays in the jar, so mass stays the same.",
    },
    {
        title: "A candle burns in the open air",
        emoji: "🕯️",
        sealed: false,
        answer: "less",
        why: "Burning turns the wax into gases that float away into the air, so what's left weighs less.",
    },
    {
        title: "A fizzy tablet in a sealed bottle",
        emoji: "🥤",
        sealed: true,
        answer: "same",
        why: "It makes gas, but the sealed bottle traps it — nothing escapes, so the mass doesn't change.",
    },
];
class Conservation {
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
        Object.defineProperty(this, "revealed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "tilt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // animated scale tilt
        Object.defineProperty(this, "targetTilt", {
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
        this.order = [...SCENARIOS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Matter is never destroyed — it just moves around or changes form. Its total mass stays the same.",
            "If the container is SEALED, nothing can get in or out, so the mass can't change.",
            "Watch for gases escaping! In an open container, gas can float away — that's the only way the mass seems to drop.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        clear(this.ctx.panel);
        this.progressEl = el("span", { style: { color: "var(--accent-purple)" } }, `${this.idx + 1} / ${SCENARIOS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
        });
        const head = el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "⚖️ After the change"), el("span", {}, "more / same / less?"));
        if (!this.revealed) {
            this.coachEl.textContent = "Will the total mass go up, stay the same, or go down?";
            const choices = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, el("button", {
                class: "btn",
                style: { background: "var(--accent-orange)" },
                onclick: () => this.guess("more"),
            }, "⬆️ More"), el("button", {
                class: "btn",
                style: { background: "var(--accent-blue)" },
                onclick: () => this.guess("same"),
            }, "⚖️ Same"), el("button", {
                class: "btn",
                style: { background: "var(--accent-red)" },
                onclick: () => this.guess("less"),
            }, "⬇️ Less"));
            this.ctx.panel.append(head, el("div", { class: "control-label", style: { marginTop: "8px" } }, this.current().title), choices, el("div", { class: "metric" }, el("span", {}, "🧪 Experiment"), this.progressEl), this.coachEl);
        }
        else {
            const nextBtn = el("button", { class: "btn", style: { background: "var(--accent-purple)" }, onclick: () => this.next() }, this.idx + 1 >= this.order.length ? "🏁 Finish" : "Next ▶");
            this.ctx.panel.append(head, el("div", { class: "control-label", style: { marginTop: "8px" } }, this.current().title), nextBtn, el("div", { class: "metric" }, el("span", {}, "🧪 Experiment"), this.progressEl), this.coachEl);
        }
    }
    guess(a) {
        if (this.ended || this.revealed)
            return;
        const cur = this.current();
        this.revealed = true;
        this.targetTilt = cur.answer === "same" ? 0 : cur.answer === "less" ? -0.22 : 0.22;
        const correct = a === cur.answer;
        if (correct) {
            this.ctx.services.audio.play("tick");
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
        }
        this.buildPanel(); // rebuilds coachEl, so set its text afterwards
        this.coachEl.textContent = correct ? `✅ ${cur.why}` : `❌ Not quite. ${cur.why}`;
    }
    next() {
        if (this.ended)
            return;
        if (this.idx + 1 >= this.order.length) {
            this.win();
            return;
        }
        this.idx += 1;
        this.revealed = false;
        this.targetTilt = 0;
        this.buildPanel();
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("conservation_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "You've got it! Mass is conserved — matter never just vanishes. In a sealed container the mass always stays the same; it only seems to drop when a gas escapes.",
            stars,
            resources: { Elements: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            this.tilt += (this.targetTilt - this.tilt) * 0.1;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#faf5ff";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#581c87";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Mass is always conserved! ⚖️", W / 2, H / 2);
            return;
        }
        const cur = this.current();
        const cx = W / 2;
        const baseY = 230;
        // stand
        c.fillStyle = "#6d28d9";
        c.fillRect(cx - 8, baseY, 16, 230);
        c.fillRect(cx - 70, baseY + 230, 140, 16);
        // beam
        c.save();
        c.translate(cx, baseY);
        c.rotate(this.tilt);
        c.fillStyle = "#a78bfa";
        c.fillRect(-200, -8, 400, 16);
        c.restore();
        // pan positions
        const lx = cx + Math.cos(Math.PI + this.tilt) * 200;
        const ly = baseY + Math.sin(Math.PI + this.tilt) * 200;
        const rx = cx + Math.cos(this.tilt) * 200;
        const ry = baseY + Math.sin(this.tilt) * 200;
        this.drawPan(c, lx, ly, "The system", `${cur.emoji}${cur.sealed ? "🔒" : ""}`);
        this.drawPan(c, rx, ry, "Starting mass", "⚖️");
        // escaping gas animation (only when revealed and answer less)
        if (this.revealed && cur.answer === "less") {
            c.fillStyle = "rgba(148,163,184,0.6)";
            for (let i = 0; i < 5; i++) {
                const gy = ly - 60 - ((this.anim * 30 + i * 30) % 120);
                c.beginPath();
                c.arc(lx + Math.sin(this.anim + i) * 18, gy, 6, 0, Math.PI * 2);
                c.fill();
            }
            c.fillStyle = "#7c2d12";
            c.font = "13px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("gas escaping →", lx, ly - 130);
        }
        c.fillStyle = "#581c87";
        c.font = "bold 20px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(cur.sealed ? "🔒 Sealed container" : "🌬️ Open to the air", cx, 70);
        c.font = "16px Nunito, sans-serif";
        c.fillText(cur.title, cx, 98);
    }
    drawPan(c, x, y, label, content) {
        c.strokeStyle = "#7c3aed";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 40, y + 50);
        c.moveTo(x, y);
        c.lineTo(x + 40, y + 50);
        c.stroke();
        c.fillStyle = "#ddd6fe";
        c.beginPath();
        c.ellipse(x, y + 54, 48, 14, 0, 0, Math.PI * 2);
        c.fill();
        c.font = "30px serif";
        c.textAlign = "center";
        c.fillText(content, x, y + 46);
        c.fillStyle = "#6b21a8";
        c.font = "12px Nunito, sans-serif";
        c.fillText(label, x, y + 80);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.revealed = false;
        this.tilt = 0;
        this.targetTilt = 0;
        this.mistakes = 0;
        this.order = [...SCENARIOS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const conservationGame = {
    meta: {
        id: "conservation",
        conceptId: "chem-18",
        title: "Nothing Lost",
        stream: "chemistry",
        gradeBand: "5",
        emoji: "⚖️",
        blurb: "Predict whether mass changes during everyday changes — and learn why it's conserved.",
        mission: "Decide if the mass goes up, down, or stays the same after each change.",
        estMinutes: 3,
    },
    create: (ctx) => new Conservation(ctx),
};
