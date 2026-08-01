import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Momentum (MS-PS2): in a collision, momentum (mass × velocity) is conserved.
// Cart A hits a parked cart B and they stick together, so the combined speed is
// v = (mA·vA)/(mA+mB). Pick A's mass and speed so the wreck coasts into the
// target zone. Predict the combined speed, then crash.

const W = 800;
const H = 600;
const TRACK_Y = 380;
const START_X = 90;
const HIT_X = 360;
const SCALE = 34; // px the wreck travels per unit of combined speed

interface Round {
  massB: number;
  targetV: number; // required combined speed to reach the zone
}
const ROUNDS: Round[] = [
  { massB: 4, targetV: 3 },
  { massB: 6, targetV: 4 },
  { massB: 5, targetV: 5 },
];

class CrashTest implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private massA = 4;
  private speedA = 5;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private phase: "idle" | "approach" | "coast" = "idle";
  private aX = START_X;
  private wreckX = HIT_X;
  private wreckV = 0;
  private acc = 0;

  private massCtl!: SliderHandle;
  private speedCtl!: SliderHandle;
  private vfRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 0.8, 0.5, 0.3);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Momentum = mass × velocity. In a crash the total momentum before equals the total after.",
      "When the carts stick, the shared speed is (massA × speedA) ÷ (massA + massB). More mass or speed in A means a faster wreck.",
      "Work out the combined speed you need to reach the zone, then pick a mass and speed that give it.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private combinedV(): number {
    return (this.massA * this.speedA) / (this.massA + this.round().massB);
  }
  private zoneX(): number {
    return HIT_X + this.round().targetV * SCALE;
  }
  private zoneW(): number {
    return this.tol * SCALE * 2;
  }

  private buildPanel(): void {
    this.massCtl = slider({
      label: "🚚 Cart A mass",
      min: 2,
      max: 10,
      value: this.massA,
      step: 1,
      unit: "kg",
      color: "var(--accent-red)",
      onInput: (v) => {
        this.massA = v;
        this.updateReadout();
      },
    });
    this.speedCtl = slider({
      label: "💨 Cart A speed",
      min: 2,
      max: 10,
      value: this.speedA,
      step: 0.5,
      unit: "m/s",
      color: "var(--accent-orange)",
      onInput: (v) => {
        this.speedA = v;
        this.updateReadout();
      },
    });
    this.vfRead = readout("🤝 Combined speed");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.hits} / ${ROUNDS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent =
      "Pick a mass and speed for cart A, predict the wreck's speed, then crash!";
    this.goBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.crash() },
      "💥 Crash!"
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Target"),
        el("span", {}, `Wreck speed ${this.round().targetV} m/s`)
      ),
      this.massCtl.el,
      this.speedCtl.el,
      el(
        "div",
        { class: "control-label", style: { marginTop: "6px" } },
        "🤝 v = (mA × vA) ÷ (mA + mB)"
      ),
      this.vfRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Crashes nailed"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const r = this.round();
    this.vfRead.set(
      `${this.massA}×${this.speedA} ÷ ${this.massA + r.massB} = ${this.combinedV().toFixed(1)} m/s`
    );
  }

  private crash(): void {
    if (this.ended || this.phase !== "idle") return;
    this.aX = START_X;
    this.wreckX = HIT_X;
    this.wreckV = 0;
    this.phase = "approach";
    this.acc = 0;
    this.massCtl.setEnabled(false);
    this.speedCtl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    this.acc += dtMs;
    let steps = 0;
    while (this.acc >= 16.67 && steps < 30) {
      if (this.phase === "idle") {
        this.acc = 0;
        break;
      }
      this.step();
      this.acc -= 16.67;
      steps++;
    }
    this.render();
  }

  private step(): void {
    if (this.phase === "approach") {
      this.aX += this.speedA;
      if (this.aX >= HIT_X - 26) {
        this.aX = HIT_X - 26;
        this.wreckV = this.combinedV();
        this.phase = "coast";
        this.ctx.services.audio.play("tick");
      }
    } else if (this.phase === "coast") {
      this.wreckX += this.wreckV;
      this.wreckV = Math.max(0, this.wreckV - 0.06);
      if (this.wreckV <= 0.02) {
        this.phase = "idle";
        this.massCtl.setEnabled(true);
        this.speedCtl.setEnabled(true);
        this.goBtn.disabled = false;
        this.evaluate();
      }
    }
  }

  private evaluate(): void {
    const vf = this.combinedV();
    const r = this.round();
    if (Math.abs(vf - r.targetV) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.wreckX = HIT_X;
        this.aX = START_X;
        this.coachEl.textContent = "💥 Bullseye! Next crash — cart B's mass changed, so recompute.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        vf < r.targetV
          ? "Wreck was too slow — add mass or speed to cart A for more momentum."
          : "Wreck overshot — less mass or speed so the combined speed drops.";
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("crashtest_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Crash master! Momentum (mass × velocity) is conserved: when carts stick, they share the combined momentum, so the wreck's speed is (mA·vA)/(mA+mB).",
      stars,
      resources: { Fuel: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Every crash on target! 💥", W / 2, H / 2);
      return;
    }

    // track + target zone
    c.fillStyle = "#fed7aa";
    c.fillRect(0, TRACK_Y + 18, W, 8);
    c.fillStyle = "rgba(34,197,94,0.3)";
    c.fillRect(this.zoneX() - this.zoneW() / 2, TRACK_Y - 30, this.zoneW(), 60);
    c.strokeStyle = "#16a34a";
    c.lineWidth = 3;
    c.strokeRect(this.zoneX() - this.zoneW() / 2, TRACK_Y - 30, this.zoneW(), 60);
    c.fillStyle = "#15803d";
    c.font = "13px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🎯 zone", this.zoneX(), TRACK_Y + 52);

    const stuck = this.phase === "coast" || (this.phase === "idle" && this.wreckX > HIT_X + 1);
    // cart B / wreck
    c.fillStyle = "#3b82f6";
    c.fillRect(this.wreckX - 22, TRACK_Y - 26, 44, 44);
    c.fillStyle = "#fff";
    c.font = "bold 14px Nunito, sans-serif";
    c.fillText(`${this.round().massB}`, this.wreckX, TRACK_Y + 2);
    // cart A
    if (!stuck || this.phase === "approach") {
      c.fillStyle = "#ef4444";
      c.fillRect(this.aX - 22, TRACK_Y - 26, 44, 44);
      c.fillStyle = "#fff";
      c.fillText(`${this.massA}`, this.aX, TRACK_Y + 2);
    } else {
      // draw the A cart stuck to the wreck
      c.fillStyle = "#ef4444";
      c.fillRect(this.wreckX - 46, TRACK_Y - 26, 44, 44);
    }

    c.fillStyle = "#9a3412";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Crash cart A into cart B so the wreck stops in the zone 💥", W / 2, 44);
    c.font = "14px Nunito, sans-serif";
    c.fillText(
      `wreck speed: ${this.phase === "coast" ? this.wreckV.toFixed(1) : "0.0"} m/s`,
      W / 2,
      70
    );
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
    this.phase = "idle";
    this.massA = 4;
    this.speedA = 5;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.aX = START_X;
    this.wreckX = HIT_X;
    this.wreckV = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const crashTestGame: GameModule = {
  meta: {
    id: "crashtest",
    conceptId: "phys-28",
    title: "Crash Test",
    stream: "physics",
    gradeBand: "6-8",
    emoji: "💥",
    blurb: "Pick a cart's mass and speed so momentum carries the wreck into the zone.",
    mission: "Use conservation of momentum to land the stuck carts in each target zone.",
    estMinutes: 4,
  },
  create: (ctx) => new CrashTest(ctx),
};
