import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider } from "@core/controls";
import { drawBars } from "@core/graph";
// Energy conservation (MS-PS3): a coaster trades potential energy (height) for
// kinetic energy (speed). To clear a hill the car needs at least that hill's
// height stored at the start — otherwise its kinetic energy hits zero and it
// stalls. Set the launch height to get over the tallest hill.
const W = 800;
const H = 600;
const GROUND = 520;
const PX_PER_M = 4; // vertical scale
const ROUNDS = [
    {
        hills: [
            { x: 300, peak: 40 },
            { x: 520, peak: 30 },
        ],
    }, // tallest 40
    {
        hills: [
            { x: 260, peak: 45 },
            { x: 470, peak: 65 },
            { x: 660, peak: 35 },
        ],
    }, // tallest 65
    {
        hills: [
            { x: 280, peak: 55 },
            { x: 480, peak: 40 },
            { x: 640, peak: 60 },
        ],
    }, // tallest 60
];
class Coaster {
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
        Object.defineProperty(this, "launchH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 30
        }); // metres
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "misses", {
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
        Object.defineProperty(this, "rolling", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "carX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60
        });
        Object.defineProperty(this, "acc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "launchCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tallestRead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enoughRead", {
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
        this.buildPanel();
        ctx.services.hints.setHints([
            "Energy is conserved: height (potential energy) turns into speed (kinetic energy) and back.",
            "At the top of a hill the car is slowest — most energy is potential there. If it runs out before the top, it stalls.",
            "Start at least as high as the tallest hill so there's always some kinetic energy left to keep moving.",
        ]);
        this.loop.start();
        this.render();
    }
    round() {
        return ROUNDS[this.idx];
    }
    tallest() {
        return Math.max(...this.round().hills.map((h) => h.peak));
    }
    /** Track height (metres) at screen-x, from the fixed hill bumps. */
    heightAt(x) {
        let h = 0;
        for (const hill of this.round().hills) {
            const d = (x - hill.x) / 70;
            h += hill.peak * Math.exp(-d * d);
        }
        return h;
    }
    buildPanel() {
        this.launchCtl = slider({
            label: "🗼 Launch height",
            min: 10,
            max: 100,
            value: this.launchH,
            step: 5,
            unit: "m",
            color: "var(--accent-purple)",
            onInput: (v) => {
                this.launchH = v;
                this.updateReadout();
                this.render();
            },
        });
        this.tallestRead = readout("⛰️ Tallest hill");
        this.enoughRead = readout("⚡ Enough energy?");
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#f5f3ff" },
        });
        this.coachEl.textContent = "Set your launch height, then send the car!";
        this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.launch() }, "🎢 Send the car");
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Clear the whole track")), this.launchCtl.el, this.tallestRead.el, this.enoughRead.el, this.goBtn, el("div", { class: "metric" }, el("span", {}, "✅ Tracks cleared"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const t = this.tallest();
        this.tallestRead.set(`${t} m`);
        this.enoughRead.set(this.launchH > t ? "Yes ✓" : "Not yet — go higher");
    }
    launch() {
        if (this.ended || this.rolling)
            return;
        this.rolling = true;
        this.carX = 60;
        this.acc = 0;
        this.launchCtl.setEnabled(false);
        this.goBtn.disabled = true;
        this.ctx.services.audio.play("click");
    }
    tick(dtMs) {
        if (this.ended)
            return;
        if (this.rolling) {
            this.acc += dtMs;
            let steps = 0;
            while (this.rolling && this.acc >= 16.67 && steps < 30) {
                this.step();
                this.acc -= 16.67;
                steps++;
            }
        }
        this.render();
    }
    step() {
        const ke = this.launchH - this.heightAt(this.carX); // energy units (m)
        if (ke <= 0.2) {
            // stalled on a climb — not enough energy
            this.rolling = false;
            this.launchCtl.setEnabled(true);
            this.goBtn.disabled = false;
            this.misses += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `😣 Stalled! The car ran out of kinetic energy before the top. Start higher than ${this.tallest()} m.`;
            return;
        }
        this.carX += Math.sqrt(ke) * 0.5; // speed ∝ √(kinetic energy)
        if (this.carX >= W - 40) {
            this.rolling = false;
            this.launchCtl.setEnabled(true);
            this.goBtn.disabled = false;
            this.hits += 1;
            this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
            this.ctx.services.audio.play("tick");
            if (this.hits >= ROUNDS.length)
                this.finish();
            else {
                this.idx += 1;
                this.carX = 60;
                this.coachEl.textContent =
                    "🎢 Cleared! Next track has different hills — check the tallest one.";
                this.buildPanel();
            }
        }
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
        this.ctx.services.score.event("coaster_done", { misses: this.misses });
        this.ctx.services.outcome.succeed({
            message: "Smooth ride! Energy is conserved — your starting height becomes speed and back into height. To clear a hill you need at least its height stored at the start.",
            stars,
            resources: { Power: 60 },
        });
    }
    render() {
        const c = this.ctx2d;
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#ede9fe");
        grad.addColorStop(1, "#ddd6fe");
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#5b21b6";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Every track cleared! 🎢", W / 2, H / 2);
            return;
        }
        // track profile
        c.strokeStyle = "#7c3aed";
        c.lineWidth = 5;
        c.beginPath();
        for (let x = 40; x <= W - 30; x += 4) {
            const y = GROUND - this.heightAt(x) * PX_PER_M;
            if (x === 40)
                c.moveTo(x, y);
            else
                c.lineTo(x, y);
        }
        c.stroke();
        // launch tower (start height)
        const towerY = GROUND - this.launchH * PX_PER_M;
        c.strokeStyle = "rgba(124,58,237,0.4)";
        c.setLineDash([6, 5]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(40, towerY);
        c.lineTo(W - 30, towerY);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#6d28d9";
        c.font = "bold 12px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText(`launch energy = ${this.launchH} m`, 46, towerY - 6);
        // car
        const cy = GROUND - this.heightAt(this.carX) * PX_PER_M;
        c.font = "30px serif";
        c.textAlign = "center";
        c.fillText("🎢", this.carX, cy - 6);
        // energy bars
        const ke = Math.max(0, this.launchH - this.heightAt(this.carX));
        const pe = this.heightAt(this.carX);
        drawBars(c, 470, 70, 300, 180, [
            { label: "Potential", value: pe, color: "#a78bfa" },
            { label: "Kinetic", value: ke, color: "#f59e0b" },
            { label: "Total", value: this.launchH, color: "#22c55e" },
        ], Math.max(this.launchH, this.tallest()), "Energy (m)");
        c.fillStyle = "#5b21b6";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Give the car enough energy to clear every hill 🎢", W / 2, 40);
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
        this.rolling = false;
        this.launchH = 30;
        this.idx = 0;
        this.hits = 0;
        this.misses = 0;
        this.carX = 60;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const coasterGame = {
    meta: {
        id: "coaster",
        conceptId: "phys-27",
        title: "Coaster Architect",
        stream: "physics",
        gradeBand: "6-8",
        emoji: "🎢",
        blurb: "Set the launch height so stored energy carries the coaster over every hill.",
        mission: "Use energy conservation to clear each track — start higher than the tallest hill.",
        estMinutes: 4,
    },
    create: (ctx) => new Coaster(ctx),
};
