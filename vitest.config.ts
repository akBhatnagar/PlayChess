import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/chess-core", "packages/theme-config", "packages/validation", "apps/api", "apps/web"],
  },
});
