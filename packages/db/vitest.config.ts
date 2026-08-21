import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Without this the suite collects the compiled copies under dist/ and runs
		// every test twice, the stale copy included.
		exclude: ["**/node_modules/**", "**/dist/**"],
		environment: "node",
		// PGlite cold-start + multi-statement migrations exceed the default 5s in CI.
		testTimeout: 30_000,
	},
});
