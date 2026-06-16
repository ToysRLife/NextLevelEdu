import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Body {
  key: string;
  name: string;
  why: string;
}

const NAMES = ["Ocean", "River", "Lake", "Pond", "Stream"];

const BODIES: Body[] = [
  {
    key: "Ocean",
    name: "Ocean",
    why: "An ocean is a huge body of salty water — the biggest of all.",
  },
  {
    key: "River",
    name: "River",
    why: "A river is a long flow of water moving across the land to the sea.",
  },
  { key: "Lake", name: "Lake", why: "A lake is a large body of still water surrounded by land." },
  {
    key: "Pond",
    name: "Pond",
    why: "A pond is a small, calm body of water — smaller than a lake.",
  },
  { key: "Stream", name: "Stream", why: "A stream is a small, narrow flow of water." },
];

class BodiesOfWater implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Body[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...BODIES].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Water on Earth comes in different bodies of water, from tiny ponds to vast oceans.",
      "Is it big or small? Still or flowing? Salty or fresh?",
      "Oceans are huge and salty; lakes and ponds are still (pond = small); rivers and streams flow (stream = small).",
    ]);
    this.renderLoop();
  }

  private current(): Body {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...NAMES.map((n) => el("button", { class: "chip", onclick: () => this.choose(n) }, n))
    );
    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-blue)" } },
      `${this.idx + 1} / ${BODIES.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Which body of water is shown?";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Name every water")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "What is it?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "💧 Picture"), this.progressEl),
      this.coachEl
    );
  }

  private choose(name: string): void {
    if (this.ended) return;
    const b = this.current();
    if (name === b.name) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${b.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ It's a ${b.name}. ${b.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${BODIES.length} / ${BODIES.length}`;
      this.win();
    } else this.progressEl.textContent = `${this.idx + 1} / ${BODIES.length}`;
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
    this.ctx.services.score.event("bodiesofwater_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Water expert! Oceans are vast and salty, lakes and ponds hold still water, and rivers and streams flow across the land.",
      stars,
      resources: { Water: 40 },
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
    c.fillStyle = "#bae6fd";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#0c4a6e";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Every water named! 💧", W / 2, H / 2);
      return;
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    }

    const fx = 200,
      fy = 130,
      fw = 400,
      fh = 300;
    c.fillStyle = "#fff";
    c.strokeStyle = "#7dd3fc";
    c.lineWidth = 6;
    this.roundRect(c, fx, fy, fw, fh, 18);
    c.fill();
    c.stroke();
    c.save();
    c.beginPath();
    this.roundRect(c, fx, fy, fw, fh, 18);
    c.clip();
    this.drawWater(c, this.current().key, fx, fy, fw, fh);
    c.restore();

    c.fillStyle = "#0c4a6e";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("What body of water is this?", W / 2, 60);
  }

  private drawWater(
    c: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const base = y + h;
    c.fillStyle = "#dbeafe";
    c.fillRect(x, y, w, h); // sky
    const land = "#86efac";
    const water = "#38bdf8";
    if (key === "Ocean") {
      c.fillStyle = water;
      c.fillRect(x, y + 120, w, h - 120);
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 3;
      for (let r = 0; r < 4; r++) {
        c.beginPath();
        for (let xx = x; xx <= x + w; xx += 8)
          c.lineTo(xx, y + 160 + r * 50 + Math.sin(xx * 0.05 + this.anim + r) * 6);
        c.stroke();
      }
      c.font = "20px serif";
      c.textAlign = "center";
      c.fillText("🌊", x + w / 2, y + 150);
    } else if (key === "River") {
      c.fillStyle = land;
      c.fillRect(x, y + 40, w, h - 40);
      c.strokeStyle = water;
      c.lineWidth = 30;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x + 30, y + 60);
      c.bezierCurveTo(x + 180, y + 120, x + 220, y + 220, x + 370, base - 20);
      c.stroke();
      c.lineCap = "butt";
      // flow arrows
      c.fillStyle = "#fff";
      c.font = "14px serif";
      c.fillText("➤", x + 120, y + 130);
      c.fillText("➤", x + 240, y + 220);
    } else if (key === "Lake") {
      c.fillStyle = land;
      c.fillRect(x, y, w, h);
      c.fillStyle = "#3f6212";
      c.fillRect(x, y, w, 40);
      c.fillStyle = water;
      c.beginPath();
      c.ellipse(x + w / 2, y + h / 2 + 20, 150, 90, 0, 0, Math.PI * 2);
      c.fill();
    } else if (key === "Pond") {
      c.fillStyle = land;
      c.fillRect(x, y, w, h);
      c.fillStyle = water;
      c.beginPath();
      c.ellipse(x + w / 2, y + h / 2 + 30, 80, 50, 0, 0, Math.PI * 2);
      c.fill();
      c.font = "26px serif";
      c.textAlign = "center";
      c.fillText("🪷", x + w / 2 - 20, y + h / 2 + 26);
      c.fillText("🐸", x + w / 2 + 30, y + h / 2 + 40);
    } else if (key === "Stream") {
      c.fillStyle = land;
      c.fillRect(x, y + 40, w, h - 40);
      c.strokeStyle = water;
      c.lineWidth = 14;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x + 60, y + 60);
      c.bezierCurveTo(x + 140, y + 140, x + 260, y + 180, x + 340, base - 30);
      c.stroke();
      c.lineCap = "butt";
      // rocks
      c.font = "16px serif";
      c.fillText("🪨", x + 150, y + 150);
      c.fillText("🪨", x + 250, y + 200);
    }
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
    this.order = [...BODIES].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const bodiesOfWaterGame: GameModule = {
  meta: {
    id: "bodiesofwater",
    conceptId: "ess-12",
    title: "Water World",
    stream: "earth-space",
    gradeBand: "2",
    emoji: "💧",
    blurb: "Identify oceans, rivers, lakes, ponds, and streams from pictures.",
    mission: "Name every body of water.",
    estMinutes: 2,
  },
  create: (ctx) => new BodiesOfWater(ctx),
};
