#!/usr/bin/env tsx
/**
 * prepare-publish.ts
 *
 * Rewrites Bun workspace/catalog protocols in publishable package.json files
 * and swaps workspace `exports` (src) for `publishConfig.exports` (dist), and
 * workspace `bin` for `publishConfig.bin` when present, so `changeset publish`
 * / npm can install packages outside this monorepo.
 *
 * Backs up each package.json under `.prepare-publish-backup/` and restores it
 * afterward (does not use `git checkout`, so uncommitted packaging edits survive).
 *
 * Usage:
 *   bun run prepare-publish           # rewrite protocols + dist exports
 *   bun run prepare-publish --restore # restore package.json from backup
 *   bun run prepare-publish --check   # fail if protocols remain
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const ROOT = workspaceRootFromImportMeta(import.meta.url);
const BACKUP_ROOT = join(ROOT, ".prepare-publish-backup");
const args = process.argv.slice(2);
const mode = args.includes("--restore")
	? "restore"
	: args.includes("--check")
		? "check"
		: "apply";

type JsonObject = Record<string, unknown>;

type RootPackage = {
	version?: string;
	catalog?: Record<string, string>;
	catalogs?: Record<string, Record<string, string>>;
};

function listPackageJsonPaths(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (entry.name === "node_modules") continue;
		const pkgPath = join(dir, entry.name, "package.json");
		if (existsSync(pkgPath)) results.push(pkgPath);
	}
	return results;
}

function allWorkspacePackageJsonPaths(): string[] {
	return [
		...listPackageJsonPaths(join(ROOT, "packages")),
		...listPackageJsonPaths(join(ROOT, "modules")),
		...listPackageJsonPaths(join(ROOT, "apps")),
		...listPackageJsonPaths(join(ROOT, "internals")),
	];
}

function publishablePackageJsonPaths(): string[] {
	return allWorkspacePackageJsonPaths().filter((pkgPath) => {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			private?: boolean;
		};
		return pkg.private !== true;
	});
}

/** Packages that must stay on the shared publish line (never private / never ignored). */
const REQUIRED_PUBLISHABLE = [
	"@86d-app/contracts",
	"@86d-app/registry",
	"@86d-app/storage",
	"@86d-app/core",
	"86d",
] as const;

function assertRequiredPublishable(paths: string[]): void {
	const names = new Set<string>();
	for (const pkgPath of paths) {
		const pkg = readJson(pkgPath);
		if (typeof pkg.name === "string") names.add(pkg.name);
	}
	for (const required of REQUIRED_PUBLISHABLE) {
		if (!names.has(required)) {
			throw new Error(
				`Required publishable package "${required}" is missing or marked private`,
			);
		}
	}
}

