import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, type SliderHandle } from "@core/controls";

// Conservation of mass (MS-PS1-5): atoms are never created or destroyed in a
// reaction — they're just rearranged. So a chemical equation must have the SAME
// number of each atom on both sides. Set the coefficients to balance it.

const W = 800;
const H = 600;

interface Species {
  formula: string;
  atoms: Record<string, number>;
}
interface Equation {
  reactants: Species[];
  products: Species[];
}

const ROUNDS: Equation[] = [
  {
    reactants: [{ formula: "H₂", atoms: { H: 2 } }, { formula: "O₂", atoms: { O: 2 } }],
    products: [{ formula: "H₂O", atoms: { H: 2, O: 1 } }],
  },
  {
    reactants: [{ formula: "N₂", atoms: { N: 2 } }, { formula: "H₂", atoms: { H: 2 } }],
    products: [{ formula: "NH₃", atoms: { N: 1, H: 3 } }],
  },
  {
    reactants: [{ formula: "CH₄", atoms: { C: 1, H: 4 } }, { formula: "O₂", atoms: { O: 2 } }],
    products: [{ formula: "CO₂", atoms: { C: 1, O: 2 } }, { formula: "H₂O", atoms: { H: 2, O: 1 } }],
  },
];

class BalanceIt implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private ended = false;

  private idx = 0;
  private hits = 0;
  private misses = 0;
  private coeffs: number[] = [];

  private ctls: SliderHandle[] = [];
  private tallyEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.buildPanel();
    ctx.services.hints.setHints([
      "In a chemical reaction atoms are only rearranged — none are created or destroyed. That's conservation of mass.",
      "So each element must have the same total count on the left (reactants) and right (products).",
      "Change the big numbers (coefficients) in front of each molecule until every atom count matches on both sides.",
    ]);
    this.render();
  }

  private eq(): Equation {
    return ROUNDS[this.idx];
  }
  private species(): Species[] {
    return [...this.eq().reactants, ...this.eq().products];
  }

  private elements(): string[] {
    const set = new Set<string>();
    for (const s of this.species()) for (const k of Object.keys(s.atoms)) set.add(k);
    return [...set];
  }

  // total atoms of `elem` on one side given current coefficients (offset into coeffs)
  private sideCount(side: Species[], offset: number, elem: string): number {
    return side.reduce((sum, s, i) => sum + this.coeffs[offset + i] * (s.atoms[elem] ?? 0), 0);
  }

  private buildPanel(): void {
    const sp = this.species();
    this.coeffs = sp.map(() => 1);
    this.ctls = sp.map((s, i) =>
      slider({
        label: `${s.formula} coefficient`,
        min: 1,
        max: 6,
        value: 1,
        step: 1,
        color: i < this.eq().reactants.length ? "var(--accent-blue)" : "var(--accent-green)",
        onInput: (v) => { this.coeffs[i] = v; this.updateTally(); this.render(); },
      }),
    );
    this.tallyEl = el("div", { class: "readout", style: { whiteSpace: "normal", lineHeight: "1.6" } });
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" } });
    this.coachEl.textContent = "Match every atom count on both sides to balance the equation.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "⚖️ Balance"), el("span", {}, this.equationText())),
      ...this.ctls.map((c) => c.el),
      this.tallyEl,
      el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.check() }, "⚖️ Check balance"),
      el("div", { class: "metric" }, el("span", {}, "✅ Balanced"), this.statusEl),
      this.coachEl,
    );
    this.updateTally();
  }

  private equationText(): string {
    const r = this.eq().reactants.map((s) => s.formula).join(" + ");
    const p = this.eq().products.map((s) => s.formula).join(" + ");
    return `${r} → ${p}`;
  }

  private balanced(): boolean {
    const rOff = 0;
    const pOff = this.eq().reactants.length;
    return this.elements().every((e) => this.sideCount(this.eq().reactants, rOff, e) === this.sideCount(this.eq().products, pOff, e));
  }

  private updateTally(): void {
    const pOff = this.eq().reactants.length;
    const rows = this.elements().map((e) => {
      const l = this.sideCount(this.eq().reactants, 0, e);
      const r = this.sideCount(this.eq().products, pOff, e);
      return `${e}: ${l} ${l === r ? "=" : "≠"} ${r}`;
    });
    this.tallyEl.textContent = "Atom tally — " + rows.join("  ·  ");
    this.tallyEl.style.color = this.balanced() ? "var(--accent-green)" : "var(--ink)";
  }

  private check(): void {
    if (this.ended) return;
    if (this.balanced()) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.win();
      else {
        this.idx += 1;
        this.coachEl.textContent = "⚖️ Balanced! Atoms conserved. Next equation.";
        this.buildPanel();
        this.render();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      const pOff = this.eq().reactants.length;
      const off = this.elements().find((e) => this.sideCount(this.eq().reactants, 0, e) !== this.sideCount(this.eq().products, pOff, e));
      this.coachEl.textContent = `Not balanced yet — ${off} doesn't match on both sides. Adjust the coefficients.`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("balanceit_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Balanced! Atoms are never created or destroyed in a reaction — only rearranged. That's why a balanced equation has the same count of every atom on both sides.",
      stars,
      resources: { Elements: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#4ade80";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Equations balanced! ⚖️", W / 2, H / 2);
      return;
    }
    // balance beam tilting toward the heavier side (by total atoms)
    const pOff = this.eq().reactants.length;
    let lAtoms = 0, rAtoms = 0;
    for (const e of this.elements()) {
      lAtoms += this.sideCount(this.eq().reactants, 0, e);
      rAtoms += this.sideCount(this.eq().products, pOff, e);
    }
    const tilt = Math.max(-0.25, Math.min(0.25, (rAtoms - lAtoms) * 0.04));
    const cx = W / 2;
    const cy = 230;
    c.strokeStyle = "#cbd5e1";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx, cy + 120);
    c.stroke();
    c.save();
    c.translate(cx, cy);
    c.rotate(tilt);
    c.strokeStyle = this.balanced() ? "#4ade80" : "#f59e0b";
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(-220, 0);
    c.lineTo(220, 0);
    c.stroke();
    // pans
    for (const [x, label, atoms, side] of [[-220, "Reactants", lAtoms, this.eq().reactants], [220, "Products", rAtoms, this.eq().products]] as [number, string, number, Species[]][]) {
      c.fillStyle = "#1e293b";
      c.fillRect(x - 70, 40, 140, 8);
      c.fillStyle = "#e2e8f0";
      c.font = "bold 16px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText(`${label}: ${atoms} atoms`, x, 78);
      const off = side === this.eq().reactants ? 0 : pOff;
      const text = side.map((s, i) => `${this.coeffs[off + i]}·${s.formula}`).join(" + ");
      c.font = "15px Nunito, sans-serif";
      c.fillText(text, x, 100);
    }
    c.restore();
    c.fillStyle = "#93c5fd";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Balance the chemical equation ⚖️", W / 2, 44);
    c.fillStyle = "#fff";
    c.font = "bold 24px Nunito, sans-serif";
    c.fillText(this.equationText(), W / 2, 420);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.render();
  }
  destroy(): void {}
}

export const balanceItGame: GameModule = {
  meta: {
    id: "balanceit",
    conceptId: "chem-27",
    title: "Balance It",
    stream: "chemistry",
    gradeBand: "6-8",
    emoji: "⚖️",
    blurb: "Set the coefficients so every atom is accounted for — and discover conservation of mass.",
    mission: "Balance each chemical equation so atoms match on both sides.",
    estMinutes: 4,
  },
  create: (ctx) => new BalanceIt(ctx),
};
