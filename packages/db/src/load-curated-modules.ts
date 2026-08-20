import { join } from "node:path";
import { CURATED_STORE_MODULES } from "@86d-app/core/curated-modules";
import type { Module } from "@86d-app/core/types/module";

const repoRoot = join(import.meta.dirname, "../../..");
const modulesDir = join(repoRoot, "modules");

export async function loadCuratedModule(
	moduleId: string,
): Promise<Module | null> {
	const indexPath = join(modulesDir, moduleId, "src/index.ts");
	try {
		const mod = await import(indexPath);
		const factory = mod.default;
		if (typeof factory !== "function") {
			return null;
		}
		return factory({}) as Module;
	} catch {
		return null;
	}
}

export async function loadCuratedModules(): Promise<Module[]> {
	const loaded: Module[] = [];
	for (const moduleId of CURATED_STORE_MODULES) {
		const module = await loadCuratedModule(moduleId);
		if (module) {
			loaded.push(module);
		}
	}
	return loaded;
}
