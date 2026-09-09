import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execPath, platform } from "node:process";
import { computeSubtreeIntegrity } from "@86d-app/registry/integrity";
import { registryManifestSchema } from "@86d-app/registry/types";
import { getProcessEnv } from "env/process-env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const GENERATOR = "apps/registry/src/generate-manifest.ts";
const MODULE_SOURCE = "modules/example/src/index.ts";
const MANIFEST_PATH = "apps/registry/registry.json";
const LOCAL_MANIFEST_PATH = ".86d/registry.local.json";

function fixtureEnvironment(): Record<string, string> {
	const environment: Record<string, string> = {
		PATH: getProcessEnv("PATH") ?? "",
	};
	if (platform === "win32") {
		for (const variable of ["PATHEXT", "ComSpec", "SystemRoot"]) {
			const value = getProcessEnv(variable);
			if (value) environment[variable] = value;
		}
	}
	return environment;
}

function git(fixtureRoot: string, args: string[]): string {
	return execFileSync(
		"git",
		[
			"-c",
			"user.name=Registry fixture",
			"-c",
			"user.email=registry-fixture@example.test",
			"-c",
			"commit.gpgSign=false",
			...args,
		],
		{ cwd: fixtureRoot, encoding: "utf8", env: fixtureEnvironment() },
	).trim();
}

function commitSources(fixtureRoot: string): string {
	git(fixtureRoot, ["add", "--", "package.json", "modules", "templates"]);
	git(fixtureRoot, [
		"commit",
		"--quiet",
		"-m",
		"test(registry): record fixture",
	]);
	return git(fixtureRoot, ["rev-parse", "HEAD"]);
}

function writeFixtureFile(root: string, path: string, contents: string): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), contents);
}

function writeModule(root: string, version: string): void {
	writeFixtureFile(
		root,
		MODULE_SOURCE,
		`export default function example() {
	return { id: "example", version: ${JSON.stringify(version)}, storage: { kind: "none" }, endpoints: {} };
}\n`,
	);
}

function runGenerator(fixtureRoot: string, args: string[] = []) {
	return spawnSync(execPath, [TSX_CLI, join(fixtureRoot, GENERATOR), ...args], {
		cwd: fixtureRoot,
		encoding: "utf8",
		env: fixtureEnvironment(),
	});
}

function readManifest(fixtureRoot: string, path = MANIFEST_PATH) {
	const parsed: unknown = JSON.parse(
		readFileSync(join(fixtureRoot, path), "utf8"),
	);
	return registryManifestSchema.parse(parsed);
}

describe("registry manifest generation modes", () => {
	let fixtureRoot: string;

	beforeEach(() => {
		fixtureRoot = mkdtempSync(join(tmpdir(), "86d-registry-manifest-"));
		writeFixtureFile(
			fixtureRoot,
			"package.json",
			JSON.stringify({
				type: "module",
				version: "0.1.0",
				workspaces: ["modules/*"],
			}),
		);
		writeFixtureFile(
			fixtureRoot,
			"modules/example/package.json",
			JSON.stringify({ name: "@86d-app/example", version: "0.1.0" }),
		);
		writeFixtureFile(
			fixtureRoot,
			"templates/example/config.json",
			JSON.stringify({ name: "Example", version: "0.1.0" }),
		);
		writeModule(fixtureRoot, "1.0.0");
		for (const path of [GENERATOR, "internals/lib/workspace-root.ts"]) {
			mkdirSync(dirname(join(fixtureRoot, path)), { recursive: true });
			copyFileSync(join(WORKSPACE_ROOT, path), join(fixtureRoot, path));
		}
		symlinkSync(
			join(WORKSPACE_ROOT, "node_modules"),
			join(fixtureRoot, "node_modules"),
			platform === "win32" ? "junction" : "dir",
		);
		git(fixtureRoot, ["init", "--quiet"]);
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it("rejects dirty tracked source without creating a manifest in default mode", () => {
		commitSources(fixtureRoot);
		writeModule(fixtureRoot, "1.1.0");
		const result = runGenerator(fixtureRoot);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Refusing to pin registry entries to HEAD");
		expect(existsSync(join(fixtureRoot, MANIFEST_PATH))).toBe(false);
	});

	it.each([["--local"], ["--", "--local"]])(
		"generates local hashes without replacing the pinned manifest using %j",
		(...args) => {
			const commit = commitSources(fixtureRoot);
			const pinnedResult = runGenerator(fixtureRoot);
			expect(pinnedResult.status, pinnedResult.stderr).toBe(0);
			expect(readManifest(fixtureRoot).modules.example?.commit).toBe(commit);
			const canonicalBytes = readFileSync(join(fixtureRoot, MANIFEST_PATH));
			const oldIntegrity = computeSubtreeIntegrity(
				join(fixtureRoot, "modules/example"),
			);
			writeModule(fixtureRoot, "1.1.0");
			const result = runGenerator(fixtureRoot, args);
			const packageBytes = readFileSync(
				join(fixtureRoot, "modules/example/package.json"),
			);

			expect(result.status, result.stderr).toBe(0);
			expect(result.stderr).toBe("");
			expect(
				readManifest(fixtureRoot, LOCAL_MANIFEST_PATH).modules.example,
			).toMatchObject({
				version: "1.1.0",
				integrity: `sha256-${createHash("sha256").update(packageBytes).digest("hex")}`,
				subtreeIntegrity: computeSubtreeIntegrity(
					join(fixtureRoot, "modules/example"),
				),
				runtime: { storeRuntime: "0.1.0", moduleContract: 1 },
			});
			expect(
				readManifest(fixtureRoot, LOCAL_MANIFEST_PATH).modules.example
					?.subtreeIntegrity,
			).not.toBe(oldIntegrity);
			expect(
				readFileSync(join(fixtureRoot, LOCAL_MANIFEST_PATH), "utf8"),
			).not.toMatch(/"commit"\s*:/);
			expect(readFileSync(join(fixtureRoot, MANIFEST_PATH))).toEqual(
				canonicalBytes,
			);
		},
	);

	it("pins the actual commit after the source is committed in default mode", () => {
		commitSources(fixtureRoot);
		writeModule(fixtureRoot, "1.1.0");
		const commit = commitSources(fixtureRoot);
		const result = runGenerator(fixtureRoot);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stderr).toBe("");
		expect(readManifest(fixtureRoot).modules.example).toMatchObject({
			version: "1.1.0",
			commit,
			subtreeIntegrity: computeSubtreeIntegrity(
				join(fixtureRoot, "modules/example"),
			),
		});
		expect(existsSync(join(fixtureRoot, LOCAL_MANIFEST_PATH))).toBe(false);
	});

	it("requires a resolved HEAD in default mode", () => {
		const result = runGenerator(fixtureRoot);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("A resolved git commit is required");
		expect(existsSync(join(fixtureRoot, MANIFEST_PATH))).toBe(false);
	});

	it("rejects an unknown option instead of silently generating local output", () => {
		commitSources(fixtureRoot);
		const result = runGenerator(fixtureRoot, ["--local", "--unknown"]);

		expect(result.status).toBe(1);
		expect(existsSync(join(fixtureRoot, MANIFEST_PATH))).toBe(false);
		expect(existsSync(join(fixtureRoot, LOCAL_MANIFEST_PATH))).toBe(false);
	});
});
