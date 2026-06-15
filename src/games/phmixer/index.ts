import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Acids & bases (MS-PS1-2): pH measures how acidic or basic a solution is — low
// is acidic, 7 is neutral, high is basic. Adding acid to a base neutralizes it.
// Pour acid into a fixed base solution to hit the target pH.

const W = 800;
const H = 600;
const BASE_VOL = 50; // mL of 0.1 M base
const CONC = 0.1; // mol/L for both acid and base

const pHfor = (acidVol: number): number => {
  const netOH = BASE_VOL * CONC - acidVol * CONC; // mmol (base − acid)
  const total = BASE_VOL + acidVol; // mL
  if (Math.abs(netOH) < 1e-9) return 7;
  if (netOH > 0) {
    const oh = netOH / total; // mol/L
    return Math.max(0, Math.min(14, 14 + Math.log10(oh)));
  }
  const h = -netOH / total;
  return Math.max(0, Math.min(14, -Math.log10(h)));
};

// Universal-indicator colour for a pH.
const colorFor = (pH: number): string =>
  pH < 3 ? "#dc2626" : pH < 5 ? "#f97316" : pH < 6.5 ? "#facc15" : pH < 7.5 ? "#22c55e" : pH < 9 ? "#14b8a6" : pH < 11.5 ? "#3b82f6" : "#7c3aed";

const ROUNDS: number[] = [12, 7, 2]; // target pH values

class PhMixer implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private readonly tol: number;

  private acidVol = 0;
  private idx = 0;
  private hits = 0;
  private misses = 0;

  private acidCtl!: SliderHandle;
  private phRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tol = byTier(ctx.tier, 0.6, 0.4, 0.3);
    this.buildPanel();
    ctx.services.hints.setHints([
      "pH runs from 0 to 14: below 7 is acidic, exactly 7 is neutral, above 7 is basic.",
      "We start with a basic solution (high pH). Adding acid cancels out base — that's neutralization.",
      "Pour just enough acid: too little stays basic, too much turns it acidic. Equal amounts meet at neutral pH 7.",
    ]);
    this.renderLoop();
  }

  private target(): number {
    return ROUNDS[this.idx];
  }

  private buildPanel(): void {
    this.acidCtl = slider({
      label: "🧪 Acid added",
      min: 0,
      max: 100,
      value: this.acidVol,
      step: 1,
      unit: "mL",
      color: "var(--accent-red)",
      onInput: (v) => { this.acidVol = v; this.updateReadout(); },
    });
    this.phRead = readout("🌈 Solution pH");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-red)", background: "#fef2f2" } });
    this.coachEl.textContent = "Pour acid into the base to reach the target pH.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target pH"), el("span", {}, `${this.target()}`)),
      el("div", { class: "metric" }, el("span", {}, "🧫 Starting base"), el("span", {}, `${BASE_VOL} mL · pH ${pHfor(0).toFixed(1)}`)),
      this.acidCtl.el,
      this.phRead.el,
      el("button", { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.check() }, "🌈 Test the pH"),
      el("div", { class: "metric" }, el("span", {}, "✅ pH targets hit"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const ph = pHfor(this.acidVol);
    const tag = ph < 6.5 ? "acidic" : ph > 7.5 ? "basic" : "neutral";
    this.phRead.set(`${ph.toFixed(1)} (${tag})`);
  }

  private check(): void {
    if (this.ended) return;
    const ph = pHfor(this.acidVol);
    if (Math.abs(ph - this.target()) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.win();
      else {
        this.idx += 1;
        this.coachEl.textContent = "🌈 Spot on! Next target pH — pour again.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        ph > this.target() ? `pH ${ph.toFixed(1)} is too basic — add more acid.` : `pH ${ph.toFixed(1)} is too acidic — you added too much acid.`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("phmixer_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "pH pro! Acids have a low pH, bases a high pH, and mixing them neutralizes toward 7. The universal indicator shows it as a rainbow from red (acid) to purple (base).",
      stars,
      resources: { Compounds: 60 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    const ph = pHfor(this.acidVol);
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#a78bfa";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("pH balanced! 🌈", W / 2, H / 2);
      return;
    }
    // pH scale bar
    for (let i = 0; i <= 14; i++) {
      c.fillStyle = colorFor(i);
      c.fillRect(120 + i * 40, 110, 38, 26);
    }
    c.fillStyle = "#fff";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "center";
    for (const v of [0, 7, 14]) c.fillText(String(v), 120 + v * 40 + 19, 152);
    // marker at current pH
    const mx = 120 + ph * 40 + 19;
    c.fillStyle = "#fff";
    c.beginPath();
    c.moveTo(mx, 98);
    c.lineTo(mx - 8, 84);
    c.lineTo(mx + 8, 84);
    c.closePath();
    c.fill();

    // beaker with liquid coloured by pH
    const bx = W / 2 - 90, by = 250, bw = 180, bh = 260;
    c.strokeStyle = "#cbd5e1";
    c.lineWidth = 5;
    c.strokeRect(bx, by, bw, bh);
    const fill = 0.55 + Math.min(0.4, this.acidVol / 250);
    const lh = bh * fill;
    c.fillStyle = colorFor(ph);
    c.fillRect(bx + 4, by + bh - lh, bw - 8, lh - 4);
    // surface ripple
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 2;
    c.beginPath();
    for (let x = 0; x <= bw - 8; x += 6) c.lineTo(bx + 4 + x, by + bh - lh + Math.sin(x * 0.1 + this.anim) * 3);
    c.stroke();

    c.fillStyle = "#fff";
    c.font = "bold 30px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`pH ${ph.toFixed(1)}`, W / 2, by + bh / 2);
    c.font = "bold 18px Nunito, sans-serif";
    c.fillStyle = "#fca5a5";
    c.fillText("Pour acid to hit the target pH 🧪", W / 2, 44);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.acidVol = 0;
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

export const phMixerGame: GameModule = {
  meta: {
    id: "phmixer",
    conceptId: "chem-29",
    title: "pH Mixer",
    stream: "chemistry",
    gradeBand: "6-8",
    emoji: "🧪",
    blurb: "Pour acid into a base and watch the universal indicator change colour as you hit each target pH.",
    mission: "Add the right amount of acid to reach each target pH.",
    estMinutes: 3,
  },
  create: (ctx) => new PhMixer(ctx),
};
