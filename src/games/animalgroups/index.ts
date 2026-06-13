import type { GameModule, GameContext, GameInstance } from "@sdk/types";
import { fitCanvas } from "@core/canvas";
import { el, clear } from "@core/dom";

const W = 800;
const H = 600;

type Group = "mammal" | "bird" | "fish" | "reptile" | "amphibian" | "insect";

const GROUPS: { key: Group; label: string; emoji: string }[] = [
  { key: "mammal", label: "Mammal", emoji: "🐾" },
  { key: "bird", label: "Bird", emoji: "🪶" },
  { key: "fish", label: "Fish", emoji: "🐟" },
  { key: "reptile", label: "Reptile", emoji: "🦎" },
  { key: "amphibian", label: "Amphibian", emoji: "🐸" },
  { key: "insect", label: "Insect", emoji: "🐝" },
];

interface Animal {
  name: string;
  emoji: string;
  group: Group;
  trait: string;
  why: string;
}

const ANIMALS: Animal[] = [
  { name: "Dog", emoji: "🐶", group: "mammal", trait: "fur, feeds milk to pups", why: "Mammals have fur or hair and feed their babies milk." },
  { name: "Eagle", emoji: "🦅", group: "bird", trait: "feathers, wings, lays eggs", why: "Birds have feathers and a beak, and lay eggs." },
  { name: "Goldfish", emoji: "🐠", group: "fish", trait: "gills, fins, wet scales", why: "Fish live in water, breathe with gills, and have fins." },
  { name: "Snake", emoji: "🐍", group: "reptile", trait: "dry scales, lays eggs on land", why: "Reptiles have dry, scaly skin and usually lay eggs on land." },
  { name: "Frog", emoji: "🐸", group: "amphibian", trait: "moist skin, lives in water & on land", why: "Amphibians have moist skin and live both in water and on land." },
  { name: "Bee", emoji: "🐝", group: "insect", trait: "six legs, three body parts", why: "Insects have six legs and three body parts." },
  { name: "Dolphin", emoji: "🐬", group: "mammal", trait: "breathes air, feeds milk", why: "A dolphin lives in the sea but breathes air and feeds milk — it's a mammal, not a fish!" },
  { name: "Turtle", emoji: "🐢", group: "reptile", trait: "scaly shell, lays eggs", why: "A turtle has dry scales and a shell and lays eggs — it's a reptile." },
];

class AnimalGroups implements GameInstance {
  private readonly ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private anim = 0;
  private ended = false;

  private order: Animal[] = [];
  private idx = 0;
  private mistakes = 0;
  private flash = 0;

  private progressEl!: HTMLElement;
  private coachEl!: HTMLElement;

  constructor(private readonly ctx: GameContext) {
    this.ctx2d = fitCanvas(ctx.canvas, W, H);
    this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
    this.buildPanel();
    ctx.services.hints.setHints([
      "Scientists group animals by shared features — like skin covering, how they breathe, and how many legs they have.",
      "Fur + milk = mammal; feathers = bird; gills + fins = fish; dry scales = reptile; moist skin = amphibian; six legs = insect.",
      "Watch out for tricky ones: a dolphin lives in water but breathes air and feeds milk, so it's a mammal!",
    ]);
    this.renderLoop();
  }

  private current(): Animal {
    return this.order[this.idx];
  }

  private buildPanel(): void {
    const chips = el(
      "div",
      { class: "chip-row", style: { flexWrap: "wrap" } },
      ...GROUPS.map((g) =>
        el("button", { class: "chip", onclick: () => this.choose(g.key) }, `${g.emoji} ${g.label}`),
      ),
    );

    this.progressEl = el("span", { style: { color: "var(--accent-green)" } }, `1 / ${ANIMALS.length}`);
    this.coachEl = el("div", {
      class: "hint-panel",
      style: { borderLeftColor: "var(--accent-green)", background: "#f0fdf4" },
    });
    this.coachEl.textContent = "Read the animal's features, then pick its group.";

    clear(this.ctx.panel);
    this.ctx.panel.append(
      el(
        "div",
        { class: "metric", style: { background: "#1e293b", color: "#fff" } },
        el("span", {}, "🎯 Goal"),
        el("span", {}, "Classify every animal"),
      ),
      el("div", { class: "control-label", style: { marginTop: "8px" } }, "Which group does it belong to?"),
      chips,
      el("div", { class: "metric" }, el("span", {}, "🦓 Animal"), this.progressEl),
      this.coachEl,
    );
  }

  private choose(group: Group): void {
    if (this.ended) return;
    const a = this.current();
    if (group === a.group) {
      this.flash = 1;
      this.ctx.services.audio.play("tick");
      this.coachEl.textContent = `✅ ${a.why}`;
    } else {
      this.flash = -1;
      this.mistakes += 1;
      this.ctx.services.audio.play("fail");
      this.coachEl.textContent = `❌ Not a ${group}. ${a.why}`;
    }
    this.idx += 1;
    if (this.idx >= this.order.length) {
      this.progressEl.textContent = `${ANIMALS.length} / ${ANIMALS.length}`;
      this.win();
    } else {
      this.progressEl.textContent = `${this.idx + 1} / ${ANIMALS.length}`;
    }
  }

  private win(): void {
    this.ended = true;
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    this.ctx.services.score.event("animalgroups_done", { mistakes: this.mistakes });
    this.ctx.services.outcome.succeed({
      message:
        "Zoologist! Animals are grouped by shared features — fur and milk for mammals, feathers for birds, gills for fish, scales for reptiles, moist skin for amphibians, six legs for insects.",
      stars,
      resources: { Species: 40 },
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
      c.fillText("Every animal classified! 🦓", W / 2, H / 2);
      return;
    }

    if (this.flash > 0) {
      c.fillStyle = `rgba(34,197,94,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    } else if (this.flash < 0) {
      c.fillStyle = `rgba(255,90,95,${-this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const a = this.current();
    const cardW = 420;
    const cardH = 300;
    const cx = W / 2;
    const cy = 290 + Math.sin(this.anim) * 6;
    c.fillStyle = "#fff";
    c.strokeStyle = "#86efac";
    c.lineWidth = 6;
    this.roundRect(c, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
    c.fill();
    c.stroke();

    c.font = "120px serif";
    c.textAlign = "center";
    c.fillText(a.emoji, cx, cy);
    c.fillStyle = "#166534";
    c.font = "bold 28px Nunito, sans-serif";
    c.fillText(a.name, cx, cy + 70);
    c.fillStyle = "#15803d";
    c.font = "16px Nunito, sans-serif";
    c.fillText(`Features: ${a.trait}`, cx, cy + 104);

    c.fillStyle = "#166534";
    c.font = "bold 20px Nunito, sans-serif";
    c.fillText("What kind of animal is this?", W / 2, 60);
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
    this.flash = 0;
    this.order = [...ANIMALS].sort(() => Math.random() - 0.5);
    this.ctx.services.hints.reset();
    this.buildPanel();
  }
  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

export const animalGroupsGame: GameModule = {
  meta: {
    id: "animalgroups",
    conceptId: "bio-11",
    title: "Sort the Zoo",
    stream: "biology",
    gradeBand: "1-3",
    emoji: "🦓",
    blurb: "Classify each animal into its group using its features.",
    mission: "Sort every animal into mammals, birds, fish, reptiles, amphibians, or insects.",
    estMinutes: 3,
  },
  create: (ctx) => new AnimalGroups(ctx),
};
