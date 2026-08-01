import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer } from "@core/input";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const CX = 440;
const CY = 300;
const ORBIT = 200;

// The axis always tilts toward the same fixed direction in space (+x here).
// Northern hemisphere leans toward the Sun when Earth sits on the -x side.
// northSun = -cos(theta): +1 at theta=180 (N summer), -1 at theta=0 (N winter).

interface Prompt {
  label: string;
  // target northSun value, with tolerance; equinox uses |northSun|≈0
  test: (northSun: number) => boolean;
  hint: string;
}

const PROMPTS: Prompt[] = [
  {
    label: "Summer in the Northern Hemisphere",
    test: (n) => n > 0.8,
    hint: "Summer is when your hemisphere tilts TOWARD the Sun, so sunlight hits most directly.",
  },
  {
    label: "Winter in the Northern Hemisphere",
    test: (n) => n < -0.8,
    hint: "Winter is when your hemisphere tilts AWAY from the Sun, so sunlight hits at a shallow angle.",
  },
  {
    label: "Spring or Autumn (an equinox)",
    test: (n) => Math.abs(n) < 0.2,
    hint: "At an equinox neither pole leans toward the Sun — both hemispheres get equal light.",
  },
];

class Seasons implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private theta = Math.PI / 2; // current orbital position (radians)
  private dragging = false;
  private promptIdx = 0;
  private mistakes = 0;

  private promptEl!: HTMLElement;
  private seasonEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        this.dragging = true;
        this.setFromPointer(p.x, p.y);
      },
      move: (p) => {
        if (this.dragging) this.setFromPointer(p.x, p.y);
      },
      up: () => {
        this.dragging = false;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Seasons aren't about distance from the Sun — they come from Earth's tilted axis.",
      "Earth's axis always points the same way. As Earth orbits, each hemisphere leans toward the Sun for part of the year and away for another part.",
      "Drag Earth around its orbit. When the Northern Hemisphere leans toward the Sun it's summer there; when it leans away it's winter.",
    ]);
    this.renderLoop();
  }

  private northSun(): number {
    return -Math.cos(this.theta);
  }

  private setFromPointer(x: number, y: number): void {
    if (this.ended) return;
    this.theta = Math.atan2(y - CY, x - CX);
    this.updateReadout();
  }

  private buildPanel(): void {
    const lockBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.lockIn() },
      "🔒 Lock in this position"
    );

    this.promptEl = el("span", { style: { color: "var(--accent-blue)" } }, PROMPTS[0].label);
    this.seasonEl = el("span", {}, "—");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Drag the Earth around the Sun, then lock in the right spot.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make it"),
        this.promptEl
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "Drag Earth, then lock it in"
      ),
      lockBtn,
      el("div", { class: "metric" }, el("span", {}, "🌍 Northern season"), this.seasonEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private seasonName(): string {
    const n = this.northSun();
    if (n > 0.8) return "☀️ Summer";
    if (n < -0.8) return "❄️ Winter";
    if (Math.abs(n) < 0.2) return "🍂 Equinox";
    return n > 0 ? "🌤️ Late spring" : "🌥️ Late autumn";
  }

  private updateReadout(): void {
    this.seasonEl.textContent = this.seasonName();
  }

  private lockIn(): void {
    if (this.ended) return;
    const prompt = PROMPTS[this.promptIdx];
    if (prompt.test(this.northSun())) {
      this.ctx.services.audio.play("tick");
      this.promptIdx += 1;
      if (this.promptIdx >= PROMPTS.length) {
        this.coachEl.textContent = "✅ Perfect!";
        this.win();
      } else {
        this.coachEl.textContent = `✅ Right! ${prompt.hint}`;
        this.promptEl.textContent = PROMPTS[this.promptIdx].label;
      }
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Not there. ${prompt.hint}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("seasons_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "You've got it! Seasons come from Earth's tilted axis — not its distance from the Sun. Each hemisphere leans toward the Sun for summer and away for winter.",
      stars,
      resources: { Climate: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.02;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#0b1020";
    c.fillRect(0, 0, W, H);

    // faint stars
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 50; i++) {
      const x = (i * 167) % W;
      const y = (i * 97) % H;
      c.fillRect(x, y, 2, 2);
    }

    // orbit path
    c.strokeStyle = "rgba(255,255,255,0.2)";
    c.lineWidth = 2;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.ellipse(CX, CY, ORBIT, ORBIT * 0.62, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    // sun
    const sunGlow = c.createRadialGradient(CX, CY, 10, CX, CY, 70);
    sunGlow.addColorStop(0, "#fff7ae");
    sunGlow.addColorStop(1, "rgba(255,200,40,0)");
    c.fillStyle = sunGlow;
    c.beginPath();
    c.arc(CX, CY, 70, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.arc(CX, CY, 34, 0, Math.PI * 2);
    c.fill();

    // earth position
    const ex = CX + Math.cos(this.theta) * ORBIT;
    const ey = CY + Math.sin(this.theta) * ORBIT * 0.62;

    // sun rays to earth
    c.strokeStyle = "rgba(255,210,63,0.4)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(CX, CY);
    c.lineTo(ex, ey);
    c.stroke();

    // earth with tilted axis (axis always points the same way: +x / right)
    const r = 30;
    // lit half faces the sun
    c.save();
    c.translate(ex, ey);
    // ocean base
    c.fillStyle = "#2f6fb0";
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    // night shading on far side from sun
    const toSun = Math.atan2(CY - ey, CX - ex);
    c.fillStyle = "rgba(0,0,20,0.55)";
    c.beginPath();
    c.arc(0, 0, r, toSun + Math.PI / 2, toSun - Math.PI / 2);
    c.fill();
    c.restore();

    // tilt axis: fixed direction in space (pointing up-right, 23.5°)
    const tilt = -Math.PI / 2 + 0.41; // from vertical
    const ax = Math.cos(tilt) * (r + 16);
    const ay = Math.sin(tilt) * (r + 16);
    c.strokeStyle = "#fca5a5";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(ex - ax, ey - ay);
    c.lineTo(ex + ax, ey + ay);
    c.stroke();
    // N marker at top of axis
    c.fillStyle = "#fecaca";
    c.font = "bold 13px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("N", ex + ax, ey + ay - 6);

    // earth handle ring (draggable hint)
    c.strokeStyle = this.dragging ? "#22c55e" : "rgba(255,255,255,0.6)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(ex, ey, r + 6, 0, Math.PI * 2);
    c.stroke();

    // season label near earth
    c.fillStyle = "#fff";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(this.seasonName(), ex, ey + r + 28);

    // instruction
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Drag Earth around the Sun 🌍", W / 2, 40);
    c.font = "13px Nunito, sans-serif";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText(
      "The red axis always points the same way — that's what makes the seasons.",
      W / 2,
      64
    );
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.theta = Math.PI / 2;
    this.promptIdx = 0;
    this.mistakes = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const seasonsGame: GameModule = {
  meta: {
    id: "seasons",
    conceptId: "ess-09",
    title: "Reason for Seasons",
    stream: "earth-space",
    gradeBand: "5-6",
    emoji: "🌍",
    blurb:
      "Drag Earth around the Sun and discover how its tilt — not distance — makes the seasons.",
    mission: "Position Earth's tilted axis to create summer, winter, and an equinox in the north.",
    estMinutes: 3,
  },
  create: (ctx) => new Seasons(ctx),
};
