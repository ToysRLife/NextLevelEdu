import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const TOP = 120; // pulley beam height
const MAX_PULL = 30; // the mover's strength

interface Round {
  weight: number;
}

const ROUNDS: Round[] = [{ weight: 40 }, { weight: 75 }, { weight: 110 }];

class Pulley implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private pulleys = 1;
  private roundIdx = 0;
  private lift = 0; // 0..1 load height
  private hauling = false;
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
      "A pulley is a wheel with a rope — a simple machine that changes how hard you must pull.",
      "Adding more pulleys shares the load, so each pull needs less force (but you pull more rope).",
      "If the load is too heavy for one pulley, add more until the force needed drops below your strength.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.roundIdx];
  }

  private forceNeeded(): number {
    return this.round().weight / this.pulleys;
  }

  private buildPanel(): void {
    const row = el(
      "div",
      { class: "chip-row" },
      ...[1, 2, 3, 4].map((n) =>
        el(
          "button",
          {
            class: "chip",
            style:
              this.pulleys === n
                ? {
                    background: "var(--accent-blue)",
                    color: "#fff",
                    borderColor: "var(--accent-blue)",
                  }
                : {},
            onclick: () => {
              if (this.hauling) return;
              this.pulleys = n;
              this.buildPanel();
            },
          },
          `${n} 🛞`
        )
      )
    );
    const haulBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.haul() },
      "🪢 Haul it up"
    );

    this.forceEl = el("span", {}, "");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.roundIdx} / ${ROUNDS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Lift the load")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "How many pulleys?"),
      row,
      haulBtn,
      el("div", { class: "metric" }, el("span", {}, "💪 Force needed"), this.forceEl),
      el("div", { class: "metric" }, el("span", {}, "📦 Lifted"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const need = this.forceNeeded();
    this.forceEl.textContent = `${need.toFixed(0)} / ${MAX_PULL} 💪`;
    this.forceEl.style.color = need <= MAX_PULL ? "var(--accent-green)" : "var(--accent-red)";
    this.coachEl.textContent =
      need <= MAX_PULL
        ? `With ${this.pulleys} pulley${this.pulleys > 1 ? "s" : ""}, you only pull ${need.toFixed(0)} — light enough to haul!`
        : `Too heavy at ${need.toFixed(0)} force. Add more pulleys to share the load.`;
  }

  private haul(): void {
    if (this.ended || this.hauling) return;
    if (this.forceNeeded() > MAX_PULL) {
      this.attempts += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = "😣 It won't budge — too heavy for that few pulleys. Add more!";
      return;
    }
    this.hauling = true;
    this.lift = 0;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended || !this.hauling) {
      if (this.hauling) this.render();
      return;
    }
    const f = dtMs / 16.67;
    // more pulleys = more rope to pull = slower lift (the trade-off)
    this.lift = Math.min(1, this.lift + (0.012 / this.pulleys) * f * 2);
    if (this.lift >= 1) {
      this.hauling = false;
      this.win();
    }
    this.render();
  }

  private win(): void {
    this.roundIdx += 1;
    this.ctx.services.audio.play("tick");
    if (this.roundIdx >= ROUNDS.length) {
      this.finish();
    } else {
      this.lift = 0;
      this.statusEl.textContent = `${this.roundIdx} / ${ROUNDS.length}`;
      this.coachEl.textContent = "📦 Hauled up! Heavier load next — you may need more pulleys.";
      this.updateReadout();
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    this.statusEl.textContent = `${ROUNDS.length} / ${ROUNDS.length}`;
    const stars = this.attempts === 0 ? 3 : this.attempts <= 2 ? 2 : 1;
    this.ctx.services.score.event("pulley_done", { attempts: this.attempts });
    this.ctx.services.outcome.succeed({
      message:
        "Heave-ho! A pulley system spreads a heavy load across more rope, so each pull takes less force. More pulleys = less effort (but more rope to pull).",
      stars,
      resources: { Alloy: 40 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#cbd5e1";
    c.fillRect(0, 540, W, H - 540);

    // support beam
    c.fillStyle = "#475569";
    c.fillRect(150, TOP - 20, 500, 20);

    // pulleys along the beam
    const px0 = 320;
    for (let i = 0; i < this.pulleys; i++) {
      const px = px0 + i * 40;
      c.fillStyle = "#94a3b8";
      c.beginPath();
      c.arc(px, TOP + 10, 14, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#475569";
      c.lineWidth = 3;
      c.stroke();
    }

    // load position
    const loadY = 500 - this.lift * 330;
    const loadX = 470;
    c.fillStyle = "#a16207";
    c.fillRect(loadX - 35, loadY, 70, 70);
    c.strokeStyle = "#713f12";
    c.lineWidth = 3;
    c.strokeRect(loadX - 35, loadY, 70, 70);
    c.fillStyle = "#fde68a";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${this.round().weight}`, loadX, loadY + 44);

    // ropes (simplified): from load up to pulleys and down to hand
    c.strokeStyle = "#92400e";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(loadX, loadY);
    c.lineTo(loadX, TOP + 10);
    for (let i = 0; i < this.pulleys; i++) {
      const px = px0 + i * 40;
      c.lineTo(px, TOP + 10);
      c.lineTo(px, TOP + 10 + (i % 2 === 0 ? 30 : 10));
      c.lineTo(px + 40 <= px0 + (this.pulleys - 1) * 40 ? px + 40 : px, TOP + 10);
    }
    c.stroke();
    // hauler's pull rope down to a hand
    c.beginPath();
    c.moveTo(px0, TOP + 10);
    c.lineTo(240, 420);
    c.stroke();
    c.font = "40px serif";
    c.fillText("🧑‍🔧", 230, 470);

    // force gauge
    const need = this.forceNeeded();
    c.fillStyle = "rgba(255,255,255,0.8)";
    this.roundRect(c, 40, 50, 220, 22, 11);
    c.fill();
    c.fillStyle = need <= MAX_PULL ? "#22c55e" : "#ef4444";
    this.roundRect(c, 40, 50, 220 * Math.min(1, need / (MAX_PULL * 1.5)), 22, 11);
    c.fill();
    c.strokeStyle = "#1e293b";
    c.lineWidth = 2;
    const markX = 40 + 220 * (MAX_PULL / (MAX_PULL * 1.5));
    c.beginPath();
    c.moveTo(markX, 46);
    c.lineTo(markX, 76);
    c.stroke();
    c.fillStyle = "#1e293b";
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("force to pull", 40, 44);
    c.fillText("💪 your max", markX + 4, 90);

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Add pulleys, then haul the load to the top 📦", W / 2, 30);
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
    this.pulleys = 1;
    this.roundIdx = 0;
    this.lift = 0;
    this.hauling = false;
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

export const pulleyGame: GameModule = {
  meta: {
    id: "pulley",
    conceptId: "phys-10",
    title: "Heave Ho",
    stream: "physics",
    gradeBand: "3-5",
    emoji: "🛞",
    blurb: "Add pulleys to lift heavy loads with less force — a classic simple machine.",
    mission: "Lift every load by using enough pulleys to make the pull light enough.",
    estMinutes: 3,
  },
  create: (ctx) => new Pulley(ctx),
};
