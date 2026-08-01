import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const CLOUD_Y = 200;

type Precip = "none" | "rain" | "snow" | "hail";

interface Drop {
  x: number;
  y: number;
  v: number;
  kind: Precip;
}

const TARGETS: { kind: Precip; label: string; emoji: string }[] = [
  { kind: "rain", label: "Rain", emoji: "🌧️" },
  { kind: "snow", label: "Snow", emoji: "❄️" },
  { kind: "hail", label: "Hail", emoji: "🧊" },
];

class Precipitation implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private temp = 0.6; // 0 cold .. 1 hot
  private moisture = 0.3; // 0 dry .. 1 humid
  private drops: Drop[] = [];
  private order: typeof TARGETS = [];
  private idx = 0;
  private matched = 0;
  private hold = 0;
  private ended = false;

  private nowEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Clouds hold tiny water droplets. When there's enough moisture, they fall as precipitation.",
      "Temperature decides the form: warm air gives rain, freezing air gives snow.",
      "Hail needs a big stormy cloud — lots of moisture in warm air. Dry air makes no rain at all.",
    ]);
    this.loop.start();
    this.render();
  }

  private target(): (typeof TARGETS)[number] {
    return this.order[this.idx];
  }

  private precip(): Precip {
    if (this.moisture < 0.5) return "none";
    if (this.temp < 0.35) return "snow";
    if (this.moisture > 0.85) return "hail";
    return "rain";
  }

  private buildPanel(): void {
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
    const moistSlider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.moisture * 100),
      "aria-label": "Moisture",
      style: { accentColor: "var(--accent-blue)" },
      oninput: (e: Event) => {
        this.moisture = Number((e.target as HTMLInputElement).value) / 100;
        this.updateReadout();
      },
    });

    this.nowEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `0 / ${TARGETS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Forecast"),
        el("span", {}, `${this.target().emoji} ${this.target().label}`)
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "🌡️ Temperature (cold → hot)"
      ),
      tempSlider,
      el("div", { class: "control-label" }, "💧 Moisture (dry → humid)"),
      moistSlider,
      el("div", { class: "metric" }, el("span", {}, "☁️ Now falling"), this.nowEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private label(p: Precip): string {
    return p === "rain"
      ? "🌧️ Rain"
      : p === "snow"
        ? "❄️ Snow"
        : p === "hail"
          ? "🧊 Hail"
          : "· Nothing";
  }

  private updateReadout(): void {
    const p = this.precip();
    this.nowEl.textContent = this.label(p);
    this.coachEl.textContent =
      p === "none"
        ? "Too dry to rain — add more moisture to the cloud."
        : p === "snow"
          ? "Freezing air turns the droplets to snow."
          : p === "hail"
            ? "A huge stormy cloud — droplets freeze into hailstones!"
            : "Warm, moist air falls as rain.";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    const p = this.precip();

    // spawn falling precip
    if (p !== "none" && this.drops.length < 90) {
      const x = 180 + Math.random() * 440;
      const v = p === "snow" ? 1.5 : p === "hail" ? 6 : 4;
      this.drops.push({ x, y: CLOUD_Y + 40, v, kind: p });
    }
    for (const d of this.drops) {
      d.y += d.v * f;
      if (d.kind === "snow") d.x += Math.sin(d.y * 0.05) * 0.6 * f;
    }
    this.drops = this.drops.filter((d) => d.y < 520 && d.kind === p);

    if (p === this.target().kind) {
      this.hold += f;
      if (this.hold > byTier(this.ctx.tier, 26, 36, 50)) this.matchOne();
    } else {
      this.hold = 0;
    }
    this.render();
  }

  private matchOne(): void {
    this.matched += 1;
    this.hold = 0;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
    this.idx += 1;
    this.drops = [];
    if (this.matched >= TARGETS.length) this.finish();
    else this.buildPanel();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("precipitation_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Weather wizard! When clouds hold enough moisture it precipitates — warm air makes rain, freezing air makes snow, and big storms make hail.",
      stars,
      resources: { Water: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky tint by temperature
    const sky = c.createLinearGradient(0, 0, 0, H);
    const cold = this.temp < 0.35;
    sky.addColorStop(0, cold ? "#cbd5e1" : "#7dd3fc");
    sky.addColorStop(1, "#e0f2fe");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, 520);
    c.fillStyle = cold ? "#e2e8f0" : "#86efac";
    c.fillRect(0, 520, W, H - 520);

    // cloud — darker/bigger with more moisture
    const grey = 255 - this.moisture * 110;
    c.fillStyle = `rgb(${grey},${grey},${grey + 5})`;
    for (const [dx, dy, r] of [
      [-90, 0, 50],
      [-30, -20, 60],
      [40, -10, 55],
      [100, 5, 45],
      [0, 15, 65],
    ] as const) {
      c.beginPath();
      c.arc(W / 2 + dx, CLOUD_Y + dy, r, 0, Math.PI * 2);
      c.fill();
    }

    // precip
    for (const d of this.drops) {
      if (d.kind === "rain") {
        c.strokeStyle = "#3b82f6";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - 2, d.y + 10);
        c.stroke();
      } else if (d.kind === "snow") {
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(d.x, d.y, 3, 0, Math.PI * 2);
        c.fill();
      } else if (d.kind === "hail") {
        c.fillStyle = "#bae6fd";
        c.strokeStyle = "#0ea5e9";
        c.lineWidth = 1;
        c.beginPath();
        c.arc(d.x, d.y, 5, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }

    // title
    c.fillStyle = "#0c4a6e";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Make the forecast: ${this.target().label} ${this.target().emoji}`, W / 2, 40);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#16a34a";
      c.font = "bold 15px Nunito, sans-serif";
      c.fillText("hold it…", W / 2, 70);
    }
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
    this.temp = 0.6;
    this.moisture = 0.3;
    this.drops = [];
    this.idx = 0;
    this.matched = 0;
    this.hold = 0;
    this.drops = [];
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const precipitationGame: GameModule = {
  meta: {
    id: "precipitation",
    conceptId: "ess-11",
    title: "Weather Maker",
    stream: "earth-space",
    gradeBand: "2-4",
    emoji: "🌧️",
    blurb: "Adjust temperature and moisture to brew rain, snow, or hail on demand.",
    mission: "Set the conditions to make rain, snow, and hail to match each forecast.",
    estMinutes: 3,
  },
  create: (ctx) => new Precipitation(ctx),
};
