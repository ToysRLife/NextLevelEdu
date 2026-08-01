import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Item {
  name: string;
  emoji: string;
  natural: boolean;
  why: string;
}

const ITEMS: Item[] = [
  { name: "Wood", emoji: "🪵", natural: true, why: "Wood comes from trees — it's natural." },
  { name: "Rock", emoji: "🪨", natural: true, why: "Rock forms in the Earth — it's natural." },
  { name: "Wool", emoji: "🧶", natural: true, why: "Wool grows on sheep — it's natural." },
  {
    name: "Seashell",
    emoji: "🐚",
    natural: true,
    why: "A shell is made by a sea creature — natural.",
  },
  {
    name: "Plastic bottle",
    emoji: "🧴",
    natural: false,
    why: "Plastic is made in factories from oil — it's man-made.",
  },
  {
    name: "Brick",
    emoji: "🧱",
    natural: false,
    why: "Bricks are made by baking shaped clay — man-made.",
  },
  {
    name: "Tin can",
    emoji: "🥫",
    natural: false,
    why: "Cans are manufactured from metal — man-made.",
  },
  {
    name: "Glass",
    emoji: "🪟",
    natural: false,
    why: "Glass is made by melting sand in a factory — man-made.",
  },
];

class ManMade implements GameInstance {
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
      "Natural things come from nature — plants, animals, or the Earth. Man-made things are created by people.",
      "Ask: did this come straight from a living thing or the ground, or did a factory make it?",
      "Wood, rock, wool, and shells are natural. Plastic, brick, cans, and glass are made by people.",
    ]);
    this.renderLoop();
  }

  private current(): Item {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const choices = el(
      "div",
      { class: "chip-row" },
      el(
        "button",
        {
          class: "btn",
          style: { background: "var(--accent-green)" },
          onclick: () => this.choose(true),
        },
        "🌿 Natural"
      ),
      el(
        "button",
        {
          class: "btn",
          style: { background: "var(--accent-purple)" },
          onclick: () => this.choose(false),
        },
        "🏭 Man-made"
      )
    );

    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${ITEMS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Did this come from nature, or did people make it?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Sort all 8")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Natural or man-made?"),
      choices,
      el("div", { class: "metric" }, el("span", {}, "📦 Item"), this.progressEl),
      this.coachEl
    );
  }

  private choose(saysNatural: boolean): void {
    if (this.ended) return;
    const it = this.current();
    if (saysNatural === it.natural) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${it.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${it.why}`;
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
    this.ctx.services.score.event("manmade_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Sorted! Natural materials come straight from plants, animals, or the Earth. Man-made materials are created by people, often in factories.",
      stars,
      resources: { Materials: 40 },
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
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All sorted! 📦", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const it = this.current();
    const cx = W / 2;
    const cy = 280 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#fdba74";
    c.lineWidth = 6;
    this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
    c.fill();
    c.stroke();
    c.font = "120px serif";
    c.textAlign = "center";
    c.fillText(it.emoji, cx, cy + 20);
    c.fillStyle = "#9a3412";
    c.font = "bold 26px Nunito, sans-serif";
    c.fillText(it.name, cx, cy + 100);

    c.fillStyle = "#9a3412";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("Natural 🌿 or man-made 🏭?", W / 2, 60);
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
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const manMadeGame: GameModule = {
  meta: {
    id: "manmade",
    conceptId: "chem-14",
    title: "Where's It From?",
    stream: "chemistry",
    gradeBand: "2-3",
    emoji: "🏭",
    blurb: "Sort everyday things into natural and man-made.",
    mission: "Decide whether each thing comes from nature or is made by people.",
    estMinutes: 2,
  },
  create: (ctx) => new ManMade(ctx),
};
