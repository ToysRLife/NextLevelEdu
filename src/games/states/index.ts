import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const N = 48; // particles

type State = "solid" | "liquid" | "gas";

const STATE_INFO: Record<State, { label: string; emoji: string; color: string }> = {
  solid: { label: "Solid", emoji: "🧊", color: "#60a5fa" },
  liquid: { label: "Liquid", emoji: "💧", color: "#38bdf8" },
  gas: { label: "Gas", emoji: "☁️", color: "#cbd5e1" },
};

// Temperature thresholds (0-100). Below MELT = solid, below BOIL = liquid, else gas.
const MELT = 33;
const BOIL = 66;

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number; // lattice home
  hy: number;
}

class States implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private temp = 15;
  private target: State;
  private particles: P[] = [];
  private holdFrames = 0;
  private ended = false;

  private tempEl!: HTMLElement;
  private stateEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    const targets: State[] = ["liquid", "gas", "solid"];
    this.target = targets[Math.floor(Math.random() * targets.length)];
    this.initParticles();
    this.buildPanel();
    ctx.services.hints.setHints([
      "Heat makes particles move faster. Adding or removing heat changes the state of matter.",
      "Solid = particles locked in a grid. Liquid = particles slide past each other. Gas = particles fly free.",
      `For a ${this.target}, set the temperature into the ${this.target} band on the thermometer and hold it steady.`,
    ]);
    this.loop.start();
  }

  private initParticles(): void {
    this.particles = [];
    const cols = 8;
    const rows = N / cols;
    const spacing = 46;
    const ox = W / 2 - (cols * spacing) / 2 + spacing / 2;
    const oy = H / 2 - (rows * spacing) / 2 + spacing / 2;
    for (let i = 0; i < N; i++) {
      const cx = ox + (i % cols) * spacing;
      const cy = oy + Math.floor(i / cols) * spacing;
      this.particles.push({ x: cx, y: cy, vx: 0, vy: 0, hx: cx, hy: cy });
    }
  }

  private state(): State {
    if (this.temp < MELT) return "solid";
    if (this.temp < BOIL) return "liquid";
    return "gas";
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.temp),
      "aria-label": "Temperature",
      style: { accentColor: "var(--accent-red)" },
      oninput: (e: Event) => {
        this.temp = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.tempEl = el("span", { style: { color: "var(--accent-red)" } }, `${this.temp}°`);
    this.stateEl = el("span", { style: { color: "var(--accent-blue)" } }, "Solid");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-red)", background: "#fef2f2" },
    });

    const info = STATE_INFO[this.target];
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Target"),
        el("span", {}, `${info.emoji} ${info.label}`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "❄️ Cool  ←→  Heat 🔥"),
      slider,
      el("div", { class: "metric" }, el("span", {}, "🌡️ Temp"), this.tempEl),
      el("div", { class: "metric" }, el("span", {}, "🔬 State"), this.stateEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const st = this.state();
    this.tempEl.textContent = `${this.temp.toFixed(0)}°`;
    this.stateEl.textContent = STATE_INFO[st].label;
    if (st === this.target) {
      this.coachEl.textContent = "✅ That's the target state — hold it steady to lock it in!";
    } else if (this.temp < MELT) {
      this.coachEl.textContent = "🧊 Frozen solid: particles are locked in a tight grid.";
    } else if (this.temp < BOIL) {
      this.coachEl.textContent = "💧 Liquid: particles slip and slide past each other.";
    } else {
      this.coachEl.textContent = "☁️ Gas: particles have so much energy they fly apart!";
    }
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    const st = this.state();
    const energy = this.temp / 100;

    for (const p of this.particles) {
      if (st === "solid") {
        // vibrate around lattice home
        const jitter = energy * 6;
        p.vx += (p.hx - p.x) * 0.08 + (Math.random() - 0.5) * jitter * 0.3;
        p.vy += (p.hy - p.y) * 0.08 + (Math.random() - 0.5) * jitter * 0.3;
        p.vx *= 0.7;
        p.vy *= 0.7;
      } else if (st === "liquid") {
        const speed = 0.6 + energy * 1.2;
        p.vx += (Math.random() - 0.5) * speed;
        p.vy += (Math.random() - 0.5) * speed + 0.06; // gentle settle
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else {
        const speed = 1.5 + energy * 2.5;
        p.vx += (Math.random() - 0.5) * speed;
        p.vy += (Math.random() - 0.5) * speed;
        p.vx *= 0.99;
        p.vy *= 0.99;
      }
      p.x += p.vx * f;
      p.y += p.vy * f;

      // container walls
      const m = 60;
      const liquidTop = st === "liquid" ? H * 0.42 : m;
      if (p.x < m) {
        p.x = m;
        p.vx = Math.abs(p.vx);
      }
      if (p.x > W - m) {
        p.x = W - m;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < liquidTop) {
        p.y = liquidTop;
        p.vy = Math.abs(p.vy);
      }
      if (p.y > H - m) {
        p.y = H - m;
        p.vy = -Math.abs(p.vy) * (st === "gas" ? 1 : 0.4);
      }
    }

    if (st === this.target) {
      this.holdFrames += f;
      if (this.holdFrames >= 75) this.win();
    } else {
      this.holdFrames = 0;
    }

    this.render();
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("states_match", { target: this.target });
    this.ctx.services.outcome.succeed({
      message: `You turned the matter into a ${this.target} by controlling its temperature. That's a phase change!`,
      stars,
      resources: { Materials: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const st = this.state();
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);

    // container
    const m = 50;
    c.strokeStyle = "#475569";
    c.lineWidth = 6;
    c.strokeRect(m, m, W - 2 * m, H - 2 * m);

    // thermometer-style band hint on the right edge
    const bandX = W - m - 14;
    c.fillStyle = "rgba(96,165,250,0.25)";
    c.fillRect(bandX, H - m - (MELT / 100) * (H - 2 * m), 10, (MELT / 100) * (H - 2 * m));
    c.fillStyle = "rgba(56,189,248,0.25)";
    c.fillRect(bandX, H - m - (BOIL / 100) * (H - 2 * m), 10, ((BOIL - MELT) / 100) * (H - 2 * m));

    const info = STATE_INFO[st];
    c.fillStyle = info.color;
    for (const p of this.particles) {
      c.beginPath();
      c.arc(p.x, p.y, 11, 0, Math.PI * 2);
      c.fill();
      if (st === "solid") {
        c.strokeStyle = "rgba(255,255,255,0.4)";
        c.lineWidth = 2;
        c.stroke();
      }
    }

    c.fillStyle = "#e2e8f0";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`${info.emoji} ${info.label}`, m + 12, m + 30);

    if (this.holdFrames > 0 && st === this.target) {
      const pct = Math.min(1, this.holdFrames / 75);
      c.fillStyle = "#22c55e";
      c.fillRect(m, H - m + 8, (W - 2 * m) * pct, 8);
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
    this.ended = false;
    this.holdFrames = 0;
    this.temp = 15;
    this.initParticles();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const statesGame: GameModule = {
  meta: {
    id: "states",
    conceptId: "chem-02",
    title: "Change of State",
    stream: "chemistry",
    gradeBand: "2",
    emoji: "🧊",
    blurb: "Heat it up or cool it down to turn matter into a solid, liquid, or gas.",
    mission:
      "Control the temperature to change the matter into the target state — then hold it steady.",
    estMinutes: 3,
  },
  create: (ctx) => new States(ctx),
};
