import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const PAD_Y = 500;
const GRAVITY = 0.05;
const THRUST = 0.13;
const NEED = 3;

// Adaptive difficulty: gentler landings + more fuel for juniors, tighter for masters.
const SAFE_BY_TIER = { junior: 3.0, explorer: 2.2, master: 1.6 } as const;
const FUEL_BY_TIER = { junior: 130, explorer: 100, master: 80 } as const;

class Lander implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private readonly safeSpeed: number;
  private readonly startFuel: number;
  private y = 120;
  private vy = 0;
  private fuel = 100;
  private thrusting = false;
  private landed = 0;
  private crashes = 0;
  private flameAnim = 0;
  private ended = false;
  private resting = false; // sitting on pad between landings

  private speedEl!: HTMLElement;
  private fuelEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.safeSpeed = SAFE_BY_TIER[ctx.tier];
    this.startFuel = FUEL_BY_TIER[ctx.tier];
    this.fuel = this.startFuel;
    this.buildPanel();
    ctx.services.hints.setHints([
      "Gravity constantly pulls the lander down, making it fall faster and faster.",
      "Fire the thruster to push back against gravity and slow your fall.",
      "Tap the thruster in short bursts so you touch down gently — land too fast and you'll crash!",
    ]);
    this.loop.start();
    this.render();
  }

  private buildPanel(): void {
    const thrustBtn = el("button", { class: "btn", style: { background: "var(--accent-orange)" } }, "🔥 Hold to thrust") as HTMLButtonElement;
    thrustBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.thrusting = true; });
    thrustBtn.addEventListener("pointerup", () => { this.thrusting = false; });
    thrustBtn.addEventListener("pointerleave", () => { this.thrusting = false; });

    this.speedEl = el("span", {}, "");
    this.fuelEl = el("span", {}, `${Math.round(this.fuel)}%`);
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Hold the thruster to slow your fall and land gently on the pad.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Land softly ${NEED}×`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Fight gravity with thrust"),
      thrustBtn,
      el("div", { class: "metric" }, el("span", {}, "⬇️ Fall speed"), this.speedEl),
      el("div", { class: "metric" }, el("span", {}, "⛽ Fuel"), this.fuelEl),
      el("div", { class: "metric" }, el("span", {}, "🚀 Landings"), this.statusEl),
      this.coachEl,
    );
  }

  private resetLander(): void {
    this.y = 120;
    this.vy = 0;
    this.fuel = this.startFuel;
    this.resting = false;
  }

  private tick(dtMs: number): void {
    if (this.ended || this.resting) return;
    const f = dtMs / 16.67;
    this.flameAnim += 0.3 * f;
    this.vy += GRAVITY * f;
    if (this.thrusting && this.fuel > 0) {
      this.vy -= THRUST * f;
      this.fuel = Math.max(0, this.fuel - 0.6 * f);
    }
    this.y += this.vy * f;

    if (this.y >= PAD_Y) {
      this.y = PAD_Y;
      if (this.vy <= this.safeSpeed) {
        this.softLand();
      } else {
        this.crash();
      }
    }

    this.speedEl.textContent = `${Math.max(0, this.vy).toFixed(1)}`;
    this.speedEl.style.color = this.vy > this.safeSpeed ? "var(--accent-red)" : "var(--accent-green)";
    this.fuelEl.textContent = `${Math.round(this.fuel)}%`;
    this.render();
  }

  private softLand(): void {
    this.landed += 1;
    this.resting = true;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.landed} / ${NEED}`;
    if (this.landed >= NEED) {
      this.win();
    } else {
      this.coachEl.textContent = "🚀 Perfect touchdown! Get ready for the next landing.";
      setTimeout(() => { if (!this.ended) { this.resetLander(); } }, 1000);
    }
  }

  private crash(): void {
    this.crashes += 1;
    this.resting = true;
    this.ctx.services.audio.play("fail");
    this.coachEl.textContent = "💥 Too fast — crash landing! Use the thruster sooner to slow down.";
    setTimeout(() => { if (!this.ended) { this.resetLander(); } }, 1100);
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.crashes === 0 ? 3 : this.crashes <= 2 ? 2 : 1;
    this.ctx.services.score.event("lander_done", { crashes: this.crashes });
    this.ctx.services.outcome.succeed({
      message:
        "Smooth landings! Gravity pulls everything downward, speeding things up as they fall. Thrust pushes back, so short bursts let you touch down gently.",
      stars,
      resources: { Fuel: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#0b1026";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 50; i++) c.fillRect((i * 151) % W, (i * 53) % 460, 2, 2);

    // moon ground + pad
    c.fillStyle = "#475569";
    c.fillRect(0, PAD_Y + 30, W, H - PAD_Y - 30);
    c.fillStyle = "#94a3b8";
    c.fillRect(W / 2 - 70, PAD_Y + 24, 140, 10);
    c.fillStyle = "#22c55e";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("LANDING PAD", W / 2, PAD_Y + 52);

    // lander
    const lx = W / 2;
    c.save();
    c.translate(lx, this.y);
    // flame
    if (this.thrusting && this.fuel > 0 && !this.resting) {
      c.fillStyle = "#fb923c";
      c.beginPath();
      c.moveTo(-8, 16);
      c.lineTo(8, 16);
      c.lineTo(Math.sin(this.flameAnim) * 4, 16 + 22 + Math.random() * 8);
      c.closePath();
      c.fill();
    }
    c.fillStyle = "#e2e8f0";
    c.beginPath();
    c.arc(0, 0, 16, Math.PI, 0);
    c.fill();
    c.fillRect(-16, 0, 32, 16);
    c.fillStyle = "#38bdf8";
    c.beginPath();
    c.arc(0, -2, 7, 0, Math.PI * 2);
    c.fill();
    // legs
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-14, 16); c.lineTo(-20, 26);
    c.moveTo(14, 16); c.lineTo(20, 26);
    c.stroke();
    c.restore();

    // safe-speed indicator
    c.fillStyle = this.vy > this.safeSpeed ? "#fca5a5" : "#86efac";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(this.vy > this.safeSpeed ? "⚠️ Too fast!" : "✓ Safe speed", W / 2, 40);
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
    this.landed = 0;
    this.crashes = 0;
    this.resetLander();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const landerGame: GameModule = {
  meta: {
    id: "lander",
    conceptId: "phys-03",
    title: "Moon Lander",
    stream: "physics",
    gradeBand: "3-5",
    emoji: "🚀",
    blurb: "Fire your thruster against gravity to set the lander down gently.",
    mission: "Land the probe softly three times without crashing.",
    estMinutes: 3,
  },
  create: (ctx) => new Lander(ctx),
};
