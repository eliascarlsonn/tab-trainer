import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab-vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), alphaTab()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // alphaTab's core is a single ~1.2 MB module; it is already split out and lazy-loaded with the player.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: "node",
  },
});
