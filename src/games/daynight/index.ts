import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const EX = 380;
const EY = 320;
const R = 130; // Earth radius

// Sun is to the RIGHT (+x). The city faces the Sun (noon) when its angle ~ 0.
interface Prompt {
  name: string;
  emoji: string;
  test: (cos: number, sin: number) => boolean;
  hint: string;
}

const PROMPTS: Prompt[] = [
  { name: "Noon (midday)", emoji: "☀️", test: (cos) => cos > 0.92, hint: "At noon the city faces straight toward the Sun, so it's brightest." },
  { name: "Midnight", emoji: "🌙", test: (cos) => cos < -0.92, hint: "At midnight the city faces away from the Sun, into Earth's shadow." },
  { name: "Sunrise or sunset", emoji: "🌅", test: (cos) => Math.abs(cos) < 0.16, hint: "At sunrise/sunset the city is on the edge between the lit and dark sides." },
];

class DayNight implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private cityAngle = Math.PI; // city's position around Earth (0 = toward Sun)
  private dragging = false;
  private idx = 0;
  private matched = 0;
  private mistakes = 0;

  private promptEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        this.dragging = true;
        this.setFromPointer(p);
      },
      move: (p) => {
        if (this.dragging) this.setFromPointer(p);
      },
      up: () => {
        this.dragging = false;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Day and night happen because Earth spins on its axis — not because the Sun moves around us.",
      "The half of Earth facing the Sun has daytime; the half facing away has night.",
      "Spin the city to face the Sun for noon, away from it for midnight, or to the edge for sunrise/sunset.",
    ]);
    this.renderLoop();
  }

  private target(): Prompt {
    return PROMPTS[this.idx];
  }

  private setFromPointer(p: Point): void {
    if (this.ended) return;
    this.cityAngle = Math.atan2(p.y - EY, p.x - EX);
    this.updateReadout();
  }

  private timeName(): string {
    const cos = Math.cos(this.cityAngle);
    const sin = Math.sin(this.cityAngle);
    if (cos > 0.92) return "☀️ Noon";
    if (cos < -0.92) return "🌙 Midnight";
    if (Math.abs(cos) < 0.16) return sin < 0 ? "🌅 Sunrise" : "🌇 Sunset";
    if (cos > 0) return sin < 0 ? "🌤️ Morning" : "🌤️ Afternoon";
    return sin < 0 ? "🌃 Late night" : "🌆 Evening";
  }

  private buildPanel(): void {
    const lockBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.lockIn() },
      "🔒 Lock the time",
    );

    this.promptEl = el("span", { style: { color: "var(--accent-blue)" } }, `${this.target().emoji} ${this.target().name}`);
    this.timeEl = el("span", {}, "—");
    this.statusEl = el("span", {}, `0 / ${PROMPTS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Spin the Earth so the city is at the right time of day.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Make it"),
        this.promptEl,
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag the city to spin Earth"),
      lockBtn,
      el("div", { class: "metric" }, el("span", {}, "🏙️ City time"), this.timeEl),
      el("div", { class: "metric" }, el("span", {}, "✅ Matched"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.timeEl.textContent = this.timeName();
  }

  private lockIn(): void {
    if (this.ended) return;
    const t = this.target();
    const cos = Math.cos(this.cityAngle);
    const sin = Math.sin(this.cityAngle);
    if (t.test(cos, sin)) {
      this.matched += 1;
      this.ctx.services.audio.play("tick");
      this.statusEl.textContent = `${this.matched} / ${PROMPTS.length}`;
      this.coachEl.textContent = `✅ ${t.hint}`;
      this.idx += 1;
      if (this.matched >= PROMPTS.length) this.win();
      else this.promptEl.textContent = `${this.target().emoji} ${this.target().name}`;
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Right now it's ${this.timeName().replace(/^.\s*/, "")}. ${t.hint}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("daynight_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "You spun the day! Earth turns once a day on its axis. Whatever faces the Sun has daytime; the side turned away has night.",
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
    c.fillStyle = "#070b20";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 50; i++) c.fillRect((i * 151) % W, (i * 83) % H, 2, 2);

    // Sun on the right
    const sunX = 740;
    const glow = c.createRadialGradient(sunX, EY, 10, sunX, EY, 80);
    glow.addColorStop(0, "#fff7ae");
    glow.addColorStop(1, "rgba(255,200,40,0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sunX, EY, 80, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.arc(sunX, EY, 42, 0, Math.PI * 2);
    c.fill();
    // rays
    c.strokeStyle = "rgba(255,210,63,0.3)";
    c.lineWidth = 2;
    for (let y = 180; y < 460; y += 32) {
      c.beginPath();
      c.moveTo(sunX - 60, y);
      c.lineTo(EX + R, y);
      c.stroke();
    }

    // Earth: day side (right) lit, night side (left) dark
    c.fillStyle = "#1d4ed8";
    c.beginPath();
    c.arc(EX, EY, R, 0, Math.PI * 2);
    c.fill();
    // continents
    c.fillStyle = "#16a34a";
    c.beginPath();
    c.arc(EX - 30, EY - 30, 34, 0, Math.PI * 2);
    c.arc(EX + 40, EY + 20, 26, 0, Math.PI * 2);
    c.arc(EX - 10, EY + 50, 20, 0, Math.PI * 2);
    c.fill();
    // night shadow on the far (left) side
    c.fillStyle = "rgba(0,0,20,0.62)";
    c.beginPath();
    c.arc(EX, EY, R, Math.PI / 2, -Math.PI / 2, false);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.2)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(EX, EY, R, 0, Math.PI * 2);
    c.stroke();

    // city marker on the surface
    const cxp = EX + Math.cos(this.cityAngle) * R;
    const cyp = EY + Math.sin(this.cityAngle) * R;
    const cos = Math.cos(this.cityAngle);
    c.fillStyle = cos > 0 ? "#fde047" : "#1e293b";
    c.beginPath();
    c.arc(cxp, cyp, 12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = this.dragging ? "#22c55e" : "#fff";
    c.lineWidth = 3;
    c.stroke();
    c.font = "16px serif";
    c.textAlign = "center";
    c.fillText("🏙️", cxp, cyp + 5);

    // time label by the city
    c.fillStyle = "#fff";
    c.font = "bold 16px Nunito, sans-serif";
    const lx = cxp + Math.cos(this.cityAngle) * 40;
    const ly = cyp + Math.sin(this.cityAngle) * 40;
    c.fillText(this.timeName(), lx, ly);

    // title
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText(`Make it ${this.target().name} ${this.target().emoji} in the city`, W / 2, 40);
    c.font = "13px Nunito, sans-serif";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText("Earth spins — the side facing the Sun has day, the far side has night.", W / 2, 64);
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.cityAngle = Math.PI;
    this.idx = 0;
    this.matched = 0;
    this.mistakes = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const dayNightGame: GameModule = {
  meta: {
    id: "daynight",
    conceptId: "ess-03",
    title: "Spin the World",
    stream: "earth-space",
    gradeBand: "1-3",
    emoji: "🌗",
    blurb: "Spin the Earth to put a city into noon, midnight, or sunrise.",
    mission: "Rotate Earth to give the city the right time of day three times.",
    estMinutes: 2,
  },
  create: (ctx) => new DayNight(ctx),
};
