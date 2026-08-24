import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateModuleAdmission } from "./admission.js";
import { fetchWithRetry } from "./fetcher.js";
import { DEFAULT_REGISTRY_URL, registryManifestPath } from "./paths.js";
import { parseSpecifier } from "./specifier.js";
import type {
	ModuleSpecifier,
	RegistryManifest,
	ResolvedModule,
	StoreConfig,
} from "./types.js";
import { registryManifestSchema } from "./types.js";

export type ModuleResolutionMode = "prefer-local" | "registry-only";

export interface ResolverOptions {
	/** Absolute path to the monorepo / project root. */
	root: string;
	/** Optional pre-loaded registry manifest (avoids network fetch). */
	manifest?: RegistryManifest;
	/** Whether official modules may resolve from the local workspace. */
	mode?: ModuleResolutionMode;
}

/**
 * Resolve a store config's module list into concrete {@link ResolvedModule} entries.
 *
 * Handles:
 * - `"*"` → all modules from registry + all local workspace modules
 * - Array of specifier strings → parsed and resolved individually
 */
export async function resolveModules(
	config: StoreConfig,
	options: ResolverOptions,
): Promise<ResolvedModule[]> {
	const { root, mode = "prefer-local" } = options;

	// Load manifest (from options, local file, or remote)
	const manifest =
		options.manifest ??
		(mode === "registry-only"
			? loadRequiredLocalManifest(root)
			: await loadManifest(root, config.registry));

	const resolved =
		config.modules === "*" || config.modules === undefined
			? resolveAllModules(root, manifest, mode)
			: resolveSpecifiers(
					config.modules.map(parseSpecifier),
					root,
					manifest,
					mode,
				);

	return applyModuleAdmission(resolved, config, manifest);
}

function applyModuleAdmission(
	resolved: ResolvedModule[],
	config: StoreConfig,
	manifest: RegistryManifest | undefined,
): ResolvedModule[] {
	return resolved.map((result) => {
		if (result.error) return result;
		const manifestEntry = manifest?.modules[result.specifier.name];
		const decision = evaluateModuleAdmission({
			moduleName: result.specifier.packageName,
			modules: config.modules,
			...(manifestEntry ? { maturity: manifestEntry.maturity } : {}),
			...(config.advanced ? { advanced: config.advanced } : {}),
		});
		if (decision.allowed) return result;
		return { ...result, status: "error", error: decision.message };
	});
}

/**
 * Resolve `"*"` — union of all registry modules + all local workspace modules.
 */
function resolveAllModules(
	root: string,
	manifest: RegistryManifest | undefined,
	mode: ModuleResolutionMode,
): ResolvedModule[] {
	const seen = new Set<string>();
	const results: ResolvedModule[] = [];

	// 1. All local workspace modules
	const modulesDir = join(root, "modules");
	if (mode === "prefer-local" && existsSync(modulesDir)) {
		const dirs = readdirSync(modulesDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);

		for (const name of dirs) {
			const localPath = join(modulesDir, name);
			if (!existsSync(join(localPath, "package.json"))) continue;

			seen.add(name);
			results.push({
				specifier: {
					raw: `@86d-app/${name}`,
					source: "local",
					name,
					packageName: `@86d-app/${name}`,
				},
				status: "found",
				localPath,
			});
		}
	}

	// 2. Registry modules not already local
	if (manifest) {
		for (const [name, entry] of Object.entries(manifest.modules)) {
			if (seen.has(name)) continue;
			results.push({
				specifier: {
					raw: entry.name,
					source: "registry",
					name,
					packageName: entry.name,
				},
				status: "missing",
			});
		}
	}

	return results;
}

/**
 * Resolve an explicit list of module specifiers.
 */
function resolveSpecifiers(
	specifiers: ModuleSpecifier[],
	root: string,
	manifest: RegistryManifest | undefined,
	mode: ModuleResolutionMode,
): ResolvedModule[] {
	return specifiers.map((spec) => resolveOne(spec, root, manifest, mode));
}

/**
 * Resolve a single module specifier to a {@link ResolvedModule}.
 *
 * Resolution order for official modules (source === "registry"):
 * 1. Check local workspace (`modules/{name}`)
 * 2. Check registry manifest
 * 3. Mark as missing
 */
