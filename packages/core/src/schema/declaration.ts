import type { z } from "zod";

/** Stable SemVer without prerelease or build metadata. */
export type StableSemVer = `${number}.${number}.${number}`;

/** Exact version or one caret range. Arrays form a union of these tokens. */
export type ContractRange = StableSemVer | `^${StableSemVer}`;

/** Config key → Zod value schema. Parsed output must be JSON-compatible. */
export type ConfigValues = Readonly<Record<string, z.ZodType>>;

/** One table owned by a Module in its `mod_<moduleId>` schema. */
export type TableDeclaration = Readonly<{
	shape: z.ZodObject<z.ZodRawShape>;
	excludes?: readonly {
		using: "gist" | "btree";
		with: string;
		where?: string;
	}[];
}>;

/** Typed columns extending a core table, physically named `x_<moduleId>__*`. */
export type CoreExtensionDeclaration = Readonly<{
	shape: z.ZodObject<z.ZodRawShape>;
}>;

/** Money-bearing row anchor to `core.subject`. */
export type AnchorDeclaration = Readonly<{
	table: string;
	column: string;
	kind: string;
}>;

/** Column-projected view another Module may read. */
export type PublishedView = Readonly<{
	version: StableSemVer;
	table: string;
	columns: readonly string[];
}>;

/**
 * Canonical Module storage declaration. Exactly one branch; Relational field
 * names are locked (`tables`, `extends`, `anchors`, `publishes`) with no aliases.
 */
export type ModuleStorageDeclaration =
	| Readonly<{
			kind: "none";
	  }>
	| Readonly<{
			kind: "config";
			config: ConfigValues;
	  }>
	| Readonly<{
			kind: "relational";
			config?: ConfigValues;
			tables?: Readonly<Record<string, TableDeclaration>>;
			extends?: Readonly<
				Partial<
					Record<"party" | "subject" | "transaction", CoreExtensionDeclaration>
				>
			>;
			anchors?: readonly AnchorDeclaration[];
			publishes?: Readonly<Record<string, PublishedView>>;
	  }>;

/** @deprecated Prefer explicit `storage.kind`. Kept for migration diagnostics. */
export type ModuleStorageTier = "none" | "config" | "extension" | "own";

/** Resolve the effective storage branch from a Module declaration. */
export function resolveModuleStorage(module: {
	storage?: ModuleStorageDeclaration;
	tables?: Readonly<Record<string, TableDeclaration>>;
	extends?: Readonly<
		Partial<
			Record<"party" | "subject" | "transaction", CoreExtensionDeclaration>
		>
	>;
	anchors?: readonly AnchorDeclaration[];
	publishes?: Readonly<Record<string, PublishedView>>;
}): ModuleStorageDeclaration | undefined {
	if (module.storage) {
		return module.storage;
	}
	return undefined;
}

/** Infer a temporary compatibility tier from relational fragments. */
export function moduleStorageTier(module: {
	storage?: ModuleStorageDeclaration;
	tables?: Readonly<Record<string, TableDeclaration>>;
	extends?: Readonly<Record<string, CoreExtensionDeclaration>>;
	anchors?: readonly AnchorDeclaration[];
}): ModuleStorageTier {
	const storage = resolveModuleStorage(module);
	if (storage) {
		if (storage.kind === "none") return "none";
		if (storage.kind === "config") return "config";
		if (storage.tables && Object.keys(storage.tables).length > 0) return "own";
		if (storage.extends && Object.keys(storage.extends).length > 0) {
			return "extension";
		}
		if (storage.anchors && storage.anchors.length > 0) return "extension";
		return "none";
	}
	if (module.tables && Object.keys(module.tables).length > 0) {
		return "own";
	}
	if (module.extends && Object.keys(module.extends).length > 0) {
		return "extension";
	}
	if (module.anchors && module.anchors.length > 0) {
		return "extension";
	}
	return "none";
}

/** Tables from a Relational storage declaration (empty for other kinds). */
export function storageTables(
	storage: ModuleStorageDeclaration | undefined,
): Readonly<Record<string, TableDeclaration>> {
	if (storage?.kind === "relational" && storage.tables) {
		return storage.tables;
	}
	return {};
}

/** Config keys from Config or Relational storage. */
export function storageConfig(
	storage: ModuleStorageDeclaration | undefined,
): ConfigValues {
	if (storage?.kind === "config") {
		return storage.config;
	}
	if (storage?.kind === "relational" && storage.config) {
		return storage.config;
	}
	return {};
}
