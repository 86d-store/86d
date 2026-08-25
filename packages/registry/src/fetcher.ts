import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
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
	/**
	 * Module names whose existing frozen `node_modules` directory must survive a
	 * staged source replacement. Preservation happens only after candidate
	 * validation, validates every declared link against the frozen workspace
	 * install, and completes before the atomic batch commit.
	 */
	preserveExistingNodeModules?: ReadonlySet<string>;
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
	moduleName: string;
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
	if (
		(options.preserveExistingNodeModules?.size ?? 0) > 0 &&
		options.replaceExisting !== true
	) {
		return specs.map(() => ({
			success: false,
			error:
				"Frozen dependency preservation requires target replacement to be enabled",
		}));
	}
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
	let frozenInstallState: FrozenInstallState | undefined;
	if ((options.preserveExistingNodeModules?.size ?? 0) > 0) {
		try {
			// Snapshot canonical workspace targets before remote staging directories
			// exist, so transaction artifacts can never become dependency roots.
			frozenInstallState = readFrozenInstallState(
				root,
				options.preserveExistingNodeModules ?? new Set(),
			);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			return specs.map(() => ({
				success: false,
				error: `Batch fetch failed to validate frozen dependency state: ${reason}`,
			}));
		}
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
	if ((options.preserveExistingNodeModules?.size ?? 0) > 0) {
		try {
			preserveExistingNodeModules(
				context.pendingInstalls,
				root,
				options.preserveExistingNodeModules ?? new Set(),
				frozenInstallState,
			);
		} catch (error) {
			discardPendingInstalls(context.pendingInstalls);
			const reason = error instanceof Error ? error.message : String(error);
			return specs.map(() => ({
				success: false,
				error: `Batch fetch failed to preserve frozen dependency state: ${reason}`,
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
			moduleName: name,
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

function preserveExistingNodeModules(
	installs: PendingInstall[],
	root: string,
	moduleNames: ReadonlySet<string>,
	frozenInstallState: FrozenInstallState | undefined,
): void {
	if (!frozenInstallState) {
		throw new Error("Frozen Bun install state was not snapshotted");
	}
	for (const install of installs) {
		if (!moduleNames.has(install.moduleName)) continue;
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
		const source = join(install.targetDir, "node_modules");
		const destination = join(install.stagingDir, "node_modules");
		if (!pathEntryExists(source)) {
			throw new Error(
				`Missing frozen dependency state for Module ${install.targetDir}`,
			);
		}
		const sourceEntry = lstatSync(source);
		if (
			sourceEntry.isSymbolicLink() ||
			!sourceEntry.isDirectory() ||
			dirname(realpathSync(source)) !== realpathSync(install.targetDir)
		) {
			throw new Error(
				`Frozen dependency state escapes Module target ${install.targetDir}`,
			);
		}
		if (pathEntryExists(destination)) {
			throw new Error(
				`Fetched Module unexpectedly contains dependency state: ${install.stagingDir}`,
			);
		}
		validateFrozenNodeModules({
			root,
			modulePath: install.stagingDir,
			workspacePath: install.targetDir,
			nodeModulesPath: source,
			frozenInstallState,
		});
		cpSync(source, destination, {
			recursive: true,
			dereference: false,
			verbatimSymlinks: true,
		});
	}
}

const DEPENDENCY_FIELDS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;

interface FrozenNodeModulesValidationInput {
	root: string;
	modulePath: string;
	workspacePath: string;
	nodeModulesPath: string;
	frozenInstallState: FrozenInstallState;
}

interface LockedWorkspace {
	packageName: string;
	dependencySpecifiers: ReadonlyMap<string, string>;
	dependencyTargets: ReadonlyMap<string, string>;
}

interface FrozenInstallState {
	workspacePackages: ReadonlyMap<string, string>;
	lockedWorkspaces: ReadonlyMap<string, LockedWorkspace>;
	lockedPackages: ReadonlyMap<string, readonly unknown[]>;
	bunPackageRoots: ReadonlyMap<string, readonly string[]>;
}

function validateFrozenNodeModules(
	input: FrozenNodeModulesValidationInput,
): void {
	const packageJson = readJsonObject(
		join(input.modulePath, "package.json"),
		"fetched Module package metadata",
	);
	const declared = new Map<string, string>();
	const required = new Set<string>();
	for (const field of DEPENDENCY_FIELDS) {
		const value = packageJson[field];
		if (value === undefined) continue;
		if (!isJsonObject(value)) {
			throw new Error(`Fetched Module ${field} must be an object`);
		}
		for (const [packageName, specifier] of Object.entries(value)) {
			if (typeof specifier !== "string") {
				throw new Error(
					`Fetched Module dependency "${packageName}" must use a string specifier`,
				);
			}
			declared.set(packageName, specifier);
			if (field === "dependencies" || field === "devDependencies") {
				required.add(packageName);
			}
		}
	}
	const physicalWorkspacePath = realpathSync(input.workspacePath);
	const lockedWorkspace = input.frozenInstallState.lockedWorkspaces.get(
		physicalWorkspacePath,
	);
	if (!lockedWorkspace) {
		throw new Error(
			`Frozen Bun lock has no workspace entry for ${input.workspacePath}`,
		);
	}
	if (packageJson.name !== lockedWorkspace.packageName) {
		throw new Error(
			`Fetched Module package ${String(packageJson.name)} does not match frozen workspace ${lockedWorkspace.packageName}`,
		);
	}

	const physicalRoot = realpathSync(input.root);
	const bunStorePath = join(input.root, "node_modules", ".bun");
	let physicalBunStore: string | undefined;
	const linkedTargets = new Map<string, string>();
	let binPath: string | undefined;

	const validatePackageLink = (linkPath: string, packageName: string): void => {
		const specifier = declared.get(packageName);
		if (!specifier) {
			throw new Error(
				`Frozen dependency link "${packageName}" is not declared by the fetched Module`,
			);
		}
		const linkEntry = lstatSync(linkPath);
		if (!linkEntry.isSymbolicLink()) {
			throw new Error(
				`Frozen dependency entry "${packageName}" is not a symbolic link`,
			);
		}
		const physicalTarget = realpathSync(linkPath);
		if (lockedWorkspace.dependencyTargets.get(packageName) !== physicalTarget) {
			throw new Error(
				`Frozen dependency "${packageName}" changed peer context after the frozen workspace snapshot`,
			);
		}
		if (specifier.startsWith("workspace:")) {
			if (
				input.frozenInstallState.workspacePackages.get(packageName) !==
				physicalTarget
			) {
				throw new Error(
					`Frozen workspace dependency "${packageName}" resolves outside its declared workspace package`,
				);
			}
		} else {
			if (!physicalBunStore) {
				physicalBunStore = realpathSync(bunStorePath);
				if (
					physicalBunStore !== resolve(physicalRoot, "node_modules", ".bun")
				) {
					throw new Error(
						"Frozen Bun dependency store resolves outside the workspace",
					);
				}
			}
			if (!isPathInside(physicalBunStore, physicalTarget)) {
				throw new Error(
					`Frozen dependency "${packageName}" resolves outside the Bun install store`,
				);
			}
			const installedPackage = readJsonObject(
				join(physicalTarget, "package.json"),
				`frozen dependency ${packageName}`,
			);
			if (installedPackage.name !== packageName) {
				throw new Error(
					`Frozen dependency "${packageName}" resolves to package ${String(installedPackage.name)}`,
				);
			}
			validateLockedExternalPackage({
				packageName,
				specifier,
				physicalTarget,
				installedPackage,
				lockedWorkspace,
				frozenInstallState: input.frozenInstallState,
			});
		}
		linkedTargets.set(packageName, physicalTarget);
	};

	for (const entry of readdirSync(input.nodeModulesPath, {
		withFileTypes: true,
	})) {
		const entryPath = join(input.nodeModulesPath, entry.name);
		if (entry.name === ".bin") {
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				throw new Error("Frozen dependency .bin entry must be a directory");
			}
			binPath = entryPath;
			continue;
		}
		if (entry.name.startsWith("@")) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				throw new Error(`Frozen dependency scope "${entry.name}" is invalid`);
			}
			for (const scopedEntry of readdirSync(entryPath, {
				withFileTypes: true,
			})) {
				validatePackageLink(
					join(entryPath, scopedEntry.name),
					`${entry.name}/${scopedEntry.name}`,
				);
			}
			continue;
		}
		validatePackageLink(entryPath, entry.name);
	}

	for (const packageName of required) {
		if (!linkedTargets.has(packageName)) {
			throw new Error(
				`Missing frozen dependency link for declared package "${packageName}"`,
			);
		}
	}

	if (binPath) {
		for (const entry of readdirSync(binPath, { withFileTypes: true })) {
			const linkPath = join(binPath, entry.name);
			if (!entry.isSymbolicLink()) {
				throw new Error(
					`Frozen dependency binary "${entry.name}" is not a link`,
				);
			}
			const physicalTarget = realpathSync(linkPath);
			if (
				![...linkedTargets.values()].some(
					(packageRoot) =>
						physicalTarget === packageRoot ||
						isPathInside(packageRoot, physicalTarget),
				)
			) {
				throw new Error(
					`Frozen dependency binary "${entry.name}" resolves outside declared dependencies`,
				);
			}
		}
	}
}

interface LockedExternalPackageValidationInput {
	packageName: string;
	specifier: string;
	physicalTarget: string;
	installedPackage: Record<string, unknown>;
	lockedWorkspace: LockedWorkspace;
	frozenInstallState: FrozenInstallState;
}

function validateLockedExternalPackage(
	input: LockedExternalPackageValidationInput,
): void {
	const lockedSpecifier = input.lockedWorkspace.dependencySpecifiers.get(
		input.packageName,
	);
	if (lockedSpecifier !== input.specifier) {
		throw new Error(
			`Frozen dependency "${input.packageName}" does not match its declaring workspace in bun.lock`,
		);
	}
	const contextualKey = `${input.lockedWorkspace.packageName}/${input.packageName}`;
	const packageKey = input.frozenInstallState.lockedPackages.has(contextualKey)
		? contextualKey
		: input.packageName;
	const packageEntry = input.frozenInstallState.lockedPackages.get(packageKey);
	if (!packageEntry) {
		throw new Error(
			`Frozen dependency "${input.packageName}" has no direct package resolution in bun.lock`,
		);
	}
	const resolution = packageEntry[0];
	const integrity = packageEntry[3];
	if (typeof resolution !== "string" || typeof integrity !== "string") {
		throw new Error(
			`Frozen dependency "${input.packageName}" has no immutable resolution and integrity in bun.lock`,
		);
	}
	const separator = resolution.lastIndexOf("@");
	if (separator <= 0 || separator === resolution.length - 1) {
		throw new Error(
			`Frozen dependency "${input.packageName}" has unsupported resolution ${resolution}`,
		);
	}
	const lockedName = resolution.slice(0, separator);
	const lockedVersion = resolution.slice(separator + 1);
	if (
		input.installedPackage.name !== lockedName ||
		input.installedPackage.version !== lockedVersion
	) {
		throw new Error(
			`Frozen dependency "${input.packageName}" installed name/version does not match locked resolution ${resolution}`,
		);
	}
	const identity = frozenPackageIdentity(lockedName, lockedVersion);
	const packageRoots =
		input.frozenInstallState.bunPackageRoots.get(identity) ?? [];
	if (!packageRoots.includes(input.physicalTarget)) {
		throw new Error(
			`Frozen dependency "${input.packageName}" does not resolve to a Bun package root for locked resolution ${resolution}`,
		);
	}
}

function readFrozenInstallState(
	root: string,
	moduleNames: ReadonlySet<string>,
): FrozenInstallState {
	const workspacePackages = readWorkspacePackageTargets(root);
	const lock = readJsoncObject(join(root, "bun.lock"), "Bun lockfile");
	if (lock.lockfileVersion !== 2) {
		throw new Error("Bun lockfile must use lockfileVersion 2");
	}
	if (!isJsonObject(lock.workspaces) || !isJsonObject(lock.packages)) {
		throw new Error("Bun lockfile is missing workspaces or packages");
	}

	const physicalRoot = realpathSync(root);
	const modulesRoot = resolve(root, "modules");
	const physicalModulesRoot = realpathSync(modulesRoot);
	const preservedWorkspacePaths = new Set<string>();
	for (const moduleName of moduleNames) {
		const modulePath = resolve(modulesRoot, moduleName);
		if (
			dirname(modulePath) !== modulesRoot ||
			!pathEntryExists(modulePath) ||
			lstatSync(modulePath).isSymbolicLink()
		) {
			throw new Error(`Frozen Module workspace "${moduleName}" is invalid`);
		}
		const physicalModulePath = realpathSync(modulePath);
		if (dirname(physicalModulePath) !== physicalModulesRoot) {
			throw new Error(
				`Frozen Module workspace "${moduleName}" resolves outside modules`,
			);
		}
		preservedWorkspacePaths.add(physicalModulePath);
	}
	const lockedWorkspaces = new Map<string, LockedWorkspace>();
	for (const [relativePath, value] of Object.entries(lock.workspaces)) {
		if (!isJsonObject(value) || typeof value.name !== "string") continue;
		const workspacePath = resolve(root, relativePath);
		const expectedWorkspacePath = resolve(physicalRoot, relativePath);
		if (
			(relativePath !== "" &&
				!isPathInside(physicalRoot, expectedWorkspacePath)) ||
			!pathEntryExists(workspacePath) ||
			lstatSync(workspacePath).isSymbolicLink() ||
			realpathSync(workspacePath) !== expectedWorkspacePath
		) {
			throw new Error(
				`Bun lock workspace "${relativePath}" resolves outside the workspace`,
			);
		}
		if (
			relativePath !== "" &&
			workspacePackages.get(value.name) !== expectedWorkspacePath
		) {
			throw new Error(
				`Bun lock workspace "${relativePath}" does not match package ${value.name}`,
			);
		}
		const dependencySpecifiers = new Map<string, string>();
		for (const field of DEPENDENCY_FIELDS) {
			const dependencies = value[field];
			if (dependencies === undefined) continue;
			if (!isJsonObject(dependencies)) {
				throw new Error(
					`Bun lock workspace ${relativePath} ${field} is invalid`,
				);
			}
			for (const [packageName, specifier] of Object.entries(dependencies)) {
				if (typeof specifier !== "string") {
					throw new Error(
						`Bun lock workspace dependency "${packageName}" is invalid`,
					);
				}
				const existing = dependencySpecifiers.get(packageName);
				if (existing !== undefined && existing !== specifier) {
					throw new Error(
						`Bun lock workspace dependency "${packageName}" has conflicting specifiers`,
					);
				}
				dependencySpecifiers.set(packageName, specifier);
			}
		}
		if (lockedWorkspaces.has(expectedWorkspacePath)) {
			throw new Error(`Duplicate Bun lock workspace "${relativePath}"`);
		}
		lockedWorkspaces.set(expectedWorkspacePath, {
			packageName: value.name,
			dependencySpecifiers,
			dependencyTargets: preservedWorkspacePaths.has(expectedWorkspacePath)
				? readWorkspaceDependencyTargets(workspacePath)
				: new Map(),
		});
	}
	for (const workspacePath of preservedWorkspacePaths) {
		if (!lockedWorkspaces.has(workspacePath)) {
			throw new Error(
				`Bun lockfile has no workspace entry for preserved Module ${workspacePath}`,
			);
		}
	}

	const lockedPackages = new Map<string, readonly unknown[]>();
	for (const [packageKey, value] of Object.entries(lock.packages)) {
		if (!Array.isArray(value)) {
			throw new Error(`Bun lock package "${packageKey}" is invalid`);
		}
		lockedPackages.set(packageKey, value);
	}
	return {
		workspacePackages,
		lockedWorkspaces,
		lockedPackages,
		bunPackageRoots: readBunPackageRoots(root),
	};
}

function readWorkspaceDependencyTargets(
	workspacePath: string,
): ReadonlyMap<string, string> {
	const nodeModulesPath = join(workspacePath, "node_modules");
	if (!pathEntryExists(nodeModulesPath)) return new Map();
	if (
		lstatSync(nodeModulesPath).isSymbolicLink() ||
		realpathSync(nodeModulesPath) !==
			resolve(realpathSync(workspacePath), "node_modules")
	) {
		throw new Error(
			`Frozen dependency state escapes workspace ${workspacePath}`,
		);
	}

	const targets = new Map<string, string>();
	const addPackageLink = (packageName: string, linkPath: string): void => {
		if (!lstatSync(linkPath).isSymbolicLink()) {
			throw new Error(
				`Frozen dependency entry "${packageName}" is not a symbolic link`,
			);
		}
		targets.set(packageName, realpathSync(linkPath));
	};
	for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
		if (entry.name === ".bin") continue;
		const entryPath = join(nodeModulesPath, entry.name);
		if (!entry.name.startsWith("@")) {
			addPackageLink(entry.name, entryPath);
			continue;
		}
		if (
			!entry.isDirectory() ||
			entry.isSymbolicLink() ||
			realpathSync(entryPath) !== resolve(nodeModulesPath, entry.name)
		) {
			throw new Error(`Frozen dependency scope "${entry.name}" is invalid`);
		}
		for (const scopedEntry of readdirSync(entryPath, {
			withFileTypes: true,
		})) {
			addPackageLink(
				`${entry.name}/${scopedEntry.name}`,
				join(entryPath, scopedEntry.name),
			);
		}
	}
	return targets;
}

function readBunPackageRoots(
	root: string,
): ReadonlyMap<string, readonly string[]> {
	const bunStorePath = join(root, "node_modules", ".bun");
	if (!pathEntryExists(bunStorePath)) return new Map();
	const physicalRoot = realpathSync(root);
	const physicalBunStore = realpathSync(bunStorePath);
	if (physicalBunStore !== resolve(physicalRoot, "node_modules", ".bun")) {
		throw new Error(
			"Frozen Bun dependency store resolves outside the workspace",
		);
	}

	const roots = new Map<string, Set<string>>();
	const addPackageRoot = (packagePath: string): void => {
		if (
			lstatSync(packagePath).isSymbolicLink() ||
			realpathSync(packagePath) !== resolve(packagePath)
		) {
			return;
		}
		const packageJsonPath = join(packagePath, "package.json");
		if (!pathEntryExists(packageJsonPath)) return;
		const packageJson = readJsonObject(
			packageJsonPath,
			`frozen Bun package ${packagePath}`,
		);
		if (
			typeof packageJson.name !== "string" ||
			typeof packageJson.version !== "string"
		) {
			throw new Error(
				`Frozen Bun package metadata is incomplete at ${packagePath}`,
			);
		}
		const identity = frozenPackageIdentity(
			packageJson.name,
			packageJson.version,
		);
		const identityRoots = roots.get(identity) ?? new Set<string>();
		identityRoots.add(realpathSync(packagePath));
		roots.set(identity, identityRoots);
	};

	for (const storeEntry of readdirSync(bunStorePath, { withFileTypes: true })) {
		if (!storeEntry.isDirectory() || storeEntry.isSymbolicLink()) continue;
		const packageParent = join(bunStorePath, storeEntry.name, "node_modules");
		if (!pathEntryExists(packageParent)) continue;
		for (const packageEntry of readdirSync(packageParent, {
			withFileTypes: true,
		})) {
			if (!packageEntry.isDirectory() || packageEntry.isSymbolicLink())
				continue;
			const packagePath = join(packageParent, packageEntry.name);
			if (!packageEntry.name.startsWith("@")) {
				addPackageRoot(packagePath);
				continue;
			}
			for (const scopedEntry of readdirSync(packagePath, {
				withFileTypes: true,
			})) {
				if (!scopedEntry.isDirectory() || scopedEntry.isSymbolicLink())
					continue;
				addPackageRoot(join(packagePath, scopedEntry.name));
			}
		}
	}
	return new Map(
		[...roots].map(([identity, identityRoots]) => [
			identity,
			[...identityRoots],
		]),
	);
}

function frozenPackageIdentity(packageName: string, version: string): string {
	return `${packageName}\0${version}`;
}

function readWorkspacePackageTargets(
	root: string,
): ReadonlyMap<string, string> {
	const rootPackage = readJsonObject(
		join(root, "package.json"),
		"workspace package metadata",
	);
	if (!Array.isArray(rootPackage.workspaces)) {
		throw new Error("Workspace package metadata is missing workspaces");
	}
	const physicalRoot = realpathSync(root);
	const targets = new Map<string, string>();
	const addWorkspacePackage = (relativePath: string): void => {
		const packagePath = resolve(root, relativePath);
		const expectedPhysicalPath = resolve(physicalRoot, relativePath);
		if (
			!isPathInside(physicalRoot, expectedPhysicalPath) ||
			!pathEntryExists(packagePath) ||
			lstatSync(packagePath).isSymbolicLink() ||
			realpathSync(packagePath) !== expectedPhysicalPath
		) {
			throw new Error(
				`Workspace package "${relativePath}" resolves outside the workspace`,
			);
		}
		const packageJsonPath = join(packagePath, "package.json");
		if (!pathEntryExists(packageJsonPath)) return;
		const packageJson = readJsonObject(
			packageJsonPath,
			`workspace package ${relativePath}`,
		);
		if (typeof packageJson.name !== "string") return;
		const existing = targets.get(packageJson.name);
		if (existing && existing !== expectedPhysicalPath) {
			throw new Error(`Duplicate workspace package name "${packageJson.name}"`);
		}
		targets.set(packageJson.name, expectedPhysicalPath);
	};

	for (const pattern of rootPackage.workspaces) {
		if (typeof pattern !== "string") {
			throw new Error("Workspace package paths must be strings");
		}
		if (!pattern.includes("*")) {
			addWorkspacePackage(pattern);
			continue;
		}
		if (!pattern.endsWith("/*") || pattern.slice(0, -2).includes("*")) {
			throw new Error(`Unsupported workspace package pattern "${pattern}"`);
		}
		const parentName = pattern.slice(0, -2);
		const parentPath = join(root, parentName);
		if (!pathEntryExists(parentPath)) continue;
		const physicalParent = realpathSync(parentPath);
		if (physicalParent !== resolve(physicalRoot, parentName)) {
			throw new Error(
				`Workspace package parent "${parentName}" resolves outside the workspace`,
			);
		}
		for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
			addWorkspacePackage(`${parentName}/${entry.name}`);
		}
	}
	return targets;
}

function readJsonObject(path: string, label: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (!isJsonObject(parsed)) throw new Error("root must be an object");
		return parsed;
	} catch (error) {
		throw new Error(`${label} is invalid at ${path}`, { cause: error });
	}
}

