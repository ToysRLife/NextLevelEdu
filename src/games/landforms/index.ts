import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Landform {
  key: string;
  name: string;
  why: string;
}

const NAMES = ["Mountain", "Valley", "River", "Island", "Lake", "Plateau"];

const FORMS: Landform[] = [
  {
    key: "Mountain",
    name: "Mountain",
    why: "A mountain is a tall, steep peak rising high above the land.",
  },
  {
    key: "Valley",
    name: "Valley",
    why: "A valley is the low dip of land between hills or mountains.",
  },
  { key: "River", name: "River", why: "A river is flowing water that winds across the land." },
  { key: "Island", name: "Island", why: "An island is land with water all the way around it." },
  { key: "Lake", name: "Lake", why: "A lake is a body of water surrounded by land." },
  { key: "Plateau", name: "Plateau", why: "A plateau is high, flat land with steep sides." },
];

class Landforms implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Landform[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...FORMS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Landforms are the natural shapes of the Earth's surface — like mountains, valleys, and rivers.",
      "Look at the picture: Is it high or low? Is there water? Is it flat on top or pointed?",
      "A peak is a mountain, a low dip is a valley, winding water is a river, land ringed by water is an island.",
    ]);
    this.renderLoop();
  }

  private current(): Landform {
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
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${FORMS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "What landform is shown?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Name every landform")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Which landform is it?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🗺️ Landform"), this.progressEl),
      this.coachEl
    );
  }

  private choose(name: string): void {
    if (this.ended) return;
    const f = this.current();
    if (name === f.name) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${f.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ It's a ${f.name}. ${f.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${FORMS.length} / ${FORMS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${FORMS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("landforms_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Master mapmaker! Landforms are the Earth's natural shapes — mountains, valleys, rivers, islands, lakes, and plateaus.",
      stars,
      resources: { Rock: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.04;
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
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Every landform named! 🗺️", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    }

    // frame for the scene
    const fx = 200,
      fy = 130,
      fw = 400,
      fh = 300;
    c.fillStyle = "#fff";
    c.strokeStyle = "#fdba74";
    c.lineWidth = 6;
    this.roundRect(c, fx, fy, fw, fh, 18);
    c.fill();
    c.stroke();
    c.save();
    c.beginPath();
    this.roundRect(c, fx, fy, fw, fh, 18);
    c.clip();
    this.drawForm(c, this.current().key, fx, fy, fw, fh);
    c.restore();

    c.fillStyle = "#9a3412";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("What landform is this?", W / 2, 60);
  }

  private drawForm(
    c: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const base = y + h;
    // sky
    c.fillStyle = "#cfeffd";
    c.fillRect(x, y, w, h);
    const land = "#84cc16";
    const rock = "#a1887f";
    const water = "#38bdf8";

    if (key === "Mountain") {
      c.fillStyle = land;
      c.fillRect(x, base - 60, w, 60);
      c.fillStyle = rock;
      c.beginPath();
      c.moveTo(x + 60, base - 50);
      c.lineTo(x + 200, y + 60);
      c.lineTo(x + 340, base - 50);
      c.closePath();
      c.fill();
      // snow cap
      c.fillStyle = "#fff";
      c.beginPath();
      c.moveTo(x + 175, y + 95);
      c.lineTo(x + 200, y + 60);
      c.lineTo(x + 225, y + 95);
      c.closePath();
      c.fill();
    } else if (key === "Valley") {
      c.fillStyle = land;
      c.beginPath();
      c.moveTo(x, y + 60);
      c.lineTo(x + 140, base);
      c.lineTo(x + 260, base);
      c.lineTo(x + w, y + 60);
      c.lineTo(x + w, base);
      c.lineTo(x, base);
      c.closePath();
      c.fill();
      c.fillStyle = water;
      c.fillRect(x + 170, base - 30, 60, 30);
    } else if (key === "River") {
      c.fillStyle = land;
      c.fillRect(x, y + 40, w, h - 40);
      c.strokeStyle = water;
      c.lineWidth = 26;
      c.beginPath();
      c.moveTo(x + 40, y + 60);
      c.bezierCurveTo(x + 160, y + 120, x + 240, y + 200, x + 360, base - 20);
      c.stroke();
    } else if (key === "Island") {
      c.fillStyle = water;
      c.fillRect(x, y, w, h);
      c.fillStyle = "#fcd34d";
      c.beginPath();
      c.ellipse(x + w / 2, base - 90, 110, 60, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#16a34a";
      c.fillText("🌴", x + w / 2, base - 90);
      c.font = "40px serif";
      c.textAlign = "center";
      c.fillText("🌴", x + w / 2, base - 80);
    } else if (key === "Lake") {
      c.fillStyle = land;
      c.fillRect(x, y, w, h);
      c.fillStyle = "#3f6212";
      c.fillRect(x, y, w, 40);
      c.fillStyle = water;
      c.beginPath();
      c.ellipse(x + w / 2, y + h / 2 + 20, 130, 80, 0, 0, Math.PI * 2);
      c.fill();
    } else if (key === "Plateau") {
      c.fillStyle = land;
      c.fillRect(x, base - 50, w, 50);
      c.fillStyle = rock;
      c.beginPath();
      c.moveTo(x + 90, base - 40);
      c.lineTo(x + 110, y + 110);
      c.lineTo(x + 290, y + 110);
      c.lineTo(x + 310, base - 40);
      c.closePath();
      c.fill();
      c.fillStyle = "#65a30d";
      c.fillRect(x + 110, y + 100, 180, 14); // flat green top
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
    this.order = [...FORMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const landformsGame: GameModule = {
  meta: {
    id: "landforms",
    conceptId: "ess-13",
    title: "Name That Land",
    stream: "earth-space",
    gradeBand: "2-4",
    emoji: "🗺️",
    blurb: "Identify landforms — mountains, valleys, rivers, islands, lakes, and plateaus.",
    mission: "Name every landform from its picture.",
    estMinutes: 2,
  },
  create: (ctx) => new Landforms(ctx),
};
