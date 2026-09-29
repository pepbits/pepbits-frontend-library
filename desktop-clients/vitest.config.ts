import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Component tests.
 *
 * These render a component and assert what a READER ends up with. That is the
 * whole class of bug the verify:* scripts structurally cannot reach: they check
 * rules by reading files and calling functions, and none of them render
 * anything, so "it compiles and is wrong on screen" was invisible.
 *
 * Scoped to packages/ deliberately. Screens change shape constantly and tests
 * over them mostly assert this week's layout; the shared components underneath
 * are the ones every screen depends on, where a break is invisible until it is
 * everywhere.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Keep component renders and local HTTP integration runners within host capacity.
    maxWorkers: 4,
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/**/*.test.{ts,tsx}", "apps/desktop/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
});
