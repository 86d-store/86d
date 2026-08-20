import { z } from "zod";

// ── Module Specifier Parsing ──────────────────────────────────────────

/**
 * Source types for module resolution.
 *
 * - local:    Already present in the workspace `modules/` directory.
 * - registry: Resolved via the 86d registry manifest (fetched from GitHub).
 * - github:   Fetched from a specific GitHub repository path.
 * - npm:      Installed from npm.
 */
export type ModuleSourceType = "local" | "registry" | "github" | "npm";

/** Parsed module specifier — result of parsing a config.json entry. */
export interface ModuleSpecifier {
	/** Original raw string from config (e.g. "github:owner/repo/path"). */
	raw: string;
	/** Resolved source type. */
	source: ModuleSourceType;
	/** Short name used as the directory name inside `modules/`. */
	name: string;
	/** Full package name (e.g. "@86d-app/products"). */
	packageName: string;
	/** For github sources: "owner/repo". */
	repo?: string;
	/** For github sources: path within the repo (e.g. "modules/loyalty"). */
	path?: string;
	/** For github sources: branch or tag (default "main"). */
	ref?: string;
	/** For npm sources: version range (default "latest"). */
	version?: string;
}

// ── Registry Manifest ─────────────────────────────────────────────────

/** A versioned capability a Module provides or accepts. */
export const registryCapabilitySchema = z.object({
	/** Capability name (e.g. "commerce.tax.quote"). */
	name: z.string(),
	/** Module that owns the contract. */
	owner: z.string(),
	/** Semver capability versions produced (providers) or accepted (consumers). */
	versions: z.array(z.string().min(1)).min(1),
});

export type RegistryCapability = z.infer<typeof registryCapabilitySchema>;

/** A versioned durable event a Module emits or handles. */
export const registryDurableEventSchema = z.object({
	name: z.string(),
	owner: z.string(),
	version: z.number().int().positive(),
});

export type RegistryDurableEvent = z.infer<typeof registryDurableEventSchema>;

/** Recorded evidence backing a maturity claim. */
export const registryMaturityEvidenceSchema = z.object({
	kind: z.string(),
	reference: z.string(),
	recordedAt: z.string(),
	version: z.string().optional(),
});

/** Schema for a single module entry in the registry manifest. */
export const registryModuleSchema = z.object({
	/** npm package name (e.g. "@86d-app/products"). */
	name: z.string(),
	/** Human-readable description. */
	description: z.string(),
	/** Semver version. */
	version: z.string(),
	/** Category for grouping (catalog, sales, marketing, etc.). */
	category: z.string(),
	/** Path within the registry repo (e.g. "modules/products"). */
	path: z.string(),
	/** Module IDs this module depends on. */
	requires: z.array(z.string()).default([]),
	/** Whether the module exports store-facing components. */
	hasStoreComponents: z.boolean().default(false),
	/** Whether the module exports admin-facing components. */
	hasAdminComponents: z.boolean().default(false),
	/** Whether the module declares store pages. */
	hasStorePages: z.boolean().default(false),
	/**
	 * SHA-256 hash of the module's package.json.
	 * Retained for older manifests; `subtreeIntegrity` is what verification uses.
	 */
	integrity: z.string().optional(),
	/**
	 * SHA-256 hash of the module's complete source subtree. This is the value a
	 * fetch verifies against, so a manifest cannot match while the Module's
	 * behavior has been replaced.
	 */
	subtreeIntegrity: z.string().optional(),
	/**
	 * Commit the entry was built from. Fetches resolve to this SHA rather than a
	 * mutable branch, so the same manifest always yields the same source.
	 */
	commit: z.string().optional(),
	/** Published maturity, derived from recorded evidence. */
	maturity: z
		.enum(["stable", "beta", "experimental", "deprecated"])
		.default("experimental"),
	/** Evidence backing the published maturity. */
	maturityEvidence: z.array(registryMaturityEvidenceSchema).default([]),
	/** Why the published maturity is lower than the Module's own claim. */
	maturityDowngradeReason: z.string().optional(),
	/** Store Runtime compatibility for this entry. */
	runtime: z
		.object({
			/** Store Runtime versions this Module is built against. */
			storeRuntime: z.string(),
			/** Module contract version the runtime must understand. */
			moduleContract: z.number().int().positive(),
		})
		.optional(),
	/** Capabilities this Module produces. */
	providesCapabilities: z.array(registryCapabilitySchema).default([]),
	/** Capabilities this Module accepts. */
	acceptsCapabilities: z.array(registryCapabilitySchema).default([]),
	/** Durable events this Module emits. */
	emitsDurableEvents: z.array(registryDurableEventSchema).default([]),
	/** Durable events this Module handles. */
	handlesDurableEvents: z.array(registryDurableEventSchema).default([]),
});

export type RegistryModule = z.infer<typeof registryModuleSchema>;

// ── Registry Templates ────────────────────────────────────────────────

/** Schema for a single template entry in the registry manifest. */
export const registryTemplateSchema = z.object({
	/** Template name (e.g. "brisa"). */
	name: z.string(),
	/** Human-readable description. */
	description: z.string(),
	/** Semver version. */
	version: z.string(),
	/** Path within the registry repo (e.g. "templates/brisa"). */
	path: z.string(),
});

export type RegistryTemplate = z.infer<typeof registryTemplateSchema>;

/** Schema for the full registry manifest (registry.json). */
export const registryManifestSchema = z.object({
	/** Manifest format version. */
	version: z.literal(1),
	/** Base GitHub repo URL (e.g. "https://github.com/86d-app/86d"). */
	baseUrl: z.string(),
	/** Default branch for fetching (e.g. "main"). */
	defaultRef: z.string().default("main"),
	/** Module entries keyed by short name. */
	modules: z.record(z.string(), registryModuleSchema),
	/** Template entries keyed by short name. */
	templates: z.record(z.string(), registryTemplateSchema).default({}),
});

export type RegistryManifest = z.infer<typeof registryManifestSchema>;

// ── Store Config ──────────────────────────────────────────────────────

/** Versioned advanced behavior that must never be implied by discovery. */
export interface AdvancedStoreConfig {
	version: 1;
	allowExperimentalModules?: boolean;
}

/**
 * Extended config.json shape that supports registry features.
 *
 * `modules` can be:
 * - `"*"` to include all modules from the registry
 * - An array of module specifiers (strings)
 *
 * `template` can be:
 * - A local name (e.g. "brisa") for templates in `templates/`
 * - A GitHub specifier (e.g. "github:owner/repo/templates/custom")
 * - An npm specifier (e.g. "npm:@acme/store-template")
 */
export interface StoreConfig {
	theme?: string;
	name?: string;
	template?: string;
	modules?: "*" | string[];
	advanced?: AdvancedStoreConfig;
	moduleOptions?: Record<string, Record<string, unknown>>;
	registry?: string;
	variables?: Record<string, Record<string, string>>;
	[key: string]: unknown;
}

// ── Resolution Result ─────────────────────────────────────────────────

export type ResolutionStatus = "found" | "missing" | "error";

/** Result of resolving a single module specifier. */
export interface ResolvedModule {
	specifier: ModuleSpecifier;
	status: ResolutionStatus;
	/** Absolute path to the module directory (when found/installed). */
	localPath?: string;
	/** Error message if status is "error". */
	error?: string;
}

// ── Fetch Result ──────────────────────────────────────────────────────

/** Result of fetching a module from a remote source. */
export interface FetchResult {
	success: boolean;
	/** Absolute path where the module was installed. */
	localPath?: string;
	error?: string;
}
