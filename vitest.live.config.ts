import { defineConfig } from "vitest/config";

// Hits the real version APIs. Run with `npm run test:live`; never part of the default suite.
export default defineConfig({
  test: {
    include: ["test/live/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
