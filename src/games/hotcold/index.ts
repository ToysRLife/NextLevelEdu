import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

type Result = "melt" | "freeze" | "boil" | "none";

const RESULTS: { key: Result; label: string; emoji: string }[] = [
  { key: "melt", label: "Melts", emoji: "🫠" },
  { key: "freeze", label: "Freezes", emoji: "🧊" },
  { key: "boil", label: "Boils to steam", emoji: "💨" },
  { key: "none", label: "No change", emoji: "🔁" },
];

interface Scn {
  item: string;
  emoji: string;
  action: "heat" | "cool";
  result: Result;
  why: string;
}

const SCENARIOS: Scn[] = [
  { item: "Ice cube", emoji: "🧊", action: "heat", result: "melt", why: "Heating ice melts it into liquid water." },
  { item: "Water", emoji: "💧", action: "cool", result: "freeze", why: "Cooling water below 0°C freezes it into ice." },
  { item: "Chocolate", emoji: "🍫", action: "heat", result: "melt", why: "Heat melts solid chocolate into gooey liquid." },
  { item: "Water", emoji: "💧", action: "heat", result: "boil", why: "Heating water to boiling turns it into steam." },
  { item: "Juice", emoji: "🧃", action: "cool", result: "freeze", why: "Cooling juice enough freezes it into an ice lolly." },
  { item: "Rock", emoji: "🪨", action: "heat", result: "none", why: "A little heat won't change a rock — it needs enormous heat to melt." },
];

class HotCold implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Scn[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...SCENARIOS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Heating and cooling can change matter from one state to another.",
      "Heat usually melts solids or boils liquids; cold freezes liquids into solids.",
      "Think about what the heat or cold will do — and remember some things (like rock) barely change.",
    ]);
    this.renderLoop();
  }

  private current(): Scn { return this.order[this.idx]; }

  private buildPanel(): void {
    const chips = el("div", { class: "chip-row", style: { flexWrap: "wrap" } },
      ...RESULTS.map((r) => el("button", { class: "chip", onclick: () => this.choose(r.key) }, `${r.emoji} ${r.label}`)));
    this.progressEl = el("span", { style: { color: "var(--accent-orange)" } }, `${this.idx + 1} / ${SCENARIOS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" } });
    this.coachEl.textContent = "What happens to it?";
    clear(this.ctx.panel);
    const cur = this.current();
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, cur.action === "heat" ? "🔥 Heat it" : "🧊 Cool it"), el("span", {}, cur.item)),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "What change happens?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🧪 Test"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(r: Result): void {
    if (this.ended) return;
    const s = this.current();
    if (r === s.result) { this.flash = 1; this.ctx.services.audio.play("tick"); this.coachEl.textContent = `✅ ${s.why}`; }
    else { this.flash = -1; this.mistakes += 1; this.ctx.services.audio.play("fail"); this.coachEl.textContent = `❌ ${s.why}`; }
    this.idx += 1;
    if (this.idx >= this.order.length) { this.progressEl.textContent = `${SCENARIOS.length} / ${SCENARIOS.length}`; this.win(); }
    else { this.progressEl.textContent = `${this.idx + 1} / ${SCENARIOS.length}`; this.buildPanel(); }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("hotcold_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message: "Nicely predicted! Heating melts and boils things; cooling freezes them. Temperature changes the state of matter.",
      stars, resources: { Energy: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => { this.anim += 0.05; if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03); if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03); this.render(); this.raf = requestAnimationFrame(draw); };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fff7ed"; c.fillRect(0, 0, W, H);
    if (this.ended) { c.fillStyle = "#9a3412"; c.font = "bold 30px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("Change predicted! 🌡️", W / 2, H / 2); return; }
    if (this.flash > 0) { c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`; c.fillRect(0, 0, W, H); }
    else if (this.flash < 0) { c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`; c.fillRect(0, 0, W, H); }
    const s = this.current();
    const cx = W / 2, cy = 280 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff"; c.strokeStyle = s.action === "heat" ? "#fca5a5" : "#93c5fd"; c.lineWidth = 6;
    this.roundRect(c, cx - 170, cy - 150, 340, 280, 24); c.fill(); c.stroke();
    c.font = "110px serif"; c.textAlign = "center"; c.fillText(s.emoji, cx, cy);
    c.font = "50px serif"; c.fillText(s.action === "heat" ? "🔥" : "🧊", cx + 110, cy - 70);
    c.fillStyle = "#9a3412"; c.font = "bold 24px Nunito, sans-serif"; c.fillText(`${s.item} + ${s.action === "heat" ? "heat" : "cold"}`, cx, cy + 90);
    c.fillStyle = "#9a3412"; c.font = "bold 20px Nunito, sans-serif"; c.fillText("Heating & cooling — what changes? 🌡️", W / 2, 60);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void { this.ended = false; this.idx = 0; this.mistakes = 0; this.flash = 0; this.order = [...SCENARIOS].sort(() => Math.random() - 0.5); this.ctx.services.hints.reset(); this.buildPanel(); }
  destroy(): void { cancelAnimationFrame(this.raf); }
}

export const hotColdGame: GameModule = {
  meta: {
    id: "hotcold", conceptId: "chem-07", title: "Hot & Cold", stream: "chemistry", gradeBand: "2",
    emoji: "🌡️", blurb: "Predict how heating or cooling changes each material.",
    mission: "Say what happens when each thing is heated or cooled.", estMinutes: 2,
  },
  create: (ctx) => new HotCold(ctx),
};
