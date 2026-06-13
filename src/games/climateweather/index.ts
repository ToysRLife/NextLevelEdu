import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

interface Stmt {
  text: string;
  emoji: string;
  weather: boolean; // true=weather, false=climate
  why: string;
}

const STATEMENTS: Stmt[] = [
  { text: "It's raining right now", emoji: "🌧️", weather: true, why: "What's happening right now is weather." },
  { text: "It's windy this afternoon", emoji: "💨", weather: true, why: "Today's conditions are weather." },
  { text: "Snow fell this morning", emoji: "❄️", weather: true, why: "A single day's snow is weather." },
  { text: "The sky is clear today", emoji: "☀️", weather: true, why: "Today's sky is weather." },
  { text: "Deserts are dry all year round", emoji: "🏜️", weather: false, why: "A place's usual conditions over years is climate." },
  { text: "The Arctic is cold most of the time", emoji: "🧊", weather: false, why: "Long-term, usual conditions are climate." },
  { text: "Rainforests are warm and wet year-round", emoji: "🌴", weather: false, why: "Year-round patterns describe climate." },
  { text: "This town has mild summers every year", emoji: "🌍", weather: false, why: "What's typical every year is climate." },
];

class ClimateWeather implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private order: Stmt[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;
  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...STATEMENTS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Weather is what the air is doing right now or today. Climate is the usual weather of a place over many years.",
      "Words like 'today', 'right now', 'this morning' point to weather.",
      "Words like 'all year', 'usually', 'every year' point to climate.",
    ]);
    this.renderLoop();
  }

  private current(): Stmt { return this.order[this.idx]; }

  private buildPanel(): void {
    const choices = el("div", { class: "chip-row" },
      el("button", { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.choose(true) }, "🌦️ Weather (now)"),
      el("button", { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.choose(false) }, "🌍 Climate (usual)"));
    this.progressEl = el("span", { style: { color: "var(--accent-blue)" } }, `1 / ${STATEMENTS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" } });
    this.coachEl.textContent = "Is this weather or climate?";
    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🌦️ Statement"), el("span", {}, `${this.idx + 1}/${STATEMENTS.length}`)),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Weather or climate?"),
      choices,
      el("div", { class: "metric" }, el("span", {}, "📋 Statement"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(saysWeather: boolean): void {
    if (this.ended) return;
    const s = this.current();
    if (saysWeather === s.weather) { this.flash = 1; this.ctx.services.audio.play("tick"); this.coachEl.textContent = `✅ ${s.why}`; }
    else { this.flash = -1; this.mistakes += 1; this.ctx.services.audio.play("fail"); this.coachEl.textContent = `❌ ${s.why}`; }
    this.idx += 1;
    if (this.idx >= this.order.length) { this.progressEl.textContent = `${STATEMENTS.length} / ${STATEMENTS.length}`; this.win(); }
    else { this.progressEl.textContent = `${this.idx + 1} / ${STATEMENTS.length}`; this.buildPanel(); }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("climateweather_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message: "Got it! Weather is what's happening now; climate is the usual weather of a place over many years.",
      stars, resources: { Climate: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => { this.anim += 0.05; if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03); if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03); this.render(); this.raf = requestAnimationFrame(draw); };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff"; c.fillRect(0, 0, W, H);
    if (this.ended) { c.fillStyle = "#1e3a8a"; c.font = "bold 28px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("Weather vs climate — mastered! 🌍", W / 2, H / 2); return; }
    if (this.flash > 0) { c.fillStyle = `rgba(34,197,94,${this.flash * 0.22})`; c.fillRect(0, 0, W, H); }
    else if (this.flash < 0) { c.fillStyle = `rgba(255,90,95,${-this.flash * 0.22})`; c.fillRect(0, 0, W, H); }

    const s = this.current();
    const cx = W / 2, cy = 270 + Math.sin(this.anim) * 5;
    c.fillStyle = "#fff"; c.strokeStyle = "#93c5fd"; c.lineWidth = 6; this.roundRect(c, cx - 250, cy - 110, 500, 220, 22); c.fill(); c.stroke();
    c.font = "70px serif"; c.textAlign = "center"; c.fillText(s.emoji, cx, cy - 20);
    c.fillStyle = "#1e3a8a"; c.font = "bold 22px Nunito, sans-serif";
    this.wrap(c, `"${s.text}"`, cx, cy + 50, 440, 30);

    c.fillStyle = "#1e3a8a"; c.font = "bold 18px Nunito, sans-serif"; c.fillText("Weather (right now) or climate (usual)?", W / 2, 60);
  }

  private wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
    const words = text.split(" "); let line = ""; let yy = y;
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
    c.fillText(line, x, yy);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void { this.ended = false; this.idx = 0; this.mistakes = 0; this.flash = 0; this.order = [...STATEMENTS].sort(() => Math.random() - 0.5); this.ctx.services.hints.reset(); this.buildPanel(); }
  destroy(): void { cancelAnimationFrame(this.raf); }
}

export const climateWeatherGame: GameModule = {
  meta: {
    id: "climateweather", conceptId: "ess-24", title: "Weather or Climate?", stream: "earth-space", gradeBand: "3-5",
    emoji: "🌦️", blurb: "Tell apart what's happening now (weather) from what's usual over years (climate).",
    mission: "Sort each statement into weather or climate.", estMinutes: 2,
  },
  create: (ctx) => new ClimateWeather(ctx),
};