function resolveOne(
	spec: ModuleSpecifier,
	root: string,
	manifest: RegistryManifest | undefined,
	mode: ModuleResolutionMode,
): ResolvedModule {
	const modulesDir = join(root, "modules");

	switch (spec.source) {
		case "registry": {
			// Check local workspace first
			const localPath = join(modulesDir, spec.name);
			if (
				mode === "prefer-local" &&
				existsSync(localPath) &&
				existsSync(join(localPath, "package.json"))
			) {
				return {
					specifier: { ...spec, source: "local" },
					status: "found",
					localPath,
				};
			}

			// Check registry
			if (manifest?.modules[spec.name]) {
				return {
					specifier: { ...spec, source: "registry" },
					status: "missing",
				};
			}

			// Unknown module
			return {
				specifier: spec,
				status: "missing",
				error: `Module "${spec.name}" not found locally or in registry. Check the specifier, or use an explicit GitHub or npm source.`,
			};
		}

		case "local": {
			const localPath = join(modulesDir, spec.name);
			if (
				mode === "prefer-local" &&
				existsSync(localPath) &&
				existsSync(join(localPath, "package.json"))
			) {
				return { specifier: spec, status: "found", localPath };
			}

			return {
				specifier: spec,
				status: "missing",
				error: `Local module "${spec.name}" is unavailable in ${mode} mode.`,
			};
		}

		case "github": {
			// Check if already downloaded locally
			const localPath = join(modulesDir, spec.name);
			if (
				mode === "prefer-local" &&
				existsSync(localPath) &&
				existsSync(join(localPath, "package.json"))
			) {
				return {
					specifier: { ...spec, source: "local" },
					status: "found",
					localPath,
				};
			}

			return { specifier: spec, status: "missing" };
		}

		case "npm": {
			// Check if installed in node_modules
			const nmPath = join(root, "node_modules", spec.packageName);
			if (existsSync(nmPath)) {
				return {
					specifier: spec,
					status: "found",
					localPath: nmPath,
				};
			}

			return { specifier: spec, status: "missing" };
		}
	}
}

/**
 * Load a registry manifest from (in order):
 * 1. Local `apps/registry/registry.json`
 * 2. Remote URL (config or default)
 */
async function loadManifest(
	root: string,
	registryUrl?: string,
): Promise<RegistryManifest | undefined> {
	// 1. Try local file
	const localPath = registryManifestPath(root);
	if (existsSync(localPath)) {
		try {
			const raw = JSON.parse(readFileSync(localPath, "utf-8"));
			return registryManifestSchema.parse(raw);
		} catch {
			// Fall through to remote
		}
	}

	// 2. Try remote fetch with retry
	const url = registryUrl ?? DEFAULT_REGISTRY_URL;
	try {
		const res = await fetchWithRetry(url, {
			headers: { "User-Agent": "86d-registry" },
		});
		if (!res.ok) return undefined;
		const raw = await res.json();
		return registryManifestSchema.parse(raw);
	} catch {
		return undefined;
	}
}

function loadRequiredLocalManifest(root: string): RegistryManifest {
	const localPath = registryManifestPath(root);
	if (!existsSync(localPath)) {
		throw new Error(
			`Registry-only module resolution requires a local registry manifest at ${localPath}.`,
		);
	}

	try {
		const raw = JSON.parse(readFileSync(localPath, "utf-8"));
		return registryManifestSchema.parse(raw);
	} catch (error) {
		const detail = error instanceof Error ? ` ${error.message}` : "";
		throw new Error(
			`Registry-only module resolution found an invalid local registry manifest at ${localPath}.${detail}`,
			{ cause: error },
		);
	}
}

/**
 * Get all locally available module names from the `modules/` directory.
 */
export function getLocalModuleNames(root: string): string[] {
	const modulesDir = join(root, "modules");
	if (!existsSync(modulesDir)) return [];

	return readdirSync(modulesDir, { withFileTypes: true })
		.filter(
			(d) =>
				d.isDirectory() && existsSync(join(modulesDir, d.name, "package.json")),
		)
		.map((d) => d.name)
		.sort();
}

/**
 * Read a registry manifest from a local file path.
 */
export function readLocalManifest(
	filePath: string,
): RegistryManifest | undefined {
	try {
		const raw = JSON.parse(readFileSync(filePath, "utf-8"));
		return registryManifestSchema.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Get the full transitive dependency list for a module.
 *
 * Walks the `requires` field in the registry manifest to find all modules
 * that must be installed for `moduleName` to work. Returns module names
 * in installation order (dependencies before dependents).
 *
 * Throws if a circular dependency is detected.
 */
export function getModuleDependencies(
	moduleName: string,
	manifest: RegistryManifest | undefined,
): string[] {
	if (!manifest) return [];

	const modules = manifest.modules;
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const result: string[] = [];

	function walk(name: string, path: string[]) {
		if (inStack.has(name)) {
			const cycleStart = path.indexOf(name);
			const cycle = [...path.slice(cycleStart), name];
			throw new Error(`Circular dependency detected: ${cycle.join(" → ")}`);
		}
		if (visited.has(name)) return;

		visited.add(name);
		inStack.add(name);

		const entry = modules[name];
		if (entry) {
			for (const dep of entry.requires) {
				walk(dep, [...path, name]);
			}
		}

		inStack.delete(name);
		result.push(name);
	}

	walk(moduleName, []);

	// Remove the module itself from its own dependency list
	return result.filter((n) => n !== moduleName);
}

/**
 * Detect circular dependencies across all modules in a manifest.
 *
 * Returns an array of cycle descriptions (empty if no cycles found).
 * Each cycle is a string like "a → b → c → a".
 */
export function detectCircularDependencies(
	manifest: RegistryManifest,
): string[] {
	const cycles: string[] = [];

	for (const name of Object.keys(manifest.modules)) {
		try {
			getModuleDependencies(name, manifest);
		} catch (err) {
			if (err instanceof Error && err.message.includes("Circular")) {
				const cycle = err.message.replace("Circular dependency detected: ", "");
				if (!cycles.includes(cycle)) {
					cycles.push(cycle);
				}
			}
		}
	}

	return cycles;
}
