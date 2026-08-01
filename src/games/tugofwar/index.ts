import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const CX = W / 2;
const ROPE_Y = 320;
const MARK = 200; // distance to win to a side

type Goal = "balance" | "right" | "left";

const PROMPTS: { goal: Goal; label: string; hint: string }[] = [
  {
    goal: "balance",
    label: "Balance it (no winner)",
    hint: "Balanced forces — equal pulls — keep the flag still in the middle.",
  },
  {
    goal: "right",
    label: "Let the 🔴 Red team win",
    hint: "Unbalanced forces — make Red pull harder so the flag moves their way.",
  },
  {
    goal: "left",
    label: "Let the 🔵 Blue team win",
    hint: "Unbalanced forces — make Blue pull harder to drag the flag over.",
  },
];

class TugOfWar implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private left = 3; // blue pullers
  private right = 3; // red pullers
  private flagX = 0; // offset from centre
  private vel = 0;
  private order: typeof PROMPTS = [];
  private idx = 0;
  private matched = 0;
  private hold = 0;
  private ended = false;

  private netEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.order = [...PROMPTS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "A force is a push or pull. When two forces are equal, they're balanced and nothing moves.",
      "When one force is bigger, the forces are unbalanced — the object moves toward the stronger pull.",
      "Add or remove pullers on each side to balance the rope, or to make one team stronger.",
    ]);
    this.loop.start();
    this.render();
  }

  private goal(): (typeof PROMPTS)[number] {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const blue = el("input", {
      type: "range",
      min: "0",
      max: "8",
      value: String(this.left),
      "aria-label": "Blue pullers",
      style: { accentColor: "var(--accent-blue)" },
      oninput: (e: Event) => {
        this.left = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    const red = el("input", {
      type: "range",
      min: "0",
      max: "8",
      value: String(this.right),
      "aria-label": "Red pullers",
      style: { accentColor: "var(--accent-red)" },
      oninput: (e: Event) => {
        this.right = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.netEl = el("span", {}, "");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-purple)" } },
      `0 / ${PROMPTS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, this.goal().label)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔵 Blue pullers"),
      blue,
      el("div", { class: "control-label" }, "🔴 Red pullers"),
      red,
      el("div", { class: "metric" }, el("span", {}, "⚖️ Forces"), this.netEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Done"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const net = this.right - this.left;
    this.netEl.textContent =
      net === 0
        ? `balanced (${this.left}=${this.right})`
        : net > 0
          ? `Red +${net}`
          : `Blue +${-net}`;
    this.coachEl.textContent = this.goal().hint;
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    const net = this.right - this.left;
    this.vel += net * 0.01 * f;
    this.vel *= 0.92;
    this.flagX += this.vel * 2 * f;
    this.flagX = Math.max(-MARK - 30, Math.min(MARK + 30, this.flagX));

    const g = this.goal().goal;
    if (g === "balance") {
      if (this.left === this.right && Math.abs(this.flagX) < 40 && Math.abs(this.vel) < 0.3) {
        this.hold += f;
        if (this.hold > 30) this.match();
      } else {
        this.hold = 0;
      }
    } else if (g === "right") {
      if (this.flagX >= MARK) this.match();
    } else if (g === "left") {
      if (this.flagX <= -MARK) this.match();
    }
    this.render();
  }

  private match(): void {
    this.matched += 1;
    this.hold = 0;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.matched} / ${PROMPTS.length}`;
    this.idx += 1;
    if (this.matched >= PROMPTS.length) {
      this.win();
    } else {
      this.flagX = 0;
      this.vel = 0;
      this.left = 3;
      this.right = 3;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("tugofwar_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Force master! Equal forces are balanced — nothing moves. Unequal forces are unbalanced, and the object always moves toward the stronger pull.",
      stars,
      resources: { Power: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#faf5ff";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#86efac";
    c.fillRect(0, ROPE_Y + 60, W, H - ROPE_Y - 60);

    // centre line + side markers
    c.strokeStyle = "#cbd5e1";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(CX, 120);
    c.lineTo(CX, ROPE_Y + 60);
    c.stroke();
    c.strokeStyle = "#fca5a5";
    c.beginPath();
    c.moveTo(CX + MARK, 120);
    c.lineTo(CX + MARK, ROPE_Y + 60);
    c.stroke();
    c.strokeStyle = "#93c5fd";
    c.beginPath();
    c.moveTo(CX - MARK, 120);
    c.lineTo(CX - MARK, ROPE_Y + 60);
    c.stroke();

    // rope
    c.strokeStyle = "#a16207";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(120, ROPE_Y);
    c.lineTo(W - 120, ROPE_Y);
    c.stroke();

    // flag at centre marker
    const fx = CX + this.flagX;
    c.strokeStyle = "#7c3aed";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(fx, ROPE_Y);
    c.lineTo(fx, ROPE_Y - 50);
    c.stroke();
    c.fillStyle = "#7c3aed";
    c.beginPath();
    c.moveTo(fx, ROPE_Y - 50);
    c.lineTo(fx + 30, ROPE_Y - 40);
    c.lineTo(fx, ROPE_Y - 30);
    c.closePath();
    c.fill();

    // teams (count = pullers)
    c.font = "30px serif";
    c.textAlign = "center";
    for (let i = 0; i < this.left; i++) {
      c.fillText("🔵", 120 - i * 26 + fx * 0.3, ROPE_Y + 4);
    }
    for (let i = 0; i < this.right; i++) {
      c.fillText("🔴", W - 120 + i * 26 + fx * 0.3, ROPE_Y + 4);
    }

    c.fillStyle = "#4c1d95";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText(this.goal().label, W / 2, 50);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#16a34a";
      c.font = "bold 14px Nunito, sans-serif";
      c.fillText("hold the balance…", W / 2, 78);
    }
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
    this.left = 3;
    this.right = 3;
    this.flagX = 0;
    this.vel = 0;
    this.idx = 0;
    this.matched = 0;
    this.hold = 0;
    this.order = [...PROMPTS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const tugOfWarGame: GameModule = {
  meta: {
    id: "tugofwar",
    conceptId: "phys-07",
    title: "Tug of War",
    stream: "physics",
    gradeBand: "3",
    emoji: "🪢",
    blurb: "Add pullers to balance the rope or let one team win — balanced vs unbalanced forces.",
    mission: "Create balanced and unbalanced forces to control the tug-of-war.",
    estMinutes: 3,
  },
  create: (ctx) => new TugOfWar(ctx),
};
