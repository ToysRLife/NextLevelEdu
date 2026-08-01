# NextLevelEdu Architecture Reference

## Overview

NextLevelEdu is a browser-first education game platform built with Vite and TypeScript. It is designed as a single-page application with a lightweight shell and a data-driven, code-split game catalog.

The key architectural goals are:

- fast initial load by lazy-loading games on demand
- a consistent game contract so each lesson is isolated
- simple persistence with localStorage plus an abstract cloud sync layer
- an app shell that manages routing, account state, and reward systems
- no UI framework, using a minimal hyperscript helper instead

## High-level flow

1. `src/main.ts` loads global styles and mounts the app.
2. `src/shell/app.ts` initializes cloud sync, auth listeners, and routing.
3. The app enforces three gates:
   - sign in
   - admin approval
   - onboarding persona setup
4. The dashboard and pages render from `src/shell/*`.
5. The game catalog is defined by `src/games/manifests.ts`.
6. `src/registry.ts` lazily imports `src/games/*/index.ts` modules via Vite's `import.meta.glob`.
7. Loaded games are instantiated through the `GameModule` contract from `src/sdk/types.ts`.
8. Platform services are injected into each game via `src/platform/services.ts`.
9. Local persistence uses `src/platform/storage.ts` and syncs through `src/platform/cloud.ts`.
10. Outcomes update progression, buckets, shows overlays, and awards rewards.

## Core layers

### App shell (`src/shell/`)

Responsible for UI pages, navigation, progression, and reward worlds.

Key modules:

- `app.ts` — application bootstrap, routing, event wiring
- `dashboard.ts` — mission catalog and shelf rendering
- `gameHost.ts` — mount point for a single game, overlays, hints, outcomes
- `progression.ts` — unlock logic, stream-level gating, difficulty grouping
- `profile.ts` — persona, favorites, recent games, joules, streaks, resources
- `worlds.ts` — reward world overview and spend/build screen
- `badges.ts` — badge rules and earned-state tracking
- `loginGate.ts`, `pendingApproval.ts`, `onboarding.ts`, `cloudPage.ts`, `adminPage.ts`

### Game registry (`src/registry.ts`)

- Exports the lightweight manifest catalog from `src/games/manifests.ts`.
- Uses `import.meta.glob` to discover game entry modules and code-split them.
- Exposes `loadGame(id)` to dynamically load a game by id.

### Game contract (`src/sdk/types.ts`)

Defines the shared interface between shell and games:

- `GameManifest`
- `GameContext`
- `GameInstance`
- `GameModule`
- platform services: outcome, score, hints, progress, telemetry, audio

### Platform services (`src/platform/`)

Manages app-level services and storage.

Key modules:

- `storage.ts` — namespaced localStorage access, snapshot/restore, mutation timestamps, write events
- `services.ts` — per-game services, outcome finalization, telemetry stubs
- `audio.ts` — mute state, oscillator-based sound effects, note playback
- `cloud.ts` — abstract sync engine coordinating cloud provider and local state
- `cloud-local.ts` — demo/local cloud provider implementation
- `cloud-config.ts` — provider selection and Firebase config switch

### Core utilities (`src/core/`)

Small shared utilities for DOM and game loops.

- `dom.ts` — `el()` hyperscript builder and `clear()` helper
- `loop.ts` — `SimLoop` wrapper around `requestAnimationFrame`

## Game architecture

Each game lives in `src/games/<game-id>/index.ts`. A game module must export a `GameModule` object with:

- `meta` — manifest metadata
- `create(ctx: GameContext): GameInstance` — factory creating the game instance

Games receive:

- `canvas` and `panel` DOM elements
- `tier` for adaptive difficulty
- optional `savedState`
- `services` for outcome, score, hints, progress, telemetry, audio

The shell controls the lifecycle:

- calls `instance.start()` after loading
- uses cleanup to `destroy()` when leaving the game
- handles retries, hints, restart, and navigation

## Routing and navigation

The app uses hash routing:

- `#/` — dashboard
- `#/play/:id` — play a game
- `#/worlds` — world overview
- `#/world/:stream` — single world
- `#/badges` — trophies
- `#/account` — cloud account
- `#/admin` — admin tools

The router re-renders on `hashchange` and several app events.

## Persistence and cloud

The app's persistence model is local-first:

- all app state is stored in localStorage under `nle:`
- writes update a mutation timestamp
- cloud sync pushes snapshots after debounced local changes
- cloud merge supports both sign-in and resume flows
- approval gate is supported through provider account status

The local provider is a full demo backend on the same client.

## Recommended improvements

These are the most valuable areas for next engineering work:

- add a small `README.md` or `CONTRIBUTING.md` explaining dev setup and game manifest generation
- centralize route definitions for easier maintenance
- add unit tests around progression rules and storage helpers
- consider extracting repeated overlay UI into reusable helpers
- add `vite-plugin-checker` or a test harness if you want stronger developer feedback

## Vite vs Next.js for this repo

### Recommendation

**Keep Vite.** This repository is a client-side, interactive game platform where most logic runs in the browser and each game is loaded lazily. Vite is a good fit because it:

- supports fast development feedback and HMR
- makes code splitting easy with `import.meta.glob`
- builds small static assets
- does not impose server-side rendering or React conventions
- is simpler and more appropriate for a game-like app with a custom DOM layer

### When to consider Next.js

Move to Next.js only if you need one or more of these:

- server-side rendering or SEO for public landing/content pages
- a shared React component architecture across shell and content
- a CMS-driven marketing site or blog integrated with the app
- built-in app routing and API routes for server-side logic

### Why Vite is better here

- the app is already designed as a single-page client engine
- there is no React dependency or JSX in the current codebase
- page routing is lightweight and hash-based, which fits a static client app
- the game contract and dynamic game loading are naturally supported by Vite

### When Next.js might be okay

If the product evolves into a hybrid site with server-side landing pages, user-auth pages, or a React-based dashboard, then Next.js could be appropriate. But that would be a larger rewrite rather than a simple migration.

## Practical next steps

- keep the existing Vite architecture for now
- add `README.md` and architecture docs
- optionally add a `src/docs/ARCHITECTURE.md` or `docs/architecture.md` if you want more internal documentation
- if you need cross-device auth + backend, keep the current cloud abstraction and wire Firebase or another provider

---

## File responsibilities cheat sheet

- `src/main.ts` — bootstrap entrypoint
- `src/registry.ts` — game catalog and code-split loader
- `src/sdk/types.ts` — shared game contract types
- `src/platform/*` — persistence, audio, services, cloud sync
- `src/core/*` — DOM and loop utilities
- `src/shell/*` — UI pages, navigation, progression, worlds, badges
- `src/games/*` — individual game modules
