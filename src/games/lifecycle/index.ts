import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Stage {
  emoji: string;
  label: string;
}

interface Cycle {
  name: string;
  stages: Stage[]; // in correct order
}

const CYCLES: Cycle[] = [
  {
    name: "Butterfly",
    stages: [
      { emoji: "🥚", label: "Egg" },
      { emoji: "🐛", label: "Caterpillar" },
      { emoji: "🛡️", label: "Chrysalis" },
      { emoji: "🦋", label: "Butterfly" },
    ],
  },
  {
    name: "Frog",
    stages: [
      { emoji: "🥚", label: "Egg" },
      { emoji: "🐟", label: "Tadpole" },
      { emoji: "🐸", label: "Froglet" },
      { emoji: "🐸", label: "Adult Frog" },
    ],
  },
];

interface Card {
  stage: Stage;
  order: number; // correct slot index
  placed: boolean;
  x: number;
  y: number;
  flash: number;
}

const CARD = 130;
const SLOT_Y = 160;
const TRAY_Y = 400;

class LifeCycle implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: (() => void) | null = null;
  private raf = 0;
  private ended = false;

  private cycle: Cycle;
  private cards: Card[] = [];
  private nextSlot = 0;
  private mistakes = 0;

  private coachEl!: HTMLElement;
  private progressEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.cycle = CYCLES[Math.floor(Math.random() * CYCLES.length)];
    this.setupCards();
    this.buildPanel();
    ctx.services.hints.setHints([
      "A life cycle is the order of stages a living thing goes through as it grows up.",
      "Start with the very beginning of life, then follow how the creature changes step by step.",
      `For the ${this.cycle.name}: it begins as an ${this.cycle.stages[0].label}, then a ${this.cycle.stages[1].label}, then a ${this.cycle.stages[2].label}, and finally a ${this.cycle.stages[3].label}.`,
    ]);
    this.attach();
    this.renderLoop();
  }

  private setupCards(): void {
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const gap = (W - 4 * CARD) / 5;
    this.cards = order.map((stageIdx, pos) => ({
      stage: this.cycle.stages[stageIdx],
      order: stageIdx,
      placed: false,
      x: gap + pos * (CARD + gap),
      y: TRAY_Y,
      flash: 0,
    }));
    this.nextSlot = 0;
  }

  private buildPanel(): void {
    this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, "0 / 4");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = `Tap the ${this.cycle.name} stages in the right order, from the start of life to the adult.`;
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🔬 Cycle"),
        el("span", {}, this.cycle.name),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap stages in order"),
      el("div", { class: "metric" }, el("span", {}, "✅ Placed"), this.progressEl),
      this.coachEl,
    );
  }

  private attach(): void {
    this.detach = onPointer(this.ctx.canvas, W, H, {
      down: (p) => {
        if (this.ended) return;
        for (const card of this.cards) {
          if (card.placed) continue;
          if (p.x >= card.x && p.x <= card.x + CARD && p.y >= card.y && p.y <= card.y + CARD) {
            this.tap(card);
            return;
          }
        }
      },
    });
  }

  private tap(card: Card): void {
    if (card.order === this.nextSlot) {
      card.placed = true;
      this.nextSlot += 1;
      this.ctx.services.audio.play("tick");
      this.progressEl.textContent = `${this.nextSlot} / 4`;
      if (this.nextSlot === 4) this.win();
    } else {
      card.flash = 1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = "❌ Not the next stage — think about what comes first as the animal grows.";
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("lifecycle_complete", { cycle: this.cycle.name, mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message: `You ordered the ${this.cycle.name} life cycle perfectly! Every creature grows through stages in a set order.`,
      stars,
      resources: { Biomass: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      for (const card of this.cards) if (card.flash > 0) card.flash -= 0.04;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private slotX(i: number): number {
    const gap = (W - 4 * CARD) / 5;
    return gap + i * (CARD + gap);
  }

  private drawCard(c: CanvasRenderingContext2D, x: number, y: number, stage: Stage, bg: string, border: string): void {
    c.fillStyle = bg;
    c.strokeStyle = border;
    c.lineWidth = 4;
    this.roundRect(c, x, y, CARD, CARD, 18);
    c.fill();
    c.stroke();
    c.font = "56px serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(stage.emoji, x + CARD / 2, y + CARD / 2 - 8);
    c.fillStyle = "#1e293b";
    c.font = "bold 16px Nunito, sans-serif";
    c.fillText(stage.label, x + CARD / 2, y + CARD - 18);
    c.textBaseline = "alphabetic";
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

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#ecfdf5";
    c.fillRect(0, 0, W, H);

    c.fillStyle = "#065f46";
    c.font = "bold 22px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Life Cycle Order", W / 2, 60);

    // slots
    for (let i = 0; i < 4; i++) {
      const x = this.slotX(i);
      const filled = this.cards.find((cd) => cd.placed && cd.order === i);
      if (filled) {
        this.drawCard(c, x, SLOT_Y, filled.stage, "#fff", "#22c55e");
      } else {
        c.strokeStyle = i === this.nextSlot ? "#22c55e" : "#a7f3d0";
        c.lineWidth = i === this.nextSlot ? 4 : 3;
        c.setLineDash([8, 6]);
        this.roundRect(c, x, SLOT_Y, CARD, CARD, 18);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#6ee7b7";
        c.font = "bold 40px Nunito, sans-serif";
        c.fillText(String(i + 1), x + CARD / 2, SLOT_Y + CARD / 2 + 14);
      }
      // arrow between slots
      if (i < 3) {
        c.fillStyle = "#34d399";
        c.font = "bold 30px Nunito, sans-serif";
        c.fillText("→", x + CARD + (this.slotX(i + 1) - x - CARD) / 2, SLOT_Y + CARD / 2 + 8);
      }
    }

    // tray (unplaced cards)
    for (const card of this.cards) {
      if (card.placed) continue;
      const border = card.flash > 0 ? "#ef4444" : "#10b981";
      this.drawCard(c, card.x, card.y, card.stage, "#fff", border);
    }
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.mistakes = 0;
    this.cycle = CYCLES[Math.floor(Math.random() * CYCLES.length)];
    this.setupCards();
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach?.();
  }
}

export const lifecycleGame: GameModule = {
  meta: {
    id: "lifecycle",
    conceptId: "bio-10",
    title: "Grow Up!",
    stream: "biology",
    gradeBand: "2-3",
    emoji: "🦋",
    blurb: "Put the stages of an animal's life in the right order, from egg to adult.",
    mission: "Tap the life-cycle stages in the correct order, from the start of life all the way to the grown-up.",
    estMinutes: 2,
  },
  create: (ctx) => new LifeCycle(ctx),
};
