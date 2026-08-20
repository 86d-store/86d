import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");
const productionRoots = ["apps/store", "modules", "packages"];
const sourceExtensions = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);
const ignoredDirectories = new Set([
	".next",
	"__tests__",
	"dist",
	"node_modules",
]);

function productionSourceFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...productionSourceFiles(path));
		} else if (sourceExtensions.has(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
}

describe("Store Runtime commerce authority containment", () => {
	it("contains no production Control Plane commerce-event egress", () => {
		const violations: string[] = [];

		for (const root of productionRoots) {
			for (const file of productionSourceFiles(join(workspaceRoot, root))) {
				const source = readFileSync(file, "utf8");
				if (/\/store-events\b/.test(source)) {
					violations.push(`${file}: references the removed store-events route`);
				}
				if (/platform-reporter|registerPlatformReporter/.test(source)) {
					violations.push(`${file}: references the removed platform reporter`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
