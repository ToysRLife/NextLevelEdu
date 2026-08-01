import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const CONSTELLATIONS = [
    {
        name: "The Big Dipper",
        emoji: "🥄",
        stars: [
            { x: 150, y: 200 },
            { x: 240, y: 215 },
            { x: 330, y: 235 },
            { x: 415, y: 255 },
            { x: 455, y: 345 },
            { x: 360, y: 370 },
            { x: 285, y: 345 },
        ],
    },
    {
        name: "Cassiopeia",
        emoji: "👑",
        stars: [
            { x: 180, y: 420 },
            { x: 270, y: 330 },
            { x: 360, y: 410 },
            { x: 450, y: 325 },
            { x: 540, y: 410 },
        ],
    },
    {
        name: "Orion's Belt",
        emoji: "🗡️",
        stars: [
            { x: 540, y: 250 },
            { x: 610, y: 285 },
            { x: 680, y: 320 },
        ],
    },
];
class Constellations {
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
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "connected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // stars connected in current constellation
        Object.defineProperty(this, "mistakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "bgStars", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "doneLines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
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
        for (let i = 0; i < 90; i++) {
            this.bgStars.push({ x: (i * 137.5) % W, y: (i * 91.3) % H, s: (i % 3) + 1 });
        }
        this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
        this.buildPanel();
        ctx.services.hints.setHints([
            "Constellations are patterns people imagined by joining bright stars — they help us find our way in the night sky.",
            "Connect the glowing stars one at a time. The next star to tap pulses with a ring.",
            "Follow the pulsing ring from star to star to trace the whole shape.",
        ]);
        this.renderLoop();
    }
    current() {
        return CONSTELLATIONS[this.idx];
    }
    buildPanel() {
        this.statusEl = el("span", { style: { color: "var(--accent-purple)" } }, `0 / ${CONSTELLATIONS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
        });
        this.coachEl.textContent = `Trace ${this.current().name} ${this.current().emoji} by tapping its stars in order.`;
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Trace"), el("span", {}, `${this.current().emoji} ${this.current().name}`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap the pulsing star next"), el("div", { class: "metric" }, el("span", {}, "✨ Constellations"), this.statusEl), this.coachEl);
    }
    tap(p) {
        if (this.ended)
            return;
        const stars = this.current().stars;
        const expected = stars[this.connected];
        if (!expected)
            return;
        const d = Math.hypot(p.x - expected.x, p.y - expected.y);
        if (d < 34) {
            if (this.connected > 0) {
                this.doneLines.push({ a: stars[this.connected - 1], b: expected });
            }
            this.connected += 1;
            this.ctx.services.audio.play("tick");
            if (this.connected >= stars.length) {
                // constellation complete
                this.ctx.services.audio.play("reward");
                this.idx += 1;
                this.connected = 0;
                this.statusEl.textContent = `${this.idx} / ${CONSTELLATIONS.length}`;
                if (this.idx >= CONSTELLATIONS.length) {
                    this.win();
                }
                else {
                    this.coachEl.textContent = `🌟 Beautiful! Now trace ${this.current().name} ${this.current().emoji}.`;
                }
            }
            else {
                this.coachEl.textContent = "✨ Connected! Follow the ring to the next star.";
            }
        }
        else {
            // tapped near a wrong star?
            const nearAny = stars.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 34);
            if (nearAny) {
                this.mistakes += 1;
                this.ctx.services.audio.play("fail");
                this.coachEl.textContent = "Not that one yet — tap the star with the pulsing ring.";
            }
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("constellations_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "The sky is mapped! Constellations are star patterns people connected long ago to tell stories and find directions at night.",
            stars,
            resources: { Minerals: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.08;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#0b1026");
        grad.addColorStop(1, "#1e1b4b");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        // background stars
        for (const s of this.bgStars) {
            c.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(this.anim + s.x)})`;
            c.fillRect(s.x, s.y, s.s, s.s);
        }
        // completed constellation lines (persist faintly)
        c.strokeStyle = "rgba(155,107,255,0.5)";
        c.lineWidth = 2;
        for (const l of this.doneLines) {
            c.beginPath();
            c.moveTo(l.a.x, l.a.y);
            c.lineTo(l.b.x, l.b.y);
            c.stroke();
        }
        if (this.ended) {
            c.fillStyle = "#e9d5ff";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("The night sky is mapped! ✨", W / 2, 80);
        }
        // current constellation stars
        const cons = this.ended ? null : this.current();
        if (cons) {
            cons.stars.forEach((s, i) => {
                const isConnected = i < this.connected;
                const isNext = i === this.connected;
                // glow
                c.fillStyle = isConnected ? "#c4b5fd" : "#fde68a";
                c.beginPath();
                c.arc(s.x, s.y, 8, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = "rgba(255,255,255,0.9)";
                c.beginPath();
                c.arc(s.x, s.y, 4, 0, Math.PI * 2);
                c.fill();
                if (isNext) {
                    const r = 16 + Math.sin(this.anim * 2) * 5;
                    c.strokeStyle = "#22c55e";
                    c.lineWidth = 3;
                    c.beginPath();
                    c.arc(s.x, s.y, r, 0, Math.PI * 2);
                    c.stroke();
                }
            });
        }
        // title
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        if (!this.ended)
            c.fillText(`Trace ${cons.name} ${cons.emoji}`, W / 2, 40);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.connected = 0;
        this.mistakes = 0;
        this.doneLines = [];
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detach();
    }
}
export const constellationsGame = {
    meta: {
        id: "constellations",
        conceptId: "ess-06",
        title: "Connect the Stars",
        stream: "earth-space",
        gradeBand: "1-5",
        emoji: "✨",
        blurb: "Trace famous constellations by connecting their stars in the night sky.",
        mission: "Connect the stars to trace the Big Dipper, Cassiopeia, and Orion's Belt.",
        estMinutes: 2,
    },
    create: (ctx) => new Constellations(ctx),
};
