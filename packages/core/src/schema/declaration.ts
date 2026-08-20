import type { z } from "zod";

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
	table: string;
	columns: readonly string[];
}>;

export type ModuleStorageTier = "none" | "config" | "extension" | "own";

/** Infer the temporary compatibility tier until every Module declares an explicit `storage.kind`. */
export function moduleStorageTier(module: {
	tables?: Readonly<Record<string, TableDeclaration>>;
	extends?: Readonly<Record<string, CoreExtensionDeclaration>>;
	anchors?: readonly AnchorDeclaration[];
}): ModuleStorageTier {
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
