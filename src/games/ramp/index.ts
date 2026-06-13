import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const GROUND = 500;
const PLAT_X = 660; // platform (top of ramp) x
const MAX_FORCE = 50; // the mover's strength

interface Round {
  weight: number; // crate weight
  height: number; // platform height to reach
}

const ROUNDS: Round[] = [
  { weight: 50, height: 120 },
  { weight: 80, height: 170 },
  { weight: 110, height: 210 },
];

class Ramp implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private angleDeg = 30; // ramp steepness
  private roundIdx = 0;
  private pushing = false;
  private progress = 0; // 0..1 along the ramp
  private slipping = false;
  private attempts = 0;
  private ended = false;

  private forceEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "A ramp (inclined plane) is a simple machine — it lets you raise a load with less force than lifting it straight up.",
      "A gentler (less steep) ramp needs less force, but you have to push the load a longer way.",
      "If the force needed is more than your strength, the crate slides back. Make the ramp gentler until you can push it up.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.roundIdx];
  }

  private forceNeeded(): number {
    // F = weight * sin(angle) — the component of gravity along the ramp
    return this.round().weight * Math.sin((this.angleDeg * Math.PI) / 180);
  }

  private buildPanel(): void {
    const slider = el("input", {
      type: "range",
      min: "12",
      max: "55",
      value: String(this.angleDeg),
      "aria-label": "Ramp steepness",
      style: { accentColor: "var(--accent-orange)" },
      oninput: (e: Event) => {
        if (this.pushing) return;
        this.angleDeg = Number((e.target as HTMLInputElement).value);
        this.updateReadout();
      },
    });
    const pushBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.push() },
      "💪 Push it up",
    );

    this.forceEl = el("span", {}, "");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `0 / ${ROUNDS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Get the crate up"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "📐 Ramp steepness"),
      slider,
      pushBtn,
      el("div", { class: "metric" }, el("span", {}, "💪 Force needed"), this.forceEl),
      el("div", { class: "metric" }, el("span", {}, "📦 Crates moved"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const need = this.forceNeeded();
    this.forceEl.textContent = `${need.toFixed(0)} / ${MAX_FORCE} 💪`;
    this.forceEl.style.color = need <= MAX_FORCE ? "var(--accent-green)" : "var(--accent-red)";
    this.coachEl.textContent =
      need <= MAX_FORCE
        ? "You can push this! Notice a gentler ramp needs less force — but it's a longer climb."
        : "Too steep — the force needed is more than your strength. Make the ramp gentler.";
  }

  private push(): void {
    if (this.ended || this.pushing) return;
    if (this.forceNeeded() > MAX_FORCE) {
      this.slipping = true;
      this.attempts += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = "😣 It slid back down — too steep! Lower the ramp angle.";
      return;
    }
    this.pushing = true;
    this.slipping = false;
    this.progress = 0;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    if (this.slipping) {
      this.progress = Math.max(0, this.progress - 0.04 * f);
      if (this.progress <= 0) this.slipping = false;
    } else if (this.pushing) {
      // surplus force = faster climb; gentler ramp = longer path so feels like a trade
      const surplus = MAX_FORCE - this.forceNeeded();
      const rampLen = this.rampLength();
      const speed = (1 + surplus * 0.04) / (rampLen / 300);
      this.progress += 0.006 * speed * f;
      if (this.progress >= 1) {
        this.progress = 1;
        this.pushing = false;
        this.win();
      }
    }
    this.render();
  }

  private rampLength(): number {
    const h = this.round().height;
    return h / Math.sin((this.angleDeg * Math.PI) / 180);
  }

  private win(): void {
    this.roundIdx += 1;
    this.ctx.services.audio.play("tick");
    if (this.roundIdx >= ROUNDS.length) {
      this.finish();
    } else {
      this.progress = 0;
      this.statusEl.textContent = `${this.roundIdx} / ${ROUNDS.length}`;
      this.coachEl.textContent = "📦 Up it goes! Heavier crate next — you may need an even gentler ramp.";
      this.updateReadout();
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    this.statusEl.textContent = `${ROUNDS.length} / ${ROUNDS.length}`;
    const stars = this.attempts === 0 ? 3 : this.attempts <= 2 ? 2 : 1;
    this.ctx.services.score.event("ramp_done", { attempts: this.attempts });
    this.ctx.services.outcome.succeed({
      message:
        "Loaded up! A ramp is a simple machine: the gentler the slope, the less force you need — though you push over a longer distance. Less effort, more distance.",
      stars,
      resources: { Alloy: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#fed7aa";
    c.fillRect(0, GROUND, W, H - GROUND);

    const r = this.round();
    // platform
    const platTop = GROUND - r.height;
    c.fillStyle = "#92400e";
    c.fillRect(PLAT_X, platTop, W - PLAT_X, r.height);

    // ramp from ground (bottom-left of platform) down to ground
    const rampLen = this.rampLength();
    const ang = (this.angleDeg * Math.PI) / 180;
    const topX = PLAT_X;
    const topY = platTop;
    const baseX = topX - Math.cos(ang) * rampLen;
    const baseY = topY + Math.sin(ang) * rampLen; // = GROUND
    c.strokeStyle = "#b45309";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.lineTo(topX, topY);
    c.stroke();
    // ramp underside
    c.fillStyle = "rgba(180,83,9,0.25)";
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.lineTo(topX, topY);
    c.lineTo(topX, baseY);
    c.closePath();
    c.fill();

    // crate position along the ramp
    const cx = baseX + (topX - baseX) * this.progress;
    const cy = baseY + (topY - baseY) * this.progress - 22;
    c.save();
    c.translate(cx, cy);
    c.rotate(-ang);
    c.fillStyle = "#a16207";
    c.fillRect(-22, -22, 44, 44);
    c.strokeStyle = "#713f12";
    c.lineWidth = 3;
    c.strokeRect(-22, -22, 44, 44);
    c.fillStyle = "#fde68a";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${r.weight}`, 0, 6);
    c.restore();

    // strength gauge
    const need = this.forceNeeded();
    c.fillStyle = "rgba(255,255,255,0.7)";
    this.roundRect(c, 40, 50, 220, 22, 11);
    c.fill();
    c.fillStyle = need <= MAX_FORCE ? "#22c55e" : "#ef4444";
    this.roundRect(c, 40, 50, 220 * Math.min(1, need / MAX_FORCE), 22, 11);
    c.fill();
    // strength marker
    c.strokeStyle = "#1e293b";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(40 + 220, 46);
    c.lineTo(40 + 220, 76);
    c.stroke();
    c.fillStyle = "#1e293b";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("force needed", 40, 44);
    c.textAlign = "right";
    c.fillText("your max 💪", 262, 44);

    c.fillStyle = "#9a3412";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Push the crate up to the platform 📦", W / 2, 30);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    this.angleDeg = 30;
    this.roundIdx = 0;
    this.pushing = false;
    this.slipping = false;
    this.progress = 0;
    this.attempts = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const rampGame: GameModule = {
  meta: {
    id: "ramp",
    conceptId: "phys-09",
    title: "Easy Does It",
    stream: "physics",
    gradeBand: "3-5",
    emoji: "📐",
    blurb: "Pick the right ramp slope to push heavy crates up with the force you have.",
    mission: "Move every crate up to the platform by choosing a ramp you can actually push.",
    estMinutes: 3,
  },
  create: (ctx) => new Ramp(ctx),
};
