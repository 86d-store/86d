import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	computeSubtreeIntegrity,
	verifySubtreeIntegrity,
} from "./integrity.js";
import type {
	FetchResult,
	ModuleSpecifier,
	RegistryManifest,
} from "./types.js";

/** Max retries for transient network failures. */
const MAX_RETRIES = 3;
/** Base delay (ms) for exponential backoff: 500ms, 1s, 2s. */
const BASE_DELAY_MS = 500;
/** HTTP status codes that are worth retrying. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff for transient failures.
 */
export async function fetchWithRetry(
	url: string,
	init: RequestInit,
	retries = MAX_RETRIES,
): Promise<Response> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, init);

			// Don't retry client errors (except retryable ones)
			if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
				return response;
			}

			// Retryable server error — fall through to retry logic
			lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
		} catch (err) {
			// Network error (DNS, timeout, connection refused) — retryable
			lastError = err instanceof Error ? err : new Error(String(err));
		}

		if (attempt < retries) {
			const delay = BASE_DELAY_MS * 2 ** attempt;
			await sleep(delay);
		}
	}

	throw lastError ?? new Error("Fetch failed after retries");
}

/**
 * Fetch a module from its remote source and install it into `modules/`.
 *
 * Returns the local path where the module was installed.
 */
export async function fetchModule(
	spec: ModuleSpecifier,
	root: string,
	manifest?: RegistryManifest,
): Promise<FetchResult> {
	switch (spec.source) {
		case "local":
			return {
				success: true,
				localPath: join(root, "modules", spec.name),
			};

		case "registry":
			return fetchFromRegistry(spec, root, manifest);

		case "github":
			return fetchFromGitHub(spec, root);

		case "npm":
			return fetchFromNpm(spec, root);
	}
}

/**
 * Fetch a module from the 86d registry (downloads from GitHub).
 */
async function fetchFromRegistry(
	spec: ModuleSpecifier,
	root: string,
	manifest?: RegistryManifest,
): Promise<FetchResult> {
	if (!manifest) {
		return {
			success: false,
			error: `No registry manifest available to resolve "${spec.name}"`,
		};
	}

	const entry = manifest.modules[spec.name];
	if (!entry) {
		return {
			success: false,
			error: `Module "${spec.name}" not found in registry`,
		};
	}

	// Parse baseUrl to get owner/repo
	const repoMatch = manifest.baseUrl.match(/github\.com\/([^/]+\/[^/]+)/);
	if (!repoMatch) {
		return {
			success: false,
			error: `Invalid registry baseUrl: ${manifest.baseUrl}`,
		};
	}

	const ghSpec: ModuleSpecifier = {
		...spec,
		source: "github",
		repo: repoMatch[1],
		path: entry.path,
		// Pin to the commit the entry was built from. `defaultRef` is a branch,
		// so the same manifest could otherwise resolve to different source on
		// each fetch and the recorded hash would be meaningless.
		ref: entry.commit ?? manifest.defaultRef,
	};

	const result = await fetchFromGitHub(ghSpec, root);
	if (!result.success || !result.localPath) return result;

	// Verify the complete subtree, failing closed. A missing expectation and a
	// missing file are both refusals: the previous behavior accepted either as
	// "nothing to check" and installed unverified source.
	const verdict = verifySubtreeIntegrity(
		result.localPath,
		entry.subtreeIntegrity,
	);
	if (!verdict.ok) {
		rmSync(result.localPath, { recursive: true, force: true });
		return {
			success: false,
			error: `Integrity check failed for "${spec.name}": ${verdict.reason}`,
		};
	}

	return result;
}

/**
 * Fetch a module from a GitHub repository using the GitHub API.
 *
 * Downloads the directory contents via the GitHub tarball API,
 * extracts the module path, and writes it to `modules/{name}/`.
 *
 * Retries transient failures (5xx, 429, network errors) with exponential backoff.
 */
