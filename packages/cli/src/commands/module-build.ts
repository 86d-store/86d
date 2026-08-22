/**
 * 86d module build — compile TypeScript to dist/ and copy non-TS assets.
 * Runs against cwd (or an optional package directory). Does not require a
 * monorepo root, so third-party module authors can use the same command.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readProcessEnv } from "env/process-env";
import { copyPackageAssets } from "../copy-package-assets.js";
import { c, error, info, success } from "../utils.js";

export function buildModule(args: string[]): void {
	const pkgDir = resolve(args[0] ?? process.cwd());
	const tsconfig = join(pkgDir, "tsconfig.json");
	const pkgJson = join(pkgDir, "package.json");

	if (!existsSync(pkgJson)) {
		error(`No package.json in ${pkgDir}`);
		process.exit(1);
	}
	if (!existsSync(tsconfig)) {
		error(`No tsconfig.json in ${pkgDir}`);
		process.exit(1);
	}

	info(`Building module in ${pkgDir}`);

	const tsc = spawnSync("bunx", ["tsc", "-p", tsconfig], {
		cwd: pkgDir,
		stdio: "inherit",
		shell: process.platform === "win32",
		env: readProcessEnv(),
	});

	if (tsc.error) {
		error(`Failed to run tsc: ${tsc.error.message}. Is TypeScript installed?`);
		process.exit(1);
	}
	if (tsc.status !== 0) {
		error("TypeScript compilation failed");
		process.exit(tsc.status ?? 1);
	}

	const assets = copyPackageAssets(pkgDir);
	if (assets.skipped) {
		info("No src/ directory — skipped asset copy");
	} else {
		success(`Copied ${assets.copied} asset(s) into dist/`);
	}

	success(`Built ${c.bold(pkgDir)}`);
}
