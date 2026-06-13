import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const GROUND = 430;

interface Pile {
  x: number;
  y: number;
  emoji: string;
  decay: number; // 0..1
  power: number; // current decomposer activity
  done: boolean;
  sprout: number; // 0..1 growth of new plant after decay
  critters: { dx: number; dy: number; phase: number }[];
}

type Decomposer = { key: string; label: string; emoji: string };
const DECOMPOSERS: Decomposer[] = [
  { key: "worm", label: "Worms", emoji: "🪱" },
  { key: "fungi", label: "Fungi", emoji: "🍄" },
  { key: "microbe", label: "Microbes", emoji: "🦠" },
];

class Decomposers implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private detach: () => void;
  private anim = 0;
  private ended = false;

  private active = "worm";
  private piles: Pile[] = [];
  private nutrients = 0;
  private grown = 0;
  private elapsed = 0;

  private statusEl!: HTMLElement;
  private nutrientEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.resetPiles();
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => this.poke(p),
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "When plants and animals die, decomposers — worms, fungi, and microbes — break them down.",
      "Decomposing returns nutrients to the soil, which new plants use to grow. It's nature's recycling.",
      "Pick a decomposer, then tap the dead matter again and again to speed up decay. Each pile turns into soil and sprouts a new plant.",
    ]);
    this.loop.start();
    this.render();
  }

  private resetPiles(): void {
    const emojis = ["🍂", "🪵", "🦴", "🍂", "🪵"];
    this.piles = emojis.map((emoji, i) => ({
      x: 130 + i * 130,
      y: GROUND,
      emoji,
      decay: 0,
      power: 0,
      done: false,
      sprout: 0,
      critters: [],
    }));
  }

  private buildPanel(): void {
    const palette = el(
      "div",
      { class: "chip-row" },
      ...DECOMPOSERS.map((d) =>
        el(
          "button",
          {
            class: "chip",
            style:
              this.active === d.key
                ? { background: "var(--accent-green)", color: "#fff", borderColor: "var(--accent-green)" }
                : {},
            onclick: () => {
              this.active = d.key;
              this.ctx.services.audio.play("click");
              this.buildPanel();
            },
          },
          `${d.emoji} ${d.label}`,
        ),
      ),
    );

    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / 5`);
    this.nutrientEl = el("span", {}, "0");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = "Tap the dead leaves, logs, and bones to set the decomposers to work.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Recycle all 5 piles"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick a decomposer, then tap dead matter"),
      palette,
      el("div", { class: "metric" }, el("span", {}, "🌱 New plants"), this.statusEl),
      el("div", { class: "metric" }, el("span", {}, "🟤 Soil nutrients"), this.nutrientEl),
      this.coachEl,
    );
  }

  private poke(p: Point): void {
    if (this.ended) return;
    let best: Pile | null = null;
    let bestD = 70;
    for (const pile of this.piles) {
      if (pile.done) continue;
      const d = Math.hypot(p.x - pile.x, p.y - pile.y + 30);
      if (d < bestD) {
        bestD = d;
        best = pile;
      }
    }
    if (best) {
      best.power = Math.min(1, best.power + 0.35);
      if (best.critters.length < 6) {
        best.critters.push({ dx: (Math.random() - 0.5) * 60, dy: -Math.random() * 30, phase: Math.random() * 6 });
      }
      this.ctx.services.audio.play("tick");
    }
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.anim += 0.05 * f;
    this.elapsed += dtMs / 1000;

    for (const pile of this.piles) {
      if (pile.done) {
        pile.sprout = Math.min(1, pile.sprout + 0.01 * f);
        continue;
      }
      pile.power = Math.max(0, pile.power - 0.006 * f);
      pile.decay = Math.min(1, pile.decay + (0.0015 + pile.power * 0.02) * f);
      if (pile.decay >= 1) {
        pile.done = true;
        pile.critters = [];
        this.nutrients += 20;
        this.grown += 1;
        this.nutrientEl.textContent = String(this.nutrients);
        this.statusEl.textContent = `${this.grown} / 5`;
        this.ctx.services.audio.play("reward");
        this.coachEl.textContent = "♻️ Broken down into rich soil — and a new plant sprouts from it!";
        if (this.grown >= this.piles.length) this.finish();
      }
      for (const cr of pile.critters) cr.phase += 0.1 * f;
    }
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    // Faster recycling earns more stars.
    const stars = this.elapsed < 30 ? 3 : this.elapsed < 55 ? 2 : 1;
    this.ctx.services.score.event("decomposers_done", { seconds: Math.round(this.elapsed) });
    this.ctx.services.outcome.succeed({
      message:
        "The forest renews itself! Decomposers break dead matter into soil nutrients, and new plants grow from them. Nothing is wasted — it's nature's recycling.",
      stars,
      resources: { Biomass: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky + forest floor
    c.fillStyle = "#bbf7d0";
    c.fillRect(0, 0, W, GROUND);
    c.fillStyle = "#6b4423";
    c.fillRect(0, GROUND, W, H - GROUND);
    // soil enrichment shading grows with nutrients
    c.fillStyle = `rgba(60,40,20,${Math.min(0.5, this.nutrients / 200)})`;
    c.fillRect(0, GROUND, W, H - GROUND);

    for (const pile of this.piles) {
      if (pile.done) {
        // new sprout
        const hgt = pile.sprout * 90;
        c.strokeStyle = "#16a34a";
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(pile.x, GROUND);
        c.lineTo(pile.x, GROUND - hgt);
        c.stroke();
        if (pile.sprout > 0.4) {
          c.fillStyle = "#22c55e";
          c.beginPath();
          c.ellipse(pile.x - 14, GROUND - hgt + 16, 16, 8, -0.6, 0, Math.PI * 2);
          c.ellipse(pile.x + 14, GROUND - hgt + 16, 16, 8, 0.6, 0, Math.PI * 2);
          c.fill();
        }
        if (pile.sprout >= 1) {
          c.font = "26px serif";
          c.textAlign = "center";
          c.fillText("🌼", pile.x, GROUND - hgt - 4);
        }
        continue;
      }

      // dead matter shrinking & darkening as it decays
      const scale = 1 - pile.decay * 0.6;
      c.save();
      c.translate(pile.x, GROUND - 18);
      c.scale(scale, scale);
      c.globalAlpha = 1 - pile.decay * 0.5;
      c.font = "48px serif";
      c.textAlign = "center";
      c.fillText(pile.emoji, 0, 16);
      c.restore();
      c.globalAlpha = 1;

      // decay progress ring
      c.strokeStyle = "rgba(0,0,0,0.15)";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(pile.x, GROUND - 18, 36, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = pile.power > 0.05 ? "#16a34a" : "#84cc16";
      c.beginPath();
      c.arc(pile.x, GROUND - 18, 36, -Math.PI / 2, -Math.PI / 2 + pile.decay * Math.PI * 2);
      c.stroke();

      // crawling decomposers
      c.font = "16px serif";
      const e = DECOMPOSERS.find((d) => d.key === this.active)!.emoji;
      for (const cr of pile.critters) {
        c.fillText(e, pile.x + cr.dx + Math.sin(cr.phase) * 6, GROUND - 10 + cr.dy);
      }
    }

    c.fillStyle = "#14532d";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Tap the dead matter to recycle it ♻️", W / 2, 40);
  }

  start(): void {
    if (!this.ended) this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (!this.ended) this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.ended = false;
    this.nutrients = 0;
    this.grown = 0;
    this.elapsed = 0;
    this.resetPiles();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
    this.detach();
  }
}

export const decomposersGame: GameModule = {
  meta: {
    id: "decomposers",
    conceptId: "bio-21",
    title: "Nature's Recyclers",
    stream: "biology",
    gradeBand: "4-5",
    emoji: "🍄",
    blurb: "Set worms, fungi, and microbes to work breaking dead matter into new soil.",
    mission: "Decompose every pile of dead matter so new plants can grow from the soil.",
    estMinutes: 3,
  },
  create: (ctx) => new Decomposers(ctx),
};
