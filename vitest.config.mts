import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Integration tests read DATABASE_URL from here and skip themselves if it
    // is absent, so `pnpm test` works on a machine with no Neon access.
    env: { NODE_ENV: "test" },
    setupFiles: ["./tests/setup.ts"],
  },
});