async function fetchFromGitHub(
	spec: ModuleSpecifier,
	root: string,
): Promise<FetchResult> {
	const { repo, path, ref = "main", name } = spec;
	if (!repo) {
		return {
			success: false,
			error: `GitHub specifier "${spec.raw}" missing repo`,
		};
	}

	const targetDir = join(root, "modules", name);

	// If already exists, skip
	if (existsSync(targetDir) && existsSync(join(targetDir, "package.json"))) {
		return { success: true, localPath: targetDir };
	}

	try {
		// Download tarball via GitHub API with retry
		const tarballUrl = `https://api.github.com/repos/${repo}/tarball/${ref}`;
		const tmpDir = join(root, ".86d", "tmp", `${name}-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const tarballPath = join(tmpDir, "archive.tar.gz");

		const response = await fetchWithRetry(tarballUrl, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "86d-registry",
				...(process.env.GITHUB_TOKEN
					? {
							Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
						}
					: {}),
			},
			redirect: "follow",
		});

		if (!response.ok) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: `GitHub API returned ${response.status} for ${repo}@${ref}`,
			};
		}

		// Write tarball to disk
		const buffer = Buffer.from(await response.arrayBuffer());
		writeFileSync(tarballPath, buffer);

		// Extract the specific path from the tarball
		const subpath = path ?? "";
		const extractDir = join(tmpDir, "extracted");
		mkdirSync(extractDir, { recursive: true });

		// Extract tarball with argv-style invocation so registry-supplied paths
		// can never be interpreted as shell metacharacters.
		const tarResult = spawnSync("tar", ["xzf", tarballPath, "-C", extractDir], {
			stdio: "pipe",
		});
		if (tarResult.status !== 0) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: `tar failed: ${tarResult.stderr?.toString() ?? "unknown error"}`,
			};
		}

		// Find the extracted root directory (GitHub tarballs have a prefix dir)
		const { readdirSync } = await import("node:fs");
		const extractedDirs = readdirSync(extractDir);
		if (extractedDirs.length === 0) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: "Tarball extraction produced no files",
			};
		}

		const extractedRoot = join(extractDir, extractedDirs[0]);
		const sourcePath = subpath ? join(extractedRoot, subpath) : extractedRoot;

		if (!existsSync(sourcePath)) {
			rmSync(tmpDir, { recursive: true, force: true });
			return {
				success: false,
				error: `Path "${subpath}" not found in ${repo}@${ref}`,
			};
		}

		// Copy to target via Node's fs.cp (no shell; no metacharacter risk).
		mkdirSync(targetDir, { recursive: true });
		cpSync(sourcePath, targetDir, { recursive: true, force: true });

		// Clean up temp files
		rmSync(tmpDir, { recursive: true, force: true });

		return { success: true, localPath: targetDir };
	} catch (err) {
		return {
			success: false,
			error: `Failed to fetch from GitHub: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Install a module from npm into `node_modules/`.
 *
 * Uses `bun add` (preferred) or `npm install` to add the package.
 * For npm modules, the code stays in node_modules rather than modules/.
 */
async function fetchFromNpm(
	spec: ModuleSpecifier,
	root: string,
): Promise<FetchResult> {
	const storeDir = join(root, "apps", "store");
	const versionSuffix =
		spec.version && spec.version !== "latest" ? `@${spec.version}` : "";
	const installTarget = `${spec.packageName}${versionSuffix}`;

	try {
		// Try bun first, fall back to npm. Pass the install target as an argv
		// element so no metacharacter in the package spec is ever shell-evaluated.
		const bunResult = spawnSync("bun", ["add", installTarget], {
			cwd: storeDir,
			stdio: "pipe",
		});
		if (bunResult.status !== 0) {
			const npmResult = spawnSync("npm", ["install", installTarget], {
				cwd: storeDir,
				stdio: "pipe",
			});
			if (npmResult.status !== 0) {
				throw new Error(
					`bun add and npm install both failed: ${npmResult.stderr?.toString() ?? "unknown"}`,
				);
			}
		}

		const localPath = join(root, "node_modules", spec.packageName);
		if (existsSync(localPath)) {
			return { success: true, localPath };
		}

		return {
			success: false,
			error: `Package "${spec.packageName}" was installed but not found in node_modules`,
		};
	} catch (err) {
		return {
			success: false,
			error: `Failed to install from npm: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Ensure the `.86d/` cache directory exists.
 */
export function ensureCacheDir(root: string): string {
	const cacheDir = join(root, ".86d");
	mkdirSync(cacheDir, { recursive: true });
	return cacheDir;
}

/**
 * Integrity hash for a Module.
 *
 * This covers the Module's complete source subtree. Hashing `package.json`
 * alone left every byte of behavior unverified, so a lockfile could match while
 * the Module's controllers had been swapped.
 */
export function computeIntegrity(modulePath: string): string | undefined {
	return computeSubtreeIntegrity(modulePath);
}
