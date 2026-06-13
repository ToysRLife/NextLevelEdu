import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { onPointer, type Point } from "@core/input";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;
const START = { x: W / 2, y: 530 };

interface Zone {
  key: string;
  name: string;
  emoji: string;
  bg: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ZONES: Zone[] = [
  { key: "ocean", name: "Ocean", emoji: "🌊", bg: "#0ea5e9", x: 40, y: 90, w: 350, h: 160 },
  { key: "desert", name: "Desert", emoji: "🏜️", bg: "#f59e0b", x: 410, y: 90, w: 350, h: 160 },
  { key: "arctic", name: "Arctic", emoji: "🧊", bg: "#7dd3fc", x: 40, y: 268, w: 350, h: 160 },
  { key: "forest", name: "Forest", emoji: "🌲", bg: "#16a34a", x: 410, y: 268, w: 350, h: 160 },
];

interface Animal {
  emoji: string;
  name: string;
  zone: string;
}

const ANIMALS: Animal[] = [
  { emoji: "🐠", name: "Fish", zone: "ocean" },
  { emoji: "🐪", name: "Camel", zone: "desert" },
  { emoji: "🐻‍❄️", name: "Polar bear", zone: "arctic" },
  { emoji: "🦌", name: "Deer", zone: "forest" },
  { emoji: "🐙", name: "Octopus", zone: "ocean" },
  { emoji: "🦎", name: "Lizard", zone: "desert" },
];

class Habitats implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private detach: () => void;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Animal[] = [];
  private idx = 0;
  private mistakes = 0;
  private tok = { x: START.x, y: START.y };
  private dragging = false;
  private flash = 0;
  private flashZone: string | null = null;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
    this.detach = onPointer(ctx.canvas, W, H, {
      down: (p) => {
        if (Math.hypot(p.x - this.tok.x, p.y - this.tok.y) < 44) this.dragging = true;
      },
      move: (p) => {
        if (this.dragging) {
          this.tok.x = p.x;
          this.tok.y = p.y;
        }
      },
      up: (p) => {
        if (this.dragging) {
          this.dragging = false;
          this.drop(p);
        }
      },
    });
    this.buildPanel();
    ctx.services.hints.setHints([
      "A habitat is the home where an animal finds the food, water, and shelter it needs.",
      "Match the animal to a place that suits it: water for swimmers, cold ice for thick-furred animals, hot sand for desert animals, trees for forest animals.",
      "Fish and octopus live in the ocean, camels and lizards in the desert, polar bears in the arctic, deer in the forest.",
    ]);
    this.renderLoop();
  }

  private current(): Animal {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.idx + 1} / ${ANIMALS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = "Drag the animal into the habitat where it lives.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Send each animal home"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Drag the animal to its habitat"),
      el("div", { class: "metric" }, el("span", {}, "🐾 Animal"), this.progressEl),
      this.coachEl,
    );
  }

  private zoneAt(p: Point): Zone | null {
    return ZONES.find((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) ?? null;
  }

  private drop(p: Point): void {
    if (this.ended) return;
    const z = this.zoneAt(p);
    const cur = this.current();
    if (z && z.key === cur.zone) {
      this.flash = 1;
      this.flashZone = z.key;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ The ${cur.name.toLowerCase()} lives in the ${z.name.toLowerCase()}!`;
      this.idx += 1;
      this.tok = { x: START.x, y: START.y };
      if (this.idx >= this.order.length) {
        this.progressEl.textContent = `${ANIMALS.length} / ${ANIMALS.length}`;
        this.win();
      } else {
        this.progressEl.textContent = `${this.idx + 1} / ${ANIMALS.length}`;
      }
    } else {
      this.flash = -1;
      if (z) this.mistakes += 1;
      this.ctx.services.audio.play(z ? "fail" : "click");
      if (z) {
        const correct = ZONES.find((x) => x.key === cur.zone)!;
        this.coachEl.textContent = `❌ A ${cur.name.toLowerCase()} doesn't live in the ${z.name.toLowerCase()}. Try the ${correct.name.toLowerCase()}.`;
      }
      this.tok = { x: START.x, y: START.y }; // snap back
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("habitats_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Everyone's home! A habitat gives an animal what it needs — food, water, and shelter. Different animals are suited to different homes.",
      stars,
      resources: { Biomass: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.03);
      if (this.flash < 0) this.flash = Math.min(0, this.flash + 0.03);
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#ecfdf5";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#166534";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Every animal is home! 🏡", W / 2, H / 2);
      return;
    }

    // zones
    for (const z of ZONES) {
      c.fillStyle = z.bg;
      this.roundRect(c, z.x, z.y, z.w, z.h, 16);
      c.globalAlpha = this.flash > 0 && this.flashZone === z.key ? 1 : 0.85;
      c.fill();
      c.globalAlpha = 1;
      c.font = "44px serif";
      c.textAlign = "center";
      c.fillText(z.emoji, z.x + z.w / 2, z.y + z.h / 2);
      c.fillStyle = "rgba(255,255,255,0.95)";
      c.font = "bold 18px Nunito, sans-serif";
      c.fillText(z.name, z.x + z.w / 2, z.y + 28);
    }

    // animal token
    const cur = this.current();
    c.fillStyle = "#fff";
    c.strokeStyle = this.dragging ? "#22c55e" : "#86efac";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(this.tok.x, this.tok.y, 40, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.font = "46px serif";
    c.textAlign = "center";
    c.fillText(cur.emoji, this.tok.x, this.tok.y + 16);
    c.fillStyle = "#166534";
    c.font = "bold 16px Nunito, sans-serif";
    if (!this.dragging) c.fillText(`Drag the ${cur.name}`, this.tok.x, this.tok.y + 64);

    c.fillStyle = "#166534";
    c.font = "bold 20px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("Drag each animal to its habitat 🏡", W / 2, 50);
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    this.idx = 0;
    this.mistakes = 0;
    this.tok = { x: START.x, y: START.y };
    this.dragging = false;
    this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
}

export const habitatsGame: GameModule = {
  meta: {
    id: "habitats",
    conceptId: "bio-15",
    title: "Going Home",
    stream: "biology",
    gradeBand: "2-3",
    emoji: "🏡",
    blurb: "Drag each animal to the habitat where it can find food, water, and shelter.",
    mission: "Send every animal to the habitat where it belongs.",
    estMinutes: 2,
  },
  create: (ctx) => new Habitats(ctx),
};
