import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs,jsx}"],
    globalSetup: ["tests/setup/global.mjs"],
    setupFiles: ["tests/setup/env.mjs"],
    testTimeout: 20000,
    hookTimeout: 120000, // first run downloads the MongoDB binary
  },
});
