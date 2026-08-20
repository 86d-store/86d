import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniversalDataService } from "../universal-data-service";

// ── Mock Prisma Client ──────────────────────────────────────────────────────

function createMockDb() {
	return {
		moduleData: {
			findMany: vi.fn().mockResolvedValue([]),
			findUnique: vi.fn().mockResolvedValue(null),
			upsert: vi.fn().mockResolvedValue({}),
			delete: vi.fn().mockResolvedValue({}),
			count: vi.fn().mockResolvedValue(0),
		},
		$transaction: vi.fn().mockResolvedValue([]),
	};
}

const MODULE_ID = "mod_test";
const STORE_ID = "store_test";

describe("UniversalDataService", () => {
	let db: ReturnType<typeof createMockDb>;
	let service: UniversalDataService;

	beforeEach(() => {
		db = createMockDb();
		service = new UniversalDataService({
			db,
			storeId: STORE_ID,
			moduleId: MODULE_ID,
		});
	});

	// ── findMany ───────────────────────────────────────────────────────────

	describe("findMany", () => {
		it("queries by moduleId and entityType with default ordering", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product");

			expect(db.moduleData.findMany).toHaveBeenCalledWith({
				where: { moduleId: MODULE_ID, entityType: "product" },
				orderBy: { createdAt: "desc" },
				take: 100,
			});
		});

		it("returns data field from each result row", async () => {
			db.moduleData.findMany.mockResolvedValue([
				{ id: "1", data: { name: "Widget" } },
				{ id: "2", data: { name: "Gadget" } },
			]);

			const results = await service.findMany("product");

			expect(results).toEqual([{ name: "Widget" }, { name: "Gadget" }]);
		});

		it("passes take and skip to Prisma", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", { take: 10, skip: 20 });

			expect(db.moduleData.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 10, skip: 20 }),
			);
		});

		it("bounds an unlimited read to the default page size", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", {});

			const call = db.moduleData.findMany.mock.calls[0][0];
			expect(call.take).toBe(100);
			expect(call).not.toHaveProperty("skip");
		});

		it("refuses a page larger than the ceiling", async () => {
			await expect(
				service.findMany("product", { take: 5_000 }),
			).rejects.toThrow(/at most 1000/);
		});

		it("refuses a take that is not a positive integer", async () => {
			await expect(service.findMany("product", { take: 0 })).rejects.toThrow(
				/positive integer/,
			);
		});

		it("warns once when asked to order by something that is not a column", async () => {
			db.moduleData.findMany.mockResolvedValue([]);
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

			await service.findMany("product", { orderBy: { sortOrder: "asc" } });

			const call = db.moduleData.findMany.mock.calls[0][0];
			expect(call.orderBy).toEqual({ createdAt: "desc" });
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('order product by "sortOrder"'),
			);
			warn.mockRestore();
		});

		it("builds single-key where as direct JSONB path filter", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("subscriber", {
				where: { email: "test@example.com" },
			});

			expect(db.moduleData.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						moduleId: MODULE_ID,
						entityType: "subscriber",
						data: { path: ["email"], equals: "test@example.com" },
					},
				}),
			);
		});

		it("builds multi-key where as AND of JSONB path filters", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", {
				where: { status: "active", categoryId: "cat_1" },
			});

			const call = db.moduleData.findMany.mock.calls[0][0];
			expect(call.where.moduleId).toBe(MODULE_ID);
			expect(call.where.entityType).toBe("product");
			expect(call.where.AND).toEqual(
				expect.arrayContaining([
					{ data: { path: ["status"], equals: "active" } },
					{ data: { path: ["categoryId"], equals: "cat_1" } },
				]),
			);
			expect(call.where.AND).toHaveLength(2);
		});

		it("skips empty where clause", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", { where: {} });

			const call = db.moduleData.findMany.mock.calls[0][0];
			expect(call.where).toEqual({
				moduleId: MODULE_ID,
				entityType: "product",
			});
		});

		it("supports orderBy with createdAt", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", {
				orderBy: { createdAt: "asc" },
			});

			expect(db.moduleData.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ orderBy: { createdAt: "asc" } }),
			);
		});

		it("supports orderBy with updatedAt", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", {
				orderBy: { updatedAt: "desc" },
			});

			expect(db.moduleData.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ orderBy: { updatedAt: "desc" } }),
			);
		});

		it("ignores unsupported orderBy fields, falls back to default", async () => {
			db.moduleData.findMany.mockResolvedValue([]);

			await service.findMany("product", {
				orderBy: { price: "asc" },
			});

			expect(db.moduleData.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ orderBy: { createdAt: "desc" } }),
			);
		});

		it("combines where + take + skip + orderBy", async () => {
			db.moduleData.findMany.mockResolvedValue([
				{ id: "1", data: { name: "A", status: "active" } },
			]);

			const results = await service.findMany("product", {
				where: { status: "active" },
				take: 5,
				skip: 10,
				orderBy: { createdAt: "asc" },
			});

			const call = db.moduleData.findMany.mock.calls[0][0];
			expect(call.where.data).toEqual({
				path: ["status"],
				equals: "active",
			});
			expect(call.take).toBe(5);
			expect(call.skip).toBe(10);
			expect(call.orderBy).toEqual({ createdAt: "asc" });
			expect(results).toEqual([{ name: "A", status: "active" }]);
		});
	});

	// ── count ──────────────────────────────────────────────────────────────

	describe("count", () => {
		it("counts by moduleId and entityType", async () => {
			db.moduleData.count.mockResolvedValue(5);

			const result = await service.count("product");

			expect(db.moduleData.count).toHaveBeenCalledWith({
				where: { moduleId: MODULE_ID, entityType: "product" },
			});
			expect(result).toBe(5);
		});

		it("adds single-key JSONB path filter", async () => {
			db.moduleData.count.mockResolvedValue(3);

			const result = await service.count("product", { status: "active" });

			expect(db.moduleData.count).toHaveBeenCalledWith({
				where: {
					moduleId: MODULE_ID,
					entityType: "product",
					data: { path: ["status"], equals: "active" },
				},
			});
			expect(result).toBe(3);
		});

		it("adds multi-key JSONB AND filter", async () => {
			db.moduleData.count.mockResolvedValue(2);

			await service.count("product", {
				status: "active",
				categoryId: "cat_1",
			});

			const call = db.moduleData.count.mock.calls[0][0];
			expect(call.where.AND).toEqual(
				expect.arrayContaining([
					{ data: { path: ["status"], equals: "active" } },
					{ data: { path: ["categoryId"], equals: "cat_1" } },
				]),
			);
		});
	});

	// ── get ─────────────────────────────────────────────────────────────────

	describe("get", () => {
		it("queries by composite unique key", async () => {
			db.moduleData.findUnique.mockResolvedValue({
				data: { name: "Widget" },
			});

			const result = await service.get("product", "prod_1");

			expect(db.moduleData.findUnique).toHaveBeenCalledWith({
				where: {
					module_entity_unique: {
						moduleId: MODULE_ID,
						entityType: "product",
						entityId: "prod_1",
					},
				},
			});
			expect(result).toEqual({ name: "Widget" });
		});

		it("returns null when entity does not exist", async () => {
			db.moduleData.findUnique.mockResolvedValue(null);

			const result = await service.get("product", "nonexistent");

			expect(result).toBeNull();
		});
	});

	// ── upsert ──────────────────────────────────────────────────────────────

	describe("upsert", () => {
		it("creates or updates an entity", async () => {
			await service.upsert("product", "prod_1", { name: "Widget" });

			expect(db.moduleData.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						module_entity_unique: {
							moduleId: MODULE_ID,
							entityType: "product",
							entityId: "prod_1",
						},
					},
					create: expect.objectContaining({
						moduleId: MODULE_ID,
						entityType: "product",
						entityId: "prod_1",
						data: { name: "Widget" },
						parentId: null,
					}),
					update: expect.objectContaining({
						data: { name: "Widget" },
					}),
				}),
			);
		});

		it("passes parentId when provided", async () => {
			await service.upsert("cartItem", "item_1", { qty: 2 }, "cart_1");

			const call = db.moduleData.upsert.mock.calls[0][0];
			expect(call.create.parentId).toBe("cart_1");
		});
	});

	// ── delete ──────────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes by composite unique key", async () => {
			await service.delete("product", "prod_1");

			expect(db.moduleData.delete).toHaveBeenCalledWith({
				where: {
					module_entity_unique: {
						moduleId: MODULE_ID,
						entityType: "product",
						entityId: "prod_1",
					},
				},
			});
		});
	});

	// ── getChildren ─────────────────────────────────────────────────────────

	describe("getChildren", () => {
		it("queries by parentId and moduleId", async () => {
			db.moduleData.findMany.mockResolvedValue([
				{
					id: "internal_1",
					entityType: "cartItem",
					entityId: "item_1",
					data: { qty: 2 },
				},
			]);

			const results = await service.getChildren("parent_id");

			expect(db.moduleData.findMany).toHaveBeenCalledWith({
				where: { moduleId: MODULE_ID, parentId: "parent_id" },
				take: 1_000,
			});
			expect(results).toEqual([
				{
					id: "internal_1",
					entityType: "cartItem",
					entityId: "item_1",
					data: { qty: 2 },
				},
			]);
		});
	});

	// ── upsertMany ──────────────────────────────────────────────────────────

	describe("upsertMany", () => {
		it("batches upserts in a transaction", async () => {
			await service.upsertMany([
				{
					entityType: "product",
					entityId: "p1",
					data: { name: "A" },
				},
				{
					entityType: "product",
					entityId: "p2",
					data: { name: "B" },
				},
			]);

			expect(db.$transaction).toHaveBeenCalledTimes(1);
			expect(db.moduleData.upsert).toHaveBeenCalledTimes(2);
		});
	});
});
