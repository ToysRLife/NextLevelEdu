import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Use {
  key: string;
  label: string;
  emoji: string;
}
const USES: Use[] = [
  { key: "wood", label: "Paper & wood", emoji: "📄" },
  { key: "drink", label: "Drinking", emoji: "🚰" },
  { key: "solar", label: "Solar power", emoji: "⚡" },
  { key: "fuel", label: "Car fuel", emoji: "⛽" },
  { key: "build", label: "Buildings & metal", emoji: "🏗️" },
];

interface Resource {
  name: string;
  emoji: string;
  use: string;
  why: string;
}
const RESOURCES: Resource[] = [
  { name: "Trees", emoji: "🌳", use: "wood", why: "Trees give us wood and paper." },
  {
    name: "Fresh water",
    emoji: "💧",
    use: "drink",
    why: "We use fresh water for drinking and washing.",
  },
  {
    name: "Sunlight",
    emoji: "☀️",
    use: "solar",
    why: "Solar panels turn sunlight into electricity.",
  },
  { name: "Oil", emoji: "🛢️", use: "fuel", why: "Oil is refined into fuel for cars and planes." },
  {
    name: "Rock & minerals",
    emoji: "🪨",
    use: "build",
    why: "Rock and minerals build our homes and make metal.",
  },
];

class Resources implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Resource[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...RESOURCES].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Natural resources are useful things we get from the Earth — water, trees, sunlight, minerals, and fuels.",
      "Think about what each resource is used to make or do.",
      "Trees → wood/paper, water → drinking, sunlight → solar power, oil → fuel, rock → buildings.",
    ]);
    this.renderLoop();
  }

  private current(): Resource {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...USES.map((u) =>
        el("button", { class: "chip", onclick: () => this.choose(u.key) }, `${u.emoji} ${u.label}`)
      )
    );
    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${RESOURCES.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "What do we mainly use this resource for?";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🌍 Resource"),
        el("span", {}, this.current().name)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Match it to its use"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "♻️ Resource"), this.progressEl),
      this.coachEl
    );
  }

  private choose(key: string): void {
    if (this.ended) return;
    const r = this.current();
    if (key === r.use) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${r.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${r.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${RESOURCES.length} / ${RESOURCES.length}`;
      this.win();
    } else this.progressEl.textContent = `${this.idx + 1} / ${RESOURCES.length}`;
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
    this.ctx.services.score.event("resources_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Resourceful! Natural resources from the Earth — water, trees, sunlight, oil, and minerals — give us nearly everything we use.",
      stars,
      resources: { Minerals: 40 },
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

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All matched! 🌍", W / 2, H / 2);
      return;
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }
    const r = this.current();
    const cx = W / 2,
      cy = 280 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#fdba74";
    c.lineWidth = 6;
    this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
    c.fill();
    c.stroke();
    c.font = "120px serif";
    c.textAlign = "center";
    c.fillText(r.emoji, cx, cy + 20);
    c.fillStyle = "#9a3412";
    c.font = "bold 26px Nunito, sans-serif";
    c.fillText(r.name, cx, cy + 100);
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("What do we use it for? 🌍", W / 2, 60);
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
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
    this.flash = 0;
    this.order = [...RESOURCES].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const resourcesGame: GameModule = {
  meta: {
    id: "resources",
    conceptId: "ess-20",
    title: "Earth's Gifts",
    stream: "earth-space",
    gradeBand: "4",
    emoji: "🌍",
    blurb: "Match each natural resource to what we use it for.",
    mission: "Match every natural resource to its main use.",
    estMinutes: 2,
  },
  create: (ctx) => new Resources(ctx),
};
