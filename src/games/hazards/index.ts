import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Action {
  key: string;
  label: string;
  emoji: string;
}
const ACTIONS: Action[] = [
  { key: "cover", label: "Drop & take cover", emoji: "🛡️" },
  { key: "high", label: "Go to high ground", emoji: "⛰️" },
  { key: "inside", label: "Shelter inside", emoji: "🏠" },
  { key: "away", label: "Move far away", emoji: "🏃" },
];

interface Hazard {
  name: string;
  emoji: string;
  action: string;
  why: string;
}
const HAZARDS: Hazard[] = [
  { name: "Earthquake", emoji: "🌍", action: "cover", why: "In an earthquake, drop, cover, and hold on under something sturdy." },
  { name: "Flood", emoji: "🌊", action: "high", why: "In a flood, move to higher ground away from the rising water." },
  { name: "Thunderstorm", emoji: "⛈️", action: "inside", why: "In a thunderstorm, shelter inside away from the lightning." },
  { name: "Wildfire", emoji: "🔥", action: "away", why: "In a wildfire, move far away from the flames and smoke." },
  { name: "Tornado", emoji: "🌪️", action: "inside", why: "In a tornado, shelter inside, in a basement or inner room." },
];

class Hazards implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Hazard[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...HAZARDS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Natural hazards like storms, floods, and earthquakes can be dangerous — but staying safe is about knowing what to do.",
      "Think about the danger: shaking ground, rising water, fire, or wild wind — what keeps you safest?",
      "Earthquake → take cover; flood → high ground; fire → move away; storms/tornado → shelter inside.",
    ]);
    this.renderLoop();
  }

  private current(): Hazard { return this.order[this.idx]; }

  private buildPanel(): void {
    const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } },
      ...ACTIONS.map((a) => el("button", { class: "chip", onclick: () => this.choose(a.key) }, `${a.emoji} ${a.label}`)));
    this.progressEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.idx + 1} / ${HAZARDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" } });
    this.coachEl.textContent = "What's the safest thing to do?";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "⚠️ Hazard"), el("span", {}, this.current().name)),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Choose the safe action"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🚨 Hazard"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(key: string): void {
    if (this.ended) return;
    const h = this.current();
    if (key === h.action) { this.flash = 1; this.ctx.services.audio.play("tick"); this.coachEl.textContent = `✅ ${h.why}`; }
    else { this.flash = -1; this.mistakes += 1; this.ctx.services.audio.play("fail"); this.coachEl.textContent = `❌ ${h.why}`; }
    this.idx += 1;
    if (this.idx >= this.order.length) { this.progressEl.textContent = `${HAZARDS.length} / ${HAZARDS.length}`; this.win(); }
    else this.progressEl.textContent = `${this.idx + 1} / ${HAZARDS.length}`;
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 1 ? 2 : 1;
    this.ctx.services.score.event("hazards_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message: "Safety star! Knowing what to do in earthquakes, floods, fires, and storms keeps you safe when nature gets wild.",
      stars, resources: { Rock: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => { this.anim += 0.05; if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03); if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03); this.render(); this.raf = requestAnimationFrame(draw); };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fff7ed"; c.fillRect(0, 0, W, H);
    if (this.ended) { c.fillStyle = "#9a3412"; c.font = "bold 28px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("Stay safe out there! 🚨", W / 2, H / 2); return; }
    if (this.flash > 0) { c.fillStyle = `rgba(34,197,94,${this.flash * 0.22})`; c.fillRect(0, 0, W, H); }
    else if (this.flash < 0) { c.fillStyle = `rgba(255,90,95,${-this.flash * 0.22})`; c.fillRect(0, 0, W, H); }
    const h = this.current();
    const cx = W / 2, cy = 280 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff"; c.strokeStyle = "#fdba74"; c.lineWidth = 6; this.roundRect(c, cx - 170, cy - 150, 340, 280, 24); c.fill(); c.stroke();
    c.font = "120px serif"; c.textAlign = "center"; c.fillText(h.emoji, cx, cy + 20);
    c.fillStyle = "#9a3412"; c.font = "bold 26px Nunito, sans-serif"; c.fillText(h.name, cx, cy + 100);
    c.font = "bold 20px Nunito, sans-serif"; c.fillText("Stay safe — what should you do? ⚠️", W / 2, 60);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void { this.ended = false; this.idx = 0; this.mistakes = 0; this.flash = 0; this.order = [...HAZARDS].sort(() => Math.random() - 0.5); this.ctx.services.hints.reset(); this.buildPanel(); }
  destroy(): void { cancelAnimationFrame(this.raf); }
}

export const hazardsGame: GameModule = {
  meta: {
    id: "hazards", conceptId: "ess-25", title: "Stay Safe", stream: "earth-space", gradeBand: "3-4",
    emoji: "🚨", blurb: "Match each natural hazard to the safest thing to do.",
    mission: "Choose the right safety action for every natural hazard.", estMinutes: 2,
  },
  create: (ctx) => new Hazards(ctx),
};
