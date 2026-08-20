#!/usr/bin/env tsx

/**
 * Compile Module schema declarations to Postgres DDL (report mode only).
 * Does not apply SQL to any database.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CURATED_STORE_MODULES } from "../../../packages/core/src/curated-modules.ts";
import {
	compileModuleDeclarations,
	formatCompileReport,
} from "../../../packages/core/src/schema/index.ts";
import type { Module } from "../../../packages/core/src/types/module.ts";

const repoRoot = join(import.meta.dirname, "../../..");
const modulesDir = join(repoRoot, "modules");

async function loadModule(moduleId: string): Promise<Module | null> {
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

async function loadAllModules(): Promise<Module[]> {
	const loaded: Module[] = [];
	for (const moduleId of CURATED_STORE_MODULES) {
		const module = await loadModule(moduleId);
		if (module) {
			loaded.push(module);
		}
	}

	const allDirs = await import("node:fs/promises").then((fs) =>
		fs.readdir(modulesDir, { withFileTypes: true }),
	);
	for (const entry of allDirs) {
		if (!entry.isDirectory()) {
			continue;
		}
		if (
			CURATED_STORE_MODULES.includes(
				entry.name as (typeof CURATED_STORE_MODULES)[number],
			)
		) {
			continue;
		}
		const module = await loadModule(entry.name);
		if (module) {
			loaded.push(module);
		}
	}

	return loaded;
}

async function main() {
	const args = process.argv.slice(2);
	const outIndex = args.indexOf("--out");
	const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;

	const modules = await loadAllModules();
	const report = compileModuleDeclarations(modules);
	const formatted = formatCompileReport(report);

	if (outPath) {
		writeFileSync(outPath, formatted, "utf8");
		console.log(`Wrote ${outPath}`);
	} else {
		console.log(formatted);
	}

	console.error(
		`\nTranscoded: ${report.transcoded.length} modules, ${report.transcoded.reduce((n, m) => n + m.tables.length, 0)} tables`,
	);
	console.error(`Not transcoded: ${report.notTranscoded.length} modules`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
