import { read, write } from "@platform/storage";
import type { ResourceGrant, Stream } from "@sdk/types";

// The learner's persona. Today it's a self-chosen alias + a preset avatar emoji;
// later the avatar becomes an AI-generated anime portrait (the source photo is
// discarded immediately). `rank` is derived from joules, never stored.
export interface Persona {
  alias: string;
  emoji: string;
}

const DEFAULT_PERSONA: Persona = { alias: "Explorer", emoji: "🧑‍🚀" };

export function hasPersona(): boolean {
  return read<Persona | null>("persona", null) !== null;
}

export function getPersona(): Persona {
  return read<Persona>("persona", DEFAULT_PERSONA);
}

export function savePersona(persona: Persona): void {
  write("persona", persona);
  window.dispatchEvent(new CustomEvent("persona-changed"));
}

// --- Favorites & recently-played (drives the Netflix-style home shelves). ---
export function getFavorites(): string[] {
  return read<string[]>("favorites", []);
}
export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}
/** Toggle a game's favorite state; returns the new state. */
export function toggleFavorite(id: string): boolean {
  const favs = getFavorites();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1);
  else favs.unshift(id);
  write("favorites", favs);
  window.dispatchEvent(new CustomEvent("favorites-changed"));
  return i < 0;
}

export function getRecent(): string[] {
  return read<string[]>("recent", []);
}
/** Record that a game was opened (most-recent first, capped). */
export function recordRecent(id: string): void {
  const recent = getRecent().filter((x) => x !== id);
  recent.unshift(id);
  write("recent", recent.slice(0, 20));
}

// --- Rank: a sense of progression earned purely from learning (joules). ---
const RANKS: { min: number; title: string }[] = [
  { min: 0, title: "Cadet" },
  { min: 500, title: "Pilot" },
  { min: 1500, title: "Navigator" },
  { min: 3500, title: "Commander" },
  { min: 7000, title: "Captain" },
  { min: 12000, title: "Master Explorer" },
];

export function rankForJoules(joules: number): string {
  let title = RANKS[0].title;
  for (const r of RANKS) if (joules >= r.min) title = r.title;
  return title;
}

/** Joules needed for the next rank, or null if at the top. */
export function nextRank(joules: number): { title: string; need: number } | null {
  const upcoming = RANKS.find((r) => r.min > joules);
  return upcoming ? { title: upcoming.title, need: upcoming.min - joules } : null;
}

// --- Joules: the universal currency that drives explorer rank. ---
export function getJoules(): number {
  return read<number>("joules", 0);
}

export function addJoules(amount: number): void {
  write("joules", getJoules() + amount);
  window.dispatchEvent(new CustomEvent("joules-changed"));
}

// --- Daily play streak: a gentle "come back tomorrow" hook. ---
export interface Streak {
  current: number;
  longest: number;
  lastDate: string;
}

function dayStamp(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getStreak(): Streak {
  return read<Streak>("streak", { current: 0, longest: 0, lastDate: "" });
}

/** Call once per mission played. Increments the streak on a new calendar day. */
export function recordPlayToday(): Streak {
  const s = getStreak();
  const today = dayStamp(0);
  if (s.lastDate === today) return s; // already counted today
  s.current = s.lastDate === dayStamp(-1) ? s.current + 1 : 1;
  s.longest = Math.max(s.longest, s.current);
  s.lastDate = today;
  write("streak", s);
  window.dispatchEvent(new CustomEvent("streak-changed"));
  return s;
}

// --- Adaptive level: the game tunes itself to how the learner is doing.
// Skill score drifts up with strong, unaided wins and down with struggles;
// the level (== DifficultyTier) is derived from it. ---
export type Level = "junior" | "explorer" | "master";

interface LevelState {
  level: Level;
  score: number; // 0..100
}

function levelFor(score: number): Level {
  return score < 33 ? "junior" : score < 70 ? "explorer" : "master";
}

export function getLevel(): Level {
  return read<LevelState>("level", { level: "explorer", score: 50 }).level;
}

export function recordPerformance(o: { success: boolean; stars: number; hints: number }): Level {
  const st = read<LevelState>("level", { level: "explorer", score: 50 });
  const delta = o.success ? 3 + o.stars * 3 - o.hints * 3 : -8;
  st.score = Math.max(0, Math.min(100, st.score + delta));
  st.level = levelFor(st.score);
  write("level", st);
  window.dispatchEvent(new CustomEvent("level-changed"));
  return st.level;
}

// --- Per-world resource ledger. Each science stream feeds its own reward world
// with its own resources (see content/curriculum.json). Resources are minted
// only by learning events and spent to build that world. ---
type Ledger = Record<string, number>;

function ledgerKey(stream: Stream): string {
  return `world:${stream}:resources`;
}

export function getResources(stream: Stream): Ledger {
  return read<Ledger>(ledgerKey(stream), {});
}

export function addResources(stream: Stream, grant: ResourceGrant): void {
  const ledger = getResources(stream);
  for (const [name, amount] of Object.entries(grant)) {
    ledger[name] = (ledger[name] ?? 0) + amount;
  }
  write(ledgerKey(stream), ledger);
  window.dispatchEvent(new CustomEvent("resources-changed"));
}

/** Spend resources if affordable; returns true on success. */
export function spendResources(stream: Stream, cost: ResourceGrant): boolean {
  const ledger = getResources(stream);
  for (const [name, amount] of Object.entries(cost)) {
    if ((ledger[name] ?? 0) < amount) return false;
  }
  for (const [name, amount] of Object.entries(cost)) {
    ledger[name] -= amount;
  }
  write(ledgerKey(stream), ledger);
  window.dispatchEvent(new CustomEvent("resources-changed"));
  return true;
}

// --- Built structures per world. ---
export function getBuilt(stream: Stream): string[] {
  return read<string[]>(`world:${stream}:built`, []);
}

export function markBuilt(stream: Stream, itemId: string): void {
  const built = getBuilt(stream);
  if (!built.includes(itemId)) {
    built.push(itemId);
    write(`world:${stream}:built`, built);
    window.dispatchEvent(new CustomEvent("resources-changed"));
  }
}
