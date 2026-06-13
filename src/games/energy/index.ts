import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const GROUND = 500;
const X0 = 110; // launch x
const G = 0.4; // gravity (px/frame^2 in 60fps units)
const NEED = 3; // targets to hit

class Energy implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private charge = 40; // 0..100 stored (potential) energy from pulling back
  private flying = false;
  private px = X0;
  private py = GROUND;
  private vx = 0;
  private vy = 0;
  private launchE = 1; // total mechanical energy at launch (for bar scaling)
  private target = { x: 500, w: 90 };
  private hits = 0;
  private misses = 0;
  private anim = 0;
  private ended = false;
  private trail: { x: number; y: number }[] = [];

  private chargeEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private launchBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.placeTarget();
    this.buildPanel();
    ctx.services.hints.setHints([
      "A pulled-back catapult stores potential energy — energy waiting to be used. Releasing turns it into kinetic energy, the energy of motion.",
      "More pull-back stores more energy, so the rock launches faster and flies farther.",
      "Watch the bars: at launch it's nearly all kinetic. As it rises, kinetic turns into potential; falling turns it back. Total energy stays the same.",
    ]);
    this.loop.start();
    this.render();
  }

  private placeTarget(): void {
    this.target.x = 320 + Math.random() * 360;
    this.target.w = byTier(this.ctx.tier, 120, 90, 64);
  }

  private buildPanel(): void {
    const chargeSlider = el("input", {
      type: "range",
      min: "10",
      max: "100",
      value: String(this.charge),
      "aria-label": "Pull back",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        if (this.flying) return;
        this.charge = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.launchBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.launch() },
      "🚀 Release!",
    ) as HTMLButtonElement;

    this.chargeEl = el("span", {}, "40%");
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Pull back to store energy, then release to fling the rock at the target.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Hit ${NEED} targets`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "💪 Pull back (stored energy)"),
      chargeSlider,
      this.launchBtn,
      el("div", { class: "metric" }, el("span", {}, "🔋 Stored"), this.chargeEl),
      el("div", { class: "metric" }, el("span", {}, "🎯 Hits"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.chargeEl.textContent = `${this.charge}%`;
  }

  private launch(): void {
    if (this.ended || this.flying) return;
    // Stored (potential) energy becomes speed (kinetic energy). Launch at 45°.
    const v = 4 + (this.charge / 100) * 13;
    this.vx = v * Math.SQRT1_2;
    this.vy = -v * Math.SQRT1_2;
    this.px = X0;
    this.py = GROUND;
    this.flying = true;
    this.trail = [];
    this.launchE = 0.5 * v * v; // total energy reference (PE=0 at ground)
    this.launchBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.anim += 0.05 * f;

    if (this.flying) {
      this.vy += G * f;
      this.px += this.vx * f;
      this.py += this.vy * f;
      this.trail.push({ x: this.px, y: this.py });
      if (this.trail.length > 60) this.trail.shift();

      if (this.py >= GROUND) {
        this.py = GROUND;
        this.flying = false;
        this.launchBtn.disabled = false;
        const hit = this.px >= this.target.x && this.px <= this.target.x + this.target.w;
        if (hit) {
          this.hits += 1;
          this.ctx.services.audio.play("tick");
          this.coachEl.textContent = "🎯 Direct hit! All that stored energy became motion.";
          this.statusEl.textContent = `${this.hits} / ${NEED}`;
          if (this.hits >= NEED) {
            this.finish();
          } else {
            this.placeTarget();
          }
        } else {
          this.misses += 1;
          this.ctx.services.audio.play("fail");
          this.coachEl.textContent =
            this.px < this.target.x
              ? "Fell short — store more energy by pulling back further."
              : "Overshot — ease off the pull-back a little.";
        }
      } else if (this.px > W + 20) {
        // flew off-screen
        this.flying = false;
        this.launchBtn.disabled = false;
        this.misses += 1;
        this.ctx.services.audio.play("fail");
        this.coachEl.textContent = "Way too much energy — pull back less.";
        this.placeTarget();
      }
    }
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("energy_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Bullseye! Stored (potential) energy in the pulled-back arm became kinetic energy of motion — and in flight the two kept trading back and forth.",
      stars,
      resources: { Fuel: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#dbeafe";
    c.fillRect(0, 0, W, GROUND);
    c.fillStyle = "#86efac";
    c.fillRect(0, GROUND, W, H - GROUND);

    // target
    c.fillStyle = "#ef4444";
    c.fillRect(this.target.x, GROUND - 10, this.target.w, 10);
    c.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) {
      c.fillRect(this.target.x + i * (this.target.w / 3), GROUND - 10, this.target.w / 6, 10);
    }
    c.fillStyle = "#b91c1c";
    c.font = "20px serif";
    c.textAlign = "center";
    c.fillText("🎯", this.target.x + this.target.w / 2, GROUND - 18);

    // catapult arm reflecting charge (pull-back angle)
    const armAngle = -0.3 - (this.charge / 100) * 1.0;
    c.strokeStyle = "#92400e";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(X0, GROUND);
    c.lineTo(X0 + Math.cos(armAngle) * 50, GROUND + Math.sin(armAngle) * 50);
    c.stroke();
    c.fillStyle = "#78350f";
    c.fillRect(X0 - 12, GROUND - 6, 24, 14);

    // trail
    c.strokeStyle = "rgba(249,115,22,0.5)";
    c.lineWidth = 3;
    c.beginPath();
    this.trail.forEach((t, i) => (i === 0 ? c.moveTo(t.x, t.y) : c.lineTo(t.x, t.y)));
    c.stroke();

    // projectile
    c.fillStyle = "#57534e";
    c.beginPath();
    c.arc(this.flying ? this.px : X0 + Math.cos(armAngle) * 50, this.flying ? this.py : GROUND + Math.sin(armAngle) * 50 - 8, 12, 0, Math.PI * 2);
    c.fill();

    // energy bars: KE (motion) and PE (height)
    this.drawEnergyBars(c);
  }

  private drawEnergyBars(c: CanvasRenderingContext2D): void {
    const v2 = this.vx * this.vx + this.vy * this.vy;
    const height = Math.max(0, GROUND - this.py);
    let ke: number;
    let pe: number;
    if (this.flying) {
      ke = 0.5 * v2;
      pe = G * height; // proportional to gravitational PE
    } else {
      // not flying: charge represents stored (potential) energy, no motion
      ke = 0;
      pe = (this.charge / 100) * this.launchE;
    }
    const total = this.flying ? this.launchE : Math.max(0.001, (this.charge / 100) * this.launchE || 1);
    const keFrac = this.flying ? Math.min(1, ke / this.launchE) : 0;
    const peFrac = this.flying ? Math.min(1, pe / this.launchE) : 1;

    const bx = 600;
    const by = 60;
    const bw = 150;
    const bh = 22;
    // label
    c.fillStyle = "#1e293b";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(this.flying ? "Kinetic (motion)" : "Stored (potential)", bx, by - 8);
    c.fillStyle = "rgba(255,255,255,0.7)";
    this.roundRect(c, bx, by, bw, bh, 8);
    c.fill();
    c.fillStyle = "#ff9f1c";
    this.roundRect(c, bx, by, bw * (this.flying ? keFrac : 0), bh, 8);
    c.fill();
    if (!this.flying) {
      c.fillStyle = "#9b6bff";
      this.roundRect(c, bx, by, bw * (this.charge / 100), bh, 8);
      c.fill();
    }

    c.fillStyle = "#1e293b";
    c.fillText("Potential (height)", bx, by + 38);
    c.fillStyle = "rgba(255,255,255,0.7)";
    this.roundRect(c, bx, by + 46, bw, bh, 8);
    c.fill();
    c.fillStyle = "#9b6bff";
    this.roundRect(c, bx, by + 46, bw * (this.flying ? peFrac : 0), bh, 8);
    c.fill();

    void total;
    void pe;
    void ke;
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    if (w <= 0) return;
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
    this.charge = 40;
    this.flying = false;
    this.hits = 0;
    this.misses = 0;
    this.trail = [];
    this.placeTarget();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const energyGame: GameModule = {
  meta: {
    id: "energy",
    conceptId: "phys-25",
    title: "Stored & Unleashed",
    stream: "physics",
    gradeBand: "4-6",
    emoji: "🎯",
    blurb: "Store energy in a catapult, then release it as motion to hit the target.",
    mission: "Convert stored energy into motion to land three direct hits.",
    estMinutes: 3,
  },
  create: (ctx) => new Energy(ctx),
};
