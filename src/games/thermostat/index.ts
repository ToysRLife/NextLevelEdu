import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Greenhouse effect & climate (MS-ESS3-5): greenhouse gases like CO₂ trap heat,
// so more CO₂ → a warmer planet. Set the CO₂ level to hold Earth at the target
// temperature. (Climate sensitivity is exaggerated for clarity.)

const W = 800;
const H = 600;
const BASE_CO2 = 280; // pre-industrial ppm
const BASE_T = 14; // °C at BASE_CO2

const tempFor = (co2: number) => BASE_T + 6 * Math.log2(co2 / BASE_CO2);

interface Round {
  target: number; // target global temperature °C
}
const ROUNDS: Round[] = [{ target: 18 }, { target: 22 }, { target: 16 }];

class Thermostat implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private co2 = 400;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private settling = false;
  private shownT = BASE_T;
  private acc = 0;

  private co2Ctl!: SliderHandle;
  private tempRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 1.0, 0.6, 0.4);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Greenhouse gases like CO₂ act like a blanket — they trap heat that would otherwise escape to space.",
      "More CO₂ traps more heat, so the planet gets warmer. Less CO₂ lets it cool.",
      "Each doubling of CO₂ adds a fixed jump in temperature — nudge the CO₂ until the predicted temp hits the target.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }

  private buildPanel(): void {
    this.co2Ctl = slider({
      label: "🏭 CO₂ level",
      min: 280,
      max: 1000,
      value: this.co2,
      step: 20,
      unit: "ppm",
      color: "var(--accent-orange)",
      onInput: (v) => {
        this.co2 = v;
        this.updateReadout();
        this.render();
      },
    });
    this.tempRead = readout("🌡️ Global temp");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" } });
    this.coachEl.textContent = "Dial in the CO₂ to hold Earth at the target temperature.";
    this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.settle() }, "🌍 Set climate") as HTMLButtonElement;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target"), el("span", {}, `${this.round().target}°C`)),
      this.co2Ctl.el,
      this.tempRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Climates set"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const t = tempFor(this.co2);
    this.tempRead.set(`${t.toFixed(1)}°C`);
  }

  private settle(): void {
    if (this.ended || this.settling) return;
    this.settling = true;
    this.acc = 0;
    this.co2Ctl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.settling) {
      this.acc += dtMs;
      let steps = 0;
      while (this.settling && this.acc >= 16.67 && steps < 30) {
        const target = tempFor(this.co2);
        this.shownT += (target - this.shownT) * 0.06;
        if (Math.abs(this.shownT - target) < 0.05) {
          this.shownT = target;
          this.settling = false;
          this.evaluate();
        }
        this.acc -= 16.67;
        steps++;
      }
    }
    this.render();
  }

  private evaluate(): void {
    this.co2Ctl.setEnabled(true);
    this.goBtn.disabled = false;
    const t = tempFor(this.co2);
    const target = this.round().target;
    if (Math.abs(t - target) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.coachEl.textContent = "🌍 Balanced! Next target — adjust the CO₂ again.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        t > target ? `Too warm (${t.toFixed(1)}°C) — cut the CO₂ to let heat escape.` : `Too cool (${t.toFixed(1)}°C) — add CO₂ to trap more heat.`;
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("thermostat_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Climate controlled! Greenhouse gases trap heat like a blanket — more CO₂ warms the planet, less lets it cool. That's the greenhouse effect.",
      stars,
      resources: { Climate: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const t = this.settling ? this.shownT : tempFor(this.co2);
    // sky color shifts warmer as it heats
    const warm = Math.max(0, Math.min(1, (t - 14) / 14));
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `hsl(${210 - warm * 180}, 70%, ${60 + warm * 10}%)`);
    grad.addColorStop(1, "#1e3a8a");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#fff";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Climate balanced! 🌍", W / 2, H / 2);
      return;
    }

    // Earth
    c.fillStyle = "#2563eb";
    c.beginPath();
    c.arc(W / 2, 330, 120, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#16a34a";
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(W / 2 + Math.cos(i * 1.6) * 70, 330 + Math.sin(i * 1.6) * 70, 26, 0, Math.PI * 2);
      c.fill();
    }
    // ice caps shrink as it warms
    const ice = Math.max(0, 1 - warm);
    c.fillStyle = "#f8fafc";
    c.beginPath();
    c.ellipse(W / 2, 220, 60 * ice + 10, 22 * ice + 6, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(W / 2, 440, 60 * ice + 10, 22 * ice + 6, 0, 0, Math.PI * 2);
    c.fill();

    // CO₂ blanket (more opaque with more CO₂)
    const blanket = Math.min(0.5, (this.co2 - BASE_CO2) / 1500);
    c.fillStyle = `rgba(120,113,108,${blanket})`;
    c.beginPath();
    c.arc(W / 2, 330, 150, 0, Math.PI * 2);
    c.fill();

    // temperature readout
    c.fillStyle = "#fff";
    c.font = "bold 30px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${t.toFixed(1)}°C`, W / 2, 330);
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Set Earth's thermostat with CO₂ 🌡️", W / 2, 50);
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
    this.settling = false;
    this.co2 = 400;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.shownT = BASE_T;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const thermostatGame: GameModule = {
  meta: {
    id: "thermostat",
    conceptId: "ess-26",
    title: "Planet Thermostat",
    stream: "earth-space",
    gradeBand: "6-8",
    emoji: "🌡️",
    blurb: "Tune Earth's CO₂ to hit the target temperature and see the greenhouse effect in action.",
    mission: "Set the CO₂ level to hold the planet at each target temperature.",
    estMinutes: 4,
  },
  create: (ctx) => new Thermostat(ctx),
};
