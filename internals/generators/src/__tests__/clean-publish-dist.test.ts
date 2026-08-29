import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanPublishableDist } from "../clean-publish-dist";

const repositoryRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
);

function writePackage(
	root: string,
	relativeDirectory: string,
	options: {
		name: string;
		private?: boolean;
		build?: string;
		files?: string[];
	},
) {
	const directory = join(root, relativeDirectory);
	mkdirSync(join(directory, "dist"), { recursive: true });
	writeFileSync(
		join(directory, "package.json"),
		`${JSON.stringify({
			name: options.name,
			...(options.private === undefined ? {} : { private: options.private }),
			files: options.files ?? ["dist"],
			scripts: { build: options.build ?? "tsc" },
		})}\n`,
	);
	writeFileSync(join(directory, "dist", "current.js"), "export {};\n");
	writeFileSync(join(directory, "dist", "withdrawn.js"), "export {};\n");
	return directory;
}

describe("clean publish output", () => {
	let fixtureRoot: string;

	beforeEach(() => {
		fixtureRoot = mkdtempSync(join(tmpdir(), "86d-clean-publish-dist-"));
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it("removes every public dist before a cache restore without touching private workspaces", () => {
		const moduleDirectory = writePackage(fixtureRoot, "modules/checkout", {
			name: "@86d-app/checkout",
		});
		const packageDirectory = writePackage(fixtureRoot, "packages/cli", {
			name: "86d",
		});
		const privateDirectory = writePackage(fixtureRoot, "apps/store", {
			name: "store",
			private: true,
		});

		expect(cleanPublishableDist(fixtureRoot)).toEqual([
			"86d",
			"@86d-app/checkout",
		]);
		expect(existsSync(join(moduleDirectory, "dist"))).toBe(false);
		expect(existsSync(join(packageDirectory, "dist"))).toBe(false);
		expect(existsSync(join(privateDirectory, "dist", "withdrawn.js"))).toBe(
			true,
		);

		// A Turbo cache hit restores only its archive entries. Starting from an
		// empty directory keeps withdrawn output absent after that restoration.
		mkdirSync(join(moduleDirectory, "dist"), { recursive: true });
		writeFileSync(join(moduleDirectory, "dist", "current.js"), "export {};\n");
		expect(existsSync(join(moduleDirectory, "dist", "withdrawn.js"))).toBe(
			false,
		);
	});

	it("validates the entire public set before deleting any output", () => {
		const validDirectory = writePackage(fixtureRoot, "modules/checkout", {
			name: "@86d-app/checkout",
		});
		writePackage(fixtureRoot, "modules/malformed", {
			name: "@86d-app/malformed",
			files: ["README.md"],
		});

		expect(() => cleanPublishableDist(fixtureRoot)).toThrow(
			/publishable package must list "dist" in files/,
		);
		expect(existsSync(join(validDirectory, "dist", "withdrawn.js"))).toBe(true);
	});

	it("keeps the release clean and forced before its cacheable build", () => {
		const pkg = JSON.parse(
			readFileSync(join(repositoryRoot, "package.json"), "utf8"),
		) as { scripts: Record<string, string> };
		expect(pkg.scripts["clean:publish-dist"]).toBe(
			"tsx internals/generators/src/clean-publish-dist.ts",
		);
		expect(pkg.scripts.release).toMatch(
			/^bun run clean:publish-dist && turbo run build --force /,
		);
	});

	it("executes its tsx entrypoint on the supported Node-compatible path", () => {
		const result = spawnSync(
			"bunx",
			[
				"tsx",
				join(repositoryRoot, "internals/generators/src/clean-publish-dist.ts"),
				"--check",
			],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
				shell: process.platform === "win32",
			},
		);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toMatch(
			/^Validated publish output for \d+ packages\.\n$/,
		);
	});
});
