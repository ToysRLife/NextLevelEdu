import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Relative base so the static build works on GitHub Pages, Cloudflare Pages, or any subpath.
export default defineConfig({
  base: "./",
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@sdk": fileURLToPath(new URL("./src/sdk", import.meta.url)),
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@platform": fileURLToPath(new URL("./src/platform", import.meta.url)),
      "@shell": fileURLToPath(new URL("./src/shell", import.meta.url)),
      "@games": fileURLToPath(new URL("./src/games", import.meta.url)),
    },
  },
});
