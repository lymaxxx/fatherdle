import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // The scoring tests are written around the 4-player qualification rule used by the demo league.
    env: { FATHERDLE_DEMO: "1" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
