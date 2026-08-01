import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
// Rectangle loop geometry.
const LX = 200;
const RX = 600;
const TY = 170;
const BY = 430;
const BATTERY = { x: LX, y: (TY + BY) / 2 };
const BULB = { x: (LX + RX) / 2, y: TY };
class Circuits {
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
        Object.defineProperty(this, "raf", {
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
        Object.defineProperty(this, "flow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "toggles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                { id: "wireA", x: RX, y: (TY + BY) / 2, label: "Wire", closed: false },
                { id: "wireB", x: (LX + RX) / 2, y: BY, label: "Wire", closed: false },
                { id: "short", x: LX - 70, y: (TY + BY) / 2, label: "Jumper", closed: false },
            ]
        });
        Object.defineProperty(this, "coachEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.buildPanel();
        ctx.services.hints.setHints([
            "A bulb only lights when electricity can flow in a complete, unbroken loop from one battery end to the other.",
            "Close the gaps in the wire to finish the loop. Tap a gap to connect or disconnect it.",
            "Close both wire gaps to complete the loop through the bulb. Leave the jumper across the battery OPEN — that's a short circuit!",
        ]);
        this.attach();
        this.renderLoop();
    }
    buildPanel() {
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Tap the open gaps to connect the wires and complete the loop.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "control-label" }, "Tap a gap to connect / disconnect"), el("div", { class: "metric" }, el("span", {}, "🔌 Battery"), el("span", {}, "1.5 V")), el("div", { class: "metric" }, el("span", {}, "💡 Bulb"), el("span", { id: "bulb-state" }, "Off")), this.coachEl);
    }
    attach() {
        this.detach = onPointer(this.ctx.canvas, W, H, {
            down: (p) => {
                if (this.ended)
                    return;
                for (const t of this.toggles) {
                    if (Math.hypot(t.x - p.x, t.y - p.y) <= 28) {
                        t.closed = !t.closed;
                        this.ctx.services.audio.play("click");
                        this.evaluate();
                        return;
                    }
                }
            },
        });
    }
    lit() {
        const a = this.toggles.find((t) => t.id === "wireA").closed;
        const b = this.toggles.find((t) => t.id === "wireB").closed;
        const short = this.toggles.find((t) => t.id === "short").closed;
        return a && b && !short;
    }
    evaluate() {
        const short = this.toggles.find((t) => t.id === "short").closed;
        const bulbState = document.getElementById("bulb-state");
        if (short) {
            if (bulbState)
                bulbState.textContent = "SHORT!";
            this.fail();
            return;
        }
        if (this.lit()) {
            if (bulbState)
                bulbState.textContent = "On 💡";
            this.win();
        }
        else {
            if (bulbState)
                bulbState.textContent = "Off";
            this.coachEl.textContent = "Not a complete loop yet — find the remaining open gap.";
        }
    }
    win() {
        this.ended = true;
        const hintsUsed = this.ctx.services.hints.count();
        const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
        this.ctx.services.score.event("circuit_complete", {});
        this.ctx.services.outcome.succeed({
            message: "The bulb lit up! You built a complete circuit — an unbroken loop carrying current through the bulb.",
            stars,
            resources: { Power: 45 },
        });
    }
    fail() {
        this.ended = true;
        this.ctx.services.outcome.fail({
            message: "Short circuit! The jumper let current race straight across the battery, skipping the bulb. Keep that gap open.",
        });
    }
    renderLoop() {
        const draw = () => {
            this.flow += this.lit() ? 0.06 : 0;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    seg(c, a, b, on) {
        c.strokeStyle = on ? "#fbbf24" : "#475569";
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
    }
    render() {
        const c = this.ctx2d;
        const lit = this.lit();
        c.fillStyle = "#0f172a";
        c.fillRect(0, 0, W, H);
        const TL = { x: LX, y: TY };
        const TR = { x: RX, y: TY };
        const BR = { x: RX, y: BY };
        const BL = { x: LX, y: BY };
        const wireA = this.toggles.find((t) => t.id === "wireA").closed;
        const wireB = this.toggles.find((t) => t.id === "wireB").closed;
        // top-left to bulb, bulb to top-right (top edge always wired, bulb in middle)
        this.seg(c, TL, BULB, lit);
        this.seg(c, BULB, TR, lit);
        // left edge: battery sits here (always conducting to corners)
        this.seg(c, TL, BATTERY, lit);
        this.seg(c, BATTERY, BL, lit);
        // right edge (wireA gap)
        this.seg(c, TR, BR, wireA && lit);
        // bottom edge (wireB gap)
        this.seg(c, BR, BL, wireB && lit);
        // flowing electrons on the perimeter when lit
        if (lit) {
            const path = [TL, BULB, TR, BR, BL, TL];
            const total = path.length - 1;
            for (let e = 0; e < 18; e++) {
                const tt = (this.flow + e / 18) % 1;
                const fseg = tt * total;
                const i = Math.floor(fseg);
                const frac = fseg - i;
                const p0 = path[i];
                const p1 = path[i + 1];
                const x = p0.x + (p1.x - p0.x) * frac;
                const y = p0.y + (p1.y - p0.y) * frac;
                c.fillStyle = "#fde047";
                c.beginPath();
                c.arc(x, y, 4, 0, Math.PI * 2);
                c.fill();
            }
        }
        // battery
        c.fillStyle = "#22c55e";
        c.fillRect(BATTERY.x - 16, BATTERY.y - 30, 32, 60);
        c.fillStyle = "#fff";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("+", BATTERY.x, BATTERY.y - 12);
        c.fillText("−", BATTERY.x, BATTERY.y + 24);
        // bulb
        c.beginPath();
        c.arc(BULB.x, BULB.y, 26, 0, Math.PI * 2);
        if (lit) {
            const glow = c.createRadialGradient(BULB.x, BULB.y, 4, BULB.x, BULB.y, 60);
            glow.addColorStop(0, "#fffbeb");
            glow.addColorStop(1, "transparent");
            c.fillStyle = glow;
            c.fillRect(BULB.x - 60, BULB.y - 60, 120, 120);
            c.beginPath();
            c.arc(BULB.x, BULB.y, 26, 0, Math.PI * 2);
            c.fillStyle = "#fde047";
        }
        else {
            c.fillStyle = "#334155";
        }
        c.fill();
        c.font = "26px serif";
        c.fillText("💡", BULB.x, BULB.y + 9);
        // toggles
        for (const t of this.toggles) {
            const danger = t.id === "short";
            c.beginPath();
            c.arc(t.x, t.y, 22, 0, Math.PI * 2);
            c.fillStyle = t.closed ? (danger ? "#ef4444" : "#fbbf24") : "#1e293b";
            c.strokeStyle = danger ? "#ef4444" : "#64748b";
            c.lineWidth = 3;
            c.fill();
            c.stroke();
            c.fillStyle = "#fff";
            c.font = "18px serif";
            c.fillText(t.closed ? "🔗" : "✂️", t.x, t.y + 6);
            c.fillStyle = danger ? "#fca5a5" : "#94a3b8";
            c.font = "bold 12px Nunito, sans-serif";
            c.fillText(danger ? "jumper" : "gap", t.x, t.y + 38);
        }
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.flow = 0;
        for (const t of this.toggles)
            t.closed = false;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach?.();
    }
}
export const circuitsGame = {
    meta: {
        id: "circuits",
        conceptId: "phys-21",
        title: "Light It Up",
        stream: "physics",
        gradeBand: "4-5",
        emoji: "💡",
        blurb: "Connect the wires into a complete loop to light the bulb — without causing a short.",
        mission: "Close the gaps to make one complete loop through the bulb, and keep the dangerous jumper open.",
        estMinutes: 3,
    },
    create: (ctx) => new Circuits(ctx),
};
