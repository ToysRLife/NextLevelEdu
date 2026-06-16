import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const LAMP_X = 90;
const LAMP_Y = 300;
const WALL_X = 400;
const EYE_X = 710;
const NEED = 3;

class StraightShot implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private holeY = 300;
  private targetY = 300;
  private caught = 0;
  private hold = 0;
  private readonly tol: number; // alignment tolerance (adaptive)

  private alignEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tol = byTier(ctx.tier, 22, 14, 9);
    this.placeTarget();
    this.buildPanel();
    ctx.services.hints.setHints([
      "Light travels in straight lines until something blocks it.",
      "Because the beam is straight, the hole in the wall must sit exactly on the line between the torch and the eye.",
      "Slide the hole up or down until the straight beam passes through it to the eye.",
    ]);
    this.renderLoop();
  }

  private placeTarget(): void {
    this.targetY = 150 + Math.random() * 300;
  }

  private requiredHoleY(): number {
    return LAMP_Y + (this.targetY - LAMP_Y) * ((WALL_X - LAMP_X) / (EYE_X - LAMP_X));
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "100",
      max: "500",
      value: String(this.holeY),
      "aria-label": "Hole height",
      style: { accentColor: "var(--accent-yellow)" },
      oninput: (e: Event) => {
        this.holeY = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    this.alignEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Slide the hole onto the straight beam line.";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Reach the eye ${NEED}×`)
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "🕳️ Move the hole up/down"
      ),
      slider,
      el("div", { class: "metric" }, el("span", {}, "📐 Beam"), this.alignEl),
      el("div", { class: "metric" }, el("span", {}, "👁️ Reached"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const d = this.holeY - this.requiredHoleY();
    this.alignEl.textContent =
      Math.abs(d) < this.tol ? "lined up 🎯" : d < 0 ? "hole too high" : "hole too low";
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (!this.ended) {
        if (Math.abs(this.holeY - this.requiredHoleY()) < this.tol) {
          this.hold += 1;
          if (this.hold > 36) this.hit();
        } else this.hold = 0;
      }
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private hit(): void {
    this.caught += 1;
    this.hold = 0;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.caught} / ${NEED}`;
    if (this.caught >= NEED) this.win();
    else {
      this.placeTarget();
      this.coachEl.textContent = "👁️ The light got through! Line up the next one.";
      this.updateReadout();
    }
  }

  private win(): void {
    this.ended = true;
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("straightshot_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Bullseye! Light always travels in straight lines, so it only reaches the eye when the hole lines up perfectly on that straight path.",
      stars,
      resources: { Power: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#1e293b";
    c.fillRect(0, 0, W, H);
    const aligned = Math.abs(this.holeY - this.requiredHoleY()) < 14;

    // wall with hole
    c.fillStyle = "#64748b";
    c.fillRect(WALL_X - 14, 80, 28, this.holeY - 22 - 80);
    c.fillRect(WALL_X - 14, this.holeY + 22, 28, 520 - (this.holeY + 22));

    // beam
    c.strokeStyle = "#fde047";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(LAMP_X, LAMP_Y);
    if (aligned) {
      c.lineTo(WALL_X, this.holeY);
      c.lineTo(EYE_X, this.targetY);
    } else {
      // beam stops at the wall (blocked)
      const t = (WALL_X - LAMP_X) / (EYE_X - LAMP_X);
      const beamYAtWall = LAMP_Y + (this.targetY - LAMP_Y) * t;
      c.lineTo(WALL_X - 14, beamYAtWall);
    }
    c.stroke();

    // lamp
    c.fillStyle = "#facc15";
    c.beginPath();
    c.arc(LAMP_X, LAMP_Y, 18, 0, Math.PI * 2);
    c.fill();
    c.font = "22px serif";
    c.textAlign = "center";
    c.fillText("🔦", LAMP_X, LAMP_Y + 7);
    // eye
    c.font = "40px serif";
    c.fillText(aligned ? "😃" : "👁️", EYE_X, this.targetY + 12);
    if (aligned) {
      c.fillStyle = "rgba(253,224,71,0.3)";
      c.beginPath();
      c.arc(EYE_X, this.targetY, 30 + Math.sin(this.anim * 3) * 4, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Line the hole up so the light reaches the eye 👁️", W / 2, 40);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#86efac";
      c.font = "bold 14px Nunito, sans-serif";
      c.fillText("hold it…", WALL_X, this.holeY - 30);
    }
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.holeY = 300;
    this.caught = 0;
    this.hold = 0;
    this.placeTarget();
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const straightShotGame: GameModule = {
  meta: {
    id: "straightshot",
    conceptId: "phys-12",
    title: "Straight Shot",
    stream: "physics",
    gradeBand: "4",
    emoji: "🔦",
    blurb: "Line up the hole so the straight beam of light reaches the eye.",
    mission: "Use the fact that light travels straight to get the beam through to the eye.",
    estMinutes: 2,
  },
  create: (ctx) => new StraightShot(ctx),
};
