import { clear, el } from "@core/dom";
import { read } from "@platform/storage";
import { GAME_MANIFESTS } from "../registry";
import { getFavorites, getRecent, isFavorite, toggleFavorite } from "./profile";
import { DIFFICULTY_META, difficultyOf, hasWon, isUnlocked, nextUpFor, streamGames, streamProgress, STREAMS, unlockHint, } from "./progression";
// The home screen, designed like a world-class app: a set of filters on top
// and a stack of horizontally-scrolling "shelves" (Jump back in, Favorites,
// Recommended, then one per subject). Within a shelf, finished games sink to the
// end unless favorited, and locked games trail behind a mastery gate.
let activeDifficulty = "all";
let activeStream = "all";
let activeGrade = "all";
const DIFF_FILTERS = [
    { key: "all", label: "🎯 All" },
    { key: "easy", label: "🟢 Easy" },
    { key: "medium", label: "🟡 Medium" },
    { key: "hard", label: "🔴 Hard" },
];
const STREAM_FILTERS = [
    { key: "all", label: "🌐 All" },
    ...STREAMS.map((s) => ({ key: s.id, label: s.label })),
];
const GRADE_FILTERS = [
    { key: "all", label: "All Grades" },
    { key: "K-2", label: "K-2" },
    { key: "3-5", label: "3-5" },
    { key: "6-8", label: "6-8" },
];
export function renderDashboard(root) {
    const parseBand = (band) => {
        const normalized = band.replace(/K/gi, "0").trim();
        const parts = normalized.split("-").map((part) => Number(part.trim()));
        return parts.length === 2 ? [parts[0], parts[1]] : [parts[0], parts[0]];
    };
    const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1];
    const gradeMatches = (m) => {
        if (activeGrade === "all")
            return true;
        return overlaps(parseBand(activeGrade), parseBand(m.gradeBand));
    };
    const streamMatches = (m) => activeStream === "all" || m.stream === activeStream;
    const matchDiff = (m) => (activeDifficulty === "all" || difficultyOf(m) === activeDifficulty) &&
        streamMatches(m) &&
        gradeMatches(m);
    const byId = (id) => GAME_MANIFESTS.find((m) => m.id === id);
    const rerender = () => renderDashboard(root);
    // --- Card -----------------------------------------------------------------
    function card(meta) {
        const unlocked = isUnlocked(meta);
        const won = hasWon(meta.id);
        const fav = isFavorite(meta.id);
        const diff = difficultyOf(meta);
        const stars = read(`progress:${meta.id}`, { bestStars: 0 }).bestStars;
        const heart = el("button", {
            class: `fav-btn ${fav ? "on" : ""}`,
            title: fav ? "Remove favorite" : "Add favorite",
            onclick: (e) => {
                e.stopPropagation();
                toggleFavorite(meta.id);
                rerender();
            },
        }, fav ? "❤️" : "🤍");
        const badges = el("div", { class: "sc-badges" }, el("span", { class: `diff-badge ${diff}` }, `${DIFFICULTY_META[diff].dot} ${DIFFICULTY_META[diff].label}`), won ? el("span", { class: "done-badge" }, `✓ ${"⭐".repeat(stars)}`) : null);
        return el("button", {
            class: `shelf-card ${meta.stream} ${unlocked ? "" : "locked"} ${won ? "won" : ""}`,
            onclick: () => {
                if (unlocked)
                    location.hash = `#/play/${meta.id}`;
            },
        }, unlocked ? heart : el("div", { class: "sc-locktag" }, "🔒"), el("div", { class: "sc-emoji" }, meta.emoji), el("div", { class: "sc-title" }, meta.title), unlocked ? badges : el("div", { class: "sc-lock" }, unlockHint(meta)));
    }
    function shelf(title, metas, caption) {
        const list = metas.filter(matchDiff);
        if (!list.length)
            return null;
        return el("section", { class: "shelf" }, el("div", { class: "shelf-head" }, el("h3", { class: "shelf-title" }, title), caption ? el("span", { class: "shelf-caption" }, caption) : null), el("div", { class: "shelf-row" }, ...list.map(card)));
    }
    const shelves = [];
    // ▶ Jump back in — recently opened, unlocked, not yet finished.
    const jumpBack = getRecent()
        .map(byId)
        .filter((m) => !!m && isUnlocked(m) && !hasWon(m.id));
    shelves.push(shelf("▶ Jump back in", jumpBack));
    // ⭐ Favorites
    const favs = getFavorites()
        .map(byId)
        .filter((m) => !!m);
    shelves.push(shelf("⭐ Your Favorites", favs));
    // ✨ Recommended next — the current level's unfinished games across subjects.
    const recommended = STREAMS.flatMap((s) => nextUpFor(s.id)).slice(0, 12);
    shelves.push(shelf("✨ Recommended Next", recommended));
    // One shelf per subject — an ordered "course path" (Level 1's games, then
    // Level 2's, …) with a caption telling the learner what unlocks next.
    for (const s of STREAMS) {
        const p = streamProgress(s.id);
        const caption = p.allDone
            ? "🏆 All levels complete!"
            : `Level ${p.level} · ${p.done}/${p.size} done — finish ${p.remaining} more to unlock Level ${p.level + 1}`;
        shelves.push(shelf(s.label, streamGames(s.id), caption));
    }
    const difficultyBar = el("div", { class: "filter-bar" }, ...DIFF_FILTERS.map((f) => el("button", {
        class: `filter-chip ${activeDifficulty === f.key ? "active" : ""}`,
        onclick: () => {
            activeDifficulty = f.key;
            rerender();
        },
    }, f.label)));
    const streamBar = el("div", { class: "filter-bar" }, ...STREAM_FILTERS.map((f) => el("button", {
        class: `filter-chip ${activeStream === f.key ? "active" : ""}`,
        onclick: () => {
            activeStream = f.key;
            rerender();
        },
    }, f.label)));
    const gradeBar = el("div", { class: "filter-bar" }, ...GRADE_FILTERS.map((f) => el("button", {
        class: `filter-chip ${activeGrade === f.key ? "active" : ""}`,
        onclick: () => {
            activeGrade = f.key;
            rerender();
        },
    }, f.label)));
    const live = shelves.filter((s) => s !== null);
    const body = live.length
        ? live
        : [
            el("p", { class: "admin-note" }, "No games match this difficulty yet — try another filter."),
        ];
    clear(root);
    root.append(el("div", { class: "container home" }, el("h2", { class: "section-title" }, "Pick a Mission"), difficultyBar, streamBar, gradeBar, ...body));
}
