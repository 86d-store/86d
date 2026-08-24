import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
	computeIntegrity,
	type FetchModuleCandidate,
} from "@86d-app/registry/fetcher";
import { validateFetchedSubtree } from "@86d-app/registry/integrity";
import type { Lockfile } from "@86d-app/registry/lockfile";
import { parseSpecifier } from "@86d-app/registry/specifier";
import type {
	ModuleSpecifier,
	RegistryManifest,
	ResolvedModule,
	StoreConfig,
} from "@86d-app/registry/types";
import { getProcessEnv } from "env/process-env";

export const REGISTRY_ONLY_MODULES_ENV = "86D_REGISTRY_ONLY_MODULES";
export const REGISTRY_SOURCE_REVISION_ENV = "86D_REGISTRY_SOURCE_REVISION";

export type RegistryOnlyPolicy =
	| { enabled: false }
	| { enabled: true; sourceRevision: string };

export interface RegistryOnlyInputs {
	frozen: boolean;
	config: StoreConfig;
	manifest: RegistryManifest;
	lockfile: Lockfile;
	sourceRevision: string;
}

export interface RegistryOnlyResolvedInputs {
	root: string;
	selected: readonly ModuleSpecifier[];
	resolved: readonly ResolvedModule[];
	manifest: RegistryManifest;
	lockfile: Lockfile;
	expectedPackageMetadata?: RegistryOnlyPackageMetadataByModule;
	/** Candidate bytes to inspect while their stable localPath still names a stub. */
	inspectionPaths?: Readonly<Record<string, string>>;
}

/** Complete semantic package.json content, independent of key order/spacing. */
export type RegistryOnlyPackageMetadata = Readonly<Record<string, unknown>>;

export type RegistryOnlyPackageMetadataByModule = Record<
	string,
	RegistryOnlyPackageMetadata
>;

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const EXACT_NPM_VERSION =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Read the opt-in registry build policy from the process environment. */
export function readRegistryOnlyPolicy(): RegistryOnlyPolicy {
	if (getProcessEnv(REGISTRY_ONLY_MODULES_ENV) !== "true") {
		return { enabled: false };
	}

	const sourceRevision = getProcessEnv(REGISTRY_SOURCE_REVISION_ENV);
	if (!sourceRevision || !FULL_COMMIT_SHA.test(sourceRevision)) {
		throw new Error(
			`${REGISTRY_SOURCE_REVISION_ENV} must be a full 40-character commit SHA when ${REGISTRY_ONLY_MODULES_ENV}=true.`,
		);
	}

	return { enabled: true, sourceRevision };
}

/** Validate immutable source specifiers before registry-only fetching begins. */
export function validateRegistryOnlyInputs(
	inputs: RegistryOnlyInputs,
): ModuleSpecifier[] {
	if (!inputs.frozen) {
		throw new Error("Registry-only module generation requires --frozen.");
	}
	if (!FULL_COMMIT_SHA.test(inputs.sourceRevision)) {
		throw new Error(
			`${REGISTRY_SOURCE_REVISION_ENV} must be a full 40-character commit SHA.`,
		);
	}

	const selected = Array.isArray(inputs.config.modules)
		? inputs.config.modules.map(parseSpecifier)
		: Object.values(inputs.manifest.modules).map((entry) =>
				parseSpecifier(entry.name),
			);

	for (const specifier of selected) {
		if (
			specifier.source === "github" &&
			(!specifier.ref || !FULL_COMMIT_SHA.test(specifier.ref))
		) {
			throw new Error(
				`Registry-only GitHub specifier "${specifier.raw}" must use a full 40-character commit SHA.`,
			);
		}
		if (
			specifier.source === "npm" &&
			(!specifier.version || !EXACT_NPM_VERSION.test(specifier.version))
		) {
			throw new Error(
				`Registry-only npm specifier "${specifier.raw}" must use an exact version (for example, 1.2.3).`,
			);
		}

		const locked = inputs.lockfile.modules[specifier.name];
		if (!locked) {
			throw new Error(
				`Registry lock is missing selected module "${specifier.name}".`,
			);
		}
		if (locked.packageName !== specifier.packageName) {
			throw new Error(
				`Registry lock package mismatch for "${specifier.name}": expected ${specifier.packageName}, found ${locked.packageName}.`,
			);
		}
		if (!locked.version || !locked.integrity) {
			throw new Error(
				`Registry lock must include version and integrity for "${specifier.name}".`,
			);
		}

		switch (specifier.source) {
			case "registry":
			case "local": {
				const entry = inputs.manifest.modules[specifier.name];
				if (!entry) {
					throw new Error(
						`Local registry manifest is missing selected official module "${specifier.name}".`,
					);
				}
				if (entry.commit !== inputs.sourceRevision) {
					throw new Error(
						`Registry manifest commit for "${specifier.name}" (${entry.commit ?? "missing"}) does not match ${REGISTRY_SOURCE_REVISION_ENV} (${inputs.sourceRevision}).`,
					);
				}
				if (entry.name !== specifier.packageName) {
					throw new Error(
						`Registry manifest package mismatch for "${specifier.name}": expected ${specifier.packageName}, found ${entry.name}.`,
					);
				}
				const expectedPath = `modules/${specifier.name}`;
				if (entry.path !== expectedPath || locked.localPath !== entry.path) {
					throw new Error(
						`Registry path mismatch for "${specifier.name}": manifest and lock must both use ${expectedPath}.`,
					);
				}
				if (locked.source !== "local" && locked.source !== "registry") {
					throw new Error(
						`Registry lock source mismatch for official module "${specifier.name}": expected local or registry provenance, found ${locked.source}.`,
					);
				}
				if (
					!entry.subtreeIntegrity ||
					locked.integrity !== entry.subtreeIntegrity
				) {
					throw new Error(
						`Registry integrity metadata mismatch for "${specifier.name}".`,
					);
				}
				// entry.version is the Module contract version. The independently
				// released package version is locked and checked against package.json
				// after the archive bytes have been verified.
				break;
			}
			case "github":
				if (
					locked.source !== "github" ||
					locked.repo !== specifier.repo ||
					locked.ref !== specifier.ref ||
					locked.path !== specifier.path
				) {
					throw new Error(
						`Registry lock metadata mismatch for GitHub module "${specifier.name}".`,
					);
				}
				break;
			case "npm":
				if (locked.source !== "npm" || locked.version !== specifier.version) {
					throw new Error(
						`Registry lock metadata mismatch for npm module "${specifier.name}".`,
					);
				}
				break;
		}
	}

	const selectedNames = new Set(selected.map((specifier) => specifier.name));
	const unselectedLocked = Object.keys(inputs.lockfile.modules).filter(
		(name) => !selectedNames.has(name),
	);
	if (unselectedLocked.length > 0) {
		throw new Error(
			`Registry lock contains unselected modules: ${unselectedLocked.join(", ")}.`,
		);
	}

	return selected;
}

