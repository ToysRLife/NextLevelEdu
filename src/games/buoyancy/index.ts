import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const WATER_Y = 230;
const FLOOR_Y = 560;
const SIZE = 90;
const WATER_DENSITY = 1.0;

interface Material {
  key: string;
  label: string;
  density: number;
  color: string;
}

const MATERIALS: Material[] = [
  { key: "cork", label: "🟤 Cork", density: 0.24, color: "#b45309" },
  { key: "wood", label: "🪵 Wood", density: 0.65, color: "#a16207" },
  { key: "plastic", label: "🧱 Plastic", density: 1.05, color: "#7c3aed" },
  { key: "iron", label: "⚙️ Iron", density: 7.8, color: "#475569" },
];

class Buoyancy implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private material: Material = MATERIALS[1];
  private hollow = 0; // 0..0.9 — fraction of volume hollowed out (air)
  private target: "float" | "sink";
  private phase: "setup" | "dropping" | "ended" = "setup";
  private y = WATER_Y - SIZE; // object top
  private vy = 0;
  private settleFrames = 0;

  private densEl!: HTMLElement;
  private predictEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private chips!: HTMLElement;
  private dropBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.target = Math.random() < 0.5 ? "float" : "sink";
    this.buildPanel();
    ctx.services.hints.setHints([
      "Things float if they are less dense than water, and sink if they are denser than water.",
      "Hollowing an object out fills it with light air, lowering its overall density — that's how heavy steel ships float.",
      this.target === "float"
        ? "Pick a light material, or hollow out a heavy one until its density drops below water (1.0)."
        : "Pick a dense material like iron, and keep it solid so its density stays above water (1.0).",
    ]);
    this.render();
  }

  private effDensity(): number {
    return this.material.density * (1 - this.hollow);
  }

  private buildPanel(): void {
    this.chips = el(
      "div",
      { class: "chip-row" },
      ...MATERIALS.map((m) =>
        el(
          "button",
          {
            class: `chip${m.key === this.material.key ? " active" : ""}`,
            "data-m": m.key,
            onclick: () => {
              if (this.phase !== "setup") return;
              this.material = m;
              this.chips
                .querySelectorAll("button")
                .forEach((b) => b.classList.toggle("active", b.getAttribute("data-m") === m.key));
              this.updateReadout();
              this.render();
            },
          },
          m.label
        )
      )
    );

    const slider = el("input", {
      type: "range",
      min: "0",
      max: "90",
      value: String(this.hollow * 100),
      "aria-label": "Hollow out",
      style: { accentColor: "var(--accent-blue)" },
      oninput: (e: Event) => {
        if (this.phase !== "setup") return;
        this.hollow = Number((e.target as HTMLInputElement).value) / 100;
        this.updateReadout();
        this.render();
      },
    });

    this.densEl = el("span", { style: { color: "var(--accent-blue)" } }, "0.65");
    this.predictEl = el("span", {}, "Floats");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.dropBtn = el("button", { class: "btn", onclick: () => this.drop() }, "⬇️ Drop It");

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, this.target === "float" ? "Make it FLOAT" : "Make it SINK")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Material"),
      this.chips,
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Hollow It Out (add air)"),
      slider,
      el("div", { class: "metric" }, el("span", {}, "⚖️ Density"), this.densEl),
      el("div", { class: "metric" }, el("span", {}, "🔮 Predict"), this.predictEl),
      this.dropBtn,
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const d = this.effDensity();
    this.densEl.textContent = `${d.toFixed(2)} g/cm³`;
    const floats = d < WATER_DENSITY;
    this.predictEl.textContent = floats ? "Floats 🛟" : "Sinks ⚓";
    this.predictEl.style.color = floats ? "var(--accent-blue)" : "var(--accent-red)";
    this.coachEl.textContent =
      d < WATER_DENSITY
        ? `Less dense than water (${WATER_DENSITY.toFixed(1)}) — it will float.`
        : `Denser than water (${WATER_DENSITY.toFixed(1)}) — it will sink.`;
  }

  private drop(): void {
    if (this.phase !== "setup") return;
    this.phase = "dropping";
    this.vy = 0;
    this.settleFrames = 0;
    this.dropBtn.setAttribute("disabled", "true");
    this.ctx.services.audio.play("click");
    this.loop.start();
  }

  private tick(dtMs: number): void {
    if (this.phase !== "dropping") return;
    const f = dtMs / 16.67;
    const eff = this.effDensity();
    const bottom = this.y + SIZE;

    // submerged fraction
    const submerged = Math.max(0, Math.min(SIZE, bottom - WATER_Y));
    const fraction = submerged / SIZE;

    let accel: number;
    if (fraction <= 0) {
      accel = 0.5; // in air, gravity
    } else {
      // net accel = g*(eff - fraction)/eff  (down positive)
      accel = (0.5 * (eff - fraction * WATER_DENSITY)) / eff;
    }
    this.vy += accel * f;
    this.vy *= 0.94; // water drag / air drag
    this.y += this.vy * f;

    // floor
    if (this.y + SIZE > FLOOR_Y) {
      this.y = FLOOR_Y - SIZE;
      this.vy = 0;
    }
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }

    if (Math.abs(this.vy) < 0.05) this.settleFrames += f;
    else this.settleFrames = 0;

    this.render();

    if (this.settleFrames > 30) this.finish();
  }

  private finish(): void {
    this.phase = "ended";
    this.loop.stop();
    const sank = this.y + SIZE >= FLOOR_Y - 1;
    const outcome = sank ? "sink" : "float";
    const hintsUsed = this.ctx.services.hints.count();
    if (outcome === this.target) {
      const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
      this.ctx.services.score.event("buoyancy_match", {
        target: this.target,
        density: this.effDensity(),
      });
      this.ctx.services.outcome.succeed({
        message:
          this.target === "float"
            ? "It floats! Its density is less than water's, so the water holds it up."
            : "It sinks! Its density is greater than water's, so gravity wins and it goes down.",
        stars,
        resources: { Oxygen: 35 },
      });
    } else {
      this.ctx.services.outcome.fail({
        message:
          this.target === "float"
            ? "It sank — still denser than water. Use a lighter material or hollow it out more to add air."
            : "It floated — lighter than water. Choose a denser material and keep it solid (less air).",
      });
    }
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#dbeafe";
    c.fillRect(0, 0, W, H);

    // water
    c.fillStyle = "#0ea5e9";
    c.globalAlpha = 0.85;
    c.fillRect(0, WATER_Y, W, FLOOR_Y - WATER_Y);
    c.globalAlpha = 1;
    c.fillStyle = "#7dd3fc";
    c.fillRect(0, WATER_Y, W, 5);
    c.fillStyle = "#0369a1";
    c.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // waterline label
    c.fillStyle = "#0c4a6e";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("💧 Water density = 1.0", 14, WATER_Y - 10);

    // object
    const x = W / 2 - SIZE / 2;
    c.fillStyle = this.material.color;
    c.fillRect(x, this.y, SIZE, SIZE);
    c.strokeStyle = "#1e293b";
    c.lineWidth = 3;
    c.strokeRect(x, this.y, SIZE, SIZE);

    // hollow (air) shown as inner light box
    if (this.hollow > 0.02) {
      const inset = (SIZE * Math.sqrt(this.hollow)) / 2;
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.fillRect(x + (SIZE - inset * 2) / 2, this.y + (SIZE - inset * 2) / 2, inset * 2, inset * 2);
      c.fillStyle = "#0c4a6e";
      c.font = "11px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("air", W / 2, this.y + SIZE / 2 + 4);
    }

    // density tag
    c.fillStyle = "#1e293b";
    c.font = "bold 15px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${this.effDensity().toFixed(2)}`, W / 2, this.y - 8);
  }

  start(): void {
    if (this.phase === "dropping") this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (this.phase === "dropping") this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.phase = "setup";
    this.hollow = 0;
    this.material = MATERIALS[1];
    this.y = WATER_Y - SIZE;
    this.vy = 0;
    this.target = Math.random() < 0.5 ? "float" : "sink";
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const buoyancyGame: GameModule = {
  meta: {
    id: "buoyancy",
    conceptId: "phys-11",
    title: "Float or Sink?",
    stream: "physics",
    gradeBand: "2-4",
    emoji: "🛟",
    blurb: "Pick a material and hollow it out to control whether it floats or sinks.",
    mission:
      "Make the object float or sink as the goal asks — by changing its density against water's.",
    estMinutes: 3,
  },
  create: (ctx) => new Buoyancy(ctx),
};
