import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" sólo tiene sentido dentro de Next; en pruebas es un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 30000, hookTimeout: 30000 },
});
