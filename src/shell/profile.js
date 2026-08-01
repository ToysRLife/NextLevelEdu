import { read, write } from "@platform/storage";
const DEFAULT_PERSONA = { alias: "Explorer", emoji: "🧑‍🚀" };
export function hasPersona() {
    return read("persona", null) !== null;
}
export function getPersona() {
    return read("persona", DEFAULT_PERSONA);
}
export function savePersona(persona) {
    write("persona", persona);
    window.dispatchEvent(new CustomEvent("persona-changed"));
}
// --- Favorites & recently-played (drives the Netflix-style home shelves). ---
export function getFavorites() {
    return read("favorites", []);
}
export function isFavorite(id) {
    return getFavorites().includes(id);
}
/** Toggle a game's favorite state; returns the new state. */
export function toggleFavorite(id) {
    const favs = getFavorites();
    const i = favs.indexOf(id);
    if (i >= 0)
        favs.splice(i, 1);
    else
        favs.unshift(id);
    write("favorites", favs);
    window.dispatchEvent(new CustomEvent("favorites-changed"));
    return i < 0;
}
export function getRecent() {
    return read("recent", []);
}
/** Record that a game was opened (most-recent first, capped). */
export function recordRecent(id) {
    const recent = getRecent().filter((x) => x !== id);
    recent.unshift(id);
    write("recent", recent.slice(0, 20));
}
// --- Rank: a sense of progression earned purely from learning (joules). ---
const RANKS = [
    { min: 0, title: "Cadet" },
    { min: 500, title: "Pilot" },
    { min: 1500, title: "Navigator" },
    { min: 3500, title: "Commander" },
    { min: 7000, title: "Captain" },
    { min: 12000, title: "Master Explorer" },
];
export function rankForJoules(joules) {
    let title = RANKS[0].title;
    for (const r of RANKS)
        if (joules >= r.min)
            title = r.title;
    return title;
}
/** Joules needed for the next rank, or null if at the top. */
export function nextRank(joules) {
    const upcoming = RANKS.find((r) => r.min > joules);
    return upcoming ? { title: upcoming.title, need: upcoming.min - joules } : null;
}
// --- Joules: the universal currency that drives explorer rank. ---
export function getJoules() {
    return read("joules", 0);
}
export function addJoules(amount) {
    write("joules", getJoules() + amount);
    window.dispatchEvent(new CustomEvent("joules-changed"));
}
function dayStamp(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function getStreak() {
    return read("streak", { current: 0, longest: 0, lastDate: "" });
}
/** Call once per mission played. Increments the streak on a new calendar day. */
export function recordPlayToday() {
    const s = getStreak();
    const today = dayStamp(0);
    if (s.lastDate === today)
        return s; // already counted today
    s.current = s.lastDate === dayStamp(-1) ? s.current + 1 : 1;
    s.longest = Math.max(s.longest, s.current);
    s.lastDate = today;
    write("streak", s);
    window.dispatchEvent(new CustomEvent("streak-changed"));
    return s;
}
function levelFor(score) {
    return score < 33 ? "junior" : score < 70 ? "explorer" : "master";
}
export function getLevel() {
    return read("level", { level: "explorer", score: 50 }).level;
}
export function recordPerformance(o) {
    const st = read("level", { level: "explorer", score: 50 });
    const delta = o.success ? 3 + o.stars * 3 - o.hints * 3 : -8;
    st.score = Math.max(0, Math.min(100, st.score + delta));
    st.level = levelFor(st.score);
    write("level", st);
    window.dispatchEvent(new CustomEvent("level-changed"));
    return st.level;
}
function ledgerKey(stream) {
    return `world:${stream}:resources`;
}
export function getResources(stream) {
    return read(ledgerKey(stream), {});
}
export function addResources(stream, grant) {
    const ledger = getResources(stream);
    for (const [name, amount] of Object.entries(grant)) {
        ledger[name] = (ledger[name] ?? 0) + amount;
    }
    write(ledgerKey(stream), ledger);
    window.dispatchEvent(new CustomEvent("resources-changed"));
}
/** Spend resources if affordable; returns true on success. */
export function spendResources(stream, cost) {
    const ledger = getResources(stream);
    for (const [name, amount] of Object.entries(cost)) {
        if ((ledger[name] ?? 0) < amount)
            return false;
    }
    for (const [name, amount] of Object.entries(cost)) {
        ledger[name] -= amount;
    }
    write(ledgerKey(stream), ledger);
    window.dispatchEvent(new CustomEvent("resources-changed"));
    return true;
}
// --- Built structures per world. ---
export function getBuilt(stream) {
    return read(`world:${stream}:built`, []);
}
export function markBuilt(stream, itemId) {
    const built = getBuilt(stream);
    if (!built.includes(itemId)) {
        built.push(itemId);
        write(`world:${stream}:built`, built);
        window.dispatchEvent(new CustomEvent("resources-changed"));
    }
}
