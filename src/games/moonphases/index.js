import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
const EX = 360; // Earth center
const EY = 320;
const ORBIT = 175;
// Sun is to the RIGHT. Moon angle 0 = New (between Earth and Sun),
// PI = Full (opposite the Sun), PI/2 = First Quarter.
const TARGETS = [
    {
        name: "Full Moon",
        emoji: "🌕",
        angle: Math.PI,
        hint: "Full Moon: the Moon is opposite the Sun, so we see its whole lit face.",
    },
    {
        name: "New Moon",
        emoji: "🌑",
        angle: 0,
        hint: "New Moon: the Moon is between Earth and the Sun, so its lit side faces away from us.",
    },
    {
        name: "First Quarter",
        emoji: "🌓",
        angle: Math.PI / 2,
        hint: "First Quarter: the Moon is at a right angle, so we see exactly half lit.",
    },
];
class MoonPhases {
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
        Object.defineProperty(this, "theta", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Math.PI / 2
        }); // moon's position around Earth
        Object.defineProperty(this, "dragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "matched", {
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
        Object.defineProperty(this, "targetEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "phaseEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
        this.detach = onPointer(ctx.canvas, W, H, {
            down: (p) => {
                this.dragging = true;
                this.setFromPointer(p);
            },
            move: (p) => {
                if (this.dragging)
                    this.setFromPointer(p);
            },
            up: () => {
                this.dragging = false;
            },
        });
        this.buildPanel();
        ctx.services.hints.setHints([
            "The Moon doesn't make light — the Sun lights up half of it. We only see the part of that lit half facing Earth.",
            "As the Moon orbits Earth, the angle between Moon and Sun changes, so the lit shape we see changes too.",
            "New Moon sits between Earth and the Sun. Full Moon is on the far side. First Quarter is a right-angle turn from the Sun.",
        ]);
        this.renderLoop();
    }
    target() {
        return TARGETS[this.idx];
    }
    // Illuminated fraction seen from Earth: 0 (new) .. 1 (full).
    litFraction() {
        return (1 - Math.cos(this.theta)) / 2;
    }
    waxing() {
        return Math.sin(this.theta) >= 0;
    }
    setFromPointer(p) {
        if (this.ended)
            return;
        this.theta = Math.atan2(p.y - EY, p.x - EX);
        if (this.theta < 0)
            this.theta += Math.PI * 2;
        this.updateReadout();
    }
    phaseName() {
        const f = this.litFraction();
        if (f < 0.04)
            return "🌑 New Moon";
        if (f > 0.96)
            return "🌕 Full Moon";
        const wax = this.waxing();
        if (Math.abs(f - 0.5) < 0.08)
            return wax ? "🌓 First Quarter" : "🌗 Last Quarter";
        if (f < 0.5)
            return wax ? "🌒 Waxing Crescent" : "🌘 Waning Crescent";
        return wax ? "🌔 Waxing Gibbous" : "🌖 Waning Gibbous";
    }
    buildPanel() {
        const lockBtn = el("button", { class: "btn", style: { background: "var(--accent-purple)" }, onclick: () => this.lockIn() }, "🔒 This is the phase");
        this.targetEl = el("span", { style: { color: "var(--accent-purple)" } }, `${this.target().emoji} ${this.target().name}`);
        this.phaseEl = el("span", {}, "—");
        this.statusEl = el("span", {}, `0 / ${TARGETS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
        });
        this.coachEl.textContent = "Drag the Moon around Earth until you see the requested phase.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Make"), this.targetEl), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag the Moon, then lock it"), lockBtn, el("div", { class: "metric" }, el("span", {}, "🌙 You see"), this.phaseEl), el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        this.phaseEl.textContent = this.phaseName();
    }
    lockIn() {
        if (this.ended)
            return;
        const t = this.target();
        let diff = Math.abs(this.theta - t.angle);
        if (diff > Math.PI)
            diff = Math.PI * 2 - diff;
        if (diff < byTier(this.ctx.tier, 0.5, 0.38, 0.26)) {
            this.matched += 1;
            this.ctx.services.audio.play("tick");
            this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
            this.coachEl.textContent = `✅ ${t.hint}`;
            this.idx += 1;
            if (this.matched >= TARGETS.length) {
                this.win();
            }
            else {
                this.targetEl.textContent = `${this.target().emoji} ${this.target().name}`;
            }
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ That's a ${this.phaseName().replace(/^.\s*/, "")}. ${t.hint}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("moonphases_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Moon master! The Sun always lights half the Moon — phases are just how much of that lit half we can see as the Moon orbits Earth.",
            stars,
            resources: { Minerals: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.02;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    // Draw the Moon's phase as seen from Earth.
    drawPhase(c, cx, cy, r, f, waxing) {
        // dark disk
        c.fillStyle = "#2b2b40";
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
        if (f > 0.005) {
            c.fillStyle = "#f6f3d0";
            const rx = Math.abs(r * Math.cos(f * Math.PI));
            const crescent = f < 0.5; // terminator bulges across vs away
            c.beginPath();
            if (waxing) {
                c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); // right limb
                c.ellipse(cx, cy, rx, r, 0, Math.PI / 2, -Math.PI / 2, crescent);
            }
            else {
                c.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false); // left limb
                c.ellipse(cx, cy, rx, r, 0, -Math.PI / 2, Math.PI / 2, crescent);
            }
            c.closePath();
            c.fill();
        }
        // craters hint
        c.strokeStyle = "rgba(0,0,0,0.12)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#070b20";
        c.fillRect(0, 0, W, H);
        // stars
        c.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < 60; i++) {
            c.fillRect((i * 137) % W, (i * 91) % H, 2, 2);
        }
        // Sun on the right with rays pointing left
        const sunX = 760;
        c.fillStyle = "#ffd23f";
        c.beginPath();
        c.arc(sunX, EY, 46, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(255,210,63,0.35)";
        c.lineWidth = 3;
        for (let y = 120; y < 520; y += 40) {
            c.beginPath();
            c.moveTo(sunX - 50, y);
            c.lineTo(EX + 40, y);
            c.stroke();
        }
        c.fillStyle = "#fde68a";
        c.font = "bold 14px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Sunlight →", 700, 90);
        // orbit
        c.strokeStyle = "rgba(255,255,255,0.18)";
        c.setLineDash([5, 7]);
        c.beginPath();
        c.arc(EX, EY, ORBIT, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        // Earth
        c.fillStyle = "#2f6fb0";
        c.beginPath();
        c.arc(EX, EY, 34, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3f8f4f";
        c.beginPath();
        c.arc(EX - 10, EY - 6, 12, 0, Math.PI * 2);
        c.arc(EX + 12, EY + 10, 9, 0, Math.PI * 2);
        c.fill();
        // Earth's night side (left, away from sun)
        c.fillStyle = "rgba(0,0,20,0.45)";
        c.beginPath();
        c.arc(EX, EY, 34, Math.PI / 2, -Math.PI / 2, false);
        c.fill();
        // Moon on orbit — drawn half-lit toward the Sun (real space view)
        const mx = EX + Math.cos(this.theta) * ORBIT;
        const my = EY + Math.sin(this.theta) * ORBIT;
        c.fillStyle = "#555";
        c.beginPath();
        c.arc(mx, my, 18, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#f6f3d0"; // lit half always faces the Sun (right)
        c.beginPath();
        c.arc(mx, my, 18, -Math.PI / 2, Math.PI / 2, false);
        c.fill();
        // drag ring
        c.strokeStyle = this.dragging ? "#22c55e" : "rgba(255,255,255,0.6)";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(mx, my, 24, 0, Math.PI * 2);
        c.stroke();
        // sight line Earth -> Moon
        c.strokeStyle = "rgba(255,255,255,0.25)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(EX, EY);
        c.lineTo(mx, my);
        c.stroke();
        // "As seen from Earth" inset
        const ix = 120;
        const iy = 130;
        c.fillStyle = "rgba(255,255,255,0.08)";
        this.roundRect(c, ix - 70, iy - 70, 140, 170, 16);
        c.fill();
        this.drawPhase(c, ix, iy, 50, this.litFraction(), this.waxing());
        c.fillStyle = "#e2e8f0";
        c.font = "bold 14px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("From Earth", ix, iy + 88);
        // title + target reminder
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText(`Make a ${this.target().name} ${this.target().emoji}`, W / 2 + 60, 40);
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
        this.theta = Math.PI / 2;
        this.idx = 0;
        this.matched = 0;
        this.mistakes = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const moonPhasesGame = {
    meta: {
        id: "moonphases",
        conceptId: "ess-05",
        title: "Moon Watcher",
        stream: "earth-space",
        gradeBand: "3-5",
        emoji: "🌙",
        blurb: "Orbit the Moon around Earth and discover why it seems to change shape.",
        mission: "Position the Moon to create a Full Moon, New Moon, and First Quarter.",
        estMinutes: 3,
    },
    create: (ctx) => new MoonPhases(ctx),
};
