import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Feature {
  key: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
}

const FEATURES: Feature[] = [
  { key: "forest", name: "Forest", emoji: "🌲", x: 250, y: 220 },
  { key: "mountain", name: "Mountain", emoji: "⛰️", x: 560, y: 200 },
  { key: "lake", name: "Lake", emoji: "💧", x: 320, y: 400 },
  { key: "town", name: "Town", emoji: "🏠", x: 560, y: 410 },
  { key: "bridge", name: "Bridge", emoji: "🌉", x: 430, y: 300 },
];

class Maps implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Feature[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...FEATURES].sort(() => Math.random() - 0.5);
    this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
    this.buildPanel();
    ctx.services.hints.setHints([
      "A map is a picture of a place from above. Symbols stand for real things.",
      "Each little picture on the map is a symbol — a tree for a forest, a house for a town.",
      "Read the symbol and find it on the map.",
    ]);
    this.renderLoop();
  }

  private current(): Feature {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${FEATURES.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = `Find the ${this.current().name.toLowerCase()} on the map.`;
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🗺️ Find the"),
        el("span", {}, `${this.current().emoji} ${this.current().name}`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap it on the map"),
      el("div", { class: "metric" }, el("span", {}, "📍 Place"), this.progressEl),
      this.coachEl
    );
  }

  private tap(p: Point): void {
    if (this.ended) return;
    const want = this.current();
    if (Math.hypot(p.x - want.x, p.y - want.y) < 48) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ There's the ${want.name.toLowerCase()}!`;
      this.next();
      return;
    }
    const other = FEATURES.find((f) => f.key !== want.key && Math.hypot(p.x - f.x, p.y - f.y) < 48);
    if (other) {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ That's the ${other.name.toLowerCase()}. Find the ${want.name.toLowerCase()}.`;
    }
  }

  private next(): void {
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${FEATURES.length} / ${FEATURES.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${FEATURES.length}`;
      this.buildPanel();
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
    this.ctx.services.score.event("maps_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Map reader! Maps show places from above, and symbols stand for real features like forests, mountains, lakes, and towns.",
      stars,
      resources: { Rock: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.04);
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
      c.fillText("Map mastered! 🗺️", W / 2, H / 2);
      return;
    }

    // map frame
    const m = { x: 140, y: 120, w: 520, h: 380 };
    c.fillStyle = "#e7d8b8";
    this.roundRect(c, m.x, m.y, m.w, m.h, 14);
    c.fill();
    c.strokeStyle = "#a16207";
    c.lineWidth = 6;
    this.roundRect(c, m.x, m.y, m.w, m.h, 14);
    c.stroke();
    // a road + river hint
    c.strokeStyle = "#9ca3af";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(m.x, 300);
    c.lineTo(m.x + m.w, 300);
    c.stroke();
    c.strokeStyle = "#7dd3fc";
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(320, m.y);
    c.quadraticCurveTo(360, 300, 320, m.y + m.h);
    c.stroke();

    // compass
    c.fillStyle = "#9a3412";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("N", m.x + m.w - 24, m.y + 24);

    for (const f of FEATURES) {
      const want = f.key === this.current().key;
      if (want) {
        c.fillStyle = `rgba(245,158,11,${0.25 + Math.sin(this.anim * 3) * 0.15})`;
        c.beginPath();
        c.arc(f.x, f.y, 40, 0, Math.PI * 2);
        c.fill();
      }
      c.font = "40px serif";
      c.textAlign = "center";
      c.fillText(f.emoji, f.x, f.y + 14);
    }

    c.fillStyle = "#9a3412";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Tap the ${this.current().name} ${this.current().emoji}`, W / 2, 60);
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
    this.order = [...FEATURES].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const mapsGame: GameModule = {
  meta: {
    id: "maps",
    conceptId: "ess-23",
    title: "Map Reader",
    stream: "earth-space",
    gradeBand: "2-4",
    emoji: "🗺️",
    blurb: "Read a map and find the forest, mountain, lake, town, and bridge.",
    mission: "Find every feature on the map from its symbol.",
    estMinutes: 2,
  },
  create: (ctx) => new Maps(ctx),
};
