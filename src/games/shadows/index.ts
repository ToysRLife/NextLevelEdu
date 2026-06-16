import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const OBJ_X = 430; // object position (fixed)
const OBJ_H = 90; // object height
const WALL_X = 700; // screen/wall
const MID = 330; // vertical centre line
const NEED = 3;

class Shadows implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private lightX = 120; // 60..400
  private targetH = 200;
  private caught = 0;
  private hold = 0;
  private readonly tol: number; // shadow-match tolerance (adaptive)

  private sizeEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.tol = byTier(ctx.tier, 26, 16, 10);
    this.placeTarget();
    this.buildPanel();
    ctx.services.hints.setHints([
      "A shadow forms where an object blocks light. Light travels in straight lines, so the object's outline is cast onto the wall.",
      "Move the light closer to the object and the shadow grows bigger; move it farther away and the shadow shrinks.",
      "Slide the lamp until the shadow matches the target outline, then hold it steady.",
    ]);
    this.renderLoop();
  }

  private placeTarget(): void {
    // achievable shadow heights for lightX in 60..400
    this.targetH = 140 + Math.random() * 200;
  }

  private shadowH(): number {
    // similar triangles: shadow height = objH * (wall - light) / (obj - light)
    return OBJ_H * ((WALL_X - this.lightX) / (OBJ_X - this.lightX));
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "60",
      max: "390",
      value: String(this.lightX),
      "aria-label": "Light distance",
      style: { accentColor: "var(--accent-yellow)" },
      oninput: (e: Event) => {
        this.lightX = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });

    this.sizeEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Move the lamp to make the shadow the right size, then hold.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Match ${NEED} shadows`)
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "💡 Lamp distance (near → far)"
      ),
      slider,
      el("div", { class: "metric" }, el("span", {}, "🌑 Shadow"), this.sizeEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const diff = this.shadowH() - this.targetH;
    this.sizeEl.textContent =
      Math.abs(diff) < this.tol ? "just right 🎯" : diff > 0 ? "too big ⬆️" : "too small ⬇️";
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (!this.ended) {
        if (Math.abs(this.shadowH() - this.targetH) < this.tol) {
          this.hold += 1;
          if (this.hold > 36) this.match();
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
    this.caught += 1;
    this.hold = 0;
    this.ctx.services.audio.play("tick");
    this.statusEl.textContent = `${this.caught} / ${NEED}`;
    if (this.caught >= NEED) {
      this.win();
    } else {
      this.placeTarget();
      this.coachEl.textContent = "🌑 Matched! Now size the next shadow.";
      this.updateReadout();
    }
  }

  private win(): void {
    this.ended = true;
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("shadows_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Shadow master! Light travels in straight lines, so an object blocks it and casts a shadow. A closer light makes a bigger shadow; a farther light makes a smaller one.",
      stars,
      resources: { Oxygen: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#1e293b";
    c.fillRect(0, 0, W, H);

    // wall / screen
    c.fillStyle = "#e2e8f0";
    c.fillRect(WALL_X, 80, 24, 460);

    // target outline on the wall
    c.strokeStyle = "#22c55e";
    c.lineWidth = 3;
    c.setLineDash([8, 6]);
    c.strokeRect(WALL_X, MID - this.targetH / 2, 24, this.targetH);
    c.setLineDash([]);
    c.fillStyle = "#86efac";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("target", WALL_X + 12, MID - this.targetH / 2 - 8);

    // shadow on the wall
    const sh = this.shadowH();
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(WALL_X, MID - sh / 2, 24, sh);

    // light rays (straight lines past the object edges to the wall)
    const objTop = MID - OBJ_H / 2;
    const objBot = MID + OBJ_H / 2;
    c.strokeStyle = "rgba(253,224,71,0.5)";
    c.lineWidth = 2;
    for (const oy of [objTop, objBot]) {
      const t = (WALL_X - this.lightX) / (OBJ_X - this.lightX);
      const wy = MID + (oy - MID) * t;
      c.beginPath();
      c.moveTo(this.lightX, MID);
      c.lineTo(WALL_X, wy);
      c.stroke();
    }

    // lamp
    c.fillStyle = "#fde047";
    c.beginPath();
    c.arc(this.lightX, MID, 18, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(253,224,71,0.3)";
    c.beginPath();
    c.arc(this.lightX, MID, 30 + Math.sin(this.anim * 3) * 4, 0, Math.PI * 2);
    c.fill();
    c.font = "20px serif";
    c.textAlign = "center";
    c.fillText("💡", this.lightX, MID + 7);

    // object
    c.fillStyle = "#7c3aed";
    c.fillRect(OBJ_X - 14, MID - OBJ_H / 2, 28, OBJ_H);
    c.font = "22px serif";
    c.fillText("🧍", OBJ_X, MID + 8);

    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Move the lamp to size the shadow 🌑", W / 2, 40);
    if (this.hold > 0 && !this.ended) {
      c.fillStyle = "#86efac";
      c.font = "bold 14px Nunito, sans-serif";
      c.fillText("hold it…", WALL_X + 12, MID + this.targetH / 2 + 24);
    }
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.lightX = 120;
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

export const shadowsGame: GameModule = {
  meta: {
    id: "shadows",
    conceptId: "phys-13",
    title: "Shadow Play",
    stream: "physics",
    gradeBand: "1-4",
    emoji: "🌑",
    blurb: "Move a lamp to grow and shrink a shadow until it matches the target.",
    mission: "Size the shadow to match each target by moving the light.",
    estMinutes: 2,
  },
  create: (ctx) => new Shadows(ctx),
};
