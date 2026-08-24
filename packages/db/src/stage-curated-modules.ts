import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "@86d-app/core/curated-modules";

export interface StageCuratedModuleSchemasOptions {
	sourceModulesRoot: string;
	destinationModulesRoot: string;
}

const TIER_NONE = new Set<string>(TIER_NONE_CURATED_MODULES);

/**
 * Stage the smallest Module tree needed by runtime seed/DDL loading.
 *
 * Every required source is validated before the destination is replaced so a
 * missing curated schema fails the image build without leaving a partial tree.
 */
export async function stageCuratedModuleSchemas({
	sourceModulesRoot,
	destinationModulesRoot,
}: StageCuratedModuleSchemasOptions): Promise<string[]> {
	const sourceRoot = resolve(sourceModulesRoot);
	const destinationRoot = resolve(destinationModulesRoot);
	if (sourceRoot === destinationRoot) {
		throw new Error("Curated Module source and destination roots must differ.");
	}

	const moduleIds = CURATED_STORE_MODULES.filter(
		(moduleId) => !TIER_NONE.has(moduleId),
	).sort((left, right) => left.localeCompare(right));
	const schemas = moduleIds.map((moduleId) => ({
		moduleId,
		source: join(sourceRoot, moduleId, "src/schema.ts"),
		destination: join(destinationRoot, moduleId, "src/schema.ts"),
	}));

	for (const schema of schemas) {
		try {
			await access(schema.source);
		} catch {
			throw new Error(
				`Curated Module "${schema.moduleId}" has no schema.ts at ${schema.source}`,
			);
		}
	}

	await rm(destinationRoot, { recursive: true, force: true });
	for (const schema of schemas) {
		await mkdir(dirname(schema.destination), { recursive: true });
		await copyFile(schema.source, schema.destination);
	}

	return moduleIds;
}
