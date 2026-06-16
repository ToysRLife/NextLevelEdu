import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const GROUND = 520;
const N = 56; // rock columns
const COLW = W / N;
const TOL = 14; // how close a column must be to the target
const START_H = 200; // flat plateau to carve down from

type Agent = "water" | "wind" | "ice";
const AGENTS: { key: Agent; label: string; emoji: string; teaches: string }[] = [
  {
    key: "water",
    label: "Water",
    emoji: "💧",
    teaches: "Running water carves narrow, deep valleys and canyons.",
  },
  {
    key: "wind",
    label: "Wind",
    emoji: "🌬️",
    teaches: "Wind wears away rock slowly over a wide area, smoothing it.",
  },
  {
    key: "ice",
    label: "Ice",
    emoji: "🧊",
    teaches: "Freezing and thawing cracks chunks off the rock.",
  },
];

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

class Weathering implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private heights: number[] = [];
  private target: number[] = [];
  private active: Agent = "water";
  private dragging = false;
  private debris: Debris[] = [];
  private elapsed = 0;
  private started = false;

  private matchEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.buildLand();
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        this.dragging = true;
        this.erode(p);
      },
      move: (p) => {
        if (this.dragging) this.erode(p);
      },
      up: () => {
        this.dragging = false;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Weathering and erosion slowly wear rock away. Water, wind, and ice each shape the land in their own way.",
      "Match the tool to the shape: water cuts deep narrow valleys, wind smooths wide areas, ice breaks off chunks.",
      "Carve the deep dips with water, then smooth the broad slopes with wind, until the rock matches the dashed target.",
    ]);
    this.renderLoop();
  }

  private buildLand(): void {
    this.heights = Array.from({ length: N }, () => START_H);
    this.target = Array.from({ length: N }, (item, index) => {
      const t = index / (N - 1);
      // two rounded hills with a valley between — a believable eroded profile
      return Math.round(70 + 80 * (0.5 + 0.5 * Math.cos(t * Math.PI * 4)));
    });
  }

  private buildPanel(): void {
    const palette = el(
      "div",
      { class: "chip-row" },
      ...AGENTS.map((a) =>
        el(
          "button",
          {
            class: "chip",
            style:
              this.active === a.key
                ? {
                    background: "var(--accent-blue)",
                    color: "#fff",
                    borderColor: "var(--accent-blue)",
                  }
                : {},
            onclick: () => {
              this.active = a.key;
              this.ctx.services.audio.play("click");
              this.buildPanel();
            },
          },
          `${a.emoji} ${a.label}`
        )
      )
    );

    this.matchEl = el("span", { style: { color: "var(--accent-blue)" } }, "0%");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent =
      "Pick an agent, then drag across the rock to wear it down to the dashed target.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Carve the target shape")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Choose an erosion force"),
      palette,
      el("div", { class: "metric" }, el("span", {}, "🪨 Shape match"), this.matchEl),
      this.coachEl
    );
  }

  private erode(p: Point): void {
    if (this.ended) return;
    this.started = true;
    const center = p.x / COLW;
    const agent = this.active;
    const radius = agent === "water" ? 1.4 : agent === "ice" ? 3 : 5;
    const strength = agent === "water" ? 9 : agent === "ice" ? 5 : 2.6;

    for (let i = 0; i < N; i++) {
      const d = Math.abs(i - center);
      if (d > radius) continue;
      const falloff = 1 - d / (radius + 0.5);
      // Rock "resists" as it nears the target, so you can't easily overshoot.
      const room = this.heights[i] - (this.target[i] - 4);
      const resist = Math.max(0, Math.min(1, room / 40));
      const cut = strength * falloff * resist;
      this.heights[i] = Math.max(this.target[i] - 6, this.heights[i] - cut);
    }
    // wind also smooths neighbours
    if (agent === "wind") {
      const sm = this.heights.slice();
      for (let i = 1; i < N - 1; i++) {
        const d = Math.abs(i - center);
        if (d > radius) continue;
        this.heights[i] = sm[i] * 0.6 + (sm[i - 1] + sm[i + 1]) * 0.2;
      }
    }
    // debris fly-off for feedback
    const cx = Math.round(center);
    if (cx >= 0 && cx < N) {
      const dx = cx * COLW + COLW / 2;
      const dy = GROUND - this.heights[cx];
      for (let k = 0; k < 2; k++) {
        this.debris.push({
          x: dx,
          y: dy,
          vx: (Math.random() - 0.5) * 3,
          vy: -1 - Math.random() * 2,
          life: 1,
        });
      }
    }
    this.ctx.services.audio.play("tick");
  }

  private matchPct(): number {
    let ok = 0;
    for (let i = 0; i < N; i++) {
      if (Math.abs(this.heights[i] - this.target[i]) <= TOL) ok++;
    }
    return ok / N;
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.started && !this.ended) this.elapsed += 1 / 60;
      for (const d of this.debris) {
        d.vy += 0.15;
        d.x += d.vx;
        d.y += d.vy;
        d.life -= 0.03;
      }
      this.debris = this.debris.filter((d) => d.life > 0 && d.y < H);

      const pct = this.matchPct();
      if (this.matchEl) this.matchEl.textContent = `${Math.round(pct * 100)}%`;
      if (this.started && pct >= byTier(this.ctx.tier, 0.85, 0.92, 0.97) && !this.ended)
        this.finish();

      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private finish(): void {
    this.ended = true;
    const stars = this.elapsed < 25 ? 3 : this.elapsed < 50 ? 2 : 1;
    this.ctx.services.score.event("weathering_done", { seconds: Math.round(this.elapsed) });
    this.ctx.services.outcome.succeed({
      message:
        "The landscape is shaped! Weathering and erosion — by water, wind, and ice — slowly wear rock away, carving valleys, hills, and canyons over a very long time.",
      stars,
      resources: { Rock: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#bae6fd");
    sky.addColorStop(1, "#e0f2fe");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, GROUND);
    c.fillStyle = "#a16207";
    c.fillRect(0, GROUND, W, H - GROUND);

    // target outline (dashed)
    c.strokeStyle = "rgba(37,99,235,0.7)";
    c.lineWidth = 2;
    c.setLineDash([8, 6]);
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = i * COLW + COLW / 2;
      const y = GROUND - this.target[i];
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);

    // rock fill
    c.beginPath();
    c.moveTo(0, GROUND);
    for (let i = 0; i < N; i++) {
      const x = i * COLW + COLW / 2;
      const y = GROUND - this.heights[i];
      c.lineTo(x, y);
    }
    c.lineTo(W, GROUND);
    c.closePath();
    const rock = c.createLinearGradient(0, GROUND - START_H, 0, GROUND);
    rock.addColorStop(0, "#a8a29e");
    rock.addColorStop(1, "#78716c");
    c.fillStyle = rock;
    c.fill();
    // strata lines for a rocky look
    c.strokeStyle = "rgba(120,113,108,0.5)";
    c.lineWidth = 1;
    for (let s = 40; s < START_H; s += 36) {
      c.beginPath();
      for (let i = 0; i < N; i++) {
        const x = i * COLW + COLW / 2;
        const y = GROUND - Math.min(this.heights[i], s);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }

    // columns within tolerance get a green cap (progress feedback)
    for (let i = 0; i < N; i++) {
      if (Math.abs(this.heights[i] - this.target[i]) <= TOL) {
        c.fillStyle = "rgba(34,197,94,0.5)";
        c.fillRect(i * COLW, GROUND - this.heights[i] - 2, COLW, 4);
      }
    }

    // debris
    for (const d of this.debris) {
      c.fillStyle = `rgba(120,113,108,${d.life})`;
      c.fillRect(d.x, d.y, 3, 3);
    }

    // title + legend
    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Wear the rock down to the dashed shape", W / 2, 36);
    c.font = "13px Nunito, sans-serif";
    c.fillText(
      `Using: ${AGENTS.find((a) => a.key === this.active)!.emoji} ${this.active}`,
      W / 2,
      58
    );
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.started = false;
    this.elapsed = 0;
    this.debris = [];
    this.buildLand();
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const weatheringGame: GameModule = {
  meta: {
    id: "weathering",
    conceptId: "ess-16",
    title: "Shaping the Land",
    stream: "earth-space",
    gradeBand: "4-5",
    emoji: "⛰️",
    blurb: "Use water, wind, and ice to erode a rock into the target landform.",
    mission: "Wear the rock down with the right forces until it matches the target shape.",
    estMinutes: 3,
  },
  create: (ctx) => new Weathering(ctx),
};
