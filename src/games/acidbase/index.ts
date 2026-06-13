import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Liquid {
  name: string;
  emoji: string;
  acid: boolean; // true = acid, false = base
  why: string;
}

const LIQUIDS: Liquid[] = [
  { name: "Lemon juice", emoji: "🍋", acid: true, why: "Lemon juice is sour — a sign of an acid. Indicator turns red." },
  { name: "Vinegar", emoji: "🧴", acid: true, why: "Vinegar is a weak acid (that sour smell). Indicator turns red." },
  { name: "Orange juice", emoji: "🍊", acid: true, why: "Citrus juices are mild acids. Indicator turns red." },
  { name: "Soap water", emoji: "🧼", acid: false, why: "Soap feels slippery — a sign of a base. Indicator turns blue." },
  { name: "Baking soda", emoji: "🥄", acid: false, why: "Baking soda dissolved in water is a base. Indicator turns blue." },
  { name: "Toothpaste", emoji: "🪥", acid: false, why: "Toothpaste is a base — it neutralises mouth acids. Indicator turns blue." },
];

class AcidBase implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Liquid[] = [];
  private idx = 0;
  private tested = false;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...LIQUIDS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Acids taste sour (like lemon); bases feel slippery (like soap). A special 'indicator' liquid changes color to reveal which is which.",
      "Add the indicator first: it turns RED in an acid and BLUE in a base.",
      "Test each liquid, look at the color, then drop it in the matching bin: red → acid, blue → base.",
    ]);
    this.renderLoop();
  }

  private current(): Liquid {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const testBtn = el(
      "button",
      { class: "btn secondary", onclick: () => this.test() },
      "🧪 Add indicator",
    );
    const acidBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.classify(true) },
      "🔴 Acid",
    );
    const baseBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.classify(false) },
      "🔵 Base",
    );

    this.progressEl = el("span", { style: { color: "var(--accent-pink)" } }, `1 / ${LIQUIDS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = "Add the indicator to reveal the color, then sort it into the right bin.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Sort every liquid"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Step 1 — test it"),
      testBtn,
      el("div", { class: "control-label" }, "Step 2 — sort it"),
      el("div", { class: "chip-row" }, acidBtn, baseBtn),
      el("div", { class: "metric" }, el("span", {}, "🧫 Liquid"), this.progressEl),
      this.coachEl,
    );
  }

  private test(): void {
    if (this.ended) return;
    this.tested = true;
    this.ctx.services.audio.play("click");
    this.coachEl.textContent = this.current().acid
      ? "The indicator turned RED — that means an acid."
      : "The indicator turned BLUE — that means a base.";
  }

  private classify(saysAcid: boolean): void {
    if (this.ended) return;
    const cur = this.current();
    if (saysAcid === cur.acid) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${cur.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Not quite. ${cur.why}`;
    }
    this.idx += 1;
    this.tested = false;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${LIQUIDS.length} / ${LIQUIDS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${LIQUIDS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("acidbase_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Lab complete! Acids (sour, like lemon) turn the indicator red; bases (slippery, like soap) turn it blue. That color change is how we tell them apart.",
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
      c.fillText("All sorted! 🧪", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const cur = this.current();

    // test tube in the center
    const tx = W / 2;
    const top = 150;
    const tubeH = 260;
    const tubeW = 90;

    // glass
    c.fillStyle = "rgba(255,255,255,0.5)";
    this.roundRect(c, tx - tubeW / 2, top, tubeW, tubeH, 30);
    c.fill();

    // liquid (gray until tested, then red/blue)
    const liquidTop = top + 90;
    let col = "rgba(148,163,184,0.7)";
    if (this.tested) col = cur.acid ? "rgba(239,68,68,0.85)" : "rgba(59,130,246,0.85)";
    c.fillStyle = col;
    this.roundRect(c, tx - tubeW / 2 + 4, liquidTop, tubeW - 8, top + tubeH - liquidTop - 4, 26);
    c.fill();

    // bubbles when tested
    if (this.tested) {
      c.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 5; i++) {
        const bx = tx - 20 + ((i * 17) % 40);
        const by = top + tubeH - 20 - ((this.anim * 30 + i * 40) % (tubeH - 110));
        c.beginPath();
        c.arc(bx, by, 4, 0, Math.PI * 2);
        c.fill();
      }
    }

    c.strokeStyle = "#94a3b8";
    c.lineWidth = 5;
    this.roundRect(c, tx - tubeW / 2, top, tubeW, tubeH, 30);
    c.stroke();

    // the liquid's identity
    c.font = "60px serif";
    c.textAlign = "center";
    c.fillText(cur.emoji, tx, top - 24);
    c.fillStyle = "#831843";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(cur.name, tx, top + tubeH + 50);

    // bins
    c.font = "bold 20px Nunito, sans-serif";
    c.fillStyle = "#ef4444";
    c.textAlign = "center";
    c.fillText("🔴 Acid", 150, 120);
    c.fillStyle = "#3b82f6";
    c.fillText("🔵 Base", W - 150, 120);
    c.fillStyle = "#9d174d";
    c.font = "13px Nunito, sans-serif";
    c.fillText("sour", 150, 144);
    c.fillText("slippery", W - 150, 144);

    c.fillStyle = "#831843";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("Acid or base?", W / 2, 70);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    if (h <= 0 || w <= 0) return;
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.tested = false;
    this.mistakes = 0;
    this.flash = 0;
    this.order = [...LIQUIDS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const acidBaseGame: GameModule = {
  meta: {
    id: "acidbase",
    conceptId: "chem-22",
    title: "Litmus Lab",
    stream: "chemistry",
    gradeBand: "4-5",
    emoji: "🧪",
    blurb: "Test mystery liquids with an indicator and sort them into acids and bases.",
    mission: "Use the indicator's color change to correctly sort every liquid.",
    estMinutes: 3,
  },
  create: (ctx) => new AcidBase(ctx),
};
