import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;

interface Recipe {
  r: number;
  y: number;
  b: number;
}
interface Target {
  name: string;
  recipe: Recipe;
}

// Targets are defined as paint recipes, then mixed with the SAME model the
// player uses — so every target is reachable.
const TARGETS: Target[] = [
  { name: "Orange 🍊", recipe: { r: 0.85, y: 1.0, b: 0 } },
  { name: "Green 🌿", recipe: { r: 0, y: 1.0, b: 0.7 } },
  { name: "Purple 🍇", recipe: { r: 0.8, y: 0, b: 0.85 } },
];

// Subtractive paint mixing: each paint filters white light.
function mix(r: number, y: number, b: number): [number, number, number] {
  const trans = (amt: number, base: number) => 1 - amt * (1 - base);
  const tr = { R: trans(r, 1), G: trans(r, 0.15), B: trans(r, 0.15) };
  const ty = { R: trans(y, 1), G: trans(y, 1), B: trans(y, 0.1) };
  const tb = { R: trans(b, 0.15), G: trans(b, 0.5), B: trans(b, 1) };
  return [
    Math.round(255 * tr.R * ty.R * tb.R),
    Math.round(255 * tr.G * ty.G * tb.G),
    Math.round(255 * tr.B * ty.B * tb.B),
  ];
}

class ColorMix implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private ended = false;

  private r = 0;
  private y = 0;
  private b = 0;
  private idx = 0;
  private matched = 0;
  private mistakes = 0;

  private matchEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Red, yellow, and blue are the primary paint colors — mixing them makes every other color.",
      "Red + yellow makes orange. Yellow + blue makes green. Red + blue makes purple.",
      "Add more of two primaries and none of the third. Watch the match meter climb toward 100%.",
    ]);
    this.renderLoop();
  }

  private target(): Target {
    return TARGETS[this.idx];
  }

  private targetRGB(): [number, number, number] {
    const t = this.target().recipe;
    return mix(t.r, t.y, t.b);
  }

  private matchPct(): number {
    const [r1, g1, b1] = mix(this.r, this.y, this.b);
    const [r2, g2, b2] = this.targetRGB();
    const dist = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    return Math.max(0, 1 - dist / 160);
  }

  private slider(
    label: string,
    accent: string,
    get: () => number,
    set: (v: number) => void
  ): HTMLElement {
    const input = el("input", {
      type: "range",
      min: "0",
      max: "100",
      value: String(get() * 100),
      "aria-label": label,
      style: { accentColor: accent },
      oninput: (e: Event) => {
        set(Number((e.target as HTMLInputElement).value) / 100);
        this.updateReadout();
      },
    });
    return el("div", {}, el("div", { class: "control-label" }, label), input);
  }

  private buildPanel(): void {
    const checkBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-pink)" }, onclick: () => this.check() },
      "🎨 Check color"
    );

    this.matchEl = el("span", { style: { color: "var(--accent-green)" } }, "0%");
    this.statusEl = el("span", {}, `0 / ${TARGETS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = "Mix the paints until your blob matches the target swatch.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make"),
        el("span", {}, this.target().name)
      ),
      this.slider(
        "🔴 Red paint",
        "#ef4444",
        () => this.r,
        (v) => (this.r = v)
      ),
      this.slider(
        "🟡 Yellow paint",
        "#eab308",
        () => this.y,
        (v) => (this.y = v)
      ),
      this.slider(
        "🔵 Blue paint",
        "#3b82f6",
        () => this.b,
        (v) => (this.b = v)
      ),
      checkBtn,
      el("div", { class: "metric" }, el("span", {}, "🎯 Match"), this.matchEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Done"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const pct = Math.round(this.matchPct() * 100);
    this.matchEl.textContent = `${pct}%`;
    this.matchEl.style.color =
      pct > 90 ? "var(--accent-green)" : pct > 60 ? "var(--accent-orange)" : "var(--accent-red)";
  }

  private check(): void {
    if (this.ended) return;
    if (this.matchPct() >= byTier(this.ctx.tier, 0.82, 0.9, 0.95)) {
      this.matched += 1;
      this.ctx.services.audio.play("tick");
      this.statusEl.textContent = `${this.matched} / ${TARGETS.length}`;
      this.coachEl.textContent = `✅ That's it — you mixed ${this.target().name}!`;
      this.idx += 1;
      if (this.matched >= TARGETS.length) {
        this.win();
      } else {
        this.r = this.y = this.b = 0;
        this.buildPanel();
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        "Not quite that shade yet — adjust the two primary colors that make it.";
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("colormix_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "You're a color wizard! Mixing the primary paints — red, yellow, and blue — makes brand-new colors: orange, green, and purple.",
      stars,
      resources: { Compounds: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fdf2f8";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#831843";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All colors mixed! 🌈", W / 2, H / 2);
      return;
    }

    // target swatch
    const [tr, tg, tb] = this.targetRGB();
    c.fillStyle = "#831843";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Target", 230, 110);
    c.fillStyle = `rgb(${tr},${tg},${tb})`;
    this.roundRect(c, 110, 130, 240, 240, 24);
    c.fill();
    c.strokeStyle = "#9d174d";
    c.lineWidth = 4;
    c.stroke();

    // your mix swatch
    const [mr, mg, mb] = mix(this.r, this.y, this.b);
    c.fillStyle = "#831843";
    c.fillText("Your mix", 570, 110);
    c.fillStyle = `rgb(${mr},${mg},${mb})`;
    this.roundRect(c, 450, 130, 240, 240, 24);
    c.fill();
    c.strokeStyle = "#9d174d";
    c.stroke();

    // pouring drips representing amounts
    const drip = (x: number, amt: number, color: string) => {
      c.fillStyle = color;
      c.fillRect(x - 14, 420, 28, 20 + amt * 120);
      c.beginPath();
      c.arc(x, 420 + 20 + amt * 120, 14, 0, Math.PI * 2);
      c.fill();
    };
    drip(500, this.r, "#ef4444");
    drip(570, this.y, "#eab308");
    drip(640, this.b, "#3b82f6");

    // match bar
    const pct = this.matchPct();
    c.fillStyle = "rgba(255,255,255,0.7)";
    this.roundRect(c, 450, 390, 240, 18, 9);
    c.fill();
    c.fillStyle = pct > 0.9 ? "#22c55e" : "#f59e0b";
    this.roundRect(c, 450, 390, 240 * pct, 18, 9);
    c.fill();
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
    if (w <= 0) return;
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
    this.r = this.y = this.b = 0;
    this.idx = 0;
    this.matched = 0;
    this.mistakes = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const colorMixGame: GameModule = {
  meta: {
    id: "colormix",
    conceptId: "chem-24",
    title: "Color Mixer",
    stream: "chemistry",
    gradeBand: "K-2",
    emoji: "🎨",
    blurb: "Blend red, yellow, and blue paint to match each target color.",
    mission: "Mix the primary paints to create orange, green, and purple.",
    estMinutes: 2,
  },
  create: (ctx) => new ColorMix(ctx),
};
