import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Material {
  key: string;
  name: string;
  emoji: string;
  color: string;
}

const MATERIALS: Material[] = [
  { key: "glass", name: "Glass", emoji: "🪟", color: "#7dd3fc" },
  { key: "metal", name: "Metal", emoji: "🔩", color: "#94a3b8" },
  { key: "plastic", name: "Plastic", emoji: "🧴", color: "#f472b6" },
  { key: "rubber", name: "Rubber", emoji: "🛞", color: "#44403c" },
  { key: "wool", name: "Wool", emoji: "🧶", color: "#fca5a5" },
  { key: "wood", name: "Wood", emoji: "🪵", color: "#b45309" },
];

interface Job {
  prompt: string;
  emoji: string;
  answer: string;
  why: string;
}

const JOBS: Job[] = [
  {
    prompt: "A window you can see through",
    emoji: "🏠",
    answer: "glass",
    why: "Glass is transparent — light passes straight through it.",
  },
  {
    prompt: "A wire to carry electricity",
    emoji: "⚡",
    answer: "metal",
    why: "Metal conducts electricity, so charge flows through it.",
  },
  {
    prompt: "A raincoat to stay dry",
    emoji: "🌧️",
    answer: "plastic",
    why: "Plastic is waterproof — water can't soak through it.",
  },
  {
    prompt: "A ball that bounces high",
    emoji: "⛹️",
    answer: "rubber",
    why: "Rubber is stretchy and springy, so it bounces back.",
  },
  {
    prompt: "A scarf to keep you warm",
    emoji: "❄️",
    answer: "wool",
    why: "Wool is soft and traps warm air to keep you cozy.",
  },
  {
    prompt: "A strong tree-house floor",
    emoji: "🌳",
    answer: "wood",
    why: "Wood is strong and stiff, so it holds weight without bending.",
  },
];

class Materials implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Job[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...JOBS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Every material has properties — see-through, waterproof, bendy, strong — that make it good for some jobs and not others.",
      "Think about what the job needs: Can you see through it? Does it keep water out? Does it carry electricity?",
      "Match the property to the need: glass=see-through, metal=conducts, plastic=waterproof, rubber=bouncy, wool=warm, wood=strong.",
    ]);
    this.renderLoop();
  }

  private current(): Job {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...MATERIALS.map((m) =>
        el("button", { class: "chip", onclick: () => this.choose(m.key) }, `${m.emoji} ${m.name}`)
      )
    );

    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${JOBS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Pick the material whose properties best fit the job.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Match every job")
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "Choose the best material"
      ),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🧰 Job"), this.progressEl),
      this.coachEl
    );
  }

  private choose(key: string): void {
    if (this.ended) return;
    const job = this.current();
    if (key === job.answer) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${job.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      const picked = MATERIALS.find((m) => m.key === key)!;
      this.coachEl.textContent = `❌ ${picked.name} doesn't fit best here. ${job.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${JOBS.length} / ${JOBS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${JOBS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("materials_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Well matched! We choose materials by their properties — glass to see through, metal to carry electricity, plastic to keep water out, and so on.",
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
      c.fillText("Every job matched! 🧰", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const job = this.current();

    // job card
    const cardW = 420;
    const cardH = 300;
    const cx = W / 2;
    const cy = 300 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#fdba74";
    c.lineWidth = 6;
    this.roundRect(c, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
    c.fill();
    c.stroke();

    c.font = "110px serif";
    c.textAlign = "center";
    c.fillText(job.emoji, cx, cy - 10);
    c.fillStyle = "#9a3412";
    c.font = "bold 26px Nunito, sans-serif";
    c.fillText("I need a material for:", cx, cy + 70);
    c.font = "bold 24px Nunito, sans-serif";
    c.fillStyle = "#7c2d12";
    this.wrapText(c, job.prompt, cx, cy + 108, 380, 30);

    c.fillStyle = "#9a3412";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("Which material fits best?", W / 2, 70);
  }

  private wrapText(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number
  ): void {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, yy);
        line = w;
        yy += lh;
      } else {
        line = test;
      }
    }
    c.fillText(line, x, yy);
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
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
    this.mistakes = 0;
    this.flash = 0;
    this.order = [...JOBS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const materialsGame: GameModule = {
  meta: {
    id: "materials",
    conceptId: "chem-13",
    title: "Right Stuff",
    stream: "chemistry",
    gradeBand: "K-2",
    emoji: "🧰",
    blurb: "Pick the material whose properties fit each job — glass, metal, rubber, and more.",
    mission: "Match the best material to every job using its properties.",
    estMinutes: 2,
  },
  create: (ctx) => new Materials(ctx),
};
