import type { GameContext, GameInstance, GameModule } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";

const W = 800;
const H = 600;

type Form = "light" | "heat" | "sound" | "motion" | "electrical";

const FORMS: { key: Form; label: string; emoji: string }[] = [
  { key: "light", label: "Light", emoji: "💡" },
  { key: "heat", label: "Heat", emoji: "🔥" },
  { key: "sound", label: "Sound", emoji: "🔊" },
  { key: "motion", label: "Motion", emoji: "🏃" },
  { key: "electrical", label: "Electrical", emoji: "⚡" },
];

interface Item {
  name: string;
  emoji: string;
  form: Form;
  why: string;
}

const ITEMS: Item[] = [
  {
    name: "The Sun",
    emoji: "☀️",
    form: "light",
    why: "The Sun shines — that's light energy (and heat too!).",
  },
  {
    name: "A campfire",
    emoji: "🔥",
    form: "heat",
    why: "A fire gives off heat energy, warming everything nearby.",
  },
  {
    name: "A beating drum",
    emoji: "🥁",
    form: "sound",
    why: "A drum vibrates the air — that's sound energy.",
  },
  {
    name: "A running child",
    emoji: "🏃",
    form: "motion",
    why: "Anything moving has motion (kinetic) energy.",
  },
  {
    name: "A battery",
    emoji: "🔋",
    form: "electrical",
    why: "A battery stores and gives out electrical energy.",
  },
  {
    name: "A ringing bell",
    emoji: "🔔",
    form: "sound",
    why: "A bell vibrates to make sound energy.",
  },
  {
    name: "A speeding car",
    emoji: "🚗",
    form: "motion",
    why: "A moving car carries motion energy.",
  },
  { name: "A torch beam", emoji: "🔦", form: "light", why: "A torch sends out light energy." },
];

class EnergyForms implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Item[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Energy comes in many forms — light, heat, sound, motion, and electrical — and it makes things happen.",
      "Ask what the thing is doing: shining? warming? making noise? moving? powering something?",
      "Sun and torches give light; fire gives heat; drums and bells make sound; moving things have motion energy; batteries give electrical energy.",
    ]);
    this.renderLoop();
  }

  private current(): Item {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...FORMS.map((fm) =>
        el(
          "button",
          { class: "chip", onclick: () => this.choose(fm.key) },
          `${fm.emoji} ${fm.label}`
        )
      )
    );

    this.progressEl = el(
      "span",
      { style: { color: "var(--accent-yellow)" } },
      `${this.idx + 1} / ${ITEMS.length}`
    );
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-yellow)", background: "#fefce8" },
    });
    this.coachEl.textContent = "What form of energy is this?";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Spot every energy")
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Which form of energy?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "⚡ Item"), this.progressEl),
      this.coachEl
    );
  }

  private choose(form: Form): void {
    if (this.ended) return;
    const it = this.current();
    if (form === it.form) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${it.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ ${it.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${ITEMS.length} / ${ITEMS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${ITEMS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("energyforms_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Energy expert! Energy takes many forms — light, heat, sound, motion, and electrical — and each one makes something happen in the world.",
      stars,
      resources: { Oxygen: 40 },
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
    c.fillStyle = "#fefce8";
    c.fillRect(0, 0, W, H);

    if (this.ended) {
      c.fillStyle = "#854d0e";
      c.font = "bold 30px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText("Energy spotted everywhere! ⚡", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const it = this.current();
    const cx = W / 2;
    const cy = 280 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#fde047";
    c.lineWidth = 6;
    this.roundRect(c, cx - 170, cy - 150, 340, 280, 24);
    c.fill();
    c.stroke();
    c.font = "120px serif";
    c.textAlign = "center";
    c.fillText(it.emoji, cx, cy + 20);
    c.fillStyle = "#854d0e";
    c.font = "bold 24px Nunito, sans-serif";
    c.fillText(it.name, cx, cy + 100);

    c.fillStyle = "#854d0e";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("Name the form of energy ⚡", W / 2, 60);
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
    this.order = [...ITEMS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const energyFormsGame: GameModule = {
  meta: {
    id: "energyforms",
    conceptId: "phys-19",
    title: "Energy Spotter",
    stream: "physics",
    gradeBand: "4",
    emoji: "⚡",
    blurb: "Spot the form of energy — light, heat, sound, motion, or electrical — in each scene.",
    mission: "Correctly name the form of energy for every item.",
    estMinutes: 2,
  },
  create: (ctx) => new EnergyForms(ctx),
};
