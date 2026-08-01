import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ROAD_Y = 320;
// Each has a clean answer: speed = dist / time.
const ROUNDS = [
    { dist: 60, time: 3 }, // 20
    { dist: 80, time: 2 }, // 40
    { dist: 90, time: 3 }, // 30
];
class Speed {
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
        Object.defineProperty(this, "loop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "speed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 20
        });
        Object.defineProperty(this, "roundIdx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "driving", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "progress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "elapsed", {
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
        Object.defineProperty(this, "ended", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Adaptive difficulty: a forgiving arrival window for juniors, strict for masters.
        Object.defineProperty(this, "tol", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "speedEl", {
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
        Object.defineProperty(this, "goBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.tol = ctx.tier === "junior" ? 0.6 : ctx.tier === "master" ? 0.18 : 0.35;
        this.buildPanel();
        ctx.services.hints.setHints([
            "Speed is how much distance you cover in a certain time.",
            "To find the speed you need: divide the distance by the time. Speed = distance ÷ time.",
            "For example, 60 metres in 3 seconds means 60 ÷ 3 = 20 metres per second.",
        ]);
        this.loop.start();
        this.render();
    }
    round() {
        return ROUNDS[this.roundIdx];
    }
    buildPanel() {
        const slider = el("input", {
            type: "range",
            min: "5",
            max: "60",
            step: "5",
            value: String(this.speed),
            "aria-label": "Speed",
            style: { accentColor: "var(--accent-blue)" },
            oninput: (e) => {
                if (this.driving)
                    return;
                this.speed = Number(e.target.value);
                this.updateReadout();
            },
        });
        this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.go() }, "🚚 Deliver!");
        this.speedEl = el("span", {}, "");
        this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.roundIdx} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Deliver"), el("span", {}, `${this.round().dist} m in ${this.round().time} s`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "🚚 Set the speed (m/s)"), slider, this.goBtn, el("div", { class: "metric" }, el("span", {}, "⚡ Speed"), this.speedEl), el("div", { class: "metric" }, el("span", {}, "📦 Delivered"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const r = this.round();
        this.speedEl.textContent = `${this.speed} m/s`;
        this.coachEl.textContent = `Speed = distance ÷ time = ${r.dist} ÷ ${r.time}. Set the dial to match!`;
    }
    go() {
        if (this.ended || this.driving)
            return;
        this.driving = true;
        this.progress = 0;
        this.elapsed = 0;
        this.goBtn.disabled = true;
        this.ctx.services.audio.play("click");
    }
    tick(dtMs) {
        if (this.ended || !this.driving)
            return;
        const dts = dtMs / 1000;
        this.elapsed += dts;
        const r = this.round();
        // progress fraction per second = speed / distance
        this.progress += (this.speed / r.dist) * dts;
        if (this.progress >= 1) {
            this.progress = 1;
            this.driving = false;
            this.goBtn.disabled = false;
            const travelTime = r.dist / this.speed;
            if (Math.abs(travelTime - r.time) < this.tol) {
                this.ctx.services.audio.play("tick");
                this.coachEl.textContent = `✅ On time! ${r.dist} ÷ ${r.time} = ${r.dist / r.time} m/s.`;
                this.roundIdx += 1;
                this.statusEl.textContent = `${this.roundIdx} / ${ROUNDS.length}`;
                if (this.roundIdx >= ROUNDS.length)
                    this.win();
                else {
                    this.speed = 20;
                    this.progress = 0;
                    this.buildPanel();
                }
            }
            else {
                this.mistakes += 1;
                this.ctx.services.audio.play("fail");
                this.coachEl.textContent =
                    travelTime > r.time
                        ? `Too slow — took ${travelTime.toFixed(1)}s. Go faster: ${r.dist} ÷ ${r.time}.`
                        : `Too fast — arrived in ${travelTime.toFixed(1)}s. Ease off: ${r.dist} ÷ ${r.time}.`;
            }
        }
        this.render();
    }
    win() {
        this.ended = true;
        this.loop.stop();
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("speed_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Delivered on time! Speed is distance divided by time — go the right speed and you cover the distance in exactly the time you need.",
            stars,
            resources: { Power: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#dbeafe";
        c.fillRect(0, 0, W, H);
        // road
        c.fillStyle = "#334155";
        c.fillRect(60, ROAD_Y, W - 120, 80);
        c.strokeStyle = "#fde047";
        c.lineWidth = 4;
        c.setLineDash([20, 16]);
        c.beginPath();
        c.moveTo(60, ROAD_Y + 40);
        c.lineTo(W - 60, ROAD_Y + 40);
        c.stroke();
        c.setLineDash([]);
        // finish flag
        c.font = "34px serif";
        c.textAlign = "center";
        c.fillText("🏁", W - 80, ROAD_Y + 16);
        // truck
        const tx = 90 + (W - 200) * this.progress;
        c.font = "44px serif";
        c.fillText("🚚", tx, ROAD_Y + 40);
        // clock
        c.fillStyle = "#1e3a8a";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText(`⏱️ ${this.elapsed.toFixed(1)}s  /  target ${this.round().time}s`, W / 2, 120);
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText(`Deliver ${this.round().dist} m in ${this.round().time} s`, W / 2, 60);
        c.font = "14px Nunito, sans-serif";
        c.fillStyle = "#475569";
        c.fillText("speed = distance ÷ time", W / 2, 88);
    }
    start() {
        if (!this.ended)
            this.loop.start();
    }
    pause() {
        this.loop.stop();
    }
    resume() {
        if (!this.ended)
            this.loop.start();
    }
    reset() {
        this.loop.stop();
        this.ended = false;
        this.speed = 20;
        this.roundIdx = 0;
        this.driving = false;
        this.progress = 0;
        this.elapsed = 0;
        this.mistakes = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const speedGame = {
    meta: {
        id: "speed",
        conceptId: "phys-02",
        title: "Special Delivery",
        stream: "physics",
        gradeBand: "3-5",
        emoji: "🚚",
        blurb: "Set the right speed so the truck covers the distance in exactly the time given.",
        mission: "Use speed = distance ÷ time to deliver on schedule.",
        estMinutes: 3,
    },
    create: (ctx) => new Speed(ctx),
};
