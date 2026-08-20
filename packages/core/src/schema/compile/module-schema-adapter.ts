import type { Module } from "../../types/module";
import type { ModuleSchema } from "../../types/schema";
import { resolveModuleStorage, storageTables } from "../declaration";

/** Whether a module has Relational tables under canonical storage (or legacy tables). */
export function isTranscodedModule(module: Module): boolean {
	const storage = resolveModuleStorage(module);
	if (storage) {
		return Object.keys(storageTables(storage)).length > 0;
	}
	return Boolean(module.tables && Object.keys(module.tables).length > 0);
}

/** List module IDs that still rely on legacy ModuleSchema only. */
export function listNotTranscodedModules(modules: readonly Module[]): string[] {
	return modules
		.filter((module) => {
			if (resolveModuleStorage(module)) {
				return false;
			}
			return (
				!isTranscodedModule(module) &&
				module.schema &&
				Object.keys(module.schema).length > 0
			);
		})
		.map((module) => module.id)
		.sort();
}

/** Adapter summary for legacy field maps (report mode only). */
export function summarizeLegacySchema(schema: ModuleSchema): {
	entityCount: number;
	fieldCount: number;
} {
	let fieldCount = 0;
	for (const entity of Object.values(schema)) {
		fieldCount += Object.keys(entity.fields ?? {}).length;
	}
	return { entityCount: Object.keys(schema).length, fieldCount };
}
