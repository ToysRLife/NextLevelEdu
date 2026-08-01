import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const PIVOT_X = W / 2;
const PIVOT_Y = 360;
const BEAM_HALF = 300; // beam half-length in px
const UNIT = 40; // px per distance unit

interface Round {
  loadWeight: number; // units on the left
  loadDist: number; // distance units left of pivot
  effortWeight: number; // the weight the player slides on the right
}

// Every round must be solvable within the beam: the balance distance
// (loadWeight × loadDist ÷ effortWeight) has to be a whole number from 1 to 7
// (the farthest notch). Keep them lighter-you-balances-farther for the lesson.
const ROUNDS: Round[] = [
  { loadWeight: 4, loadDist: 5, effortWeight: 4 }, // balance at 5  (20 ÷ 4)
  { loadWeight: 6, loadDist: 4, effortWeight: 4 }, // balance at 6  (24 ÷ 4)
  { loadWeight: 2, loadDist: 6, effortWeight: 4 }, // balance at 3  (12 ÷ 4)
];

class Levers implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private roundIdx = 0;
  private effortDist = 3; // distance units right of pivot (player-controlled)
  private dragging = false;
  private tilt = 0; // animated beam tilt
  private mistakes = 0;

  private distEl!: HTMLElement;
  private torqueEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        if (this.nearEffort(p)) this.dragging = true;
        this.dragTo(p);
      },
      move: (p) => {
        if (this.dragging) this.dragTo(p);
      },
      up: () => {
        this.dragging = false;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "A lever balances around a pivot. What matters is turning effort: weight × its distance from the pivot.",
      "A small weight far from the pivot can balance a big weight close to it. Slide your weight to change its distance.",
      "Balance when weight×distance is equal on both sides. Match the left side's turning effort exactly.",
    ]);
    this.renderLoop();
  }

  private round(): Round {
    return ROUNDS[this.roundIdx];
  }

  private effortX(): number {
    return PIVOT_X + this.effortDist * UNIT;
  }

  private nearEffort(p: Point): boolean {
    return Math.hypot(p.x - this.effortX(), p.y - PIVOT_Y) < 80;
  }

  private dragTo(p: Point): void {
    if (this.ended) return;
    if (!this.dragging) return;
    const dist = Math.round((p.x - PIVOT_X) / UNIT);
    this.effortDist = Math.max(1, Math.min(7, dist));
    this.updateReadout();
  }

  private buildPanel(): void {
    const closer = el(
      "button",
      { class: "btn secondary", onclick: () => this.nudge(-1) },
      "◀ Move closer"
    );
    const farther = el(
      "button",
      { class: "btn secondary", onclick: () => this.nudge(1) },
      "Move farther ▶"
    );
    const checkBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-purple)" }, onclick: () => this.check() },
      "⚖️ Check balance"
    );

    this.distEl = el("span", {}, "3 units");
    this.torqueEl = el("span", { style: { color: "var(--accent-purple)" } }, "");
    this.statusEl = el("span", {}, `Round 1 / ${ROUNDS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
    });
    this.coachEl.textContent =
      "Slide your weight (drag it, or use the buttons) until the beam balances.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Balance the beam")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Move your weight"),
      el("div", { class: "chip-row" }, closer, farther),
      checkBtn,
      el("div", { class: "metric" }, el("span", {}, "📏 Your distance"), this.distEl),
      el("div", { class: "metric" }, el("span", {}, "🔄 Turning effort"), this.torqueEl),
      el("div", { class: "metric" }, el("span", {}, "🏁 Progress"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private nudge(d: number): void {
    if (this.ended) return;
    this.effortDist = Math.max(1, Math.min(7, this.effortDist + d));
    this.ctx.services.audio.play("click");
    this.updateReadout();
  }

  private updateReadout(): void {
    const r = this.round();
    this.distEl.textContent = `${this.effortDist} units`;
    const left = r.loadWeight * r.loadDist;
    const right = r.effortWeight * this.effortDist;
    this.torqueEl.textContent = `you ${right}  vs  load ${left}`;
    this.statusEl.textContent = `Round ${this.roundIdx + 1} / ${ROUNDS.length}`;
  }

  private check(): void {
    if (this.ended) return;
    const r = this.round();
    const left = r.loadWeight * r.loadDist;
    const right = r.effortWeight * this.effortDist;
    if (left === right) {
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ Balanced! ${r.effortWeight}×${this.effortDist} = ${r.loadWeight}×${r.loadDist}. The turning effort matches.`;
      this.roundIdx += 1;
      if (this.roundIdx >= ROUNDS.length) {
        this.win();
      } else {
        this.effortDist = 3;
        this.updateReadout();
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        right < left
          ? "Not balanced — your side has less turning effort. Move your weight farther out."
          : "Not balanced — your side has too much turning effort. Move your weight closer in.";
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("levers_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Perfectly balanced! A lever multiplies effort: a weight far from the pivot balances a heavier one close to it. That's how a small push can lift a lot.",
      stars,
      resources: { Alloy: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      // ease the beam toward its true tilt from net torque
      if (!this.ended) {
        const r = this.round();
        const net = r.effortWeight * this.effortDist - r.loadWeight * r.loadDist;
        const targetTilt = Math.max(-0.22, Math.min(0.22, net * 0.01));
        this.tilt += (targetTilt - this.tilt) * 0.12;
      }
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#faf5ff";
    c.fillRect(0, 0, W, H);

    const r = this.round();

    // pivot triangle
    c.fillStyle = "#6d28d9";
    c.beginPath();
    c.moveTo(PIVOT_X, PIVOT_Y);
    c.lineTo(PIVOT_X - 40, PIVOT_Y + 90);
    c.lineTo(PIVOT_X + 40, PIVOT_Y + 90);
    c.closePath();
    c.fill();

    c.save();
    c.translate(PIVOT_X, PIVOT_Y);
    c.rotate(this.tilt);

    // beam
    c.fillStyle = "#a78bfa";
    c.fillRect(-BEAM_HALF, -10, BEAM_HALF * 2, 20);

    // distance ticks
    c.fillStyle = "rgba(255,255,255,0.7)";
    for (let d = -7; d <= 7; d++) {
      if (d === 0) continue;
      c.fillRect(d * UNIT - 1, -10, 2, 20);
    }

    // load on the left
    const lx = -r.loadDist * UNIT;
    this.drawWeight(c, lx, r.loadWeight, "#ef4444", "Load");

    // effort weight on the right (player)
    const ex = this.effortDist * UNIT;
    this.drawWeight(c, ex, r.effortWeight, "#22c55e", "You");

    c.restore();

    // labels
    c.fillStyle = "#4c1d95";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Balance the lever ⚖️", W / 2, 60);
    c.font = "14px Nunito, sans-serif";
    c.fillText("Turning effort = weight × distance from the pivot", W / 2, 86);
  }

  private drawWeight(
    c: CanvasRenderingContext2D,
    x: number,
    weight: number,
    color: string,
    label: string
  ): void {
    const h = 24 + weight * 14;
    c.fillStyle = color;
    c.fillRect(x - 22, -10 - h, 44, h);
    c.fillStyle = "#fff";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(String(weight), x, -10 - h / 2 + 6);
    c.fillStyle = "#312e81";
    c.font = "bold 12px Nunito, sans-serif";
    c.fillText(label, x, 34);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.roundIdx = 0;
    this.effortDist = 3;
    this.mistakes = 0;
    this.tilt = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const leversGame: GameModule = {
  meta: {
    id: "levers",
    conceptId: "phys-08",
    title: "Balance Master",
    stream: "physics",
    gradeBand: "3-5",
    emoji: "⚖️",
    blurb: "Slide a weight along a lever to balance a heavier load on the other side.",
    mission: "Balance the beam in every round by matching the turning effort on each side.",
    estMinutes: 3,
  },
  create: (ctx) => new Levers(ctx),
};
