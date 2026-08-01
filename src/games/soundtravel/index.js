import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const BELL_X = 130;
const EAR_X = 670;
const MEDIA = [
    { key: "vacuum", label: "Empty space", emoji: "🚀", color: "#0b1026", speed: 0 },
    { key: "air", label: "Air", emoji: "💨", color: "#bae6fd", speed: 3 },
    { key: "water", label: "Water", emoji: "💧", color: "#38bdf8", speed: 6 },
    { key: "metal", label: "Metal", emoji: "🔩", color: "#94a3b8", speed: 11 },
];
const ROUNDS = [
    { goal: "carry", label: "Get the bell's sound to the ear" },
    { goal: "fastest", label: "Make the sound arrive the FASTEST" },
    { goal: "none", label: "Find where sound CANNOT travel" },
];
class SoundTravel {
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
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "medium", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: MEDIA[1]
        });
        Object.defineProperty(this, "testing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "pulse", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // 0..1 progress across the medium
        Object.defineProperty(this, "mistakes", {
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
        this.buildPanel();
        ctx.services.hints.setHints([
            "Sound is a vibration that travels through stuff — it needs a material (a medium) to move through.",
            "Sound travels fastest through solids, slower through liquids, and slowest through gases like air.",
            "In the empty vacuum of space there's no material, so sound can't travel at all — space is silent.",
        ]);
        this.renderLoop();
    }
    round() {
        return ROUNDS[this.idx];
    }
    buildPanel() {
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...MEDIA.map((m) => el("button", { class: "chip", onclick: () => this.test(m) }, `${m.emoji} ${m.label}`)));
        this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
        });
        this.coachEl.textContent = "Choose what's between the bell and the ear, then listen.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Task"), el("span", {}, this.round().label)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Fill the space with…"), chips, el("div", { class: "metric" }, el("span", {}, "🔔 Tasks"), this.statusEl), this.coachEl);
    }
    test(m) {
        if (this.ended || this.testing)
            return;
        this.medium = m;
        if (m.speed === 0) {
            // no medium — silence
            this.ctx.services.audio.play("fail");
            this.evaluate(false, m);
            return;
        }
        this.testing = true;
        this.pulse = 0;
        this.ctx.services.audio.play("click");
    }
    evaluate(arrived, m) {
        const g = this.round().goal;
        let correct = false;
        if (g === "carry")
            correct = arrived;
        else if (g === "fastest")
            correct = m.key === "metal";
        else if (g === "none")
            correct = m.key === "vacuum";
        if (correct) {
            this.matched += 1;
            this.ctx.services.audio.play("tick");
            this.statusEl.textContent = `${this.matched} / ${ROUNDS.length}`;
            this.coachEl.textContent =
                g === "none"
                    ? "✅ Right — no material, no sound. Space is silent!"
                    : g === "fastest"
                        ? "✅ Metal is a solid, so the vibration zips through fastest."
                        : "✅ The sound vibrated through the material to the ear.";
            this.idx += 1;
            if (this.matched >= ROUNDS.length)
                this.win();
            else
                this.buildPanel();
        }
        else {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent =
                g === "none"
                    ? "❌ Sound DID travel through that. It can't travel only where there's no material — empty space."
                    : g === "fastest"
                        ? "❌ It got through, but not the fastest. Sound is quickest through a solid."
                        : m.key === "vacuum"
                            ? "❌ No material in space, so the sound had nothing to travel through."
                            : "❌ Try again.";
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("soundtravel_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Good vibrations! Sound needs a material to travel through — fastest in solids, slower in liquids and air, and not at all in the vacuum of space.",
            stars,
            resources: { Fuel: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.testing) {
                this.pulse += 0.004 * this.medium.speed;
                if (this.pulse >= 1) {
                    this.testing = false;
                    this.ctx.services.audio.play("reward");
                    this.evaluate(true, this.medium);
                }
            }
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#1e293b";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#fed7aa";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("You hear it now! 🔔", W / 2, H / 2);
            return;
        }
        // medium-filled tube between bell and ear
        c.fillStyle = this.medium.color;
        c.fillRect(BELL_X, 250, EAR_X - BELL_X, 120);
        c.strokeStyle = "#475569";
        c.lineWidth = 3;
        c.strokeRect(BELL_X, 250, EAR_X - BELL_X, 120);
        c.fillStyle = this.medium.key === "vacuum" ? "#cbd5e1" : "#1e293b";
        c.font = "bold 16px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`${this.medium.emoji} ${this.medium.label}`, (BELL_X + EAR_X) / 2, 240);
        // sound pulse (rings) when traveling
        if (this.testing && this.medium.speed > 0) {
            const x = BELL_X + (EAR_X - BELL_X) * this.pulse;
            c.strokeStyle = "rgba(255,210,63,0.9)";
            c.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                c.beginPath();
                c.arc(x, 310, 8 + i * 10, -Math.PI / 3, Math.PI / 3);
                c.stroke();
            }
        }
        else if (this.medium.key === "vacuum") {
            c.fillStyle = "rgba(255,255,255,0.4)";
            c.font = "18px Nunito, sans-serif";
            c.fillText("🤫 silence", (BELL_X + EAR_X) / 2, 320);
        }
        // bell + ear
        c.font = "50px serif";
        c.fillText("🔔", BELL_X, 325);
        c.fillText("👂", EAR_X, 325);
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText(this.round().label, W / 2, 60);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.idx = 0;
        this.medium = MEDIA[1];
        this.testing = false;
        this.pulse = 0;
        this.mistakes = 0;
        this.matched = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const soundTravelGame = {
    meta: {
        id: "soundtravel",
        conceptId: "phys-18",
        title: "Good Vibrations",
        stream: "physics",
        gradeBand: "4",
        emoji: "🔔",
        blurb: "Find what carries sound best — and discover why space is silent.",
        mission: "Pick the right material to carry sound, and learn where it can't travel.",
        estMinutes: 3,
    },
    create: (ctx) => new SoundTravel(ctx),
};
