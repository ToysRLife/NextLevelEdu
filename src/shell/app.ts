import { el, clear } from "@core/dom";
import { getPersona, getJoules, rankForJoules, hasPersona, getStreak } from "./profile";
import { renderDashboard } from "./dashboard";
import { renderGameHost } from "./gameHost";
import { renderWorlds, renderWorld } from "./worlds";
import { renderBadges } from "./badgesPage";
import { renderCloud } from "./cloudPage";
import { renderOnboarding } from "./onboarding";
import { renderLoginGate } from "./loginGate";
import { GAME_MANIFESTS } from "../registry";
import { createAudioService } from "@platform/audio";
import { cloud } from "@platform/cloud";

const audio = createAudioService();

const PLAY_ROUTE = /^#\/play\/([\w-]+)$/;
const WORLD_ROUTE = /^#\/world\/([\w-]+)$/;

let mountController: AbortController | null = null;
let authWired = false;
let wasSignedIn: boolean | null = null;

export function mountApp(root: HTMLElement): void {
  const c = cloud(); // initialise the sync engine (resumes a saved session)

  // Re-mount on auth transitions. Wired exactly once; routine sync events are
  // ignored. Sign-OUT re-mounts immediately (show the gate). Sign-IN waits for
  // "cloud-ready" — fired only after the cloud data is restored — so a
  // returning user lands in the app with their persona, not on onboarding.
  if (!authWired) {
    authWired = true;
    window.addEventListener("cloud-changed", () => {
      if (!cloud().getUser() && wasSignedIn) mountApp(root);
    });
    window.addEventListener("cloud-ready", () => mountApp(root));
  }
  wasSignedIn = !!c.getUser();

  // Tear down the previous mount's listeners so re-mounting can't stack them.
  mountController?.abort();
  mountController = new AbortController();
  const signal = mountController.signal;

  // Gate 1: must be signed in — no games, worlds, or trophies without an account.
  if (!c.getUser()) {
    renderLoginGate(root);
    return;
  }

  // Gate 2: signed in but no explorer persona yet — pick an alias + avatar.
  if (!hasPersona()) {
    renderOnboarding(root, () => mountApp(root));
    return;
  }

  let cleanup: (() => void) | null = null;

  const view = el("div", {});
  const refreshNav = () => mountNav(root, view);

  function route(): void {
    cleanup?.();
    cleanup = null;
    clear(view);

    const play = PLAY_ROUTE.exec(location.hash);
    if (play) {
      const meta = GAME_MANIFESTS.find((m) => m.id === play[1]);
      if (meta) {
        cleanup = renderGameHost(view, meta);
      } else {
        location.hash = "#/";
      }
      return;
    }

    const world = WORLD_ROUTE.exec(location.hash);
    if (world) {
      renderWorld(view, world[1]);
      return;
    }

    if (location.hash === "#/worlds") {
      renderWorlds(view);
      return;
    }

    if (location.hash === "#/badges") {
      renderBadges(view);
      return;
    }

    if (location.hash === "#/account") {
      renderCloud(view);
      return;
    }

    renderDashboard(view);
  }

  window.addEventListener("hashchange", route, { signal });
  window.addEventListener("joules-changed", refreshStats, { signal });
  window.addEventListener("streak-changed", refreshStats, { signal });
  window.addEventListener("badges-changed", () => {
    if (location.hash === "#/badges") renderBadges(view);
  }, { signal });
  window.addEventListener("persona-changed", refreshNav, { signal });
  // Cloud sync: a pull rewrites local state, so refresh everything; a status
  // change just updates the nav chip and the account page if open.
  window.addEventListener("cloud-synced", () => {
    refreshNav();
    route();
  }, { signal });
  window.addEventListener("cloud-changed", () => {
    refreshStats();
    if (location.hash === "#/account") renderCloud(view);
  }, { signal });
  // A single-world view re-renders itself on build; the overview needs a nudge.
  window.addEventListener("resources-changed", () => {
    if (location.hash === "#/worlds") renderWorlds(view);
  }, { signal });

  refreshNav();
  route();
}

let joulesEl: HTMLElement | null = null;
let rankEl: HTMLElement | null = null;
let streakEl: HTMLElement | null = null;

function mountNav(root: HTMLElement, view: HTMLElement): void {
  const persona = getPersona();
  const joules = getJoules();
  const streak = getStreak();
  joulesEl = el("span", { id: "joules-val", class: "joules" }, `⚡ ${joules}`);
  rankEl = el("span", {}, rankForJoules(joules));
  streakEl = el("span", { class: "joules streak", title: "Day streak" }, `🔥 ${streak.current}`);

  const nav = el(
    "nav",
    {},
    el("div", { class: "nav-brand", onclick: () => (location.hash = "#/") }, "NextLevel ", el("span", {}, "Edu")),
    el(
      "div",
      { class: "nav-links" },
      el("button", { class: "nav-link", onclick: () => (location.hash = "#/") }, "🎯 Missions"),
      el("button", { class: "nav-link", onclick: () => (location.hash = "#/worlds") }, "🏗️ Worlds"),
      el("button", { class: "nav-link", onclick: () => (location.hash = "#/badges") }, "🏅 Trophies"),
      cloudBtn(),
      muteBtn(),
    ),
    el(
      "div",
      { class: "persona" },
      streakEl,
      joulesEl,
      el("div", { class: "persona-avatar" }, persona.emoji),
      el("div", { class: "persona-meta" }, el("strong", {}, persona.alias), rankEl),
    ),
  );

  clear(root);
  root.append(nav, view);
}

let cloudEl: HTMLElement | null = null;
function cloudLabel(): string {
  const c = cloud();
  if (!c.getUser()) return "☁️ Sign in";
  const s = c.getStatus();
  return s === "syncing" ? "🔄 Syncing" : s === "error" ? "☁️ Offline" : "☁️ Saved";
}
function cloudBtn(): HTMLElement {
  cloudEl = el("button", { class: "nav-link", title: "Cloud save", onclick: () => (location.hash = "#/account") }, cloudLabel());
  return cloudEl;
}

function muteBtn(): HTMLElement {
  const btn = el("button", { class: "nav-link", title: "Sound on/off" }, audio.isMuted() ? "🔇 Sound" : "🔊 Sound");
  btn.onclick = () => {
    const next = !audio.isMuted();
    audio.setMuted(next);
    btn.textContent = next ? "🔇 Sound" : "🔊 Sound";
    if (!next) audio.play("click");
  };
  return btn;
}

function refreshStats(): void {
  const joules = getJoules();
  if (joulesEl) joulesEl.textContent = `⚡ ${joules}`;
  if (rankEl) rankEl.textContent = rankForJoules(joules);
  if (streakEl) streakEl.textContent = `🔥 ${getStreak().current}`;
  if (cloudEl) cloudEl.textContent = cloudLabel();
}
