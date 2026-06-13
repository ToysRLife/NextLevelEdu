import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const RUB_ZONE = 210; // y above this = sweater (rub here to charge)

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  collected: boolean;
}

class StaticElec implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly bitCount: number; // paper bits to collect (adaptive)
  private readonly loop: SimLoop;
  private detach: () => void;

  private bx = W / 2;
  private by = 320;
  private charge = 0; // 0..1
  private dragging = false;
  private lastP: Point | null = null;
  private bits: Bit[] = [];
  private collected = 0;
  private elapsed = 0;
  private started = false;
  private ended = false;
  private sparks: { x: number; y: number; life: number }[] = [];

  private chargeEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.bitCount = byTier(ctx.tier, 6, 8, 10);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.spawnBits();
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        this.dragging = true;
        this.lastP = p;
      },
      move: (p) => {
        if (this.dragging) this.dragMove(p);
      },
      up: () => {
        this.dragging = false;
        this.lastP = null;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Rubbing two things together can move tiny charges, leaving an object electrically charged.",
      "A charged object pulls on light things like bits of paper — that's static electricity.",
      "Drag the balloon back and forth on the sweater to charge it up, then move it over the paper bits to attract them.",
    ]);
    this.loop.start();
    this.render();
  }

  private spawnBits(): void {
    this.bits = [];
    for (let i = 0; i < this.bitCount; i++) {
      this.bits.push({
        x: 120 + (i % 4) * 170 + Math.random() * 40,
        y: 430 + Math.floor(i / 4) * 70,
        vx: 0,
        vy: 0,
        collected: false,
      });
    }
  }

  private buildPanel(): void {
    this.chargeEl = el("span", {}, "0%");
    this.statusEl = el("span", { style: { color: "var(--accent-yellow)" } }, `0 / ${this.bitCount}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-yellow)", background: "#fefce8" },
    });
    this.coachEl.textContent = "Drag the balloon on the sweater to charge it, then sweep it over the paper bits.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Collect 8 paper bits"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Rub on the sweater, then attract the bits"),
      el("div", { class: "metric" }, el("span", {}, "⚡ Charge"), this.chargeEl),
      el("div", { class: "metric" }, el("span", {}, "📄 Collected"), this.statusEl),
      this.coachEl,
    );
  }

  private dragMove(p: Point): void {
    if (this.ended) return;
    this.started = true;
    const prev = this.lastP ?? p;
    const moved = Math.hypot(p.x - prev.x, p.y - prev.y);
    this.bx = p.x;
    this.by = p.y;
    // rubbing on the sweater builds charge proportional to movement
    if (p.y < RUB_ZONE) {
      this.charge = Math.min(1, this.charge + moved * 0.004);
      if (moved > 4 && this.charge < 1) {
        this.sparks.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + 20, life: 1 });
      }
    }
    this.lastP = p;
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    if (this.started) this.elapsed += dtMs / 1000;
    // charge slowly leaks away
    this.charge = Math.max(0, this.charge - 0.0015 * f);

    const reach = 60 + this.charge * 130;
    for (const bit of this.bits) {
      if (bit.collected) continue;
      const dx = this.bx - bit.x;
      const dy = this.by - bit.y;
      const d = Math.hypot(dx, dy);
      if (this.charge > 0.3 && d < reach) {
        // pull toward the charged balloon
        const pull = (this.charge * 0.6) / Math.max(20, d);
        bit.vx += dx * pull * f;
        bit.vy += dy * pull * f;
      }
      bit.vx *= 0.9;
      bit.vy *= 0.9;
      bit.x += bit.vx * f;
      bit.y += bit.vy * f;
      if (d < 26) {
        bit.collected = true;
        this.collected += 1;
        this.charge = Math.max(0, this.charge - 0.06); // each pickup uses a little charge
        this.ctx.services.audio.play("tick");
        this.statusEl.textContent = `${this.collected} / ${this.bitCount}`;
        this.coachEl.textContent = "📄⚡ Stuck! The static charge pulled the paper right onto the balloon.";
        if (this.collected >= this.bitCount) this.finish();
      }
    }

    for (const s of this.sparks) s.life -= 0.05 * f;
    this.sparks = this.sparks.filter((s) => s.life > 0);

    this.chargeEl.textContent = `${Math.round(this.charge * 100)}%`;
    if (this.charge < 0.3 && this.collected < this.bitCount && this.started) {
      this.coachEl.textContent = "Charge is fading — rub the balloon on the sweater again.";
    }
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.elapsed < 25 ? 3 : this.elapsed < 45 ? 2 : 1;
    this.ctx.services.score.event("static_done", { seconds: Math.round(this.elapsed) });
    this.ctx.services.outcome.succeed({
      message:
        "Zap! Rubbing moved tiny charges onto the balloon, giving it static electricity — and a charged object pulls on light things like bits of paper.",
      stars,
      resources: { Power: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fef9c3";
    c.fillRect(0, 0, W, H);

    // sweater (rub zone)
    c.fillStyle = "#e879b9";
    c.fillRect(0, 0, W, RUB_ZONE);
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 2;
    for (let x = 0; x < W; x += 18) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 9, RUB_ZONE);
      c.stroke();
    }
    c.fillStyle = "#fff";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🧥 Rub the balloon here to charge it", W / 2, 28);

    // table
    c.fillStyle = "#d6a55c";
    c.fillRect(0, 400, W, H - 400);

    // paper bits
    for (const bit of this.bits) {
      if (bit.collected) continue;
      c.fillStyle = "#fff";
      c.strokeStyle = "#cbd5e1";
      c.lineWidth = 1;
      c.fillRect(bit.x - 6, bit.y - 6, 12, 12);
      c.strokeRect(bit.x - 6, bit.y - 6, 12, 12);
    }

    // attraction field
    if (this.charge > 0.3) {
      const reach = 60 + this.charge * 130;
      c.strokeStyle = `rgba(250,204,21,${0.15 + this.charge * 0.25})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(this.bx, this.by, reach, 0, Math.PI * 2);
      c.stroke();
    }

    // balloon with collected papers stuck on
    c.fillStyle = "#ef4444";
    c.beginPath();
    c.ellipse(this.bx, this.by, 34, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.beginPath();
    c.ellipse(this.bx - 10, this.by - 14, 8, 12, -0.5, 0, Math.PI * 2);
    c.fill();
    // tied knot + string
    c.strokeStyle = "#b91c1c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(this.bx, this.by + 42);
    c.lineTo(this.bx, this.by + 70);
    c.stroke();
    // stuck papers
    c.fillStyle = "#fff";
    for (let i = 0; i < this.collected; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.fillRect(this.bx + Math.cos(a) * 30 - 5, this.by + Math.sin(a) * 38 - 5, 10, 10);
    }

    // charge sparks
    for (const s of this.sparks) {
      c.fillStyle = `rgba(250,204,21,${s.life})`;
      c.beginPath();
      c.arc(s.x, s.y, 3, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "#854d0e";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Drag the balloon ⚡", this.bx, this.by - 56);
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
    this.charge = 0;
    this.collected = 0;
    this.elapsed = 0;
    this.started = false;
    this.bx = W / 2;
    this.by = 320;
    this.spawnBits();
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
    this.detach();
  }
}

export const staticGame: GameModule = {
  meta: {
    id: "static",
    conceptId: "phys-23",
    title: "Spark!",
    stream: "physics",
    gradeBand: "4-5",
    emoji: "⚡",
    blurb: "Rub a balloon to build a static charge, then attract bits of paper.",
    mission: "Charge the balloon and use static electricity to collect all the paper bits.",
    estMinutes: 3,
  },
  create: (ctx) => new StaticElec(ctx),
};
