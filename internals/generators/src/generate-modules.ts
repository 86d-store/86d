#!/usr/bin/env tsx

/**
 * Module Generator Script
 *
 * Generates apps/store/generated/ from templates/config.json
 *
 * Uses @86d-app/registry for module resolution and fetching:
 * - Resolves module specifiers (local, registry, github, npm)
 * - Fetches missing modules from remote sources at buildtime
 * - Generates static imports for all resolved modules
 * - Gracefully skips modules that fail to resolve/fetch
 *
 * Module specifiers in config.json:
 * - "*": All local workspace modules + registry modules
 * - "@86d-app/products": Official module (workspace or registry)
 * - "github:owner/repo/modules/custom": GitHub module
 * - "npm:@scope/package": npm module
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Rewrite emitted `process.env` reads to the env package gateway so generated
 * `api.ts` stays clean under `lint/style/noProcessEnv`.
 */
function rewriteGeneratedProcessEnvAccess(source: string): string {
	return source
		.replace(/process\.env\[("(?:\\.|[^"\\])+")\]/g, "getProcessEnv($1)")
		.replace(/process\.env\.([A-Za-z_][\w]*)/g, 'getProcessEnv("$1")');
}

import { readStoreConfig } from "@86d-app/registry/config";
import {
	type FetchModulesOptions,
	fetchModules,
} from "@86d-app/registry/fetcher";
import {
	generateLockfile,
	isLockfileSatisfied,
	readLockfile,
	verifyLockfile,
	writeLockfile,
} from "@86d-app/registry/lockfile";
import { registryManifestPath } from "@86d-app/registry/paths";
import {
	detectCircularDependencies,
	readLocalManifest,
	resolveModules,
} from "@86d-app/registry/resolver";
import type { ResolvedModule } from "@86d-app/registry/types";
import {
	captureRegistryOnlyPackageMetadata,
	type RegistryOnlyPolicy,
	readRegistryOnlyPolicy,
	validateRegistryOnlyFetchCandidates,
	validateRegistryOnlyInputs,
	validateRegistryOnlyResolvedModules,
} from "./registry-only-policy.js";

interface PackageJson {
	dependencies?: Record<string, string>;
	[key: string]: unknown;
}

interface ModuleInfo {
	name: string;
	packageName: string;
	hasComponents: boolean;
	type: "workspace" | "npm";
}

type ModuleClientEndpointSurface = "admin" | "store";

interface ModuleClientEndpointReference {
	moduleId: string;
	filePath: string;
	surface: ModuleClientEndpointSurface;
	path: string;
}

interface ModuleClientEndpointReferenceConflict {
	moduleId: string;
	filePath: string;
	surface: ModuleClientEndpointSurface;
	path: string;
}

type ModulePathKind =
	| "admin_page"
	| "store_page"
	| "admin_endpoint"
	| "store_endpoint";

interface ModulePathSource {
	moduleId: string;
	/** Package specifier, e.g. "@86d-app/cart". */
	packageName: string;
	/** Workspace modules live in modules/<name>; npm modules are resolved from node_modules. */
	isWorkspace: boolean;
	adminPages?: string[];
	storePages?: string[];
	adminEndpoints?: string[];
	storeEndpoints?: string[];
	/** Component names declared by admin.pages[], e.g. ["CartList", "CartDetail"]. */
	adminPageComponents?: string[];
	/** Component names declared by store.pages[]. */
	storePageComponents?: string[];
}

interface ModulePathConflict {
	kind: ModulePathKind;
	path: string;
	moduleIds: string[];
}

interface Module {
	id: string;
	version: string;
	admin?: { pages?: Array<{ path: string; component: string }> };
	store?: { pages?: Array<{ path: string; component: string }> };
	endpoints?: {
		admin?: Record<string, unknown>;
		store?: Record<string, unknown>;
	};
	search?: { admin?: string; store?: string };
}

import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const WORKSPACE_ROOT = workspaceRootFromImportMeta(import.meta.url);
const STORE_ROOT = join(WORKSPACE_ROOT, "apps/store");
const CONFIG_PATH = join(WORKSPACE_ROOT, "templates/brisa/config.json");
const GENERATED_DIR = join(STORE_ROOT, "generated");
const OUTPUT_PATH = join(GENERATED_DIR, "components.ts");
const API_ROUTER_PATH = join(GENERATED_DIR, "api.ts");
const CLIENT_PATH = join(GENERATED_DIR, "client.ts");
const ADMIN_LOADERS_PATH = join(GENERATED_DIR, "admin-loaders.ts");
const STORE_LOADERS_PATH = join(GENERATED_DIR, "store-loaders.ts");
const TRANSPILE_PACKAGES_PATH = join(GENERATED_DIR, "transpile-packages.json");
const PACKAGE_JSON_PATH = join(STORE_ROOT, "package.json");

function validateUniquePaths(
	sources: ModulePathSource[],
): ModulePathConflict[] {
	const collect = (
		kind: ModulePathKind,
		getPaths: (source: ModulePathSource) => string[] | undefined,
	): ModulePathConflict[] => {
		const ownersByPath = new Map<string, string[]>();
		for (const source of sources) {
			for (const path of getPaths(source) ?? []) {
				const owners = ownersByPath.get(path);
				if (owners) owners.push(source.moduleId);
				else ownersByPath.set(path, [source.moduleId]);
			}
		}
		return [...ownersByPath.entries()]
			.filter(([, moduleIds]) => moduleIds.length > 1)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([path, moduleIds]) => ({ kind, path, moduleIds }));
	};

	return [
		...collect("admin_page", (source) => source.adminPages),
		...collect("store_page", (source) => source.storePages),
		...collect("admin_endpoint", (source) => source.adminEndpoints),
		...collect("store_endpoint", (source) => source.storeEndpoints),
	];
}

function formatPathConflicts(conflicts: ModulePathConflict[]): string[] {
	const describeKind = (kind: ModulePathKind): string => {
		switch (kind) {
			case "admin_page":
				return "admin page";
			case "store_page":
				return "store page";
			case "admin_endpoint":
				return "admin endpoint";
			case "store_endpoint":
				return "store endpoint";
		}
	};

	return conflicts.map((conflict) => {
		const uniqueModuleIds = [...new Set(conflict.moduleIds)];
		const kind = describeKind(conflict.kind);
		if (uniqueModuleIds.length === 1) {
			return `Module "${uniqueModuleIds[0]}" declares ${kind} "${conflict.path}" multiple times.`;
		}
		return `Modules ${uniqueModuleIds.map((moduleId) => `"${moduleId}"`).join(", ")} all declare ${kind} "${conflict.path}".`;
	});
}

function validateModuleClientEndpointReferences(
	source: ModulePathSource,
	references: ModuleClientEndpointReference[],
): ModuleClientEndpointReferenceConflict[] {
	const seen = new Set<string>();
	const conflicts: ModuleClientEndpointReferenceConflict[] = [];

	for (const reference of references) {
		if (reference.moduleId !== source.moduleId) continue;
		const availablePaths = new Set(
			reference.surface === "admin"
				? (source.adminEndpoints ?? [])
				: (source.storeEndpoints ?? []),
		);
		if (availablePaths.has(reference.path)) continue;
		const key = [
			reference.moduleId,
			reference.filePath,
			reference.surface,
			reference.path,
		].join("\0");
		if (seen.has(key)) continue;
		seen.add(key);
		conflicts.push(reference);
	}

	return conflicts.sort((a, b) => {
		const fileComparison = a.filePath.localeCompare(b.filePath);
		if (fileComparison !== 0) return fileComparison;
		const surfaceComparison = a.surface.localeCompare(b.surface);
		if (surfaceComparison !== 0) return surfaceComparison;
		return a.path.localeCompare(b.path);
	});
}

function formatModuleClientEndpointReferenceConflicts(
	conflicts: ModuleClientEndpointReferenceConflict[],
): string[] {
	return conflicts.map((conflict) => {
		const surface =
			conflict.surface === "admin" ? "admin endpoint" : "store endpoint";
		return `Module "${conflict.moduleId}" references missing ${surface} "${conflict.path}" in "${conflict.filePath}".`;
	});
}

/**
 * Ensure a directory exists, creating it if necessary
 */
function ensureDir(dirPath: string) {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

function readPackageJson(): PackageJson {
	return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
}

function writePackageJson(pkg: PackageJson) {
	writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 4));
}

