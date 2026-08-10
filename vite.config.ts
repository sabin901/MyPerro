import { defineConfig } from "vite";
import { resolve } from "path";

const rootDir = import.meta.dirname;

export default defineConfig({
  root: "src",
  publicDir: resolve(rootDir, "art"),
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    outDir: resolve(rootDir, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        pet: resolve(rootDir, "src/index.html"),
        settings: resolve(rootDir, "src/settings.html"),
        demo: resolve(rootDir, "src/demo.html"),
      },
      // The settings window entry (/settings/main.ts) is referenced from
      // settings.html, so Vite discovers it automatically.
    },
  },
});
