import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
const PX = 330; // prism position
const PY = 250;
const SPECTRUM = ["#ff0000", "#ff7f00", "#ffd400", "#22c55e", "#3b82f6", "#4f46e5", "#8b5cf6"];
const NEED = 3;
class Rainbow {
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
        Object.defineProperty(this, "aimDeg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 20
        }); // exit angle of the rainbow's centre
        Object.defineProperty(this, "targetY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 300
        });
        Object.defineProperty(this, "caught", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "tol", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // how close the rainbow must land (adaptive)
        Object.defineProperty(this, "statusEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "aimEl", {
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
        this.tol = byTier(ctx.tier, 40, 28, 18);
        this.placeTarget();
        this.buildPanel();
        ctx.services.hints.setHints([
            "White light is really many colours mixed together. A prism bends each colour by a different amount, spreading them into a rainbow.",
            "Red bends the least and violet the most — that's why the colours always come out in the same order.",
            "Tilt the prism to aim the rainbow so its colours land on the pot of gold.",
        ]);
        this.renderLoop();
    }
    placeTarget() {
        this.targetY = 180 + Math.random() * 320;
    }
    buildPanel() {
        const slider = el("input", {
            type: "range",
            min: "-10",
            max: "55",
            value: String(this.aimDeg),
            "aria-label": "Prism tilt",
            style: { accentColor: "var(--accent-purple)" },
            oninput: (e) => {
                this.aimDeg = Number(e.target.value);
                this.updateReadout();
            },
        });
        this.aimEl = el("span", {}, "");
        this.statusEl = el("span", { style: { color: "var(--accent-purple)" } }, `0 / ${NEED}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
        });
        this.coachEl.textContent =
            "Tilt the prism so the rainbow lands on the pot of gold. Hold it there!";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, `Land ${NEED} rainbows`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔺 Tilt the prism"), slider, el("div", { class: "metric" }, el("span", {}, "🌈 Aim"), this.aimEl), el("div", { class: "metric" }, el("span", {}, "🪙 Rainbows landed"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    centerHitY() {
        const ang = (this.aimDeg * Math.PI) / 180;
        return PY + Math.tan(ang) * (W - 40 - PX);
    }
    updateReadout() {
        const off = this.centerHitY() - this.targetY;
        this.aimEl.textContent =
            Math.abs(off) < this.tol ? "on target 🎯" : off < 0 ? "too high ⬆️" : "too low ⬇️";
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (!this.ended) {
                const off = Math.abs(this.centerHitY() - this.targetY);
                if (off < this.tol) {
                    this.hold += 1;
                    if (this.hold > 36)
                        this.land();
                }
                else {
                    this.hold = 0;
                }
            }
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    land() {
        this.caught += 1;
        this.hold = 0;
        this.ctx.services.audio.play("tick");
        this.statusEl.textContent = `${this.caught} / ${NEED}`;
        if (this.caught >= NEED) {
            this.win();
        }
        else {
            this.placeTarget();
            this.coachEl.textContent = "🌈 A rainbow! Now aim for the next pot of gold.";
            this.updateReadout();
        }
    }
    win() {
        this.ended = true;
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("rainbow_done", {});
        this.ctx.services.outcome.succeed({
            message: "Rainbows made! White light is a mix of colours. A prism bends each colour differently — red least, violet most — fanning them into a rainbow.",
            stars,
            resources: { Power: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        const sky = c.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#1e293b");
        sky.addColorStop(1, "#334155");
        c.fillStyle = sky;
        c.fillRect(0, 0, W, H);
        // incoming white beam from the left
        c.strokeStyle = "rgba(255,255,255,0.9)";
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(0, PY);
        c.lineTo(PX, PY);
        c.stroke();
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.font = "13px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText("white light →", 20, PY - 12);
        // prism (triangle)
        c.fillStyle = "rgba(186,230,253,0.4)";
        c.strokeStyle = "#bae6fd";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(PX, PY - 46);
        c.lineTo(PX + 52, PY + 34);
        c.lineTo(PX - 28, PY + 34);
        c.closePath();
        c.fill();
        c.stroke();
        // dispersed rainbow rays
        const baseAng = (this.aimDeg * Math.PI) / 180;
        const spread = 0.045;
        for (let i = 0; i < SPECTRUM.length; i++) {
            const ang = baseAng + (i - 3) * spread;
            c.strokeStyle = SPECTRUM[i];
            c.lineWidth = 5;
            c.beginPath();
            c.moveTo(PX + 12, PY);
            c.lineTo(W, PY + Math.tan(ang) * (W - PX - 12));
            c.stroke();
        }
        // pot of gold target on the right edge
        const tx = W - 36;
        const onTarget = Math.abs(this.centerHitY() - this.targetY) < 28;
        if (onTarget) {
            c.fillStyle = `rgba(253,224,71,${0.3 + 0.3 * Math.sin(this.anim * 3)})`;
            c.beginPath();
            c.arc(tx, this.targetY, 40, 0, Math.PI * 2);
            c.fill();
        }
        c.font = "40px serif";
        c.textAlign = "center";
        c.fillText("🪙", tx, this.targetY + 14);
        c.strokeStyle = onTarget ? "#22c55e" : "rgba(255,255,255,0.5)";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(tx, this.targetY, 30, 0, Math.PI * 2);
        c.stroke();
        // hold progress ring
        if (this.hold > 0) {
            c.strokeStyle = "#22c55e";
            c.lineWidth = 5;
            c.beginPath();
            c.arc(tx, this.targetY, 36, -Math.PI / 2, -Math.PI / 2 + (this.hold / 36) * Math.PI * 2);
            c.stroke();
        }
        // spectrum order label
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.font = "bold 16px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Aim the rainbow 🌈 onto the pot of gold", W / 2, 40);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.aimDeg = 20;
        this.caught = 0;
        this.hold = 0;
        this.placeTarget();
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const rainbowGame = {
    meta: {
        id: "rainbow",
        conceptId: "phys-15",
        title: "Make a Rainbow",
        stream: "physics",
        gradeBand: "4",
        emoji: "🌈",
        blurb: "Tilt a prism to split white light into a rainbow and aim it at the target.",
        mission: "Split white light and land the rainbow on the pot of gold three times.",
        estMinutes: 2,
    },
    create: (ctx) => new Rainbow(ctx),
};
