import {
	type CompiledTable,
	compileModuleDeclarations,
	ModuleStorageParseError,
	parseStorageRead,
} from "@86d-app/core/schema";
import { createMockDataService } from "@86d-app/core/test-utils";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it } from "vitest";
import reviewsModule from "../index";
import { createReviewController } from "../service-impl";

function compiledReviewTable(): CompiledTable {
	const report = compileModuleDeclarations([reviewsModule()]);
	const table = report.transcoded
		.find((moduleResult) => moduleResult.moduleId === "reviews")
		?.tables.find((candidate) => candidate.tableName === "review");
	if (!table) throw new Error("Compiled reviews.review table is missing");
	return table;
}

function seededReviewRow(images: unknown): Record<string, unknown> {
	return {
		id: "review-seeded",
		productId: "product-seeded",
		authorName: "Seeded Shopper",
		authorEmail: "shopper@example.com",
		rating: 5,
		body: "A seeded review with the persisted photo collection shape.",
		status: "approved",
		isVerifiedPurchase: true,
		helpfulCount: 0,
		images,
		createdAt: "2026-08-25T00:00:00.000Z",
		updatedAt: "2026-08-25T00:00:00.000Z",
	};
}

describe("reviews compiled storage contract", () => {
	it("returns seeded review image arrays through the controller", async () => {
		const backing = createMockDataService();
		const table = compiledReviewTable();
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
		backing._store.set("review:review-seeded", seededReviewRow([]));

		const controller = createReviewController(data);
		const reviews = await controller.listReviewsByProduct("product-seeded", {
			approvedOnly: true,
		});

		expect(reviews).toHaveLength(1);
		expect(reviews[0]?.images).toEqual([]);
	});

	it("rejects malformed persisted review image collections", () => {
		const table = compiledReviewTable();
		const invalidCollections = [
			{ first: { url: "https://example.com/photo.jpg" } },
			Array.from({ length: 6 }, (_, index) => ({
				url: `https://example.com/photo-${index}.jpg`,
			})),
			[{ url: "not-a-url" }],
			[{ url: "https://example.com/photo.jpg", caption: "x".repeat(501) }],
		];

		for (const images of invalidCollections) {
			expect(() => parseStorageRead(table, seededReviewRow(images))).toThrow(
				ModuleStorageParseError,
			);
		}
	});
});
