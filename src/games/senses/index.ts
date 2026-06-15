import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

type Sense = "see" | "hear" | "smell" | "taste" | "touch";

const SENSES: { key: Sense; label: string; organ: string; emoji: string }[] = [
  { key: "see", label: "See", organ: "eyes", emoji: "👁️" },
  { key: "hear", label: "Hear", organ: "ears", emoji: "👂" },
  { key: "smell", label: "Smell", organ: "nose", emoji: "👃" },
  { key: "taste", label: "Taste", organ: "tongue", emoji: "👅" },
  { key: "touch", label: "Touch", organ: "skin", emoji: "✋" },
];

interface Item {
  emoji: string;
  name: string;
  sense: Sense;
}

const ITEMS: Item[] = [
  { emoji: "🌈", name: "a colourful rainbow", sense: "see" },
  { emoji: "🎵", name: "your favourite song", sense: "hear" },
  { emoji: "🌸", name: "a sweet-smelling flower", sense: "smell" },
  { emoji: "🍋", name: "a sour lemon", sense: "taste" },
  { emoji: "🧊", name: "a cold ice cube", sense: "touch" },
  { emoji: "🔔", name: "a ringing bell", sense: "hear" },
  { emoji: "🍞", name: "fresh warm bread", sense: "smell" },
];

class Senses implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Item[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "We learn about the world with five senses, each using a different body part.",
      "Eyes see, ears hear, the nose smells, the tongue tastes, and skin feels touch.",
      "Ask yourself: which body part would you use to notice this thing?",
    ]);
    this.renderLoop();
  }

  private current(): Item {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...SENSES.map((s) =>
        el("button", { class: "chip", onclick: () => this.choose(s.key) }, `${s.emoji} ${s.label}`),
      ),
    );

    this.progressEl = el("span", { style: { color: "var(--accent-pink)" } }, `${this.idx + 1} / ${ITEMS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = "Which sense would you use?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Match every sense"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the sense you'd use"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "✨ Thing"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(sense: Sense): void {
    if (this.ended) return;
    const cur = this.current();
    const s = SENSES.find((x) => x.key === cur.sense)!;
    if (sense === cur.sense) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ Yes! You ${s.label.toLowerCase()} ${cur.name} with your ${s.organ}.`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ You'd ${s.label.toLowerCase()} ${cur.name} with your ${s.organ}.`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${ITEMS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("senses_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Super senses! Your eyes see, ears hear, nose smells, tongue tastes, and skin feels — five senses that tell you all about the world.",
      stars,
      resources: { Species: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03);
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fdf2f8";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#831843";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Super senses! 🌟", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const item = this.current();
    const cx = W / 2;
    const cy = 280 + Math.sin(this.anim) * 8;
    c.fillStyle = "#fff";
    c.strokeStyle = "#f9a8d4";
    c.lineWidth = 6;
    this.roundRect(c, cx - 180, cy - 150, 360, 280, 24);
    c.fill();
    c.stroke();

    c.font = "130px serif";
    c.textAlign = "center";
    c.fillText(item.emoji, cx, cy + 30);
    c.fillStyle = "#831843";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(item.name, cx, cy + 100);

    c.fillStyle = "#831843";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("How would you notice this?", W / 2, 60);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.mistakes = 0;
    this.flash = 0;
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const sensesGame: GameModule = {
  meta: {
    id: "senses",
    conceptId: "bio-09",
    title: "Sense It",
    stream: "biology",
    gradeBand: "K-1",
    emoji: "👀",
    blurb: "Match each thing to the sense you'd use to notice it.",
    mission: "Use the right sense — sight, hearing, smell, taste, or touch — for each thing.",
    estMinutes: 2,
  },
  create: (ctx) => new Senses(ctx),
};
