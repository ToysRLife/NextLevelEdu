import { GAME_MANIFESTS } from "./games/manifests";
// The catalog is data-driven and code-split. The dashboard lists games from the
// lightweight GAME_MANIFESTS (pure metadata, see scripts/gen-manifests.mjs).
// Each game's actual code is loaded on demand the first time it's played, so the
// initial bundle stays tiny no matter how many games we add.
export { GAME_MANIFESTS };
// Vite turns each match into its own lazily-loaded chunk.
const loaders = import.meta.glob("./games/*/index.ts");
// Map folder name -> loader. By convention a game's folder name equals its
// meta.id (the generator warns if they ever drift).
const byId = {};
for (const [path, loader] of Object.entries(loaders)) {
    const folder = path.split("/")[2];
    byId[folder] = loader;
}
/** Load (and code-split) a single game's module by id. Null if unknown. */
export async function loadGame(id) {
    const loader = byId[id];
    if (!loader)
        return null;
    const mod = await loader();
    // Each index.ts has exactly one GameModule export; find it without caring
    // about its export name.
    const game = Object.values(mod).find((v) => !!v && typeof v.create === "function" && !!v.meta);
    return game ?? null;
}
