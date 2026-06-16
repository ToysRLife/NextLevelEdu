import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

type Method = "sieve" | "magnet" | "filter" | "evaporate";

interface Component {
  key: string;
  label: string;
  emoji: string;
  method: Method;
  color: string;
  separated: boolean;
}

const METHODS: { id: Method; label: string; emoji: string; teaches: string }[] = [
  {
    id: "sieve",
    label: "Sieve",
    emoji: "🪤",
    teaches: "A sieve catches big bits and lets small ones through.",
  },
  {
    id: "magnet",
    label: "Magnet",
    emoji: "🧲",
    teaches: "A magnet pulls out magnetic metals like iron.",
  },
  {
    id: "filter",
    label: "Filter",
    emoji: "☕",
    teaches: "A filter traps solids that don't dissolve, letting water through.",
  },
  {
    id: "evaporate",
    label: "Evaporate",
    emoji: "🔥",
    teaches: "Boiling the water away leaves the dissolved solid behind.",
  },
];

class Separating implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private ended = false;
  private mistakes = 0;
  private anim = 0;

  private components: Component[] = [
    {
      key: "pebbles",
      label: "Pebbles",
      emoji: "🪨",
      method: "sieve",
      color: "#9ca3af",
      separated: false,
    },
    {
      key: "iron",
      label: "Iron filings",
      emoji: "🔩",
      method: "magnet",
      color: "#475569",
      separated: false,
    },
    {
      key: "sand",
      label: "Sand",
      emoji: "🟫",
      method: "filter",
      color: "#d4a373",
      separated: false,
    },
    {
      key: "salt",
      label: "Salt",
      emoji: "🧂",
      method: "evaporate",
      color: "#f8fafc",
      separated: false,
    },
  ];

  private coachEl!: HTMLElement;
  private leftEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.buildPanel();
    ctx.services.hints.setHints([
      "A mixture is two or more things jumbled together that aren't chemically joined — so you can separate them again.",
      "Each part needs the right tool: big bits → sieve, magnetic metal → magnet, undissolved solids → filter, dissolved solids → evaporate.",
      "Try: 🪤 sieve the pebbles, 🧲 magnet the iron, ☕ filter the sand from the water, then 🔥 evaporate to leave the salt.",
    ]);
    this.renderLoop();
  }

  private buildPanel(): void {
    this.leftEl = el("span", { style: { color: "var(--accent-pink)" } }, "4");
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-pink)", background: "#fdf2f8" },
    });
    this.coachEl.textContent = "Pick the right tool to pull each part out of the mixture.";

    const toolRow = el(
      "div",
      { class: "chip-row" },
      ...METHODS.map((m) =>
        el(
          "button",
          {
            class: "chip",
            "data-method": m.id,
            onclick: () => this.applyMethod(m.id),
          },
          `${m.emoji} ${m.label}`
        )
      )
    );

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Separate it all")
      ),
      el(
        "div",
        { class: "control-label", style: { marginTop: "8px" } },
        "Choose a separation tool"
      ),
      toolRow,
      el("div", { class: "metric" }, el("span", {}, "🧪 Parts left"), this.leftEl),
      this.coachEl
    );
  }

  private applyMethod(method: Method): void {
    if (this.ended) return;
    const targets = this.components.filter((c) => !c.separated && c.method === method);
    if (targets.length === 0) {
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      const m = METHODS.find((x) => x.id === method)!;
      this.coachEl.textContent = `❌ Nothing here for that. ${m.teaches}`;
      return;
    }
    for (const t of targets) t.separated = true;
    this.ctx.services.audio.play("tick");
    const m = METHODS.find((x) => x.id === method)!;
    this.coachEl.textContent = `✅ ${m.teaches}`;
    const left = this.components.filter((c) => !c.separated).length;
    this.leftEl.textContent = String(left);
    if (left === 0) this.win();
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("separating_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Fully separated! Because a mixture isn't chemically joined, the right physical method pulls each part back out.",
      stars,
      resources: { Elements: 40 },
    });
  }

  private renderLoop(): void {
    const draw = () => {
      this.anim += 0.05;
      this.render();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  private render(): void {
    const c = this.ctx2d;
    c.fillStyle = "#fdf2f8";
    c.fillRect(0, 0, W, H);

    // central mixture jar
    const jar = { x: 90, y: 150, w: 300, h: 340 };
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(jar.x, jar.y, jar.w, jar.h);
    // water hint (still present until salt evaporated)
    const saltGone = this.components.find((x) => x.key === "salt")!.separated;
    const sandGone = this.components.find((x) => x.key === "sand")!.separated;
    if (!saltGone) {
      c.fillStyle = sandGone ? "rgba(186,230,253,0.7)" : "rgba(148,163,184,0.55)";
      c.fillRect(jar.x, jar.y + 120, jar.w, jar.h - 120);
    }
    c.strokeStyle = "#94a3b8";
    c.lineWidth = 5;
    c.strokeRect(jar.x, jar.y, jar.w, jar.h);
    c.fillStyle = "#831843";
    c.font = "bold 18px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText("The Mixture", jar.x + jar.w / 2, jar.y - 14);

    // remaining components floating/settled in jar
    const remaining = this.components.filter((cc) => !cc.separated);
    remaining.forEach((cc, i) => {
      const px = jar.x + 60 + (i % 2) * 150;
      const py = jar.y + 180 + Math.floor(i / 2) * 90 + Math.sin(this.anim + i) * 5;
      this.blob(c, px, py, cc.color);
      c.font = "30px serif";
      c.fillText(cc.emoji, px, py + 10);
    });

    // collection bins on the right
    c.font = "bold 16px Nunito, sans-serif";
    c.fillStyle = "#831843";
    c.textAlign = "left";
    c.fillText("Separated parts:", 440, jar.y - 14);
    this.components.forEach((cc, i) => {
      const bx = 440;
      const by = jar.y + i * 80;
      c.fillStyle = cc.separated ? "#fff" : "#f1f5f9";
      c.strokeStyle = cc.separated ? "#22c55e" : "#cbd5e1";
      c.lineWidth = 3;
      this.roundRect(c, bx, by, 270, 64, 14);
      c.fill();
      c.stroke();
      c.font = "28px serif";
      c.textAlign = "center";
      c.fillText(cc.separated ? cc.emoji : "❓", bx + 36, by + 42);
      c.fillStyle = cc.separated ? "#15803d" : "#94a3b8";
      c.font = "bold 16px Nunito, sans-serif";
      c.textAlign = "left";
      c.fillText(cc.separated ? cc.label : "???", bx + 72, by + 30);
      c.fillStyle = "#94a3b8";
      c.font = "12px Nunito, sans-serif";
      c.fillText(cc.separated ? "collected ✓" : "still mixed", bx + 72, by + 50);
    });
  }

  private blob(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, 26, 0, Math.PI * 2);
    c.fill();
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
    this.mistakes = 0;
    for (const cc of this.components) cc.separated = false;
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const separatingGame: GameModule = {
  meta: {
    id: "separating",
    conceptId: "chem-12",
    title: "Take It Apart",
    stream: "chemistry",
    gradeBand: "5",
    emoji: "🧫",
    blurb: "Use a sieve, magnet, filter, and evaporation to separate a jumbled mixture.",
    mission: "Separate every part of the mixture by choosing the right method for each one.",
    estMinutes: 3,
  },
  create: (ctx) => new Separating(ctx),
};
