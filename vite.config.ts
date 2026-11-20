import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), alphaTab()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
  },
});
