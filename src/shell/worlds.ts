import { el, clear } from "@core/dom";
import type { Stream, ResourceGrant } from "@sdk/types";
import { getResources, getBuilt, spendResources, markBuilt } from "./profile";

// Each science stream feeds a builder world (see content/curriculum.json and
// the rewards meta-game). Resources are minted only by learning, then spent to
// raise structures here — a tangible, lasting reward for understanding concepts.
interface Structure {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  cost: ResourceGrant;
}

interface World {
  stream: Stream;
  name: string;
  emoji: string;
  tagline: string;
  /** The world's resources, in display order (mirrors curriculum.json). */
  resources: string[];
  /** Structures build in order; each unlocks the next. */
  structures: Structure[];
}

const WORLDS: World[] = [
  {
    stream: "physics",
    name: "Space Colony",
    emoji: "🚀",
    tagline: "Power and forces build a home among the stars.",
    resources: ["Power", "Fuel", "Alloy", "Oxygen"],
    structures: [
      { id: "pad", name: "Landing Pad", emoji: "🛬", blurb: "Where your rockets touch down.", cost: { Power: 60 } },
      { id: "solar", name: "Solar Array", emoji: "🔆", blurb: "Panels that drink sunlight for electricity.", cost: { Power: 130 } },
      { id: "dome", name: "Habitat Dome", emoji: "🏟️", blurb: "A sealed home full of breathable air.", cost: { Alloy: 80, Oxygen: 60 } },
      { id: "rail", name: "Mag-Rail", emoji: "🛤️", blurb: "A frictionless track that flings cargo to orbit.", cost: { Alloy: 150, Power: 120 } },
      { id: "fusion", name: "Fusion Reactor", emoji: "⚛️", blurb: "The colony's beating heart.", cost: { Power: 250, Fuel: 120 } },
    ],
  },
  {
    stream: "chemistry",
    name: "Element Foundry",
    emoji: "⚗️",
    tagline: "Forge raw matter into the building blocks of everything.",
    resources: ["Elements", "Compounds", "Materials", "Energy"],
    structures: [
      { id: "sorter", name: "Sorting Bay", emoji: "🧺", blurb: "Sort raw matter by its properties.", cost: { Materials: 60 } },
      { id: "forge", name: "Melting Forge", emoji: "🔥", blurb: "Heat turns solids to liquids to gases.", cost: { Materials: 150 } },
      { id: "lab", name: "Compound Lab", emoji: "🧪", blurb: "Combine elements into brand-new compounds.", cost: { Materials: 120, Compounds: 80 } },
      { id: "crystal", name: "Crystal Garden", emoji: "💎", blurb: "Grow repeating crystal shapes.", cost: { Elements: 100, Materials: 100 } },
      { id: "reactor", name: "Reaction Reactor", emoji: "🌋", blurb: "Spark powerful chemical reactions.", cost: { Compounds: 200, Energy: 150 } },
    ],
  },
  {
    stream: "biology",
    name: "Living Planet",
    emoji: "🌱",
    tagline: "Grow a world bursting with life, from seed to ecosystem.",
    resources: ["Biomass", "Water", "Seeds", "Species"],
    structures: [
      { id: "vault", name: "Seed Vault", emoji: "🌰", blurb: "Store the seeds of every plant.", cost: { Biomass: 60 } },
      { id: "greenhouse", name: "Greenhouse", emoji: "🪴", blurb: "Grow plants that make food from sunlight.", cost: { Biomass: 150 } },
      { id: "pond", name: "Pond Habitat", emoji: "🪷", blurb: "A wetland teeming with life.", cost: { Biomass: 100, Water: 80 } },
      { id: "meadow", name: "Pollinator Meadow", emoji: "🌻", blurb: "Flowers and the creatures that spread them.", cost: { Seeds: 120, Biomass: 100 } },
      { id: "reserve", name: "Wildlife Reserve", emoji: "🦌", blurb: "A balanced ecosystem of many species.", cost: { Species: 200, Biomass: 150 } },
    ],
  },
  {
    stream: "earth-space",
    name: "World Forge",
    emoji: "🌍",
    tagline: "Shape rock, water, and climate into a living planet.",
    resources: ["Rock", "Water", "Minerals", "Climate"],
    structures: [
      { id: "quarry", name: "Quarry", emoji: "⛏️", blurb: "Dig up rock and minerals from the crust.", cost: { Minerals: 60 } },
      { id: "reservoir", name: "Reservoir", emoji: "💧", blurb: "Store water for the whole world.", cost: { Water: 120 } },
      { id: "mountains", name: "Mountain Range", emoji: "⛰️", blurb: "Raise peaks from the bedrock.", cost: { Rock: 100, Minerals: 80 } },
      { id: "rivers", name: "River Network", emoji: "🏞️", blurb: "Carve rivers that shape the land.", cost: { Water: 150, Minerals: 100 } },
      { id: "climate", name: "Climate Engine", emoji: "🌦️", blurb: "Balance the planet's weather and seasons.", cost: { Climate: 200, Water: 150 } },
    ],
  },
];

