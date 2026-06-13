import type {
  PlatformServices,
  OutcomeDetail,
  ScoreService,
  HintService,
  ProgressService,
  TelemetryService,
} from "@sdk/types";
import { read, write } from "./storage";
import { createAudioService } from "./audio";

export interface OutcomeHooks {
  onOutcome(kind: "success" | "fail", detail: OutcomeDetail): void;
}

interface ProgressRecord {
  bestScore: number;
  attempts: number;
  wins: number;
  bestStars: number;
  lastState?: unknown;
}

function createScore(gameId: string, telemetry: TelemetryService): ScoreService {
  let score = 0;
  return {
    event(name, payload) {
      telemetry.emit(`score:${name}`, { gameId, ...payload });
    },
    add(points) {
      score += points;
    },
    get: () => score,
  };
}

function createHints(gameId: string, telemetry: TelemetryService): HintService {
  let tiers: string[] = [];
  let index = 0;
  return {
    setHints(t) {
      tiers = t;
      index = 0;
    },
    next() {
      if (index >= tiers.length) return null;
      const hint = tiers[index];
      index += 1;
      telemetry.emit("hint:revealed", { gameId, tier: index });
      return hint;
    },
    count: () => index,
    reset() {
      index = 0;
    },
  };
}

function createProgress(gameId: string): ProgressService {
  const key = `progress:${gameId}`;
  const load = () => read<ProgressRecord>(key, { bestScore: 0, attempts: 0, wins: 0, bestStars: 0 });
  return {
    save(state) {
      const rec = load();
      rec.lastState = state;
      write(key, rec);
    },
    load<T>() {
      return load().lastState as T | undefined;
    },
    recordResult({ success, score, stars }) {
      const rec = load();
      rec.attempts += 1;
      if (success) rec.wins += 1;
      rec.bestScore = Math.max(rec.bestScore, score);
      rec.bestStars = Math.max(rec.bestStars, stars);
      write(key, rec);
    },
    bestScore: () => load().bestScore,
  };
}

function createTelemetry(): TelemetryService {
  return {
    emit(event, payload) {
      // Local stub: log now; batch-send to analytics backend later.
      if (import.meta.env.DEV) console.debug("[telemetry]", event, payload ?? {});
    },
  };
}

export function createServices(gameId: string, hooks: OutcomeHooks): PlatformServices {
  const telemetry = createTelemetry();
  const progress = createProgress(gameId);
  const score = createScore(gameId, telemetry);
  const hints = createHints(gameId, telemetry);
  const audio = createAudioService();

  const finish = (kind: "success" | "fail", detail: OutcomeDetail = {}) => {
    const resolved: OutcomeDetail = { score: score.get(), stars: kind === "success" ? 3 : 0, ...detail };
    progress.recordResult({
      success: kind === "success",
      score: resolved.score ?? 0,
      stars: resolved.stars ?? 0,
    });
    telemetry.emit(`outcome:${kind}`, { gameId, stars: resolved.stars, score: resolved.score });
    audio.play(kind === "success" ? "success" : "fail");
    hooks.onOutcome(kind, resolved);
  };

  return {
    telemetry,
    progress,
    score,
    hints,
    audio,
    outcome: {
      succeed: (detail) => finish("success", detail),
      fail: (detail) => finish("fail", detail),
    },
  };
}
