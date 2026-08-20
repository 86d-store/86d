import { join } from "node:path";
import { CURATED_STORE_MODULES } from "@86d-app/core/curated-modules";
import type { Module } from "@86d-app/core/types/module";

const repoRoot = join(import.meta.dirname, "../../..");
const modulesDir = join(repoRoot, "modules");

export async function loadCuratedModule(moduleId: string): Promise<Module> {
	const indexPath = join(modulesDir, moduleId, "src/index.ts");
	let mod: { default?: unknown };
	try {
		mod = await import(indexPath);
	} catch (error) {
		throw new Error(
			`Curated Module "${moduleId}" failed to load from ${indexPath}: ${String(error)}`,
		);
	}
	if (typeof mod.default !== "function") {
		throw new Error(
			`Curated Module "${moduleId}" does not export a factory default.`,
		);
	}
	return mod.default({}) as Module;
}

export async function loadCuratedModules(): Promise<Module[]> {
	const loaded: Module[] = [];
	for (const moduleId of CURATED_STORE_MODULES) {
		loaded.push(await loadCuratedModule(moduleId));
	}
	return loaded;
}
