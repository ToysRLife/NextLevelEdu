import type { GameManifest, GameInstance, OutcomeDetail, DifficultyTier } from "@sdk/types";
import { el, clear } from "@core/dom";
import { createServices } from "@platform/services";
import { addJoules, addResources, getLevel, recordPlayToday, recordPerformance } from "./profile";
import { getWorldReward } from "./worlds";
import { checkBadges } from "./badges";
import { loadGame } from "../registry";

// Mounts a single game: builds the host chrome (panel + stage + actions),
// wires platform services, and renders the dual-outcome overlay. The game's
// code is loaded lazily (code-split), so we show a loading state until it's
// ready. Returns a cleanup function the router calls before navigating away.
export function renderGameHost(root: HTMLElement, meta: GameManifest): () => void {

  const canvas = el("canvas", {});
  // The game reads canvas.parentElement for its backdrop, so the wrap is required.
  const canvasWrap = el("div", { class: "canvas-wrap" }, canvas);

  const panel = el("div", { class: "host-panel" });

  const hintPanel = el("div", { class: "hint-panel", style: { display: "none" } });

  const tier: DifficultyTier = getLevel();

  const services = createServices(meta.id, { onOutcome: showOutcome });

  let instance: GameInstance | null = null;

  const hintBtn = el(
    "button",
    {
      class: "btn hint",
      onclick: () => {
        const hint = services.hints.next();
        if (hint) {
          hintPanel.style.display = "block";
          hintPanel.textContent = `💡 ${hint}`;
        } else {
          hintPanel.style.display = "block";
          hintPanel.textContent = "That's every hint — you've got this. Trust what you've learned!";
          hintBtn.setAttribute("disabled", "true");
        }
      },
    },
    "💡 Hint",
  );

  const restartBtn = el(
    "button",
    {
      class: "btn secondary",
      onclick: () => {
        clearOverlay();
        hintPanel.style.display = "none";
        hintBtn.removeAttribute("disabled");
        services.audio.play("click");
        instance?.reset();
      },
    },
    "↻ Restart",
  );

  const backBtn = el(
    "button",
    {
      class: "btn secondary",
      onclick: () => {
        location.hash = "#/";
      },
    },
    "← Missions",
  );

  const actions = el("div", { class: "host-actions" }, hintBtn, restartBtn, backBtn);

  const missionBanner = el(
    "div",
    { class: "mission-banner" },
    el("span", { class: "label" }, "Mission"),
    el("span", {}, meta.mission),
  );

  const stage = el("div", { class: "host-stage" }, missionBanner, canvasWrap, actions, hintPanel);

  const host = el("div", { class: "host" }, panel, stage);

  clear(root);
  root.append(host);

  // Overlay lives inside the canvas wrap so it covers the play surface only.
  function clearOverlay(): void {
    canvasWrap.querySelector(".overlay")?.remove();
  }

  function showOutcome(kind: "success" | "fail", detail: OutcomeDetail): void {
    clearOverlay();
    const success = kind === "success";
    const stars = detail.stars ?? (success ? 3 : 0);

    if (success) {
      const reward = stars * 100 + 50;
      addJoules(reward);
      if (detail.resources) addResources(meta.stream, detail.resources);
      services.audio.play("reward");
    }

    // Progression: count the play for the daily streak, let the difficulty adapt
    // to how it went, and unlock any newly earned badges.
    recordPlayToday();
    recordPerformance({ success, stars, hints: services.hints.count() });
    const newBadges = checkBadges();
    if (newBadges.length) services.audio.play("reward");

    const rewardPills =
      detail.resources && Object.keys(detail.resources).length
        ? el(
            "div",
            { class: "rewards" },
            ...Object.entries(detail.resources).map(([name, amount]) =>
              el("div", { class: "reward-pill" }, `+${amount} ${name}`),
            ),
          )
        : null;

    // Reward-on-the-spot: show the learner's world filling up right here, so the
    // resources they just earned feel like immediate progress toward a build.
    let worldBlock: HTMLElement | null = null;
    const reward = success ? getWorldReward(meta.stream) : null;
    if (reward) {
      if (reward.complete) {
        worldBlock = el("div", { class: "win-world done" }, `${reward.emoji} ${reward.name} is complete! 🎉`);
      } else if (reward.next) {
        const n = reward.next;
        const bars = Object.entries(n.cost).map(([name, amt]) => {
          const cur = n.have[name] ?? 0;
          const p = Math.min(100, Math.round((cur / amt) * 100));
          return el(
            "div",
            { class: "res-row" },
            el("span", { class: "res-name" }, name),
            el("div", { class: "res-bar" }, el("div", { class: `res-fill ${cur >= amt ? "full" : ""}`, style: { width: `${p}%` } })),
            el("span", { class: "res-num" }, `${cur}/${amt}`),
          );
        });
        worldBlock = el(
          "div",
          { class: `win-world ${n.affordable ? "ready" : ""}` },
          el("div", { class: "win-world-head" }, `${reward.emoji} ${reward.name}`),
          el("div", { class: "win-world-next" }, n.affordable ? `Ready to build: ${n.emoji} ${n.name}!` : `Next: ${n.emoji} ${n.name}`),
          ...bars,
        );
      }
    }

    // 1-card concept recap — what the learner just discovered.
    const recapBlock =
      success && meta.takeaway
        ? el("div", { class: "win-recap" }, el("span", { class: "recap-label" }, "💡 You discovered"), el("span", {}, meta.takeaway))
        : null;

    // Newly unlocked badges.
    const badgeBlock = newBadges.length
      ? el(
          "div",
          { class: "win-badges" },
          el("div", { class: "wb-title" }, newBadges.length > 1 ? "🏅 New badges!" : "🏅 New badge!"),
          el(
            "div",
            { class: "wb-row" },
            ...newBadges.map((b) => el("div", { class: "wb-badge", title: b.desc }, el("span", { class: "wb-emoji" }, b.emoji), el("span", {}, b.title))),
          ),
        )
      : null;

    const card = el(
      "div",
      { class: `outcome-card ${success ? "success" : "fail"}` },
      el("div", { class: "outcome-emoji" }, success ? "🎉" : "💪"),
      el("h2", {}, success ? "Mission Complete!" : "Not quite — try again!"),
      success ? el("div", { class: "stars" }, "⭐".repeat(stars) + "☆".repeat(3 - stars)) : null,
      el("p", {}, detail.message ?? (success ? "Brilliant work!" : "Every scientist learns by trying again.")),
      recapBlock,
      rewardPills,
      worldBlock,
      badgeBlock,
      el(
        "div",
        { class: "outcome-actions" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              clearOverlay();
              hintPanel.style.display = "none";
              hintBtn.removeAttribute("disabled");
              instance?.reset();
            },
          },
          success ? "Play Again" : "Retry",
        ),
        success
          ? el(
              "button",
              {
                class: "btn world",
                onclick: () => {
                  location.hash = `#/world/${meta.stream}`;
                },
              },
              reward?.next?.affordable ? `🔨 Build the ${reward.next.name}!` : "🏗️ Build your world",
            )
          : null,
        el(
          "button",
          {
            class: "btn secondary",
            onclick: () => {
              location.hash = "#/";
            },
          },
          "Missions",
        ),
      ),
    );

    canvasWrap.append(el("div", { class: "overlay" }, card));
  }

  // Loading state while the game's code chunk downloads.
  let cancelled = false;
  const loadingOverlay = el(
    "div",
    { class: "overlay" },
    el("div", { class: "outcome-card" }, el("div", { class: "outcome-emoji" }, "⏳"), el("p", {}, "Loading…")),
  );
  canvasWrap.append(loadingOverlay);

  loadGame(meta.id)
    .then((game) => {
      if (cancelled) return;
      loadingOverlay.remove();
      if (!game) {
        location.hash = "#/";
        return;
      }
      instance = game.create({ canvas, panel, tier, services });
      instance.start();
    })
    .catch(() => {
      if (cancelled) return;
      loadingOverlay.querySelector("p")!.textContent = "Couldn't load this game. Go back and try again.";
    });

  return () => {
    cancelled = true;
    instance?.destroy();
    instance = null;
  };
}
