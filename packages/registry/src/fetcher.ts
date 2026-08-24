import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { getProcessEnv } from "env/process-env";
import {
	computeSubtreeIntegrity,
	validateFetchedSubtree,
	verifySubtreeIntegrity,
} from "./integrity.js";
import { assertValidModuleSpecifier } from "./specifier.js";
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

export interface FetchModulesOptions {
	/** Replace an existing module directory with the fetched, verified bytes. */
	replaceExisting?: boolean;
	/** Allow npm sources to update package manifests and the package-manager lock. */
	allowPackageManagerMutation?: boolean;
	/**
	 * Inspect every fetched candidate after archive verification but before any
	 * staged directory replaces its target. Throw to abort the whole batch.
	 */
	validateBeforeCommit?: (
		candidates: readonly FetchModuleCandidate[],
	) => void | Promise<void>;
}

/** A verified fetch result exposed for policy checks before installation. */
export interface FetchModuleCandidate {
	specifier: ModuleSpecifier;
	/** Path whose bytes will be installed (a staging path when staged). */
	inspectionPath: string;
	/** Stable path that resolution will expose after the batch commits. */
	targetPath: string;
	staged: boolean;
}

interface FetchBehaviorOptions {
	replaceExisting: boolean;
	allowPackageManagerMutation: boolean;
}

interface FetchContext {
	archives: Map<string, Promise<PreparedArchive>>;
	options: FetchBehaviorOptions;
	pendingInstalls: PendingInstall[];
}

interface PreparedArchive {
	extractedRoot: string;
}

interface PendingInstall {
	stagingDir: string;
	targetDir: string;
	parentDir: string;
	physicalParentDir: string;
	backupDir?: string;
	backedUp?: boolean;
	installed?: boolean;
}

let installSequence = 0;

/**
 * Fetch modules in input order while sharing each repository/ref archive.
 */
