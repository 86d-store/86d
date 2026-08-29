import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

type ExportTarget = string | { default?: string; types?: string };

const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
	publishConfig?: { exports?: Record<string, ExportTarget> };
};

const publicJavaScriptEntries = Object.values(
	pkg.publishConfig?.exports ?? {},
).flatMap((target) => {
	if (typeof target === "string") return [];
	if (!target.default?.endsWith(".js") || target.default.includes("*")) {
		return [];
	}
	return [pathToFileURL(join(pkgRoot, target.default)).href];
});

describe("@86d-app/ui built exports", () => {
	beforeAll(() => {
		const build = spawnSync("bun", ["run", "build"], {
			cwd: pkgRoot,
			encoding: "utf8",
		});
		expect(build.status, build.stderr || build.stdout).toBe(0);
	}, 60_000);

	it("loads every explicit public JavaScript entry with Node ESM", () => {
		const source = `await Promise.all(${JSON.stringify(
			publicJavaScriptEntries,
		)}.map((entry) => import(entry)));`;
		const imported = spawnSync(
			"node",
			["--input-type=module", "--eval", source],
			{
				cwd: pkgRoot,
				encoding: "utf8",
			},
		);

		expect(imported.status, imported.stderr || imported.stdout).toBe(0);
	});
});
