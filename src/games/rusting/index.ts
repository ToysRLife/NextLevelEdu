import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const SURVIVE = 30; // seconds to protect the bridge

class Rusting implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;

  private rust = 0; // 0..100
  private water = 0.2; // 0..1
  private salt = 0; // 0..1
  private coating = 0; // 0..1
  private timeLeft = SURVIVE;
  private anim = 0;
  private ended = false;
  private rainTimer = 0;
  private rainOn = false;
  private rainDrops: { x: number; y: number; v: number }[] = [];

  private rustEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private waterEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    ctx.services.hints.setHints([
      "Rust forms when iron is exposed to BOTH water and air. Salt makes it happen even faster.",
      "Stop rust by removing one of the things it needs: keep the iron dry, or coat it so water and air can't reach it.",
      "When rain wets the bridge, wipe it dry or seal it with a coating before the rust climbs too high.",
    ]);
    this.loop.start();
    this.render();
  }

  private buildPanel(): void {
    const coatBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.applyCoating() },
      "🛢️ Apply coating",
    );
    const dryBtn = el(
      "button",
      { class: "btn secondary", onclick: () => this.wipeDry() },
      "🧽 Wipe dry",
    );

    this.rustEl = el("span", {}, "0%");
    this.timeEl = el("span", { style: { color: "var(--accent-green)" } }, `${SURVIVE}s`);
    this.waterEl = el("span", {}, "");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Protect the iron bridge from rust until time runs out.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, `Survive ${SURVIVE}s rust-free`),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Keep water & air off the iron"),
      coatBtn,
      dryBtn,
      el("div", { class: "metric" }, el("span", {}, "🦠 Rust"), this.rustEl),
      el("div", { class: "metric" }, el("span", {}, "💧 Wetness"), this.waterEl),
      el("div", { class: "metric" }, el("span", {}, "⏱️ Time left"), this.timeEl),
      this.coachEl,
    );
  }

  private applyCoating(): void {
    if (this.ended) return;
    this.coating = 1;
    this.ctx.services.audio.play("click");
    this.coachEl.textContent = "🛢️ Coated! The seal blocks water and air — but it wears off, so reapply it.";
  }

  private wipeDry(): void {
    if (this.ended) return;
    this.water = 0;
    this.ctx.services.audio.play("click");
    this.coachEl.textContent = "🧽 Dried off! No water means no rust… until it gets wet again.";
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    const f = dtMs / 16.67;
    const dts = dtMs / 1000;
    this.anim += 0.05 * f;
    this.timeLeft = Math.max(0, this.timeLeft - dts);

    // weather: periodic rain (and the odd salty sea-spray)
    this.rainTimer -= dts;
    if (this.rainTimer <= 0) {
      this.rainOn = !this.rainOn;
      this.rainTimer = this.rainOn ? 3 + Math.random() * 3 : 2 + Math.random() * 4;
      if (this.rainOn && Math.random() < 0.4) this.salt = Math.min(1, this.salt + 0.5);
    }
    if (this.rainOn) {
      this.water = Math.min(1, this.water + 0.01 * f);
      if (this.rainDrops.length < 60) this.rainDrops.push({ x: Math.random() * W, y: 0, v: 6 + Math.random() * 4 });
    } else {
      this.water = Math.max(0, this.water - 0.002 * f); // slowly dries
    }
    this.coating = Math.max(0, this.coating - 0.0035 * f); // coating wears off
    this.salt = Math.max(0, this.salt - 0.0008 * f);

    for (const d of this.rainDrops) d.y += d.v * f;
    this.rainDrops = this.rainDrops.filter((d) => d.y < 470);

    // rust grows only with water + air, faster with salt, blocked by coating
    const exposed = 1 - this.coating;
    if (this.water > 0.1 && exposed > 0.05) {
      const rate = 6 * this.water * (1 + this.salt * 1.8) * exposed;
      this.rust = Math.min(100, this.rust + rate * dts);
    }

    this.rustEl.textContent = `${Math.round(this.rust)}%`;
    this.waterEl.textContent = this.water > 0.5 ? "💧💧 wet" : this.water > 0.1 ? "💧 damp" : "· dry";
    this.timeEl.textContent = `${Math.ceil(this.timeLeft)}s`;

    if (this.rust >= 100) {
      this.fail();
    } else if (this.timeLeft <= 0) {
      this.win();
    }
    this.render();
  }

  private win(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.rust < 20 ? 3 : this.rust < 50 ? 2 : 1;
    this.ctx.services.score.event("rusting_done", { rust: Math.round(this.rust) });
    this.ctx.services.outcome.succeed({
      message:
        "The bridge stands strong! Rust needs both water and air — keeping iron dry or sealing it with a coating stops the metal from corroding.",
      stars,
      resources: { Energy: 40 },
    });
  }

  private fail(): void {
    this.ended = true;
    this.loop.stop();
    this.ctx.services.score.event("rusting_failed", {});
    this.ctx.services.outcome.fail({
      message:
        "The bridge rusted through! Left wet and exposed to air, iron keeps corroding — especially with salt. Dry it or seal it sooner next time.",
      stars: 0,
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const dark = this.rainOn ? "#475569" : "#7dd3fc";
    c.fillStyle = dark;
    c.fillRect(0, 0, W, 470);
    c.fillStyle = "#3b82f6";
    c.fillRect(0, 470, W, H - 470); // water below

    // rain
    if (this.rainOn) {
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 2;
      for (const d of this.rainDrops) {
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - 3, d.y + 12);
        c.stroke();
      }
    }

    // bridge color shifts from steel to rusty orange with rust level
    const r = this.rust / 100;
    const steel = [148, 163, 184];
    const rustC = [180, 83, 9];
    const col = steel.map((s, i) => Math.round(s + (rustC[i] - s) * r));
    c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;

    // bridge deck + arch
    c.fillRect(80, 300, W - 160, 26);
    c.lineWidth = 14;
    c.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    c.beginPath();
    c.arc(W / 2, 326, 280, Math.PI, Math.PI * 2);
    c.stroke();
    // suspension struts
    c.lineWidth = 4;
    for (let i = 1; i < 8; i++) {
      const x = 80 + ((W - 160) * i) / 8;
      const top = 326 - Math.sqrt(Math.max(0, 280 * 280 - (x - W / 2) * (x - W / 2)));
      c.beginPath();
      c.moveTo(x, 300);
      c.lineTo(x, top);
      c.stroke();
    }

    // rust flaking patches
    if (r > 0.15) {
      c.fillStyle = "#7c2d12";
      for (let i = 0; i < r * 30; i++) {
        const x = 90 + ((i * 89) % (W - 180));
        c.fillRect(x, 302 + ((i * 37) % 20), 5, 5);
      }
    }

    // wet sheen / coating sheen
    if (this.coating > 0.05) {
      c.strokeStyle = `rgba(96,165,250,${this.coating * 0.8})`;
      c.lineWidth = 3;
      c.strokeRect(80, 300, W - 160, 26);
      c.fillStyle = "#1e3a8a";
      c.font = "13px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("🛢️ sealed", W / 2, 360);
    } else if (this.water > 0.4) {
      c.fillStyle = "rgba(255,255,255,0.3)";
      c.fillRect(80, 300, W - 160, 8);
    }

    // status
    c.fillStyle = "#fff";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(this.rainOn ? "🌧️ Rain! Keep it dry or sealed" : "☀️ Dry spell — stay ready", W / 2, 60);

    // rust bar
    c.fillStyle = "rgba(255,255,255,0.7)";
    this.roundRect(c, W / 2 - 150, 90, 300, 20, 10);
    c.fill();
    c.fillStyle = r > 0.7 ? "#dc2626" : r > 0.4 ? "#f59e0b" : "#22c55e";
    this.roundRect(c, W / 2 - 150, 90, 300 * r, 20, 10);
    c.fill();
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
    this.rust = 0;
    this.water = 0.2;
    this.salt = 0;
    this.coating = 0;
    this.timeLeft = SURVIVE;
    this.rainOn = false;
    this.rainTimer = 0;
    this.rainDrops = [];
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const rustingGame: GameModule = {
  meta: {
    id: "rusting",
    conceptId: "chem-23",
    title: "Stop the Rust",
    stream: "chemistry",
    gradeBand: "4-5",
    emoji: "🔩",
    blurb: "Keep an iron bridge dry and sealed to stop rust before it eats through.",
    mission: "Protect the iron from water and air long enough to survive the storm.",
    estMinutes: 3,
  },
  create: (ctx) => new Rusting(ctx),
};