/**
 * Resolve the modules field using the registry package.
 *
 * 1. Read config.json and resolve all module specifiers
 * 2. For missing modules: attempt buildtime fetch from remote sources
 * 3. Return only successfully resolved modules as package name strings
 */
async function resolveModulesFromRegistry(
	policy: RegistryOnlyPolicy,
	frozen: boolean,
): Promise<ResolvedModule[]> {
	const config = readStoreConfig(CONFIG_PATH);
	const manifestPath = registryManifestPath(WORKSPACE_ROOT);
	const manifest = readLocalManifest(manifestPath);
	let strictSelection:
		| ReturnType<typeof validateRegistryOnlyInputs>
		| undefined;
	let strictPackageMetadata:
		| ReturnType<typeof captureRegistryOnlyPackageMetadata>
		| undefined;
	let strictLock: ReturnType<typeof readLockfile>;
	if (policy.enabled) {
		if (!manifest) {
			throw new Error(
				`Registry-only module generation requires a valid local registry manifest at ${manifestPath}.`,
			);
		}
		strictLock = readLockfile(WORKSPACE_ROOT);
		if (!strictLock) {
			throw new Error(
				"Registry-only module generation requires a valid apps/registry/registry.lock.json.",
			);
		}
		strictSelection = validateRegistryOnlyInputs({
			frozen,
			config,
			manifest,
			lockfile: strictLock,
			sourceRevision: policy.sourceRevision,
		});
		strictPackageMetadata = captureRegistryOnlyPackageMetadata(
			WORKSPACE_ROOT,
			strictSelection,
			strictLock,
		);
	}

	// Resolve specifiers against local workspace + registry manifest
	const resolved = await resolveModules(config, {
		root: WORKSPACE_ROOT,
		...(manifest ? { manifest } : {}),
		mode: policy.enabled ? "registry-only" : "prefer-local",
	});
	if (policy.enabled) {
		const failures = resolved.filter(
			(module) => module.status === "error" || Boolean(module.error),
		);
		if (failures.length > 0) {
			throw new Error(
				`Registry-only module resolution failed:\n${failures
					.map(
						(module) =>
							`  ${module.specifier.raw}: ${module.error ?? module.status}`,
					)
					.join("\n")}`,
			);
		}
	}

	const toFetch: ResolvedModule[] = [];

	for (const mod of resolved) {
		if (mod.status === "missing" && !mod.error) {
			// Module exists in registry/github/npm but not locally — can be fetched
			toFetch.push(mod);
		} else if (mod.status !== "found") {
			// Truly missing (not in registry, or has error) — skip with warning
			console.warn(
				`⚠ Module "${mod.specifier.raw}" not found — skipping${mod.error ? `: ${mod.error}` : ""}`,
			);
		}
	}

	let strictFetchOptions: FetchModulesOptions | undefined;
	const prevalidatedPreservedNodeModules = new Set<string>();
	if (policy.enabled) {
		if (
			!manifest ||
			!strictLock ||
			!strictSelection ||
			!strictPackageMetadata
		) {
			throw new Error("Registry-only validation state was not initialized.");
		}
		const selectionForFetch = strictSelection;
		const lockForFetch = strictLock;
		const metadataForFetch = strictPackageMetadata;
		const modulesWithFrozenDependencyState = new Set(
			Object.keys(metadataForFetch),
		);
		strictFetchOptions = {
			replaceExisting: true,
			preserveExistingNodeModules: modulesWithFrozenDependencyState,
			allowPackageManagerMutation: false,
			validateBeforeCommit: (candidates) => {
				validateRegistryOnlyFetchCandidates(
					{
						root: WORKSPACE_ROOT,
						selected: selectionForFetch,
						resolved,
						manifest,
						lockfile: lockForFetch,
						expectedPackageMetadata: metadataForFetch,
					},
					candidates,
				);
				for (const candidate of candidates) {
					if (
						candidate.staged &&
						modulesWithFrozenDependencyState.has(candidate.specifier.name)
					) {
						prevalidatedPreservedNodeModules.add(candidate.specifier.name);
					}
				}
			},
		};
	}

	let fetchResults: Awaited<ReturnType<typeof fetchModules>> = [];
	if (toFetch.length > 0) {
		fetchResults = await fetchModules(
			toFetch.map((module) => module.specifier),
			WORKSPACE_ROOT,
			manifest,
			strictFetchOptions,
		);
		if (policy.enabled && fetchResults.some((result) => !result.success)) {
			throw new Error(
				`Registry-only module fetch failed:\n${fetchResults
					.map((result, index) => ({ result, module: toFetch[index] }))
					.filter(({ result }) => !result.success)
					.map(
						({ result, module }) =>
							`  ${module?.specifier.raw ?? "unknown"}: ${result.error ?? "unknown error"}`,
					)
					.join("\n")}`,
			);
		}
	}

	let fetchIndex = 0;
	const found: ResolvedModule[] = [];
	for (const module of resolved) {
		if (module.status === "found") {
			found.push(module);
			continue;
		}
		if (module.status !== "missing" || module.error) continue;
		const result = fetchResults[fetchIndex++];
		if (result?.success && result.localPath) {
			found.push({ ...module, status: "found", localPath: result.localPath });
		} else if (!policy.enabled) {
			console.warn(
				`  ⚠ Failed to fetch ${module.specifier.packageName}: ${result?.error ?? "unknown error"} — skipping`,
			);
		}
	}

	if (policy.enabled) {
		if (
			!manifest ||
			!strictLock ||
			!strictSelection ||
			!strictPackageMetadata
		) {
			throw new Error("Registry-only validation state was not initialized.");
		}
		validateRegistryOnlyResolvedModules({
			root: WORKSPACE_ROOT,
			selected: strictSelection,
			resolved: found,
			manifest,
			lockfile: strictLock,
			expectedPackageMetadata: strictPackageMetadata,
			prevalidatedPreservedNodeModules,
		});
	}

	return found;
}

/**
 * Convert resolved modules to the package name list the generators expect.
 */
function resolvedToPackageNames(resolved: ResolvedModule[]): string[] {
	return resolved.map((m) => m.specifier.packageName);
}

function isWorkspaceModule(moduleName: string): boolean {
	// Check if module exists in workspace
	const moduleShortName = moduleName.replace("@86d-app/", "");
	const workspaceModulePath = join(
		WORKSPACE_ROOT,
		"modules",
		moduleShortName,
		"package.json",
	);
	return existsSync(workspaceModulePath);
}

function getModuleType(moduleName: string): "workspace" | "npm" {
	if (moduleName.startsWith("@86d-app/") && isWorkspaceModule(moduleName)) {
		return "workspace";
	}
	return "npm";
}

async function checkModuleHasComponents(
	moduleName: string,
	moduleType: "workspace" | "npm",
): Promise<boolean> {
	if (moduleType === "workspace") {
		const moduleShortName = moduleName.replace("@86d-app/", "");
		const basePath = join(WORKSPACE_ROOT, "modules", moduleShortName, "src");
		const storeComponentsPath = join(
			basePath,
			"store",
			"components",
			"mdx.tsx",
		);

		if (existsSync(storeComponentsPath)) {
			const content = readFileSync(storeComponentsPath, "utf-8");
			if (content.trim().length > 0) return true;
		}
		return false;
	}

	try {
		const modulePath = join(WORKSPACE_ROOT, "node_modules", moduleName);
		const paths = [
			join(modulePath, "src/store/components/mdx.tsx"),
			join(modulePath, "src/store/components.tsx"),
		];
		for (const p of paths) {
			if (existsSync(p)) {
				const content = readFileSync(p, "utf-8");
				if (content.trim().length > 0) return true;
			}
		}
		return true;
	} catch {
		return true;
	}
}

