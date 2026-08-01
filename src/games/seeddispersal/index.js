import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const GROUND = 470;
const NEED = 3; // seeds that must reach the meadow
const MEADOW = { x: 560, w: 180 }; // far target patch of soil
class SeedDispersal {
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
        Object.defineProperty(this, "wind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // current gust strength 0..1 (oscillating)
        Object.defineProperty(this, "windDir", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "seeds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "launched", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "reached", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "missed", {
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
        Object.defineProperty(this, "statusEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "windEl", {
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
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.buildPanel();
        ctx.services.hints.setHints([
            "Many plants can't move, so they use the wind to carry their light, fluffy seeds to new ground.",
            "A stronger gust carries seeds farther. Watch the wind meter and wait for a strong puff.",
            `Release on a strong gust so the seed drifts all the way to the far soil patch. Land ${NEED} seeds there to win.`,
        ]);
        this.loop.start();
        this.render();
    }
    buildPanel() {
        const releaseBtn = el("button", {
            class: "btn",
            style: { background: "var(--accent-green)" },
            onclick: () => this.release(),
        }, "🌬️ Release Seed");
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / ${NEED}`);
        this.windEl = el("span", {}, "—");
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent =
            "Wait for a strong gust, then release a seed to ride the wind to the far soil.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, `Land ${NEED} in the meadow`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Time your release with the wind"), releaseBtn, el("div", { class: "metric" }, el("span", {}, "🌬️ Wind"), this.windEl), el("div", { class: "metric" }, el("span", {}, "🌱 Landed in meadow"), this.statusEl), this.coachEl);
    }
    release() {
        if (this.ended)
            return;
        // Seed launches from the dandelion; the current gust sets its drift speed.
        const speed = 1.0 + this.wind * 4.2;
        this.seeds.push({
            x: 120,
            y: GROUND - 120,
            vx: speed,
            vy: -1.4,
            sway: Math.random() * Math.PI * 2,
            landed: false,
        });
        this.launched += 1;
        this.ctx.services.audio.play("click");
    }
    tick(dtMs) {
        if (this.ended)
            return;
        const f = dtMs / 16.67;
        // Wind gust oscillates so the player must time the release.
        this.wind += this.windDir * 0.012 * f;
        if (this.wind >= 1) {
            this.wind = 1;
            this.windDir = -1;
        }
        else if (this.wind <= 0) {
            this.wind = 0;
            this.windDir = 1;
        }
        for (const s of this.seeds) {
            if (s.landed)
                continue;
            s.sway += 0.12 * f;
            s.x += (s.vx + Math.sin(s.sway) * 0.4) * f;
            // gentle fall — fluffy seeds drift down slowly
            s.vy += 0.02 * f;
            s.y += s.vy * f;
            s.vx *= 1 - 0.004 * f; // air drag slows the glide
            if (s.y >= GROUND) {
                s.y = GROUND;
                s.landed = true;
                const inMeadow = s.x >= MEADOW.x && s.x <= MEADOW.x + MEADOW.w;
                if (inMeadow) {
                    this.reached += 1;
                    this.ctx.services.audio.play("tick");
                    this.coachEl.textContent =
                        "🌱 It took root in the meadow! The wind carried it to fresh soil.";
                }
                else {
                    this.missed += 1;
                    this.ctx.services.audio.play("fail");
                    this.coachEl.textContent =
                        s.x < MEADOW.x
                            ? "It fell short — wait for a stronger gust so it drifts farther."
                            : "Too far past the soil — a slightly gentler gust would land it.";
                }
                this.statusEl.textContent = `${this.reached} / ${NEED}`;
                if (this.reached >= NEED)
                    this.finish();
            }
        }
        this.windEl.textContent =
            this.wind > 0.66 ? "💨 strong" : this.wind > 0.33 ? "🍃 medium" : "· calm";
        this.render();
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        // Fewer wasted seeds = better timing = more stars.
        const stars = this.missed === 0 ? 3 : this.missed <= 2 ? 2 : 1;
        this.ctx.services.score.event("seeddispersal_done", {
            launched: this.launched,
            missed: this.missed,
        });
        this.ctx.services.outcome.succeed({
            message: "New plants will grow! Plants can't walk, so they let the wind scatter light, fluffy seeds far away to find fresh soil and sunlight.",
            stars,
            resources: { Seeds: 40 },
        });
    }
    render() {
        const c = this.ctx2d;
        // sky
        c.fillStyle = "#dbeafe";
        c.fillRect(0, 0, W, H);
        // wind streaks drifting right (stronger gust = more, faster streaks)
        c.strokeStyle = `rgba(255,255,255,${0.3 + this.wind * 0.5})`;
        c.lineWidth = 2;
        const n = 3 + Math.floor(this.wind * 6);
        for (let i = 0; i < n; i++) {
            const wy = 60 + ((i * 53) % 320);
            const off = (Date.now() / (12 - this.wind * 8) + i * 80) % W;
            c.beginPath();
            c.moveTo(off, wy);
            c.lineTo(off + 30 + this.wind * 40, wy);
            c.stroke();
        }
        // ground
        c.fillStyle = "#86efac";
        c.fillRect(0, GROUND, W, H - GROUND);
        // meadow soil patch (the target)
        c.fillStyle = "#a16207";
        c.fillRect(MEADOW.x, GROUND, MEADOW.w, H - GROUND);
        c.fillStyle = "#3f6212";
        c.font = "bold 16px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("Fresh soil 🌱", MEADOW.x + MEADOW.w / 2, GROUND + 40);
        // dandelion (launcher)
        c.strokeStyle = "#16a34a";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(120, GROUND);
        c.lineTo(120, GROUND - 100);
        c.stroke();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(120, GROUND - 120, 22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fde68a";
        c.beginPath();
        c.arc(120, GROUND - 120, 8, 0, Math.PI * 2);
        c.fill();
        // wind strength meter bar
        const barX = 60;
        const barY = 40;
        const barW = 220;
        c.fillStyle = "rgba(255,255,255,0.6)";
        this.roundRect(c, barX, barY, barW, 22, 11);
        c.fill();
        c.fillStyle = this.wind > 0.66 ? "#16a34a" : this.wind > 0.33 ? "#84cc16" : "#cbd5e1";
        this.roundRect(c, barX, barY, barW * this.wind, 22, 11);
        c.fill();
        c.fillStyle = "#334155";
        c.font = "bold 14px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText("Wind gust", barX, barY - 8);
        // seeds in flight
        for (const s of this.seeds) {
            c.save();
            c.translate(s.x, s.y);
            if (!s.landed) {
                c.strokeStyle = "#cbd5e1";
                c.lineWidth = 1.5;
                for (let a = 0; a < 6; a++) {
                    const ang = (a / 6) * Math.PI * 2;
                    c.beginPath();
                    c.moveTo(0, 0);
                    c.lineTo(Math.cos(ang) * 10, Math.sin(ang) * 10 - 6);
                    c.stroke();
                }
            }
            c.fillStyle = s.landed ? "#16a34a" : "#a16207";
            c.beginPath();
            c.arc(0, s.landed ? -4 : 0, 4, 0, Math.PI * 2);
            c.fill();
            if (s.landed) {
                c.font = "18px serif";
                c.textAlign = "center";
                c.fillText("🌱", 0, 2);
            }
            c.restore();
        }
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
        this.seeds = [];
        this.launched = 0;
        this.reached = 0;
        this.missed = 0;
        this.wind = 0;
        this.windDir = 1;
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const seedDispersalGame = {
    meta: {
        id: "seeddispersal",
        conceptId: "bio-06",
        title: "Ride the Wind",
        stream: "biology",
        gradeBand: "2-3",
        emoji: "🌬️",
        blurb: "Time the gusts to scatter fluffy seeds to fresh soil far away.",
        mission: "Use the wind to carry seeds to the distant meadow and grow new plants.",
        estMinutes: 3,
    },
    create: (ctx) => new SeedDispersal(ctx),
};
