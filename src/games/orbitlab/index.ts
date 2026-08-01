import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Gravity & orbits (MS-PS2-4): a satellite needs just the right sideways speed
// to circle a planet. Too slow and gravity pulls it down to crash; too fast and
// it flies off into space. The circular-orbit speed is v = √(GM ÷ r). Set the
// launch speed to match it at the given orbit radius.

const W = 800;
const H = 600;
const CX = W / 2;
const CY = 320;
const GM = 3200; // gravitational parameter (tuned for nice speeds)
const PLANET_R = 46;
const MAX_R = 300;

interface Round {
  r0: number; // orbit radius (px from planet centre)
}
const ROUNDS: Round[] = [{ r0: 200 }, { r0: 150 }, { r0: 250 }];

const orbitSpeed = (r: number) => Math.sqrt(GM / r);

class OrbitLab implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private speed = 4;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private outcome: "orbit" | "crash" | "escape" | null = null;
  private flying = false;
  private prog = 0;
  private theta = 0;
  private rr = 0;
  private acc = 0;

  private speedCtl!: SliderHandle;
  private needRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 0.6, 0.4, 0.25);
    this.buildPanel();
    ctx.services.hints.setHints([
      "An orbit is a balance: the satellite keeps falling toward the planet but moves sideways fast enough to keep missing it.",
      "Too slow → gravity wins and it spirals down. Too fast → it overcomes gravity and flies away.",
      "The circular-orbit speed is v = √(GM ÷ r). A smaller radius needs a faster speed.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private needed(): number {
    return orbitSpeed(this.round().r0);
  }

  private buildPanel(): void {
    this.speedCtl = slider({
      label: "🚀 Launch speed",
      min: 1,
      max: 8,
      value: this.speed,
      step: 0.1,
      unit: "km/s",
      color: "var(--accent-blue)",
      onInput: (v) => {
        this.speed = v;
        this.updateReadout();
      },
    });
    this.needRead = readout("🛰️ Orbit speed √(GM ÷ r)");
    this.statusEl = el(
      "span",
      { style: { color: "var(--accent-green)" } },
      `${this.hits} / ${ROUNDS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Match the orbit speed for this radius, then launch the satellite.";
    this.goBtn = el(
      "button",
      { class: "btn", style: { background: "var(--accent-blue)" }, onclick: () => this.launch() },
      "🛰️ Launch"
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Orbit radius"),
        el("span", {}, `${this.round().r0} (units)`)
      ),
      this.speedCtl.el,
      this.needRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Orbits achieved"), this.statusEl),
      this.coachEl
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const need = this.needed();
    const ok = Math.abs(this.speed - need) <= this.tol;
    this.needRead.set(
      `${need.toFixed(1)} km/s ${ok ? "✓" : this.speed < need ? "(go faster)" : "(go slower)"}`
    );
  }

  private launch(): void {
    if (this.ended || this.flying) return;
    const d = this.speed - this.needed();
    this.outcome = Math.abs(d) <= this.tol ? "orbit" : d < 0 ? "crash" : "escape";
    this.flying = true;
    this.prog = 0;
    this.theta = -Math.PI / 2;
    this.rr = this.round().r0;
    this.acc = 0;
    this.speedCtl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.flying) {
      this.acc += dtMs;
      let steps = 0;
      while (this.flying && this.acc >= 16.67 && steps < 30) {
        this.step();
        this.acc -= 16.67;
        steps++;
      }
    }
    this.render();
  }

  private step(): void {
    this.prog += 0.012;
    this.theta += (this.speed * 14) / this.rr; // angular speed ≈ v/r
    if (this.outcome === "crash")
      this.rr = this.round().r0 - (this.round().r0 - PLANET_R + 4) * this.prog;
    else if (this.outcome === "escape")
      this.rr = this.round().r0 + (MAX_R + 60 - this.round().r0) * this.prog;
    if (this.prog >= (this.outcome === "orbit" ? 1.4 : 1)) {
      this.flying = false;
      this.speedCtl.setEnabled(true);
      this.goBtn.disabled = false;
      this.evaluate();
    }
  }

  private evaluate(): void {
    if (this.outcome === "orbit") {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.coachEl.textContent =
          "🛰️ Stable orbit! Next radius is different — recompute √(GM ÷ r).";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        this.outcome === "crash"
          ? "💥 Too slow — gravity pulled it down. Increase the launch speed."
          : "🌌 Too fast — it escaped into space. Ease off the speed.";
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("orbitlab_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "In orbit! A satellite stays up by moving sideways fast enough to keep 'missing' the planet as it falls. That circular speed is v = √(GM ÷ r) — smaller orbits need to go faster.",
      stars,
      resources: { Power: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b1026");
    grad.addColorStop(1, "#1e1b4b");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#fff";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("All orbits achieved! 🛰️", W / 2, H / 2);
      return;
    }

    // stars
    c.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 50; i++) c.fillRect((i * 131) % W, (i * 71) % H, 2, 2);

    // target orbit ring
    c.strokeStyle = "rgba(96,165,250,0.5)";
    c.setLineDash([5, 6]);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(CX, CY, this.round().r0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    // planet
    c.fillStyle = "#3b82f6";
    c.beginPath();
    c.arc(CX, CY, PLANET_R, 0, Math.PI * 2);
    c.fill();
    c.font = "30px serif";
    c.textAlign = "center";
    c.fillText("🪐", CX, CY + 10);

    // satellite
    const r = this.flying ? this.rr : this.round().r0;
    const a = this.flying ? this.theta : -Math.PI / 2;
    const sx = CX + Math.cos(a) * r;
    const sy = CY + Math.sin(a) * r;
    c.font = "24px serif";
    c.fillText("🛰️", sx, sy + 8);

    c.fillStyle = "#dbeafe";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Give the satellite the right speed for a circular orbit 🛰️", W / 2, 40);
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
    this.flying = false;
    this.outcome = null;
    this.speed = 4;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const orbitLabGame: GameModule = {
  meta: {
    id: "orbitlab",
    conceptId: "phys-30",
    title: "Orbit Engineer",
    stream: "physics",
    gradeBand: "6-8",
    emoji: "🛰️",
    blurb: "Find the launch speed that keeps a satellite in a steady circular orbit.",
    mission: "Match v = √(GM ÷ r) at each orbit radius to keep the satellite circling.",
    estMinutes: 4,
  },
  create: (ctx) => new OrbitLab(ctx),
};
