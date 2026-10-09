import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/live/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/cli.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
