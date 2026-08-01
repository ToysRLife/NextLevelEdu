import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const ANIMALS = [
    {
        name: "Goose",
        emoji: "🦢",
        strategy: "migrate",
        why: "Geese fly to warmer places for winter — they migrate.",
    },
    {
        name: "Bear",
        emoji: "🐻",
        strategy: "hibernate",
        why: "Bears sleep deeply through winter — they hibernate.",
    },
    {
        name: "Monarch butterfly",
        emoji: "🦋",
        strategy: "migrate",
        why: "Monarchs travel thousands of miles south — they migrate.",
    },
    {
        name: "Frog",
        emoji: "🐸",
        strategy: "hibernate",
        why: "Frogs bury into the mud and sleep — they hibernate.",
    },
    {
        name: "Deer",
        emoji: "🦌",
        strategy: "active",
        why: "Deer grow a thick coat and stay active all winter.",
    },
    {
        name: "Bat",
        emoji: "🦇",
        strategy: "hibernate",
        why: "Bats hibernate in caves through the cold months.",
    },
    {
        name: "Squirrel",
        emoji: "🐿️",
        strategy: "active",
        why: "Squirrels store nuts and stay active in winter.",
    },
    {
        name: "Swallow",
        emoji: "🐦",
        strategy: "migrate",
        why: "Swallows fly south to find food and warmth — they migrate.",
    },
];
class Migration {
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
        this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Winter is hard — food gets scarce and it's cold. Animals survive in different ways.",
            "Some migrate (travel somewhere warmer), some hibernate (sleep deeply), and some stay active with warm coats and stored food.",
            "Birds and butterflies usually migrate; bears, frogs, and bats hibernate; deer and squirrels stay active.",
        ]);
        this.renderLoop();
    }
    current() {
        return this.order[this.idx];
    }
    buildPanel() {
        const choices = el("div", { class: "chip-row", style: { flexWrap: "wrap" } }, el("button", {
            class: "btn",
            style: { background: "var(--accent-blue)" },
            onclick: () => this.choose("migrate"),
        }, "✈️ Migrate"), el("button", {
            class: "btn",
            style: { background: "var(--accent-purple)" },
            onclick: () => this.choose("hibernate"),
        }, "😴 Hibernate"), el("button", {
            class: "btn",
            style: { background: "var(--accent-green)" },
            onclick: () => this.choose("active"),
        }, "🧥 Stay active"));
        this.progressEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.idx + 1} / ${ANIMALS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
        });
        this.coachEl.textContent = "How does this animal get through winter?";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Goal"), el("span", {}, "Help all 8 survive")), el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick a winter strategy"), choices, el("div", { class: "metric" }, el("span", {}, "❄️ Animal"), this.progressEl), this.coachEl);
    }
    choose(s) {
        if (this.ended)
            return;
        const a = this.current();
        if (s === a.strategy) {
            this.flash = 1;
            this.ctx.services.audio.play("tick");
            this.coachEl.textContent = `✅ ${a.why}`;
        }
        else {
            this.flash = -1;
            this.mistakes += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = `❌ ${a.why}`;
        }
        this.idx += 1;
        if (this.idx >= this.order.length) {
            this.progressEl.textContent = `${ANIMALS.length} / ${ANIMALS.length}`;
            this.win();
        }
        else {
            this.progressEl.textContent = `${this.idx + 1} / ${ANIMALS.length}`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        this.ctx.services.score.event("migration_done", { mistakes: this.mistakes });
        this.ctx.services.outcome.succeed({
            message: "Everyone made it! To survive winter, animals migrate to warmer places, hibernate through the cold, or stay active with warm coats and stored food.",
            stars,
            resources: { Water: 40 },
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
        c.fillStyle = "#e0f2fe";
        c.fillRect(0, 0, W, H);
        // falling snow
        c.fillStyle = "rgba(255,255,255,0.8)";
        for (let i = 0; i < 40; i++) {
            const x = (i * 97 + this.anim * 10) % W;
            const y = (i * 53 + this.anim * 30) % H;
            c.beginPath();
            c.arc(x, y, 2.5, 0, Math.PI * 2);
            c.fill();
        }
        if (this.ended) {
            c.fillStyle = "#1e3a8a";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("All ready for winter! ❄️", W / 2, H / 2);
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
        const a = this.current();
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
        c.fillText(a.emoji, cx, cy + 20);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 26px Nunito, sans-serif";
        c.fillText(a.name, cx, cy + 100);
        c.fillStyle = "#1e3a8a";
        c.font = "bold 18px Nunito, sans-serif";
        c.fillText("Winter is coming — how will it survive? ❄️", W / 2, 50);
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
        this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const migrationGame = {
    meta: {
        id: "migration",
        conceptId: "bio-20",
        title: "Winter Is Coming",
        stream: "biology",
        gradeBand: "3-4",
        emoji: "❄️",
        blurb: "Help each animal survive winter by migrating, hibernating, or staying active.",
        mission: "Choose the right winter survival strategy for every animal.",
        estMinutes: 2,
    },
    create: (ctx) => new Migration(ctx),
};
