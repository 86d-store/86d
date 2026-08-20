import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// `dist/` holds compiled copies of these same tests. Running them twice
		// double-counts results and resolves fixture paths from the wrong root.
		exclude: ["**/node_modules/**", "**/dist/**"],
	},
});
