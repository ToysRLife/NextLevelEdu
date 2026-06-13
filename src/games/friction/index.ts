import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const GROUND = 440;
const START_X = 90;
const NEED = 3;

interface Surface {
  key: string;
  label: string;
  emoji: string;
  friction: number; // deceleration factor
  color: string;
}

const SURFACES: Surface[] = [
  { key: "ice", label: "Ice", emoji: "🧊", friction: 0.012, color: "#bae6fd" },
  { key: "wood", label: "Wood", emoji: "🪵", friction: 0.05, color: "#d6a55c" },
  { key: "carpet", label: "Carpet", emoji: "🧶", friction: 0.11, color: "#f9a8d4" },
];

class Friction implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private surface: Surface = SURFACES[1];
  private x = START_X;
  private vx = 0;
  private sliding = false;
  private target = { x: 500, w: 90 };
  private hits = 0;
  private misses = 0;
  private ended = false;
  private launchSpeed = 9;
  // Adaptive difficulty: a wider target for juniors, a tighter one for masters.
  private readonly targetW: number;

  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.targetW = ctx.tier === "junior" ? 130 : ctx.tier === "master" ? 56 : 90;
    this.target.w = this.targetW;
    this.placeTarget();
    this.buildPanel();
    ctx.services.hints.setHints([
      "Friction is a force that slows things down when two surfaces rub together.",
      "Rough surfaces (carpet) make lots of friction and stop the sled quickly. Smooth ones (ice) make little, so it slides far.",
      "Pick the surface that lets the sled glide just the right distance to stop on the target.",
    ]);
    this.loop.start();
    this.render();
  }

  private placeTarget(): void {
    this.target.x = 300 + Math.random() * 360;
  }

  private buildPanel(): void {
    const surfRow = el(
      "div",
      { class: "chip-row" },
      ...SURFACES.map((s) =>
        el(
          "button",
          {
            class: "chip",
            style:
              this.surface.key === s.key
                ? { background: "var(--accent-blue)", color: "#fff", borderColor: "var(--accent-blue)" }
                : {},
            onclick: () => {
              if (this.sliding) return;
              this.surface = s;
              this.buildPanel();
            },
          },
          `${s.emoji} ${s.label}`,
        ),
      ),
    );

    this.goBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.launch() },
      "🛷 Push the sled",
    ) as HTMLButtonElement;

    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Choose a surface, then push. Friction will slow the sled to a stop.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Stop on ${NEED} targets`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Pick the sliding surface"),
      surfRow,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "🎯 Landed on target"), this.statusEl),
      this.coachEl,
    );
  }

  private launch(): void {
    if (this.ended || this.sliding) return;
    this.x = START_X;
    this.vx = this.launchSpeed;
    this.sliding = true;
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    if (this.sliding) {
      this.x += this.vx * f;
      // friction reduces speed each frame
      this.vx = Math.max(0, this.vx - this.surface.friction * 9.8 * f * 0.5);
      if (this.vx <= 0.02 || this.x > W - 30) {
        this.vx = 0;
        this.sliding = false;
        this.goBtn.disabled = false;
        const nose = this.x + 26;
        const hit = nose >= this.target.x && nose <= this.target.x + this.target.w;
        if (hit) {
          this.hits += 1;
          this.ctx.services.audio.play("tick");
          this.coachEl.textContent = "🎯 Perfect stop! That surface had just the right friction.";
          this.statusEl.textContent = `${this.hits} / ${NEED}`;
          if (this.hits >= NEED) this.finish();
          else this.placeTarget();
        } else {
          this.misses += 1;
          this.ctx.services.audio.play("fail");
          this.coachEl.textContent =
            nose < this.target.x
              ? "Stopped too soon — too much friction. Try a smoother surface so it slides farther."
              : "Slid too far — too little friction. Try a rougher surface to stop sooner.";
        }
      }
    }
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("friction_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Nailed it! Friction is the force that slows sliding things. Rough surfaces grip more and stop things fast; smooth ones let them glide far.",
      stars,
      resources: { Oxygen: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#e0f2fe";
    c.fillRect(0, 0, W, GROUND);

    // surface strip
    c.fillStyle = this.surface.color;
    c.fillRect(0, GROUND, W, H - GROUND);
    // texture to convey roughness
    c.fillStyle = "rgba(0,0,0,0.12)";
    const step = this.surface.key === "ice" ? 60 : this.surface.key === "wood" ? 26 : 12;
    for (let x = 0; x < W; x += step) c.fillRect(x, GROUND, 2, 14);
    c.fillStyle = "#334155";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`${this.surface.emoji} ${this.surface.label}`, 16, GROUND + 36);

    // target zone
    c.fillStyle = "rgba(34,197,94,0.35)";
    c.fillRect(this.target.x, GROUND - 60, this.target.w, 60);
    c.strokeStyle = "#16a34a";
    c.lineWidth = 3;
    c.strokeRect(this.target.x, GROUND - 60, this.target.w, 60);
    c.fillStyle = "#15803d";
    c.font = "20px serif";
    c.textAlign = "center";
    c.fillText("🎯", this.target.x + this.target.w / 2, GROUND - 24);

    // sled
    c.fillStyle = "#7c3aed";
    this.roundRect(c, this.x, GROUND - 30, 52, 26, 6);
    c.fill();
    c.fillStyle = "#facc15";
    c.font = "22px serif";
    c.fillText("🐧", this.x + 26, GROUND - 10);
    // runner
    c.strokeStyle = "#4c1d95";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(this.x - 4, GROUND - 2);
    c.lineTo(this.x + 56, GROUND - 2);
    c.stroke();

    // motion lines when sliding
    if (this.sliding && this.vx > 0.5) {
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(this.x - 10 - i * 12, GROUND - 18 + i * 6);
        c.lineTo(this.x - 26 - i * 12, GROUND - 18 + i * 6);
        c.stroke();
      }
    }

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Stop the sled on the target 🎯", W / 2, 40);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    this.x = START_X;
    this.vx = 0;
    this.sliding = false;
    this.hits = 0;
    this.misses = 0;
    this.placeTarget();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const frictionGame: GameModule = {
  meta: {
    id: "friction",
    conceptId: "phys-04",
    title: "Stop on the Spot",
    stream: "physics",
    gradeBand: "2-3",
    emoji: "🛷",
    blurb: "Choose the right surface so friction stops the sled exactly on target.",
    mission: "Use friction to bring the sled to rest on three targets.",
    estMinutes: 3,
  },
  create: (ctx) => new Friction(ctx),
};
