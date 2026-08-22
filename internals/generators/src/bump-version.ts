#!/usr/bin/env tsx
/**
 * bump-version.ts
 *
 * Bumps every package on the shared version line uniformly (see AGENTS.md
 * Version policy). Default bump is minor unless the operator names otherwise.
 *
 * Usage:
 *   bun run bump-version          # minor bump (0.0.42 → 0.1.0)
 *   bun run bump-version --patch  # patch bump (0.0.42 → 0.0.43)
 *   bun run bump-version --minor  # minor bump (explicit)
 *   bun run bump-version --major  # major bump (0.0.42 → 1.0.0)
 *   bun run bump-version 1.2.3    # set explicit version
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const ROOT = workspaceRootFromImportMeta(import.meta.url);

// 24-hour guard: skip if a bump already happened in the last 24 hours
// Override with --force
const args = process.argv.slice(2);
const STAMP_FILE = join(ROOT, ".version-bump-timestamp");
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

if (!args.includes("--force") && existsSync(STAMP_FILE)) {
	const last = Number(readFileSync(STAMP_FILE, "utf8").trim());
	if (Date.now() - last < TWENTY_FOUR_HOURS) {
		const hoursAgo = ((Date.now() - last) / (60 * 60 * 1000)).toFixed(1);
		console.log(
			`Version already bumped ${hoursAgo}h ago — skipping (use --force to override).`,
		);
		process.exit(0);
	}
}

function findPackageJsons(dir: string): string[] {
	const results: string[] = [];
	if (!existsSync(dir)) return results;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".next") continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			// Only go one level deep in modules/ and packages/
			const pkgPath = join(full, "package.json");
			if (existsSync(pkgPath)) results.push(pkgPath);
		}
	}
	return results;
}

function bumpSemver(
	version: string,
	type: "patch" | "minor" | "major",
): string {
	const [major, minor, patch] = version.split(".").map(Number);
	if (type === "major") return `${major + 1}.0.0`;
	if (type === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

// Collect package.json paths on the shared version line
const packageJsonPaths = [
	...findPackageJsons(join(ROOT, "packages")),
	...findPackageJsons(join(ROOT, "modules")),
	join(ROOT, "apps", "store", "package.json"),
].filter((pkgPath) => existsSync(pkgPath));

// Read current versions to determine the canonical version (publishable first)
const publishableVersions: string[] = [];
for (const pkgPath of packageJsonPaths) {
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (!pkg.private && pkg.version) {
		publishableVersions.push(pkg.version);
	}
}

if (publishableVersions.length === 0) {
	console.error("No publishable packages found");
	process.exit(1);
}

// Use the highest version as the canonical version
const [canonical] = publishableVersions
	.sort((a, b) => {
		const [ma, mi, pa] = a.split(".").map(Number);
		const [mb, mib, pb] = b.split(".").map(Number);
		if (ma !== mb) return ma - mb;
		if (mi !== mib) return mi - mib;
		return pa - pb;
	})
	.slice(-1);
if (!canonical) {
	console.error("No publishable packages found");
	process.exit(1);
}

// Determine target version (default: minor per AGENTS.md Version policy)
let targetVersion: string;

if (args[0] && /^\d+\.\d+\.\d+$/.test(args[0])) {
	targetVersion = args[0];
} else if (args.includes("--major")) {
	targetVersion = bumpSemver(canonical, "major");
} else if (args.includes("--patch")) {
	targetVersion = bumpSemver(canonical, "patch");
} else {
	// `--minor` or bare invocation
	targetVersion = bumpSemver(canonical, "minor");
}

console.log(`Bumping shared version line: ${canonical} → ${targetVersion}`);

let updated = 0;
for (const pkgPath of packageJsonPaths) {
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (!pkg.version) continue;
	pkg.version = targetVersion;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`  ✓ ${pkg.name}@${targetVersion}`);
	updated++;
}

// Keep the workspace root version aligned with the shared publish line.
const rootPkgPath = join(ROOT, "package.json");
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
	name?: string;
	version?: string;
};
if (rootPkg.version) {
	rootPkg.version = targetVersion;
	writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, "\t")}\n`);
	console.log(`  ✓ ${rootPkg.name ?? "root"}@${targetVersion}`);
	updated++;
}

console.log(`\nUpdated ${updated} packages to ${targetVersion}`);

// Regenerate apps/registry/registry.json so versions and integrity hashes stay in sync.
execSync("tsx apps/registry/src/generate-manifest.ts", {
	cwd: ROOT,
	stdio: "inherit",
});

// Record timestamp so subsequent calls within 24h are skipped
writeFileSync(STAMP_FILE, String(Date.now()));