function readJsoncObject(path: string, label: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(
			normalizeJsonc(readFileSync(path, "utf8")),
		);
		if (!isJsonObject(parsed)) throw new Error("root must be an object");
		return parsed;
	} catch (error) {
		throw new Error(`${label} is invalid at ${path}`, { cause: error });
	}
}

function normalizeJsonc(source: string): string {
	let withoutComments = "";
	let inString = false;
	let escaped = false;
	for (let index = 0; index < source.length; index++) {
		const character = source[index] ?? "";
		const next = source[index + 1] ?? "";
		if (inString) {
			withoutComments += character;
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}
			continue;
		}
		if (character === '"') {
			inString = true;
			withoutComments += character;
			continue;
		}
		if (character === "/" && next === "/") {
			withoutComments += "  ";
			index += 2;
			while (index < source.length && source[index] !== "\n") {
				withoutComments += " ";
				index++;
			}
			if (index < source.length) withoutComments += "\n";
			continue;
		}
		if (character === "/" && next === "*") {
			withoutComments += "  ";
			index += 2;
			let closed = false;
			while (index < source.length) {
				const commentCharacter = source[index] ?? "";
				const commentNext = source[index + 1] ?? "";
				if (commentCharacter === "*" && commentNext === "/") {
					withoutComments += "  ";
					index++;
					closed = true;
					break;
				}
				withoutComments += commentCharacter === "\n" ? "\n" : " ";
				index++;
			}
			if (!closed) throw new Error("Unterminated JSONC block comment");
			continue;
		}
		withoutComments += character;
	}
	if (inString) throw new Error("Unterminated JSONC string");

	let normalized = "";
	inString = false;
	escaped = false;
	for (let index = 0; index < withoutComments.length; index++) {
		const character = withoutComments[index] ?? "";
		if (inString) {
			normalized += character;
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}
			continue;
		}
		if (character === '"') {
			inString = true;
			normalized += character;
			continue;
		}
		if (character === ",") {
			let nextIndex = index + 1;
			while (/\s/.test(withoutComments[nextIndex] ?? "")) nextIndex++;
			const nextCharacter = withoutComments[nextIndex];
			if (nextCharacter === "}" || nextCharacter === "]") {
				normalized += " ";
				continue;
			}
		}
		normalized += character;
	}
	return normalized;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPathInside(parent: string, candidate: string): boolean {
	return candidate !== parent && candidate.startsWith(`${parent}${sep}`);
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
