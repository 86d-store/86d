import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function workspaceProjects(...roots: string[]): string[] {
	return roots.flatMap((root) =>
		readdirSync(join(workspaceRoot, root), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => `${root}/${entry.name}`),
	);
}

export default defineConfig({
	root: workspaceRoot,
	test: {
		exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
		projects: workspaceProjects("apps", "packages", "modules"),
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			reportsDirectory: "./coverage",
			thresholds: {
				lines: 70,
				branches: 60,
			},
		},
	},
});