async function ensureModuleDependencies(
	modules: string[],
	allowMutation: boolean,
) {
	const packageJson = readPackageJson();
	const dependencies = packageJson.dependencies || {};
	let modified = false;

	for (const moduleName of modules) {
		const moduleType = getModuleType(moduleName);

		if (moduleType === "workspace") {
			// Ensure workspace module is in dependencies as workspace:*
			if (!dependencies[moduleName]) {
				dependencies[moduleName] = "workspace:*";
				modified = true;
			}
		} else {
			// For npm modules, add to dependencies if not present
			if (!dependencies[moduleName]) {
				dependencies[moduleName] = "latest";
				modified = true;
			}
		}
	}

	if (modified) {
		if (!allowMutation) {
			throw new Error(
				"Registry-only module generation will not update apps/store/package.json or run a package manager. Add every selected Module dependency before the frozen build.",
			);
		}
		packageJson.dependencies = dependencies;
		writePackageJson(packageJson);
		try {
			execSync("bun install", {
				cwd: WORKSPACE_ROOT,
				stdio: "inherit",
			});
		} catch (error) {
			console.error("Failed to install dependencies:", error);
			process.exit(1);
		}
	}
}

async function generateModulesFile() {
	const modules = getCachedModules();

	if (modules.length === 0) {
		// Even with no modules, template component overrides can still provide components
		const templateDir = join(CONFIG_PATH, "..");
		const templateOverridePath = join(templateDir, "components", "mdx.tsx");
		const hasOverrides = existsSync(templateOverridePath);
		const emptyContent = hasOverrides
			? `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate

import type { MDXComponents } from "mdx/types";
import templateOverrides from "template/components/mdx";

export const modules: string[] = [];
export const components: MDXComponents = { ...templateOverrides };
`
			: `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate

import type { MDXComponents } from "mdx/types";

export const modules: string[] = [];
export const components: MDXComponents = {};
`;
		ensureDir(GENERATED_DIR);
		writeFileSync(OUTPUT_PATH, emptyContent);
		return;
	}

	// Gather module info
	const moduleInfos: ModuleInfo[] = await Promise.all(
		modules.map(async (moduleName) => {
			const moduleType = getModuleType(moduleName);
			return {
				name: moduleName,
				hasComponents: await checkModuleHasComponents(moduleName, moduleType),
				type: moduleType,
			};
		}),
	);

	// Filter to only modules with components
	const modulesWithComponents = moduleInfos.filter((m) => m.hasComponents);

	// Generate imports
	const imports = modulesWithComponents
		.map(
			(mod, idx) =>
				`import moduleComponents${idx} from "${mod.name}/components";`,
		)
		.join("\n");

	// Detect template component overrides
	const templateDir = join(CONFIG_PATH, "..");
	const templateOverridePath = join(templateDir, "components", "mdx.tsx");
	const hasTemplateOverrides = existsSync(templateOverridePath);

	const templateImport = hasTemplateOverrides
		? `import templateOverrides from "template/components/mdx";`
		: "";

	// Generate merge logic — template overrides are spread last so they take precedence
	const moduleSpread = modulesWithComponents
		.map((_, idx) => `...moduleComponents${idx},`)
		.join("\n    ");
	const templateSpread = hasTemplateOverrides ? "...templateOverrides," : "";
	const allSpreads = [moduleSpread, templateSpread]
		.filter(Boolean)
		.join("\n    ");

	const componentsMerge =
		modulesWithComponents.length > 0 || hasTemplateOverrides
			? `const components: MDXComponents = {
    ${allSpreads}
};`
			: `const components: MDXComponents = {};`;

	// Generate module list with type annotations
	const moduleList = modules.map((m) => `    "${m}"`).join(",\n");

	// Generate file content
	const allImports = [imports, templateImport].filter(Boolean).join("\n");

	const content = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate
// Generated from: ${CONFIG_PATH}

import type { MDXComponents } from "mdx/types";
${allImports}

export const modules = [
${moduleList}
] as const;

${componentsMerge}

export { components };
`;

	ensureDir(GENERATED_DIR);
	writeFileSync(OUTPUT_PATH, content);

	// Log module types for transparency
	const _workspaceCount = moduleInfos.filter(
		(m) => m.type === "workspace",
	).length;
	const _npmCount = moduleInfos.filter((m) => m.type === "npm").length;

	if (modulesWithComponents.length < modules.length) {
		const _skipped = modules.length - modulesWithComponents.length;
	}
}

async function generateApiRouter() {
	const config = readStoreConfig(CONFIG_PATH);
	const modules = getCachedModules();
	const pathSources = getCachedPathSources();
	const moduleOptions = config.moduleOptions || {};

	if (modules.length === 0) {
		// Generate empty router
		const emptyContent = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate

import { createRouter } from "better-call";

const modules: any[] = [];

const allEndpoints = {};

export const router = createRouter(allEndpoints);

export type Router = typeof router;
`;
		ensureDir(GENERATED_DIR);
		writeFileSync(API_ROUTER_PATH, emptyContent);
		return;
	}

	// Generate module imports
	const hasStripe = modules.includes("@86d-app/stripe");
	const hasPayPal = modules.includes("@86d-app/paypal");
	const hasSquare = modules.includes("@86d-app/square");
	const hasBraintree = modules.includes("@86d-app/braintree");

	const moduleImports = [
		...modules.map(
			(moduleName, idx) => `import module${idx} from "${moduleName}";`,
		),
		...(hasPayPal
			? [
					`import { PayPalPaymentConnectionProvider } from "@86d-app/paypal/connection-provider";`,
				]
			: []),
	].join("\n");

	const pathPatterns: Array<{ pattern: string; moduleId: string }> = [];
	for (const source of pathSources) {
		for (const path of source.storeEndpoints ?? []) {
			pathPatterns.push({ pattern: path, moduleId: source.moduleId });
		}
		for (const path of source.adminEndpoints ?? []) {
			pathPatterns.push({ pattern: path, moduleId: source.moduleId });
		}
	}
	pathPatterns.sort((a, b) => {
		const len = b.pattern.length - a.pattern.length;
		if (len !== 0) return len;
		const patternCmp = a.pattern.localeCompare(b.pattern);
		if (patternCmp !== 0) return patternCmp;
		return a.moduleId.localeCompare(b.moduleId);
	});

	const pathPatternsJson = JSON.stringify(pathPatterns, null, 2);

	// Generate module instantiation — cast options since moduleOptions is a flat Record
	// and some modules (stripe, square, paypal, braintree) have required option properties.
	const moduleInstances = modules
		.map((moduleName, idx) => {
			const optionsKey = moduleName;
			return `  module${idx}((moduleOptions["${optionsKey}"] ?? {}) as Parameters<typeof module${idx}>[0]),`;
		})
		.join("\n");

	// Detect which payment provider modules are present so we can generate wiring code
	const hasAnyProvider = hasStripe || hasPayPal || hasSquare || hasBraintree;

	// Configure provider Integration modules only. Payments intentionally receives
	// no implicit provider: v2 execution requires a named, connection-bound adapter.
	let providerWiringCode = "";
	if (hasAnyProvider) {
		const blocks: string[] = [];

		if (hasStripe) {
			blocks.push(`// Wire Stripe options from env vars
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
  moduleOptions["@86d-app/stripe"] = {
    ...moduleOptions["@86d-app/stripe"],
    apiKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  };
}`);
		}
		if (hasPayPal) {
			blocks.push(`// Wire PayPal options from env vars
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID) {
  moduleOptions["@86d-app/paypal"] = {
    ...moduleOptions["@86d-app/paypal"],
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    sandbox: process.env.PAYPAL_SANDBOX ?? "",
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
    ...(process.env.PAYPAL_CONNECTION_ID ? { connectionId: process.env.PAYPAL_CONNECTION_ID } : {}),
    ...(process.env["86D_STORE_ID"] ? { storeId: process.env["86D_STORE_ID"] } : {}),
  };
}
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_CONNECTION_ID && process.env.PAYPAL_PROVIDER_ACCOUNT_ID) {
  const paypalConnectionId = process.env.PAYPAL_CONNECTION_ID!;
  const paypalProviderAccountId = process.env.PAYPAL_PROVIDER_ACCOUNT_ID!;
  const paypalClientId = process.env.PAYPAL_CLIENT_ID!;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const paypalConnection = new PayPalPaymentConnectionProvider({
    connectionId: paypalConnectionId,
    providerAccountId: paypalProviderAccountId,
    clientId: paypalClientId,
    clientSecret: paypalClientSecret,
    mode: process.env.PAYPAL_SANDBOX === "true" ? "test" : "live",
    // The payer returns to this Store, never to a caller-supplied address. The
    // provider rejects a non-HTTPS or credential-bearing URL, so a misconfigured
    // APP_URL fails closed at construction instead of redirecting a payer off-Store.
    returnUrl: (process.env.APP_URL ?? "") + "/checkout/confirmation",
    cancelUrl: (process.env.APP_URL ?? "") + "/checkout",
  });
  moduleOptions["@86d-app/payments"] = {
    ...moduleOptions["@86d-app/payments"],
    connectionProviders: [
      ...((moduleOptions["@86d-app/payments"]?.connectionProviders as unknown[]) ?? []),
      paypalConnection,
    ],
  };
}`);
		}
		if (hasSquare) {
			blocks.push(`// Wire Square options from env vars
if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && process.env.SQUARE_WEBHOOK_NOTIFICATION_URL) {
  moduleOptions["@86d-app/square"] = {
    ...moduleOptions["@86d-app/square"],
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    webhookNotificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
  };
}`);
		}
		if (hasBraintree) {
			blocks.push(`// Wire Braintree options from env vars
if (process.env.BRAINTREE_MERCHANT_ID && process.env.BRAINTREE_PUBLIC_KEY && process.env.BRAINTREE_PRIVATE_KEY) {
  moduleOptions["@86d-app/braintree"] = {
    ...moduleOptions["@86d-app/braintree"],
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
    sandbox: process.env.BRAINTREE_SANDBOX ?? "",
  };
}`);
		}

		providerWiringCode = `\n// ── Payment Integration configuration (no implicit Payments routing) ──\n${blocks.join("\n\n")}\n`;
	}

	// Generate search module AI wiring code
	const hasSearch = modules.includes("@86d-app/search");
	let searchWiringCode = "";
	if (hasSearch) {
		searchWiringCode = `
// ── Search module wiring (MeiliSearch + AI embeddings, env-var based) ──
if (process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY) {
  moduleOptions["@86d-app/search"] = {
    ...moduleOptions["@86d-app/search"],
    meilisearchHost: process.env.MEILISEARCH_HOST,
    meilisearchApiKey: process.env.MEILISEARCH_API_KEY,
  };
}
if (process.env.OPENAI_API_KEY) {
  moduleOptions["@86d-app/search"] = {
    ...moduleOptions["@86d-app/search"],
    openaiApiKey: process.env.OPENAI_API_KEY,
  };
} else if (process.env.OPENROUTER_API_KEY) {
  moduleOptions["@86d-app/search"] = {
    ...moduleOptions["@86d-app/search"],
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  };
}
`;
	}

	// Generate Toast POS wiring code
	const hasToast = modules.includes("@86d-app/toast");
	let toastWiringCode = "";
	if (hasToast) {
		toastWiringCode = `
// ── Toast POS wiring (env-var based) ──
if (process.env.TOAST_API_KEY && process.env.TOAST_RESTAURANT_GUID) {
  moduleOptions["@86d-app/toast"] = {
    ...moduleOptions["@86d-app/toast"],
    apiKey: process.env.TOAST_API_KEY,
    restaurantGuid: process.env.TOAST_RESTAURANT_GUID,
    ...(process.env.TOAST_SANDBOX !== undefined ? { sandbox: process.env.TOAST_SANDBOX } : {}),
  };
}
`;
	}

	// Generate shipping module wiring code (EasyPost)
	const hasShipping = modules.includes("@86d-app/shipping");
	let shippingWiringCode = "";
	if (hasShipping) {
		shippingWiringCode = `
// ── Shipping module wiring (EasyPost, env-var based) ──
if (process.env.EASYPOST_API_KEY) {
  moduleOptions["@86d-app/shipping"] = {
    ...moduleOptions["@86d-app/shipping"],
    easypostApiKey: process.env.EASYPOST_API_KEY,
    easypostTestMode: process.env.EASYPOST_TEST_MODE !== "false",
    easypostWebhookSecret: process.env.EASYPOST_WEBHOOK_SECRET ?? "",
  };
}
`;
	}

	// Generate tax module wiring code (TaxJar)
	const hasTax = modules.includes("@86d-app/tax");
	let taxWiringCode = "";
	if (hasTax) {
		taxWiringCode = `
// ── Tax module wiring (TaxJar, env-var based) ──
if (process.env.TAXJAR_API_KEY) {
  moduleOptions["@86d-app/tax"] = {
    ...moduleOptions["@86d-app/tax"],
    taxjarApiKey: process.env.TAXJAR_API_KEY,
    taxjarSandbox: process.env.TAXJAR_SANDBOX === "true",
  };
}
`;
	}

	// Generate notifications module wiring code (Resend + Twilio)
	const hasNotifications = modules.includes("@86d-app/notifications");
	let notificationsWiringCode = "";
	if (hasNotifications) {
		notificationsWiringCode = `
// ── Notifications module wiring (Resend email + Twilio SMS, env-var based) ──
if (process.env.RESEND_API_KEY) {
  moduleOptions["@86d-app/notifications"] = {
    ...moduleOptions["@86d-app/notifications"],
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromAddress: process.env.RESEND_FROM_ADDRESS ?? "Store <noreply@example.com>",
  };
}
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  moduleOptions["@86d-app/notifications"] = {
    ...moduleOptions["@86d-app/notifications"],
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  };
}
`;
	}

	// Generate DoorDash Drive wiring code
	const hasDoordash = modules.includes("@86d-app/doordash");
	let doordashWiringCode = "";
	if (hasDoordash) {
		doordashWiringCode = `
// ── DoorDash Drive wiring (env-var based) ──
if (process.env.DOORDASH_DEVELOPER_ID && process.env.DOORDASH_KEY_ID && process.env.DOORDASH_SIGNING_SECRET) {
  moduleOptions["@86d-app/doordash"] = {
    ...moduleOptions["@86d-app/doordash"],
    developerId: process.env.DOORDASH_DEVELOPER_ID,
    keyId: process.env.DOORDASH_KEY_ID,
    signingSecret: process.env.DOORDASH_SIGNING_SECRET,
    ...(process.env.DOORDASH_SANDBOX !== undefined ? { sandbox: process.env.DOORDASH_SANDBOX === "true" } : {}),
  };
}
`;
	}

	// Generate Uber Direct wiring code
	const hasUberDirect = modules.includes("@86d-app/uber-direct");
	let uberDirectWiringCode = "";
	if (hasUberDirect) {
		uberDirectWiringCode = `
// ── Uber Direct wiring (env-var based) ──
if (process.env.UBER_CLIENT_ID && process.env.UBER_CLIENT_SECRET && process.env.UBER_CUSTOMER_ID) {
  moduleOptions["@86d-app/uber-direct"] = {
    ...moduleOptions["@86d-app/uber-direct"],
    clientId: process.env.UBER_CLIENT_ID,
    clientSecret: process.env.UBER_CLIENT_SECRET,
    customerId: process.env.UBER_CUSTOMER_ID,
    webhookSigningKey: process.env.UBER_DIRECT_WEBHOOK_SIGNING_KEY ?? "",
  };
}
`;
	}

	// Generate Recommendations module wiring code (AI embeddings)
	const hasRecommendations = modules.includes("@86d-app/recommendations");
	let recommendationsWiringCode = "";
	if (hasRecommendations) {
		recommendationsWiringCode = `
// ── Recommendations module wiring (AI embeddings, env-var based) ──
if (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY) {
  moduleOptions["@86d-app/recommendations"] = {
    ...moduleOptions["@86d-app/recommendations"],
    ...(process.env.OPENAI_API_KEY ? { openaiApiKey: process.env.OPENAI_API_KEY } : {}),
    ...(process.env.OPENROUTER_API_KEY ? { openrouterApiKey: process.env.OPENROUTER_API_KEY } : {}),
  };
}
`;
	}

	// Generate analytics module wiring code (GTM, GA4, Sentry)
	const hasAnalytics = modules.includes("@86d-app/analytics");
	let analyticsWiringCode = "";
	if (hasAnalytics) {
		analyticsWiringCode = `
// ── Analytics module wiring (GTM, GA4 Measurement Protocol, Sentry — env-var based) ──
if (process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID || process.env.GA4_MEASUREMENT_ID || process.env.SENTRY_DSN) {
  moduleOptions["@86d-app/analytics"] = {
    ...moduleOptions["@86d-app/analytics"],
    ...(process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID ? { gtmContainerId: process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID } : {}),
    ...(process.env.GA4_MEASUREMENT_ID ? { ga4MeasurementId: process.env.GA4_MEASUREMENT_ID } : {}),
    ...(process.env.GA4_API_SECRET ? { ga4ApiSecret: process.env.GA4_API_SECRET } : {}),
    ...(process.env.SENTRY_DSN ? { sentryDsn: process.env.SENTRY_DSN } : {}),
  };
}
`;
	}

	// Generate Amazon SP-API wiring code
	const hasAmazon = modules.includes("@86d-app/amazon");
	let amazonWiringCode = "";
	if (hasAmazon) {
		amazonWiringCode = `
// ── Amazon SP-API wiring (env-var based) ──
if (process.env.AMAZON_SELLER_ID && process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET && process.env.AMAZON_REFRESH_TOKEN) {
  moduleOptions["@86d-app/amazon"] = {
    ...moduleOptions["@86d-app/amazon"],
    sellerId: process.env.AMAZON_SELLER_ID,
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN,
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID ?? "ATVPDKIKX0DER",
    region: process.env.AMAZON_REGION ?? "NA",
  };
}
`;
	}

	// Generate TikTok Shop wiring code
	const hasTiktokShop = modules.includes("@86d-app/tiktok-shop");
	let tiktokShopWiringCode = "";
	if (hasTiktokShop) {
		tiktokShopWiringCode = `
// ── TikTok Shop wiring (env-var based) ──
if (process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_SHOP_ID) {
  moduleOptions["@86d-app/tiktok-shop"] = {
    ...moduleOptions["@86d-app/tiktok-shop"],
    appKey: process.env.TIKTOK_APP_KEY,
    appSecret: process.env.TIKTOK_APP_SECRET,
    accessToken: process.env.TIKTOK_ACCESS_TOKEN,
    shopId: process.env.TIKTOK_SHOP_ID,
    ...(process.env.TIKTOK_SANDBOX !== undefined ? { sandbox: process.env.TIKTOK_SANDBOX } : {}),
  };
}
`;
	}

	// Generate Google Shopping wiring code
	const hasGoogleShopping = modules.includes("@86d-app/google-shopping");
	let googleShoppingWiringCode = "";
	if (hasGoogleShopping) {
		googleShoppingWiringCode = `
// ── Google Shopping wiring (env-var based) ──
if (process.env.GOOGLE_MERCHANT_ID && process.env.GOOGLE_MERCHANT_API_KEY) {
  moduleOptions["@86d-app/google-shopping"] = {
    ...moduleOptions["@86d-app/google-shopping"],
    merchantId: process.env.GOOGLE_MERCHANT_ID,
    apiKey: process.env.GOOGLE_MERCHANT_API_KEY,
    ...(process.env.GOOGLE_MERCHANT_TARGET_COUNTRY ? { targetCountry: process.env.GOOGLE_MERCHANT_TARGET_COUNTRY } : {}),
    ...(process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE ? { contentLanguage: process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE } : {}),
  };
}
`;
	}

	// Generate Facebook Shop wiring code
	const hasFacebookShop = modules.includes("@86d-app/facebook-shop");
	let facebookShopWiringCode = "";
	if (hasFacebookShop) {
		facebookShopWiringCode = `
// ── Facebook Shop wiring (env-var based) ──
if (process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_CATALOG_ID && process.env.FACEBOOK_COMMERCE_ACCOUNT_ID) {
  moduleOptions["@86d-app/facebook-shop"] = {
    ...moduleOptions["@86d-app/facebook-shop"],
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    catalogId: process.env.FACEBOOK_CATALOG_ID,
    commerceAccountId: process.env.FACEBOOK_COMMERCE_ACCOUNT_ID,
    ...(process.env.FACEBOOK_PAGE_ID ? { pageId: process.env.FACEBOOK_PAGE_ID } : {}),
  };
}
`;
	}

	// Generate Instagram Shop wiring code
	const hasInstagramShop = modules.includes("@86d-app/instagram-shop");
	let instagramShopWiringCode = "";
	if (hasInstagramShop) {
		instagramShopWiringCode = `
// ── Instagram Shop wiring (env-var based) ──
if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_CATALOG_ID && process.env.INSTAGRAM_COMMERCE_ACCOUNT_ID) {
  moduleOptions["@86d-app/instagram-shop"] = {
    ...moduleOptions["@86d-app/instagram-shop"],
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    catalogId: process.env.INSTAGRAM_CATALOG_ID,
    commerceAccountId: process.env.INSTAGRAM_COMMERCE_ACCOUNT_ID,
    ...(process.env.INSTAGRAM_BUSINESS_ID ? { businessId: process.env.INSTAGRAM_BUSINESS_ID } : {}),
  };
}
`;
	}

	// Generate Etsy wiring code
	const hasEtsy = modules.includes("@86d-app/etsy");
	let etsyWiringCode = "";
	if (hasEtsy) {
		etsyWiringCode = `
// ── Etsy API wiring (env-var based) ──
if (process.env.ETSY_API_KEY && process.env.ETSY_SHOP_ID && process.env.ETSY_ACCESS_TOKEN) {
  moduleOptions["@86d-app/etsy"] = {
    ...moduleOptions["@86d-app/etsy"],
    apiKey: process.env.ETSY_API_KEY,
    shopId: process.env.ETSY_SHOP_ID,
    accessToken: process.env.ETSY_ACCESS_TOKEN,
  };
}
`;
	}

	// Generate eBay wiring code
	const hasEbay = modules.includes("@86d-app/ebay");
	let ebayWiringCode = "";
	if (hasEbay) {
		ebayWiringCode = `
// ── eBay API wiring (env-var based) ──
if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REFRESH_TOKEN) {
  moduleOptions["@86d-app/ebay"] = {
    ...moduleOptions["@86d-app/ebay"],
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    refreshToken: process.env.EBAY_REFRESH_TOKEN,
    ...(process.env.EBAY_SITE_ID ? { siteId: process.env.EBAY_SITE_ID } : {}),
  };
}
`;
	}

	// Generate Walmart wiring code
	const hasWalmart = modules.includes("@86d-app/walmart");
	let walmartWiringCode = "";
	if (hasWalmart) {
		walmartWiringCode = `
// ── Walmart Marketplace wiring (env-var based) ──
if (process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET) {
  moduleOptions["@86d-app/walmart"] = {
    ...moduleOptions["@86d-app/walmart"],
    clientId: process.env.WALMART_CLIENT_ID,
    clientSecret: process.env.WALMART_CLIENT_SECRET,
    ...(process.env.WALMART_CHANNEL_TYPE ? { channelType: process.env.WALMART_CHANNEL_TYPE } : {}),
  };
}
`;
	}

	// Generate Pinterest Shop wiring code
	const hasPinterestShop = modules.includes("@86d-app/pinterest-shop");
	let pinterestShopWiringCode = "";
	if (hasPinterestShop) {
		pinterestShopWiringCode = `
// ── Pinterest Shop wiring (env-var based) ──
if (process.env.PINTEREST_ACCESS_TOKEN) {
  moduleOptions["@86d-app/pinterest-shop"] = {
    ...moduleOptions["@86d-app/pinterest-shop"],
    accessToken: process.env.PINTEREST_ACCESS_TOKEN,
    ...(process.env.PINTEREST_AD_ACCOUNT_ID ? { adAccountId: process.env.PINTEREST_AD_ACCOUNT_ID } : {}),
    ...(process.env.PINTEREST_CATALOG_ID ? { catalogId: process.env.PINTEREST_CATALOG_ID } : {}),
  };
}
`;
	}

	// Generate X Shop wiring code
	const hasXShop = modules.includes("@86d-app/x-shop");
	let xShopWiringCode = "";
	if (hasXShop) {
		xShopWiringCode = `
// ── X (Twitter) Shop wiring (env-var based) ──
if (process.env.X_API_KEY && process.env.X_API_SECRET) {
  moduleOptions["@86d-app/x-shop"] = {
    ...moduleOptions["@86d-app/x-shop"],
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    ...(process.env.X_ACCESS_TOKEN ? { accessToken: process.env.X_ACCESS_TOKEN } : {}),
    ...(process.env.X_REFRESH_TOKEN ? { refreshToken: process.env.X_REFRESH_TOKEN } : {}),
    ...(process.env.X_MERCHANT_ID ? { merchantId: process.env.X_MERCHANT_ID } : {}),
  };
}
`;
	}

	// Generate Uber Eats wiring code
	const hasUberEats = modules.includes("@86d-app/uber-eats");
	let uberEatsWiringCode = "";
	if (hasUberEats) {
		uberEatsWiringCode = `
// ── Uber Eats wiring (env-var based) ──
if (process.env.UBER_EATS_CLIENT_ID && process.env.UBER_EATS_CLIENT_SECRET && process.env.UBER_EATS_RESTAURANT_ID) {
  moduleOptions["@86d-app/uber-eats"] = {
    ...moduleOptions["@86d-app/uber-eats"],
    clientId: process.env.UBER_EATS_CLIENT_ID,
    clientSecret: process.env.UBER_EATS_CLIENT_SECRET,
    restaurantId: process.env.UBER_EATS_RESTAURANT_ID,
  };
}
`;
	}

	// Generate API router content
	const routerContent = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate
