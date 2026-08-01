import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const TRACK_Y = 360;
const R = 16;
const CHAIN_X = 380; // first chain ball
const NEED = 3;
const FRICTION = 0.06; // deceleration of the freed ball

class Collisions implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private speed = 4.0; // launch speed (slider/10)
  private cueX = 100;
  private cueV = 0;
  private endX = CHAIN_X + 3 * (R * 2); // the last ball in the chain
  private endV = 0;
  private transferred = false;
  private flash = 0;
  private moving = false;
  private pocket = { x: 600, w: 70 };
  private hits = 0;
  private misses = 0;
  private ended = false;

  private speedEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private launchBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.pocket.w = byTier(ctx.tier, 95, 70, 50);
    this.placePocket();
    this.buildPanel();
    ctx.services.hints.setHints([
      "When a moving object hits a still one, it passes its motion on — that's how its energy travels forward.",
      "With a line of equal balls, the motion passes straight through: only the ball on the far end moves off!",
      "More launch speed sends the end ball farther. Pick a speed that drops it right into the pocket.",
    ]);
    this.loop.start();
    this.render();
  }

  private placePocket(): void {
    this.pocket.x = 540 + Math.random() * 180;
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "20",
      max: "75",
      value: String(this.speed * 10),
      "aria-label": "Launch speed",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        if (this.moving) return;
        this.speed = Number((e.target as HTMLInputElement).value) / 10;
        this.updateReadout();
      },
    });
    this.launchBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.launch() },
      "🎱 Launch"
    );

    this.speedEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Set a launch speed, then send the cue ball into the chain.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Sink ${NEED} shots`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🚀 Launch speed"),
      slider,
      this.launchBtn,
      el("div", { class: "metric" }, el("span", {}, "⚡ Speed"), this.speedEl),
      el("div", { class: "metric" }, el("span", {}, "🥅 Sunk"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.speedEl.textContent = `${this.speed.toFixed(1)}`;
  }

  private launch(): void {
    if (this.ended || this.moving) return;
    this.cueX = 100;
    this.cueV = this.speed;
    this.endV = 0;
    this.endX = CHAIN_X + 3 * (R * 2);
    this.transferred = false;
    this.moving = true;
    this.launchBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.06 * f);

    if (this.moving) {
      if (!this.transferred) {
        this.cueX += this.cueV * f;
        if (this.cueX + R >= CHAIN_X - R) {
          // motion passes through the chain to the end ball (equal masses)
          this.cueX = CHAIN_X - R - R;
          this.cueV = 0;
          this.endV = this.speed;
          this.transferred = true;
          this.flash = 1;
          this.ctx.services.audio.play("tick");
        }
      } else {
        this.endX += this.endV * f;
        this.endV = Math.max(0, this.endV - FRICTION * f);
        if (this.endV <= 0.02) {
          this.moving = false;
          this.launchBtn.disabled = false;
          const inPocket = this.endX >= this.pocket.x && this.endX <= this.pocket.x + this.pocket.w;
          if (inPocket) {
            this.hits += 1;
            this.ctx.services.audio.play("reward");
            this.coachEl.textContent =
              "🥅 Sunk it! The cue's motion passed straight through to the end ball.";
            this.statusEl.textContent = `${this.hits} / ${NEED}`;
            if (this.hits >= NEED) {
              this.finish();
            } else {
              // Reset the table to its starting layout for the next shot, so the
              // balls are visibly ready (don't wait for the next Launch click).
              this.placePocket();
              this.cueX = 100;
              this.cueV = 0;
              this.endX = CHAIN_X + 3 * (R * 2);
              this.endV = 0;
              this.transferred = false;
            }
          } else {
            this.misses += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent =
              this.endX < this.pocket.x
                ? "Fell short — give it more launch speed."
                : "Rolled too far — ease off the speed.";
          }
        }
      }
    }
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("collisions_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Great shots! When a moving ball hits a line of resting ones, it passes its motion straight through — the far ball rolls off with that energy.",
      stars,
      resources: { Fuel: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#14532d";
    c.fillRect(0, 0, W, H);
    // felt table
    c.fillStyle = "#166534";
    c.fillRect(40, TRACK_Y - 60, W - 80, 160);

    // pocket
    c.fillStyle = "#052e16";
    this.roundRect(c, this.pocket.x, TRACK_Y + 10, this.pocket.w, 24, 8);
    c.fill();
    c.fillStyle = "#bbf7d0";
    c.font = "14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🥅 pocket", this.pocket.x + this.pocket.w / 2, TRACK_Y + 52);

    // chain of 4 balls (middle ones stay put)
    for (let i = 0; i < 4; i++) {
      const x = CHAIN_X + i * (R * 2);
      const isEnd = i === 3;
      const drawX = isEnd && this.transferred ? this.endX : x;
      if (isEnd && this.transferred) continue; // drawn separately below
      c.fillStyle = this.flash > 0 ? `rgba(253,224,71,${0.4 + this.flash * 0.6})` : "#e2e8f0";
      c.beginPath();
      c.arc(drawX, TRACK_Y, R, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#94a3b8";
      c.lineWidth = 2;
      c.stroke();
    }
    // the freed end ball
    c.fillStyle = "#f59e0b";
    c.beginPath();
    c.arc(this.endX, TRACK_Y, R, 0, Math.PI * 2);
    c.fill();

    // cue ball
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(this.cueX, TRACK_Y, R, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#cbd5e1";
    c.lineWidth = 2;
    c.stroke();

    // aim arrow when idle
    if (!this.moving) {
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(this.cueX + R, TRACK_Y);
      c.lineTo(this.cueX + R + 20 + this.speed * 6, TRACK_Y);
      c.stroke();
    }

    c.fillStyle = "#dcfce7";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Pass the motion through the chain into the pocket 🎱", W / 2, 50);
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
    this.speed = 4.0;
    this.cueX = 100;
    this.cueV = 0;
    this.endX = CHAIN_X + 3 * (R * 2);
    this.endV = 0;
    this.transferred = false;
    this.moving = false;
    this.hits = 0;
    this.misses = 0;
    this.placePocket();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const collisionsGame: GameModule = {
  meta: {
    id: "collisions",
    conceptId: "phys-24",
    title: "Chain Reaction",
    stream: "physics",
    gradeBand: "4",
    emoji: "🎱",
    blurb: "Launch the cue so its motion passes through the chain and sinks the end ball.",
    mission: "Transfer momentum through the balls to sink three shots in the pocket.",
    estMinutes: 3,
  },
  create: (ctx) => new Collisions(ctx),
};
