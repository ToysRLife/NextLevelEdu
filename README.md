# NextLevelEdu

K-12 science learning through interactive games. Students complete missions, earn rewards, and build worlds by mastering science concepts.

## Features

- **100+ games** across four science streams: physics, chemistry, biology, earth & space
- **Code-split architecture** — games load only when played
- **Reward worlds** — learners build structures by earning resources from successful missions
- **Progression gating** — unlock the next level after mastering the current one
- **Cloud sync** — progress saved and synced across devices (Firebase or local demo)
- **Adaptive difficulty** — games tune themselves based on learner performance
- **Badges & streaks** — celebrate achievements and encourage daily play
- **Admin approval** — optional gating for classroom use

## Quick start

### Prerequisites

- **Node.js** 18+ and **Yarn** 1.22+

Check your versions:

```bash
node --version
yarn --version
```

### Installation

```bash
cd NextLevelEdu
yarn install
```

### Development

Start the dev server with hot reload:

```bash
yarn dev
```

Then open `http://localhost:5173`.

### Building for production

```bash
yarn build
```

The bundled app goes into `dist/`.

### Preview production build locally

```bash
yarn preview
```

## Development workflow

### Manifest generation

Before you can see a new game in the dashboard, regenerate the manifest catalog:

```bash
yarn run gen:manifests
```

This reads each game's `meta` and writes `src/games/manifests.ts` (auto-generated — don't edit by hand).

Run this after:

- adding a new game folder
- changing a game's metadata (title, emoji, mission, etc.)

### Type checking

```bash
yarn typecheck
```

Runs TypeScript in check-only mode without building.

### Check solvability

```bash
yarn run check:solvable
```

Verifies that all games are registered and have valid metadata.

## Code standards

We use **ESLint** for code quality and **Prettier** for consistent formatting.

### Linting

Check for code quality issues:

```bash
yarn lint
```

Auto-fix fixable issues:

```bash
yarn lint:fix
```

ESLint is configured in [eslint.config.js](./eslint.config.js) and checks:

- TypeScript type safety with `@typescript-eslint`
- Unused variables (warn if variable name starts with `_`)
- Use of `any` type (warn)
- `console.log` statements (warn in production builds)

### Formatting

Format code with Prettier:

```bash
yarn format
```

Check if code is formatted correctly:

```bash
yarn format:check
```

Prettier configuration is in [.prettierrc](./.prettierrc). We use:

- 2-space indentation
- 100-character line width
- Double quotes for strings
- Trailing commas in multi-line structures

### Pre-commit workflow (recommended)

Before committing, run:

```bash
yarn lint:fix && yarn format && yarn typecheck
```

This ensures consistent code style and catches type errors early.

## Creating a game

1. Create a folder: `src/games/<game-id>/`
2. Create `src/games/<game-id>/index.ts` exporting a `GameModule`:

```typescript
import type { GameModule, GameContext, GameInstance } from "@sdk/types";

class MyGame implements GameInstance {
  constructor(private ctx: GameContext) {}

  start(): void {
    // Called when the game loads
  }

  pause(): void {
    // Optional: pause the game
  }

  resume(): void {
    // Optional: resume the game
  }

  reset(): void {
    // Called when learner clicks restart
  }

  destroy(): void {
    // Clean up: cancel loops, remove listeners
  }
}

export const myGame: GameModule = {
  meta: {
    id: "mygame",
    conceptId: "phys-01",
    title: "My Game",
    stream: "physics",
    gradeBand: "3-5",
    emoji: "🎮",
    blurb: "A short description for the card.",
    mission: "Your mission statement (required).",
    estMinutes: 5,
  },
  create: (ctx) => new MyGame(ctx),
};
```

3. The game receives:
   - `ctx.canvas` — a `<canvas>` element for drawing
   - `ctx.panel` — a `<div>` for custom HTML controls (sliders, buttons, etc.)
   - `ctx.tier` — difficulty: `"junior"`, `"explorer"`, or `"master"`
   - `ctx.services` — platform services (see below)
   - `ctx.savedState` — optional previous game state

4. Signal outcome to the shell:
   - `ctx.services.outcome.succeed()` — learner won
   - `ctx.services.outcome.fail()` — learner did not complete the mission

