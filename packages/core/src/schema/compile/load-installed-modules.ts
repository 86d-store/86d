import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Module } from "../../types/module";

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

/** Modules that declare at least one compiled table, plus curated tier-none. */
export async function loadManifestModules(): Promise<Module[]> {
	const modules = await loadInstalledModules();
	return modules.filter(
		(module) =>
			(module.tables && Object.keys(module.tables).length > 0) ||
			!module.schema ||
			Object.keys(module.schema).length === 0,
	);
}
