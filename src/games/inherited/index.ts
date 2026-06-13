import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Trait {
  key: string;
  label: string;
  emoji: string;
  mom: string;
  dad: string;
}

const TRAITS: Trait[] = [
  { key: "fur", label: "fur colour", emoji: "🎨", mom: "orange", dad: "grey" },
  { key: "ears", label: "ears", emoji: "👂", mom: "pointy", dad: "floppy" },
  { key: "tail", label: "tail", emoji: "〰️", mom: "long", dad: "short" },
];

class Inherited implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private source: Record<string, "mom" | "dad"> = {};
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.randomise();
    this.buildPanel();
    ctx.services.hints.setHints([
      "Living things inherit traits from their parents — that's why offspring look like their mum and dad.",
      "Each feature of the baby matches one of its parents. Compare the baby's trait to each parent.",
      "Look at the highlighted trait on the baby and find the parent that has the same one.",
    ]);
    this.renderLoop();
  }

  private randomise(): void {
    for (const t of TRAITS) this.source[t.key] = Math.random() < 0.5 ? "mom" : "dad";
  }

  private current(): Trait {
    return TRAITS[this.idx];
  }

  private babyValue(t: Trait): string {
    return this.source[t.key] === "mom" ? t.mom : t.dad;
  }

  private buildPanel(): void {
    const choices = el(
      "div",
      { class: "chip-row" },
      el("button", { class: "btn", style: { background: "var(--accent-pink)" }, onclick: () => this.choose("mom") }, "👩 From Mum"),
      el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.choose("dad") }, "👨 From Dad"),
    );

    this.progressEl = el("span", { style: { color: "var(--accent-purple)" } }, `1 / ${TRAITS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
    });
    this.coachEl.textContent = `Where did the baby get its ${this.current().label}?`;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🧬 Trait"),
        el("span", {}, `${this.current().emoji} ${this.current().label}`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Which parent gave this trait?"),
      choices,
      el("div", { class: "metric" }, el("span", {}, "🐱 Trait"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(parent: "mom" | "dad"): void {
    if (this.ended) return;
    const t = this.current();
    const correct = parent === this.source[t.key];
    if (correct) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ The baby's ${this.babyValue(t)} ${t.label} came from ${parent === "mom" ? "Mum" : "Dad"}.`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      const realParent = this.source[t.key] === "mom" ? "Mum" : "Dad";
      this.coachEl.textContent = `❌ Look again — the baby's ${t.label} matches ${realParent}.`;
    }
    this.idx += 1;
    if (this.idx >= TRAITS.length) {
      this.progressEl.textContent = `${TRAITS.length} / ${TRAITS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${TRAITS.length}`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1;
    this.ctx.services.score.event("inherited_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "It's all in the family! Offspring inherit their traits from their parents — that's why a baby animal looks like a mix of its mum and dad.",
      stars,
      resources: { Species: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03);
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private catColor(furValue: string): string {
    return furValue === "orange" ? "#fb923c" : "#94a3b8";
  }

  private drawCat(c: CanvasRenderingContext2D, x: number, y: number, fur: string, ears: string, tail: string, label: string, highlight: string | null): void {
    // body
    c.fillStyle = this.catColor(fur);
    c.beginPath();
    c.arc(x, y, 46, 0, Math.PI * 2);
    c.fill();
    // ears
    c.fillStyle = this.catColor(fur);
    if (ears === "pointy") {
      for (const sx of [-26, 26]) {
        c.beginPath();
        c.moveTo(x + sx, y - 30);
        c.lineTo(x + sx + (sx < 0 ? -12 : 12), y - 64);
        c.lineTo(x + sx + (sx < 0 ? 14 : -14), y - 40);
        c.closePath();
        c.fill();
      }
    } else {
      for (const sx of [-30, 30]) {
        c.beginPath();
        c.ellipse(x + sx, y - 30, 14, 22, sx < 0 ? -0.5 : 0.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    // tail
    c.strokeStyle = this.catColor(fur);
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(x + 40, y + 20);
    if (tail === "long") c.quadraticCurveTo(x + 90, y - 10, x + 80, y - 60);
    else c.quadraticCurveTo(x + 60, y + 10, x + 64, y - 6);
    c.stroke();
    // face
    c.fillStyle = "#1e293b";
    c.beginPath();
    c.arc(x - 16, y - 6, 5, 0, Math.PI * 2);
    c.arc(x + 16, y - 6, 5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y + 8, 4, 0, Math.PI * 2);
    c.fill();

    // highlight ring on the queried trait
    if (highlight) {
      c.strokeStyle = `rgba(155,107,255,${0.6 + Math.sin(this.anim * 3) * 0.3})`;
      c.lineWidth = 4;
      if (highlight === "fur") { c.beginPath(); c.arc(x, y, 54, 0, Math.PI * 2); c.stroke(); }
      else if (highlight === "ears") { c.strokeRect(x - 46, y - 70, 92, 46); }
      else { c.strokeRect(x + 40, y - 64, 56, 90); }
    }

    c.fillStyle = "#4c1d95";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(label, x, y + 76);
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#faf5ff";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#581c87";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Just like family! 🐱", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    }

    const hl = this.current().key;
    // Mum (left), Baby (centre, queried), Dad (right)
    this.drawCat(c, 180, 280, "orange", "pointy", "long", "👩 Mum", null);
    this.drawCat(c, 620, 280, "grey", "floppy", "short", "👨 Dad", null);
    this.drawCat(
      c,
      400,
      300,
      this.babyValue(TRAITS[0]),
      this.babyValue(TRAITS[1]),
      this.babyValue(TRAITS[2]),
      "👶 Baby",
      hl,
    );

    c.fillStyle = "#581c87";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Where did the baby get its ${this.current().emoji} ${this.current().label}?`, W / 2, 60);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.mistakes = 0;
    this.flash = 0;
    this.randomise();
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const inheritedGame: GameModule = {
  meta: {
    id: "inherited",
    conceptId: "bio-18",
    title: "Family Traits",
    stream: "biology",
    gradeBand: "3",
    emoji: "🧬",
    blurb: "Work out which parent each of the baby animal's features came from.",
    mission: "Trace every one of the baby's traits back to a parent.",
    estMinutes: 2,
  },
  create: (ctx) => new Inherited(ctx),
};
