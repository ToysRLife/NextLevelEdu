import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const CX = 430;
const CY = 320;
const RING = 180;

interface Stage {
  key: string;
  name: string;
  emoji: string;
  note: string;
}

const STAGES: Stage[] = [
  {
    key: "seed",
    name: "Seed",
    emoji: "🌰",
    note: "A seed rests in the soil, waiting for water and warmth.",
  },
  {
    key: "sprout",
    name: "Sprout",
    emoji: "🌱",
    note: "It germinates — a tiny root and shoot push out.",
  },
  {
    key: "seedling",
    name: "Seedling",
    emoji: "🌿",
    note: "Leaves grow and the young plant makes its own food.",
  },
  { key: "flower", name: "Flower", emoji: "🌻", note: "The grown plant blooms with flowers." },
  {
    key: "newseed",
    name: "New seeds",
    emoji: "🫛",
    note: "Flowers make new seeds — and the cycle begins again!",
  },
];

class PlantCycle implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private placed = 0;
  private tray: Stage[] = [];
  private mistakes = 0;

  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tray = [...STAGES].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "A plant's life cycle is the journey from seed to grown plant and back to seeds.",
      "It starts with a seed, which sprouts, grows leaves, blooms into a flower, and then makes new seeds.",
      "Order: Seed → Sprout → Seedling → Flower → New seeds, which loops right back to a seed.",
    ]);
    this.renderLoop();
  }

  private slotPos(i: number): { x: number; y: number } {
    const a = -Math.PI / 2 + (i / STAGES.length) * Math.PI * 2;
    return { x: CX + Math.cos(a) * RING, y: CY + Math.sin(a) * RING };
  }

  private buildPanel(): void {
    const next = STAGES[this.placed];
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...this.tray.map((s) =>
        el("button", { class: "chip", onclick: () => this.pick(s.key) }, `${s.emoji} ${s.name}`)
      )
    );

    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.placed} / ${STAGES.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = next
      ? `What comes at stage #${this.placed + 1}?`
      : "Cycle complete!";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Order the life cycle")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the next stage"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🌱 Stages placed"), this.statusEl),
      this.coachEl
    );
  }

  private pick(key: string): void {
    if (this.ended) return;
    const correct = STAGES[this.placed];
    if (key === correct.key) {
      this.placed += 1;
      this.tray = this.tray.filter((s) => s.key !== key);
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${correct.note}`;
      if (this.placed >= STAGES.length) this.win();
      else this.buildPanel();
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Not yet. ${correct.note}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("plantcycle_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Full circle! A plant grows from a seed, sprouts, grows leaves, blooms, and makes new seeds — and the whole cycle starts over again.",
      stars,
      resources: { Seeds: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.04;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    const grad = c.createRadialGradient(CX, CY, 40, CX, CY, 320);
    grad.addColorStop(0, "#dcfce7");
    grad.addColorStop(1, "#bbf7d0");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    // cycle arrows between consecutive slots
    for (let i = 0; i < STAGES.length; i++) {
      if (i >= this.placed) continue;
      const a = this.slotPos(i);
      const b = this.slotPos((i + 1) % STAGES.length);
      if ((i + 1) % STAGES.length <= this.placed - 1 || i < this.placed - 1) {
        c.strokeStyle = "#16a34a";
        c.lineWidth = 3;
        c.setLineDash([8, 6]);
        c.lineDashOffset = -this.anim * 8;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
        c.setLineDash([]);
      }
    }

    // slots
    for (let i = 0; i < STAGES.length; i++) {
      const pos = this.slotPos(i);
      const done = i < this.placed;
      const isNext = i === this.placed;
      c.fillStyle = done ? "#fff" : isNext ? "#fef9c3" : "rgba(255,255,255,0.4)";
      c.strokeStyle = isNext ? "#22c55e" : "#86efac";
      c.lineWidth = isNext ? 4 : 2;
      c.beginPath();
      c.arc(pos.x, pos.y, 50, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.textAlign = "center";
      if (done) {
        c.font = "44px serif";
        c.fillText(STAGES[i].emoji, pos.x, pos.y + 14);
        c.fillStyle = "#166534";
        c.font = "bold 13px Nunito, sans-serif";
        c.fillText(STAGES[i].name, pos.x, pos.y + 66);
      } else {
        c.fillStyle = isNext ? "#15803d" : "#94a3b8";
        c.font = "bold 24px Nunito, sans-serif";
        c.fillText(isNext ? "?" : String(i + 1), pos.x, pos.y + 8);
      }
    }

    // center label
    c.fillStyle = "#14532d";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Plant", CX, CY - 6);
    c.fillText("Life Cycle 🌻", CX, CY + 18);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.placed = 0;
    this.mistakes = 0;
    this.tray = [...STAGES].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const plantCycleGame: GameModule = {
  meta: {
    id: "plantcycle",
    conceptId: "bio-05",
    title: "Seed to Bloom",
    stream: "biology",
    gradeBand: "2-3",
    emoji: "🌻",
    blurb: "Put the plant's life cycle in order, from seed to flower and back to seeds.",
    mission: "Arrange the life-cycle stages in the right order around the circle.",
    estMinutes: 2,
  },
  create: (ctx) => new PlantCycle(ctx),
};
