import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;
const GROUND = 520;
const NEED = 3; // controlled eruptions to build the cone

class Volcano implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  // green "ready" band — wider for juniors, tighter for masters (adaptive)
  private readonly bandLo: number;
  private readonly bandHi: number;

  private pressure = 10; // 0..100
  private erupting = 0; // animation timer for lava burst
  private good = 0;
  private mistakes = 0;
  private cone = 0; // grows with each good eruption
  private anim = 0;
  private ended = false;
  private lava: { x: number; y: number; vx: number; vy: number }[] = [];

  private pressEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.bandLo = byTier(ctx.tier, 55, 65, 72);
    this.bandHi = byTier(ctx.tier, 92, 88, 84);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "A volcano erupts when hot melted rock (magma) and gas build up pressure underground.",
      "Let pressure rise into the green band, then erupt — that's a steady flow that builds new rock.",
      "If pressure climbs too high it bursts violently. Tap Release Steam to vent a little and keep it in the green zone.",
    ]);
    this.loop.start();
    this.render();
  }

  private buildPanel(): void {
    const eruptBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-red)" }, onclick: () => this.erupt() },
      "🌋 Erupt"
    );
    const steamBtn = el(
      "button",
      { class: "btn secondary", onclick: () => this.releaseSteam() },
      "💨 Release Steam"
    );

    this.pressEl = el("span", {}, "10%");
    this.statusEl = el("span", { style: { color: "var(--accent-orange)" } }, `0 / ${NEED}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent =
      "Let pressure build into the green band, then erupt to build new rock.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `${NEED} controlled eruptions`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Erupt in the green band"),
      eruptBtn,
      steamBtn,
      el("div", { class: "metric" }, el("span", {}, "🌡️ Pressure"), this.pressEl),
      el("div", { class: "metric" }, el("span", {}, "🏔️ Eruptions"), this.statusEl),
      this.coachEl
    );
  }

  private erupt(): void {
    if (this.ended) return;
    if (this.pressure >= this.bandLo && this.pressure <= this.bandHi) {
      this.good += 1;
      this.cone = Math.min(1, this.cone + 1 / NEED);
      this.burst(28);
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = "🌋 A steady eruption! Cooled lava added a fresh layer of rock.";
      this.statusEl.textContent = `${this.good} / ${NEED}`;
      this.pressure = 12;
      if (this.good >= NEED) this.finish();
    } else if (this.pressure < this.bandLo) {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        "Just a fizzle — not enough pressure yet. Let it build into the green band.";
    } else {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.burst(50);
      this.coachEl.textContent =
        "💥 Too much pressure — a violent burst! Vent steam earlier next time.";
      this.pressure = 8;
    }
  }

  private releaseSteam(): void {
    if (this.ended) return;
    this.pressure = Math.max(0, this.pressure - 18);
    this.ctx.services.audio.play("click");
  }

  private burst(power: number): void {
    this.erupting = 1;
    const topX = W / 2;
    const topY = GROUND - 120 - this.cone * 80;
    for (let i = 0; i < power; i++) {
      this.lava.push({
        x: topX + (Math.random() - 0.5) * 30,
        y: topY,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 7,
      });
    }
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    this.anim += 0.05 * f;
    // Pressure builds steadily; player must manage it.
    this.pressure = Math.min(100, this.pressure + 0.18 * f);
    if (this.pressure >= 100) {
      // auto violent eruption if neglected
      this.mistakes += 1;
      this.burst(50);
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        "💥 It blew on its own — pressure hit the max! Erupt or vent before that.";
      this.pressure = 8;
    }
    if (this.erupting > 0) this.erupting = Math.max(0, this.erupting - 0.02 * f);

    for (const p of this.lava) {
      p.vy += 0.3 * f;
      p.x += p.vx * f;
      p.y += p.vy * f;
    }
    this.lava = this.lava.filter((p) => p.y < H + 20);

    this.pressEl.textContent = `${Math.round(this.pressure)}%`;
    this.render();
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("volcano_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "A new mountain! Volcanoes erupt when magma and gas build pressure. Each lava flow cools into solid rock, slowly building the land.",
      stars,
      resources: { Rock: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    // sky
    c.fillStyle = "#1e1b4b";
    c.fillRect(0, 0, W, GROUND);
    c.fillStyle = "#3b1d1d";
    c.fillRect(0, GROUND, W, H - GROUND);

    // volcano cone (grows with eruptions)
    const baseY = GROUND;
    const peakY = GROUND - 120 - this.cone * 80;
    const halfW = 180 + this.cone * 40;
    c.fillStyle = "#44403c";
    c.beginPath();
    c.moveTo(W / 2 - halfW, baseY);
    c.lineTo(W / 2 - 34, peakY);
    c.lineTo(W / 2 + 34, peakY);
    c.lineTo(W / 2 + halfW, baseY);
    c.closePath();
    c.fill();

    // glowing crater
    c.fillStyle = `rgba(255,${100 - this.pressure}, 0, ${0.5 + (this.pressure / 100) * 0.5})`;
    c.beginPath();
    c.ellipse(W / 2, peakY, 34, 12, 0, 0, Math.PI * 2);
    c.fill();

    // steam wisps near top when pressure high
    if (this.pressure > 40) {
      c.strokeStyle = `rgba(255,255,255,${(this.pressure - 40) / 120})`;
      c.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const sx = W / 2 - 20 + i * 20;
        c.beginPath();
        c.moveTo(sx, peakY);
        c.quadraticCurveTo(sx + Math.sin(this.anim + i) * 16, peakY - 40, sx, peakY - 70);
        c.stroke();
      }
    }

    // lava particles
    for (const p of this.lava) {
      c.fillStyle = "#f97316";
      c.beginPath();
      c.arc(p.x, p.y, 5, 0, Math.PI * 2);
      c.fill();
    }

    // pressure gauge (vertical) on left
    const gx = 60;
    const gy = 120;
    const gh = 320;
    c.fillStyle = "rgba(255,255,255,0.15)";
    this.roundRect(c, gx, gy, 36, gh, 18);
    c.fill();
    // green band
    const bandTop = gy + gh * (1 - this.bandHi / 100);
    const bandH = gh * ((this.bandHi - this.bandLo) / 100);
    c.fillStyle = "rgba(34,197,94,0.45)";
    c.fillRect(gx, bandTop, 36, bandH);
    // fill
    const fillH = gh * (this.pressure / 100);
    const inBand = this.pressure >= this.bandLo && this.pressure <= this.bandHi;
    c.fillStyle = inBand ? "#22c55e" : this.pressure > this.bandHi ? "#ef4444" : "#f59e0b";
    this.roundRect(c, gx, gy + gh - fillH, 36, fillH, 18);
    c.fill();
    c.fillStyle = "#fff";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("PRESSURE", gx + 18, gy - 12);
    c.save();
    c.fillStyle = "#bbf7d0";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("← erupt here", gx + 44, bandTop + bandH / 2);
    c.restore();
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
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
    this.pressure = 10;
    this.good = 0;
    this.mistakes = 0;
    this.cone = 0;
    this.lava = [];
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const volcanoGame: GameModule = {
  meta: {
    id: "volcano",
    conceptId: "ess-17",
    title: "Pressure Point",
    stream: "earth-space",
    gradeBand: "4-5",
    emoji: "🌋",
    blurb: "Manage magma pressure and erupt at the right moment to build a volcano.",
    mission: "Build the cone with three controlled eruptions without a violent blowout.",
    estMinutes: 3,
  },
  create: (ctx) => new Volcano(ctx),
};
