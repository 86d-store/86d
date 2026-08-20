import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Module } from "../../types/module";
import { resolveModuleStorage, storageTables } from "../declaration";

const repoRoot = join(import.meta.dirname, "../../../../..");
const modulesDir = join(repoRoot, "modules");

/** Load every installable Module factory under `modules/`. */
export async function loadInstalledModules(): Promise<Module[]> {
	const entries = readdirSync(modulesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));

	const loaded: Module[] = [];
	for (const moduleId of entries) {
		try {
			const mod = await import(join(modulesDir, moduleId, "src/index.ts"));
			if (typeof mod.default !== "function") {
				continue;
			}
			loaded.push(mod.default({}) as Module);
		} catch {
			// Unpackaged / non-factory directories are ignored for inventory.
		}
	}
	return loaded;
}

/** Modules with canonical storage (or legacy tables / empty schema). */
export async function loadManifestModules(): Promise<Module[]> {
	const modules = await loadInstalledModules();
	return modules.filter((module) => {
		const storage = resolveModuleStorage(module);
		if (storage) {
			return true;
		}
		return (
			(module.tables && Object.keys(module.tables).length > 0) ||
			!module.schema ||
			Object.keys(module.schema).length === 0
		);
	});
}

/** Helper for tests: relational table count across loaded Modules. */
export function countRelationalModules(modules: readonly Module[]): number {
	return modules.filter((module) => {
		const storage = resolveModuleStorage(module);
		if (storage) {
			return Object.keys(storageTables(storage)).length > 0;
		}
		return Boolean(module.tables && Object.keys(module.tables).length > 0);
	}).length;
}
