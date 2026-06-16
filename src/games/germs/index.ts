import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;
const CX = W / 2;
const CY = 320;

interface Germ {
  x: number;
  y: number;
  removed: boolean;
  wob: number;
}

class Germs implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private germs: Germ[] = [];
  private removed = 0;
  private brush: Point | null = null;
  private dragging = false;
  private bubbles: { x: number; y: number; life: number }[] = [];
  private frames = 0;

  private statusEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.spawn();
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        this.dragging = true;
        this.brush = p;
        this.scrub(p);
      },
      move: (p) => {
        this.brush = p;
        if (this.dragging) this.scrub(p);
      },
      up: () => {
        this.dragging = false;
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "Microorganisms (microbes) are tiny living things, far too small to see without a microscope.",
      "Some microbes are harmful germs that can make us ill — washing with soap scrubs them away.",
      "But many microbes are helpful! They make bread rise and turn milk into yogurt and cheese.",
    ]);
    this.renderLoop();
  }

  private spawn(): void {
    this.germs = [];
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 130;
      this.germs.push({
        x: CX + Math.cos(a) * r,
        y: CY + Math.sin(a) * r * 0.8,
        removed: false,
        wob: Math.random() * 6,
      });
    }
  }

  private buildPanel(): void {
    this.statusEl = el("span", { style: { color: "var(--accent-blue)" } }, `0 / 15`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-blue)", background: "#eff6ff" },
    });
    this.coachEl.textContent = "Scrub the hands with soap to wash away all the germs!";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Wash away the germs")
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "Drag the sponge over the hands"
      ),
      el("div", { class: "metric" }, el("span", {}, "🧼 Germs gone"), this.statusEl),
      this.coachEl
    );
  }

  private scrub(p: Point): void {
    if (this.ended) return;
    for (const g of this.germs) {
      if (g.removed) continue;
      if (Math.hypot(p.x - g.x, p.y - g.y) < 46) {
        g.removed = true;
        this.removed += 1;
        for (let i = 0; i < 4; i++)
          this.bubbles.push({ x: g.x + (Math.random() - 0.5) * 20, y: g.y, life: 1 });
        this.ctx.services.audio.play("tick");
        this.statusEl.textContent = `${this.removed} / 15`;
        if (this.removed >= 15) this.win();
      }
    }
  }

  private win(): void {
    this.ended = true;
    const secs = this.frames / 60;
    const stars = secs < 12 ? 3 : secs < 22 ? 2 : 1;
    this.ctx.services.score.event("germs_done", { seconds: Math.round(secs) });
    this.ctx.services.outcome.succeed({
      message:
        "Squeaky clean! Microbes are tiny living things — soap washes away the harmful germs. But remember, many microbes are helpful, making bread and yogurt!",
      stars,
      resources: { Water: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.08;
      if (!this.ended) this.frames++;
      for (const b of this.bubbles) {
        b.y -= 1.5;
        b.life -= 0.04;
      }
      this.bubbles = this.bubbles.filter((b) => b.life > 0);
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#eff6ff";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#1e3a8a";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Squeaky clean! 🧼", W / 2, H / 2);
      return;
    }

    // hands
    c.font = "200px serif";
    c.textAlign = "center";
    c.fillText("🤲", CX, CY + 70);

    // germs
    for (const g of this.germs) {
      if (g.removed) continue;
      const wob = Math.sin(this.anim + g.wob) * 2;
      c.fillStyle = "#22c55e";
      c.beginPath();
      c.arc(g.x + wob, g.y, 12, 0, Math.PI * 2);
      c.fill();
      // spikes
      c.strokeStyle = "#16a34a";
      c.lineWidth = 2;
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(g.x + wob + Math.cos(a) * 12, g.y + Math.sin(a) * 12);
        c.lineTo(g.x + wob + Math.cos(a) * 17, g.y + Math.sin(a) * 17);
        c.stroke();
      }
      // eyes
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(g.x + wob - 3, g.y - 2, 3, 0, Math.PI * 2);
      c.arc(g.x + wob + 3, g.y - 2, 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1e293b";
      c.beginPath();
      c.arc(g.x + wob - 3, g.y - 2, 1.4, 0, Math.PI * 2);
      c.arc(g.x + wob + 3, g.y - 2, 1.4, 0, Math.PI * 2);
      c.fill();
    }

    // bubbles
    for (const b of this.bubbles) {
      c.fillStyle = `rgba(255,255,255,${b.life})`;
      c.beginPath();
      c.arc(b.x, b.y, 5, 0, Math.PI * 2);
      c.fill();
    }

    // sponge cursor
    if (this.brush) {
      c.fillStyle = "rgba(250,204,21,0.85)";
      this.roundRect(c, this.brush.x - 24, this.brush.y - 18, 48, 36, 8);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 4; i++) c.fillRect(this.brush.x - 16 + i * 10, this.brush.y - 8, 4, 4);
    }

    c.fillStyle = "#1e3a8a";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Scrub away the germs with soap 🧼", W / 2, 50);
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  start(): void {}
  pause(): void {}
  resume(): void {}
  reset(): void {
    this.ended = false;
    this.removed = 0;
    this.brush = null;
    this.dragging = false;
    this.bubbles = [];
    this.frames = 0;
    this.spawn();
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const germsGame: GameModule = {
  meta: {
    id: "germs",
    conceptId: "bio-24",
    title: "Germ Busters",
    stream: "biology",
    gradeBand: "4-5",
    emoji: "🦠",
    blurb: "Scrub away the germs with soap — and learn that some microbes are actually helpful.",
    mission: "Wash every germ off the hands.",
    estMinutes: 2,
  },
  create: (ctx) => new Germs(ctx),
};
