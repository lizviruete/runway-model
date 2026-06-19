import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/engine/**/*.ts"],
      exclude: ["lib/engine/index.ts", "lib/engine/types.ts"],
    },
  },
});
