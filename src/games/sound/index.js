import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
const MID = 300;
const NEED = 3; // notes to match
// Each note maps tension (0..100) to a pitch. The player tunes to match.
const NOTES = [
    { name: "Low Doh", tension: 22, emoji: "🐻" },
    { name: "Middle Sol", tension: 55, emoji: "🐦" },
    { name: "High Doh", tension: 84, emoji: "🐭" },
];
class Sound {
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
        Object.defineProperty(this, "tension", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 50
        }); // 0..100 -> pitch
        Object.defineProperty(this, "volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60
        }); // 0..100 -> amplitude
        Object.defineProperty(this, "phase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
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
        Object.defineProperty(this, "ended", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "pitchEl", {
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
        this.loop = new SimLoop((dt) => this.tick(dt));
        this.order = [...NOTES].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Sound comes from vibrations. A guitar string vibrates fast or slow, and that's what we hear as pitch.",
            "Tighter (or shorter) strings vibrate FASTER, making a higher pitch. Looser strings vibrate slower — a lower pitch.",
            "Match the wiggle of your string to the faint target wave: same number of waves means the same pitch. Volume only changes how tall the wave is, not the pitch.",
        ]);
        this.loop.start();
        this.render();
    }
    target() {
        return this.order[this.idx];
    }
    buildPanel() {
        const tensionSlider = el("input", {
            type: "range",
            min: "0",
            max: "100",
            value: String(this.tension),
            "aria-label": "Tension / pitch",
            style: { accentColor: "var(--accent-orange)" },
            oninput: (e) => {
                this.tension = Number(e.target.value);
                this.updateReadout();
            },
        });
        const volumeSlider = el("input", {
            type: "range",
            min: "10",
            max: "100",
            value: String(this.volume),
            "aria-label": "Volume",
            style: { accentColor: "var(--accent-blue)" },
            oninput: (e) => {
                this.volume = Number(e.target.value);
            },
        });
        const pluckBtn = el("button", { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.pluck() }, "🎸 Pluck & check");
        this.pitchEl = el("span", {}, "—");
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent =
            "Tune the string until its wave matches the faint target wave, then pluck.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, `Match ${NEED} notes`)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "🎚️ String tension (pitch)"), tensionSlider, el("div", { class: "control-label" }, "🔊 Volume (loudness)"), volumeSlider, pluckBtn, el("div", { class: "metric" }, el("span", {}, "🎵 Pitch match"), this.pitchEl), el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    matchPct() {
        return 1 - Math.abs(this.tension - this.target().tension) / 100;
    }
    updateReadout() {
        const pct = Math.round(this.matchPct() * 100);
        this.pitchEl.textContent = `${pct}%`;
        this.pitchEl.style.color =
            pct > 92 ? "var(--accent-green)" : pct > 70 ? "var(--accent-orange)" : "var(--accent-red)";
    }
    pluck() {
        if (this.ended)
            return;
        this.ctx.services.audio.play("click");
        if (this.matchPct() >= byTier(this.ctx.tier, 0.85, 0.92, 0.96)) {
            this.matched += 1;
            this.ctx.services.audio.play("tick");
            this.statusEl.textContent = `${this.matched} / ${NEED}`;
            this.coachEl.textContent = "🎵 In tune! Your string vibrates at the same speed as the note.";
            this.idx += 1;
            if (this.matched >= NEED) {
                this.finish();
            }
            else {
                this.coachEl.textContent += ` Next: ${this.target().name}.`;
                this.updateReadout();
            }
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent =
                this.tension < this.target().tension
                    ? "Too low — tighten the string so it vibrates faster for a higher pitch."
                    : "Too high — loosen the string so it vibrates slower for a lower pitch.";
        }
    }
    finish() {
        this.ended = true;
        this.loop.stop();
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("sound_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Perfectly tuned! Sound is vibration. Faster vibrations make a higher pitch, slower ones a lower pitch — and volume just changes how big the vibration is.",
            stars,
            resources: { Fuel: 40 },
        });
    }
    tick(dtMs) {
        if (this.ended)
            return;
        this.phase += (dtMs / 1000) * (2 + (this.tension / 100) * 10);
        this.render();
    }
    waveFor(c, tension, amp, color, dashed) {
        const waves = 1 + (tension / 100) * 7; // higher tension = more waves
        c.strokeStyle = color;
        c.lineWidth = dashed ? 2 : 4;
        if (dashed)
            c.setLineDash([8, 8]);
        c.beginPath();
        for (let x = 80; x <= W - 80; x += 4) {
            const t = (x - 80) / (W - 160);
            const y = MID + Math.sin(t * Math.PI * 2 * waves + (dashed ? 0 : this.phase)) * amp;
            if (x === 80)
                c.moveTo(x, y);
            else
                c.lineTo(x, y);
        }
        c.stroke();
        c.setLineDash([]);
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#1c1917";
        c.fillRect(0, 0, W, H);
        // pegs
        c.fillStyle = "#78716c";
        c.fillRect(64, MID - 90, 16, 180);
        c.fillRect(W - 80, MID - 90, 16, 180);
        // target wave (faint, what you're aiming for)
        const tgt = this.target();
        this.waveFor(c, tgt.tension, 60, "rgba(148,163,184,0.7)", true);
        // your live vibrating string
        const amp = 20 + (this.volume / 100) * 70;
        const pct = this.matchPct();
        const col = pct > 0.92 ? "#22c55e" : "#ff9f1c";
        this.waveFor(c, this.tension, amp, col, false);
        // labels
        c.fillStyle = "#fed7aa";
        c.font = "bold 20px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`${tgt.emoji}  Tune to: ${tgt.name}`, W / 2, 56);
        c.fillStyle = "rgba(148,163,184,0.9)";
        c.font = "13px Nunito, sans-serif";
        c.fillText("Faint dashed line = target pitch. Match the number of waves.", W / 2, 80);
        // legend
        c.textAlign = "left";
        c.fillStyle = col;
        c.fillText("— your string", 90, H - 50);
        c.fillStyle = "rgba(148,163,184,0.9)";
        c.fillText("- - target note", 90, H - 28);
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
        this.tension = 50;
        this.volume = 60;
        this.idx = 0;
        this.matched = 0;
        this.mistakes = 0;
        this.order = [...NOTES].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
        this.loop.start();
        this.render();
    }
    destroy() {
        this.loop.stop();
    }
}
export const soundGame = {
    meta: {
        id: "sound",
        conceptId: "phys-17",
        title: "Pitch Perfect",
        stream: "physics",
        gradeBand: "4",
        emoji: "🎸",
        blurb: "Tune a vibrating string to match each note — and learn what makes pitch high or low.",
        mission: "Match three target pitches by tuning the string's vibration speed.",
        estMinutes: 3,
    },
    create: (ctx) => new Sound(ctx),
};
