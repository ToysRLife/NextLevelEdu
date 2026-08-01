import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const NEEDS = [
    { key: "food", label: "Food", emoji: "🍎" },
    { key: "water", label: "Water", emoji: "💧" },
    { key: "air", label: "Air", emoji: "🌬️" },
    { key: "shelter", label: "Shelter", emoji: "🏠" },
];
const WANTS = [
    { key: "toy", label: "Toy", emoji: "🧸" },
    { key: "candy", label: "Candy", emoji: "🍬" },
];
class BasicNeeds {
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
        Object.defineProperty(this, "given", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "mistakes", {
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
            "Every living thing has basic needs it must have to stay alive.",
            "The four basic needs are food, water, air, and shelter (a safe place).",
            "Toys and treats are nice 'wants' — but they're not needs. Give the four real needs.",
        ]);
        this.renderLoop();
    }
    count() {
        return NEEDS.filter((n) => this.given[n.key]).length;
    }
    buildPanel() {
        const needBtns = NEEDS.map((n) => el("button", {
            class: "chip",
            style: this.given[n.key]
                ? {
                    background: "var(--accent-green)",
                    color: "#fff",
                    borderColor: "var(--accent-green)",
                }
                : {},
            onclick: () => this.give(n.key, true, n.label),
        }, `${n.emoji} ${n.label}`));
        const wantBtns = WANTS.map((w) => el("button", { class: "chip", onclick: () => this.give(w.key, false, w.label) }, `${w.emoji} ${w.label}`));
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / 4`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
        });
        this.coachEl.textContent = "Give the creature everything it needs to live.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Meet all 4 needs")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Give it what it needs"), el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, ...needBtns, ...wantBtns), el("div", { class: "metric" }, el("span", {}, "❤️ Needs met"), this.statusEl), this.coachEl);
    }
    give(key, isNeed, label) {
        if (this.ended)
            return;
        if (!isNeed) {
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `🧸 A ${label.toLowerCase()} is a 'want', not a need. Living things need food, water, air, and shelter.`;
            return;
        }
        if (this.given[key])
            return;
        this.given[key] = true;
        this.ctx.services.audio.play("tick");
        this.statusEl.textContent = `${this.count()} / 4`;
        this.coachEl.textContent = `✅ ${label} given!`;
        this.buildPanel();
        if (this.count() >= 4)
            this.win();
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
        this.ctx.services.score.event("basicneeds_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Happy and healthy! Every living thing needs food, water, air, and shelter to survive. Toys and treats are just nice extras.",
            stars,
            resources: { Water: 40 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.05;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#f0fdf4";
        c.fillRect(0, 0, W, H);
        const happy = this.count() / 4;
        // creature
        const cx = W / 2, cy = 300, bob = Math.sin(this.anim) * (4 + happy * 6);
        c.fillStyle = "#fbbf24";
        c.beginPath();
        c.arc(cx, cy + bob, 80, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(cx - 26, cy - 12 + bob, 16, 0, Math.PI * 2);
        c.arc(cx + 26, cy - 12 + bob, 16, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#1e293b";
        c.beginPath();
        c.arc(cx - 26, cy - 12 + bob, 7, 0, Math.PI * 2);
        c.arc(cx + 26, cy - 12 + bob, 7, 0, Math.PI * 2);
        c.fill();
        // mouth — happier with more needs
        c.strokeStyle = "#1e293b";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy + 18 + bob, 26, 0.1 * Math.PI + (1 - happy) * 0.8, 0.9 * Math.PI - (1 - happy) * 0.8);
        c.stroke();
        // need badges around
        NEEDS.forEach((n, i) => {
            const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
            const x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 130;
            c.fillStyle = this.given[n.key] ? "#22c55e" : "rgba(148,163,184,0.4)";
            c.beginPath();
            c.arc(x, y, 30, 0, Math.PI * 2);
            c.fill();
            c.font = "26px serif";
            c.textAlign = "center";
            c.fillText(n.emoji, x, y + 9);
            if (this.given[n.key]) {
                c.fillStyle = "#15803d";
                c.font = "16px serif";
                c.fillText("✓", x + 22, y - 18);
            }
        });
        c.fillStyle = "#166534";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(this.ended ? "Healthy and happy! ❤️" : "Give the creature its basic needs ❤️", W / 2, 50);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.given = {};
        this.mistakes = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const basicNeedsGame = {
    meta: {
        id: "basicneeds",
        conceptId: "bio-02",
        title: "Stay Alive",
        stream: "biology",
        gradeBand: "K-1",
        emoji: "❤️",
        blurb: "Give a living thing the food, water, air, and shelter it needs.",
        mission: "Meet all four of the creature's basic needs.",
        estMinutes: 2,
    },
    create: (ctx) => new BasicNeeds(ctx),
};
