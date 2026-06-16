# Development Guide

This guide covers development workflow, code standards, and best practices for NextLevelEdu.

## Prerequisites

- **Node.js** 18+
- **Yarn** 1.22+ (Classic)
- **Visual Studio Code** (recommended) with:
  - ESLint extension (`dbaeumer.vscode-eslint`)
  - Prettier extension (`esbenp.prettier-vscode`)

## Development Setup

### Install dependencies

```bash
cd NextLevelEdu
yarn install
```

### Start dev server

```bash
yarn dev
```

Opens at `http://localhost:3000` with hot module reload (HMR).

## Code Standards

### Type Safety

- **TypeScript strict mode** enabled (`tsconfig.json`)
- All public APIs require type annotations
- Avoid `any` type; use `unknown` with type guards instead
- Import types explicitly: `import type { GameModule } from "@sdk/types"`

### ESLint Rules

Run before committing:

```bash
yarn lint:fix
```

Configuration: [eslint.config.js](./eslint.config.js) (ESLint 9 flat config format)

Key rules:

- No unused variables (prefix with `_` to suppress)
- No `console.log` in production code (use for debugging only)
- Prefer `const`, then `let`, avoid `var`
- No `@ts-ignore` comments without explanation

### Prettier Formatting

Format all code:

```bash
yarn format
```

Settings:

- **Indentation**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Double quotes (`"`)
- **Semicolons**: Required
- **Trailing commas**: ES5 (trailing in objects/arrays, not in function params)

### Code Organization

```
src/
├── main.ts                 # App entry point
├── registry.ts             # Game loading
├── sdk/                    # Shared game contract
├── core/                   # Reusable utilities
├── games/                  # 100+ game implementations
├── shell/                  # App shell (routing, UI)
└── platform/               # Cloud, storage, audio
```

Each module should:

- Have a single responsibility
- Export only public APIs
- Use path aliases (`@sdk`, `@core`, etc.)
- Include JSDoc comments for functions

## Git Workflow

### Before committing

```bash
# Lint and auto-fix
yarn lint:fix

# Format code
yarn format

# Type check
yarn typecheck

# Run checks
yarn run check:solvable
```

### Commit message format

- Use present tense: "Add feature" not "Added feature"
- Reference game IDs: "fix: crystals game crashes on reset"
- Start with type: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

Example: `feat: add hint system to thermometer game`

## Game Development

### Creating a new game

1. Create folder: `src/games/<game-id>/`
2. Create `index.ts` with `GameModule` export
3. Optional sub-files for large games:
   - `engine.ts` — game logic
   - `ui.ts` — rendering/canvas code
   - `state.ts` — game state type definitions

### Game template

```typescript
import type { GameModule, GameContext, GameInstance } from "@sdk/types";

class MyGame implements GameInstance {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(private gameCtx: GameContext) {
    this.canvas = gameCtx.canvas;
    this.ctx = this.canvas.getContext("2d")!;
  }

  start(): void {
    // Initialize game state
    // Set up event listeners
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  pause(): void {
    // Pause game, stop loops
  }

  resume(): void {
    // Resume game
  }

  reset(): void {
    // Clear canvas and reset to initial state
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    // Clean up: remove listeners, cancel animations
  }
}

export const myGame: GameModule = {
  meta: {
    id: "mygame",
    conceptId: "phys-001",
    title: "My Game",
    emoji: "🎮",
    stream: "physics",
    gradeBand: "3-5",
    blurb: "Short description for dashboard card",
    mission: "Learn how to solve the problem",
    estMinutes: 5,
  },
  create: (ctx) => new MyGame(ctx),
};
```

### Game lifecycle

1. **create**: Constructor runs, receives `GameContext`
2. **start**: Game mounted in DOM, initialize
3. **pause/resume**: User paused/resumed (optional)
4. **reset**: User clicked restart button
5. **destroy**: Game unmounted, clean up

### Platform services

Games receive `ctx.services`:

- `outcome.succeed()` — Mark mission complete
- `outcome.fail()` — Mark mission failed
- `score.add(points)` — Award points
- `hints.setHints([tier1, tier2, tier3])` — Register hints
- `progress.save(state)` — Persist game state for resume
- `progress.load()` — Load previous state (if resume)
- `audio.play(sound)` — Play predefined sound
- `audio.tone(freq, durMs)` — Play musical note
- `telemetry.event(name, data)` — Log custom events

### Updating manifests

After creating/modifying a game:

```bash
yarn run gen:manifests
yarn lint:fix src/games/manifests.ts  # Auto-fix formatting
```

**Note**: `src/games/manifests.ts` is auto-generated. Never edit by hand.

## Build & Deployment

### Local preview

```bash
yarn build
yarn preview
```

### Production build

```bash
yarn build
```

Output: `dist/` — ready for GitHub Pages, Cloudflare Pages, or any static host.

Build steps:

1. Run `gen:manifests` to ensure game catalog is current
2. Run `check:solvable` to validate all games
3. Type check with `tsc --noEmit`
4. Bundle with Vite

### Environment variables

None required for local development.

For Firebase:

- Configure `src/platform/cloud-config.ts`
- Set Firebase config and admin emails
- Deploy Firestore rules (see `cloud-firebase.ts`)

## Debugging

### Chrome DevTools

1. Open `http://localhost:3000`
2. Press `F12` for DevTools
3. **Console**: Check for errors
4. **Network**: Monitor asset loading
5. **Performance**: Profile slow games
6. **Storage**: Inspect `nle:*` localStorage entries

### VS Code debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

Then press `F5` to debug.

### Common issues

**Game doesn't appear in dashboard**

- Did you run `yarn run gen:manifests`?
- Check console for import errors
- Verify `GameModule` export name

**Type errors**

- Run `yarn typecheck` for full report
- Check `tsconfig.json` path aliases
- Verify imports use `import type` for types

**Lint errors**

- Run `yarn lint:fix` to auto-fix
- Some rules require manual fixes (check output)
- Suppress with `/* eslint-disable rule-name */` if necessary (document why)

## Performance

### Code splitting

Games are code-split automatically via `import.meta.glob()` in `registry.ts`. Each game loads only when first played.

### Bundle analysis

```bash
yarn build
# Check dist/ folder size
# Use https://webpack.github.io/analyse/ to analyze (if using Vite analysis plugin)
```

### Canvas optimization

- Clear canvas only when needed
- Use `requestAnimationFrame` for smooth loops
- Avoid allocating objects in animation loops (use object pooling for particles, etc.)

## Resources

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/guide/
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Firebase**: https://firebase.google.com/docs/web/setup
- **ESLint**: https://eslint.org/docs/rules/
- **Prettier**: https://prettier.io/docs/en/index.html

## Contributing

1. Fork and branch from `main`
2. Follow code standards (lint, format, typecheck)
3. Add/update games in `src/games/`
4. Regenerate manifests
5. Test locally: `yarn dev`
6. Submit pull request with clear description

## License

See [LICENSE](./LICENSE) file.
