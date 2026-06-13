import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const LID_Y = 150;

interface Vapor {
  x: number;
  y: number;
  vy: number;
}

class Evaporation implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly need: number; // droplets to collect (adaptive)
  private readonly loop: SimLoop;

  private heat = 0;
  private waterLevel = 1; // 0..1
  private vapors: Vapor[] = [];
  private droplets = 0;
  private dropPos: number[] = [];
  private spawnAcc = 0;
  private elapsed = 0;
  private ended = false;

  private dropEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.need = byTier(ctx.tier, 8, 12, 16);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "Heating a liquid makes it evaporate — it turns into an invisible gas (water vapour) that rises.",
      "When that warm vapour touches something cold, it condenses back into liquid droplets — like dew on a cold glass.",
      "Turn up the heat to evaporate the water; the vapour will condense into droplets on the cold lid.",
    ]);
    this.loop.start();
    this.render();
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.heat * 100),
      "aria-label": "Heat",
      style: { accentColor: "var(--accent-red)" },
      oninput: (e: Event) => {
        this.heat = Number((e.target as HTMLInputElement).value) / 100;
        this.updateReadout();
      },
    });

    this.dropEl = el("span", { style: { color: "var(--accent-blue)" } }, `0 / ${this.need}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Heat the water to evaporate it — the vapour will condense on the cold lid.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Collect ${this.need} droplets`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔥 Heat"),
      slider,
      el("div", { class: "metric" }, el("span", {}, "💧 Droplets on lid"), this.dropEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.coachEl.textContent =
      this.heat < 0.15
        ? "Turn up the heat — the warmer the water, the faster it evaporates."
        : "Evaporating! The rising vapour cools on the lid and condenses into droplets.";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.elapsed += dtMs / 1000;

    // spawn vapour from the water surface based on heat
    this.spawnAcc += this.heat * 0.4 * f;
    while (this.spawnAcc >= 1 && this.waterLevel > 0.05) {
      this.spawnAcc -= 1;
      const surfaceY = 480 - this.waterLevel * 220;
      this.vapors.push({ x: 320 + Math.random() * 160, y: surfaceY, vy: -1 - this.heat * 1.5 });
      this.waterLevel = Math.max(0.05, this.waterLevel - 0.004);
    }

    for (const v of this.vapors) {
      v.y += v.vy * f;
      v.x += Math.sin(this.elapsed * 3 + v.x) * 0.4 * f;
    }
    // condense on the cold lid
    const reached = this.vapors.filter((v) => v.y <= LID_Y + 16);
    for (const v of reached) {
      this.droplets += 1;
      this.dropPos.push(v.x);
      this.ctx.services.audio.play("tick");
    }
    this.vapors = this.vapors.filter((v) => v.y > LID_Y + 16);

    this.dropEl.textContent = `${this.droplets} / ${this.need}`;
    if (this.droplets >= this.need) this.finish();
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.elapsed < 15 ? 3 : this.elapsed < 30 ? 2 : 1;
    this.ctx.services.score.event("evaporation_done", { seconds: Math.round(this.elapsed) });
    this.ctx.services.outcome.succeed({
      message:
        "Round trip! Heat evaporated the water into invisible vapour, and touching the cold lid condensed it back into droplets — evaporation and condensation.",
      stars,
      resources: { Energy: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff";
    c.fillRect(0, 0, W, H);

    const beaker = { x: 290, y: LID_Y, w: 220, h: 340 };

    // cold lid
    c.fillStyle = "#93c5fd";
    c.fillRect(beaker.x - 10, LID_Y - 24, beaker.w + 20, 24);
    c.fillStyle = "#1e3a8a";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("❄️ cold lid", beaker.x + beaker.w / 2, LID_Y - 32);

    // beaker glass
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.fillRect(beaker.x, beaker.y, beaker.w, beaker.h);

    // water
    const top = 480 - this.waterLevel * 220;
    c.fillStyle = "rgba(56,189,248,0.7)";
    c.fillRect(beaker.x, top, beaker.w, beaker.y + beaker.h - top);

    // heat glow under beaker
    c.fillStyle = `rgba(249,115,22,${this.heat * 0.7})`;
    c.fillRect(beaker.x, beaker.y + beaker.h, beaker.w, 16);
    if (this.heat > 0.2) {
      c.fillStyle = `rgba(249,115,22,${this.heat})`;
      c.font = "20px serif";
      c.fillText("🔥", beaker.x + beaker.w / 2, beaker.y + beaker.h + 36);
    }

    // vapour
    c.fillStyle = "rgba(226,232,240,0.7)";
    for (const v of this.vapors) {
      c.beginPath();
      c.arc(v.x, v.y, 5, 0, Math.PI * 2);
      c.fill();
    }

    // droplets clinging to the lid
    c.fillStyle = "#3b82f6";
    for (const x of this.dropPos) {
      c.beginPath();
      c.arc(x, LID_Y + 6, 5, 0, Math.PI * 2);
      c.fill();
    }

    c.strokeStyle = "#94a3b8";
    c.lineWidth = 5;
    c.strokeRect(beaker.x, beaker.y, beaker.w, beaker.h);

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Evaporate the water, then collect the dew 💧", W / 2, 60);
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
    this.heat = 0;
    this.waterLevel = 1;
    this.vapors = [];
    this.droplets = 0;
    this.dropPos = [];
    this.spawnAcc = 0;
    this.elapsed = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const evaporationGame: GameModule = {
  meta: {
    id: "evaporation",
    conceptId: "chem-05",
    title: "Disappearing Act",
    stream: "chemistry",
    gradeBand: "3-4",
    emoji: "💨",
    blurb: "Heat water into vapour and watch it condense back into droplets on a cold lid.",
    mission: "Evaporate the water and collect the droplets that condense above.",
    estMinutes: 2,
  },
  create: (ctx) => new Evaporation(ctx),
};
