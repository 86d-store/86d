import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { z } from "zod";
import { computeIntegrity } from "./fetcher.js";
import { registryLockfilePath } from "./paths.js";
import type { ResolvedModule } from "./types.js";

// ── Lock File Schema ─────────────────────────────────────────────────

const lockedModuleSchema = z.object({
	/** Resolved source type (local, registry, github, npm). */
	source: z.enum(["local", "registry", "github", "npm"]),
	/** Full package name (e.g. "@86d-app/products"). */
	packageName: z.string(),
	/** Module version from package.json (if available). */
	version: z.string().optional(),
	/** SHA-256 integrity hash of the module's complete source subtree. */
	integrity: z.string().optional(),
	/** Relative path to the module directory (from project root). */
	localPath: z.string().optional(),
	/** For github sources: "owner/repo". */
	repo: z.string().optional(),
	/** For github sources: branch or tag. */
	ref: z.string().optional(),
	/** For github sources: path within the repo. */
	path: z.string().optional(),
});

export type LockedModule = z.infer<typeof lockedModuleSchema>;

const lockfileSchema = z.object({
	/** Lock file format version. */
	lockfileVersion: z.literal(1),
	/** ISO 8601 timestamp when the lock file was generated. */
	generatedAt: z.string(),
	/** Locked module entries keyed by short name. */
	modules: z.record(z.string(), lockedModuleSchema),
});

export type Lockfile = z.infer<typeof lockfileSchema>;

// ── Read / Write ─────────────────────────────────────────────────────

/**
 * Read a lock file from the project root.
 * Returns undefined if the file doesn't exist or is invalid.
 */
export function readLockfile(root: string): Lockfile | undefined {
	const lockPath = registryLockfilePath(root);
	if (!existsSync(lockPath)) return undefined;

	try {
		const raw = JSON.parse(readFileSync(lockPath, "utf-8"));
		return lockfileSchema.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Write a lock file to the project root.
 */
export function writeLockfile(root: string, lockfile: Lockfile): void {
	const lockPath = registryLockfilePath(root);
	mkdirSync(dirname(lockPath), { recursive: true });
	const serialized = {
		lockfileVersion: lockfile.lockfileVersion,
		modules: lockfile.modules,
		generatedAt: lockfile.generatedAt,
	};
	writeFileSync(lockPath, `${JSON.stringify(serialized, null, 2)}\n`);
}

// ── Generate ─────────────────────────────────────────────────────────

/**
 * Generate a lock file from resolved modules.
 *
 * Captures the exact state of each resolved module: source, version,
 * integrity hash, and location. This ensures reproducible builds —
 * future builds can verify the lock file matches current resolution.
 */
export function generateLockfile(
	resolved: ResolvedModule[],
	root: string,
): Lockfile {
	const modules: Record<string, LockedModule> = {};

	for (const mod of resolved) {
		if (mod.status !== "found") continue;

		const { specifier } = mod;
		const entry: LockedModule = {
			source: specifier.source,
			packageName: specifier.packageName,
		};

		// Read version from package.json
		if (mod.localPath) {
			const pkgPath = join(mod.localPath, "package.json");
			if (existsSync(pkgPath)) {
				try {
					const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
					entry.version = pkg.version;
				} catch {
					// Skip version if package.json is unreadable
				}
			}

			// Compute integrity hash
			entry.integrity = computeIntegrity(mod.localPath);

			// Store relative path
			entry.localPath = relative(root, mod.localPath);
		}

		// Preserve GitHub-specific fields
		if (specifier.source === "github") {
			if (specifier.repo) entry.repo = specifier.repo;
			if (specifier.ref) entry.ref = specifier.ref;
			if (specifier.path) entry.path = specifier.path;
		}

		modules[specifier.name] = entry;
	}

	// Sort modules by name for stable output
	const sorted: Record<string, LockedModule> = {};
	for (const key of Object.keys(modules).sort()) {
		sorted[key] = modules[key];
	}

	return {
		lockfileVersion: 1,
		modules: sorted,
		generatedAt: new Date().toISOString(),
	};
}

// ── Verify ───────────────────────────────────────────────────────────

export interface LockfileDiff {
	/** Modules in the lock file but not in the current resolution. */
	removed: string[];
	/** Modules in the current resolution but not in the lock file. */
	added: string[];
	/** Modules whose integrity hash changed. */
	changed: string[];
}

/**
 * Compare a lock file against the current resolved modules.
 *
 * Returns a diff describing what changed. An empty diff means the
 * resolution matches the lock file exactly.
 */
export function verifyLockfile(
	lockfile: Lockfile,
	resolved: ResolvedModule[],
): LockfileDiff {
	const diff: LockfileDiff = { removed: [], added: [], changed: [] };
	const currentNames = new Set<string>();

	for (const mod of resolved) {
		if (mod.status !== "found") continue;
		const name = mod.specifier.name;
		currentNames.add(name);

		const locked = lockfile.modules[name];
		if (!locked) {
			diff.added.push(name);
			continue;
		}

		// Compare integrity, failing closed. An entry with no recorded hash, or a
		// Module whose source can no longer be hashed, counts as drift: treating
		// either as "nothing to compare" is what let unverified source pass.
		if (!mod.localPath) {
			diff.changed.push(name);
			continue;
		}
		const currentIntegrity = computeIntegrity(mod.localPath);
		if (!locked.integrity || !currentIntegrity) {
			diff.changed.push(name);
			continue;
		}
		if (currentIntegrity !== locked.integrity) {
			diff.changed.push(name);
		}
	}

	// Check for removed modules
	for (const name of Object.keys(lockfile.modules)) {
		if (!currentNames.has(name)) {
			diff.removed.push(name);
		}
	}

	return diff;
}

/**
 * Check if a lock file diff is empty (no changes).
 */
export function isLockfileSatisfied(diff: LockfileDiff): boolean {
	return (
		diff.removed.length === 0 &&
		diff.added.length === 0 &&
		diff.changed.length === 0
	);
}
