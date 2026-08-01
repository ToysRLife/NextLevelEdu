import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const GEAR = [
    { key: "umbrella", label: "Umbrella", emoji: "☂️" },
    { key: "sunglasses", label: "Sunglasses", emoji: "🕶️" },
    { key: "coat", label: "Warm coat", emoji: "🧥" },
    { key: "scarf", label: "Scarf", emoji: "🧣" },
    { key: "sandals", label: "Sandals", emoji: "🩴" },
];
const WEATHERS = [
    { name: "Rainy", emoji: "🌧️", gear: "umbrella", why: "An umbrella keeps the rain off you." },
    {
        name: "Sunny & bright",
        emoji: "☀️",
        gear: "sunglasses",
        why: "Sunglasses protect your eyes from the bright Sun.",
    },
    {
        name: "Snowy & cold",
        emoji: "❄️",
        gear: "coat",
        why: "A warm coat keeps you cosy in the snow.",
    },
    { name: "Windy", emoji: "💨", gear: "scarf", why: "A scarf keeps the cold wind off your neck." },
    {
        name: "Hot summer day",
        emoji: "🥵",
        gear: "sandals",
        why: "Sandals keep your feet cool on a hot day.",
    },
];
class WeatherWear {
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
        Object.defineProperty(this, "mistakes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "flash", {
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
        this.order = [...WEATHERS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Weather is what the sky and air are like — sunny, rainy, windy, snowy, or hot.",
            "We choose clothes and gear to suit the weather and stay comfy and safe.",
            "Rain → umbrella, bright sun → sunglasses, snow → warm coat, wind → scarf, heat → sandals.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...GEAR.map((g) => el("button", { class: "chip", onclick: () => this.choose(g.key) }, `${g.emoji} ${g.label}`)));
        this.progressEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.idx + 1} / ${WEATHERS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        this.coachEl.textContent = "What should you take out in this weather?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🌦️ Weather"), el("span", {}, this.current().name)), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the right gear"), chips, el("div", { class: "metric" }, el("span", {}, "🌈 Day"), this.progressEl), this.coachEl);
    }
    choose(key) {
        if (this.ended)
            return;
        const wth = this.current();
        if (key === wth.gear) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${wth.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${wth.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${WEATHERS.length} / ${WEATHERS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${WEATHERS.length}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
        this.ctx.services.score.event("weatherwear_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Ready for anything! We dress for the weather — umbrellas for rain, coats for snow, sunglasses for bright sun — to stay safe and comfy.",
            stars,
            resources: { Climate: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            if (this.flash > 0)
                this.flash = Math.max(0, this.flash - 0.03);
            if (this.flash < 0)
                this.flash = Math.min(0, this.flash + 0.03);
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#dbeafe";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#1e3a8a";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Dressed for every day! 🌈", W / 2, H / 2);
            return;
        }
        if (this.flash > 0) {
            c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
            c.fillRect(0, 0, W, H);
        }
        else if (this.flash < 0) {
            c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
            c.fillRect(0, 0, W, H);
        }
        const wth = this.current();
        const cx = W / 2;
        const cy = 280 + Math.sin(this.anim) * 6;
        c.fillStyle = "#fff";
        c.strokeStyle = "#93c5fd";
        c.lineWidth = 6;
        this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
        c.fill();
        c.stroke();
        c.font = "120px serif";
        c.textAlign = "center";
        c.fillText(wth.emoji, cx, cy + 20);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 26px Nunito, sans-serif";
        c.fillText(wth.name, cx, cy + 100);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 20px Nunito, sans-serif";
        c.fillText("Dress for the weather! 🌦️", W / 2, 60);
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
        this.idx = 0;
        this.mistakes = 0;
        this.flash = 0;
        this.order = [...WEATHERS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const weatherWearGame = {
    meta: {
        id: "weatherwear",
        conceptId: "ess-01",
        title: "Dress for Weather",
        stream: "earth-space",
        gradeBand: "K-1",
        emoji: "🌦️",
        blurb: "Pick the right gear for sunny, rainy, snowy, windy, and hot weather.",
        mission: "Choose the right thing to bring for each kind of weather.",
        estMinutes: 2,
    },
    create: (ctx) => new WeatherWear(ctx),
};
