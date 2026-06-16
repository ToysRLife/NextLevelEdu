import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

interface Mineral {
  key: string;
  name: string;
  emoji: string;
  color: string;
  clues: string[];
  why: string;
}

const NAMES = ["Quartz", "Gold", "Graphite", "Talc", "Magnetite", "Diamond"];

const SPECIMENS: Mineral[] = [
  {
    key: "graphite",
    name: "Graphite",
    emoji: "✏️",
    color: "#475569",
    clues: ["Very soft", "Dark grey", "Leaves marks on paper"],
    why: "Soft grey graphite is what pencil 'lead' is made of.",
  },
  {
    key: "quartz",
    name: "Quartz",
    emoji: "🔮",
    color: "#e0f2fe",
    clues: ["Very hard (scratches glass)", "Often clear", "Glassy shine"],
    why: "Hard, glassy, often-clear quartz is one of the most common minerals.",
  },
  {
    key: "gold",
    name: "Gold",
    emoji: "🪙",
    color: "#fbbf24",
    clues: ["Shiny yellow", "Soft and heavy", "Metallic"],
    why: "Soft, heavy, shiny-yellow metal — that's real gold.",
  },
  {
    key: "talc",
    name: "Talc",
    emoji: "🧴",
    color: "#f1f5f9",
    clues: ["Softest mineral of all", "White", "Powdery (talcum powder)"],
    why: "Talc is the softest mineral — you can scratch it with a fingernail.",
  },
  {
    key: "magnetite",
    name: "Magnetite",
    emoji: "🧲",
    color: "#1e293b",
    clues: ["Black and heavy", "Metallic", "A magnet sticks to it!"],
    why: "Magnetite is a black, magnetic mineral — magnets stick right to it.",
  },
];

class Minerals implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Mineral[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...SPECIMENS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Geologists identify minerals by their properties — hardness, colour, shine (luster), and special tests.",
      "Clues to use: How hard is it? What colour? Does it shine like metal? Is it magnetic?",
      "Match the clues: soft grey marks = graphite, hard glassy = quartz, magnetic black = magnetite, softest white = talc, soft yellow metal = gold.",
    ]);
    this.renderLoop();
  }

  private current(): Mineral {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...NAMES.map((n) => el("button", { class: "chip", onclick: () => this.choose(n) }, n))
    );

    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-orange)" } },
      `${this.idx + 1} / ${SPECIMENS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-orange)", background: "#fff7ed" },
    });
    this.coachEl.textContent = "Read the clues, then name the mineral.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Identify every mineral")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Which mineral is it?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🪨 Specimen"), this.progressEl),
      this.coachEl
    );
  }

  private choose(name: string): void {
    if (this.ended) return;
    const m = this.current();
    if (name === m.name) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${m.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ It's not ${name}. ${m.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${SPECIMENS.length} / ${SPECIMENS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${SPECIMENS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("minerals_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Rock detective! Minerals are told apart by properties like hardness, colour, shine, and tests such as whether a magnet sticks.",
      stars,
      resources: { Minerals: 40 },
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
    c.fillStyle = "#fff7ed";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#9a3412";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Every mineral identified! 🪨", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.2})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${this.flash * -0.2})`;
      c.fillRect(0, 0, W, H);
    }

    const m = this.current();
    const cx = W / 2;
    const cy = 230 + Math.sin(this.anim) * 5;

    // specimen rock
    c.fillStyle = m.color;
    c.strokeStyle = "#78716c";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx - 80, cy + 50);
    c.lineTo(cx - 60, cy - 40);
    c.lineTo(cx - 10, cy - 60);
    c.lineTo(cx + 55, cy - 35);
    c.lineTo(cx + 80, cy + 30);
    c.lineTo(cx + 30, cy + 60);
    c.closePath();
    c.fill();
    c.stroke();
    // facet highlights
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 10, cy - 60);
    c.lineTo(cx + 10, cy + 10);
    c.moveTo(cx - 60, cy - 40);
    c.lineTo(cx + 10, cy + 10);
    c.stroke();
    c.font = "36px serif";
    c.textAlign = "center";
    c.fillText(m.emoji, cx, cy + 12);

    // clue cards
    c.textAlign = "center";
    m.clues.forEach((clue, i) => {
      const y = 340 + i * 50;
      c.fillStyle = "#fff";
      c.strokeStyle = "#fdba74";
      c.lineWidth = 3;
      this.roundRect(c, cx - 220, y, 440, 40, 10);
      c.fill();
      c.stroke();
      c.fillStyle = "#9a3412";
      c.font = "bold 17px Nunito, sans-serif";
      c.fillText(`🔍 ${clue}`, cx, y + 26);
    });

    c.fillStyle = "#9a3412";
    c.font = "bold 18px Nunito, sans-serif";
    c.fillText("Identify the mineral from its clues", W / 2, 50);
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
    this.idx = 0;
    this.mistakes = 0;
    this.flash = 0;
    this.order = [...SPECIMENS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const mineralsGame: GameModule = {
  meta: {
    id: "minerals",
    conceptId: "ess-14",
    title: "Rock Detective",
    stream: "earth-space",
    gradeBand: "3-4",
    emoji: "🪨",
    blurb: "Use property clues — hardness, colour, shine, magnetism — to name each mineral.",
    mission: "Identify every mineral specimen from its clues.",
    estMinutes: 3,
  },
  create: (ctx) => new Minerals(ctx),
};