// Generated from: ${CONFIG_PATH}

import { createRouter } from "better-call";
import type { Endpoint, RouterConfig } from "better-call";
import type { ModuleContext } from "@86d-app/core/types/module";
import { getProcessEnv } from "env/process-env";
${moduleImports}
const moduleOptions: Record<string, Record<string, unknown>> = ${JSON.stringify(moduleOptions, null, 2)};
${rewriteGeneratedProcessEnvAccess(
	providerWiringCode +
		searchWiringCode +
		toastWiringCode +
		shippingWiringCode +
		taxWiringCode +
		notificationsWiringCode +
		doordashWiringCode +
		uberDirectWiringCode +
		recommendationsWiringCode +
		analyticsWiringCode +
		amazonWiringCode +
		tiktokShopWiringCode +
		googleShoppingWiringCode +
		facebookShopWiringCode +
		instagramShopWiringCode +
		etsyWiringCode +
		ebayWiringCode +
		walmartWiringCode +
		pinterestShopWiringCode +
		xShopWiringCode +
		uberEatsWiringCode,
)}
const modules = [
${moduleInstances}
];

// Collect ALL endpoints (customer + admin)
const allEndpoints: Record<string, Endpoint> = {};
for (const mod of modules) {
  if (mod.endpoints?.store) Object.assign(allEndpoints, mod.endpoints.store);
  if (mod.endpoints?.admin) Object.assign(allEndpoints, mod.endpoints.admin);
}