function readJson(path: string): JsonObject {
	return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function resolveDepSpec(
	depName: string,
	spec: string,
	root: RootPackage,
	workspaceVersions: Map<string, string>,
): string {
	if (spec === "workspace:*" || spec.startsWith("workspace:")) {
		const version = workspaceVersions.get(depName);
		if (!version) {
			throw new Error(
				`workspace dependency "${depName}" (${spec}) has no version in this repo`,
			);
		}
		return version;
	}

	if (spec === "catalog:") {
		const version = root.catalog?.[depName];
		if (!version) {
			throw new Error(
				`catalog: dependency "${depName}" is missing from root catalog`,
			);
		}
		return version;
	}

	if (spec.startsWith("catalog:")) {
		const catalogName = spec.slice("catalog:".length);
		const version = root.catalogs?.[catalogName]?.[depName];
		if (!version) {
			throw new Error(
				`catalog:${catalogName} dependency "${depName}" is missing from root catalogs.${catalogName}`,
			);
		}
		return version;
	}

	return spec;
}

function rewriteDepRecord(
	record: unknown,
	root: RootPackage,
	workspaceVersions: Map<string, string>,
): Record<string, string> | undefined {
	if (!record || typeof record !== "object") return undefined;
	const out: Record<string, string> = {};
	for (const [name, spec] of Object.entries(record as Record<string, string>)) {
		if (typeof spec !== "string") {
			throw new Error(`Non-string dependency spec for ${name}`);
		}
		out[name] = resolveDepSpec(name, spec, root, workspaceVersions);
	}
	return out;
}

function containsProtocol(value: unknown): boolean {
	if (typeof value === "string") {
		return (
			value.startsWith("workspace:") ||
			value === "catalog:" ||
			value.startsWith("catalog:")
		);
	}
	if (!value || typeof value !== "object") return false;
	return Object.values(value as Record<string, unknown>).some(containsProtocol);
}

function packageHasProtocols(pkg: JsonObject): boolean {
	return (
		containsProtocol(pkg.dependencies) ||
		containsProtocol(pkg.devDependencies) ||
		containsProtocol(pkg.peerDependencies) ||
		containsProtocol(pkg.optionalDependencies)
	);
}

function buildWorkspaceVersions(paths: string[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const pkgPath of paths) {
		const pkg = readJson(pkgPath);
		const name = pkg.name;
		const version = pkg.version;
		if (typeof name === "string" && typeof version === "string") {
			map.set(name, version);
		}
	}
	return map;
}

function backupPathFor(pkgPath: string): string {
	return join(BACKUP_ROOT, relative(ROOT, pkgPath));
}

function backupPackageJson(pkgPath: string): void {
	const dest = backupPathFor(pkgPath);
	mkdirSync(dirname(dest), { recursive: true });
	cpSync(pkgPath, dest);
}

function applyPublishExports(pkg: JsonObject): void {
	const publishConfig = pkg.publishConfig;
	if (!publishConfig || typeof publishConfig !== "object") return;
	const published = publishConfig as JsonObject;
	if (published.exports) {
		pkg.exports = published.exports;
	}
	if (published.bin) {
		pkg.bin = published.bin;
	}
}

function assertDistFilesField(pkg: JsonObject, pkgPath: string): void {
	const files = pkg.files;
	if (!Array.isArray(files) || !files.includes("dist")) {
		throw new Error(
			`${pkgPath}: publishable packages must list "dist" in files (got ${JSON.stringify(files)})`,
		);
	}
	if (files.includes("src")) {
		throw new Error(
			`${pkgPath}: publishable packages must not list "src" in files`,
		);
	}
}

function applyRewrites(): void {
	const root = readJson(join(ROOT, "package.json")) as RootPackage;
	const paths = publishablePackageJsonPaths();
	assertRequiredPublishable(paths);
	const workspaceVersions = buildWorkspaceVersions(
		allWorkspacePackageJsonPaths(),
	);
	rmSync(BACKUP_ROOT, { recursive: true, force: true });
	mkdirSync(BACKUP_ROOT, { recursive: true });
	let rewritten = 0;

	for (const pkgPath of paths) {
		const pkg = readJson(pkgPath);
		assertDistFilesField(pkg, pkgPath);
		backupPackageJson(pkgPath);

		const next = { ...pkg };
		applyPublishExports(next);

		if (pkg.dependencies) {
			next.dependencies = rewriteDepRecord(
				pkg.dependencies,
				root,
				workspaceVersions,
			);
		}
		if (pkg.peerDependencies) {
			next.peerDependencies = rewriteDepRecord(
				pkg.peerDependencies,
				root,
				workspaceVersions,
			);
		}
		if (pkg.optionalDependencies) {
			next.optionalDependencies = rewriteDepRecord(
				pkg.optionalDependencies,
				root,
				workspaceVersions,
			);
		}
		next.devDependencies = undefined;

		if (packageHasProtocols(next)) {
			throw new Error(
				`Protocols remain after rewrite in ${pkgPath}. Refusing to publish.`,
			);
		}

		const exportsJson = JSON.stringify(next.exports ?? {});
		if (exportsJson.includes("./src/")) {
			throw new Error(
				`${pkgPath}: exports still reference ./src/ after publish rewrite`,
			);
		}

		writeFileSync(pkgPath, `${JSON.stringify(next, null, "\t")}\n`);
		rewritten += 1;
	}

	console.log(`Prepared ${rewritten} publishable package.json files for npm.`);
}

function checkProtocols(): void {
	const paths = publishablePackageJsonPaths();
	const offenders: string[] = [];
	for (const pkgPath of paths) {
		const pkg = readJson(pkgPath);
		if (packageHasProtocols(pkg)) {
			offenders.push(pkgPath);
		}
	}
	if (offenders.length > 0) {
		console.error(
			`Publishable packages still contain workspace:/catalog: protocols:\n${offenders
				.map((p) => `  - ${p}`)
				.join("\n")}`,
		);
		process.exit(1);
	}
	console.log(
		`Checked ${paths.length} publishable packages: no workspace:/catalog: protocols.`,
	);
}

function restoreFromBackup(): void {
	if (!existsSync(BACKUP_ROOT)) {
		console.log("No .prepare-publish-backup/ to restore.");
		return;
	}
	let restored = 0;
	const stack = [BACKUP_ROOT];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) break;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
				continue;
			}
			if (entry.name !== "package.json") continue;
			const rel = relative(BACKUP_ROOT, full);
			const dest = join(ROOT, rel);
			mkdirSync(dirname(dest), { recursive: true });
			cpSync(full, dest);
			restored += 1;
		}
	}
	rmSync(BACKUP_ROOT, { recursive: true, force: true });
	console.log(`Restored ${restored} package.json files from backup.`);
}

if (mode === "restore") {
	restoreFromBackup();
} else if (mode === "check") {
	checkProtocols();
} else {
	applyRewrites();
}
