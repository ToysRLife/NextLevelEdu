import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const SUN_X = 70;
const SUN_Y = H / 2;

interface Planet {
  key: string;
  name: string;
  chip: string;
  color: string;
  size: number;
  fact: string;
}

// In order from the Sun outward.
const PLANETS: Planet[] = [
  {
    key: "mercury",
    name: "Mercury",
    chip: "⚪",
    color: "#9ca3af",
    size: 7,
    fact: "Closest to the Sun and the smallest planet.",
  },
  {
    key: "venus",
    name: "Venus",
    chip: "🟡",
    color: "#eab308",
    size: 11,
    fact: "The hottest planet, wrapped in thick clouds.",
  },
  {
    key: "earth",
    name: "Earth",
    chip: "🌍",
    color: "#3b82f6",
    size: 12,
    fact: "Our home — the only planet known to have life.",
  },
  {
    key: "mars",
    name: "Mars",
    chip: "🔴",
    color: "#ef4444",
    size: 9,
    fact: "The red planet, with rusty iron dust.",
  },
  {
    key: "jupiter",
    name: "Jupiter",
    chip: "🟠",
    color: "#f59e0b",
    size: 26,
    fact: "The biggest planet — a giant ball of gas.",
  },
  {
    key: "saturn",
    name: "Saturn",
    chip: "🪐",
    color: "#fbbf24",
    size: 22,
    fact: "Famous for its beautiful rings of ice and rock.",
  },
  {
    key: "uranus",
    name: "Uranus",
    chip: "🔵",
    color: "#67e8f9",
    size: 17,
    fact: "An icy giant that spins on its side.",
  },
  {
    key: "neptune",
    name: "Neptune",
    chip: "🔵",
    color: "#3b82f6",
    size: 16,
    fact: "The farthest planet — windy, cold, and deep blue.",
  },
];

class SolarSystem implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private placed = 0; // how many planets correctly placed (from Sun out)
  private tray: Planet[] = [];
  private mistakes = 0;

  private coachEl!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tray = [...PLANETS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "The planets orbit the Sun at different distances — some close and hot, some far and cold.",
      "From the Sun outward: the four small rocky planets first, then the four big gas and ice giants.",
      "Order: My Very Excellent Mother Just Served Us Noodles → Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
    ]);
    this.renderLoop();
  }

  private orbitR(i: number): number {
    return 130 + i * 78;
  }

  private buildPanel(): void {
    const next = PLANETS[this.placed];
    const trayChips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...this.tray.map((p) =>
        el("button", { class: "chip", onclick: () => this.pick(p.key) }, `${p.chip} ${p.name}`)
      )
    );

    this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.placed} / 8`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = next
      ? `Which planet comes next, at orbit #${this.placed + 1} from the Sun?`
      : "Solar system complete!";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Order all 8 planets")
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        `Place orbit #${Math.min(this.placed + 1, 8)} (from the Sun)`
      ),
      trayChips,
      el("div", { class: "metric" }, el("span", {}, "🪐 Placed"), this.statusEl),
      this.coachEl
    );
  }

  private pick(key: string): void {
    if (this.ended) return;
    const correct = PLANETS[this.placed];
    if (key === correct.key) {
      this.placed += 1;
      this.tray = this.tray.filter((p) => p.key !== key);
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${correct.name} — ${correct.fact}`;
      if (this.placed >= PLANETS.length) {
        this.win();
      } else {
        this.buildPanel();
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      const picked = PLANETS.find((p) => p.key === key)!;
      this.coachEl.textContent = `❌ Not ${picked.name} yet. The next planet from the Sun is #${this.placed + 1}. ${correct.fact}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("solarsystem_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "The solar system is built! Eight planets orbit the Sun — four small rocky worlds close in, then four giant gas and ice planets far out.",
      stars,
      resources: { Climate: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.01;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#070b20";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 70; i++) c.fillRect((i * 113) % W, (i * 71) % H, 2, 2);

    // Sun
    const glow = c.createRadialGradient(SUN_X, SUN_Y, 10, SUN_X, SUN_Y, 80);
    glow.addColorStop(0, "#fff7ae");
    glow.addColorStop(1, "rgba(255,200,40,0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(SUN_X, SUN_Y, 80, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.arc(SUN_X, SUN_Y, 40, 0, Math.PI * 2);
    c.fill();

    // orbit rings + placed planets
    for (let i = 0; i < PLANETS.length; i++) {
      const r = this.orbitR(i);
      const isPlaced = i < this.placed;
      const isNext = i === this.placed;
      c.strokeStyle = isNext ? "rgba(47,139,255,0.7)" : "rgba(255,255,255,0.12)";
      c.lineWidth = isNext ? 3 : 1.5;
      if (isNext) c.setLineDash([6, 8]);
      c.beginPath();
      c.arc(SUN_X, SUN_Y, r, -Math.PI / 2.1, Math.PI / 2.1);
      c.stroke();
      c.setLineDash([]);

      if (isPlaced) {
        const p = PLANETS[i];
        const a = -0.5 + Math.sin(this.anim + i) * 0.25;
        const px = SUN_X + Math.cos(a) * r;
        const py = SUN_Y + Math.sin(a) * r;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(px, py, p.size, 0, Math.PI * 2);
        c.fill();
        if (p.key === "saturn") {
          c.strokeStyle = "rgba(251,191,36,0.7)";
          c.lineWidth = 3;
          c.beginPath();
          c.ellipse(px, py, p.size + 12, p.size / 2 + 3, -0.4, 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = "#cbd5e1";
        c.font = "11px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(p.name, px, py + p.size + 14);
      } else if (isNext) {
        const px = SUN_X + r;
        c.fillStyle = "rgba(47,139,255,0.35)";
        c.beginPath();
        c.arc(px, SUN_Y, 14 + Math.sin(this.anim * 6) * 3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#bfdbfe";
        c.font = "bold 13px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText("?", px, SUN_Y + 4);
      }
    }

    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Build the Solar System 🪐", W / 2, 34);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.placed = 0;
    this.mistakes = 0;
    this.tray = [...PLANETS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const solarSystemGame: GameModule = {
  meta: {
    id: "solarsystem",
    conceptId: "ess-08",
    title: "Build the Solar System",
    stream: "earth-space",
    gradeBand: "5",
    emoji: "🪐",
    blurb: "Place all eight planets in their correct order out from the Sun.",
    mission: "Order the planets from Mercury to Neptune to build the solar system.",
    estMinutes: 3,
  },
  create: (ctx) => new SolarSystem(ctx),
};
