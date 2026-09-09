import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { execPath, platform } from "node:process";
import { getProcessEnv } from "env/process-env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const BUMP_SCRIPT = "internals/generators/src/bump-version.ts";
const VERSIONED_PACKAGES = [
	{ directory: "packages/contracts", version: "0.0.42", private: false },
	{ directory: "packages/cli", version: "0.0.41", private: false },
	{ directory: "modules/example", version: "0.0.42", private: false },
	{ directory: "apps/store", version: "0.0.42", private: true },
	{ directory: "apps/registry", version: "0.0.42", private: true },
	{ directory: "internals/generators", version: "0.0.0", private: true },
	{ directory: "internals/github", version: "0.0.0", private: true },
] as const;

function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeExecutable(directory: string, name: string): void {
	const scriptPath = join(directory, `${name}.cjs`);
	writeFileSync(
		scriptPath,
		`
const { appendFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const root = resolve(__dirname, "..");
const args = process.argv.slice(2);
let generator;
if (${JSON.stringify(name)} === "bun") {
	if (args.length !== 2 || args[0] !== "run" || args[1] !== "generate:conformance") process.exit(2);
	if (process.cwd() !== join(root, "packages", "contracts")) process.exit(3);
	generator = "conformance";
} else {
	if (process.cwd() !== root) process.exit(4);
	if (args.length === 2 && args[0] === "apps/registry/src/generate-manifest.ts" && args[1] === "--local") generator = "registry";
	else if (args.length === 1 && args[0] === "internals/generators/src/generate-modules.ts") generator = "modules";
	else process.exit(5);
}
appendFileSync(join(root, "generators.jsonl"), JSON.stringify({
	generator,
	stampExists: existsSync(join(root, ".version-bump-timestamp")),
}) + "\\n");
if (generator === "conformance" && existsSync(join(root, "fail-conformance"))) process.exit(6);
`,
	);
	if (platform === "win32") {
		writeFileSync(
			join(directory, `${name}.cmd`),
			`@"${execPath}" "${scriptPath}" %*\r\n`,
		);
		return;
	}
	writeFileSync(
		join(directory, name),
		`#!/bin/sh\nexec "${execPath}" "${scriptPath}" "$@"\n`,
		{ mode: 0o755 },
	);
}

function runBump(fixtureRoot: string) {
	const environment: Record<string, string> = {
		PATH: `${join(fixtureRoot, "bin")}${delimiter}${getProcessEnv("PATH") ?? ""}`,
	};
	if (platform === "win32") {
		for (const variable of ["PATHEXT", "ComSpec", "SystemRoot"]) {
			const value = getProcessEnv(variable);
			if (value) environment[variable] = value;
		}
	}
	return spawnSync(execPath, [TSX_CLI, join(fixtureRoot, BUMP_SCRIPT)], {
		cwd: join(fixtureRoot, "apps", "store"),
		encoding: "utf8",
		env: environment,
	});
}

function readGeneratorLog(fixtureRoot: string): unknown[] {
	return readFileSync(join(fixtureRoot, "generators.jsonl"), "utf8")
		.trim()
		.split("\n")
		.map((line): unknown => JSON.parse(line));
}

describe("bump-version command", () => {
	let fixtureRoot: string;

	beforeEach(() => {
		fixtureRoot = mkdtempSync(join(tmpdir(), "86d-bump-version-"));
		writeJson(join(fixtureRoot, "package.json"), {
			name: "version-fixture",
			version: "0.0.42",
			private: true,
			type: "module",
			workspaces: ["packages/*", "modules/*", "apps/*", "internals/*"],
		});
		for (const pkg of VERSIONED_PACKAGES) {
			writeJson(join(fixtureRoot, pkg.directory, "package.json"), {
				name: pkg.directory.replace("/", "-"),
				version: pkg.version,
				private: pkg.private,
			});
		}
		writeJson(join(fixtureRoot, "internals/unversioned/package.json"), {
			name: "unversioned",
			private: true,
		});
		for (const path of [BUMP_SCRIPT, "internals/lib/workspace-root.ts"]) {
			mkdirSync(dirname(join(fixtureRoot, path)), { recursive: true });
			copyFileSync(join(WORKSPACE_ROOT, path), join(fixtureRoot, path));
		}
		const binDirectory = join(fixtureRoot, "bin");
		mkdirSync(binDirectory);
		writeExecutable(binDirectory, "bun");
		writeExecutable(binDirectory, "tsx");
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it("aligns every versioned workspace before completing generated release metadata", () => {
		const unversionedPath = join(
			fixtureRoot,
			"internals/unversioned/package.json",
		);
		const unversionedBefore = readFileSync(unversionedPath, "utf8");
		const startedAt = Date.now();
		const result = runBump(fixtureRoot);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stderr).toBe("");
		for (const directory of [
			".",
			...VERSIONED_PACKAGES.map((pkg) => pkg.directory),
		]) {
			expect(
				readJson(join(fixtureRoot, directory, "package.json")),
			).toMatchObject({
				version: "0.1.0",
			});
		}
		expect(readFileSync(unversionedPath, "utf8")).toBe(unversionedBefore);
		expect(readGeneratorLog(fixtureRoot)).toEqual([
			{ generator: "conformance", stampExists: false },
			{ generator: "registry", stampExists: false },
			{ generator: "modules", stampExists: false },
		]);
		const stamp = Number(
			readFileSync(join(fixtureRoot, ".version-bump-timestamp"), "utf8"),
		);
		expect(stamp).toBeGreaterThanOrEqual(startedAt);
		expect(stamp).toBeLessThanOrEqual(Date.now());
	});

	it("skips all writes and generators within the 24-hour guard", () => {
		const stampPath = join(fixtureRoot, ".version-bump-timestamp");
		const stamp = String(Date.now() - 60 * 60 * 1000);
		writeFileSync(stampPath, stamp);
		const manifests = [
			"package.json",
			...VERSIONED_PACKAGES.map((pkg) => `${pkg.directory}/package.json`),
		].map((path) => join(fixtureRoot, path));
		const before = manifests.map((path) => readFileSync(path, "utf8"));
		const result = runBump(fixtureRoot);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stderr).toBe("");
		expect(manifests.map((path) => readFileSync(path, "utf8"))).toEqual(before);
		expect(readFileSync(stampPath, "utf8")).toBe(stamp);
		expect(existsSync(join(fixtureRoot, "generators.jsonl"))).toBe(false);
	});

	it("stops after a failed conformance generation without recording success", () => {
		writeFileSync(join(fixtureRoot, "fail-conformance"), "");
		const result = runBump(fixtureRoot);

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(readGeneratorLog(fixtureRoot)).toEqual([
			{ generator: "conformance", stampExists: false },
		]);
		expect(existsSync(join(fixtureRoot, ".version-bump-timestamp"))).toBe(
			false,
		);
	});
});
