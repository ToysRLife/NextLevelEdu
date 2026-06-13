import { el, clear } from "@core/dom";
import { read } from "@platform/storage";
import type { GameManifest } from "@sdk/types";
import { GAME_MANIFESTS } from "../registry";
import { getFavorites, isFavorite, toggleFavorite, getRecent } from "./profile";
import {
  difficultyOf,
  DIFFICULTY_META,
  hasWon,
  isUnlocked,
  unlockHint,
  streamGames,
  nextUpFor,
  STREAMS,
  type Difficulty,
} from "./progression";

// The home screen, designed like a world-class app: a difficulty filter on top
// and a stack of horizontally-scrolling "shelves" (Jump back in, Favorites,
// Recommended, then one per subject). Within a shelf, finished games sink to the
// end unless favorited, and locked games trail behind a mastery gate.

let activeDifficulty: Difficulty | "all" = "all";

const DIFF_FILTERS: { key: Difficulty | "all"; label: string }[] = [
  { key: "all", label: "🎯 All" },
  { key: "easy", label: "🟢 Easy" },
  { key: "medium", label: "🟡 Medium" },
  { key: "hard", label: "🔴 Hard" },
];

export function renderDashboard(root: HTMLElement): void {
  const matchDiff = (m: GameManifest) => activeDifficulty === "all" || difficultyOf(m) === activeDifficulty;
  const byId = (id: string) => GAME_MANIFESTS.find((m) => m.id === id);

  const rerender = () => renderDashboard(root);

  // --- Card -----------------------------------------------------------------
  function card(meta: GameManifest): HTMLElement {
    const unlocked = isUnlocked(meta);
    const won = hasWon(meta.id);
    const fav = isFavorite(meta.id);
    const diff = difficultyOf(meta);
    const stars = read<{ bestStars: number }>(`progress:${meta.id}`, { bestStars: 0 }).bestStars;

    const heart = el(
      "button",
      {
        class: `fav-btn ${fav ? "on" : ""}`,
        title: fav ? "Remove favorite" : "Add favorite",
        onclick: (e: Event) => {
          e.stopPropagation();
          toggleFavorite(meta.id);
          rerender();
        },
      },
      fav ? "❤️" : "🤍",
    );

    const badges = el(
      "div",
      { class: "sc-badges" },
      el("span", { class: `diff-badge ${diff}` }, `${DIFFICULTY_META[diff].dot} ${DIFFICULTY_META[diff].label}`),
      won ? el("span", { class: "done-badge" }, `✓ ${"⭐".repeat(stars)}`) : null,
    );

    return el(
      "button",
      {
        class: `shelf-card ${meta.stream} ${unlocked ? "" : "locked"} ${won ? "won" : ""}`,
        onclick: () => {
          if (unlocked) location.hash = `#/play/${meta.id}`;
        },
      },
      unlocked ? heart : el("div", { class: "sc-locktag" }, "🔒"),
      el("div", { class: "sc-emoji" }, meta.emoji),
      el("div", { class: "sc-title" }, meta.title),
      unlocked ? badges : el("div", { class: "sc-lock" }, unlockHint(meta)),
    );
  }

  function shelf(title: string, metas: GameManifest[]): HTMLElement | null {
    const list = metas.filter(matchDiff);
    if (!list.length) return null;
    return el(
      "section",
      { class: "shelf" },
      el("h3", { class: "shelf-title" }, title),
      el("div", { class: "shelf-row" }, ...list.map(card)),
    );
  }

  // Order within a subject shelf: favorites → unlocked & unfinished → finished → locked.
  function orderStream(metas: GameManifest[]): GameManifest[] {
    const rank = (m: GameManifest) => {
      if (isFavorite(m.id)) return 0;
      if (!isUnlocked(m)) return 3;
      return hasWon(m.id) ? 2 : 1;
    };
    return [...metas].sort((a, b) => rank(a) - rank(b));
  }

  const shelves: (HTMLElement | null)[] = [];

  // ▶ Jump back in — recently opened, unlocked, not yet finished.
  const jumpBack = getRecent()
    .map(byId)
    .filter((m): m is GameManifest => !!m && isUnlocked(m) && !hasWon(m.id));
  shelves.push(shelf("▶ Jump back in", jumpBack));

  // ⭐ Favorites
  const favs = getFavorites()
    .map(byId)
    .filter((m): m is GameManifest => !!m);
  shelves.push(shelf("⭐ Your Favorites", favs));

  // ✨ Recommended next — the current level's unfinished games across subjects.
  const recommended = STREAMS.flatMap((s) => nextUpFor(s.id)).slice(0, 12);
  shelves.push(shelf("✨ Recommended Next", recommended));

  // One shelf per subject.
  for (const s of STREAMS) {
    shelves.push(shelf(s.label, orderStream(streamGames(s.id))));
  }

  const filterBar = el(
    "div",
    { class: "filter-bar" },
    ...DIFF_FILTERS.map((f) =>
      el(
        "button",
        {
          class: `filter-chip ${activeDifficulty === f.key ? "active" : ""}`,
          onclick: () => {
            activeDifficulty = f.key;
            rerender();
          },
        },
        f.label,
      ),
    ),
  );

  const live = shelves.filter((s): s is HTMLElement => s !== null);
  const body = live.length
    ? live
    : [el("p", { class: "admin-note" }, "No games match this difficulty yet — try another filter.")];

  clear(root);
  root.append(
    el(
      "div",
      { class: "container home" },
      el("h2", { class: "section-title" }, "Pick a Mission"),
      filterBar,
      ...body,
    ),
  );
}
