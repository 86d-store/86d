import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { execPath, platform } from "node:process";
import { getProcessEnv } from "env/process-env";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");

function writeExecutable(
	directory: string,
	name: string,
	source: string,
): void {
	const scriptPath = join(directory, `${name}.cjs`);
	writeFileSync(scriptPath, source);
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

describe("version-packages command", () => {
	it("leaves Module versions frozen against the registry lock", () => {
		const fixtureRoot = mkdtempSync(join(tmpdir(), "86d-version-packages-"));
		try {
			const binDir = join(fixtureRoot, "bin");
			const moduleDir = join(fixtureRoot, "modules/example");
			const lockPath = join(fixtureRoot, "apps/registry/registry.lock.json");
			mkdirSync(binDir, { recursive: true });
			mkdirSync(moduleDir, { recursive: true });
			mkdirSync(join(fixtureRoot, "apps/registry"), { recursive: true });
			writeFileSync(
				join(moduleDir, "package.json"),
				`${JSON.stringify({ name: "@86d-app/example", version: "1.0.0" }, null, 2)}\n`,
			);
			writeFileSync(
				lockPath,
				`${JSON.stringify({ modules: { example: { version: "1.0.0" } } }, null, 2)}\n`,
			);

			writeExecutable(
				binDir,
				"changeset",
				`
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
if (process.argv[2] !== "version") process.exit(2);
const packagePath = join(process.cwd(), "modules/example/package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
packageJson.version = "1.0.1";
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\\n");
`,
			);
			writeExecutable(
				binDir,
				"bun",
				`
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
if (args[0] !== "run" || args[1] !== "generate:modules") process.exit(2);
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "modules/example/package.json"), "utf8"));
const lockPath = join(process.cwd(), "apps/registry/registry.lock.json");
const lockfile = JSON.parse(readFileSync(lockPath, "utf8"));
if (args.includes("--frozen")) {
	process.exit(lockfile.modules.example.version === packageJson.version ? 0 : 1);
}
lockfile.modules.example.version = packageJson.version;
writeFileSync(lockPath, JSON.stringify(lockfile, null, 2) + "\\n");
`,
			);

			const rootPackage: unknown = JSON.parse(
				readFileSync(join(WORKSPACE_ROOT, "package.json"), "utf8"),
			);
			if (typeof rootPackage !== "object" || rootPackage === null) {
				throw new Error("Root package.json must contain an object.");
			}
			const scripts = Reflect.get(rootPackage, "scripts");
			if (typeof scripts !== "object" || scripts === null) {
				throw new Error("Root package.json scripts must contain an object.");
			}
			const versionCommand = Reflect.get(scripts, "version-packages");
			if (typeof versionCommand !== "string") {
				throw new Error("version-packages script is not configured.");
			}
			const environment: Record<string, string> = {
				PATH: `${binDir}${delimiter}${getProcessEnv("PATH") ?? ""}`,
			};
			if (platform === "win32") {
				for (const variable of ["PATHEXT", "ComSpec", "SystemRoot"]) {
					const value = getProcessEnv(variable);
					if (value) {
						environment[variable] = value;
					}
				}
			}

			const versionResult = spawnSync(versionCommand, {
				cwd: fixtureRoot,
				encoding: "utf8",
				env: environment,
				shell: true,
			});
			expect(versionResult.stderr).toBe("");
			expect(versionResult.status).toBe(0);

			const stateBeforeFrozen = {
				lock: readFileSync(lockPath, "utf8"),
				module: readFileSync(join(moduleDir, "package.json"), "utf8"),
			};
			const frozenResult = spawnSync("bun run generate:modules -- --frozen", {
				cwd: fixtureRoot,
				encoding: "utf8",
				env: environment,
				shell: true,
			});

			expect(frozenResult.status).toBe(0);
			expect({
				lock: readFileSync(lockPath, "utf8"),
				module: readFileSync(join(moduleDir, "package.json"), "utf8"),
			}).toEqual(stateBeforeFrozen);
			expect(JSON.parse(stateBeforeFrozen.lock)).toEqual({
				modules: { example: { version: "1.0.1" } },
			});
		} finally {
			rmSync(fixtureRoot, { force: true, recursive: true });
		}
	});
});
