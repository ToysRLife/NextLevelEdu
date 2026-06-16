import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Plate tectonics (MS-ESS2-3): the type of plate boundary decides the landform —
// plates pushing together (convergent) build mountains and trenches, pulling
// apart (divergent) open ridges and valleys. Pick the boundary that makes the
// target landform, then set how fast the plates move to reach the target size.

const W = 800;
const H = 600;
const RATE = 500; // metres of landform per unit of plate speed

type Boundary = "convergent" | "divergent" | "transform";
const BOUNDARIES: { key: Boundary; label: string }[] = [
  { key: "convergent", label: "➡️⬅️ Convergent" },
  { key: "divergent", label: "⬅️➡️ Divergent" },
  { key: "transform", label: "↕️ Transform" },
];

interface Round {
  landform: string;
  type: Boundary;
  target: number; // metres
}
const ROUNDS: Round[] = [
  { landform: "⛰️ Mountain range", type: "convergent", target: 4000 },
  { landform: "🌊 Ocean ridge", type: "divergent", target: 2500 },
  { landform: "🕳️ Deep-sea trench", type: "convergent", target: 4500 },
];

class Tectonic implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private boundary: Boundary = "convergent";
  private speed = 5;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private running = false;
  private prog = 0;
  private acc = 0;

  private speedCtl!: SliderHandle;
  private sizeRead!: { el: HTMLElement; set(v: string): void };
  private chips!: HTMLElement;
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 700, 400, 250);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Plate boundaries come in three kinds: convergent (push together), divergent (pull apart), and transform (slide past).",
      "Convergent boundaries crumple the crust into mountains or push it down into deep trenches. Divergent boundaries open ridges and valleys.",
      "Pick the boundary that makes this landform, then set the plate speed — faster plates build bigger features.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private size(): number {
    return this.speed * RATE;
  }

  private buildPanel(): void {
    this.chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...BOUNDARIES.map((b) =>
        el(
          "button",
          {
            class: `chip${b.key === this.boundary ? " active" : ""}`,
            "data-b": b.key,
            onclick: () => {
              if (this.running) return;
              this.boundary = b.key;
              this.chips
                .querySelectorAll("button")
                .forEach((x) => x.classList.toggle("active", x.getAttribute("data-b") === b.key));
              this.updateReadout();
              this.render();
            },
          },
          b.label
        )
      )
    );
    this.speedCtl = slider({
      label: "🛤️ Plate speed",
      min: 1,
      max: 10,
      value: this.speed,
      step: 0.5,
      unit: "cm/yr",
      color: "var(--accent-orange)",
      onInput: (v) => {
        this.speed = v;
        this.updateReadout();
        this.render();
      },
    });
    this.sizeRead = readout("📏 Feature size (speed × 500)");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.hits} / ${ROUNDS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Choose the boundary that builds this landform, then set the speed.";
    this.goBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-orange)" }, onclick: () => this.run() },
      "🌍 Move the plates"
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Build"),
        el("span", {}, `${this.round().landform} (${this.round().target} m)`)
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Boundary type"),
      this.chips,
      this.speedCtl.el,
      this.sizeRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Landforms built"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    this.sizeRead.set(`${this.size()} m`);
  }

  private run(): void {
    if (this.ended || this.running) return;
    this.running = true;
    this.prog = 0;
    this.acc = 0;
    this.speedCtl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.running) {
      this.acc += dtMs;
      let steps = 0;
      while (this.running && this.acc >= 16.67 && steps < 30) {
        this.prog = Math.min(1, this.prog + 0.02);
        if (this.prog >= 1) {
          this.running = false;
          this.evaluate();
        }
        this.acc -= 16.67;
        steps++;
      }
    }
    this.render();
  }

  private evaluate(): void {
    this.speedCtl.setEnabled(true);
    this.goBtn.disabled = false;
    const r = this.round();
    const rightType = this.boundary === r.type;
    const rightSize = Math.abs(this.size() - r.target) <= this.tol;
    if (rightType && rightSize) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.coachEl.textContent = "🌍 Built it! Next landform needs a different boundary.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = !rightType
        ? `That boundary doesn't make a ${r.landform.split(" ").slice(1).join(" ")}. Try a different type.`
        : this.size() < r.target
          ? "Right boundary — but too small. Speed the plates up."
          : "Right boundary — but too big. Slow the plates down.";
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("tectonic_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Plate master! Convergent boundaries push crust up into mountains or down into trenches; divergent boundaries pull it apart into ridges and valleys. Faster plates build bigger features.",
      stars,
      resources: { Rock: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fef3c7";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Continents shaped! 🌍", W / 2, H / 2);
      return;
    }

    const midY = 380;
    const gap = this.boundary === "divergent" ? this.prog * 90 : 0;
    const push = this.boundary === "convergent" ? this.prog * 60 : 0;
    const shift = this.boundary === "transform" ? this.prog * 40 : 0;
    // two plates
    c.fillStyle = "#b45309";
    c.fillRect(0, midY, W / 2 - gap + push, 140);
    c.fillRect(W / 2 + gap - push, midY - shift, W / 2, 140);

    // landform built (height scaled to size, capped)
    const h = Math.min(160, (this.size() / 4500) * 160) * this.prog;
    if (this.boundary === "convergent") {
      c.fillStyle = "#92400e";
      c.beginPath();
      c.moveTo(W / 2 - 90, midY);
      c.lineTo(W / 2, midY - h);
      c.lineTo(W / 2 + 90, midY);
      c.closePath();
      c.fill();
    } else if (this.boundary === "divergent") {
      c.fillStyle = "#dc2626";
      c.fillRect(W / 2 - gap, midY, gap * 2, 30 + h * 0.3);
    }

    c.fillStyle = "#7c2d12";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Shape the crust at a plate boundary 🌍", W / 2, 44);
    c.font = "14px Nunito, sans-serif";
    c.fillText(`${this.boundary} · ${this.size()} m`, W / 2, 70);
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
    this.running = false;
    this.boundary = "convergent";
    this.speed = 5;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.prog = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const tectonicGame: GameModule = {
  meta: {
    id: "tectonic",
    conceptId: "ess-28",
    title: "Tectonic Sandbox",
    stream: "earth-space",
    gradeBand: "6-8",
    emoji: "🌋",
    blurb: "Pick the right plate boundary and speed to build mountains, ridges, and trenches.",
    mission: "Match the boundary to each landform and set the plate speed to its target size.",
    estMinutes: 4,
  },
  create: (ctx) => new Tectonic(ctx),
};
