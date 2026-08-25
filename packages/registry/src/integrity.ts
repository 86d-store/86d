import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Directories that are build output or install state rather than Module source.
 * They are reproducible from the source that is hashed, so including them would
 * make the hash depend on the machine that produced it.
 */
const EXCLUDED_DIRECTORIES = new Set([
	"node_modules",
	"dist",
	".turbo",
	".cache",
	".next",
	"coverage",
]);

/**
 * Host junk that must never affect Module integrity. Including these made
 * macOS-generated lockfiles fail on Linux CI (and vice versa).
 */
const EXCLUDED_FILES = new Set([".DS_Store", "Thumbs.db", "Desktop.ini"]);

export const INTEGRITY_PREFIX = "sha256-";

export type FetchedSubtreeVerdict =
	| { ok: true }
	| { ok: false; reason: string };

export interface ValidateFetchedSubtreeOptions {
	/**
	 * Permit only the root install-state directory after separately verified
	 * source has received frozen dependency links from its existing target.
	 */
	allowRootNodeModules?: boolean;
}

/**
 * Reject fetched entries that the integrity hash cannot authenticate.
 *
 * Local workspaces may contain reproducible install/build state that hashing
 * deliberately ignores. Remote archives must not carry those bytes at all:
 * copying an ignored entry would install content the manifest never covered.
 */
export function validateFetchedSubtree(
	modulePath: string,
	options: ValidateFetchedSubtreeOptions = {},
): FetchedSubtreeVerdict {
	if (!existsSync(modulePath)) {
		return { ok: false, reason: "Fetched Module directory is missing." };
	}
	const rootEntry = lstatSync(modulePath);
	if (rootEntry.isSymbolicLink()) {
		return {
			ok: false,
			reason: "Fetched Module root is a symbolic link.",
		};
	}
	if (!rootEntry.isDirectory()) {
		return { ok: false, reason: "Fetched Module root is not a directory." };
	}

	function walk(directory: string): FetchedSubtreeVerdict {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const absolute = join(directory, entry.name);
			const relativePath = relative(modulePath, absolute).split(sep).join("/");
			if (entry.isSymbolicLink()) {
				return {
					ok: false,
					reason: `Fetched Module contains symbolic link "${relativePath}".`,
				};
			}
			if (entry.isDirectory()) {
				if (EXCLUDED_DIRECTORIES.has(entry.name)) {
					if (
						options.allowRootNodeModules &&
						directory === modulePath &&
						entry.name === "node_modules"
					) {
						continue;
					}
					return {
						ok: false,
						reason: `Fetched Module contains integrity-excluded directory "${relativePath}".`,
					};
				}
				const nested = walk(absolute);
				if (!nested.ok) return nested;
				continue;
			}
			if (entry.isFile()) {
				if (
					EXCLUDED_FILES.has(entry.name) ||
					entry.name.endsWith(".tsbuildinfo")
				) {
					return {
						ok: false,
						reason: `Fetched Module contains integrity-excluded file "${relativePath}".`,
					};
				}
				continue;
			}
			return {
				ok: false,
				reason: `Fetched Module contains unsupported entry "${relativePath}".`,
			};
		}
		return { ok: true };
	}

	return walk(modulePath);
}

/** Every file that contributes to a Module's integrity, in a stable order. */
export function moduleSourceFiles(modulePath: string): string[] {
	const files: string[] = [];

	function walk(directory: string): void {
		const entries = readdirSync(directory, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isSymbolicLink()) continue;
			const absolute = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
				walk(absolute);
				continue;
			}
			if (entry.isFile()) {
				if (EXCLUDED_FILES.has(entry.name)) continue;
				if (entry.name.endsWith(".tsbuildinfo")) continue;
				files.push(absolute);
			}
		}
	}

	if (!existsSync(modulePath) || !statSync(modulePath).isDirectory()) {
		return files;
	}
	walk(modulePath);

	// Sort by POSIX-normalized relative path so the hash does not depend on
	// directory read order or the host path separator.
	return files.sort((left, right) => {
		const a = relative(modulePath, left).split(sep).join("/");
		const b = relative(modulePath, right).split(sep).join("/");
		return a < b ? -1 : a > b ? 1 : 0;
	});
}

/**
 * Hash of a Module's complete subtree.
 *
 * Hashing `package.json` alone leaves every byte of the Module's behavior
 * outside the integrity check: the manifest could match while `controllers.ts`
 * had been replaced. Each file contributes its path, its byte length, and its
 * bytes, so neither a rename nor a boundary shift between files can collide.
 *
 * Returns `undefined` only when the directory does not exist; an empty
 * directory hashes deterministically so an emptied Module still fails
 * verification instead of skipping it.
 */
export function computeSubtreeIntegrity(
	modulePath: string,
): string | undefined {
	if (!existsSync(modulePath) || !statSync(modulePath).isDirectory()) {
		return undefined;
	}

	const hash = createHash("sha256");
	for (const file of moduleSourceFiles(modulePath)) {
		const relativePath = relative(modulePath, file).split(sep).join("/");
		const contents = readFileSync(file);
		hash.update(`${relativePath}\0${contents.byteLength}\0`);
		hash.update(contents);
		hash.update("\0");
	}
	return `${INTEGRITY_PREFIX}${hash.digest("hex")}`;
}

export type IntegrityVerdict =
	| { ok: true; integrity: string }
	| { ok: false; reason: string };

/**
 * Verify a Module subtree against an expected hash, failing closed.
 *
 * A missing expectation, a missing directory, and a mismatch are all failures.
 * Treating "no expectation recorded" as success is what let unverified source
 * install silently.
 */
export function verifySubtreeIntegrity(
	modulePath: string,
	expected: string | undefined,
): IntegrityVerdict {
	if (!expected?.startsWith(INTEGRITY_PREFIX)) {
		return {
			ok: false,
			reason:
				"No subtree integrity hash is recorded for this Module; refusing to install unverified source.",
		};
	}

	const actual = computeSubtreeIntegrity(modulePath);
	if (!actual) {
		return {
			ok: false,
			reason:
				"Module directory is missing, so its integrity cannot be verified.",
		};
	}
	if (actual !== expected) {
		return {
			ok: false,
			reason: `Integrity check failed: expected ${expected}, got ${actual}.`,
		};
	}
	return { ok: true, integrity: actual };
}
