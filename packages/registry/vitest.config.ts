import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: ["**/node_modules/**", "**/dist/**"],
		include: ["src/__tests__/**/*.test.ts"],
	},
});
