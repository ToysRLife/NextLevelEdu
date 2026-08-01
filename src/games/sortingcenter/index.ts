import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const START = { x: W / 2, y: 520 };

interface Item {
  name: string;
  emoji: string;
  metal: boolean;
}

const ITEMS: Item[] = [
  { name: "Key", emoji: "🔑", metal: true },
  { name: "Spoon", emoji: "🥄", metal: true },
  { name: "Can", emoji: "🥫", metal: true },
  { name: "Coin", emoji: "🪙", metal: true },
  { name: "Book", emoji: "📕", metal: false },
  { name: "Apple", emoji: "🍎", metal: false },
  { name: "Ball", emoji: "⚽", metal: false },
  { name: "Sock", emoji: "🧦", metal: false },
];

const BIN_METAL = { x: 60, y: 110, w: 300, h: 150 };
const BIN_NOT = { x: 440, y: 110, w: 300, h: 150 };

class SortingCenter implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Item[] = [];
  private idx = 0;
  private mistakes = 0;
  private tok = { x: START.x, y: START.y };
  private dragging = false;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        if (Math.hypot(p.x - this.tok.x, p.y - this.tok.y) < 46) this.dragging = true;
      },
      move: (p) => {
        if (this.dragging) {
          this.tok.x = p.x;
          this.tok.y = p.y;
        }
      },
      up: (p) => {
        if (this.dragging) {
          this.dragging = false;
          this.drop(p);
        }
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "We can group objects by a shared property — here, what they're made of.",
      "Metal objects are often shiny, hard, and cold to the touch.",
      "Drag each thing into the metal bin or the not-metal bin.",
    ]);
    this.renderLoop();
  }

  private current(): Item {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${ITEMS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Drag the object into the right bin: metal or not.";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Sort by"),
        el("span", {}, "Made of metal?")
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "Drag into the matching bin"
      ),
      el("div", { class: "metric" }, el("span", {}, "📦 Object"), this.progressEl),
      this.coachEl
    );
  }

  private inBin(p: Point, b: { x: number; y: number; w: number; h: number }): boolean {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  private drop(p: Point): void {
    if (this.ended) return;
    const it = this.current();
    let chosen: boolean | null = null;
    if (this.inBin(p, BIN_METAL)) chosen = true;
    else if (this.inBin(p, BIN_NOT)) chosen = false;
    if (chosen === null) {
      this.tok = { x: START.x, y: START.y };
      return;
    }
    if (chosen === it.metal) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${it.name} is ${it.metal ? "metal" : "not metal"}.`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${it.name} is ${it.metal ? "metal" : "not metal"}.`;
    }
    this.idx += 1;
    this.tok = { x: START.x, y: START.y };
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
      this.win();
    } else this.progressEl.textContent = `${this.idx + 1} / ${ITEMS.length}`;
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("sortingcenter_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Sorted! Grouping things by a property — like what they're made of — helps us organise and understand them.",
      stars,
      resources: { Materials: 40 },
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
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All sorted! 📦", W / 2, H / 2);
      return;
    }

    const bin = (
      b: { x: number; y: number; w: number; h: number },
      label: string,
      color: string
    ) => {
      c.fillStyle = color;
      c.globalAlpha = 0.85;
      this.roundRect(c, b.x, b.y, b.w, b.h, 16);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = "#fff";
      c.font = "bold 22px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 8);
    };
    bin(BIN_METAL, "🔩 Metal", "#64748b");
    bin(BIN_NOT, "🚫 Not metal", "#a78bfa");

    const it = this.current();
    c.fillStyle = "#fff";
    c.strokeStyle = this.dragging ? "#22c55e" : "#fdba74";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(this.tok.x, this.tok.y, 42, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.font = "46px serif";
    c.textAlign = "center";
    c.fillText(it.emoji, this.tok.x, this.tok.y + 16);
    if (!this.dragging) {
      c.fillStyle = "#9a3412";
      c.font = "bold 16px Nunito, sans-serif";
      c.fillText(`Drag the ${it.name}`, this.tok.x, this.tok.y + 66);
    }

    c.fillStyle = "#9a3412";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Sort by what it's made of 📦", W / 2, 50);
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
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
    this.tok = { x: START.x, y: START.y };
    this.dragging = false;
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const sortingCenterGame: GameModule = {
  meta: {
    id: "sortingcenter",
    conceptId: "chem-16",
    title: "Sorting Center",
    stream: "chemistry",
    gradeBand: "K-2",
    emoji: "📦",
    blurb: "Drag objects into bins by a shared property — metal or not metal.",
    mission: "Sort every object by what it's made of.",
    estMinutes: 2,
  },
  create: (ctx) => new SortingCenter(ctx),
};