5. Optionally use platform services:
   - `ctx.services.score.add(points)` — add to the score
   - `ctx.services.hints.setHints([...])` — register hint tiers
   - `ctx.services.progress.save(state)` — persist state for resume
   - `ctx.services.audio.play("click")` — play feedback sounds
   - `ctx.services.audio.tone(freq, durMs)` — play a musical note

6. Regenerate manifests:

   ```bash
   yarn run gen:manifests
   ```

7. Test in dev mode:
   ```bash
   yarn dev
   ```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown of the app structure, layers, and design patterns.

### Key concepts

- **Manifest** — metadata about a game (title, emoji, mission, etc.), used to build the catalog without loading game code
- **Code splitting** — each game's code is bundled separately and loaded on first play
- **Game contract** — a `GameModule` interface that every game implements
- **Platform services** — injected into games so they never touch storage, auth, or analytics directly
- **Progression** — learners advance through levels within each stream; each level has 5 games
- **Worlds** — reward systems where resources earned in games can be spent to build structures

## Cloud & authentication

### Local demo mode (default)

By default, the app saves to the local device only. Users sign in with a name:

```
explorer-name
```

The app stores everything in `nlecloud:` namespaced localStorage.

### Firebase (cross-device sync)

To enable cloud sync across devices:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Set up Firestore and Authentication (Google Sign-In)
3. Add your Firebase config to `src/platform/cloud-config.ts`:

```typescript
export const FIREBASE_CONFIG: Record<string, string> = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "...",
};
```

4. Set up Firestore rules to secure user data and enable admin-approval gating (see `cloud-firebase.ts` for details)

### Admin approval

To require an admin to approve new accounts before they can play:

1. Set up Firebase Authentication and Firestore
2. Define `ADMIN_EMAILS` in `src/platform/cloud-config.ts`
3. Configure a webhook in `SIGNUP_NOTIFY_URL` to email you when a new account signs up
4. Use the in-app admin page (`#/admin`) to approve pending learners

## Customization

### Difficulty levels

Games can adapt to learner skill. When instantiated, the game receives a `tier`:

- `"junior"` — K-2, highly scaffolded
- `"explorer"` — 3-5, moderate support
- `"master"` — 6+, challenging

Adjust game logic based on `ctx.tier`.

### Learner profile

Access the learner's progress and stats via `ctx.services.progress`:

```typescript
const bestScore = ctx.services.progress.bestScore();
const previousState = ctx.services.progress.load<YourStateType>();
```

### Audio feedback

Play predefined sounds:

```typescript
ctx.services.audio.play("success"); // or "fail", "click", "reward", "tick"
```

Or play a musical note:

```typescript
ctx.services.audio.tone(440, 200); // A4, 200ms
```

## Deployment

The app is a static client-side build. Deploy to any static host:

```bash
yarn build
# dist/ is ready to deploy
```

Recommended hosts:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages
- AWS S3 + CloudFront

## Project structure

```
.
├── README.md                   # This file
├── ARCHITECTURE.md             # Detailed architecture guide
├── DEVELOPMENT.md              # Development workflow and best practices
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite build config
├── eslint.config.js           # ESLint config (flat config format)
├── .prettierrc                # Prettier config
├── .prettierignore            # Files to skip formatting
├── yarn.lock             # Locked dependencies
├── index.html                 # HTML entry point
├── src/
│   ├── main.ts               # Bootstrap
│   ├── registry.ts           # Game catalog and loader
│   ├── styles.css            # Global styles
│   ├── core/                 # Utilities: DOM, game loop
│   ├── platform/             # Services: storage, cloud, audio
│   ├── sdk/                  # Shared types
│   ├── shell/                # App UI pages and routing
│   └── games/                # 100+ game modules
├── scripts/
│   ├── gen-manifests.mjs     # Generate manifests from game metadata
│   └── check-solvable.mjs    # Validate game registry
├── content/
│   └── curriculum.json       # Science content and resources
└── public/                   # Static assets
```

## Contributing

1. See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, workflow, and best practices
2. Fork the repository
3. Create a feature branch
4. Make your changes and test locally (`yarn dev`)
5. Ensure code standards:
   - `yarn lint:fix` — fix linting issues
   - `yarn format` — format code
   - `yarn typecheck` — check types
6. If adding a game, run `yarn run gen:manifests`
7. Submit a pull request with a clear description

## License

See [LICENSE](./LICENSE) if present, otherwise all rights reserved.

## Support

For issues or feature requests, open an issue on GitHub.

---

Happy learning! 🚀
