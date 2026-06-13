import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

type Part = "root" | "stem" | "leaf" | "flower";

interface PartInfo {
  key: Part;
  name: string;
  job: string;
  jobShort: string;
}

const PARTS: PartInfo[] = [
  { key: "root", name: "Roots", job: "drink up water and hold the plant in the soil", jobShort: "💧 Drink water & anchor" },
  { key: "stem", name: "Stem", job: "hold the plant up and carry water to the leaves", jobShort: "🪵 Hold up & carry water" },
  { key: "leaf", name: "Leaf", job: "catch sunlight to make food for the plant", jobShort: "☀️ Make food from sunlight" },
  { key: "flower", name: "Flower", job: "make seeds so new plants can grow", jobShort: "🌸 Make seeds" },
];

class PlantParts implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: PartInfo[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...PARTS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Every part of a plant has a special job that helps it live and grow.",
      "Roots are underground, the stem is the tall middle, leaves are flat and green, and the flower is colourful at the top.",
      "Roots drink water, the stem carries it up, leaves make food from sunlight, and the flower makes seeds.",
    ]);
    this.renderLoop();
  }

  private current(): PartInfo {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    // job choices (shuffled labels)
    const choices = [...PARTS].sort(() => Math.random() - 0.5);
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...choices.map((p) =>
        el("button", { class: "chip", onclick: () => this.choose(p.key) }, p.jobShort),
      ),
    );

    this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `1 / ${PARTS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = "What job does the glowing part do?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Part"),
        el("span", {}, this.current().name),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick this part's job"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🌱 Part"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(key: Part): void {
    if (this.ended) return;
    const cur = this.current();
    if (key === cur.key) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ The ${cur.name.toLowerCase()} ${cur.job}.`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ That's another part's job. The ${cur.name.toLowerCase()} ${cur.job}.`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${PARTS.length} / ${PARTS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${PARTS.length}`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("plantparts_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Plant expert! Roots drink water and anchor the plant, the stem holds it up and carries water, leaves make food from sunlight, and flowers make seeds.",
      stars,
      resources: { Seeds: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.06;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03);
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private glow(on: boolean): string {
    return on ? `rgba(250,204,21,${0.5 + Math.sin(this.anim * 3) * 0.3})` : "transparent";
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#f0fdf4";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#166534";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("You know your plant parts! 🌻", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    }

    const active = this.current().key;
    const cx = W / 2;
    const soilY = 470;

    // soil
    c.fillStyle = "#7c4a1e";
    c.fillRect(0, soilY, W, H - soilY);

    // glowing halo helper
    const haloFor = (key: Part, x: number, y: number, r: number) => {
      if (active === key) {
        c.fillStyle = this.glow(true);
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    };

    // roots
    haloFor("root", cx, soilY + 50, 90);
    c.strokeStyle = "#a16207";
    c.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(cx, soilY);
      c.quadraticCurveTo(cx + i * 30, soilY + 40, cx + i * 55, soilY + 90);
      c.stroke();
    }

    // stem
    haloFor("stem", cx, soilY - 90, 40);
    c.strokeStyle = "#16a34a";
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(cx, soilY);
    c.lineTo(cx, 240);
    c.stroke();

    // leaves
    haloFor("leaf", cx - 70, soilY - 150, 55);
    haloFor("leaf", cx + 70, soilY - 200, 55);
    c.fillStyle = "#22c55e";
    c.save();
    c.translate(cx - 60, soilY - 150);
    c.rotate(-0.6);
    c.beginPath();
    c.ellipse(-30, 0, 50, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.save();
    c.translate(cx + 60, soilY - 200);
    c.rotate(0.6);
    c.beginPath();
    c.ellipse(30, 0, 50, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // flower
    haloFor("flower", cx, 210, 60);
    c.fillStyle = "#ff4fa3";
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      c.beginPath();
      c.ellipse(cx + Math.cos(a) * 28, 210 + Math.sin(a) * 28, 18, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.arc(cx, 210, 20, 0, Math.PI * 2);
    c.fill();

    // pointer label on the active part
    c.fillStyle = "#166534";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Which job does the ${this.current().name} do?`, W / 2, 50);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.idx = 0;
    this.mistakes = 0;
    this.flash = 0;
    this.order = [...PARTS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const plantPartsGame: GameModule = {
  meta: {
    id: "plantparts",
    conceptId: "bio-04",
    title: "Plant Parts",
    stream: "biology",
    gradeBand: "1-2",
    emoji: "🌻",
    blurb: "Match each part of a plant — root, stem, leaf, flower — to the job it does.",
    mission: "Figure out the job of every part of the plant.",
    estMinutes: 2,
  },
  create: (ctx) => new PlantParts(ctx),
};
