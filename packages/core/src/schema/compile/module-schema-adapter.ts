import type { Module } from "../../types/module";
import type { ModuleSchema } from "../../types/schema";

/** Whether a module has target Zod+col table declarations. */
export function isTranscodedModule(module: Module): boolean {
	return Boolean(module.tables && Object.keys(module.tables).length > 0);
}

/** List module IDs that still rely on legacy ModuleSchema only. */
export function listNotTranscodedModules(modules: readonly Module[]): string[] {
	return modules
		.filter(
			(module) =>
				!isTranscodedModule(module) &&
				module.schema &&
				Object.keys(module.schema).length > 0,
		)
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
