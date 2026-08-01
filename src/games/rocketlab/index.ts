import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider, type SliderHandle } from "@core/controls";
import { drawLineGraph } from "@core/graph";
import { byTier } from "@core/difficulty";

// Newton's 2nd law (F = ma) sandbox. The learner engineers a launch — set the
// thrust (force) and rocket mass so the predicted acceleration a = F/m carries
// the rocket to the target speed by the end of the burn. Predict (sliders show
// a and final v live) → run (watch the v–t graph fill in) → reveal.

const W = 800;
const H = 600;
const PAD_Y = H - 90;

interface Round {
  targetV: number; // m/s to reach by end of burn
  burn: number; // seconds of engine burn
}
const ROUNDS: Round[] = [
  { targetV: 30, burn: 5 }, // a = 6
  { targetV: 48, burn: 6 }, // a = 8
  { targetV: 40, burn: 4 }, // a = 10
];

class RocketLab implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private force = 600; // N
  private mass = 120; // kg
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private launching = false;
  private t = 0;
  private v = 0;
  private rocketY = PAD_Y;
  private points: [number, number][] = [];
  private acc = 0;

  private thrustCtl!: SliderHandle;
  private massCtl!: SliderHandle;
  private aRead!: { el: HTMLElement; set(v: string): void };
  private vRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private launchBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 4, 2.5, 1.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Newton's 2nd law: acceleration = force ÷ mass (a = F ÷ m). More force speeds up faster; more mass is harder to push.",
      "Final speed = acceleration × burn time. So you need a = target speed ÷ burn time.",
      "Work out the acceleration you need, then pick a thrust and mass whose F ÷ m equals it.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private accel(): number {
    return this.force / this.mass;
  }

  private buildPanel(): void {
    this.thrustCtl = slider({
      label: "🔥 Thrust (force)",
      min: 100,
      max: 1500,
      value: this.force,
      step: 50,
      unit: "N",
      color: "var(--accent-red)",
      onInput: (val) => {
        this.force = val;
        this.updatePrediction();
        this.render();
      },
    });
    this.massCtl = slider({
      label: "🪨 Rocket mass",
      min: 50,
      max: 400,
      value: this.mass,
      step: 10,
      unit: "kg",
      color: "var(--accent-blue)",
      onInput: (val) => {
        this.mass = val;
        this.updatePrediction();
        this.render();
      },
    });

    this.aRead = readout("⚡ Acceleration (F ÷ m)");
    this.vRead = readout("🎯 Predicted final speed");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.hits} / ${ROUNDS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#f5f3ff" },
    });
    this.coachEl.textContent = "Set the thrust and mass, predict the speed, then launch!";

    this.launchBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.launch() },
      "🚀 Launch"
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Mission"),
        el("span", {}, `Reach ${this.round().targetV} m/s in ${this.round().burn}s`)
      ),
      this.thrustCtl.el,
      this.massCtl.el,
      this.aRead.el,
      this.vRead.el,
      this.launchBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Launches nailed"), this.statusEl),
      this.coachEl
    );
    this.updatePrediction();
  }

  private updatePrediction(): void {
    const a = this.accel();
    const predV = a * this.round().burn;
    this.aRead.set(`${a.toFixed(1)} m/s²`);
    this.vRead.set(`${predV.toFixed(0)} m/s`);
  }

  private launch(): void {
    if (this.ended || this.launching) return;
    this.launching = true;
    this.t = 0;
    this.v = 0;
    this.rocketY = PAD_Y;
    this.points = [[0, 0]];
    this.acc = 0;
    this.thrustCtl.setEnabled(false);
    this.massCtl.setEnabled(false);
    this.launchBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.launching) {
      // Fixed 16.67ms steps → deterministic, frame-rate independent.
      this.acc += dtMs;
      let steps = 0;
      while (this.launching && this.acc >= 16.67 && steps < 30) {
        this.step(16.67 / 1000);
        this.acc -= 16.67;
        steps++;
      }
    }
    this.render();
  }

  private step(dt: number): void {
    const a = this.accel();
    this.v += a * dt;
    this.t += dt;
    this.rocketY = Math.max(70, this.rocketY - this.v * dt * 4);
    this.points.push([this.t, this.v]);
    if (this.t >= this.round().burn) {
      this.launching = false;
      this.evaluate();
    }
  }

  private evaluate(): void {
    const finalV = this.v;
    const target = this.round().targetV;
    this.thrustCtl.setEnabled(true);
    this.massCtl.setEnabled(true);
    this.launchBtn.disabled = false;
    if (Math.abs(finalV - target) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("tick");
      if (this.hits >= ROUNDS.length) {
        this.finish();
      } else {
        // Reset the rocket + graph to the pad so the next mission starts clean
        // (otherwise the rocket sits stuck at the top with the old graph).
        this.idx += 1;
        this.v = 0;
        this.t = 0;
        this.rocketY = PAD_Y;
        this.points = [];
        this.coachEl.textContent = `🚀 Orbit reached at ${finalV.toFixed(0)} m/s! Next mission — pick a new thrust and mass.`;
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        finalV > target
          ? `Too fast (${finalV.toFixed(0)} m/s). Lower the thrust or add mass to shrink a = F ÷ m.`
          : `Too slow (${finalV.toFixed(0)} m/s). Raise the thrust or drop mass to grow a = F ÷ m.`;
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("rocketlab_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Mission control! You used Newton's 2nd law — acceleration = force ÷ mass — to engineer every launch. More thrust or less mass = more acceleration.",
      stars,
      resources: { Fuel: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b1026");
    grad.addColorStop(0.6, "#1e3a8a");
    grad.addColorStop(1, "#3b82f6");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#fff";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All systems go! 🚀", W / 2, H / 2);
      return;
    }

    // stars
    c.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 40; i++) {
      const sxv = (i * 97) % W;
      const syv = (i * 53) % (H - 120);
      c.fillRect(sxv, syv, 2, 2);
    }

    // launch pad
    c.fillStyle = "#475569";
    c.fillRect(120, PAD_Y + 20, 90, 16);

    // target altitude line + label
    c.strokeStyle = "rgba(34,197,94,0.7)";
    c.setLineDash([8, 6]);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(60, 90);
    c.lineTo(300, 90);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#bbf7d0";
    c.font = "bold 13px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("🛰️ orbit", 64, 84);

    // rocket
    const rx = 165;
    c.font = "44px serif";
    c.textAlign = "center";
    c.save();
    c.translate(rx, this.rocketY);
    c.fillText("🚀", 0, 0);
    c.restore();
    // flame while burning
    if (this.launching) {
      c.fillStyle = "rgba(251,191,36,0.9)";
      c.beginPath();
      const flame = 14 + Math.abs(Math.sin(this.t * 20)) * 12;
      c.moveTo(rx - 9, this.rocketY + 6);
      c.lineTo(rx + 9, this.rocketY + 6);
      c.lineTo(rx, this.rocketY + 6 + flame);
      c.closePath();
      c.fill();
    }

    // current speed readout
    c.fillStyle = "#fff";
    c.font = "bold 22px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`Speed: ${this.v.toFixed(0)} m/s`, 60, H - 30);
    c.font = "13px Nunito, sans-serif";
    c.fillStyle = "#cbd5e1";
    c.fillText(`t = ${this.t.toFixed(1)} s`, 60, H - 12);

    // velocity–time graph (top-right)
    const tg = this.round();
    drawLineGraph(c, 470, 70, 310, 190, {
      points: this.points,
      xMax: tg.burn,
      yMax: Math.max(tg.targetV * 1.4, 20),
      color: "#f59e0b",
      title: "Speed vs time",
      xLabel: "time (s)",
      yLabel: "m/s",
      band: { lo: tg.targetV - this.tol, hi: tg.targetV + this.tol },
    });
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
    this.launching = false;
    this.force = 600;
    this.mass = 120;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.t = 0;
    this.v = 0;
    this.rocketY = PAD_Y;
    this.points = [];
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const rocketLabGame: GameModule = {
  meta: {
    id: "rocketlab",
    conceptId: "phys-26",
    title: "Rocket Lab",
    stream: "physics",
    gradeBand: "6-8",
    emoji: "🚀",
    blurb: "Engineer a launch with Newton's 2nd law — balance thrust and mass to hit orbit speed.",
    mission: "Use a = F ÷ m to reach each target speed by the end of the burn.",
    estMinutes: 4,
  },
  create: (ctx) => new RocketLab(ctx),
};
