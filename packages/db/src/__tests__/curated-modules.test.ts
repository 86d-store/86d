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
	});

	it("matches transcoded count excluding tier-none modules", async () => {
		const modules = await loadCuratedModules();
		const transcoded = modules.filter(
			(module) => module.tables && Object.keys(module.tables).length > 0,
		);
		expect(transcoded.length).toBe(
			CURATED_STORE_MODULES.length - TIER_NONE_CURATED_MODULES.length,
		);
	});
});