function worldFor(stream: string): World | undefined {
  return WORLDS.find((w) => w.stream === stream);
}

function canAfford(stream: Stream, cost: ResourceGrant): boolean {
  const have = getResources(stream);
  return Object.entries(cost).every(([name, amt]) => (have[name] ?? 0) >= amt);
}

function costLabel(cost: ResourceGrant): string {
  return Object.entries(cost)
    .map(([name, amt]) => `${amt} ${name}`)
    .join("  +  ");
}

/** The first structure not yet built (build order is sequential). */
function nextUnbuilt(w: World, built: string[]): Structure | undefined {
  return w.structures.find((s) => !built.includes(s.id));
}

export interface WorldReward {
  stream: string;
  name: string;
  emoji: string;
  complete: boolean;
  next: { id: string; name: string; emoji: string; cost: ResourceGrant; have: Record<string, number>; affordable: boolean } | null;
}

/** Snapshot of a world's build progress — used to show the reward on the win screen. */
export function getWorldReward(stream: string): WorldReward | null {
  const w = worldFor(stream);
  if (!w) return null;
  const built = getBuilt(w.stream);
  const have = getResources(w.stream);
  const next = nextUnbuilt(w, built);
  return {
    stream: w.stream,
    name: w.name,
    emoji: w.emoji,
    complete: !next,
    next: next
      ? { id: next.id, name: next.name, emoji: next.emoji, cost: next.cost, have, affordable: canAfford(w.stream, next.cost) }
      : null,
  };
}


// --- Worlds overview: all four reward worlds at a glance. ---
export function renderWorlds(root: HTMLElement): void {
  const grid = el("div", { class: "world-grid" });

  for (const w of WORLDS) {
    const built = getBuilt(w.stream);
    const have = getResources(w.stream);
    const totalEarned = Object.values(have).reduce((a, b) => a + b, 0);
    const builtScene = w.structures
      .filter((s) => built.includes(s.id))
      .map((s) => el("span", { class: "scene-item" }, s.emoji));
    const total = w.structures.length;
    const pct = Math.round((built.length / total) * 100);
    const next = nextUnbuilt(w, built);

    grid.append(
      el(
        "button",
        {
          class: `world-card ${w.stream}`,
          onclick: () => (location.hash = `#/world/${w.stream}`),
        },
        el("div", { class: "world-emoji" }, w.emoji),
        el("h3", {}, w.name),
        el("div", { class: "world-tagline" }, w.tagline),
        el(
          "div",
          { class: "world-scene" },
          ...(builtScene.length ? builtScene : [el("span", { class: "scene-empty" }, "Nothing built yet — go earn resources!")]),
        ),
        el(
          "div",
          { class: "card-meter" },
          el("div", { class: "meter-track" }, el("div", { class: "meter-fill", style: { width: `${pct}%` } })),
        ),
        el(
          "div",
          { class: "world-progress" },
          el("span", { class: "tag" }, next ? `⏭️ Next: ${next.emoji} ${next.name}` : "🎉 Complete!"),
          el("span", { class: "tag" }, `📦 ${totalEarned}`),
        ),
      ),
    );
  }

  clear(root);
  root.append(
    el(
      "div",
      { class: "container" },
      el("h2", { class: "section-title" }, "Your Reward Worlds"),
      el("p", { class: "section-sub" }, "Every concept you master mints resources. Spend them here to build a world of your own."),
      grid,
    ),
  );
}

