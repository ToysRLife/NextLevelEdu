import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const NEED = 3; // habitats to survive

interface Habitat {
  name: string;
  hue: number; // 0..360 target
  light: number; // 0..100 target
  emoji: string;
}

const HABITATS: Habitat[] = [
  { name: "Mossy forest floor", hue: 110, light: 32, emoji: "🌿" },
  { name: "Sandy desert", hue: 42, light: 70, emoji: "🏜️" },
  { name: "Grey rocky shore", hue: 210, light: 55, emoji: "🪨" },
  { name: "Autumn leaves", hue: 28, light: 48, emoji: "🍂" },
];

class Camouflage implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private hue = 0;
  private light = 50;
  private round = 0;
  private order: Habitat[] = [];
  private scan = 0; // predator scan progress 0..1
  private spotted = 0;
  private survived = 0;
  private ended = false;
  private safeFlash = 0;

  private matchEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.order = [...HABITATS].sort(() => Math.random() - 0.5).slice(0, NEED);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Camouflage means blending into your surroundings so predators can't pick you out.",
      "Match BOTH the colour (hue) and how light or dark it is to the habitat behind you.",
      "Watch the 'Blend' meter — get it high before the predator finishes scanning, and you'll vanish into the background.",
    ]);
    this.loop.start();
    this.render();
  }

  private habitat(): Habitat {
    return this.order[this.round];
  }

  private matchPct(): number {
    const h = this.habitat();
    // circular hue difference
    let dh = Math.abs(this.hue - h.hue);
    if (dh > 180) dh = 360 - dh;
    const hueScore = 1 - dh / 180;
    const lightScore = 1 - Math.abs(this.light - h.light) / 100;
    return Math.max(0, Math.min(1, hueScore * 0.6 + lightScore * 0.4));
  }

  private buildPanel(): void {
    const hueSlider = el("input", {
      type: "range",
      min: "0",
      max: "360",
      value: String(this.hue),
      "aria-label": "Colour",
      style: { accentColor: "var(--accent-purple)" },
      oninput: (e: Event) => {
        this.hue = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    const lightSlider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(this.light),
      "aria-label": "Lightness",
      style: { accentColor: "var(--accent-yellow)" },
      oninput: (e: Event) => {
        this.light = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.matchEl = el("span", { style: { color: "var(--accent-green)" } }, "0%");
    this.statusEl = el("span", {}, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" },
    });
    this.coachEl.textContent =
      "Match your skin to the habitat before the predator finishes scanning!";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Hide from ${NEED} predators`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🎨 Colour"),
      hueSlider,
      el("div", { class: "control-label" }, "☀️ Light / dark"),
      lightSlider,
      el("div", { class: "metric" }, el("span", {}, "🫥 Blend"), this.matchEl),
      el("div", { class: "metric" }, el("span", {}, "🏆 Survived"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const pct = Math.round(this.matchPct() * 100);
    this.matchEl.textContent = `${pct}%`;
    this.matchEl.style.color =
      pct > 80 ? "var(--accent-green)" : pct > 50 ? "var(--accent-orange)" : "var(--accent-red)";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    if (this.safeFlash > 0) this.safeFlash = Math.max(0, this.safeFlash - 0.02 * f);

    this.scan += 0.006 * f;
    if (this.scan >= 1) {
      this.scan = 0;
      this.evaluate();
    }
    this.render();
  }

  private evaluate(): void {
    const pct = this.matchPct();
    if (pct >= byTier(this.ctx.tier, 0.7, 0.8, 0.9)) {
      this.survived += 1;
      this.safeFlash = 1;
      this.ctx.services.audio.play("tick");
      this.statusEl.textContent = `${this.survived} / ${NEED}`;
      this.coachEl.textContent = "🫥 Invisible! The predator looked right past you.";
      if (this.survived >= NEED) {
        this.finish();
      } else {
        this.round += 1;
        this.coachEl.textContent += ` New habitat: ${this.habitat().name}.`;
      }
    } else {
      this.spotted += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        pct < 0.5
          ? "👀 Spotted! You stand out — match the habitat's colour and brightness much closer."
          : "👀 Almost hidden, but the predator caught a glimpse. Fine-tune your blend above 80%.";
    }
    this.updateReadout();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.spotted === 0 ? 3 : this.spotted <= 2 ? 2 : 1;
    this.ctx.services.score.event("camouflage_done", { spotted: this.spotted });
    this.ctx.services.outcome.succeed({
      message:
        "You vanished! Camouflage lets animals match their surroundings — colour and brightness — so predators can't tell them apart from the background.",
      stars,
      resources: { Species: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const h = this.habitat();

    // habitat background
    c.fillStyle = `hsl(${h.hue}, 45%, ${h.light}%)`;
    c.fillRect(0, 0, W, H);

    // some texture dots so it reads as a habitat
    c.fillStyle = `hsla(${h.hue}, 40%, ${Math.max(10, h.light - 12)}%, 0.5)`;
    for (let i = 0; i < 60; i++) {
      const x = (i * 137) % W;
      const y = (i * 89) % H;
      c.beginPath();
      c.arc(x, y, 6 + (i % 4) * 3, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "rgba(255,255,255,0.85)";
    this.roundRect(c, 20, 20, 320, 44, 12);
    c.fill();
    c.fillStyle = "#3b0764";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`${h.emoji} ${h.name}`, 36, 48);

    // the creature (a blob) with the player's chosen colour
    const cx = W / 2;
    const cy = H / 2 + 20;
    c.save();
    if (this.safeFlash > 0) {
      c.globalAlpha = 0.3 + (1 - this.safeFlash) * 0.7;
    }
    c.fillStyle = `hsl(${this.hue}, 45%, ${this.light}%)`;
    c.strokeStyle = "rgba(0,0,0,0.15)";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(cx, cy, 70, 54, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // eyes so it reads as a creature
    c.globalAlpha = 1;
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(cx - 22, cy - 10, 12, 0, Math.PI * 2);
    c.arc(cx + 22, cy - 10, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1e293b";
    c.beginPath();
    c.arc(cx - 22, cy - 10, 5, 0, Math.PI * 2);
    c.arc(cx + 22, cy - 10, 5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // predator scan bar
    const barX = 380;
    const barY = 30;
    const barW = 360;
    c.fillStyle = "rgba(255,255,255,0.8)";
    this.roundRect(c, barX, barY, barW, 24, 12);
    c.fill();
    c.fillStyle = "#ff5a5f";
    this.roundRect(c, barX, barY, barW * this.scan, 24, 12);
    c.fill();
    c.fillStyle = "#7f1d1d";
    c.font = "bold 15px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("🦅 Predator scanning…", barX, barY - 8);

    // blend meter readout on canvas
    const pct = Math.round(this.matchPct() * 100);
    c.fillStyle = "rgba(255,255,255,0.85)";
    this.roundRect(c, cx - 60, cy + 70, 120, 30, 8);
    c.fill();
    c.fillStyle = pct > 80 ? "#15803d" : pct > 50 ? "#c2410c" : "#b91c1c";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`Blend ${pct}%`, cx, cy + 90);
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
    this.hue = 0;
    this.light = 50;
    this.round = 0;
    this.scan = 0;
    this.spotted = 0;
    this.survived = 0;
    this.order = [...HABITATS].sort(() => Math.random() - 0.5).slice(0, NEED);
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const camouflageGame: GameModule = {
  meta: {
    id: "camouflage",
    conceptId: "bio-17",
    title: "Now You See Me",
    stream: "biology",
    gradeBand: "3-5",
    emoji: "🦎",
    blurb:
      "Tune your colour and brightness to blend into each habitat before a predator spots you.",
    mission: "Match the habitat closely enough to hide from three hunting predators.",
    estMinutes: 3,
  },
  create: (ctx) => new Camouflage(ctx),
};
