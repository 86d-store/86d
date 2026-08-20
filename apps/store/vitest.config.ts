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
			"~": resolve(__dirname, "./"),
			"~/": resolve(__dirname, "./"),
			"lib/": resolve(__dirname, "../../packages/lib/src/"),
			utils: resolve(__dirname, "../../packages/utils/src"),
		},
	},
});