export async function fetchModules(
	specs: readonly ModuleSpecifier[],
	root: string,
	manifest?: RegistryManifest,
	options: FetchModulesOptions = {},
): Promise<FetchResult[]> {
	const specifierErrors = specs.map((specifier): string | undefined => {
		try {
			assertValidModuleSpecifier(specifier);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	});
	if (specifierErrors.some(Boolean)) {
		return specifierErrors.map((error) => ({
			success: false,
			error:
				error ?? "Batch fetch aborted because another specifier was invalid",
		}));
	}

	const context: FetchContext = {
		archives: new Map(),
		pendingInstalls: [],
		options: {
			replaceExisting: options.replaceExisting ?? false,
			allowPackageManagerMutation: options.allowPackageManagerMutation ?? true,
		},
	};
	const results: FetchResult[] = [];
	for (const spec of specs) {
		results.push(await fetchOne(spec, root, manifest, context));
	}
	if (results.some((result) => !result.success)) {
		discardPendingInstalls(context.pendingInstalls);
		return results.map((result) =>
			result.success
				? {
						success: false,
						error:
							"Batch fetch aborted because another module failed verification",
					}
				: result,
		);
	}
	if (options.validateBeforeCommit) {
		const pendingByTarget = new Map(
			context.pendingInstalls.map((install) => [install.targetDir, install]),
		);
		const candidates = specs.map((specifier, index): FetchModuleCandidate => {
			const result = results[index];
			if (!result?.success || !result.localPath) {
				throw new Error("Successful Module fetch did not return a local path");
			}
			const pending = pendingByTarget.get(result.localPath);
			return {
				specifier,
				inspectionPath: pending?.stagingDir ?? result.localPath,
				targetPath: result.localPath,
				staged: Boolean(pending),
			};
		});
		try {
			await options.validateBeforeCommit(candidates);
		} catch (error) {
			discardPendingInstalls(context.pendingInstalls);
			const reason = error instanceof Error ? error.message : String(error);
			return specs.map(() => ({
				success: false,
				error: `Batch fetch failed pre-commit validation: ${reason}`,
			}));
		}
	}
	commitPendingInstalls(context.pendingInstalls);
	return results;
}

/** Fetch one module, preserving the historical single-module interface. */
export async function fetchModule(
	spec: ModuleSpecifier,
	root: string,
	manifest?: RegistryManifest,
	options?: FetchModulesOptions,
): Promise<FetchResult> {
	const [result] = await fetchModules([spec], root, manifest, options);
	if (!result) throw new Error("Module fetch produced no result");
	return result;
}

type SpecifierTargetVerdict =
	| { ok: true; path: string; parentDir: string; physicalParentDir?: string }
	| { ok: false; error: string };

interface PhysicalTargetInput {
	root: string;
	parentName: "modules" | "node_modules";
	parentDir: string;
	target: string;
	requireDirectPhysicalChild: boolean;
}

function resolveSpecifierTarget(
	root: string,
	spec: ModuleSpecifier,
): SpecifierTargetVerdict {
	return spec.source === "npm"
		? resolveNpmTarget(root, spec.packageName)
		: resolveModuleTarget(root, spec.name);
}

function resolveModuleTarget(
	root: string,
	name: string,
): SpecifierTargetVerdict {
	const modulesRoot = resolve(root, "modules");
	const target = resolve(modulesRoot, name);
	if (dirname(target) !== modulesRoot) {
		return {
			ok: false,
			error: `Module target containment failed for "${name}".`,
		};
	}
	return validatePhysicalTarget({
		root,
		parentName: "modules",
		parentDir: modulesRoot,
		target,
		requireDirectPhysicalChild: true,
	});
}

function resolveNpmTarget(
	root: string,
	packageName: string,
): SpecifierTargetVerdict {
	const nodeModulesRoot = resolve(root, "node_modules");
	const packageSegments = packageName.startsWith("@")
		? packageName.split("/")
		: [packageName];
	const target = resolve(nodeModulesRoot, ...packageSegments);
	const expectedParent =
		packageSegments.length === 2
			? resolve(nodeModulesRoot, packageSegments[0] ?? "")
			: nodeModulesRoot;
	if (dirname(target) !== expectedParent) {
		return {
			ok: false,
			error: `npm target containment failed for "${packageName}".`,
		};
	}
	const targetVerdict = validatePhysicalTarget({
		root,
		parentName: "node_modules",
		parentDir: nodeModulesRoot,
		target,
		requireDirectPhysicalChild: false,
	});
	if (
		!targetVerdict.ok ||
		packageSegments.length !== 2 ||
		!pathEntryExists(expectedParent)
	) {
		return targetVerdict;
	}
	try {
		if (
			!targetVerdict.physicalParentDir ||
			dirname(realpathSync(expectedParent)) !== targetVerdict.physicalParentDir
		) {
			return {
				ok: false,
				error: `npm scope containment failed: ${expectedParent} resolves outside node_modules.`,
			};
		}
	} catch (error) {
		return {
			ok: false,
			error: `npm scope containment validation failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	return targetVerdict;
}

function validatePhysicalTarget(
	input: PhysicalTargetInput,
): SpecifierTargetVerdict {
	try {
		const physicalRoot = realpathSync(input.root);
		const expectedPhysicalParent = resolve(physicalRoot, input.parentName);
		if (!pathEntryExists(input.parentDir)) {
			return { ok: true, path: input.target, parentDir: input.parentDir };
		}
		const physicalParentDir = realpathSync(input.parentDir);
		if (physicalParentDir !== expectedPhysicalParent) {
			return {
				ok: false,
				error: `Target parent containment failed: ${input.parentDir} resolves outside its canonical workspace location.`,
			};
		}
		if (pathEntryExists(input.target)) {
			const physicalTarget = realpathSync(input.target);
			const isContained = input.requireDirectPhysicalChild
				? dirname(physicalTarget) === physicalParentDir
				: physicalTarget !== physicalParentDir &&
					physicalTarget.startsWith(`${physicalParentDir}${sep}`);
			if (!isContained) {
				return {
					ok: false,
					error: `Target containment failed: ${input.target} resolves outside ${input.parentDir}.`,
				};
			}
		}
		return {
			ok: true,
			path: input.target,
			parentDir: input.parentDir,
			physicalParentDir,
		};
	} catch (error) {
		return {
			ok: false,
			error: `Target containment validation failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function pathEntryExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}

async function fetchOne(
	spec: ModuleSpecifier,
	root: string,
	manifest: RegistryManifest | undefined,
	context: FetchContext,
): Promise<FetchResult> {
	const target = resolveSpecifierTarget(root, spec);
	if (!target.ok) return { success: false, error: target.error };
	switch (spec.source) {
		case "local":
			return {
				success: true,
				localPath: target.path,
			};
		case "registry":
			return fetchFromRegistry(spec, root, manifest, context);
		case "github":
			return fetchFromGitHub(spec, root, context);
		case "npm":
			return fetchFromNpm(spec, root, context.options);
	}
}

async function fetchFromRegistry(
	spec: ModuleSpecifier,
	root: string,
	manifest: RegistryManifest | undefined,
	context: FetchContext,
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
	if (!entry.subtreeIntegrity) {
		return {
			success: false,
			error: `Integrity check failed for "${spec.name}": registry entry records unverified source`,
		};
	}

	const target = resolveModuleTarget(root, spec.name);
	if (!target.ok) return { success: false, error: target.error };
	const targetDir = target.path;
	if (existsSync(targetDir)) {
		const existingVerdict = verifySubtreeIntegrity(
			targetDir,
			entry.subtreeIntegrity,
		);
		if (existingVerdict.ok && !context.options.replaceExisting) {
			return { success: true, localPath: targetDir };
		}
		if (!existingVerdict.ok && !context.options.replaceExisting) {
			return {
				success: false,
				error: `Integrity check failed for "${spec.name}": ${existingVerdict.reason}`,
			};
		}
	}

	const repoMatch = manifest.baseUrl.match(/github\.com\/([^/]+\/[^/]+)/);
	if (!repoMatch?.[1]) {
		return {
			success: false,
			error: `Invalid registry baseUrl: ${manifest.baseUrl}`,
		};
	}

	const githubSpecifier: ModuleSpecifier = {
		...spec,
		source: "github",
		repo: repoMatch[1],
		path: entry.path,
		ref: entry.commit ?? manifest.defaultRef,
	};
	try {
		assertValidModuleSpecifier(githubSpecifier);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	return fetchFromGitHub(
		githubSpecifier,
		root,
		context,
		entry.subtreeIntegrity,
	);
}

async function fetchFromGitHub(
	spec: ModuleSpecifier,
	root: string,
	context: FetchContext,
	expectedIntegrity?: string,
): Promise<FetchResult> {
	const { repo, path, ref = "main", name } = spec;
	if (!repo) {
		return {
			success: false,
			error: `GitHub specifier "${spec.raw}" missing repo`,
		};
	}

	const initialTarget = resolveModuleTarget(root, name);
	if (!initialTarget.ok) {
		return { success: false, error: initialTarget.error };
	}
	const targetDir = initialTarget.path;
	if (
		!context.options.replaceExisting &&
		existsSync(join(targetDir, "package.json"))
	) {
		return { success: true, localPath: targetDir };
	}

	let stagingDir: string | undefined;
	try {
		const archive = await getPreparedArchive(repo, ref, root, context);
		const sourcePath = resolveArchiveSubpath(archive.extractedRoot, path ?? "");
		if (!sourcePath || !existsSync(sourcePath)) {
			return {
				success: false,
				error: `Path "${path ?? ""}" not found in ${repo}@${ref}`,
			};
		}

		mkdirSync(join(root, "modules"), { recursive: true });
		const installTarget = resolveModuleTarget(root, name);
		if (!installTarget.ok || !installTarget.physicalParentDir) {
			return {
				success: false,
				error: installTarget.ok
					? "Module target containment validation did not resolve its parent."
					: installTarget.error,
			};
		}
		stagingDir = resolve(
			installTarget.parentDir,
			`.${name}.86d-fetch-${process.pid}-${installSequence++}`,
		);
		assertContainedSibling(
			installTarget.parentDir,
			installTarget.physicalParentDir,
			stagingDir,
		);
		if (pathEntryExists(stagingDir)) {
			throw new Error(`Module staging path already exists: ${stagingDir}`);
		}
		cpSync(sourcePath, stagingDir, { recursive: true, force: true });
		const fetchedSubtree = validateFetchedSubtree(stagingDir);
		if (!fetchedSubtree.ok) {
			removeContainedPath(
				installTarget.parentDir,
				installTarget.physicalParentDir,
				stagingDir,
			);
			return { success: false, error: fetchedSubtree.reason };
		}

		if (expectedIntegrity) {
			const verdict = verifySubtreeIntegrity(stagingDir, expectedIntegrity);
			if (!verdict.ok) {
				removeContainedPath(
					installTarget.parentDir,
					installTarget.physicalParentDir,
					stagingDir,
				);
				return {
					success: false,
					error: `Integrity check failed for "${spec.name}": ${verdict.reason}`,
				};
			}
		}

		context.pendingInstalls.push({
			stagingDir,
			targetDir,
			parentDir: installTarget.parentDir,
			physicalParentDir: installTarget.physicalParentDir,
		});
		return { success: true, localPath: targetDir };
	} catch (error) {
		if (stagingDir) {
			const cleanupTarget = resolveModuleTarget(root, name);
			if (cleanupTarget.ok && cleanupTarget.physicalParentDir) {
				removeContainedPath(
					cleanupTarget.parentDir,
					cleanupTarget.physicalParentDir,
					stagingDir,
				);
			}
		}
		return {
			success: false,
			error: `Failed to fetch from GitHub: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function assertContainedSibling(
	parentDir: string,
	physicalParentDir: string,
	path: string,
): void {
	if (
		dirname(path) !== parentDir ||
		realpathSync(parentDir) !== physicalParentDir
	) {
		throw new Error(`Module path containment failed for ${path}.`);
	}
	if (!pathEntryExists(path)) return;
	const entry = lstatSync(path);
	if (
		entry.isSymbolicLink() ||
		dirname(realpathSync(path)) !== physicalParentDir
	) {
		throw new Error(`Module path resolves outside its target parent: ${path}.`);
	}
}

function removeContainedPath(
	parentDir: string,
	physicalParentDir: string,
	path: string,
): void {
	if (!pathEntryExists(path)) return;
	if (
		dirname(path) !== parentDir ||
		realpathSync(parentDir) !== physicalParentDir
	) {
		throw new Error(
			`Refusing to remove path outside Module containment: ${path}.`,
		);
	}
	const entry = lstatSync(path);
	if (
		!entry.isSymbolicLink() &&
		dirname(realpathSync(path)) !== physicalParentDir
	) {
		throw new Error(
			`Refusing to remove path outside Module containment: ${path}.`,
		);
	}
	rmSync(path, { recursive: true, force: true });
}

function discardPendingInstalls(installs: PendingInstall[]): void {
	for (const install of installs) {
		removeContainedPath(
			install.parentDir,
			install.physicalParentDir,
			install.stagingDir,
		);
	}
}

function commitPendingInstalls(installs: PendingInstall[]): void {
	try {
		for (const install of installs) {
			assertContainedSibling(
				install.parentDir,
				install.physicalParentDir,
				install.targetDir,
			);
			assertContainedSibling(
				install.parentDir,
				install.physicalParentDir,
				install.stagingDir,
			);
			if (existsSync(install.targetDir)) {
				install.backupDir = resolve(
					install.parentDir,
					`${install.targetDir.slice(install.parentDir.length + 1)}.86d-backup-${process.pid}-${installSequence++}`,
				);
				assertContainedSibling(
					install.parentDir,
					install.physicalParentDir,
					install.backupDir,
				);
				if (pathEntryExists(install.backupDir)) {
					throw new Error(
						`Module backup path already exists: ${install.backupDir}`,
					);
				}
				renameSync(install.targetDir, install.backupDir);
				install.backedUp = true;
			}
			renameSync(install.stagingDir, install.targetDir);
			install.installed = true;
		}
	} catch (error) {
		for (const install of [...installs].reverse()) {
			if (install.installed) {
				removeContainedPath(
					install.parentDir,
					install.physicalParentDir,
					install.targetDir,
				);
			}
			if (
				install.backedUp &&
				install.backupDir &&
				pathEntryExists(install.backupDir)
			) {
				assertContainedSibling(
					install.parentDir,
					install.physicalParentDir,
					install.backupDir,
				);
				renameSync(install.backupDir, install.targetDir);
			}
			removeContainedPath(
				install.parentDir,
				install.physicalParentDir,
				install.stagingDir,
			);
		}
		throw error;
	}

	for (const install of installs) {
		if (install.backedUp && install.backupDir) {
			removeContainedPath(
				install.parentDir,
				install.physicalParentDir,
				install.backupDir,
			);
		}
	}
}

function getPreparedArchive(
	repo: string,
	ref: string,
	root: string,
	context: FetchContext,
): Promise<PreparedArchive> {
	const key = `${repo}@${ref}`;
	const existing = context.archives.get(key);
	if (existing) return existing;

	const prepared = prepareArchive(repo, ref, root);
	context.archives.set(key, prepared);
	return prepared;
}

async function prepareArchive(
	repo: string,
	ref: string,
	root: string,
): Promise<PreparedArchive> {
	const key = createHash("sha256").update(`${repo}\0${ref}`).digest("hex");
	const cacheDir = join(root, ".86d", "cache", "github", key);
	const extractDir = join(cacheDir, "extracted");
	const readyMarker = join(cacheDir, ".ready");
	const cachedRoot = findExtractedRoot(extractDir);
	if (existsSync(readyMarker) && cachedRoot) {
		return { extractedRoot: cachedRoot };
	}

	rmSync(cacheDir, { recursive: true, force: true });
	mkdirSync(extractDir, { recursive: true });
	const tarballPath = join(cacheDir, "archive.tar.gz");
	const tarballUrl = `https://api.github.com/repos/${repo}/tarball/${ref}`;
	const token = getProcessEnv("GITHUB_TOKEN");
	const response = await fetchWithRetry(tarballUrl, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "86d-registry",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		redirect: "follow",
	});
	if (!response.ok) {
		rmSync(cacheDir, { recursive: true, force: true });
		throw new Error(
			`GitHub API returned ${response.status} for ${repo}@${ref}`,
		);
	}

	writeFileSync(tarballPath, Buffer.from(await response.arrayBuffer()));
	const tarResult = spawnSync("tar", ["xzf", tarballPath, "-C", extractDir], {
		stdio: "pipe",
	});
	if (tarResult.status !== 0) {
		rmSync(cacheDir, { recursive: true, force: true });
		throw new Error(
			`tar failed: ${tarResult.stderr?.toString() ?? "unknown error"}`,
		);
	}

	const extractedRoot = findExtractedRoot(extractDir);
	if (!extractedRoot) {
		rmSync(cacheDir, { recursive: true, force: true });
		throw new Error("Tarball extraction produced no root directory");
	}
	writeFileSync(readyMarker, `${repo}@${ref}\n`);
	return { extractedRoot };
}

function findExtractedRoot(extractDir: string): string | undefined {
	if (!existsSync(extractDir)) return undefined;
	const roots = readdirSync(extractDir, { withFileTypes: true }).filter(
		(entry) => entry.isDirectory(),
	);
	if (roots.length !== 1 || !roots[0]) return undefined;
	return join(extractDir, roots[0].name);
}

function resolveArchiveSubpath(
	extractedRoot: string,
	subpath: string,
): string | undefined {
	const candidate = resolve(extractedRoot, subpath);
	const root = resolve(extractedRoot);
	if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
		return undefined;
	}
	try {
		const physicalRoot = realpathSync(root);
		const physicalCandidate = realpathSync(candidate);
		if (
			physicalCandidate !== physicalRoot &&
			!physicalCandidate.startsWith(`${physicalRoot}${sep}`)
		) {
			return undefined;
		}
	} catch {
		return undefined;
	}
	return candidate;
}

async function fetchFromNpm(
	spec: ModuleSpecifier,
	root: string,
	options: FetchBehaviorOptions,
): Promise<FetchResult> {
	const localPath = join(root, "node_modules", spec.packageName);
	if (existsSync(localPath)) return { success: true, localPath };
	if (!options.allowPackageManagerMutation) {
		return {
			success: false,
			error: `npm package "${spec.packageName}" is missing and package-manager mutation is disabled`,
		};
	}

	const storeDir = join(root, "apps", "store");
	const versionSuffix =
		spec.version && spec.version !== "latest" ? `@${spec.version}` : "";
	const installTarget = `${spec.packageName}${versionSuffix}`;

	try {
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

		if (existsSync(localPath)) return { success: true, localPath };
		return {
			success: false,
			error: `Package "${spec.packageName}" was installed but not found in node_modules`,
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to install from npm: ${error instanceof Error ? error.message : String(error)}`,
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