/** Path patterns for resolving request path to owning module (longer patterns first). */
const pathPatterns: Array<{ pattern: string; moduleId: string }> = ${pathPatternsJson};

/**
 * Match a request path to a module id so the correct module data service is used.
 * Patterns use :param for a single segment; first (most specific) match wins.
 */
export function getModuleIdForPath(path: string): string | undefined {
  const segments = path.replace(/^\\//, "").split("/").filter(Boolean);
  for (const { pattern, moduleId } of pathPatterns) {
    const patternSegments = pattern.replace(/^\\//, "").split("/").filter(Boolean);
    if (patternSegments.length !== segments.length) continue;
    const match = patternSegments.every((seg, i) =>
      seg.startsWith(":") ? segments[i]?.length > 0 : seg === segments[i]
    );
    if (match) return moduleId;
  }
  return undefined;
}

/**
 * Create router with context
 * This allows passing request-specific context (session, db, etc.) to endpoints
 */
export function createApiRouter(
  context: ModuleContext,
  config?: Omit<RouterConfig, 'routerContext'>
) {
  return createRouter(allEndpoints, {
    ...config,
    routerContext: context,
  });
}

/** Modules that contribute to store command search (module.search.store). */
export const STORE_SEARCH_CONTRIBUTORS = modules
  .filter((m): m is typeof m & { search: { store: string } } => typeof (m as { search?: { store?: string } }).search?.store === "string")
  .map((m) => ({ moduleId: m.id, path: (m as { search: { store: string } }).search.store }));

/** Modules that contribute to admin command search (module.search.admin). */
export const ADMIN_SEARCH_CONTRIBUTORS = modules
  .filter((m): m is typeof m & { search: { admin: string } } => typeof (m as { search?: { admin?: string } }).search?.admin === "string")
  .map((m) => ({ moduleId: m.id, path: (m as { search: { admin: string } }).search.admin }));

// Export modules for inspection
export { modules, allEndpoints };

// Export router type
export type Router = ReturnType<typeof createApiRouter>;
`;

	ensureDir(GENERATED_DIR);
	writeFileSync(API_ROUTER_PATH, routerContent);
}

async function generateClient() {
	const modules = getCachedModules();

	if (modules.length === 0) {
		return;
	}

	// Generate client SDK
	// The better-call client is not exported here because @better-fetch/fetch types
	// are not portable under Bun's module layout (TS2742).
	// Use useModuleClient() from @86d-app/core/client/provider for typed client access.
	const clientContent = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate
// Generated from: ${CONFIG_PATH}

export {};
`;

	ensureDir(GENERATED_DIR);
	writeFileSync(CLIENT_PATH, clientContent);
}

function walkTypeScriptFiles(dirPath: string): string[] {
	if (!existsSync(dirPath)) return [];

	const entries = readdirSync(dirPath, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dirPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkTypeScriptFiles(fullPath));
			continue;
		}
		if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
			files.push(fullPath);
		}
	}

	return files;
}

