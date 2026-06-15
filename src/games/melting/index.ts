import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;

type State = "ice" | "water" | "steam";

const TARGETS: { state: State; label: string; emoji: string }[] = [
  { state: "water", label: "Liquid water", emoji: "💧" },
  { state: "ice", label: "Solid ice", emoji: "🧊" },
  { state: "steam", label: "Steam (gas)", emoji: "💨" },
];

class Melting implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private temp = 20; // -20..120 °C
  private order: typeof TARGETS = [];
  private idx = 0;
  private matched = 0;
  private hold = 0;
  private anim = 0;
  private ended = false;

  private stateEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Water changes state at certain temperatures: it freezes at 0°C and boils at 100°C.",
      "Below 0° it's solid ice. Between 0° and 100° it's liquid water. Above 100° it becomes steam (gas).",
      "These changes are reversible — heat ice to melt it, cool steam to get water back. Slide the temperature to the right zone.",
    ]);
    this.loop.start();
    this.render();
  }

  private target(): (typeof TARGETS)[number] {
    return this.order[this.idx];
  }

  private state(): State {
    if (this.temp < 0) return "ice";
    if (this.temp > 100) return "steam";
    return "water";
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "-20",
      max: "120",
      value: String(this.temp),
      "aria-label": "Temperature",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        this.temp = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.stateEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `0 / ${TARGETS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make"),
        el("span", {}, `${this.target().emoji} ${this.target().label}`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🌡️ Temperature (°C)"),
      slider,
      el("div", { class: "metric" }, el("span", {}, "🔬 State now"), this.stateEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const s = this.state();
    this.stateEl.textContent = `${this.temp}°  ${s === "ice" ? "🧊 Ice" : s === "water" ? "💧 Water" : "💨 Steam"}`;
    this.coachEl.textContent =
      s === "ice"
        ? "Below 0°C the water is frozen solid as ice."
        : s === "steam"
          ? "Above 100°C the water boils into steam — a gas."
          : "Between 0° and 100°C the water is liquid.";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.anim += 0.05 * f;
    if (this.state() === this.target().state) {
      this.hold += f;
      if (this.hold > byTier(this.ctx.tier, 26, 36, 50)) this.matchOne();
    } else {
      this.hold = 0;
    }
    this.render();
  }

  private matchOne(): void {
    this.matched += 1;
    this.hold = 0;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
    this.idx += 1;
    if (this.matched >= TARGETS.length) this.finish();
    else this.buildPanel();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("melting_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "State changer! Water freezes to ice at 0°C and boils to steam at 100°C — and it's all reversible. Heat melts and boils; cooling freezes and condenses.",
      stars,
      resources: { Energy: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff";
    c.fillRect(0, 0, W, H);

    const s = this.state();
    const beaker = { x: 300, y: 200, w: 200, h: 280 };

    // beaker
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(beaker.x, beaker.y, beaker.w, beaker.h);

    if (s === "ice") {
      // ice block
      c.fillStyle = "#bae6fd";
      c.fillRect(beaker.x + 30, beaker.y + 120, beaker.w - 60, beaker.h - 130);
      c.strokeStyle = "rgba(255,255,255,0.8)";
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        c.strokeRect(beaker.x + 30 + i * 8, beaker.y + 120 + i * 6, beaker.w - 60 - i * 16, beaker.h - 130 - i * 12);
      }
      c.font = "40px serif";
      c.textAlign = "center";
      c.fillText("🧊", beaker.x + beaker.w / 2, beaker.y + 100);
    } else if (s === "water") {
      const top = beaker.y + 120;
      c.fillStyle = "rgba(56,189,248,0.7)";
      c.fillRect(beaker.x, top, beaker.w, beaker.y + beaker.h - top);
      // small bubbles near boiling
      if (this.temp > 80) {
        c.fillStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 6; i++) {
          const bx = beaker.x + 20 + ((i * 31) % (beaker.w - 40));
          const by = beaker.y + beaker.h - 10 - ((this.anim * 40 + i * 30) % (beaker.h - 130));
          c.beginPath();
          c.arc(bx, by, 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else {
      // steam: little water + rising steam
      const top = beaker.y + beaker.h - 50;
      c.fillStyle = "rgba(56,189,248,0.5)";
      c.fillRect(beaker.x, top, beaker.w, 50);
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        const sx = beaker.x + 40 + i * 40;
        c.beginPath();
        c.moveTo(sx, beaker.y + 60);
        c.quadraticCurveTo(sx + Math.sin(this.anim + i) * 18, beaker.y, sx, beaker.y - 60);
        c.stroke();
      }
    }

    c.strokeStyle = "#94a3b8";
    c.lineWidth = 5;
    c.strokeRect(beaker.x, beaker.y, beaker.w, beaker.h);

    // thermometer with 0 and 100 marks
    const tx = 600;
    const top = 160;
    const len = 280;
    c.fillStyle = "rgba(255,255,255,0.8)";
    this.roundRect(c, tx - 14, top, 28, len, 14);
    c.fill();
    const frac = (this.temp + 20) / 140; // -20..120 → 0..1
    const col = this.temp < 0 ? "#3b82f6" : this.temp > 100 ? "#ef4444" : "#22c55e";
    c.fillStyle = col;
    this.roundRect(c, tx - 14, top + len - len * frac, 28, len * frac, 14);
    c.fill();
    // 0 and 100 marks
    c.strokeStyle = "#1e293b";
    c.lineWidth = 2;
    for (const mark of [0, 100]) {
      const my = top + len - len * ((mark + 20) / 140);
      c.beginPath();
      c.moveTo(tx + 16, my);
      c.lineTo(tx + 40, my);
      c.stroke();
      c.fillStyle = "#1e293b";
      c.font = "12px Nunito, sans-serif";
      c.textAlign = "left";
      c.fillText(`${mark}°`, tx + 44, my + 4);
    }
    c.fillStyle = "#1e293b";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${this.temp}°C`, tx, top - 14);

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText(`Make ${this.target().label} ${this.target().emoji}`, W / 2, 60);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#16a34a";
      c.font = "bold 14px Nunito, sans-serif";
      c.fillText("hold it…", beaker.x + beaker.w / 2, beaker.y - 14);
    }
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

  start(): void {
    if (!this.ended) this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (!this.ended) this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.ended = false;
    this.temp = 20;
    this.idx = 0;
    this.matched = 0;
    this.hold = 0;
    this.order = [...TARGETS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const meltingGame: GameModule = {
  meta: {
    id: "melting",
    conceptId: "chem-03",
    title: "Melt & Freeze",
    stream: "chemistry",
    gradeBand: "2-3",
    emoji: "🧊",
    blurb: "Change the temperature to turn water into ice, liquid, or steam — and back again.",
    mission: "Set the temperature to make ice, liquid water, and steam.",
    estMinutes: 2,
  },
  create: (ctx) => new Melting(ctx),
};
