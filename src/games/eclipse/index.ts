import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const EX = 380;
const EY = 320;
const ORBIT = 150;
const SUN_X = 760;

interface Target {
  key: "solar" | "lunar";
  label: string;
  emoji: string;
  hint: string;
}

const TARGETS: Target[] = [
  { key: "solar", label: "Solar eclipse", emoji: "🌑", hint: "Solar eclipse: the Moon moves between the Sun and Earth, casting its shadow on us." },
  { key: "lunar", label: "Lunar eclipse", emoji: "🔴", hint: "Lunar eclipse: Earth is between the Sun and Moon, so Earth's shadow falls on the Moon." },
];

class Eclipse implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private theta = Math.PI / 2;
  private dragging = false;
  private idx = 0;
  private matched = 0;
  private hold = 0;

  private alignEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => { this.dragging = true; this.setFromPointer(p); },
      move: (p) => { if (this.dragging) this.setFromPointer(p); },
      up: () => { this.dragging = false; },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "An eclipse happens when the Sun, Earth, and Moon line up in a straight row.",
      "A solar eclipse needs the Moon between the Sun and Earth. A lunar eclipse needs Earth in the middle.",
      "Drag the Moon onto the Sun–Earth line: toward the Sun for a solar eclipse, opposite the Sun for a lunar one.",
    ]);
    this.renderLoop();
  }

  private target(): Target {
    return TARGETS[this.idx];
  }

  private setFromPointer(p: Point): void {
    if (this.ended) return;
    this.theta = Math.atan2(p.y - EY, p.x - EX);
    this.updateReadout();
  }

  private cos(): number {
    return Math.cos(this.theta);
  }

  private aligned(): "solar" | "lunar" | null {
    if (this.cos() > 0.99) return "solar"; // moon toward the Sun
    if (this.cos() < -0.99) return "lunar"; // moon opposite the Sun
    return null;
  }

  private buildPanel(): void {
    this.alignEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-purple)" } }, `0 / ${TARGETS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make a"),
        el("span", {}, `${this.target().emoji} ${this.target().label}`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag the Moon to line things up"),
      el("div", { class: "metric" }, el("span", {}, "📐 Alignment"), this.alignEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Made"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const a = this.aligned();
    this.alignEl.textContent = a === "solar" ? "Sun–Moon–Earth 🌑" : a === "lunar" ? "Sun–Earth–Moon 🔴" : "not lined up";
    this.coachEl.textContent = this.target().hint;
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.02;
      if (!this.ended) {
        if (this.aligned() === this.target().key) {
          this.hold += 1;
          if (this.hold > byTier(this.ctx.tier, 18, 30, 45)) this.match();
        } else {
          this.hold = 0;
        }
      }
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private match(): void {
    this.matched += 1;
    this.hold = 0;
    this.ctx.services.audio.play("reward");
    this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
    this.coachEl.textContent = `✅ ${this.target().hint}`;
    this.idx += 1;
    if (this.matched >= TARGETS.length) this.win();
    else this.buildPanel();
  }

  private win(): void {
    this.ended = true;
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("eclipse_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Eclipse expert! Eclipses happen when the Sun, Earth, and Moon line up. Moon in the middle = solar eclipse; Earth in the middle = lunar eclipse.",
      stars,
      resources: { Climate: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#070b20";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 50; i++) c.fillRect((i * 151) % W, (i * 83) % H, 2, 2);

    const mx = EX + Math.cos(this.theta) * ORBIT;
    const my = EY + Math.sin(this.theta) * ORBIT;
    const align = this.aligned();

    // sun
    const glow = c.createRadialGradient(SUN_X, EY, 10, SUN_X, EY, 80);
    glow.addColorStop(0, "#fff7ae");
    glow.addColorStop(1, "rgba(255,200,40,0)");
    c.fillStyle = glow;
    c.beginPath(); c.arc(SUN_X, EY, 80, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffd23f";
    c.beginPath(); c.arc(SUN_X, EY, 40, 0, Math.PI * 2); c.fill();

    // orbit
    c.strokeStyle = "rgba(255,255,255,0.18)";
    c.setLineDash([5, 7]);
    c.beginPath(); c.arc(EX, EY, ORBIT, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // solar eclipse shadow: moon between sun and earth → dark spot on earth
    if (align === "solar") {
      c.strokeStyle = "rgba(40,40,60,0.6)";
      c.fillStyle = "rgba(20,20,40,0.5)";
      c.beginPath();
      c.moveTo(mx, my - 18);
      c.lineTo(EX - 30, EY - 20);
      c.lineTo(EX - 30, EY + 20);
      c.lineTo(mx, my + 18);
      c.closePath();
      c.fill();
    }

    // earth
    c.fillStyle = "#2f6fb0";
    c.beginPath(); c.arc(EX, EY, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3f8f4f";
    c.beginPath(); c.arc(EX - 8, EY - 6, 10, 0, Math.PI * 2); c.fill();
    if (align === "solar") {
      // shadow patch on earth
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.beginPath(); c.arc(EX - 14, EY, 10, 0, Math.PI * 2); c.fill();
    }

    // moon — turns red in lunar eclipse (Earth's shadow)
    let moonCol = "#cbd5e1";
    if (align === "lunar") moonCol = "#b91c1c";
    c.fillStyle = moonCol;
    c.beginPath(); c.arc(mx, my, 14, 0, Math.PI * 2); c.fill();
    // drag ring
    c.strokeStyle = this.dragging ? "#22c55e" : "rgba(255,255,255,0.6)";
    c.lineWidth = 3;
    c.beginPath(); c.arc(mx, my, 20, 0, Math.PI * 2); c.stroke();

    // lunar eclipse cone: earth shadow onto moon
    if (align === "lunar") {
      c.fillStyle = "rgba(40,0,0,0.35)";
      c.beginPath();
      c.moveTo(EX + 30, EY - 20);
      c.lineTo(mx, my - 16);
      c.lineTo(mx, my + 16);
      c.lineTo(EX + 30, EY + 20);
      c.closePath();
      c.fill();
    }

    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Make a ${this.target().label} ${this.target().emoji}`, W / 2, 40);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#86efac";
      c.font = "bold 14px Nunito, sans-serif";
      c.fillText("aligning…", W / 2, 64);
    }
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.theta = Math.PI / 2;
    this.idx = 0;
    this.matched = 0;
    this.hold = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const eclipseGame: GameModule = {
  meta: {
    id: "eclipse",
    conceptId: "ess-07",
    title: "Eclipse!",
    stream: "earth-space",
    gradeBand: "5",
    emoji: "🌑",
    blurb: "Line up the Sun, Earth, and Moon to create solar and lunar eclipses.",
    mission: "Align the three to make a solar eclipse and a lunar eclipse.",
    estMinutes: 3,
  },
  create: (ctx) => new Eclipse(ctx),
};
