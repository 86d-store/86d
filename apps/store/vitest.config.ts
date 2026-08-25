import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: ["**/node_modules/**", "**/dist/**"],
		environment: "node",
		include: ["lib/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"~": resolve(import.meta.dirname, "./"),
			"~/": resolve(import.meta.dirname, "./"),
			"lib/": resolve(import.meta.dirname, "../../packages/lib/src/"),
			utils: resolve(import.meta.dirname, "../../packages/utils/src"),
		},
	},
});
