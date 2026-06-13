import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const CX = W / 2;

interface Part {
  key: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  r: number;
}

const PARTS: Part[] = [
  { key: "head", name: "Head", emoji: "🧠", x: CX, y: 130, r: 44 },
  { key: "arm", name: "Arm", emoji: "💪", x: CX - 78, y: 270, r: 34 },
  { key: "hand", name: "Hand", emoji: "✋", x: CX - 108, y: 350, r: 28 },
  { key: "leg", name: "Leg", emoji: "🦵", x: CX - 34, y: 450, r: 36 },
  { key: "foot", name: "Foot", emoji: "🦶", x: CX - 42, y: 540, r: 28 },
];

class BodyParts implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Part[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...PARTS].sort(() => Math.random() - 0.5);
    this.detach = onPointer(ctx.canvas, W, H, { down: (p) => this.tap(p) });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Our bodies have many parts, and each has a name and a job.",
      "Find the part the question asks for on the body picture.",
      "Head is on top, arms and hands reach out, legs and feet are at the bottom.",
    ]);
    this.renderLoop();
  }

  private current(): Part { return this.order[this.idx]; }

  private buildPanel(): void {
    this.progressEl = el("span", { style: { color: "var(--accent-purple)" } }, `1 / ${PARTS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-purple)", background: "#faf5ff" } });
    this.coachEl.textContent = `Tap the ${this.current().name.toLowerCase()} on the body.`;
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "👉 Find the"), el("span", {}, `${this.current().emoji} ${this.current().name}`)),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Tap it on the figure"),
      el("div", { class: "metric" }, el("span", {}, "🧍 Part"), this.progressEl),
      this.coachEl,
    );
  }

  private tap(p: Point): void {
    if (this.ended) return;
    const want = this.current();
    if (Math.hypot(p.x - want.x, p.y - want.y) < want.r + 12) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ That's the ${want.name.toLowerCase()}!`;
      this.next();
      return;
    }
    const other = PARTS.find((pp) => pp.key !== want.key && Math.hypot(p.x - pp.x, p.y - pp.y) < pp.r + 12);
    if (other) {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ That's the ${other.name.toLowerCase()}. Find the ${want.name.toLowerCase()}.`;
    }
  }

  private next(): void {
    this.idx += 1;
    if (this.idx >= this.order.length) { this.progressEl.textContent = `${PARTS.length} / ${PARTS.length}`; this.win(); }
    else { this.progressEl.textContent = `${this.idx + 1} / ${PARTS.length}`; this.buildPanel(); }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
    this.ctx.services.score.event("bodyparts_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message: "You know your body! Head, arms, hands, legs, and feet — each part has its own name and job.",
      stars, resources: { Species: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => { this.anim += 0.05; if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04); if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.04); this.render(); this.raf = requestAnimationFrame(draw); };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#faf5ff"; c.fillRect(0, 0, W, H);
    if (this.ended) { c.fillStyle = "#581c87"; c.font = "bold 30px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("All parts found! 🧍", W / 2, H / 2); return; }

    // figure
    c.strokeStyle = "#7c3aed"; c.fillStyle = "#c4b5fd"; c.lineWidth = 4;
    // head
    c.beginPath(); c.arc(CX, 130, 40, 0, Math.PI * 2); c.fill(); c.stroke();
    // body
    c.fillStyle = "#a78bfa";
    this.roundRect(c, CX - 36, 178, 72, 170, 18); c.fill();
    // arms
    c.lineWidth = 22; c.strokeStyle = "#a78bfa"; c.lineCap = "round";
    c.beginPath(); c.moveTo(CX - 30, 200); c.lineTo(CX - 108, 350); c.stroke();
    c.beginPath(); c.moveTo(CX + 30, 200); c.lineTo(CX + 108, 350); c.stroke();
    // legs
    c.beginPath(); c.moveTo(CX - 18, 345); c.lineTo(CX - 42, 540); c.stroke();
    c.beginPath(); c.moveTo(CX + 18, 345); c.lineTo(CX + 42, 540); c.stroke();
    c.lineCap = "butt";

    // highlight the target zone faintly
    const want = this.current();
    c.strokeStyle = `rgba(155,107,255,${0.4 + Math.sin(this.anim * 3) * 0.2})`;
    c.lineWidth = 3; c.setLineDash([5, 5]);
    c.beginPath(); c.arc(want.x, want.y, want.r + 6, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    c.fillStyle = "#581c87"; c.font = "bold 20px Nunito, sans-serif"; c.textAlign = "center";
    c.fillText(`Tap the ${want.name} ${want.emoji}`, W / 2, 50);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void { this.ended = false; this.idx = 0; this.mistakes = 0; this.flash = 0; this.order = [...PARTS].sort(() => Math.random() - 0.5); this.ctx.services.hints.reset(); this.buildPanel(); }
  destroy(): void { cancelAnimationFrame(this.raf); this.detach(); }
}

export const bodyPartsGame: GameModule = {
  meta: {
    id: "bodyparts", conceptId: "bio-08", title: "Body Parts", stream: "biology", gradeBand: "K-1",
    emoji: "🧍", blurb: "Tap the head, arms, hands, legs, and feet on the body.",
    mission: "Find every named body part on the figure.", estMinutes: 2,
  },
  create: (ctx) => new BodyParts(ctx),
};
