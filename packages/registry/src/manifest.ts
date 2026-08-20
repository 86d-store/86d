import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeSubtreeIntegrity } from "./integrity.js";
import { resolveModuleMaturity } from "./maturity.js";
import type {
	RegistryCapability,
	RegistryDurableEvent,
	RegistryManifest,
	RegistryModule,
	RegistryTemplate,
} from "./types.js";

/**
 * The declarations a Module exposes, read from the Module itself.
 *
 * The caller loads each Module and passes what it declares. Reading these from
 * the built object rather than matching patterns in `index.ts` means the
 * manifest records what the Module actually does: a regex over source cannot
 * see a capability assembled in a helper, and silently records nothing.
 */
export interface ModuleDeclarations {
	id: string;
	version?: string | undefined;
	category?: string | undefined;
	requires?: string[] | undefined;
	hasStorePages?: boolean | undefined;
	providesCapabilities?: RegistryCapability[] | undefined;
	acceptsCapabilities?: RegistryCapability[] | undefined;
	emitsDurableEvents?: RegistryDurableEvent[] | undefined;
	handlesDurableEvents?: RegistryDurableEvent[] | undefined;
}

export interface BuildManifestOptions {
	baseUrl?: string;
	defaultRef?: string;
	/** Commit the manifest is built from. Entries pin to it. */
	commit?: string;
	/** Store Runtime version these entries are built against. */
	storeRuntimeVersion?: string;
	/** Module contract version the runtime must understand. */
	moduleContractVersion?: number;
	/** Declarations per Module short name, supplied by the generator. */
	declarations?: Record<string, ModuleDeclarations>;
}

/**
 * Build a registry manifest by scanning the local `modules/` directory.
 *
 * Used to generate `registry.json` from the monorepo source.
 */
export function buildManifest(
	root: string,
	options?: BuildManifestOptions,
): RegistryManifest {
	const modulesDir = join(root, "modules");
	const templatesDir = join(root, "templates");
	const modules: Record<string, RegistryModule> = {};
	const templates: Record<string, RegistryTemplate> = {};

	const baseManifest = {
		version: 1 as const,
		baseUrl: options?.baseUrl ?? "https://github.com/86d-app/86d",
		defaultRef: options?.defaultRef ?? "main",
	};

	if (!existsSync(modulesDir)) {
		return { ...baseManifest, modules, templates };
	}

	const dirs = readdirSync(modulesDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	for (const name of dirs) {
		const moduleDir = join(modulesDir, name);
		const entry = buildModuleEntry(moduleDir, name, options);
		if (entry) {
			modules[name] = entry;
		}
	}

	// Scan templates
	if (existsSync(templatesDir)) {
		const templateDirs = readdirSync(templatesDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();

		for (const name of templateDirs) {
			const templateDir = join(templatesDir, name);
			const entry = buildTemplateEntry(templateDir, name);
			if (entry) {
				templates[name] = entry;
			}
		}
	}

	return { ...baseManifest, modules, templates };
}

/**
 * Build a single {@link RegistryModule} entry from a module directory.
 */
function buildModuleEntry(
	moduleDir: string,
	name: string,
	options?: BuildManifestOptions,
): RegistryModule | undefined {
	const pkgPath = join(moduleDir, "package.json");
	if (!existsSync(pkgPath)) return undefined;

	const pkgRaw = readFileSync(pkgPath, "utf-8");
	const pkg = JSON.parse(pkgRaw);

	const integrity = `sha256-${createHash("sha256").update(pkgRaw).digest("hex")}`;
	const subtreeIntegrity = computeSubtreeIntegrity(moduleDir);
	const declared = options?.declarations?.[name];
	const maturity = resolveModuleMaturity(moduleDir);

	let description = pkg.description ?? "";
	if (!description && pkg.keywords) {
		description = (pkg.keywords as string[]).join(", ");
	}

	const hasStoreComponents = existsSync(
		join(moduleDir, "src", "store", "components", "mdx.tsx"),
	);
	const hasAdminComponents = existsSync(
		join(moduleDir, "src", "admin", "components", "index.tsx"),
	);

	return {
		name: pkg.name ?? `@86d-app/${name}`,
		description,
		version: declared?.version ?? pkg.version ?? "0.0.1",
		category: declared?.category ?? "general",
		path: `modules/${name}`,
		requires: declared?.requires ?? [],
		hasStoreComponents,
		hasAdminComponents,
		hasStorePages: declared?.hasStorePages ?? false,
		integrity,
		...(subtreeIntegrity ? { subtreeIntegrity } : {}),
		...(options?.commit ? { commit: options.commit } : {}),
		maturity: maturity.maturity,
		maturityEvidence: maturity.evidence,
		...(maturity.downgradeReason
			? { maturityDowngradeReason: maturity.downgradeReason }
			: {}),
		...(options?.storeRuntimeVersion && options?.moduleContractVersion
			? {
					runtime: {
						storeRuntime: options.storeRuntimeVersion,
						moduleContract: options.moduleContractVersion,
					},
				}
			: {}),
		providesCapabilities: declared?.providesCapabilities ?? [],
		acceptsCapabilities: declared?.acceptsCapabilities ?? [],
		emitsDurableEvents: declared?.emitsDurableEvents ?? [],
		handlesDurableEvents: declared?.handlesDurableEvents ?? [],
	};
}

/**
 * Build a single {@link RegistryTemplate} entry from a template directory.
 */
function buildTemplateEntry(
	templateDir: string,
	name: string,
): RegistryTemplate | undefined {
	const configPath = join(templateDir, "config.json");
	if (!existsSync(configPath)) return undefined;

	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		return {
			name,
			description: config.description ?? config.name ?? name,
			version: config.version ?? "0.0.1",
			path: `templates/${name}`,
		};
	} catch {
		return undefined;
	}
}
