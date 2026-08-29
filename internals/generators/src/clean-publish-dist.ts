#!/usr/bin/env tsx
/** Remove publishable package output before the release build. */

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const WORKSPACE_DIRECTORIES = [
	"packages",
	"modules",
	"apps",
	"internals",
] as const;

type PublishableDist = Readonly<{
	directory: string;
	name: string;
}>;

type PackageJson = Readonly<{
	name?: unknown;
	private?: unknown;
	files?: unknown;
	scripts?: unknown;
}>;

function readPackageJson(path: string): PackageJson {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
	} catch (error) {
		throw new Error(`Could not read publishable package manifest ${path}`, {
			cause: error,
		});
	}
}

/**
 * Validate every publishable workspace package before returning any deletion
 * target. Workspace packages are direct, real directories under known roots;
 * symlinked entries are ignored rather than followed.
 */
export function findPublishableDistDirectories(
	root: string,
): PublishableDist[] {
	const workspaceRoot = resolve(root);
	const targets: PublishableDist[] = [];

	for (const workspaceDirectory of WORKSPACE_DIRECTORIES) {
		const parent = join(workspaceRoot, workspaceDirectory);
		if (!existsSync(parent)) continue;

		const entries = readdirSync(parent, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
			const packageDirectory = join(parent, entry.name);
			const packageJsonPath = join(packageDirectory, "package.json");
			if (!existsSync(packageJsonPath)) continue;

			const pkg = readPackageJson(packageJsonPath);
			if (pkg.private === true) continue;
			if (typeof pkg.name !== "string" || pkg.name.length === 0) {
				throw new Error(
					`${packageJsonPath}: publishable package must have a nonempty name`,
				);
			}
			if (
				!pkg.scripts ||
				typeof pkg.scripts !== "object" ||
				typeof (pkg.scripts as Record<string, unknown>).build !== "string" ||
				(pkg.scripts as Record<string, string>).build.length === 0
			) {
				throw new Error(
					`${packageJsonPath}: publishable package must have a build script`,
				);
			}
			if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
				throw new Error(
					`${packageJsonPath}: publishable package must list "dist" in files`,
				);
			}

			targets.push({
				directory: join(packageDirectory, "dist"),
				name: pkg.name,
			});
		}
	}

	return targets;
}

/** Clean all validated publish outputs before a forced release build. */
export function cleanPublishableDist(root: string): readonly string[] {
	const targets = findPublishableDistDirectories(root);
	for (const target of targets) {
		rmSync(target.directory, { recursive: true, force: true });
	}
	return targets.map((target) => target.name);
}

const entryPath = argv[1] ? resolve(argv[1]) : undefined;
if (entryPath === fileURLToPath(import.meta.url)) {
	const root = workspaceRootFromImportMeta(import.meta.url);
	if (argv.includes("--check")) {
		const targets = findPublishableDistDirectories(root);
		stdout.write(`Validated publish output for ${targets.length} packages.\n`);
	} else {
		const cleaned = cleanPublishableDist(root);
		stdout.write(`Cleaned publish output for ${cleaned.length} packages.\n`);
	}
}
