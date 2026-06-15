import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const HOT = 90;
const COLD = 10;

const TARGETS = [
  { temp: 30, label: "a cool drink 🥤" },
  { temp: 50, label: "a warm bath 🛁" },
  { temp: 70, label: "hot cocoa ☕" },
];

class Heat implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly tol: number; // match tolerance (adaptive)
  private raf = 0;
  private anim = 0;
  private ended = false;

  private hot = 2;
  private cold = 2;
  private shownTemp = 20; // animated thermometer reading
  private order: typeof TARGETS = [];
  private idx = 0;
  private matched = 0;
  private mistakes = 0;

  private resultEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tol = byTier(ctx.tier, 8, 5, 3);
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Temperature tells how hot or cold something is. Mixing hot and cold water gives a temperature in between.",
      "More hot water pulls the mix hotter; more cold water cools it down. It's a balance of the two.",
      "The result is the average, weighted by how many cups of each. Equal cups give exactly halfway (50°).",
    ]);
    this.renderLoop();
  }

  private target(): (typeof TARGETS)[number] {
    return this.order[this.idx];
  }

  private result(): number {
    const total = this.hot + this.cold;
    if (total === 0) return 20;
    return (this.hot * HOT + this.cold * COLD) / total;
  }

  private buildPanel(): void {
    const hotSlider = el("input", {
      type: "range",
      min: "0",
      max: "8",
      value: String(this.hot),
      "aria-label": "Hot cups",
      style: { accentColor: "var(--accent-red)" },
      oninput: (e: Event) => {
        this.hot = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    const coldSlider = el("input", {
      type: "range",
      min: "0",
      max: "8",
      value: String(this.cold),
      "aria-label": "Cold cups",
      style: { accentColor: "var(--accent-blue)" },
      oninput: (e: Event) => {
        this.cold = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    const checkBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.check() },
      "🌡️ Pour & check",
    );

    this.resultEl = el("span", {}, "");
    // Reflect accumulated progress — buildPanel() runs between rounds, so this
    // must show how many are already matched, not a hardcoded 0.
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.matched} / ${TARGETS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make"),
        el("span", {}, `${this.target().temp}° — ${this.target().label}`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔥 Hot water cups (90°)"),
      hotSlider,
      el("div", { class: "control-label" }, "🧊 Cold water cups (10°)"),
      coldSlider,
      checkBtn,
      el("div", { class: "metric" }, el("span", {}, "🌡️ Mix temp"), this.resultEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const r = this.result();
    this.resultEl.textContent = this.hot + this.cold === 0 ? "—" : `${r.toFixed(0)}°`;
    const diff = r - this.target().temp;
    this.coachEl.textContent =
      this.hot + this.cold === 0
        ? "Add some cups of hot and cold water to mix a temperature."
        : Math.abs(diff) <= this.tol
          ? "That looks just right — pour and check!"
          : diff > 0
            ? "A bit too hot — add cold water or use less hot."
            : "A bit too cold — add hot water or use less cold.";
  }

  private check(): void {
    if (this.ended) return;
    if (this.hot + this.cold === 0) return;
    const r = this.result();
    if (Math.abs(r - this.target().temp) <= this.tol) {
      this.matched += 1;
      this.ctx.services.audio.play("tick");
      this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
      this.idx += 1;
      if (this.matched >= TARGETS.length) {
        this.win();
      } else {
        this.hot = 2;
        this.cold = 2;
        this.buildPanel();
        this.coachEl.textContent = "Perfect mix! Now for the next one.";
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `Not quite — that's ${r.toFixed(0)}°, you need ${this.target().temp}°. Adjust the cups.`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("heat_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Just right! Mixing hot and cold water gives a temperature in between — the more you add of one, the closer the mix moves to it. That's heat sharing out evenly.",
      stars,
      resources: { Fuel: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      this.shownTemp += (this.result() - this.shownTemp) * 0.15;
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
      c.fillText("All mixed just right! 🌡️", W / 2, H / 2);
      return;
    }

    // hot & cold jugs
    this.drawJug(c, 200, "🔥", "#ef4444", this.hot, "Hot 90°");
    this.drawJug(c, 360, "🧊", "#3b82f6", this.cold, "Cold 10°");

    // mixing bowl
    const r = this.shownTemp;
    const mixCol = `hsl(${220 - (r / 100) * 220}, 70%, 55%)`;
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(500, 280, 180, 180);
    c.fillStyle = mixCol;
    c.fillRect(504, 300, 172, 156);
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 4;
    c.strokeRect(500, 280, 180, 180);
    c.fillStyle = "#7c2d12";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Mix", 590, 275);

    // thermometer
    const tx = 590;
    const top = 110;
    const len = 150;
    c.fillStyle = "rgba(255,255,255,0.8)";
    this.roundRect(c, tx - 12, top, 24, len, 12);
    c.fill();
    const frac = Math.max(0, Math.min(1, this.shownTemp / 100));
    c.fillStyle = mixCol;
    this.roundRect(c, tx - 12, top + len - len * frac, 24, len * frac, 12);
    c.fill();
    c.fillStyle = "#7c2d12";
    c.font = "bold 22px Nunito, sans-serif";
    c.fillText(`${this.shownTemp.toFixed(0)}°`, tx, top - 12);
    // target marker
    const ty = top + len - len * (this.target().temp / 100);
    c.strokeStyle = "#16a34a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(tx + 14, ty);
    c.lineTo(tx + 40, ty);
    c.stroke();
    c.fillStyle = "#16a34a";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`target ${this.target().temp}°`, tx + 44, ty + 4);

    c.fillStyle = "#9a3412";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Mix water to ${this.target().temp}° for ${this.target().label}`, W / 2, 40);
  }

  private drawJug(c: CanvasRenderingContext2D, x: number, emoji: string, color: string, cups: number, label: string): void {
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(x - 45, 300, 90, 160);
    const fillH = Math.min(150, cups * 18);
    c.fillStyle = color;
    c.fillRect(x - 41, 456 - fillH, 82, fillH);
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 4;
    c.strokeRect(x - 45, 300, 90, 160);
    c.font = "28px serif";
    c.textAlign = "center";
    c.fillText(emoji, x, 290);
    c.fillStyle = "#7c2d12";
    c.font = "bold 14px Nunito, sans-serif";
    c.fillText(`${label}`, x, 482);
    c.fillText(`${cups} cups`, x, 500);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    if (h <= 0) return;
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.hot = 2;
    this.cold = 2;
    this.shownTemp = 20;
    this.idx = 0;
    this.matched = 0;
    this.mistakes = 0;
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const heatGame: GameModule = {
  meta: {
    id: "heat",
    conceptId: "phys-20",
    title: "Just Right",
    stream: "physics",
    gradeBand: "2-4",
    emoji: "🌡️",
    blurb: "Mix hot and cold water to hit the perfect temperature every time.",
    mission: "Blend hot and cold water to reach each target temperature.",
    estMinutes: 3,
  },
  create: (ctx) => new Heat(ctx),
};
