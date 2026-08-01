// The contract every game implements. The shell, gamification, hints, and
// analytics are written once against these types; a new game only fills in a
// GameModule. Platform services are injected, so games never touch storage,
// auth, or the reward economy directly — those swap to Supabase later.

export type Stream = "maths" | "physics" | "chemistry" | "biology" | "earth-space";

/** Coarse difficulty tier, derived from the learner's grade. */
export type DifficultyTier = "junior" | "explorer" | "master"; // K-2 | 3-5 | 6+

export interface GameManifest {
  /** Unique game id, e.g. "photosynthesis". */
  id: string;
  /** Concept id from content/curriculum.json, e.g. "bio-07". */
  conceptId: string;
  title: string;
  stream: Stream;
  /** Display grade band, e.g. "5" or "2-3". */
  gradeBand: string;
  /** Emoji used as a lightweight thumbnail. */
  emoji: string;
  /** One-line pitch shown on the dashboard card. */
  blurb: string;
  /** The mission statement (required — see mission+emotion design rule). */
  mission: string;
  estMinutes: number;
  /** One-line "you discovered" takeaway (auto-filled from the curriculum in manifests). */
  takeaway?: string;
}

/** Resources minted into the learner's reward world on a good outcome. */
export type ResourceGrant = Record<string, number>;

export interface OutcomeDetail {
  /** Emotional, specific message (names the cause on failure; celebrates on success). */
  message?: string;
  /** 0-3 stars for the attempt. */
  stars?: number;
  score?: number;
  /** Resources granted to the reward world (success only). */
  resources?: ResourceGrant;
}

/** Reports the mission result so the host can show emotion UI + grant rewards. */
export interface OutcomeService {
  succeed(detail?: OutcomeDetail): void;
  fail(detail?: OutcomeDetail): void;
}

/** Games emit neutral events; the platform owns all XP/reward math. */
export interface ScoreService {
  event(name: string, payload?: Record<string, unknown>): void;
  add(points: number): void;
  get(): number;
}

/** Tiered, on-demand hints (nudge -> strategy -> near-answer). */
export interface HintService {
  /** Game registers its hint tiers, ordered from gentlest to most explicit. */
  setHints(tiers: string[]): void;
  /** Reveal the next hint tier; null when exhausted. */
  next(): string | null;
  /** How many hints were revealed this attempt (a learning signal). */
  count(): number;
  reset(): void;
}

/** Per-game persistence (localStorage now, server later). */
export interface ProgressService {
  save(state: unknown): void;
  load<T = unknown>(): T | undefined;
  recordResult(result: { success: boolean; score: number; stars: number }): void;
  bestScore(): number;
}

export interface TelemetryService {
  emit(event: string, payload?: Record<string, unknown>): void;
}

export interface AudioService {
  play(sound: "success" | "fail" | "click" | "reward" | "tick"): void;
  /** Play a single musical note at a given pitch (Hz) — for games that make
   *  sound, like instruments. Respects the global mute. */
  tone(freq: number, durMs?: number, type?: OscillatorType): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export interface PlatformServices {
  outcome: OutcomeService;
  score: ScoreService;
  hints: HintService;
  progress: ProgressService;
  telemetry: TelemetryService;
  audio: AudioService;
}

export interface GameContext {
  /** The drawing surface the game owns. */
  canvas: HTMLCanvasElement;
  /** Container for the game's own HTML controls (sliders, buttons, readouts). */
  panel: HTMLElement;
  /** Difficulty tier derived from the learner's grade. */
  tier: DifficultyTier;
  /** Previously saved state to resume from, if any. */
  savedState?: unknown;
  services: PlatformServices;
}

/** A live, mounted game. */
export interface GameInstance {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
}

/** What each game exports. `meta` is readable without instantiating. */
export interface GameModule {
  meta: GameManifest;
  create(ctx: GameContext): GameInstance;
}
