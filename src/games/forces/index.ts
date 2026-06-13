import type { GameModule, GameContext, GameInstance, DifficultyTier } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { ParticleSystem } from "@core/particles";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const GROUND_Y = 440;
const BOX = 70;
const START_X = 90;

interface Surface {
  key: string;
  label: string;
  friction: number; // deceleration in logical units / frame^2
  color: string;
}

// Friction tuned so EVERY surface can reach the target zone with some push in
// the slider range (slippery ice needs a gentle push, grippy carpet a hard one)
// — verified by the solvability guard. Earlier values made wood/carpet
// impossible to reach no matter how hard you pushed.
const SURFACES: Surface[] = [
  { key: "ice", label: "🧊 Ice", friction: 0.004, color: "#bae6fd" },
  { key: "wood", label: "🪵 Wood", friction: 0.015, color: "#d6a866" },
  { key: "carpet", label: "🧶 Carpet", friction: 0.034, color: "#c084fc" },
];

// Target gets a little wider for younger learners so the force/friction
// trade-off stays approachable.
const TIER_ZONE: Record<DifficultyTier, number> = { junior: 120, explorer: 90, master: 64 };

class Forces implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly particles = new ParticleSystem();
  private readonly zoneW: number;

  private surface: Surface = SURFACES[1];
  private push = 6;
  private phase: "setup" | "sliding" | "ended" = "setup";
  private x = START_X;
  private v = 0;
  private readonly zoneX: number;

  private pushEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;
  private chips!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.zoneW = TIER_ZONE[ctx.tier];
    this.zoneX = 560;
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "A bigger push gives the box more speed, so it slides farther before stopping.",
      "Friction is the slow-down force. On ice it barely slows; on carpet it stops fast.",
      "Match your push to the surface: low push on slippery ice, a strong push on grippy carpet.",
    ]);
    this.render();
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "2",
      max: "14",
      step: "0.5",
      value: String(this.push),
      "aria-label": "Push strength",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        if (this.phase !== "setup") return;
        this.push = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.chips = el(
      "div",
      { class: "chip-row" },
      ...SURFACES.map((s) =>
        el(
          "button",
          {
            class: "chip" + (s.key === this.surface.key ? " active" : ""),
            "data-s": s.key,
            onclick: () => {
              if (this.phase !== "setup") return;
              this.surface = s;
              this.chips.querySelectorAll("button").forEach((b) =>
                b.classList.toggle("active", b.getAttribute("data-s") === s.key),
              );
              this.updateReadout();
              this.render();
            },
          },
          s.label,
        ),
      ),
    );

    this.pushEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.push} N`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.goBtn = el("button", { class: "btn", onclick: () => this.go() }, "👋 Push!") as HTMLButtonElement;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "control-label" }, "Surface"),
      this.chips,
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Push Strength"),
      slider,
      el("div", { class: "metric" }, el("span", {}, "👋 Force"), this.pushEl),
      this.goBtn,
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.pushEl.textContent = `${this.push.toFixed(1)} N`;
    this.coachEl.textContent =
      this.phase === "sliding"
        ? "📦 Sliding… friction is slowing it down."
        : `On ${this.surface.label.split(" ")[1].toLowerCase()}, the box will coast ${
            this.surface.friction < 0.03 ? "a long way" : this.surface.friction > 0.08 ? "only a little" : "a fair bit"
          }. Aim for the green zone!`;
  }

  private go(): void {
    if (this.phase !== "setup") return;
    this.phase = "sliding";
    this.v = this.push * 1.4;
    this.goBtn.setAttribute("disabled", "true");
    this.ctx.services.audio.play("click");
    this.loop.start();
  }

  private tick(dtMs: number): void {
    if (this.phase !== "sliding") return;
    const f = dtMs / 16.67;
    this.x += this.v * f;
    const decel = this.surface.friction * 9 * f;
    this.v = Math.max(0, this.v - decel);

    if (this.v > 0.2 && Math.random() < 0.4) {
      this.particles.spawn({
        kind: "dust",
        x: this.x,
        y: GROUND_Y,
        vx: -this.v * 0.3 + (Math.random() - 0.5),
        vy: -Math.random() * 1.5,
        size: 3 + Math.random() * 3,
      });
    }
    this.particles.update(0.03);

    this.updateReadout();
    this.render();

    if (this.x + BOX > W) {
      this.x = W - BOX;
      this.finish();
    } else if (this.v <= 0) {
      this.finish();
    }
  }

  private finish(): void {
    this.phase = "ended";
    this.loop.stop();
    const center = this.x + BOX / 2;
    const zoneCenter = this.zoneX + this.zoneW / 2;
    const inZone = center >= this.zoneX && center <= this.zoneX + this.zoneW;
    if (inZone) {
      const off = Math.abs(center - zoneCenter) / (this.zoneW / 2);
      const hintsUsed = this.ctx.services.hints.count();
      let stars = off < 0.34 ? 3 : off < 0.7 ? 2 : 1;
      if (hintsUsed >= 2) stars = Math.min(stars, 2);
      this.ctx.services.score.event("forces_park", { off: Number(off.toFixed(2)) });
      this.ctx.services.outcome.succeed({
        message: "Parked it right in the zone! You balanced your push against friction perfectly.",
        stars,
        resources: { Power: 30 + Math.round((1 - off) * 30) },
      });
    } else {
      const short = center < this.zoneX;
      this.ctx.services.outcome.fail({
        message: short
          ? "Stopped short — friction won. Try a stronger push or a more slippery surface."
          : "Overshot the zone — too much speed. Ease off the push or pick a grippier surface.",
      });
    }
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eef2ff";
    c.fillRect(0, 0, W, H);

    // ground
    c.fillStyle = this.surface.color;
    c.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    c.fillStyle = "rgba(0,0,0,0.08)";
    c.fillRect(0, GROUND_Y, W, 4);

    // target zone
    c.fillStyle = "rgba(34,197,94,0.25)";
    c.fillRect(this.zoneX, GROUND_Y - BOX, this.zoneW, BOX);
    c.strokeStyle = "var(--accent-green)";
    c.setLineDash([8, 6]);
    c.lineWidth = 3;
    c.strokeStyle = "#22c55e";
    c.strokeRect(this.zoneX, GROUND_Y - BOX, this.zoneW, BOX);
    c.setLineDash([]);
    c.fillStyle = "#16a34a";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🎯 STOP HERE", this.zoneX + this.zoneW / 2, GROUND_Y - BOX - 10);

    // dust
    for (const p of this.particles.particles) {
      c.globalAlpha = p.life * 0.6;
      c.fillStyle = "#94a3b8";
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // box
    const bx = this.x;
    const by = GROUND_Y - BOX;
    c.fillStyle = "#b45309";
    c.fillRect(bx, by, BOX, BOX);
    c.fillStyle = "#92400e";
    c.lineWidth = 4;
    c.strokeStyle = "#78350f";
    c.strokeRect(bx, by, BOX, BOX);
    c.fillStyle = "#fde68a";
    c.font = "28px serif";
    c.textAlign = "center";
    c.fillText("📦", bx + BOX / 2, by + BOX / 2 + 10);

    // push arrow during setup
    if (this.phase === "setup") {
      const len = this.push * 6;
      c.strokeStyle = "#f59e0b";
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(bx - len - 6, by + BOX / 2);
      c.lineTo(bx - 6, by + BOX / 2);
      c.stroke();
      c.beginPath();
      c.moveTo(bx - 6, by + BOX / 2);
      c.lineTo(bx - 18, by + BOX / 2 - 9);
      c.lineTo(bx - 18, by + BOX / 2 + 9);
      c.fillStyle = "#f59e0b";
      c.fill();
    }
  }

  start(): void {
    if (this.phase === "sliding") this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (this.phase === "sliding") this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.phase = "setup";
    this.x = START_X;
    this.v = 0;
    this.particles.clear();
    this.goBtn.removeAttribute("disabled");
    this.ctx.services.hints.reset();
    this.updateReadout();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
    this.particles.clear();
  }
}

export const forcesGame: GameModule = {
  meta: {
    id: "forces",
    conceptId: "phys-01",
    title: "Push It!",
    stream: "physics",
    gradeBand: "K-2",
    emoji: "📦",
    blurb: "Give the box just the right push so friction stops it on the target.",
    mission: "Push the box so it slides to a stop right inside the green zone — balance your force against friction.",
    estMinutes: 3,
  },
  create: (ctx) => new Forces(ctx),
};
