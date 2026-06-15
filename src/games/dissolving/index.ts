import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const BEAKER = { x: 270, y: 150, w: 260, h: 360 };
const WATER_TOP = BEAKER.y + 70;

class Dissolving implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly targetSpoons: number; // spoons to fully dissolve (adaptive)

  private spoons = 0; // total added
  private dissolved = 0; // continuous, <= spoons
  private temp = 0.3; // 0..1
  private stir = 0;
  private swirl = 0;
  private ended = false;

  private spoonsEl!: HTMLElement;
  private dissEl!: HTMLElement;
  private capEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private addBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.targetSpoons = byTier(ctx.tier, 4, 5, 6);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "Dissolving means the solid breaks into pieces too tiny to see, spreading evenly through the water to make a solution.",
      "Heat and stirring make a solute dissolve faster. Warmer water can also hold more before it gets 'full' (saturated).",
      `Add ${this.targetSpoons} spoons, then turn up the heat and keep stirring until every grain disappears and the water turns clear.`,
    ]);
    this.loop.start();
    this.render();
  }

  private capacity(): number {
    return 2 + this.temp * 7; // spoons the water can hold at this temperature
  }

  private buildPanel(): void {
    this.addBtn = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          if (this.ended) return;
          if (this.spoons < 8) {
            this.spoons += 1;
            this.ctx.services.audio.play("tick");
            this.updateReadout();
          }
        },
      },
      "🥄 Add Sugar",
    ) as HTMLButtonElement;

    const tempSlider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.temp * 100),
      "aria-label": "Temperature",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        this.temp = Number((e.target as HTMLInputElement).value) / 100;
        this.updateReadout();
      },
    });

    const stirBtn = el(
      "button",
      {
        class: "btn secondary",
        onclick: () => {
          if (this.ended) return;
          this.stir = Math.min(1, this.stir + 0.5);
          this.ctx.services.audio.play("click");
        },
      },
      "🌀 Stir",
    );

    this.spoonsEl = el("span", {}, "0");
    this.dissEl = el("span", { style: { color: "var(--accent-blue)" } }, "0%");
    this.capEl = el("span", {}, "");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Dissolve ${this.targetSpoons} spoons`),
      ),
      this.addBtn,
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🌡️ Temperature"),
      tempSlider,
      stirBtn,
      el("div", { class: "metric" }, el("span", {}, "🥄 Spoons added"), this.spoonsEl),
      el("div", { class: "metric" }, el("span", {}, "💧 Dissolved"), this.dissEl),
      el("div", { class: "metric" }, el("span", {}, "🫙 Can hold"), this.capEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const cap = this.capacity();
    this.spoonsEl.textContent = `${this.spoons} / ${this.targetSpoons}`;
    const pct = this.spoons === 0 ? 0 : Math.round((this.dissolved / this.spoons) * 100);
    this.dissEl.textContent = `${pct}%`;
    this.capEl.textContent = `${cap.toFixed(1)} spoons`;
    if (this.spoons > cap + 0.05) {
      this.coachEl.textContent = "The water is saturated — it can't hold this much! Turn up the heat so it can dissolve more.";
    } else if (this.spoons === 0) {
      this.coachEl.textContent = "Add some sugar, then heat and stir to dissolve it into a clear solution.";
    } else {
      this.coachEl.textContent = "Keep stirring! Warmer water and stirring dissolve the sugar faster.";
    }
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.stir = Math.max(0, this.stir - 0.012 * f);
    this.swirl += (0.05 + this.stir * 0.4) * f;

    const dissolvable = Math.min(this.spoons, this.capacity());
    if (this.dissolved < dissolvable) {
      const rate = (0.004 + this.temp * 0.012) * (0.3 + this.stir) * 60;
      this.dissolved = Math.min(dissolvable, this.dissolved + rate * (dtMs / 1000));
    } else if (this.dissolved > dissolvable) {
      // Cooling dropped the capacity — sugar recrystallizes back out.
      this.dissolved = Math.max(dissolvable, this.dissolved - 0.01 * f);
    }

    if (!this.ended && this.spoons >= this.targetSpoons && this.spoons - this.dissolved < 0.08) {
      this.finish();
    }

    this.updateReadout();
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("dissolving_clear", { temp: Number(this.temp.toFixed(2)) });
    this.ctx.services.outcome.succeed({
      message:
        "Clear solution! The sugar dissolved — its tiny particles spread evenly through the water. Heat and stirring sped it up.",
      stars,
      resources: { Compounds: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fdf2f8";
    c.fillRect(0, 0, W, H);

    // bench
    c.fillStyle = "#fbcfe8";
    c.fillRect(0, BEAKER.y + BEAKER.h, W, H - (BEAKER.y + BEAKER.h));

    // beaker glass
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(BEAKER.x, BEAKER.y, BEAKER.w, BEAKER.h);

    // water (cloudier when more undissolved)
    const undissolved = Math.max(0, this.spoons - this.dissolved);
    const cloud = Math.min(0.6, undissolved * 0.12);
    c.fillStyle = `rgba(125,211,252,${0.55 + cloud})`;
    c.fillRect(BEAKER.x, WATER_TOP, BEAKER.w, BEAKER.y + BEAKER.h - WATER_TOP);

    // swirl lines when stirring
    if (this.stir > 0.05) {
      c.strokeStyle = `rgba(255,255,255,${0.3 + this.stir * 0.4})`;
      c.lineWidth = 3;
      const cx = BEAKER.x + BEAKER.w / 2;
      const cy = (WATER_TOP + BEAKER.y + BEAKER.h) / 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        const r = 30 + i * 28;
        c.arc(cx, cy, r, this.swirl + i, this.swirl + i + 2.2);
        c.stroke();
      }
    }

    // undissolved grains piled at the bottom
    const grains = Math.floor(undissolved * 16);
    c.fillStyle = "#fef3c7";
    const baseY = BEAKER.y + BEAKER.h - 8;
    for (let i = 0; i < grains; i++) {
      const gx = BEAKER.x + 16 + ((i * 37) % (BEAKER.w - 32));
      const gy = baseY - ((i * 13) % 40);
      c.fillRect(gx, gy, 6, 6);
    }

    // steam when hot
    if (this.temp > 0.55) {
      c.strokeStyle = `rgba(255,255,255,${(this.temp - 0.55) * 1.2})`;
      c.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const sx = BEAKER.x + 60 + i * 70;
        c.beginPath();
        c.moveTo(sx, WATER_TOP);
        c.quadraticCurveTo(sx + 14, WATER_TOP - 30, sx, WATER_TOP - 56);
        c.stroke();
      }
    }

    // beaker outline
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 5;
    c.strokeRect(BEAKER.x, BEAKER.y, BEAKER.w, BEAKER.h);

    // labels
    c.fillStyle = "#831843";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(undissolved < 0.08 && this.spoons > 0 ? "Clear solution ✨" : "Stir to dissolve", W / 2, BEAKER.y - 16);
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
    this.spoons = 0;
    this.dissolved = 0;
    this.temp = 0.3;
    this.stir = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const dissolvingGame: GameModule = {
  meta: {
    id: "dissolving",
    conceptId: "chem-11",
    title: "Mystery Mixer",
    stream: "chemistry",
    gradeBand: "4-5",
    emoji: "🥤",
    blurb: "Dissolve sugar into water using heat and stirring — without oversaturating it.",
    mission: "Dissolve every grain of sugar into a clear solution by controlling temperature and stirring.",
    estMinutes: 3,
  },
  create: (ctx) => new Dissolving(ctx),
};
