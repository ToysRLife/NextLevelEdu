import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";

// Weather (MS-ESS2-5): air temperature and moisture (humidity) decide the
// weather. Dry air is sunny; moist air clouds over; very moist air rains —
// and if it's warm too, it builds into a thunderstorm. Mix the air mass to
// brew the target forecast.

const W = 800;
const H = 600;

type Weather = "Sunny" | "Cloudy" | "Rain" | "Thunderstorm";
const WEATHER_EMOJI: Record<Weather, string> = {
  Sunny: "☀️",
  Cloudy: "☁️",
  Rain: "🌧️",
  Thunderstorm: "⛈️",
};

const forecast = (tempC: number, humidity: number): Weather =>
  humidity < 30 ? "Sunny" : humidity < 60 ? "Cloudy" : tempC > 22 ? "Thunderstorm" : "Rain";

const ROUNDS: Weather[] = ["Cloudy", "Thunderstorm", "Rain"];

class StormChaser implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private temp = 15;
  private humidity = 40;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private brewing = false;
  private prog = 0;
  private acc = 0;
  private drops: { x: number; y: number; v: number }[] = [];
  private bolt = 0;

  private tempCtl!: SliderHandle;
  private humCtl!: SliderHandle;
  private fcRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    for (let i = 0; i < 50; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 5 });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Weather is made by the air's temperature and how much moisture (humidity) it carries.",
      "Dry air stays sunny. As humidity rises, clouds form; when the air is very moist, it rains.",
      "Warm, very moist air rises fast and builds towering clouds — that's when you get a thunderstorm.",
    ]);
    this.loop.start();
    this.render();
  }

  private target(): Weather {
    return ROUNDS[this.idx];
  }

  private buildPanel(): void {
    this.tempCtl = slider({
      label: "🌡️ Air temperature",
      min: 0,
      max: 40,
      value: this.temp,
      step: 1,
      unit: "°C",
      color: "var(--accent-orange)",
      onInput: (v) => {
        this.temp = v;
        this.updateReadout();
        this.render();
      },
    });
    this.humCtl = slider({
      label: "💧 Humidity",
      min: 0,
      max: 100,
      value: this.humidity,
      step: 5,
      unit: "%",
      color: "var(--accent-blue)",
      onInput: (v) => {
        this.humidity = v;
        this.updateReadout();
        this.render();
      },
    });
    this.fcRead = readout("🔮 Forecast");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" } });
    this.coachEl.textContent = "Mix temperature and humidity to brew the target weather.";
    this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.brew() }, "🌬️ Brew the weather") as HTMLButtonElement;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target"), el("span", {}, `${WEATHER_EMOJI[this.target()]} ${this.target()}`)),
      this.tempCtl.el,
      this.humCtl.el,
      this.fcRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Forecasts nailed"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const f = forecast(this.temp, this.humidity);
    this.fcRead.set(`${WEATHER_EMOJI[f]} ${f}${f === this.target() ? " ✓" : ""}`);
  }

  private brew(): void {
    if (this.ended || this.brewing) return;
    this.brewing = true;
    this.prog = 0;
    this.acc = 0;
    this.tempCtl.setEnabled(false);
    this.humCtl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.brewing) {
      this.acc += dtMs;
      let steps = 0;
      while (this.brewing && this.acc >= 16.67 && steps < 30) {
        this.prog = Math.min(1, this.prog + 0.02);
        if (this.prog >= 1) {
          this.brewing = false;
          this.evaluate();
        }
        this.acc -= 16.67;
        steps++;
      }
    }
    // animate rain / lightning when wet
    const f = forecast(this.temp, this.humidity);
    if (f === "Rain" || f === "Thunderstorm") {
      for (const d of this.drops) {
        d.y += d.v;
        if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
      }
      if (f === "Thunderstorm") this.bolt = this.bolt > 0 ? this.bolt - 1 : (this.prog > 0 ? 14 : 0);
    }
    this.render();
  }

  private evaluate(): void {
    this.tempCtl.setEnabled(true);
    this.humCtl.setEnabled(true);
    this.goBtn.disabled = false;
    const f = forecast(this.temp, this.humidity);
    if (f === this.target()) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.coachEl.textContent = `${WEATHER_EMOJI[f]} Forecast nailed! Next target — remix the air.`;
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `You brewed ${f}, not ${this.target()}. ${this.hintFor()}`;
    }
  }

  private hintFor(): string {
    const t = this.target();
    return t === "Sunny"
      ? "Dry the air out (low humidity)."
      : t === "Cloudy"
        ? "Use medium humidity (about 30–60%)."
        : t === "Rain"
          ? "High humidity, but keep it cool (under 22°C)."
          : "High humidity AND warm air (over 22°C).";
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("stormchaser_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Forecaster! Weather comes from temperature and moisture: dry air is sunny, moist air clouds and rains, and warm + very moist air whips up a thunderstorm.",
      stars,
      resources: { Climate: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const f = forecast(this.temp, this.humidity);
    // sky tone
    const top = f === "Sunny" ? "#7dd3fc" : f === "Cloudy" ? "#94a3b8" : "#475569";
    c.fillStyle = top;
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#fff";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Weather wizard! 🌦️", W / 2, H / 2);
      return;
    }

    // sun
    if (f === "Sunny" || f === "Cloudy") {
      c.fillStyle = "#fde047";
      c.beginPath();
      c.arc(W - 140, 130, 56, 0, Math.PI * 2);
      c.fill();
    }
    // clouds
    if (f !== "Sunny") {
      c.fillStyle = f === "Cloudy" ? "#e2e8f0" : "#cbd5e1";
      for (let i = 0; i < 4; i++) {
        const cxp = 180 + i * 140;
        c.beginPath();
        c.arc(cxp, 170, 46, 0, Math.PI * 2);
        c.arc(cxp + 50, 170, 56, 0, Math.PI * 2);
        c.arc(cxp - 50, 175, 40, 0, Math.PI * 2);
        c.fill();
      }
    }
    // rain
    if (f === "Rain" || f === "Thunderstorm") {
      c.strokeStyle = "rgba(191,219,254,0.8)";
      c.lineWidth = 2;
      for (const d of this.drops) {
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - 2, d.y + 12);
        c.stroke();
      }
    }
    // lightning
    if (f === "Thunderstorm" && this.bolt > 0) {
      c.fillStyle = `rgba(254,240,138,${this.bolt / 14})`;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "#facc15";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(W / 2, 220);
      c.lineTo(W / 2 - 30, 320);
      c.lineTo(W / 2 + 10, 320);
      c.lineTo(W / 2 - 20, 430);
      c.stroke();
    }
    // ground
    c.fillStyle = "#3f6212";
    c.fillRect(0, H - 80, W, 80);

    c.fillStyle = "#0f172a";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Mix the air to brew the weather 🌬️", W / 2, 44);
    c.fillStyle = "#fff";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(`${WEATHER_EMOJI[f]} ${f}  ·  ${this.temp}°C  ·  ${this.humidity}% humidity`, W / 2, H - 30);
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
    this.brewing = false;
    this.temp = 15;
    this.humidity = 40;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.prog = 0;
    this.bolt = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const stormChaserGame: GameModule = {
  meta: {
    id: "stormchaser",
    conceptId: "ess-30",
    title: "Storm Chaser",
    stream: "earth-space",
    gradeBand: "6-8",
    emoji: "⛈️",
    blurb: "Mix temperature and humidity to brew sun, clouds, rain, or a thunderstorm on demand.",
    mission: "Set the air's temperature and humidity to brew each target forecast.",
    estMinutes: 4,
  },
  create: (ctx) => new StormChaser(ctx),
};
