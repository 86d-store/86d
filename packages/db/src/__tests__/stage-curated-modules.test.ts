import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "@86d-app/core/curated-modules";
import { afterEach, describe, expect, it } from "vitest";
import { loadCuratedModules } from "../load-curated-modules";
import { stageCuratedModuleSchemas } from "../stage-curated-modules";

const temporaryRoots: string[] = [];
const tierNoneModuleIds = new Set<string>(TIER_NONE_CURATED_MODULES);
const workspaceRoot = join(import.meta.dirname, "../../../..");
const packageRoot = join(import.meta.dirname, "../..");

async function listFiles(root: string, prefix = ""): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(join(root, prefix), {
		withFileTypes: true,
	})) {
		const relativePath = join(prefix, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(root, relativePath)));
		} else {
			files.push(relativePath);
		}
	}
	return files;
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
	);
});

describe("curated Module schema staging", () => {
	it("stages only relational curated schema sources", async () => {
		const temporaryRoot = await mkdtemp(
			join(packageRoot, ".curated-modules-test-"),
		);
		temporaryRoots.push(temporaryRoot);
		const destinationModulesRoot = join(temporaryRoot, "modules");
		const sourceModulesRoot = join(workspaceRoot, "modules");
		const expectedModuleIds = CURATED_STORE_MODULES.filter(
			(moduleId) => !tierNoneModuleIds.has(moduleId),
		).sort((left, right) => left.localeCompare(right));

		const stagedModuleIds = await stageCuratedModuleSchemas({
			sourceModulesRoot,
			destinationModulesRoot,
		});

		expect(stagedModuleIds).toEqual(expectedModuleIds);
		expect(
			(await readdir(destinationModulesRoot)).sort((left, right) =>
				left.localeCompare(right),
			),
		).toEqual(expectedModuleIds);
		const stagedFiles = (await listFiles(destinationModulesRoot)).sort(
			(left, right) => left.localeCompare(right),
		);
		expect(stagedFiles).toHaveLength(22);
		expect(stagedFiles).toEqual(
			expectedModuleIds.map((moduleId) => join(moduleId, "src/schema.ts")),
		);
	}, 30_000);

	it("loads from the staged root and fails closed when it is incomplete", async () => {
		const temporaryRoot = await mkdtemp(
			join(packageRoot, ".curated-modules-test-"),
		);
		temporaryRoots.push(temporaryRoot);
		const destinationModulesRoot = join(temporaryRoot, "modules");
		const sourceModulesRoot = join(workspaceRoot, "modules");
		await stageCuratedModuleSchemas({
			sourceModulesRoot,
			destinationModulesRoot,
		});

		const loaded = await loadCuratedModules({
			modulesRoot: destinationModulesRoot,
		});
		expect(loaded.map((module) => module.id)).toEqual(CURATED_STORE_MODULES);
		expect(loaded).toHaveLength(23);
		expect(loaded.find((module) => module.id === "stripe")?.storage).toEqual({
			kind: "none",
		});

		await rm(join(destinationModulesRoot, "products", "src/schema.ts"));

		await expect(
			loadCuratedModules({ modulesRoot: destinationModulesRoot }),
		).rejects.toThrow(
			`Curated Module "products" has no schema.ts at ${join(destinationModulesRoot, "products", "src/schema.ts")}`,
		);
	}, 30_000);
});
