import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { ParticleSystem } from "@core/particles";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const SEA_Y = 440;
const LAND_X = 470; // left of this is ocean, right is land/mountain

type Phase = "evaporate" | "drift" | "rain" | "collect" | "ended";

const STAGE_LABEL: Record<Phase, string> = {
  evaporate: "1. Evaporation",
  drift: "2. Condensation",
  rain: "3. Precipitation",
  collect: "4. Collection",
  ended: "Complete",
};

class WaterCycle implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly vapor = new ParticleSystem();
  private readonly rain = new ParticleSystem();

  private heat = 40;
  private phase: Phase = "evaporate";
  private cloudFill = 0; // 0..1
  private cloudX = 250;
  private cloudVx = 0;
  private collected = 0; // 0..1
  private failed = false;

  private stageEl!: HTMLElement;
  private cloudEl!: HTMLElement;
  private collectEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private windBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "The Sun's heat turns ocean water into invisible vapor that rises into the sky.",
      "Vapor cools and condenses into a cloud. Wind carries the cloud over the land.",
      "Heat the ocean until the cloud is full, blow it over the mountains, let it rain, then watch it collect and flow back.",
    ]);
    this.loop.start();
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.heat),
      "aria-label": "Sun heat",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        this.heat = Number((e.target as HTMLInputElement).value);
      },
    });

    this.windBtn = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          if (this.phase === "drift" || this.phase === "evaporate") {
            this.cloudVx += 0.8;
            this.ctx.services.audio.play("click");
          }
        },
      },
      "🌬️ Blow Wind →",
    ) as HTMLButtonElement;

    this.stageEl = el("span", { style: { color: "var(--accent-blue)" } }, STAGE_LABEL.evaporate);
    this.cloudEl = el("span", { style: { color: "#64748b" } }, "0%");
    this.collectEl = el("span", { style: { color: "var(--accent-blue)" } }, "0%");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "📍 Stage"),
        this.stageEl,
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "☀️ Sun Heat"),
      slider,
      this.windBtn,
      el("div", { class: "metric" }, el("span", {}, "☁️ Cloud"), this.cloudEl),
      el("div", { class: "metric" }, el("span", {}, "💧 Collected"), this.collectEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.stageEl.textContent = STAGE_LABEL[this.phase];
    this.cloudEl.textContent = `${Math.round(this.cloudFill * 100)}%`;
    this.collectEl.textContent = `${Math.round(this.collected * 100)}%`;
    let msg = "";
    switch (this.phase) {
      case "evaporate":
        msg = this.heat < 20 ? "🌥️ Turn up the Sun — water needs heat to evaporate." : "♨️ Vapor is rising and forming a cloud!";
        break;
      case "drift":
        msg = "☁️ Cloud is full! Blow it over the mountains on the right.";
        break;
      case "rain":
        msg = "🌧️ It's raining over the land!";
        break;
      case "collect":
        msg = "🏞️ Rain is flowing back to the ocean — the cycle is closing.";
        break;
      case "ended":
        msg = "✅ Cycle complete!";
        break;
    }
    this.coachEl.textContent = msg;
  }

  private tick(dtMs: number): void {
    if (this.phase === "ended") return;
    const f = dtMs / 16.67;

    // cloud drift
    this.cloudX += this.cloudVx * f;
    this.cloudVx *= 0.96;
    if (this.cloudX < 120) {
      this.cloudX = 120;
      this.cloudVx = 0;
    }

    if (this.phase === "evaporate") {
      const rate = (this.heat / 100) * 0.006 * f;
      this.cloudFill = Math.min(1, this.cloudFill + rate);
      if (this.heat > 15 && Math.random() < this.heat / 140) {
        this.vapor.spawn({
          kind: "v",
          x: 80 + Math.random() * (LAND_X - 120),
          y: SEA_Y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -1 - Math.random(),
          size: 5 + Math.random() * 4,
        });
      }
      if (this.cloudFill >= 1) this.phase = "drift";
    } else if (this.phase === "drift") {
      if (this.cloudX > LAND_X + 60) this.phase = "rain";
    } else if (this.phase === "rain") {
      this.cloudFill = Math.max(0, this.cloudFill - 0.004 * f);
      this.collected = Math.min(1, this.collected + 0.004 * f);
      if (Math.random() < 0.6) {
        this.rain.spawn({
          kind: "r",
          x: this.cloudX + (Math.random() - 0.5) * 120,
          y: 180,
          vx: 0,
          vy: 4 + Math.random() * 2,
          size: 4,
        });
      }
      if (this.cloudFill <= 0) this.phase = "collect";
    } else if (this.phase === "collect") {
      this.collected = Math.min(1, this.collected + 0.01 * f);
      if (this.collected >= 1) this.win();
    }

    // blew off the right edge before raining → failed cycle
    if ((this.phase === "drift" || this.phase === "evaporate") && this.cloudX > W - 40) this.lose();

    this.vapor.update(0.012);
    this.rain.update(0.02);
    // cull rain below ground
    for (let i = this.rain.particles.length - 1; i >= 0; i--) {
      if (this.rain.particles[i].y > SEA_Y) this.rain.particles.splice(i, 1);
    }

    this.updateReadout();
    this.render();
  }

  private win(): void {
    this.phase = "ended";
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("watercycle_complete", {});
    this.ctx.services.outcome.succeed({
      message: "You completed the water cycle! Evaporation → condensation → precipitation → collection, round and round.",
      stars,
      resources: { Water: 50 },
    });
  }

  private lose(): void {
    this.phase = "ended";
    this.failed = true;
    this.loop.stop();
    this.ctx.services.outcome.fail({
      message: "The cloud blew out past the land before it rained — the land got no water. Use gentler puffs of wind.",
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky
    const sky = c.createLinearGradient(0, 0, 0, SEA_Y);
    sky.addColorStop(0, "#38bdf8");
    sky.addColorStop(1, "#bae6fd");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, SEA_Y);

    // sun (brightness from heat)
    c.globalAlpha = 0.5 + (this.heat / 100) * 0.5;
    c.fillStyle = "#fde047";
    c.beginPath();
    c.arc(700, 90, 45 + (this.heat / 100) * 12, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // land + mountain (right)
    c.fillStyle = "#16a34a";
    c.fillRect(LAND_X, SEA_Y - 1, W - LAND_X, H - SEA_Y);
    c.fillStyle = "#15803d";
    c.beginPath();
    c.moveTo(LAND_X + 40, SEA_Y);
    c.lineTo(640, 250);
    c.lineTo(W, SEA_Y);
    c.closePath();
    c.fill();

    // ocean (left)
    c.fillStyle = "#0369a1";
    c.fillRect(0, SEA_Y, LAND_X, H - SEA_Y);

    // vapor
    for (const p of this.vapor.particles) {
      c.globalAlpha = p.life * 0.5;
      c.fillStyle = "#e0f2fe";
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // cloud
    if (this.cloudFill > 0.08) {
      const cy = 150;
      const darkness = 1 - this.cloudFill * 0.5;
      c.fillStyle = `rgb(${Math.round(255 * darkness)},${Math.round(255 * darkness)},${Math.round(255 * darkness)})`;
      const scale = 0.5 + this.cloudFill * 0.6;
      for (const [dx, dy, r] of [
        [-50, 6, 34],
        [0, -10, 44],
        [50, 6, 34],
        [22, 14, 30],
        [-22, 14, 30],
      ] as const) {
        c.beginPath();
        c.arc(this.cloudX + dx * scale, cy + dy, r * scale, 0, Math.PI * 2);
        c.fill();
      }
    }

    // rain
    c.strokeStyle = "#38bdf8";
    c.lineWidth = 2;
    for (const p of this.rain.particles) {
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x, p.y + 8);
      c.stroke();
    }

    // collected river on the mountain
    if (this.collected > 0) {
      c.strokeStyle = "#38bdf8";
      c.lineWidth = 4 + this.collected * 6;
      c.beginPath();
      c.moveTo(640, 250);
      c.lineTo(560, 360);
      c.lineTo(LAND_X, SEA_Y);
      c.stroke();
    }

    if (this.failed) {
      c.fillStyle = "rgba(0,0,0,0.2)";
      c.fillRect(0, 0, W, H);
    }
  }

  start(): void {
    if (this.phase !== "ended") this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (this.phase !== "ended") this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.phase = "evaporate";
    this.cloudFill = 0;
    this.cloudX = 250;
    this.cloudVx = 0;
    this.collected = 0;
    this.heat = 40;
    this.failed = false;
    this.vapor.clear();
    this.rain.clear();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
  }
  destroy(): void {
    this.loop.stop();
    this.vapor.clear();
    this.rain.clear();
  }
}

export const watercycleGame: GameModule = {
  meta: {
    id: "watercycle",
    conceptId: "ess-10",
    title: "Round & Round",
    stream: "earth-space",
    gradeBand: "4-5",
    emoji: "💧",
    blurb: "Heat the ocean, grow a cloud, and steer the rain to complete the water cycle.",
    mission: "Drive the full water cycle: evaporate ocean water, drift the cloud over land, make it rain, and collect it.",
    estMinutes: 4,
  },
  create: (ctx) => new WaterCycle(ctx),
};
