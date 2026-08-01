import { read } from "@platform/storage";
import type { GameManifest, Stream } from "@sdk/types";
import { GAME_MANIFESTS } from "../registry";

// Difficulty + per-stream mastery gating. Games in a stream are ordered (the
// manifests are pre-sorted by grade, so easiest first) and grouped into levels
// of LEVEL_SIZE. A level unlocks only when the previous one is fully completed
// — so each subject is its own Duolingo-style path, progressing independently.

export const LEVEL_SIZE = 5;
export type Difficulty = "easy" | "medium" | "hard";

export const STREAMS: { id: Stream; label: string }[] = [
  { id: "maths", label: "🧮 Maths" },
  { id: "physics", label: "🚀 Physics" },
  { id: "chemistry", label: "⚗️ Chemistry" },
  { id: "biology", label: "🌱 Biology" },
  { id: "earth-space", label: "🌍 Earth & Space" },
];

/** Highest grade number in a band string ("K"→0, "3-5"→5, "6-8"→8). */
function maxGrade(band: string): number {
  const nums = (band.replace(/K/gi, "0").match(/\d+/g) ?? ["0"]).map(Number);
  return Math.max(...nums);
}

export function difficultyOf(meta: GameManifest): Difficulty {
  const g = maxGrade(meta.gradeBand);
  return g <= 2 ? "easy" : g <= 5 ? "medium" : "hard";
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; dot: string }> = {
  easy: { label: "Easy", dot: "🟢" },
  medium: { label: "Medium", dot: "🟡" },
  hard: { label: "Hard", dot: "🔴" },
};

/** A game counts as completed once it's been won at least once. */
export function hasWon(id: string): boolean {
  return read<{ wins: number }>(`progress:${id}`, { wins: 0 }).wins > 0;
}

export function streamGames(stream: Stream): GameManifest[] {
  return GAME_MANIFESTS.filter((m) => m.stream === stream);
}

/** Index of the level a learner is currently working on (0-based). Everything
 *  in this level and earlier is unlocked; later levels are locked. */
export function currentLevel(stream: Stream): number {
  const games = streamGames(stream);
  const levels = Math.ceil(games.length / LEVEL_SIZE);
  for (let k = 0; k < levels; k++) {
    const slice = games.slice(k * LEVEL_SIZE, (k + 1) * LEVEL_SIZE);
    if (!slice.every((g) => hasWon(g.id))) return k;
  }
  return Math.max(0, levels - 1); // all done — keep the last level "open"
}

export function levelOf(meta: GameManifest): number {
  const games = streamGames(meta.stream);
  const i = games.findIndex((g) => g.id === meta.id);
  return Math.floor((i < 0 ? 0 : i) / LEVEL_SIZE);
}

export function isUnlocked(meta: GameManifest): boolean {
  return levelOf(meta) <= currentLevel(meta.stream);
}

/** Human label for a locked game's gate. */
export function unlockHint(meta: GameManifest): string {
  return `Finish Level ${currentLevel(meta.stream) + 1} (5 games) to unlock`;
}

/** Progress through the current level of a stream — drives the shelf caption. */
export function streamProgress(stream: Stream): {
  level: number; // 1-based
  done: number;
  size: number;
  remaining: number;
  allDone: boolean;
} {
  const games = streamGames(stream);
  const lvl = currentLevel(stream);
  const slice = games.slice(lvl * LEVEL_SIZE, (lvl + 1) * LEVEL_SIZE);
  const done = slice.filter((g) => hasWon(g.id)).length;
  return {
    level: lvl + 1,
    done,
    size: slice.length,
    remaining: slice.length - done,
    allDone: games.every((g) => hasWon(g.id)),
  };
}

/** The current level's not-yet-won, unlocked games for a stream (what to do next). */
export function nextUpFor(stream: Stream): GameManifest[] {
  const games = streamGames(stream);
  const lvl = currentLevel(stream);
  return games.slice(lvl * LEVEL_SIZE, (lvl + 1) * LEVEL_SIZE).filter((g) => !hasWon(g.id));
}