/** Snapshot the prune-stub metadata that archive replacement must preserve. */
export function captureRegistryOnlyPackageMetadata(
	root: string,
	selected: readonly ModuleSpecifier[],
	lockfile: Lockfile,
): RegistryOnlyPackageMetadataByModule {
	const metadata: RegistryOnlyPackageMetadataByModule = {};
	for (const specifier of selected) {
		if (specifier.source !== "registry" && specifier.source !== "local") {
			continue;
		}
		const locked = lockfile.modules[specifier.name];
		if (!locked) {
			throw new Error(
				`Registry lock is missing prune stub "${specifier.name}".`,
			);
		}
		const packagePath = join(root, "modules", specifier.name, "package.json");
		const packageJson = readPackageJson(packagePath, specifier.name);
		const captured = normalizePackageJson(packageJson);
		if (captured.name !== locked.packageName) {
			throw new Error(
				`Registry prune stub package name mismatch for "${specifier.name}".`,
			);
		}
		if (captured.version !== locked.version) {
			throw new Error(
				`Registry prune stub package version mismatch for "${specifier.name}".`,
			);
		}
		metadata[specifier.name] = captured;
	}
	return metadata;
}

/** Validate the fetched bytes and package metadata without changing them. */
export function validateRegistryOnlyResolvedModules(
	inputs: RegistryOnlyResolvedInputs,
): void {
	const resolvedByName = new Map<string, ResolvedModule>();
	for (const module of inputs.resolved) {
		if (resolvedByName.has(module.specifier.name)) {
			throw new Error(
				`Registry-only resolution returned duplicate module "${module.specifier.name}".`,
			);
		}
		resolvedByName.set(module.specifier.name, module);
	}

	for (const specifier of inputs.selected) {
		const module = resolvedByName.get(specifier.name);
		if (module?.status !== "found" || !module.localPath) {
			throw new Error(
				`Registry-only module "${specifier.name}" did not resolve to fetched bytes.`,
			);
		}
		const locked = inputs.lockfile.modules[specifier.name];
		if (!locked) {
			throw new Error(
				`Registry lock is missing resolved module "${specifier.name}".`,
			);
		}
		const actualPath = relative(inputs.root, module.localPath)
			.split(sep)
			.join("/");
		if (
			(locked.localPath && locked.localPath !== actualPath) ||
			(!locked.localPath && specifier.source !== "npm")
		) {
			throw new Error(
				`Registry package path mismatch for "${specifier.name}": expected ${locked.localPath ?? "missing"}, found ${actualPath}.`,
			);
		}

		const inspectionPath =
			inputs.inspectionPaths?.[specifier.name] ?? module.localPath;
		let authenticatedPath = inspectionPath;
		if (specifier.source === "npm") {
			let physicalNodeModulesRoot: string;
			try {
				authenticatedPath = realpathSync(inspectionPath);
				physicalNodeModulesRoot = realpathSync(
					join(inputs.root, "node_modules"),
				);
			} catch (error) {
				throw new Error(
					`Registry npm package target is invalid for "${specifier.name}".`,
					{ cause: error },
				);
			}
			if (
				authenticatedPath === physicalNodeModulesRoot ||
				!authenticatedPath.startsWith(`${physicalNodeModulesRoot}${sep}`)
			) {
				throw new Error(
					`Registry npm package target for "${specifier.name}" resolves outside node_modules.`,
				);
			}
		}
		const authenticatedTree = validateFetchedSubtree(authenticatedPath);
		if (!authenticatedTree.ok) {
			throw new Error(
				`Registry package tree validation failed for "${specifier.name}": ${authenticatedTree.reason}`,
			);
		}
		const packagePath = join(inspectionPath, "package.json");
		if (!existsSync(packagePath)) {
			throw new Error(
				`Registry package metadata is missing for "${specifier.name}" at ${packagePath}.`,
			);
		}
		const packageJson = readPackageJson(packagePath, specifier.name);
		if (
			packageJson.name !== locked.packageName ||
			packageJson.name !== specifier.packageName
		) {
			throw new Error(
				`Registry package name mismatch for "${specifier.name}": expected ${locked.packageName}, found ${String(packageJson.name)}.`,
			);
		}
		if (packageJson.version !== locked.version) {
			throw new Error(
				`Registry package version mismatch for "${specifier.name}": expected ${locked.version ?? "missing"}, found ${String(packageJson.version)}.`,
			);
		}
		const expectedPackageMetadata =
			inputs.expectedPackageMetadata?.[specifier.name];
		if (
			expectedPackageMetadata &&
			!isDeepStrictEqual(
				expectedPackageMetadata,
				normalizePackageJson(packageJson),
			)
		) {
			throw new Error(
				`Registry package.json metadata mismatch for "${specifier.name}": dependency metadata mismatch or non-dependency metadata drift after archive replacement.`,
			);
		}

		const integrity = computeIntegrity(authenticatedPath);
		if (!integrity || integrity !== locked.integrity) {
			throw new Error(
				`Registry integrity bytes mismatch for "${specifier.name}".`,
			);
		}
		if (
			(specifier.source === "registry" || specifier.source === "local") &&
			inputs.manifest.modules[specifier.name]?.subtreeIntegrity !== integrity
		) {
			throw new Error(
				`Registry manifest integrity mismatch for "${specifier.name}".`,
			);
		}
	}

	if (resolvedByName.size !== inputs.selected.length) {
		const selectedNames = new Set(
			inputs.selected.map((specifier) => specifier.name),
		);
		const unexpected = [...resolvedByName.keys()].filter(
			(name) => !selectedNames.has(name),
		);
		throw new Error(
			`Registry-only resolution returned unexpected modules: ${unexpected.join(", ")}.`,
		);
	}
}

