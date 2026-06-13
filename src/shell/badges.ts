import { read, write } from "@platform/storage";
import { GAME_MANIFESTS } from "../registry";
import { getJoules, getStreak, getBuilt } from "./profile";
import { getWorldReward } from "./worlds";

const STREAMS = ["physics", "chemistry", "biology", "earth-space"] as const;

export interface PlayerStats {
  played: number; // distinct games attempted
  wins: number; // distinct games won
  totalStars: number;
  threeStars: number; // games with a 3-star best
  perStreamWins: Record<string, number>;
  joules: number;
  longestStreak: number;
  structuresBuilt: number;
  worldsComplete: number;
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: (s: PlayerStats) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-steps", emoji: "🐣", title: "First Steps", desc: "Play your first mission", earned: (s) => s.played >= 1 },
  { id: "five-wins", emoji: "🎯", title: "Getting the Hang", desc: "Win 5 missions", earned: (s) => s.wins >= 5 },
  { id: "twenty-wins", emoji: "🚀", title: "On a Roll", desc: "Win 20 missions", earned: (s) => s.wins >= 20 },
  { id: "fifty-wins", emoji: "🏆", title: "Mission Master", desc: "Win 50 missions", earned: (s) => s.wins >= 50 },
  { id: "star-15", emoji: "⭐", title: "Star Collector", desc: "Earn 15 stars", earned: (s) => s.totalStars >= 15 },
  { id: "star-50", emoji: "🌟", title: "Superstar", desc: "Earn 50 stars", earned: (s) => s.totalStars >= 50 },
  { id: "triple-5", emoji: "💫", title: "Triple Threat", desc: "Get 3 stars on 5 games", earned: (s) => s.threeStars >= 5 },
  { id: "physicist", emoji: "🔭", title: "Physicist", desc: "Win 5 physics missions", earned: (s) => s.perStreamWins.physics >= 5 },
  { id: "chemist", emoji: "⚗️", title: "Chemist", desc: "Win 5 chemistry missions", earned: (s) => s.perStreamWins.chemistry >= 5 },
  { id: "biologist", emoji: "🧬", title: "Biologist", desc: "Win 5 biology missions", earned: (s) => s.perStreamWins.biology >= 5 },
  { id: "geologist", emoji: "🌍", title: "Earth Scientist", desc: "Win 5 earth & space missions", earned: (s) => s.perStreamWins["earth-space"] >= 5 },
  { id: "builder", emoji: "🧱", title: "Builder", desc: "Build your first structure", earned: (s) => s.structuresBuilt >= 1 },
  { id: "architect", emoji: "🏛️", title: "Architect", desc: "Build 10 structures", earned: (s) => s.structuresBuilt >= 10 },
  { id: "world-master", emoji: "🌐", title: "World Master", desc: "Complete a whole world", earned: (s) => s.worldsComplete >= 1 },
  { id: "spark", emoji: "⚡", title: "Bright Spark", desc: "Earn 1000 joules", earned: (s) => s.joules >= 1000 },
  { id: "streak-3", emoji: "🔥", title: "On Fire", desc: "Play 3 days in a row", earned: (s) => s.longestStreak >= 3 },
  { id: "streak-7", emoji: "☄️", title: "Unstoppable", desc: "Play 7 days in a row", earned: (s) => s.longestStreak >= 7 },
  { id: "explorer-25", emoji: "🧭", title: "Explorer", desc: "Try 25 different games", earned: (s) => s.played >= 25 },
];

interface ProgressRec {
  wins: number;
  bestStars: number;
  attempts: number;
}

export function gatherStats(): PlayerStats {
  const perStreamWins: Record<string, number> = { physics: 0, chemistry: 0, biology: 0, "earth-space": 0 };
  let played = 0;
  let wins = 0;
  let totalStars = 0;
  let threeStars = 0;
  for (const m of GAME_MANIFESTS) {
    const p = read<ProgressRec>(`progress:${m.id}`, { wins: 0, bestStars: 0, attempts: 0 });
    if (p.attempts > 0) played += 1;
    if (p.wins > 0) {
      wins += 1;
      perStreamWins[m.stream] = (perStreamWins[m.stream] ?? 0) + 1;
    }
    totalStars += p.bestStars;
    if (p.bestStars >= 3) threeStars += 1;
  }
  let structuresBuilt = 0;
  let worldsComplete = 0;
  for (const stream of STREAMS) {
    structuresBuilt += getBuilt(stream).length;
    if (getWorldReward(stream)?.complete) worldsComplete += 1;
  }
  return { played, wins, totalStars, threeStars, perStreamWins, joules: getJoules(), longestStreak: getStreak().longest, structuresBuilt, worldsComplete };
}

/** Re-check all badges; returns the ones newly unlocked this call. */
export function checkBadges(): Badge[] {
  const earned = new Set(read<string[]>("badges:earned", []));
  const stats = gatherStats();
  const newly: Badge[] = [];
  for (const b of BADGES) {
    if (!earned.has(b.id) && b.earned(stats)) {
      earned.add(b.id);
      newly.push(b);
    }
  }
  if (newly.length) {
    write("badges:earned", [...earned]);
    window.dispatchEvent(new CustomEvent("badges-changed"));
  }
  return newly;
}

export function getBadges(): (Badge & { unlocked: boolean })[] {
  const earned = new Set(read<string[]>("badges:earned", []));
  return BADGES.map((b) => ({ ...b, unlocked: earned.has(b.id) }));
}
