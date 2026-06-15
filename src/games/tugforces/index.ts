import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";
import { slider, readout, type SliderHandle } from "@core/controls";
import { byTier } from "@core/difficulty";

// Net force (MS-PS2-1/2): when two teams pull, only the NET force moves the
// flag — net = your pull − their pull. Equal pulls cancel (balanced, no motion);
// a bigger pull on one side drags the flag that way. Set your team's pull so the
// net force lands the flag on the target marker.

const W = 800;
const H = 600;
const CX = W / 2;
const ROPE_Y = 320;
const SCALE = 3; // px the flag moves per newton of net force

interface Round {
  enemy: number; // their pull (N)
  targetNet: number; // net force needed to land on the marker
}
const ROUNDS: Round[] = [
  { enemy: 40, targetNet: 0 }, // balance it
  { enemy: 30, targetNet: 20 }, // pull it your way
  { enemy: 60, targetNet: 30 },
];

class TugForces implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly tol: number;

  private you = 40;
  private idx = 0;
  private hits = 0;
  private misses = 0;
  private ended = false;

  private pulling = false;
  private flagX = CX;
  private targetX = CX;
  private prog = 0;
  private acc = 0;

  private youCtl!: SliderHandle;
  private netRead!: { el: HTMLElement; set(v: string): void };
  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private goBtn!: HTMLButtonElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.tol = byTier(ctx.tier, 8, 5, 3);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Every pull has an equal, opposite pull on the other side. What moves the flag is the NET force — the difference between the two.",
      "Net force = your pull − their pull. Equal pulls cancel out: the flag stays put (balanced forces).",
      "Work out the net force you need, then set your pull = their pull + that net.",
    ]);
    this.loop.start();
    this.render();
  }

  private round(): Round {
    return ROUNDS[this.idx];
  }
  private net(): number {
    return this.you - this.round().enemy;
  }

  private buildPanel(): void {
    this.youCtl = slider({
      label: "💪 Your team's pull",
      min: 0,
      max: 100,
      value: this.you,
      step: 5,
      unit: "N",
      color: "var(--accent-green)",
      onInput: (v) => {
        this.you = v;
        this.updateReadout();
        this.render();
      },
    });
    this.netRead = readout("↔️ Net force (you − them)");
    this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
    this.coachEl = el("div", { class: "hint-panel", style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" } });
    this.coachEl.textContent = "Set your pull so the net force lands the flag on the marker.";
    this.goBtn = el("button", { class: "btn", style: { background: "var(--accent-green)" }, onclick: () => this.pull() }, "🪢 Pull!") as HTMLButtonElement;

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Target net"), el("span", {}, `${this.round().targetNet} N`)),
      el("div", { class: "metric" }, el("span", {}, "🟥 Their pull"), el("span", {}, `${this.round().enemy} N`)),
      this.youCtl.el,
      this.netRead.el,
      this.goBtn,
      el("div", { class: "metric" }, el("span", {}, "✅ Rounds won"), this.statusEl),
      this.coachEl,
    );
    this.updateReadout();
  }

  private updateReadout(): void {
    const n = this.net();
    const dir = n === 0 ? "balanced" : n > 0 ? "your way →" : "← their way";
    this.netRead.set(`${this.you} − ${this.round().enemy} = ${n} N (${dir})`);
  }

  private pull(): void {
    if (this.ended || this.pulling) return;
    this.pulling = true;
    this.prog = 0;
    this.flagX = CX;
    this.targetX = CX + this.net() * SCALE;
    this.acc = 0;
    this.youCtl.setEnabled(false);
    this.goBtn.disabled = true;
    this.ctx.services.audio.play("click");
  }

  private tick(dtMs: number): void {
    if (this.ended) return;
    if (this.pulling) {
      this.acc += dtMs;
      let steps = 0;
      while (this.pulling && this.acc >= 16.67 && steps < 30) {
        this.prog = Math.min(1, this.prog + 0.03);
        this.flagX = CX + (this.targetX - CX) * this.prog;
        if (this.prog >= 1) {
          this.pulling = false;
          this.youCtl.setEnabled(true);
          this.goBtn.disabled = false;
          this.evaluate();
        }
        this.acc -= 16.67;
        steps++;
      }
    }
    this.render();
  }

  private evaluate(): void {
    const r = this.round();
    if (Math.abs(this.net() - r.targetNet) <= this.tol) {
      this.hits += 1;
      this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
      this.ctx.services.audio.play("reward");
      if (this.hits >= ROUNDS.length) this.finish();
      else {
        this.idx += 1;
        this.flagX = CX;
        this.coachEl.textContent = "🪢 Spot on! Their pull changed for the next round — recompute the net.";
        this.buildPanel();
      }
    } else {
      this.misses += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent =
        this.net() < r.targetNet
          ? "Not far enough — pull harder so the net force grows."
          : "Too far — ease off your pull so the net force drops.";
    }
  }

  private finish(): void {
    this.ended = true;
    this.loop.stop();
    const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
    this.ctx.services.score.event("tugforces_done", { misses: this.misses });
    this.ctx.services.outcome.succeed({
      message:
        "Force champion! Only the NET force moves things — your pull minus theirs. Equal pulls balance out to no motion; a bigger pull on one side wins the tug.",
      stars,
      resources: { Alloy: 60 },
    });
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#f0fdf4";
    c.fillRect(0, 0, W, H);
    if (this.ended) {
      c.fillStyle = "#166534";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Net force mastered! 🪢", W / 2, H / 2);
      return;
    }

    // ground line
    c.fillStyle = "#bbf7d0";
    c.fillRect(0, ROPE_Y + 40, W, 8);

    // centre line + target marker
    c.strokeStyle = "#94a3b8";
    c.setLineDash([6, 6]);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(CX, ROPE_Y - 60);
    c.lineTo(CX, ROPE_Y + 60);
    c.stroke();
    c.setLineDash([]);
    const tx = CX + this.round().targetNet * SCALE;
    c.fillStyle = "rgba(34,197,94,0.3)";
    c.fillRect(tx - this.tol * SCALE, ROPE_Y - 50, this.tol * SCALE * 2, 100);
    c.strokeStyle = "#16a34a";
    c.lineWidth = 3;
    c.strokeRect(tx - this.tol * SCALE, ROPE_Y - 50, this.tol * SCALE * 2, 100);
    c.fillStyle = "#15803d";
    c.font = "13px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("🎯", tx, ROPE_Y - 56);

    // rope
    c.strokeStyle = "#a16207";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(80, ROPE_Y);
    c.lineTo(W - 80, ROPE_Y);
    c.stroke();

    // teams
    c.font = "30px serif";
    c.textAlign = "center";
    c.fillText("🟥🧑‍🤝‍🧑", 110, ROPE_Y - 4); // their team (left)
    c.fillText("🧑‍🤝‍🧑🟩", W - 110, ROPE_Y - 4); // your team (right)

    // flag
    c.fillStyle = "#ef4444";
    c.fillRect(this.flagX - 2, ROPE_Y - 40, 4, 40);
    c.beginPath();
    c.moveTo(this.flagX + 2, ROPE_Y - 40);
    c.lineTo(this.flagX + 30, ROPE_Y - 32);
    c.lineTo(this.flagX + 2, ROPE_Y - 24);
    c.closePath();
    c.fill();

    c.fillStyle = "#166534";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Set your pull so the net force lands the flag on the marker 🪢", W / 2, 44);
    c.font = "14px Nunito, sans-serif";
    c.fillText(`their pull ${this.round().enemy} N   ·   your pull ${this.you} N   ·   net ${this.net()} N`, W / 2, 70);
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
    this.pulling = false;
    this.you = 40;
    this.idx = 0;
    this.hits = 0;
    this.misses = 0;
    this.flagX = CX;
    this.ctx.services.hints.reset();
    this.buildPanel();
    this.loop.start();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
  }
}

export const tugForcesGame: GameModule = {
  meta: {
    id: "tugforces",
    conceptId: "phys-31",
    title: "Tug of Forces",
    stream: "physics",
    gradeBand: "6-8",
    emoji: "🪢",
    blurb: "Balance action and reaction — set your pull so the net force lands the flag on target.",
    mission: "Use net force (your pull − their pull) to place the flag on each marker.",
    estMinutes: 3,
  },
  create: (ctx) => new TugForces(ctx),
};
