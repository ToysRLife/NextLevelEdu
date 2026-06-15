import { el, clear } from "@core/dom";
import { getBadges } from "./badges";
import { getStreak } from "./profile";

export function renderBadges(root: HTMLElement): void {
  const badges = getBadges();
  const earned = badges.filter((b) => b.unlocked).length;
  const streak = getStreak();

  const grid = el("div", { class: "badge-grid" });
  for (const b of badges) {
    grid.append(
      el(
        "div",
        { class: `badge-card ${b.unlocked ? "earned" : "locked"}` },
        el("div", { class: "badge-emoji" }, b.unlocked ? b.emoji : "🔒"),
        el("div", { class: "badge-title" }, b.title),
        el("div", { class: "badge-desc" }, b.desc),
      ),
    );
  }

  clear(root);
  root.append(
    el(
      "div",
      { class: "container" },
      el("h2", { class: "section-title" }, "Your Trophies"),
      el(
        "div",
        { class: "trophy-stats" },
        el("span", { class: "tag" }, `🏅 ${earned} / ${badges.length} badges`),
        el("span", { class: "tag" }, `🔥 ${streak.current}-day streak`),
        el("span", { class: "tag" }, `🏆 Best streak: ${streak.longest}`),
      ),
      grid,
    ),
  );
}
