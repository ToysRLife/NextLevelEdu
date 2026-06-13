import { el, clear } from "@core/dom";
import { read } from "@platform/storage";
import { GAME_MANIFESTS } from "../registry";

interface ProgressPeek {
  bestStars: number;
  wins: number;
}

const FILTERS: { key: string | null; label: string }[] = [
  { key: null, label: "🎯 All" },
  { key: "physics", label: "🚀 Physics" },
  { key: "chemistry", label: "⚗️ Chemistry" },
  { key: "biology", label: "🌱 Biology" },
  { key: "earth-space", label: "🌍 Earth & Space" },
];

// Remembered across navigations within a session, so a kid stays in the subject
// they were browsing.
let activeStream: string | null = null;

// The dashboard is pure data-driven: it lists games from the lightweight
// manifests (no game code loaded here) — that code loads lazily on play.
export function renderDashboard(root: HTMLElement): void {
  const games = GAME_MANIFESTS.filter((m) => activeStream === null || m.stream === activeStream);

  const filterBar = el(
    "div",
    { class: "filter-bar" },
    ...FILTERS.map((f) => {
      const count = f.key === null ? GAME_MANIFESTS.length : GAME_MANIFESTS.filter((m) => m.stream === f.key).length;
      return el(
        "button",
        {
          class: `filter-chip ${activeStream === f.key ? "active" : ""}`,
          onclick: () => {
            activeStream = f.key;
            renderDashboard(root);
          },
        },
        `${f.label} (${count})`,
      );
    }),
  );

  const grid = el("div", { class: "game-grid" });

  for (const meta of games) {
    const prog = read<ProgressPeek>(`progress:${meta.id}`, { bestStars: 0, wins: 0 });

    const tags = el(
      "div",
      { class: "tags" },
      el("span", { class: "tag" }, meta.stream),
      el("span", { class: "tag" }, `Grade ${meta.gradeBand}`),
      el("span", { class: "tag" }, `${meta.estMinutes} min`),
      prog.bestStars > 0 && el("span", { class: "tag best" }, "⭐".repeat(prog.bestStars)),
    );

    const card = el(
      "button",
      {
        class: `game-card ${meta.stream}`,
        onclick: () => {
          location.hash = `#/play/${meta.id}`;
        },
      },
      el("div", { class: "emoji" }, meta.emoji),
      el("h3", {}, meta.title),
      el("div", { class: "blurb" }, meta.blurb),
      tags,
    );

    grid.append(card);
  }

  clear(root);
  root.append(
    el(
      "div",
      { class: "container" },
      el("h2", { class: "section-title" }, "Today's Missions"),
      filterBar,
      grid,
    ),
  );
}