// --- Single world: spend resources to raise structures, in order. ---
export function renderWorld(root: HTMLElement, stream: string): void {
  const w = worldFor(stream);
  if (!w) {
    location.hash = "#/worlds";
    return;
  }

  const rerender = () => renderWorld(root, stream);
  const have = getResources(w.stream);
  const built = getBuilt(w.stream);
  const builtCount = w.structures.filter((s) => built.includes(s.id)).length;
  const total = w.structures.length;
  const complete = builtCount === total;
  const next = nextUnbuilt(w, built);

  // Illustrated stage: a little world that visibly grows as you build. Each
  // built structure stands on the ground; the next one shows as a faint "ghost"
  // slot so kids can see what's coming.
  const stageRow = el("div", { class: "stage-row" });
  for (const s of w.structures) {
    if (built.includes(s.id)) {
      stageRow.append(
        el("div", { class: "stage-structure", title: s.name }, el("div", { class: "st-emoji" }, s.emoji), el("div", { class: "st-label" }, s.name)),
      );
    } else if (s === next) {
      stageRow.append(
        el("div", { class: "stage-structure ghost", title: `Next: ${s.name}` }, el("div", { class: "st-emoji" }, s.emoji), el("div", { class: "st-label" }, "next")),
      );
      break; // don't reveal locked structures past the next one
    }
  }
  const stage = el(
    "div",
    { class: `world-stage ${complete ? "complete" : ""}` },
    el("div", { class: "stage-sky" }),
    el("div", { class: "stage-ground" }),
    stageRow,
    complete ? el("div", { class: "stage-banner" }, "🎉 World complete!") : null,
  );

  // Completion meter — the big-picture progress toward finishing the world.
  const pct = Math.round((builtCount / total) * 100);
  const meter = el(
    "div",
    { class: "world-meter" },
    el("div", { class: "meter-track" }, el("div", { class: "meter-fill", style: { width: `${pct}%` } })),
    el("div", { class: "meter-label" }, `${builtCount} / ${total} built · ${pct}%`),
  );

  // Next-build focus: per-resource progress bars (goal gradient) + a one-tap
  // path back to playing when more resources are needed.
  let focus: HTMLElement | null = null;
  if (next) {
    const affordable = canAfford(w.stream, next.cost);
    const resRows = Object.entries(next.cost).map(([name, amt]) => {
      const cur = have[name] ?? 0;
      const p = Math.min(100, Math.round((cur / amt) * 100));
      return el(
        "div",
        { class: "res-row" },
        el("span", { class: "res-name" }, name),
        el("div", { class: "res-bar" }, el("div", { class: `res-fill ${cur >= amt ? "full" : ""}`, style: { width: `${p}%` } })),
        el("span", { class: "res-num" }, `${cur}/${amt}`),
      );
    });
    const action = affordable
      ? el(
          "button",
          {
            class: "btn world",
            onclick: () => {
              if (spendResources(w.stream, next.cost)) {
                markBuilt(w.stream, next.id);
                rerender();
              }
            },
          },
          `🔨 Build the ${next.name}`,
        )
      : el("button", { class: "btn", onclick: () => (location.hash = "#/") }, "▶ Play a mission to earn more");
    focus = el(
      "div",
      { class: `next-build ${affordable ? "ready" : ""}` },
      el("div", { class: "nb-emoji" }, next.emoji),
      el(
        "div",
        { class: "nb-info" },
        el("div", { class: "nb-title" }, affordable ? `Ready to build: ${next.name}!` : `Next up: ${next.name}`),
        el("div", { class: "nb-blurb" }, next.blurb),
        ...resRows,
        action,
      ),
    );
  }

  // Resource balances (all four shown, so goals are visible).
  const resourceBar = el(
    "div",
    { class: "resource-bar" },
    ...w.resources.map((name) =>
      el(
        "div",
        { class: "resource-chip" },
        el("strong", {}, String(have[name] ?? 0)),
        el("span", {}, name),
      ),
    ),
  );

  // Build list: sequential unlock.
  const list = el("div", { class: "build-list" });
  let prevBuilt = true;
  for (const s of w.structures) {
    const isBuilt = built.includes(s.id);
    const unlocked = prevBuilt; // previous structure done
    const affordable = unlocked && !isBuilt && canAfford(w.stream, s.cost);

    let stateClass = "locked";
    if (isBuilt) stateClass = "built";
    else if (affordable) stateClass = "ready";
    else if (unlocked) stateClass = "short";

    const action = isBuilt
      ? el("span", { class: "build-state done" }, "✓ Built")
      : !unlocked
        ? el("span", { class: "build-state" }, "🔒 Build the previous one first")
        : affordable
          ? el(
              "button",
              {
                class: "btn world",
                onclick: () => {
                  if (spendResources(w.stream, s.cost)) {
                    markBuilt(w.stream, s.id);
                    rerender();
                  }
                },
              },
              "🔨 Build",
            )
          : el("span", { class: "build-state" }, "Need more resources");

    list.append(
      el(
        "div",
        { class: `build-card ${stateClass}` },
        el("div", { class: "build-emoji" }, s.emoji),
        el(
          "div",
          { class: "build-info" },
          el("h4", {}, s.name),
          el("div", { class: "build-blurb" }, s.blurb),
          el("div", { class: "build-cost" }, costLabel(s.cost)),
        ),
        action,
      ),
    );

    prevBuilt = isBuilt;
  }

  clear(root);
  root.append(
    el(
      "div",
      { class: `container world-view ${w.stream}` },
      el(
        "div",
        { class: "world-header" },
        el("button", { class: "btn secondary", onclick: () => (location.hash = "#/worlds") }, "← Worlds"),
        el("div", { class: "world-title" }, el("span", { class: "world-emoji" }, w.emoji), el("h2", {}, w.name)),
      ),
      el("p", { class: "section-sub" }, w.tagline),
      stage,
      meter,
      focus,
      resourceBar,
      el("h3", { class: "build-roadmap-title" }, "🏗️ Build roadmap"),
      list,
    ),
  );
}