const moduleClientReferenceRegex =
	/client\.module\((["'])([^"'`]+)\1\)\.(admin|store)\[(["'])(\/[^"'`]+)\4\]/g;

function collectModuleClientEndpointReferences(
	moduleName: string,
	moduleId: string,
): ModuleClientEndpointReference[] {
	if (getModuleType(moduleName) !== "workspace") return [];

	const shortName = moduleName.replace("@86d-app/", "");
	const moduleDir = join(WORKSPACE_ROOT, "modules", shortName, "src");
	const componentDirs = [
		join(moduleDir, "admin", "components"),
		join(moduleDir, "store", "components"),
	];

	const references: ModuleClientEndpointReference[] = [];

	for (const componentDir of componentDirs) {
		for (const filePath of walkTypeScriptFiles(componentDir)) {
			const source = readFileSync(filePath, "utf-8");
			moduleClientReferenceRegex.lastIndex = 0;

			for (const match of source.matchAll(moduleClientReferenceRegex)) {
				const [, , referencedModuleId, surface, , path] = match;
				if (referencedModuleId !== moduleId) continue;

				references.push({
					moduleId,
					filePath: relative(WORKSPACE_ROOT, filePath),
					surface: surface as ModuleClientEndpointReference["surface"],
					path,
				});
			}
		}
	}

	return references;
}

function validateWorkspaceModuleClientEndpointReferences(
	_moduleNames: string[],
	pathSources: ModulePathSource[],
) {
	const conflicts: ModuleClientEndpointReferenceConflict[] = [];

	// Driven off the instantiated Modules. The previous version re-derived the id by
	// regex from index.ts and then looked it up by that id — when the two disagreed
	// the module was silently skipped and its references went unvalidated.
	// Validated against the routable superset, so an activation- or credential-gated
	// Module (loyalty, shipping, uber-direct) is checked against the endpoints it can
	// actually register rather than the empty surface it instantiates with here.
	for (const source of pathSources) {
		if (!source.isWorkspace) continue;

		const references = collectModuleClientEndpointReferences(
			source.packageName,
			source.moduleId,
		);
		conflicts.push(
			...validateModuleClientEndpointReferences(source, references),
		);
	}

	return conflicts;
}

async function loadModuleDefinition(
	moduleName: string,
	options: Record<string, unknown>,
): Promise<Module> {
	const importTarget =
		getModuleType(moduleName) === "workspace"
			? pathToFileURL(
					join(
						WORKSPACE_ROOT,
						"modules",
						moduleName.replace("@86d-app/", ""),
						"src",
						"index.ts",
					),
				).href
			: moduleName;
	const imported = (await import(importTarget)) as {
		default?: ((options?: Record<string, unknown>) => Module) | undefined;
	};

	if (typeof imported.default !== "function") {
		throw new Error(
			`Module "${moduleName}" does not export a default module factory.`,
		);
	}

	return imported.default(options);
}

/**
 * Endpoint surface a Module can register under ANY configuration.
 *
 * `pathPatterns` in the generated router is a dispatch PRE-FILTER: a path that is
 * absent is rejected with 404 before the router ever looks at its endpoint table
 * (apps/store/app/api/[...path]/route.ts). It therefore has to be a superset.
 *
 * Several Modules gate their endpoint surface on options the generator does not
 * have at generate time — `shipping` on EasyPost credentials, `uber-direct` on the
 * four UBER_* vars, `loyalty` on an explicit `enabled` flag. Those options are
 * injected by the env-wiring blocks this script EMITS into api.ts, which evaluate at
 * request time. Instantiating with config options alone therefore under-reports the
 * routable surface, and the missing paths 404 in exactly the configuration that
 * matters: production, with credentials present.
 *
 * We probe with option objects that satisfy both gate styles — `Boolean(opts?.x &&
 * opts?.y)` wants truthy, `opts?.enabled === true` wants the literal — and union the
 * results. Registration itself is still gated at runtime by the real options, so a
 * permissive pre-filter costs nothing: an unregistered path 404s at dispatch anyway.
 */
async function collectRoutableEndpointSurface(
	moduleName: string,
	configOptions: Record<string, unknown>,
	configured: Module,
): Promise<{ store: Set<string>; admin: Set<string> }> {
	const store = new Set(Object.keys(configured.endpoints?.store ?? {}));
	const admin = new Set(Object.keys(configured.endpoints?.admin ?? {}));

	const probe = (value: unknown): Record<string, unknown> =>
		new Proxy({ ...configOptions } as Record<string, unknown>, {
			get: (target, prop) => (prop in target ? target[prop as string] : value),
			has: () => true,
		});

	// Complementary probe values, unioned. `true` satisfies identity gates
	// (`opts?.enabled === true`, loyalty); "XX" satisfies truthiness gates whose values
	// are also length-validated (shipping validates an EasyPost origin country with
	// `.max(2)` and throws on anything longer); the free-form string covers gates that
	// need a plausible credential. A factory that rejects one probe keeps whatever the
	// others produced.
	for (const value of [true, "XX", "generator-probe"]) {
		try {
			const probed = await loadModuleDefinition(moduleName, probe(value));
			for (const path of Object.keys(probed.endpoints?.store ?? {}))
				store.add(path);
			for (const path of Object.keys(probed.endpoints?.admin ?? {}))
				admin.add(path);
		} catch {
			// A factory that cannot survive probe options keeps its configured surface.
		}
	}

	return { store, admin };
}

async function collectModulePathSources(
	moduleNames: string[],
	moduleOptions: Record<string, Record<string, unknown>>,
): Promise<ModulePathSource[]> {
	const sources: ModulePathSource[] = [];

	for (const moduleName of moduleNames) {
		const mod = await loadModuleDefinition(
			moduleName,
			moduleOptions[moduleName] ?? {},
		);

		// Endpoint paths, admin/store pages and component names are read from the
		// instantiated Module — never parsed out of source text. Text probes used to
		// fail silently here: a module whose file layout drifted was dropped from the
		// generated output with typecheck and unit tests still green.
		//
		// Pages come from the CONFIGURED instantiation (a Module that registers no
		// pages in this configuration must not get a component loader). Endpoints come
		// from the ROUTABLE superset, because the generated pathPatterns table is a
		// pre-filter that runs before the router can gate on real options.
		const routable = await collectRoutableEndpointSurface(
			moduleName,
			moduleOptions[moduleName] ?? {},
			mod,
		);

		sources.push({
			moduleId: mod.id,
			packageName: moduleName,
			isWorkspace: getModuleType(moduleName) === "workspace",
			adminPages: mod.admin?.pages?.map((page) => page.path) ?? [],
			storePages: mod.store?.pages?.map((page) => page.path) ?? [],
			adminEndpoints: [...routable.admin],
			storeEndpoints: [...routable.store],
			adminPageComponents: [
				...new Set(
					mod.admin?.pages?.map((page) => page.component).filter(Boolean) ?? [],
				),
			],
			storePageComponents: [
				...new Set(
					mod.store?.pages?.map((page) => page.component).filter(Boolean) ?? [],
				),
			],
		});
	}

	return sources;
}

/**
 * Generate admin-loaders.ts: dynamic import loaders for each module's admin-components.
 * Keyed by module id so the catch-all route can load (moduleId, componentName) → Component.
 */
/**
 * Resolve `ComponentName -> source file` by scanning a Module's admin component
 * directory for the file that actually exports each name.
 *
 * Deliberately not convention-based: `kebab(ComponentName)` is only the house style
 * and several Modules predate it. Scanning for the real export is exact, and it
 * survives the removal of the re-export barrels this used to read.
 */
function readAdminComponentFiles(componentsDir: string): Map<string, string> {
	const out = new Map<string, string>();
	if (!existsSync(componentsDir)) return out;

	for (const file of readdirSync(componentsDir).sort((a, b) =>
		a.localeCompare(b),
	)) {
		if (!file.endsWith(".tsx") || file.startsWith("_")) continue;
		const source = readFileSync(join(componentsDir, file), "utf-8");
		const base = file.replace(/\.tsx$/, "");
		for (const match of source.matchAll(
			/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g,
		)) {
			const name = match[1];
			if (name && !out.has(name)) out.set(name, base);
		}
	}
	return out;
}

async function generateAdminLoaders(allowManifestMutation: boolean) {
	const entries: Array<{ key: string; specifier: string }> = [];
	const problems: string[] = [];

	for (const source of getCachedPathSources()) {
		if (!source.isWorkspace) continue;
		const components = source.adminPageComponents ?? [];
		if (components.length === 0) continue;

		const shortName = source.packageName.replace("@86d-app/", "");
		const componentsDir = join(
			WORKSPACE_ROOT,
			"modules",
			shortName,
			"src",
			"admin",
			"components",
		);
		const fileByComponent = readAdminComponentFiles(componentsDir);

		for (const component of components) {
			const file = fileByComponent.get(component);
			// Hard-fail rather than silently drop: the previous existsSync probe let a
			// Module with a declared admin page ship without a loader, and the route
			// rendered "No admin loader for module: <id>" with every gate green.
			if (!file) {
				problems.push(
					`  ${source.packageName} declares admin page component "${component}" ` +
						`but its component barrel does not re-export it`,
				);
				continue;
			}
			const target = join(componentsDir, `${file}.tsx`);
			if (!existsSync(target)) {
				problems.push(
					`  ${source.packageName} component "${component}" resolves to ` +
						`${relative(WORKSPACE_ROOT, target)}, which does not exist`,
				);
				continue;
			}
			entries.push({
				key: `${source.moduleId}:${component}`,
				specifier: `${source.packageName}/admin/components/${file}`,
			});
		}
	}

	if (problems.length > 0) {
		throw new Error(
			`Admin component resolution failed for ${problems.length} page(s):\n${problems.join("\n")}`,
		);
	}

	const loadersEntries = entries
		.map(({ key, specifier }) => `  "${key}": () => import("${specifier}"),`)
		.join("\n");

	const content = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate
// Generated from: ${CONFIG_PATH}

type AdminComponentModule = Record<string, unknown>;

/**
 * Lazy loaders for individual admin page components.
 *
 * Keyed by \`\${moduleId}:\${componentName}\` so each admin route downloads only the
 * component it renders, rather than its Module's entire admin surface.
 *
 * Usage: adminComponentLoaders[\`\${moduleId}:\${componentName}\`]()
 */
export const adminComponentLoaders: Record<string, () => Promise<AdminComponentModule>> = {
${loadersEntries}
};
`;

	ensureDir(GENERATED_DIR);
	writeFileSync(ADMIN_LOADERS_PATH, content);

	writeAdminComponentExports(entries, allowManifestMutation);
}

/**
 * Write an explicit `exports` entry into each Module manifest for every admin
 * component the loaders import.
 *
 * The catch-all `"./*": "./src/*"` pattern is NOT sufficient: TypeScript maps
 * `./admin/components/x` to `./src/admin/components/x` and then requires that exact
 * file — it performs no extension substitution for exports patterns, and
 * `allowImportingTsExtensions` is off, so writing the extension is TS5097. Bundlers
 * are more forgiving, which is why the gap only shows up under `tsc`.
 *
 * These entries are machine-maintained; the idempotency gate covers them.
 */
function writeAdminComponentExports(
	entries: Array<{ key: string; specifier: string }>,
	allowMutation: boolean,
) {
	const wanted = new Map<string, Set<string>>();
	for (const { specifier } of entries) {
		const match = specifier.match(/^(@86d-app\/[^/]+)\/(.+)$/);
		if (!match) continue;
		const [, pkg, subpath] = match;
		if (!pkg || !subpath) continue;
		const set = wanted.get(pkg) ?? new Set<string>();
		set.add(subpath);
		wanted.set(pkg, set);
	}

	let updated = 0;
	for (const [pkg, subpaths] of wanted) {
		const shortName = pkg.replace("@86d-app/", "");
		const manifestPath = join(
			WORKSPACE_ROOT,
			"modules",
			shortName,
			"package.json",
		);
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			exports?: Record<string, unknown>;
		};
		const exportsMap = manifest.exports ?? {};
		let changed = false;
		for (const subpath of subpaths) {
			const key = `./${subpath}`;
			const target = `./src/${subpath}.tsx`;
			const existing = exportsMap[key] as { default?: string } | undefined;
			if (existing?.default === target) continue;
			exportsMap[key] = { types: target, default: target };
			changed = true;
		}
		if (!changed) continue;
		if (!allowMutation) {
			throw new Error(
				`Registry-only module generation will not update ${relative(WORKSPACE_ROOT, manifestPath)}. Commit the required admin component exports before the frozen build.`,
			);
		}
		manifest.exports = Object.fromEntries(
			Object.entries(exportsMap).sort(([a], [b]) => a.localeCompare(b)),
		);
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		updated++;
	}
	if (updated > 0) {
	}
}

/**
 * Generate store-loaders.ts: dynamic import loaders for each module's store components.
 * Only modules with store.pages are included (used by the store catch-all route).
 */
async function generateStoreLoaders() {
	const entries: Array<{ moduleId: string; packageName: string }> = [];

	for (const source of getCachedPathSources()) {
		if (!source.isWorkspace) continue;
		if ((source.storePages?.length ?? 0) === 0) continue;
		entries.push({
			moduleId: source.moduleId,
			packageName: source.packageName,
		});
	}

	const loadersEntries = entries
		.map(
			({ moduleId, packageName }) =>
				`  "${moduleId}": () => import("${packageName}/components").then(unwrapDefault),`,
		)
		.join("\n");

	const content = `// Auto-generated file - do not edit manually
// Run 'bun run generate:modules' to regenerate
// Generated from: ${CONFIG_PATH}

import type { ComponentType } from "react";

type StoreComponentModule = Record<string, ComponentType<Record<string, unknown>>>;

function unwrapDefault(m: unknown): StoreComponentModule {
  const mod = m as StoreComponentModule & { default?: StoreComponentModule };
  return mod.default ?? mod;
}

/**
 * Lazy loaders for module store component bundles (modules with store.pages).
 * Store components use default export; we unwrap to get the component map.
 * Usage: storeComponentLoaders[moduleId]().then((m) => m[componentName])
 */
export const storeComponentLoaders: Record<string, () => Promise<StoreComponentModule>> = {
${loadersEntries}
};
`;

	ensureDir(GENERATED_DIR);
	writeFileSync(STORE_LOADERS_PATH, content);
}

/**
 * Generate transpile-packages.json: list of module package names that need
 * Next.js transpilation (any workspace module with JSX/TSX files).
 *
 * next.config.ts reads this file to build the transpilePackages array,
 * eliminating the need for a hard-coded list.
 */
function generateTranspilePackages() {
	const modules = getCachedModules();
	const transpile: string[] = [];

	for (const moduleName of modules) {
		if (getModuleType(moduleName) !== "workspace") continue;
		const shortName = moduleName.replace("@86d-app/", "");
		const basePath = join(WORKSPACE_ROOT, "modules", shortName, "src");

		// Include if the Module ships any TSX. Checked by directory contents rather
		// than a fixed filename: admin components no longer funnel through a barrel.
		const hasTsxIn = (dir: string) =>
			existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".tsx"));
		const hasJsx =
			hasTsxIn(join(basePath, "store", "components")) ||
			hasTsxIn(join(basePath, "admin", "components"));

		if (hasJsx) {
			transpile.push(moduleName);
		}
	}

	transpile.sort((a, b) => a.localeCompare(b));
	ensureDir(GENERATED_DIR);
	writeFileSync(TRANSPILE_PACKAGES_PATH, JSON.stringify(transpile, null, 2));
}

// Cache resolved modules list so it's only computed once
let _cachedModules: string[] | undefined;
let _cachedResolved: ResolvedModule[] | undefined;
let _cachedPathSources: ModulePathSource[] | undefined;

function getCachedModules(): string[] {
	if (!_cachedModules) {
		throw new Error(
			"Modules not resolved yet — call resolveModulesFromRegistry() first",
		);
	}
	return _cachedModules;
}

function getCachedResolved(): ResolvedModule[] {
	if (!_cachedResolved) {
		throw new Error(
			"Modules not resolved yet — call resolveModulesFromRegistry() first",
		);
	}
	return _cachedResolved;
}

function getCachedPathSources(): ModulePathSource[] {
	if (!_cachedPathSources) {
		throw new Error(
			"Module paths not collected yet — call collectModulePathSources() first",
		);
	}
	return _cachedPathSources;
}

const isFrozen = process.argv.includes("--frozen");

// Run all generators
async function runGenerators() {
	const registryOnlyPolicy = readRegistryOnlyPolicy();
	_cachedResolved = await resolveModulesFromRegistry(
		registryOnlyPolicy,
		isFrozen,
	);
	_cachedModules = resolvedToPackageNames(_cachedResolved);
	const resolvedModules = getCachedResolved();
	const moduleNames = getCachedModules();

	// Check for circular dependencies in the registry manifest
	const manifest = readLocalManifest(registryManifestPath(WORKSPACE_ROOT));
	if (manifest) {
		const cycles = detectCircularDependencies(manifest);
		if (cycles.length > 0) {
			console.error("✗ Circular dependencies detected:");
			for (const cycle of cycles) {
				console.error(`  ${cycle}`);
			}
			process.exit(1);
		}
	}

	// Lock file: verify (--frozen) or generate
	if (isFrozen) {
		const existingLock = readLockfile(WORKSPACE_ROOT);
		if (!existingLock) {
			console.error(
				"✗ --frozen requires apps/registry/registry.lock.json but none was found",
			);
			process.exit(1);
		}
		const diff = verifyLockfile(existingLock, resolvedModules);
		if (!isLockfileSatisfied(diff)) {
			console.error("✗ apps/registry/registry.lock.json is out of date:");
			if (diff.added.length > 0)
				console.error(`  Added: ${diff.added.join(", ")}`);
			if (diff.removed.length > 0)
				console.error(`  Removed: ${diff.removed.join(", ")}`);
			if (diff.changed.length > 0)
				console.error(`  Changed: ${diff.changed.join(", ")}`);
			console.error("  Run without --frozen to regenerate the lock file.");
			process.exit(1);
		}
	} else {
		const lockfile = generateLockfile(resolvedModules, WORKSPACE_ROOT);
		writeLockfile(WORKSPACE_ROOT, lockfile);
	}

	await ensureModuleDependencies(moduleNames, !registryOnlyPolicy.enabled);

	_cachedPathSources = await collectModulePathSources(
		moduleNames,
		readStoreConfig(CONFIG_PATH).moduleOptions || {},
	);
	const pathConflicts = validateUniquePaths(_cachedPathSources);
	if (pathConflicts.length > 0) {
		const messages = formatPathConflicts(pathConflicts);
		throw new Error(
			`Module path conflicts:\n${messages.map((message) => `  - ${message}`).join("\n")}`,
		);
	}
	const moduleClientEndpointConflicts =
		validateWorkspaceModuleClientEndpointReferences(
			moduleNames,
			_cachedPathSources,
		);
	if (moduleClientEndpointConflicts.length > 0) {
		const messages = formatModuleClientEndpointReferenceConflicts(
			moduleClientEndpointConflicts,
		);
		throw new Error(
			`Module client endpoint references are invalid:\n${messages.map((message) => `  - ${message}`).join("\n")}`,
		);
	}

	await generateModulesFile();
	await generateApiRouter();
	await generateClient();
	await generateAdminLoaders(!registryOnlyPolicy.enabled);
	await generateStoreLoaders();
	generateTranspilePackages();
}

runGenerators().catch((error) => {
	console.error("Failed to generate modules:", error);
	process.exit(1);
});
