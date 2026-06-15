import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Gas behaviour (MS-PS1-4): gas pressure comes from particles hitting the walls.
// Heating speeds the particles up (more pressure); squeezing into a smaller
// volume packs the hits closer (more pressure). Ideal gas law: P = nRT / V.
// Set temperature and volume to reach the target pressure.

const W = 800;
const H = 600;
const R = 8.314; // J/(mol·K)
const N = 1; // mol

const pressureFor = (tempC: number, volL: number): number => (N * R * (tempC + 273)) / volL; // kPa

interface Round {
  target: number; // kPa
}
const ROUNDS: Round[] = [{ target: 200 }, { target: 500 }, { target: 1000 }];

interface P { x: number; y: number; vx: number; vy: number }

class GasLab implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private ended = false;
  private readonly tol: number;

  private temp = 25;
  private vol = 10;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private parts: P[] = [];

  private tempCtl!: SliderHandle;
  private volCtl!: SliderHandle;
  private pRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tol = byTier(ctx.tier, 60, 40, 25);
    for (let i = 0; i < 28; i++) this.parts.push({ x: 300 + (i % 7) * 25, y: 200 + Math.floor(i / 7) * 25, vx: ((i % 5) - 2) || 1, vy: ((i % 3) - 1) || 1 });
    this.buildPanel();
    ctx.services.hints.setHints([
      "A gas pushes on its container because its particles are constantly bouncing off the walls.",
      "Heat the gas and the particles move faster, hitting harder and more often — pressure goes up.",
      "Shrink the volume and the same particles hit the walls more often — pressure goes up too. P = nRT ÷ V.",
    ]);
    this.renderLoop();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private pressure(): number {
    return pressureFor(this.temp, this.vol);
  }

  private buildPanel(): void {
    this.tempCtl = slider({
      label: "🌡️ Temperature",
      min: 0,
      max: 200,
      value: this.temp,
      step: 5,
      unit: "°C",
      color: "var(--accent-orange)",
      onInput: (v) => { this.temp = v; this.updateReadout(); },
    });
    this.volCtl = slider({
      label: "📦 Volume",
      min: 1,
      max: 20,
      value: this.vol,
      step: 0.5,
      unit: "L",
      color: "var(--accent-blue)",
      onInput: (v) => { this.vol = v; this.updateReadout(); },
    });
    this.pRead = readout("⏲️ Pressure (nRT ÷ V)");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" } });
    this.coachEl.textContent = "Set temperature and volume to reach the target pressure.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target pressure"), el("span", {}, `${this.round().target} kPa`)),
      this.tempCtl.el,
      this.volCtl.el,
      this.pRead.el,
      el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.check() }, "⏲️ Read the gauge"),
      el("div", { class: "metric" }, el("span", {}, "✅ Pressures hit"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.pRead.set(`${this.pressure().toFixed(0)} kPa`);
  }

  private check(): void {
    if (this.ended) return;
    const p = this.pressure();
    if (Math.abs(p - this.round().target) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.win();
      else {
        this.idx += 1;
        this.coachEl.textContent = "⏲️ Nailed the pressure! Next target.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        p < this.round().target ? `${p.toFixed(0)} kPa is too low — heat it up or shrink the volume.` : `${p.toFixed(0)} kPa is too high — cool it down or expand the volume.`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("gaslab_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Pressure pro! Gas pressure comes from particles bouncing off the walls. More heat = faster, harder hits; less volume = more frequent hits. That's P = nRT ÷ V.",
      stars,
      resources: { Materials: 60 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.step();
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private boxRect(): { x: number; y: number; w: number; h: number } {
    // width shrinks with volume; box centred
    const w = 120 + (this.vol / 20) * 280;
    return { x: W / 2 - w / 2, y: 170, w, h: 300 };
  }

  private step(): void {
    const speed = 1.5 + (this.temp / 200) * 6;
    const b = this.boxRect();
    for (const p of this.parts) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      p.vx = (p.vx / sp) * speed;
      p.vy = (p.vy / sp) * speed;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < b.x + 7) { p.x = b.x + 7; p.vx = Math.abs(p.vx); }
      if (p.x > b.x + b.w - 7) { p.x = b.x + b.w - 7; p.vx = -Math.abs(p.vx); }
      if (p.y < b.y + 7) { p.y = b.y + 7; p.vy = Math.abs(p.vy); }
      if (p.y > b.y + b.h - 7) { p.y = b.y + b.h - 7; p.vy = -Math.abs(p.vy); }
    }
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#60a5fa";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Gas laws mastered! ⏲️", W / 2, H / 2);
      return;
    }
    const b = this.boxRect();
    // walls (piston feel)
    c.fillStyle = "#334155";
    c.fillRect(b.x - 14, b.y - 14, 14, b.h + 28);
    c.fillRect(b.x + b.w, b.y - 14, 14, b.h + 28);
    c.strokeStyle = "#64748b";
    c.lineWidth = 3;
    c.strokeRect(b.x, b.y, b.w, b.h);
    // particles, colour warms with temperature
    const warm = this.temp / 200;
    c.fillStyle = `hsl(${210 - warm * 200}, 80%, 60%)`;
    for (const p of this.parts) {
      c.beginPath();
      c.arc(p.x, p.y, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#93c5fd";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Squeeze and heat the gas to set the pressure ⏲️", W / 2, 44);
    c.fillStyle = "#fff";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(`${this.pressure().toFixed(0)} kPa  ·  ${this.temp}°C  ·  ${this.vol} L`, W / 2, 92);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.temp = 25;
    this.vol = 10;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const gasLabGame: GameModule = {
  meta: {
    id: "gaslab",
    conceptId: "chem-30",
    title: "Gas Lab",
    stream: "chemistry",
    gradeBand: "6-8",
    emoji: "⏲️",
    blurb: "Heat and squeeze a gas to control its pressure — and feel the ideal gas law in action.",
    mission: "Set temperature and volume to hit each target pressure.",
    estMinutes: 4,
  },
  create: (ctx) => new GasLab(ctx),
};
