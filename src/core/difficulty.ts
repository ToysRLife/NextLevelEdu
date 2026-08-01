import type { DifficultyTier } from "@sdk/types";

/**
 * Pick a value by the learner's difficulty tier. Games read `ctx.tier` and use
 * this to scale a knob (a tolerance, target size, time limit, count, …) —
 * gentler for "junior", standard for "explorer", tougher for "master".
 */
export function byTier<T>(tier: DifficultyTier, junior: T, explorer: T, master: T): T {
  return tier === "junior" ? junior : tier === "master" ? master : explorer;
}