/**
 * Apply the resolved-module policy to verified staging directories before the
 * fetcher swaps any prune stub. Stable target paths still drive lock-path
 * validation; package metadata and integrity are read from candidate bytes.
 */
export function validateRegistryOnlyFetchCandidates(
	inputs: RegistryOnlyResolvedInputs,
	candidates: readonly FetchModuleCandidate[],
): void {
	const candidateByName = new Map<string, FetchModuleCandidate>();
	for (const candidate of candidates) {
		const name = candidate.specifier.name;
		if (candidateByName.has(name)) {
			throw new Error(
				`Registry-only fetch returned duplicate candidate "${name}".`,
			);
		}
		candidateByName.set(name, candidate);
	}

	const inspectionPaths: Record<string, string> = {};
	const resolved = inputs.resolved.map((module): ResolvedModule => {
		if (module.status !== "missing" || module.error) return module;
		const candidate = candidateByName.get(module.specifier.name);
		if (!candidate) return module;
		candidateByName.delete(module.specifier.name);
		inspectionPaths[module.specifier.name] = candidate.inspectionPath;
		return {
			...module,
			status: "found",
			localPath: candidate.targetPath,
		};
	});

	if (candidateByName.size > 0) {
		throw new Error(
			`Registry-only fetch returned unexpected candidates: ${[
				...candidateByName.keys(),
			].join(", ")}.`,
		);
	}

	validateRegistryOnlyResolvedModules({
		...inputs,
		resolved,
		inspectionPaths,
	});
}

function readPackageJson(
	packagePath: string,
	moduleName: string,
): Record<string, unknown> {
	if (!existsSync(packagePath)) {
		throw new Error(
			`Registry package metadata is missing for "${moduleName}" at ${packagePath}.`,
		);
	}
	try {
		const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
		if (!isJsonObject(parsed)) {
			throw new Error("package.json root must be an object");
		}
		return parsed;
	} catch (error) {
		throw new Error(
			`Registry package metadata is invalid for "${moduleName}".`,
			{ cause: error },
		);
	}
}

function normalizePackageJson(
	packageJson: Record<string, unknown>,
): RegistryOnlyPackageMetadata {
	return Object.fromEntries(
		Object.keys(packageJson)
			.toSorted((a, b) => a.localeCompare(b))
			.map((key) => [key, normalizeJsonValue(packageJson[key])]),
	);
}

function normalizeJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeJsonValue);
	if (!isJsonObject(value)) return value;
	return normalizePackageJson(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
