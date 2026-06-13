import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Material {
  name: string;
  emoji: string;
  waterproof: boolean;
  why: string;
}

const MATERIALS: Material[] = [
  { name: "Plastic sheet", emoji: "🧴", waterproof: true, why: "Plastic keeps water out — it's waterproof." },
  { name: "Rubber boot", emoji: "🥾", waterproof: true, why: "Rubber blocks water, so boots keep feet dry." },
  { name: "Foil", emoji: "🪙", waterproof: true, why: "Metal foil doesn't let water through — waterproof." },
  { name: "Paper", emoji: "📄", waterproof: false, why: "Paper soaks up water and goes soggy — not waterproof." },
  { name: "Cotton cloth", emoji: "🧺", waterproof: false, why: "Cotton absorbs water — it gets wet through." },
  { name: "Cardboard", emoji: "📦", waterproof: false, why: "Cardboard soaks up water and falls apart — not waterproof." },
];

class Waterproof implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Material[] = [];
  private idx = 0;
  private mistakes = 0;
  private answered = false;
  private rain: { x: number; y: number; v: number }[] = [];

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...MATERIALS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 40; i++) this.rain.push({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 4 });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Waterproof materials keep water out; others soak it up and get wet.",
      "Smooth, sealed materials like plastic, rubber, and metal are waterproof. Soft, fibrous ones like paper and cloth are not.",
      "Picture rain falling on it: does the water run off, or soak in?",
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
      el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.guess(true) }, "💧 Waterproof"),
      el("button", { class: "btn secondary", onclick: () => this.guess(false) }, "🧽 Soaks in"),
    );

    // Reflect the real position — buildPanel() runs for each material, so a
    // hardcoded "1 / N" would freeze the counter until the last one.
    this.progressEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.idx + 1} / ${MATERIALS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Will rain run off this, or soak in?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "☔ Test"),
        el("span", {}, this.current().name),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Waterproof or not?"),
      choices,
      el("div", { class: "metric" }, el("span", {}, "🧵 Material"), this.progressEl),
      this.coachEl,
    );
  }

  private guess(saysWaterproof: boolean): void {
    if (this.ended || this.answered) return;
    const m = this.current();
    this.answered = true;
    if (saysWaterproof === m.waterproof) {
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${m.why}`;
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${m.why}`;
    }
    setTimeout(() => this.advance(), 850);
  }

  private advance(): void {
    if (this.ended) return;
    this.idx += 1;
    this.answered = false;
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
    this.ctx.services.score.event("waterproof_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Bone dry! Waterproof materials like plastic and rubber keep water out, while paper and cloth soak it up. That's why raincoats aren't made of paper!",
      stars,
      resources: { Materials: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      for (const d of this.rain) {
        d.y += d.v;
        if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
      }
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#475569";
    c.fillRect(0, 0, W, H);

    // rain
    c.strokeStyle = "rgba(186,230,253,0.7)";
    c.lineWidth = 2;
    for (const d of this.rain) {
      c.beginPath();
      c.moveTo(d.x, d.y);
      c.lineTo(d.x - 2, d.y + 10);
      c.stroke();
    }

    if (this.ended) {
      c.fillStyle = "#e0f2fe";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Dry and sorted! ☔", W / 2, H / 2);
      return;
    }

    const m = this.current();
    const cx = W / 2;
    const cy = 280;
    // material card
    c.fillStyle = "#fff";
    c.strokeStyle = "#93c5fd";
    c.lineWidth = 6;
    this.roundRect(c, cx - 150, cy - 130, 300, 250, 22);
    c.fill();
    c.stroke();
    c.font = "100px serif";
    c.textAlign = "center";
    c.fillText(m.emoji, cx, cy + 10);
    c.fillStyle = "#1e3a8a";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(m.name, cx, cy + 80);

    // after answer: show wet (dark) vs dry (beads)
    if (this.answered) {
      if (m.waterproof) {
        c.fillStyle = "#38bdf8";
        for (let i = 0; i < 5; i++) c.fillRect(cx - 80 + i * 40, cy + 95, 10, 6); // beads rolling off
        c.fillStyle = "#22c55e";
        c.font = "bold 16px Nunito, sans-serif";
        c.fillText("water rolls off 💧", cx, cy + 116);
      } else {
        c.fillStyle = "rgba(30,58,138,0.4)";
        this.roundRect(c, cx - 150, cy - 130, 300, 250, 22);
        c.fill();
        c.fillStyle = "#bfdbfe";
        c.font = "bold 16px Nunito, sans-serif";
        c.fillText("soaked through 🧽", cx, cy + 116);
      }
    }

    c.fillStyle = "#e0f2fe";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Will it keep the rain out? ☔", W / 2, 50);
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
    this.order = [...MATERIALS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const waterproofGame: GameModule = {
  meta: {
    id: "waterproof",
    conceptId: "chem-21",
    title: "Stay Dry",
    stream: "chemistry",
    gradeBand: "1-3",
    emoji: "☔",
    blurb: "Decide which materials keep the rain out and which soak it up.",
    mission: "Sort each material into waterproof or not.",
    estMinutes: 2,
  },
  create: (ctx) => new Waterproof(ctx),
};
