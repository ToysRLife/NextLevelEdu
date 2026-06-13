import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Material {
  name: string;
  emoji: string;
  conducts: boolean;
  why: string;
}

const MATERIALS: Material[] = [
  { name: "Copper wire", emoji: "🔌", conducts: true, why: "Metals like copper let electricity flow — they're conductors." },
  { name: "Iron nail", emoji: "🔩", conducts: true, why: "Iron is a metal, so it conducts electricity." },
  { name: "Aluminium foil", emoji: "🪙", conducts: true, why: "Aluminium is a metal — electricity flows through it." },
  { name: "Steel spoon", emoji: "🥄", conducts: true, why: "Steel is metal, so the current passes right through." },
  { name: "Wooden stick", emoji: "🪵", conducts: false, why: "Wood blocks electricity — it's an insulator." },
  { name: "Plastic ruler", emoji: "📏", conducts: false, why: "Plastic doesn't let current through — an insulator." },
  { name: "Rubber band", emoji: "⭕", conducts: false, why: "Rubber blocks electricity, which is why wires are wrapped in it." },
  { name: "Glass marble", emoji: "🔮", conducts: false, why: "Glass is an insulator — no current flows." },
];

class Conductors implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Material[] = [];
  private idx = 0;
  private mistakes = 0;
  private lit = 0; // bulb glow 0..1 for current item if conductor (after answer)
  private answered = false;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...MATERIALS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Electricity needs a path it can flow through. Materials that let it flow are conductors; those that block it are insulators.",
      "Most metals are conductors. Wood, plastic, rubber, and glass are insulators.",
      "Place the material in the gap: if the bulb lights, it conducts; if it stays dark, it's an insulator.",
    ]);
    this.renderLoop();
  }

  private current(): Material {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const choices = el(
      "div",
      { class: "chip-row" },
      el(
        "button",
        { class: "btn", style: { background: "var(--accent-yellow)", color: "#1e293b" }, onclick: () => this.guess(true) },
        "⚡ Conducts",
      ),
      el(
        "button",
        { class: "btn secondary", onclick: () => this.guess(false) },
        "🚫 Blocks it",
      ),
    );

    this.progressEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.idx + 1} / ${MATERIALS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Will this material let electricity flow and light the bulb?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🔋 Test in the gap"),
        el("span", {}, this.current().name),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Conductor or insulator?"),
      choices,
      el("div", { class: "metric" }, el("span", {}, "🧪 Material"), this.progressEl),
      this.coachEl,
    );
  }

  private guess(saysConducts: boolean): void {
    if (this.ended || this.answered) return;
    const m = this.current();
    this.answered = true;
    const correct = saysConducts === m.conducts;
    if (correct) {
      this.ctx.services.audio.play(m.conducts ? "reward" : "tick");
      this.coachEl.textContent = `✅ ${m.why}`;
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${m.why}`;
    }
    // brief reveal, then advance
    setTimeout(() => this.advance(), 900);
  }

  private advance(): void {
    if (this.ended) return;
    this.idx += 1;
    this.answered = false;
    this.lit = 0;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${MATERIALS.length} / ${MATERIALS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${MATERIALS.length}`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("conductors_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Circuit complete! Conductors (mostly metals) let electricity flow; insulators (wood, plastic, rubber, glass) block it. That's why wires are metal wrapped in plastic.",
      stars,
      resources: { Power: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      const wantLit = this.answered && this.current().conducts;
      this.lit += ((wantLit ? 1 : 0) - this.lit) * 0.2;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#1e3a8a";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("You know your conductors! ⚡", W / 2, H / 2);
      return;
    }

    const cx = W / 2;
    const wireY = 360;

    // battery
    c.fillStyle = "#334155";
    c.fillRect(120, wireY - 30, 80, 60);
    c.fillStyle = "#fde047";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🔋", 160, wireY + 6);

    // wires
    c.strokeStyle = this.lit > 0.3 ? "#fbbf24" : "#64748b";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(200, wireY);
    c.lineTo(330, wireY); // to gap left
    c.moveTo(470, wireY); // from gap right
    c.lineTo(560, wireY);
    c.lineTo(560, 230);
    c.lineTo(cx, 230); // up to bulb
    c.moveTo(160, wireY - 30);
    c.lineTo(160, 230);
    c.lineTo(cx - 40, 230);
    c.stroke();

    // current flow dots when lit
    if (this.lit > 0.3) {
      c.fillStyle = "#fde047";
      for (let i = 0; i < 6; i++) {
        const t = (this.anim * 0.5 + i / 6) % 1;
        const x = 200 + t * 130;
        c.beginPath();
        c.arc(x, wireY, 3, 0, Math.PI * 2);
        c.fill();
      }
    }

    // the gap with the material under test
    const m = this.current();
    c.fillStyle = "#fff";
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 3;
    this.roundRect(c, 340, wireY - 34, 120, 68, 10);
    c.fill();
    c.stroke();
    c.font = "40px serif";
    c.fillText(m.emoji, 400, wireY + 12);
    c.fillStyle = "#475569";
    c.font = "12px Nunito, sans-serif";
    c.fillText(m.name, 400, wireY + 50);

    // bulb
    const glow = this.lit;
    c.fillStyle = `rgba(253,224,71,${glow})`;
    c.beginPath();
    c.arc(cx, 200, 40 + glow * 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = glow > 0.4 ? "#fde047" : "#cbd5e1";
    c.beginPath();
    c.arc(cx, 200, 28, 0, Math.PI * 2);
    c.fill();
    c.font = "28px serif";
    c.textAlign = "center";
    c.fillText("💡", cx, 210);

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Does it complete the circuit?", W / 2, 60);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.mistakes = 0;
    this.answered = false;
    this.lit = 0;
    this.order = [...MATERIALS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const conductorsGame: GameModule = {
  meta: {
    id: "conductors",
    conceptId: "phys-22",
    title: "Complete the Circuit",
    stream: "physics",
    gradeBand: "4-5",
    emoji: "⚡",
    blurb: "Test materials in a circuit gap to find which conduct electricity and which block it.",
    mission: "Decide whether each material is a conductor or an insulator.",
    estMinutes: 3,
  },
  create: (ctx) => new Conductors(ctx),
};
