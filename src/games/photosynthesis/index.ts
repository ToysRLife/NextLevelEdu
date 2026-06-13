import type { GameModule, GameContext, GameInstance, DifficultyTier } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { ParticleSystem } from "@core/particles";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Weather {
  key: string;
  label: string;
  temp: number;
  humidity: number;
  sunlight: number;
  bg: string;
}

const WEATHER: Weather[] = [
  { key: "spring", label: "🌤️ Spring", temp: 22, humidity: 0.6, sunlight: 0.8, bg: "#1e1b4b" },
  { key: "heatwave", label: "🔥 Heatwave", temp: 42, humidity: 0.1, sunlight: 1.0, bg: "#450a0a" },
  { key: "monsoon", label: "🌧️ Monsoon", temp: 26, humidity: 0.95, sunlight: 0.2, bg: "#0f172a" },
  { key: "night", label: "🌙 Night", temp: 15, humidity: 0.7, sunlight: 0.0, bg: "#020617" },
];

// Tier tunes how punishing transpiration is, so younger learners get a gentler curve.
const TIER_WATER_FACTOR: Record<DifficultyTier, number> = { junior: 0.7, explorer: 1, master: 1.25 };

class Photosynthesis implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly particles = new ParticleSystem();
  private weather: Weather = WEATHER[0];
  private waterFactor: number;
  private ended = false;

  private state = { water: 100, storedCO2: 0, glucose: 0, aperture: 0.5 };

  // panel elements we update each tick
  private h2oEl!: HTMLElement;
  private glucoseEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private envEl!: HTMLElement;
  private canvasBg!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.waterFactor = TIER_WATER_FACTOR[ctx.tier];
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.canvasBg = ctx.canvas.parentElement as HTMLElement;
    this.buildPanel();
    this.applyWeather(WEATHER[0]);
    ctx.services.hints.setHints([
      "Watch the weather readout — temperature and humidity change how fast you lose water.",
      "Open stomata let in CO₂ to build glucose, but also let water escape. It's a balance.",
      "In a heatwave, throttle the stomata down low. In a monsoon, open them wide — humidity protects your water.",
    ]);
    this.render();
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: "50",
      "aria-label": "Stomata opening",
      style: { accentColor: "var(--accent-green)" },
      oninput: (e: Event) => {
        this.state.aperture = Number((e.target as HTMLInputElement).value) / 100;
        this.updateReadout();
      },
    });

    const chips = el(
      "div",
      { class: "chip-row" },
      ...WEATHER.map((w) =>
        el(
          "button",
          {
            class: "chip" + (w.key === this.weather.key ? " active" : ""),
            "data-w": w.key,
            onclick: () => this.applyWeather(w),
          },
          w.label,
        ),
      ),
    );
    this.weatherChips = chips;

    this.envEl = el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } });
    this.h2oEl = el("span", { style: { color: "var(--accent-blue)" } }, "100%");
    this.glucoseEl = el("span", { style: { color: "var(--accent-green)" } }, "0%");
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" } });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "control-label" }, "Stomata Opening (Throttle)"),
      slider,
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Weather"),
      chips,
      this.envEl,
      el("div", { class: "metric" }, el("span", {}, "💧 Water"), this.h2oEl),
      el("div", { class: "metric" }, el("span", {}, "⚡ Glucose"), this.glucoseEl),
      this.coachEl,
    );
  }

  private weatherChips!: HTMLElement;

  private applyWeather(w: Weather): void {
    this.weather = w;
    this.canvasBg.style.background = w.bg;
    this.weatherChips.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-w") === w.key);
    });
    this.updateReadout();
  }

  private updateReadout(): void {
    this.h2oEl.textContent = `${this.state.water.toFixed(0)}%`;
    this.glucoseEl.textContent = `${this.state.glucose.toFixed(0)}%`;
    this.envEl.replaceChildren(
      el("span", { style: { color: "#fca5a5" } }, `${this.weather.temp}°C`),
      el("span", { style: { color: "#7dd3fc" } }, `${Math.round(this.weather.humidity * 100)}% Hum`),
      el("span", { style: { color: "#fde047" } }, `${Math.round(this.weather.sunlight * 100)}% Sun`),
    );
    this.coachEl.textContent = this.coachText();
  }

  private coachText(): string {
    const ap = this.state.aperture;
    if (this.weather.key === "night" && ap > 0.1) return "⚠️ No sunlight! Open stomata waste water without making food.";
    if (this.weather.key === "heatwave" && ap > 0.4) return "🔥 Danger: high opening in a heatwave causes fatal water loss. Throttle down!";
    if (this.weather.key === "monsoon" && ap < 0.8) return "🌧️ Opportunity: humidity is high — open up wide to grab CO₂ safely.";
    if (ap > 0.8) return "🌿 Maximizing CO₂ — great growth, but watch your water.";
    if (ap < 0.2) return "🏜️ Conserving water, but glucose production has stalled.";
    return "✅ Balanced for the current weather. Keep it steady.";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67; // frame-rate independence (baseline 60fps)
    const ap = this.state.aperture;
    const w = this.weather;

    const waterLoss = (ap + ap * ap) * w.temp * (1 - w.humidity) * 0.015 * this.waterFactor * f;
    const co2Gain = ap * 100 * 0.05 * f;
    const co2Use = this.state.storedCO2 > 0 ? ap * w.sunlight * 0.1 * f : 0;
    const glucGain = this.state.storedCO2 > 0 ? ap * w.sunlight * 0.25 * f : 0;

    this.state.water = Math.max(0, this.state.water - waterLoss);
    this.state.storedCO2 = Math.max(0, this.state.storedCO2 + co2Gain - co2Use);
    this.state.glucose = Math.min(100, this.state.glucose + glucGain);

    this.updateReadout();
    this.render();

    if (this.state.glucose >= 100) this.win();
    else if (this.state.water <= 0) this.lose();
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.ctx.services.hints.count() === 0 ? 3 : this.ctx.services.hints.count() === 1 ? 2 : 1;
    const biomass = 40 + Math.round(this.state.water / 2);
    this.ctx.services.score.event("photosynthesis_complete", { waterLeft: this.state.water });
    this.ctx.services.outcome.succeed({
      message: `Your plant fully synthesized its food with ${this.state.water.toFixed(0)}% water to spare!`,
      stars,
      resources: { Biomass: biomass },
    });
  }

  private lose(): void {
    this.ended = true;
    this.loop.stop();
    this.ctx.services.outcome.fail({
      message: "The plant dried out — too much water escaped. Try throttling the stomata down when it's hot and dry.",
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const opening = this.state.aperture * 40;
    const flow = 0.5 + this.state.aperture * 2.5;

    if (this.state.aperture > 0.05 && Math.random() < this.state.aperture * 1.5) {
      if (Math.random() > this.weather.humidity)
        this.particles.spawn({ kind: "h2o", x: cx + (Math.random() - 0.5) * opening, y: cy, vx: (Math.random() - 0.5) * 4 * flow, vy: -Math.random() * 2 * flow - 1, size: 8 });
      this.particles.spawn({ kind: "co2", x: cx + (Math.random() - 0.5) * 200, y: cy - 200, vx: (Math.random() - 0.5) * 2 * flow, vy: 2 * flow, size: 8 });
    }
    this.particles.update(0.01);

    for (const p of this.particles.particles) {
      c.globalAlpha = p.life;
      if (p.kind === "h2o") {
        c.fillStyle = "#38bdf8";
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI, false);
        c.lineTo(p.x, p.y - 12);
        c.fill();
      } else {
        c.fillStyle = "#ec4899";
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)";
        c.beginPath();
        c.arc(p.x - 3, p.y - 3, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;

    const g = 52 + (100 - this.state.water) * 2;
    c.fillStyle = `rgb(${g}, 211, 153)`;
    c.shadowBlur = 15;
    c.shadowColor = "rgba(0,0,0,0.5)";
    c.beginPath();
    c.ellipse(cx - opening / 2 - 20, cy, 30, 80, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx + opening / 2 + 20, cy, 30, 80, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;

    c.fillStyle = "#0f172a";
    c.beginPath();
    c.ellipse(cx, cy, opening, 75, 0, 0, Math.PI * 2);
    c.fill();
  }

  start(): void {
    this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (!this.ended) this.loop.start();
  }
  reset(): void {
    this.ended = false;
    this.state = { water: 100, storedCO2: 0, glucose: 0, aperture: this.state.aperture };
    this.particles.clear();
    this.ctx.services.hints.reset();
    this.updateReadout();
    this.render();
    this.loop.start();
  }
  destroy(): void {
    this.loop.stop();
    this.particles.clear();
  }
}

export const photosynthesisGame: GameModule = {
  meta: {
    id: "photosynthesis",
    conceptId: "bio-07",
    title: "Stomata Squad",
    stream: "biology",
    gradeBand: "5",
    emoji: "🌱",
    blurb: "Balance water and sunlight to keep your plant alive while it makes its food.",
    mission: "Keep your plant alive through the day while it makes enough food (glucose) to grow.",
    estMinutes: 4,
  },
  create: (ctx) => new Photosynthesis(ctx),
};
