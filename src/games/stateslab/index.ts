import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";

// States of matter & particle motion (MS-PS1-4): heating gives particles more
// energy so they move faster and spread out. Below freezing they lock into a
// solid; between freezing and boiling they flow as a liquid; above boiling they
// fly apart as a gas. Set the temperature to reach the target state.

const W = 800;
const H = 600;

type State = "Solid" | "Liquid" | "Gas";
const stateFor = (t: number): State => (t < 0 ? "Solid" : t <= 100 ? "Liquid" : "Gas");
const STATE_EMOJI: Record<State, string> = { Solid: "🧊", Liquid: "💧", Gas: "💨" };

const ROUNDS: State[] = ["Liquid", "Gas", "Solid"];

interface P { x: number; y: number; vx: number; vy: number; hx: number; hy: number }

class StatesLab implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private ended = false;

  private temp = 20;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private parts: P[] = [];

  private tempCtl!: SliderHandle;
  private stateRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    // 5x5 lattice of particles with "home" positions for the solid state
    const cols = 5, rows = 5, gap = 70, ox = W / 2 - (cols - 1) * gap / 2, oy = 330 - (rows - 1) * gap / 2;
    for (let r = 0; r < rows; r++)
      for (let cI = 0; cI < cols; cI++) {
        const hx = ox + cI * gap, hy = oy + r * gap;
        this.parts.push({ x: hx, y: hy, vx: 0, vy: 0, hx, hy });
      }
    this.buildPanel();
    ctx.services.hints.setHints([
      "Everything is made of tiny particles. Heating gives them energy, so they move faster.",
      "Cold particles lock into a fixed pattern — a solid. With more heat they break loose and flow — a liquid.",
      "With even more heat they fly apart and zoom around freely — a gas. Set the temperature for the target state.",
    ]);
    this.renderLoop();
  }

  private target(): State {
    return ROUNDS[this.idx];
  }

  private buildPanel(): void {
    this.tempCtl = slider({
      label: "🌡️ Temperature",
      min: -50,
      max: 150,
      value: this.temp,
      step: 1,
      unit: "°C",
      color: "var(--accent-orange)",
      onInput: (v) => { this.temp = v; this.updateReadout(); },
    });
    this.stateRead = readout("🔬 State of matter");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" } });
    this.coachEl.textContent = "Heat or cool the substance until it reaches the target state.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target state"), el("span", {}, `${STATE_EMOJI[this.target()]} ${this.target()}`)),
      this.tempCtl.el,
      this.stateRead.el,
      el("div", { class: "metric" }, el("span", {}, "❄️ Freezes at 0°C · 🔥 boils at 100°C"), el("span", {}, "")),
      el("button", { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.check() }, "🔒 Lock in this state"),
      el("div", { class: "metric" }, el("span", {}, "✅ States reached"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const s = stateFor(this.temp);
    this.stateRead.set(`${STATE_EMOJI[s]} ${s}${s === this.target() ? " ✓" : ""}`);
  }

  private check(): void {
    if (this.ended) return;
    const s = stateFor(this.temp);
    if (s === this.target()) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.win();
      else {
        this.idx += 1;
        this.coachEl.textContent = `${STATE_EMOJI[s]} Nice! Next target — change the temperature.`;
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      const t = this.target();
      this.coachEl.textContent =
        t === "Solid" ? "Need a solid — cool it below 0°C to freeze." : t === "Gas" ? "Need a gas — heat it above 100°C to boil." : "Need a liquid — keep it between 0°C and 100°C.";
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("stateslab_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "State changer! Heat gives particles energy: cold = locked-together solid, warm = flowing liquid, hot = free-flying gas. Temperature controls the state of matter.",
      stars,
      resources: { Energy: 60 },
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

  private step(): void {
    const s = stateFor(this.temp);
    // energy 0..1 from temperature
    const energy = Math.max(0, Math.min(1, (this.temp + 50) / 200));
    const box = { x: 250, y: 130, w: 300, h: 360 };
    for (const p of this.parts) {
      if (s === "Solid") {
        // jiggle around the home lattice site
        const amp = 2 + energy * 6;
        p.x = p.hx + (Math.sin((p.hx + p.y) * 0.5 + performance.now() * 0.005) * amp);
        p.y = p.hy + (Math.cos((p.hy + p.x) * 0.5 + performance.now() * 0.005) * amp);
      } else {
        const speed = s === "Gas" ? 3 + energy * 6 : 1 + energy * 2;
        if (p.vx === 0 && p.vy === 0) { p.vx = (((p.hx % 7) - 3) / 3) * speed; p.vy = (((p.hy % 5) - 2) / 2) * speed; }
        const sp = Math.hypot(p.vx, p.vy) || 1;
        p.vx = (p.vx / sp) * speed;
        p.vy = (p.vy / sp) * speed;
        p.x += p.vx;
        p.y += p.vy;
        // liquid settles toward the bottom (gravity); gas fills the box
        if (s === "Liquid") p.vy += 0.25;
        const lo = s === "Liquid" ? box.y + box.h * 0.45 : box.y;
        if (p.x < box.x + 8) { p.x = box.x + 8; p.vx = Math.abs(p.vx); }
        if (p.x > box.x + box.w - 8) { p.x = box.x + box.w - 8; p.vx = -Math.abs(p.vx); }
        if (p.y < lo + 8) { p.y = lo + 8; p.vy = Math.abs(p.vy); }
        if (p.y > box.y + box.h - 8) { p.y = box.y + box.h - 8; p.vy = -Math.abs(p.vy) * (s === "Liquid" ? 0.6 : 1); }
      }
    }
  }

  private render(): void {
    const c = this.ctx2d;
    const s = stateFor(this.temp);
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#fb923c";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Matter mastered! 🔬", W / 2, H / 2);
      return;
    }
    // beaker
    const box = { x: 250, y: 130, w: 300, h: 360 };
    c.strokeStyle = "#475569";
    c.lineWidth = 4;
    c.strokeRect(box.x, box.y, box.w, box.h);
    // particles
    const col = s === "Solid" ? "#60a5fa" : s === "Liquid" ? "#38bdf8" : "#f472b6";
    for (const p of this.parts) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(p.x, p.y, 9, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#fdba74";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Change the temperature to change the state 🌡️", W / 2, 44);
    c.fillStyle = "#fff";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(`${this.temp}°C — ${STATE_EMOJI[s]} ${s}`, W / 2, 92);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.temp = 20;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    for (const p of this.parts) { p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; }
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const statesLabGame: GameModule = {
  meta: {
    id: "stateslab",
    conceptId: "chem-28",
    title: "States of Matter Lab",
    stream: "chemistry",
    gradeBand: "6-8",
    emoji: "🔬",
    blurb: "Heat and cool a substance to watch its particles lock up, flow, or fly apart — solid, liquid, gas.",
    mission: "Set the temperature to reach each target state of matter.",
    estMinutes: 3,
  },
  create: (ctx) => new StatesLab(ctx),
};
