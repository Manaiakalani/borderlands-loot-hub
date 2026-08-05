import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Strip shebang lines so Rolldown can parse CLI scripts imported by tests. */
function stripShebang() {
  return {
    name: "strip-shebang",
    transform(code: string, id: string) {
      if (id.includes("scripts/") && code.startsWith("#!")) {
        return code.replace(/^#![^\n]*\n/, "");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), stripShebang()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(rootDir, "./src") },
  },
});
