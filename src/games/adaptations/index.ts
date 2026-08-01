import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Option {
  key: string;
  label: string;
  emoji: string;
}
interface Category {
  id: "covering" | "body" | "feet";
  label: string;
  options: Option[];
}

const CATEGORIES: Category[] = [
  {
    id: "covering",
    label: "Body covering",
    options: [
      { key: "thickfur", label: "Thick white fur", emoji: "🐻‍❄️" },
      { key: "thincoat", label: "Light thin coat", emoji: "🐪" },
      { key: "waterproof", label: "Waterproof coat", emoji: "🦦" },
    ],
  },
  {
    id: "body",
    label: "Special body feature",
    options: [
      { key: "blubber", label: "Fatty blubber", emoji: "🧈" },
      { key: "hump", label: "Water-storing hump", emoji: "💧" },
      { key: "tail", label: "Long gripping tail", emoji: "🐒" },
    ],
  },
  {
    id: "feet",
    label: "Feet",
    options: [
      { key: "snowpaws", label: "Wide snow paws", emoji: "🐾" },
      { key: "sandpads", label: "Broad sand pads", emoji: "🐫" },
      { key: "claws", label: "Climbing claws", emoji: "🦥" },
    ],
  },
];

interface Habitat {
  name: string;
  emoji: string;
  bg: string;
  correct: { covering: string; body: string; feet: string };
}

const HABITATS: Habitat[] = [
  {
    name: "Frozen Arctic",
    emoji: "🧊",
    bg: "#dbeafe",
    correct: { covering: "thickfur", body: "blubber", feet: "snowpaws" },
  },
  {
    name: "Hot Desert",
    emoji: "🏜️",
    bg: "#fef3c7",
    correct: { covering: "thincoat", body: "hump", feet: "sandpads" },
  },
  {
    name: "Rainforest",
    emoji: "🌴",
    bg: "#dcfce7",
    correct: { covering: "waterproof", body: "tail", feet: "claws" },
  },
];

class Adaptations implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Habitat[] = [];
  private idx = 0;
  private selected: Record<string, string | undefined> = {};
  private mistakes = 0;
  private survived = 0;

  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...HABITATS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "An adaptation is a body feature that helps an animal survive where it lives.",
      "Think about the habitat's challenge: freezing cold needs warmth; a hot desert needs to save water; a rainforest needs to climb and shed rain.",
      "Arctic → thick fur, blubber, snow paws. Desert → thin coat, water hump, sand pads. Rainforest → waterproof coat, gripping tail, climbing claws.",
    ]);
    this.renderLoop();
  }

  private habitat(): Habitat {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const rows = CATEGORIES.map((cat) =>
      el(
        "div",
        {},
        el("div", { class: "control-label" }, cat.label),
        el(
          "div",
          { class: "chip-row", style: { flexWrap: "wrap" } },
          ...cat.options.map((o) => {
            const isSel = this.selected[cat.id] === o.key;
            return el(
              "button",
              {
                class: "chip",
                style: isSel
                  ? {
                      background: "var(--accent-green)",
                      color: "#fff",
                      borderColor: "var(--accent-green)",
                    }
                  : {},
                onclick: () => {
                  this.selected[cat.id] = o.key;
                  this.ctx.services.audio.play("click");
                  this.buildPanel();
                },
              },
              `${o.emoji} ${o.label}`
            );
          })
        )
      )
    );

    const releaseBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.release() },
      "🌿 Release into the wild"
    );

    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.survived} / ${HABITATS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = `Equip a creature to survive the ${this.habitat().name}.`;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Survive"),
        el("span", {}, this.habitat().name)
      ),
      ...rows,
      releaseBtn,
      el("div", { class: "metric" }, el("span", {}, "🏆 Survived"), this.statusEl),
      this.coachEl
    );
  }

  private release(): void {
    if (this.ended) return;
    const h = this.habitat();
    const picks = this.selected;
    if (!picks.covering || !picks.body || !picks.feet) {
      this.coachEl.textContent = "Choose one feature in each category first.";
      return;
    }
    const wrong = (Object.keys(h.correct) as (keyof Habitat["correct"])[]).filter(
      (k) => picks[k] !== h.correct[k]
    );
    if (wrong.length === 0) {
      this.survived += 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = "🎉 It thrives! Every feature suits this habitat.";
      this.idx += 1;
      this.selected = {};
      if (this.survived >= HABITATS.length) {
        this.win();
      } else {
        this.buildPanel();
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      const names = wrong.map((k) => CATEGORIES.find((c) => c.id === k)!.label.toLowerCase());
      this.coachEl.textContent = `😟 It struggled — rethink the ${names.join(" and ")}. Match the feature to the habitat's challenge.`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("adaptations_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Survivors all! Adaptations are body features matched to a habitat — fur and blubber for cold, water stores for deserts, claws and grips for the forest.",
      stars,
      resources: { Species: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    if (this.ended) {
      c.fillStyle = "#dcfce7";
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#166534";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Built to survive! 🌍", W / 2, H / 2);
      return;
    }
    const h = this.habitat();
    c.fillStyle = h.bg;
    c.fillRect(0, 0, W, H);

    // big habitat emoji backdrop
    c.globalAlpha = 0.25;
    c.font = "300px serif";
    c.textAlign = "center";
    c.fillText(h.emoji, W / 2, H / 2 + 110);
    c.globalAlpha = 1;

    // creature preview built from current selections
    const cx = W / 2;
    const cy = 280 + Math.sin(this.anim) * 8;
    c.fillStyle = "#fbbf24";
    c.beginPath();
    c.ellipse(cx, cy, 80, 64, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(cx - 26, cy - 14, 14, 0, Math.PI * 2);
    c.arc(cx + 26, cy - 14, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1e293b";
    c.beginPath();
    c.arc(cx - 26, cy - 14, 6, 0, Math.PI * 2);
    c.arc(cx + 26, cy - 14, 6, 0, Math.PI * 2);
    c.fill();

    // show chosen feature emojis around the creature
    const chosen: string[] = [];
    for (const cat of CATEGORIES) {
      const sel = this.selected[cat.id];
      if (sel) chosen.push(cat.options.find((o) => o.key === sel)!.emoji);
    }
    c.font = "34px serif";
    chosen.forEach((e, i) => {
      c.fillText(e, cx - 40 + i * 40, cy + 100);
    });

    // title card
    c.fillStyle = "rgba(255,255,255,0.85)";
    this.roundRect(c, W / 2 - 200, 30, 400, 50, 14);
    c.fill();
    c.fillStyle = "#166534";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(`${h.emoji} ${h.name}`, W / 2, 62);
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
    this.selected = {};
    this.mistakes = 0;
    this.survived = 0;
    this.order = [...HABITATS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const adaptationsGame: GameModule = {
  meta: {
    id: "adaptations",
    conceptId: "bio-16",
    title: "Built to Survive",
    stream: "biology",
    gradeBand: "3-4",
    emoji: "🦊",
    blurb: "Equip a creature with the right features to survive each habitat.",
    mission: "Give a creature adaptations that match the arctic, desert, and rainforest.",
    estMinutes: 3,
  },
  create: (ctx) => new Adaptations(ctx),
};
