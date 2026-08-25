import {
	type CompiledTable,
	compileModuleDeclarations,
	ModuleStorageParseError,
	parseStorageRead,
} from "@86d-app/core/schema";
import { createMockDataService } from "@86d-app/core/test-utils";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it } from "vitest";
import searchModule from "../index";
import { createSearchController } from "../service-impl";

function compiledSynonymTable(): CompiledTable {
	const report = compileModuleDeclarations([searchModule()]);
	const table = report.transcoded
		.find((moduleResult) => moduleResult.moduleId === "search")
		?.tables.find((candidate) => candidate.tableName === "searchSynonym");
	if (!table) throw new Error("Compiled search.searchSynonym table is missing");
	return table;
}

function seededSynonymRow(synonyms: unknown): Record<string, unknown> {
	return {
		id: "synonym-seeded",
		term: "loafer",
		synonyms,
		createdAt: "2026-08-25T00:00:00.000Z",
	};
}

describe("search compiled storage contract", () => {
	it("returns seeded synonym arrays through the controller", async () => {
		const backing = createMockDataService();
		const table = compiledSynonymTable();
		const parseRead = (row: Record<string, unknown>) =>
			parseStorageRead(table, row);
		const data: ModuleDataService = {
			async get(entityType, entityId) {
				const row = await backing.get(entityType, entityId);
				return row ? parseRead(row) : null;
			},
			upsert: backing.upsert.bind(backing),
			delete: backing.delete.bind(backing),
			async findMany(entityType, options) {
				const rows = await backing.findMany(entityType, options);
				return rows.map(parseRead);
			},
		};
		backing._store.set(
			"searchSynonym:synonym-seeded",
			seededSynonymRow(["penny loafer", "slip-on", "driver"]),
		);

		const controller = createSearchController(data);
		const synonyms = await controller.listSynonyms();

		expect(synonyms).toHaveLength(1);
		expect(synonyms[0]?.synonyms).toEqual([
			"penny loafer",
			"slip-on",
			"driver",
		]);
	});

	it("rejects malformed persisted synonym collections", () => {
		const table = compiledSynonymTable();
		const invalidCollections = [
			{ first: "penny loafer" },
			[],
			Array.from({ length: 51 }, (_, index) => `synonym-${index}`),
			[42],
			[""],
			["x".repeat(201)],
		];

		for (const synonyms of invalidCollections) {
			expect(() => parseStorageRead(table, seededSynonymRow(synonyms))).toThrow(
				ModuleStorageParseError,
			);
		}
	});
});
