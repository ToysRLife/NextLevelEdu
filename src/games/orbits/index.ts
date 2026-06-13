import type { GameModule, GameContext, GameInstance, DifficultyTier } from "@sdk/types";
import { SimLoop } from "@core/loop";
import { ParticleSystem } from "@core/particles";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

const PLANET = { x: W / 2, y: H / 2, r: 42 };
const START_ALT = 160; // launch altitude above the planet centre
const GM = 920; // tuned so circular-orbit speed at START_ALT ≈ 2.4
const ESCAPE_DIST = 380; // past this the craft has flown off into deep space

// Stricter circularity required for 3 stars as the tier climbs — older learners
// are nudged toward a precise circular orbit, younger ones rewarded for staying up.
const TIER_3STAR_ECC: Record<DifficultyTier, number> = { junior: 0.12, explorer: 0.07, master: 0.04 };

interface Vec {
  x: number;
  y: number;
}

class Orbits implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly loop: SimLoop;
  private readonly particles = new ParticleSystem();
  private readonly ecc3Star: number;

  private phase: "setup" | "flying" | "ended" = "setup";
  private speed = 2.0; // logical units per 60fps-frame
  private sat: Vec & { vx: number; vy: number } = { x: 0, y: 0, vx: 0, vy: 0 };
  private path: Vec[] = [];
  private minDist = Infinity;
  private maxDist = 0;
  private sweptAngle = 0;
  private prevAngle = 0;

  private speedEl!: HTMLElement;
  private distEl!: HTMLElement;
  private coachEl!: HTMLElement;
  private launchBtn!: HTMLButtonElement;
  private slider!: HTMLInputElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.ecc3Star = TIER_3STAR_ECC[ctx.tier];
    this.loop = new SimLoop((dt) => this.tick(dt));
    this.buildPanel();
    this.resetCraft();
    ctx.services.hints.setHints([
      "An orbit is a balance: gravity pulls the craft in, its speed flings it outward. Match them.",
      "Too slow and you spiral down and crash. Too fast and you escape into deep space.",
      "A launch speed near the middle of the dial gives the roundest, most stable orbit.",
    ]);
    this.render();
  }

  private buildPanel(): void {
    this.slider = el("input", {
      type: "range",
      min: "120",
      max: "340",
      value: String(Math.round(this.speed * 100)),
      "aria-label": "Launch speed",
      style: { accentColor: "var(--accent-blue)" },
      oninput: (e: Event) => {
        if (this.phase !== "setup") return;
        this.speed = Number((e.target as HTMLInputElement).value) / 100;
        this.resetCraft();
        this.render();
      },
    }) as HTMLInputElement;

    this.launchBtn = el(
      "button",
      { class: "btn", onclick: () => this.launch() },
      "🚀 Launch",
    ) as HTMLButtonElement;

    this.speedEl = el("span", { style: { color: "var(--accent-blue)" } }, "2.00 km/s");
    this.distEl = el("span", { style: { color: "var(--accent-orange)" } }, `${START_ALT} km`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el("div", { class: "control-label" }, "Launch Speed"),
      this.slider,
      el("div", { class: "metric" }, el("span", {}, "🚀 Speed"), this.speedEl),
      el("div", { class: "metric" }, el("span", {}, "📏 Altitude"), this.distEl),
      this.launchBtn,
      this.coachEl,
    );
    this.updateReadout();
  }

  private resetCraft(): void {
    this.sat = { x: PLANET.x, y: PLANET.y - START_ALT, vx: this.speed, vy: 0 };
    this.path = [];
    this.minDist = Infinity;
    this.maxDist = 0;
    this.sweptAngle = 0;
    this.prevAngle = Math.atan2(this.sat.y - PLANET.y, this.sat.x - PLANET.x);
  }

  private updateReadout(): void {
    const dist = Math.hypot(this.sat.x - PLANET.x, this.sat.y - PLANET.y);
    const v = Math.hypot(this.sat.vx, this.sat.vy);
    this.speedEl.textContent = `${v.toFixed(2)} km/s`;
    this.distEl.textContent = `${Math.round(dist)} km`;
    this.coachEl.textContent = this.coachText();
  }

  // Always-on game coach — directional feedback only, never the exact answer.
  // (Precise numbers come through the tiered hint system on demand.)
  private coachText(): string {
    if (this.phase === "flying") return "🛰️ In flight — let it ride and watch the path it traces.";
    const circ = Math.sqrt(GM / START_ALT);
    if (this.speed < circ * 0.8) return "🪨 That looks slow — gravity may drag you down into the planet.";
    if (this.speed > circ * 1.25) return "💫 That looks fast — you might fling off into deep space.";
    return "✅ That's in the orbital zone. Launch and see how round your path is!";
  }

  private launch(): void {
    if (this.phase !== "setup") return;
    this.phase = "flying";
    this.launchBtn.setAttribute("disabled", "true");
    this.ctx.services.audio.play("click");
    this.ctx.services.score.event("orbit_launch", { speed: this.speed });
    this.loop.start();
  }

  private tick(dtMs: number): void {
    if (this.phase !== "flying") return;
    const f = dtMs / 16.67;

    const dx = PLANET.x - this.sat.x;
    const dy = PLANET.y - this.sat.y;
    const dist = Math.hypot(dx, dy);

    const accel = GM / (dist * dist * dist);
    this.sat.vx += accel * dx * f;
    this.sat.vy += accel * dy * f;
    this.sat.x += this.sat.vx * f;
    this.sat.y += this.sat.vy * f;

    this.path.push({ x: this.sat.x, y: this.sat.y });
    if (this.path.length > 1400) this.path.shift();

    this.minDist = Math.min(this.minDist, dist);
    this.maxDist = Math.max(this.maxDist, dist);

    const angle = Math.atan2(this.sat.y - PLANET.y, this.sat.x - PLANET.x);
    let delta = angle - this.prevAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    this.sweptAngle += Math.abs(delta);
    this.prevAngle = angle;

    if (Math.random() < 0.6) {
      const back = Math.atan2(this.sat.vy, this.sat.vx) + Math.PI;
      this.particles.spawn({
        kind: "thrust",
        x: this.sat.x,
        y: this.sat.y,
        vx: Math.cos(back) * 1.5 + (Math.random() - 0.5),
        vy: Math.sin(back) * 1.5 + (Math.random() - 0.5),
        size: 4,
      });
    }
    this.particles.update(0.04);

    this.updateReadout();
    this.render();

    if (dist < PLANET.r) this.crash();
    else if (dist > ESCAPE_DIST) this.escape();
    else if (this.sweptAngle >= 2 * Math.PI) this.complete();
  }

  private complete(): void {
    this.phase = "ended";
    this.loop.stop();
    const ecc = (this.maxDist - this.minDist) / (this.maxDist + this.minDist);
    const hintsUsed = this.ctx.services.hints.count();
    let stars = ecc <= this.ecc3Star ? 3 : ecc <= this.ecc3Star * 2.2 ? 2 : 1;
    if (hintsUsed >= 2) stars = Math.min(stars, 2);
    const minerals = 30 + Math.round((1 - Math.min(ecc, 1)) * 40);

    this.ctx.services.score.event("orbit_complete", { eccentricity: Number(ecc.toFixed(3)), stars });
    const shape = ecc <= 0.08 ? "a beautifully round" : "a stable elliptical";
    this.ctx.services.outcome.succeed({
      message: `Orbit achieved! You traced ${shape} path around the planet.`,
      stars,
      resources: { Minerals: minerals },
    });
  }

  private crash(): void {
    this.phase = "ended";
    this.loop.stop();
    this.spawnBurst("#f87171");
    this.render();
    this.ctx.services.outcome.fail({
      message: "Crashed into the planet — too slow to stay up. Try a faster launch so your speed balances gravity.",
    });
  }

  private escape(): void {
    this.phase = "ended";
    this.loop.stop();
    this.ctx.services.outcome.fail({
      message: "Flew off into deep space — too fast for the planet to hold on. Ease the launch speed down a touch.",
    });
  }

  private spawnBurst(_color: string): void {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.particles.spawn({
        kind: "thrust",
        x: this.sat.x,
        y: this.sat.y,
        vx: Math.cos(a) * 3,
        vy: Math.sin(a) * 3,
        size: 5,
      });
    }
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#020617";
    c.fillRect(0, 0, W, H);

    // starfield (deterministic-ish twinkle)
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 60; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 89.3) % H;
      c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(i));
      c.fillRect(x, y, 2, 2);
    }
    c.globalAlpha = 1;

    // ideal-orbit guide ring during setup
    if (this.phase === "setup") {
      c.strokeStyle = "rgba(96,165,250,0.35)";
      c.setLineDash([6, 8]);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(PLANET.x, PLANET.y, START_ALT, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }

    // trail
    if (this.path.length > 1) {
      c.strokeStyle = "#fbbf24";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(this.path[0].x, this.path[0].y);
      for (const p of this.path) c.lineTo(p.x, p.y);
      c.stroke();
    }

    // particles
    for (const p of this.particles.particles) {
      c.globalAlpha = p.life;
      c.fillStyle = "#fde68a";
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // planet
    const grad = c.createRadialGradient(PLANET.x - 12, PLANET.y - 12, 6, PLANET.x, PLANET.y, PLANET.r);
    grad.addColorStop(0, "#60a5fa");
    grad.addColorStop(1, "#1e3a8a");
    c.fillStyle = grad;
    c.beginPath();
    c.arc(PLANET.x, PLANET.y, PLANET.r, 0, Math.PI * 2);
    c.fill();

    // satellite + velocity arrow (setup only)
    if (this.phase !== "ended") {
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(this.sat.x, this.sat.y, 7, 0, Math.PI * 2);
      c.fill();
      if (this.phase === "setup") {
        c.strokeStyle = "#22c55e";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(this.sat.x, this.sat.y);
        c.lineTo(this.sat.x + this.sat.vx * 18, this.sat.y + this.sat.vy * 18);
        c.stroke();
      }
    }
  }

  start(): void {
    if (this.phase === "flying") this.loop.start();
  }
  pause(): void {
    this.loop.stop();
  }
  resume(): void {
    if (this.phase === "flying") this.loop.start();
  }
  reset(): void {
    this.loop.stop();
    this.phase = "setup";
    this.particles.clear();
    this.launchBtn.removeAttribute("disabled");
    this.ctx.services.hints.reset();
    this.resetCraft();
    this.updateReadout();
    this.render();
  }
  destroy(): void {
    this.loop.stop();
    this.particles.clear();
  }
}

export const orbitsGame: GameModule = {
  meta: {
    id: "orbits",
    conceptId: "ess-08",
    title: "Orbit Master",
    stream: "earth-space",
    gradeBand: "5",
    emoji: "🛰️",
    blurb: "Launch a craft at just the right speed to balance gravity and circle the planet.",
    mission: "Find the launch speed that balances gravity — not too slow, not too fast — to lock a stable orbit.",
    estMinutes: 4,
  },
  create: (ctx) => new Orbits(ctx),
};
