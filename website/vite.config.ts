import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  publicDir: resolve(import.meta.dirname, "assets"),
  build: {
    outDir: resolve(import.meta.dirname, "../site-dist"),
    emptyOutDir: true,
  },
});
