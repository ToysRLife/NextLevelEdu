import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";

const W = 800;
const H = 600;

interface Mirror {
  x: number;
  y: number;
  len: number;
  angle: number; // radians, orientation of the mirror surface
}

interface Vec {
  x: number;
  y: number;
}

class Mirrors implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;
  private holdFrames = 0; // beam must rest on target briefly

  private source: Vec = { x: 70, y: 360 };
  private emitDeg = -10; // emission angle in degrees (0 = pointing right)
  private mirrors: Mirror[] = [
    { x: 340, y: 360, len: 130, angle: Math.PI / 4 },
    { x: 560, y: 230, len: 130, angle: -Math.PI / 4 },
  ];
  private target = { x: 690, y: 110, r: 28 };

  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Light travels in straight lines until it hits a mirror, which bounces it off in a new direction.",
      "Reflection follows a rule: the angle the light comes IN equals the angle it goes OUT.",
      "Aim the source and rotate each mirror so the beam bounces its way over to the target ☀️.",
    ]);
    this.renderLoop();
  }

  private buildPanel(): void {
    const angleSlider = el("input", {
      type: "range",
      min: "-80",
      max: "80",
      value: String(this.emitDeg),
      "aria-label": "Source angle",
      style: { accentColor: "var(--accent-yellow)" },
      oninput: (e: Event) => {
        this.emitDeg = Number((e.target as HTMLInputElement).value);
      },
    });

    const rot1 = el(
      "button",
      { class: "btn secondary", onclick: () => this.rotate(0) },
      "🔄 Rotate Mirror 1"
    );
    const rot2 = el(
      "button",
      { class: "btn secondary", onclick: () => this.rotate(1) },
      "🔄 Rotate Mirror 2"
    );

    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-yellow)", background: "#fefce8" },
    });
    this.coachEl.textContent = "Steer the beam off the mirrors and onto the target.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Light up the target")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "🔦 Aim the light"),
      angleSlider,
      el("div", { class: "control-label" }, "Rotate the mirrors"),
      rot1,
      rot2,
      this.coachEl
    );
  }

  private rotate(i: number): void {
    if (this.ended) return;
    this.mirrors[i].angle += Math.PI / 12; // 15° per tap
    this.ctx.services.audio.play("click");
  }

  // Trace the beam, returning the polyline points and whether it reached target.
  private trace(): { points: Vec[]; hit: boolean } {
    const points: Vec[] = [{ ...this.source }];
    let p: Vec = { ...this.source };
    const rad = (this.emitDeg * Math.PI) / 180;
    let d: Vec = { x: Math.cos(rad), y: Math.sin(rad) };
    let hit = false;

    for (let bounce = 0; bounce < 8; bounce++) {
      // find nearest mirror intersection
      let best: { t: number; point: Vec; normal: Vec } | null = null;
      for (const m of this.mirrors) {
        const half = m.len / 2;
        const ax = m.x - Math.cos(m.angle) * half;
        const ay = m.y - Math.sin(m.angle) * half;
        const bx = m.x + Math.cos(m.angle) * half;
        const by = m.y + Math.sin(m.angle) * half;
        const hitInfo = this.raySegment(p, d, { x: ax, y: ay }, { x: bx, y: by });
        if (hitInfo && (!best || hitInfo.t < best.t)) {
          const n: Vec = { x: -Math.sin(m.angle), y: Math.cos(m.angle) };
          best = { t: hitInfo.t, point: hitInfo.point, normal: n };
        }
      }

      // distance to target along this ray, before any mirror hit
      const segEnd = best ? best.point : { x: p.x + d.x * 2000, y: p.y + d.y * 2000 };
      if (this.segmentHitsCircle(p, segEnd, this.target)) {
        // clip the drawn segment roughly at the target center
        points.push({ x: this.target.x, y: this.target.y });
        hit = true;
        break;
      }

      if (!best) {
        points.push(segEnd);
        break;
      }

      // reflect off the mirror
      points.push(best.point);
      const dot = d.x * best.normal.x + d.y * best.normal.y;
      d = { x: d.x - 2 * dot * best.normal.x, y: d.y - 2 * dot * best.normal.y };
      // nudge off the surface to avoid re-hitting
      p = { x: best.point.x + d.x * 0.5, y: best.point.y + d.y * 0.5 };
    }

    return { points, hit };
  }

  private raySegment(p: Vec, d: Vec, a: Vec, b: Vec): { t: number; point: Vec } | null {
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denom = d.x * sy - d.y * sx;
    if (Math.abs(denom) < 1e-6) return null;
    const diffx = a.x - p.x;
    const diffy = a.y - p.y;
    const t = (diffx * sy - diffy * sx) / denom;
    const u = (diffx * d.y - diffy * d.x) / denom;
    if (t > 0.5 && u >= 0 && u <= 1) {
      return { t, point: { x: p.x + d.x * t, y: p.y + d.y * t } };
    }
    return null;
  }

  private segmentHitsCircle(a: Vec, b: Vec, circ: { x: number; y: number; r: number }): boolean {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-6) return Math.hypot(a.x - circ.x, a.y - circ.y) <= circ.r;
    let t = ((circ.x - a.x) * abx + (circ.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    return Math.hypot(cx - circ.x, cy - circ.y) <= circ.r;
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.1;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, W, H);

    const { points, hit } = this.trace();

    if (hit && !this.ended) {
      this.holdFrames += 1;
      if (this.holdFrames > byTier(this.ctx.tier, 10, 18, 28)) this.win();
    } else if (!hit) {
      this.holdFrames = 0;
    }

    // mirrors
    for (let i = 0; i < this.mirrors.length; i++) {
      const m = this.mirrors[i];
      const half = m.len / 2;
      const ax = m.x - Math.cos(m.angle) * half;
      const ay = m.y - Math.sin(m.angle) * half;
      const bx = m.x + Math.cos(m.angle) * half;
      const by = m.y + Math.sin(m.angle) * half;
      c.strokeStyle = "#67e8f9";
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
      // back of the mirror
      c.strokeStyle = "#334155";
      c.lineWidth = 3;
      const nx = -Math.sin(m.angle) * 5;
      const ny = Math.cos(m.angle) * 5;
      c.beginPath();
      c.moveTo(ax - nx, ay - ny);
      c.lineTo(bx - nx, by - ny);
      c.stroke();
      c.fillStyle = "#94a3b8";
      c.font = "bold 14px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText(String(i + 1), m.x, m.y - 12);
    }

    // target
    c.fillStyle = hit ? "#fde047" : "#475569";
    c.beginPath();
    c.arc(this.target.x, this.target.y, this.target.r, 0, Math.PI * 2);
    c.fill();
    if (hit) {
      c.fillStyle = "rgba(253,224,71,0.3)";
      c.beginPath();
      c.arc(
        this.target.x,
        this.target.y,
        this.target.r + 10 + Math.sin(this.anim) * 4,
        0,
        Math.PI * 2
      );
      c.fill();
    }
    c.font = "26px serif";
    c.textAlign = "center";
    c.fillText(hit ? "🌞" : "🎯", this.target.x, this.target.y + 9);

    // beam
    c.strokeStyle = "#fde047";
    c.lineWidth = 4;
    c.shadowColor = "#fde047";
    c.shadowBlur = 12;
    c.setLineDash([14, 8]);
    c.lineDashOffset = -this.anim * 6;
    c.beginPath();
    points.forEach((pt, i) => (i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y)));
    c.stroke();
    c.setLineDash([]);
    c.shadowBlur = 0;

    // source
    c.fillStyle = "#facc15";
    c.beginPath();
    c.arc(this.source.x, this.source.y, 16, 0, Math.PI * 2);
    c.fill();
    c.font = "20px serif";
    c.fillText("🔦", this.source.x, this.source.y + 7);

    // instruction
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Bounce the light to the target ☀️", W / 2, 36);
  }

  private win(): void {
    this.ended = true;
    this.ctx.services.audio.play("tick");
    const hintsUsed = this.ctx.services.hints.count();
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
    this.ctx.services.score.event("mirrors_done", {});
    this.ctx.services.outcome.succeed({
      message:
        "Target lit! Light travels in straight lines and bounces off mirrors so that the angle in equals the angle out — that's the law of reflection.",
      stars,
      resources: { Power: 40 },
    });
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.holdFrames = 0;
    this.emitDeg = -10;
    this.mirrors = [
      { x: 340, y: 360, len: 130, angle: Math.PI / 4 },
      { x: 560, y: 230, len: 130, angle: -Math.PI / 4 },
    ];
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const mirrorsGame: GameModule = {
  meta: {
    id: "mirrors",
    conceptId: "phys-14",
    title: "Bounce the Beam",
    stream: "physics",
    gradeBand: "4-6",
    emoji: "🪞",
    blurb: "Aim a beam and rotate mirrors to bounce light onto the target.",
    mission: "Use the law of reflection to steer the light beam onto the target.",
    estMinutes: 3,
  },
  create: (ctx) => new Mirrors(ctx),
};
