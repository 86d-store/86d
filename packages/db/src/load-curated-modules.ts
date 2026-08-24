import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "@86d-app/core/curated-modules";
import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";

const repoRoot = join(import.meta.dirname, "../../..");
const modulesDir = join(repoRoot, "modules");
const TIER_NONE = new Set<string>(TIER_NONE_CURATED_MODULES);

export interface CuratedModuleLoadOptions {
	modulesRoot?: string;
}

function storageExportName(moduleId: string): string {
	return `${moduleId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Storage`;
}

/**
 * Load curated Modules for seed/DDL from schema sources only.
 * Production images do not ship Module endpoint graphs or core UI deps, so the
 * factory `index.ts` path is intentionally avoided here.
 */
export async function loadCuratedModule(
	moduleId: string,
	options: CuratedModuleLoadOptions = {},
): Promise<Module> {
	if (TIER_NONE.has(moduleId)) {
		return {
			id: moduleId,
			version: "0.0.1",
			storage: { kind: "none" },
		};
	}

	const schemaPath = join(
		options.modulesRoot ?? modulesDir,
		moduleId,
		"src/schema.ts",
	);
	if (!existsSync(schemaPath)) {
		throw new Error(
			`Curated Module "${moduleId}" has no schema.ts at ${schemaPath}`,
		);
	}

	let mod: Record<string, unknown>;
	try {
		mod = (await import(schemaPath)) as Record<string, unknown>;
	} catch (error) {
		throw new Error(
			`Curated Module "${moduleId}" failed to load schema from ${schemaPath}: ${String(error)}`,
		);
	}

	const exportName = storageExportName(moduleId);
	const storage = mod[exportName];
	if (!storage || typeof storage !== "object") {
		throw new Error(
			`Curated Module "${moduleId}" schema does not export ${exportName}.`,
		);
	}

	return {
		id: moduleId,
		version: "0.0.1",
		storage: storage as ModuleStorageDeclaration,
	};
}

export async function loadCuratedModules(
	options: CuratedModuleLoadOptions = {},
): Promise<Module[]> {
	const loaded: Module[] = [];
	for (const moduleId of CURATED_STORE_MODULES) {
		loaded.push(await loadCuratedModule(moduleId, options));
	}
	return loaded;
}
