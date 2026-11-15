import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000 },
});
