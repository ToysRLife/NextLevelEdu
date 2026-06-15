import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Item {
  key: string;
  label: string;
  emoji: string;
  reversible: boolean;
  why: string;
}

// Eight everyday changes. Reversible = the same stuff comes back if you undo
// the heat/cold. Irreversible = a brand-new substance forms, so you can't go back.
const ITEMS: Item[] = [
  { key: "ice", label: "Ice melting", emoji: "🧊", reversible: true, why: "Melted ice is still water — freeze it and you get ice back." },
  { key: "freeze", label: "Water freezing", emoji: "❄️", reversible: true, why: "Frozen water is still water — warm it and it melts back." },
  { key: "choc", label: "Melting chocolate", emoji: "🍫", reversible: true, why: "Melted chocolate is still chocolate — cool it and it sets again." },
  { key: "boil", label: "Boiling water", emoji: "💨", reversible: true, why: "Steam is still water — cool it and it turns back to liquid." },
  { key: "egg", label: "Frying an egg", emoji: "🍳", reversible: false, why: "Cooking changes the egg into a new substance — you can't un-cook it." },
  { key: "paper", label: "Burning paper", emoji: "🔥", reversible: false, why: "Burning makes ash and smoke — brand-new stuff that won't become paper." },
  { key: "cake", label: "Baking a cake", emoji: "🎂", reversible: false, why: "Baking mixes ingredients into a new food — you can't get the batter back." },
  { key: "rust", label: "A rusting nail", emoji: "🔩", reversible: false, why: "Rust is a new material made from iron and air — the shiny nail is gone." },
];

class Irreversible implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private mistakes = 0;
  private index = 0;
  private order: Item[] = [];
  private flash = 0; // >0 correct (green), <0 wrong (red)

  private coachEl!: HTMLElement;
  private progressEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Ask: after the change, is it still the same stuff, just in a different form?",
      "If heating or cooling can turn it right back, it's reversible. If a brand-new substance forms, it's irreversible.",
      "Melting and boiling are reversible (still water). Burning, cooking, baking, and rusting make new stuff — irreversible.",
    ]);
    this.renderLoop();
  }

  private current(): Item {
    return this.order[this.index];
  }

  private buildPanel(): void {
    this.progressEl = el("span", { style: { color: "var(--accent-pink)" } }, `1 / ${ITEMS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = "Can this change be undone? Sort each one into the right bin.";

    const choiceRow = el(
      "div",
      { class: "chip-row" },
      el(
        "button",
        { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.choose(true) },
        "♻️ Reversible",
      ),
      el(
        "button",
        { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.choose(false) },
        "🔥 Irreversible",
      ),
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Sort all 8 changes"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Is this change reversible?"),
      choiceRow,
      el("div", { class: "metric" }, el("span", {}, "🧩 Item"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(saysReversible: boolean): void {
    if (this.ended) return;
    const item = this.current();
    const correct = saysReversible === item.reversible;
    if (correct) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${item.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Not quite. ${item.why}`;
    }
    this.index += 1;
    if (this.index >= this.order.length) {
      this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.index + 1} / ${ITEMS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("irreversible_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Sorted! Reversible changes keep the same substance (melting, boiling). Irreversible changes make brand-new stuff (burning, cooking, rusting).",
      stars,
      resources: { Energy: 40 },
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
      c.fillText("All sorted! 🎉", W / 2, H / 2);
      return;
    }

    const item = this.current();

    // flash background tint for feedback
    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    // card with the current change
    const cardW = 360;
    const cardH = 280;
    const cx = W / 2;
    const cy = 250 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#f9a8d4";
    c.lineWidth = 6;
    this.roundRect(c, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
    c.fill();
    c.stroke();

    c.font = "100px serif";
    c.textAlign = "center";
    c.fillText(item.emoji, cx, cy + 10);
    c.fillStyle = "#831843";
    c.font = "bold 26px Nunito, sans-serif";
    c.fillText(item.label, cx, cy + 100);

    // two bin labels at the bottom
    c.font = "bold 22px Nunito, sans-serif";
    c.fillStyle = "#2f8bff";
    c.textAlign = "center";
    c.fillText("♻️ Reversible", W / 2 - 170, 470);
    c.fillStyle = "#ff5a5f";
    c.fillText("🔥 Irreversible", W / 2 + 170, 470);
    c.fillStyle = "#9d174d";
    c.font = "16px Nunito, sans-serif";
    c.fillText("can turn right back", W / 2 - 170, 498);
    c.fillText("makes new stuff", W / 2 + 170, 498);

    c.fillStyle = "#831843";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("Reversible, or not?", W / 2, 80);
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
    this.mistakes = 0;
    this.index = 0;
    this.flash = 0;
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const irreversibleGame: GameModule = {
  meta: {
    id: "irreversible",
    conceptId: "chem-09",
    title: "Can't Undo It",
    stream: "chemistry",
    gradeBand: "4-5",
    emoji: "🔥",
    blurb: "Sort everyday changes into reversible and irreversible — and learn why.",
    mission: "Decide whether each change can be undone, sorting all eight correctly.",
    estMinutes: 3,
  },
  create: (ctx) => new Irreversible(ctx),
};
