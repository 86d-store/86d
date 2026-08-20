import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "@86d-app/core/curated-modules";
import { describe, expect, it } from "vitest";
import { loadCuratedModules } from "../load-curated-modules";

describe("curated modules pin", () => {
	it("loads every curated module id", async () => {
		const modules = await loadCuratedModules();
		expect(modules.map((module) => module.id).sort()).toEqual(
			[...CURATED_STORE_MODULES].sort(),
		);
	}, 30_000);

	it("matches relational storage count excluding none modules", async () => {
		const modules = await loadCuratedModules();
		const relational = modules.filter((module) => {
			const storage = module.storage;
			if (storage?.kind === "relational") {
				return Object.keys(storage.tables ?? {}).length > 0;
			}
			return Boolean(module.tables && Object.keys(module.tables).length > 0);
		});
		expect(relational.length).toBe(
			CURATED_STORE_MODULES.length - TIER_NONE_CURATED_MODULES.length,
		);
	}, 30_000);
});
