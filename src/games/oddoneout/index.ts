import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Round {
  property: string;
  items: { emoji: string; odd: boolean }[];
  why: string;
}

const ROUNDS: Round[] = [
  {
    property: "colour",
    items: [{ emoji: "🍎", odd: false }, { emoji: "🍓", odd: false }, { emoji: "🌶️", odd: false }, { emoji: "🫐", odd: true }],
    why: "The blueberry is blue — the others are all red.",
  },
  {
    property: "shape",
    items: [{ emoji: "⚽", odd: false }, { emoji: "🍊", odd: false }, { emoji: "🔴", odd: false }, { emoji: "📦", odd: true }],
    why: "The box is square — the others are all round.",
  },
  {
    property: "see-through",
    items: [{ emoji: "🪟", odd: false }, { emoji: "🥛", odd: false }, { emoji: "🧊", odd: false }, { emoji: "🧱", odd: true }],
    why: "The brick is solid — you can see through the others.",
  },
  {
    property: "lives in water",
    items: [{ emoji: "🐟", odd: false }, { emoji: "🐙", odd: false }, { emoji: "🐬", odd: false }, { emoji: "🐰", odd: true }],
    why: "The rabbit lives on land — the others live in water.",
  },
  {
    property: "soft",
    items: [{ emoji: "🧸", odd: false }, { emoji: "🧶", odd: false }, { emoji: "☁️", odd: false }, { emoji: "🪨", odd: true }],
    why: "The rock is hard — the others are soft.",
  },
];

class OddOneOut implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Round[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private positions: { x: number; y: number }[] = [];

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = ROUNDS.map((r) => ({ ...r, items: [...r.items].sort(() => Math.random() - 0.5) })).sort(() => Math.random() - 0.5);
    this.layout();
    this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
    this.buildPanel();
    ctx.services.hints.setHints([
      "We describe objects by their properties — colour, shape, what they're made of, how they feel.",
      "Look at what three of them share, then spot the one that's different.",
      "Read the clue at the top — it tells you which property to compare.",
    ]);
    this.renderLoop();
  }

  private layout(): void {
    this.positions = [
      { x: 250, y: 250 },
      { x: 550, y: 250 },
      { x: 250, y: 430 },
      { x: 550, y: 430 },
    ];
  }

  private current(): Round {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    this.progressEl = el("span", { style: { color: "var(--accent-pink)" } }, `${this.idx + 1} / ${ROUNDS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = `Tap the one that doesn't match by ${this.current().property}.`;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Compare by"),
        el("span", {}, this.current().property),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap the odd one out on the board"),
      el("div", { class: "metric" }, el("span", {}, "🧩 Puzzle"), this.progressEl),
      this.coachEl,
    );
  }

  private tap(p: Point): void {
    if (this.ended) return;
    const items = this.current().items;
    for (let i = 0; i < items.length; i++) {
      const pos = this.positions[i];
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < 64) {
        if (items[i].odd) {
          this.flash = 1;
          this.ctx.services.audio.play("tick");
          this.coachEl.textContent = `✅ ${this.current().why}`;
          this.next();
        } else {
          this.flash = -1;
          this.mistakes += 1;
          this.ctx.services.audio.play("fail");
          this.coachEl.textContent = `❌ That one fits. Compare by ${this.current().property}.`;
        }
        return;
      }
    }
  }

  private next(): void {
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${ROUNDS.length} / ${ROUNDS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${ROUNDS.length}`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("oddoneout_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Sharp eyes! Objects have properties — colour, shape, material, texture — and we can group and compare things by them.",
      stars,
      resources: { Compounds: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.04);
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
      c.fillText("Odd ones all found! 🧩", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    }

    const items = this.current().items;
    for (let i = 0; i < items.length; i++) {
      const pos = this.positions[i];
      c.fillStyle = "#fff";
      c.strokeStyle = "#f9a8d4";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(pos.x, pos.y, 60, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.font = "56px serif";
      c.textAlign = "center";
      c.fillText(items[i].emoji, pos.x, pos.y + 20);
    }

    c.fillStyle = "#831843";
    c.font = "bold 22px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Which one is the odd one out? (by ${this.current().property})`, W / 2, 80);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.mistakes = 0;
    this.flash = 0;
    this.order = ROUNDS.map((r) => ({ ...r, items: [...r.items].sort(() => Math.random() - 0.5) })).sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const oddOneOutGame: GameModule = {
  meta: {
    id: "oddoneout",
    conceptId: "chem-01",
    title: "Odd One Out",
    stream: "chemistry",
    gradeBand: "K-2",
    emoji: "🧩",
    blurb: "Spot the object that doesn't share the same property as the others.",
    mission: "Find the odd one out in every group by its property.",
    estMinutes: 2,
  },
  create: (ctx) => new OddOneOut(ctx),
};
