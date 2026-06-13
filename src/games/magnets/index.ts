import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const PAD = 40;
const K = 1300;
const TIME_LIMIT = 45; // seconds

class Magnets implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private detach: (() => void) | null = null;
  private ended = false;

  private mag = { x: 160, y: 300, pole: 1 }; // player's magnet; +1 = N showing
  private dragging = false;
  private puck = { x: 400, y: 300, vx: 0, vy: 0, pole: 1 };
  private goal = { x: 660, y: 300, r: 46 };
  private holdFrames = 0;
  private timeLeft = TIME_LIMIT;

  private modeEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "Opposite poles attract (pull together); like poles repel (push apart).",
      "Drag your magnet to move it. Flip its pole to switch between pulling and pushing the puck.",
      "Pull the puck along by attracting it, then flip to repel and nudge it the last bit into the goal ring.",
    ]);
    this.attach();
    this.loop.start();
  }

  private buildPanel(): void {
    const flipBtn = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          this.mag.pole *= -1;
          this.ctx.services.audio.play("click");
          this.updateReadout();
        },
      },
      "🔄 Flip Pole",
    );

    this.modeEl = el("span", { style: { color: "var(--accent-pink)" } }, "Repel");
    this.timeEl = el("span", { style: { color: "var(--accent-orange)" } }, `${TIME_LIMIT}s`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "control-label" }, "Drag your magnet on the board"),
      flipBtn,
      el("div", { class: "metric" }, el("span", {}, "🧲 Effect"), this.modeEl),
      el("div", { class: "metric" }, el("span", {}, "⏱️ Time"), this.timeEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    // puck pole is +1; like poles (product>0) repel.
    const repel = this.mag.pole * this.puck.pole > 0;
    this.modeEl.textContent = repel ? "Repel (push)" : "Attract (pull)";
    this.timeEl.textContent = `${Math.ceil(this.timeLeft)}s`;
    this.coachEl.textContent = repel
      ? "🟥 Like poles facing — your magnet PUSHES the puck away."
      : "🟦 Opposite poles facing — your magnet PULLS the puck closer.";
  }

  private attach(): void {
    this.detach = onPointer(this.ctx.canvas, W, H, {
      down: (p) => {
        if (this.ended) return;
        if (Math.hypot(p.x - this.mag.x, p.y - this.mag.y) < 60) this.dragging = true;
        else this.moveMagnet(p);
      },
      move: (p) => {
        if (this.dragging) this.moveMagnet(p);
      },
      up: () => {
        this.dragging = false;
      },
    });
  }

  private moveMagnet(p: Point): void {
    this.mag.x = Math.max(PAD, Math.min(W - PAD, p.x));
    this.mag.y = Math.max(PAD, Math.min(H - PAD, p.y));
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.timeLeft -= dtMs / 1000;

    let dx = this.puck.x - this.mag.x;
    let dy = this.puck.y - this.mag.y;
    let r = Math.hypot(dx, dy);
    if (r < 30) r = 30;
    const force = K / (r * r);
    const product = this.mag.pole * this.puck.pole; // >0 like→repel(+dir), <0 opposite→attract(-dir)
    const ax = product * force * (dx / r);
    const ay = product * force * (dy / r);
    this.puck.vx += ax * f;
    this.puck.vy += ay * f;
    this.puck.vx *= 0.985;
    this.puck.vy *= 0.985;
    this.puck.x += this.puck.vx * f;
    this.puck.y += this.puck.vy * f;

    // walls
    if (this.puck.x < PAD) {
      this.puck.x = PAD;
      this.puck.vx = Math.abs(this.puck.vx) * 0.6;
    }
    if (this.puck.x > W - PAD) {
      this.puck.x = W - PAD;
      this.puck.vx = -Math.abs(this.puck.vx) * 0.6;
    }
    if (this.puck.y < PAD) {
      this.puck.y = PAD;
      this.puck.vy = Math.abs(this.puck.vy) * 0.6;
    }
    if (this.puck.y > H - PAD) {
      this.puck.y = H - PAD;
      this.puck.vy = -Math.abs(this.puck.vy) * 0.6;
    }

    // goal check
    const inGoal =
      Math.hypot(this.puck.x - this.goal.x, this.puck.y - this.goal.y) < this.goal.r - 14 &&
      Math.hypot(this.puck.vx, this.puck.vy) < 2.2;
    if (inGoal) {
      this.holdFrames += f;
      if (this.holdFrames >= 45) this.win();
    } else {
      this.holdFrames = Math.max(0, this.holdFrames - f);
    }

    if (this.timeLeft <= 0) this.lose();

    this.updateReadout();
    this.render();
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    let stars = this.timeLeft > TIME_LIMIT * 0.5 ? 3 : this.timeLeft > TIME_LIMIT * 0.2 ? 2 : 1;
    if (hintsUsed >= 2) stars = Math.min(stars, 2);
    this.ctx.services.score.event("magnets_goal", { timeLeft: Math.round(this.timeLeft) });
    this.ctx.services.outcome.succeed({
      message: "Parked the puck in the goal! You used attraction and repulsion to steer it without ever touching it.",
      stars,
      resources: { Alloy: 40 },
    });
  }

  private lose(): void {
    this.ended = true;
    this.loop.stop();
    this.ctx.services.outcome.fail({
      message: "Time's up! Try pulling the puck most of the way by attracting it, then flip to repel for fine control.",
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#1e1b4b";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "#312e81";
    c.lineWidth = 2;
    for (let x = 0; x < W; x += 40) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, H);
      c.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }

    // goal
    const hold = this.holdFrames / 45;
    c.strokeStyle = "#22c55e";
    c.lineWidth = 5;
    c.setLineDash([8, 6]);
    c.beginPath();
    c.arc(this.goal.x, this.goal.y, this.goal.r, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    if (hold > 0) {
      c.fillStyle = "rgba(34,197,94,0.3)";
      c.beginPath();
      c.arc(this.goal.x, this.goal.y, this.goal.r * hold, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#86efac";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🎯 GOAL", this.goal.x, this.goal.y - this.goal.r - 8);

    // player magnet (bar, two poles)
    const m = this.mag;
    const topRed = m.pole > 0; // showing N (red) toward puck side conceptually
    c.fillStyle = topRed ? "#ef4444" : "#3b82f6";
    c.fillRect(m.x - 22, m.y - 30, 44, 30);
    c.fillStyle = topRed ? "#3b82f6" : "#ef4444";
    c.fillRect(m.x - 22, m.y, 44, 30);
    c.fillStyle = "#fff";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText(topRed ? "N" : "S", m.x, m.y - 9);
    c.fillText(topRed ? "S" : "N", m.x, m.y + 21);

    // puck magnet
    c.fillStyle = "#ef4444";
    c.beginPath();
    c.arc(this.puck.x, this.puck.y, 20, Math.PI, 0);
    c.fill();
    c.fillStyle = "#3b82f6";
    c.beginPath();
    c.arc(this.puck.x, this.puck.y, 20, 0, Math.PI);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(this.puck.x, this.puck.y, 20, 0, Math.PI * 2);
    c.stroke();
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
    this.mag = { x: 160, y: 300, pole: 1 };
    this.puck = { x: 400, y: 300, vx: 0, vy: 0, pole: 1 };
    this.holdFrames = 0;
    this.timeLeft = TIME_LIMIT;
    this.ctx.services.hints.reset();
    this.updateReadout();
    this.loop.start();
  }
  destroy(): void {
    this.loop.stop();
    this.detach?.();
  }
}

export const magnetsGame: GameModule = {
  meta: {
    id: "magnets",
    conceptId: "phys-05",
    title: "Pole Position",
    stream: "physics",
    gradeBand: "3",
    emoji: "🧲",
    blurb: "Use attraction and repulsion to steer a magnetic puck into the goal — no touching!",
    mission: "Guide the puck into the goal ring using only magnetic force: flip your poles to pull it close, then push it in.",
    estMinutes: 4,
  },
  create: (ctx) => new Magnets(ctx),
};
