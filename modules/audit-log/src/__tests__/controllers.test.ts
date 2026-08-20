import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "../service";
import { createAuditLogController } from "../service-impl";

describe("audit-log controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuditLogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuditLogController(mockData);
	});

	// ── All action types ────────────────────────────────────────────────

	describe("log — all action types", () => {
		const actionTypes = [
			"create",
			"update",
			"delete",
			"bulk_create",
			"bulk_update",
			"bulk_delete",
			"login",
			"logout",
			"export",
			"import",
			"settings_change",
			"status_change",
			"custom",
		] as const;

		for (const action of actionTypes) {
			it(`records action type "${action}"`, async () => {
				const entry = await controller.log({
					action,
					resource: "test",
					description: `Testing ${action}`,
				});
				expect(entry.action).toBe(action);
			});
		}
	});

	// ── List — combined filters ─────────────────────────────────────────

	describe("list — combined filters", () => {
		beforeEach(async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				actorType: "admin",
				description: "Created product",
			});
			await controller.log({
				action: "update",
				resource: "product",
				actorId: "admin_1",
				actorType: "admin",
				description: "Updated product",
			});
			await controller.log({
				action: "create",
				resource: "order",
				actorId: "admin_2",
				actorType: "admin",
				description: "Created order",
			});
			await controller.log({
				action: "status_change",
				resource: "order",
				actorType: "system",
				description: "System status change",
			});
		});

		it("filters by action + resource", async () => {
			const result = await controller.list({
				action: "create",
				resource: "product",
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].description).toBe("Created product");
		});

		it("filters by actorId + actorType", async () => {
			const result = await controller.list({
				actorId: "admin_1",
				actorType: "admin",
			});
			expect(result.entries).toHaveLength(2);
		});

		it("filters by action + actorType", async () => {
			const result = await controller.list({
				action: "status_change",
				actorType: "system",
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].description).toBe("System status change");
		});

		it("returns empty when no matches for combined filter", async () => {
			const result = await controller.list({
				action: "delete",
				resource: "customer",
			});
			expect(result.entries).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("combines skip and take for pagination", async () => {
			const result = await controller.list({ take: 2, skip: 1 });
			expect(result.entries.length).toBeLessThanOrEqual(2);
		});
	});

	// ── List — date filtering ───────────────────────────────────────────

	describe("list — date filtering", () => {
		it("filters entries by dateFrom", async () => {
			const old = await controller.log({
				action: "create",
				resource: "product",
				description: "Old",
			});
			const oldDate = new Date("2024-01-01");
			await mockData.upsert("auditEntry", old.id, {
				...old,
				createdAt: oldDate,
			} as Record<string, unknown>);

			await controller.log({
				action: "create",
				resource: "product",
				description: "Recent",
			});

			const result = await controller.list({
				dateFrom: new Date("2025-01-01"),
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].description).toBe("Recent");
		});

		it("filters entries by dateTo", async () => {
			const old = await controller.log({
				action: "create",
				resource: "product",
				description: "Old",
			});
			const oldDate = new Date("2024-01-01");
			await mockData.upsert("auditEntry", old.id, {
				...old,
				createdAt: oldDate,
			} as Record<string, unknown>);

			await controller.log({
				action: "create",
				resource: "product",
				description: "Recent",
			});

			const result = await controller.list({
				dateTo: new Date("2024-06-01"),
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].description).toBe("Old");
		});

		it("filters entries by dateFrom + dateTo range", async () => {
			const e1 = await controller.log({
				action: "create",
				resource: "product",
				description: "Jan",
			});
			await mockData.upsert("auditEntry", e1.id, {
				...e1,
				createdAt: new Date("2024-01-15"),
			} as Record<string, unknown>);

			const e2 = await controller.log({
				action: "create",
				resource: "product",
				description: "Mar",
			});
			await mockData.upsert("auditEntry", e2.id, {
				...e2,
				createdAt: new Date("2024-03-15"),
			} as Record<string, unknown>);

			const e3 = await controller.log({
				action: "create",
				resource: "product",
				description: "Jun",
			});
			await mockData.upsert("auditEntry", e3.id, {
				...e3,
				createdAt: new Date("2024-06-15"),
			} as Record<string, unknown>);

			const result = await controller.list({
				dateFrom: new Date("2024-02-01"),
				dateTo: new Date("2024-05-01"),
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].description).toBe("Mar");
		});
	});

	// ── getSummary — date ranges ────────────────────────────────────────

	describe("getSummary — date range filtering", () => {
		it("filters summary by dateFrom", async () => {
			const old = await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Old",
			});
			await mockData.upsert("auditEntry", old.id, {
				...old,
				createdAt: new Date("2024-01-01"),
			} as Record<string, unknown>);

			await controller.log({
				action: "update",
				resource: "order",
				actorId: "admin_2",
				description: "Recent",
			});

			const summary = await controller.getSummary({
				dateFrom: new Date("2025-01-01"),
			});
			expect(summary.totalEntries).toBe(1);
			expect(summary.entriesByAction.update).toBe(1);
			expect(summary.entriesByAction.create).toBeUndefined();
		});

		it("filters summary by dateTo", async () => {
			const old = await controller.log({
				action: "create",
				resource: "product",
				description: "Old",
			});
			await mockData.upsert("auditEntry", old.id, {
				...old,
				createdAt: new Date("2024-01-01"),
			} as Record<string, unknown>);

			await controller.log({
				action: "update",
				resource: "order",
				description: "Recent",
			});

			const summary = await controller.getSummary({
				dateTo: new Date("2024-06-01"),
			});
			expect(summary.totalEntries).toBe(1);
			expect(summary.entriesByAction.create).toBe(1);
		});

		it("limits recentActors to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					actorId: `admin_${i}`,
					actorEmail: `admin${i}@test.com`,
					description: `Entry ${i}`,
				});
			}

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(15);
			expect(summary.recentActors).toHaveLength(10);
		});
	});

	// ── listForResource — edge cases ────────────────────────────────────

	describe("listForResource — edge cases", () => {
		it("supports skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "update",
					resource: "product",
					resourceId: "prod_1",
					description: `Update ${i}`,
				});
			}

			const entries = await controller.listForResource("product", "prod_1", {
				skip: 2,
			});
			expect(entries.length).toBeLessThanOrEqual(3);
		});

		it("returns only entries matching both resource and resourceId", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_1",
				description: "Match",
			});
			await controller.log({
				action: "create",
				resource: "order",
				resourceId: "prod_1",
				description: "Different resource",
			});
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_2",
				description: "Different ID",
			});

			const entries = await controller.listForResource("product", "prod_1");
			expect(entries).toHaveLength(1);
			expect(entries[0].description).toBe("Match");
		});
	});

	// ── listForActor — edge cases ───────────────────────────────────────

	describe("listForActor — edge cases", () => {
		it("supports skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					actorId: "admin_1",
					description: `Action ${i}`,
				});
			}

			const entries = await controller.listForActor("admin_1", { skip: 2 });
			expect(entries.length).toBeLessThanOrEqual(3);
		});

		it("returns entries across different resources for same actor", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Product action",
			});
			await controller.log({
				action: "update",
				resource: "order",
				actorId: "admin_1",
				description: "Order action",
			});
			await controller.log({
				action: "delete",
				resource: "customer",
				actorId: "admin_1",
				description: "Customer action",
			});

			const entries = await controller.listForActor("admin_1");
			expect(entries).toHaveLength(3);
			const resources = entries.map((e: AuditEntry) => e.resource);
			expect(resources).toContain("product");
			expect(resources).toContain("order");
			expect(resources).toContain("customer");
		});
	});

	// ── Log — metadata and changes edge cases ───────────────────────────

	describe("log — metadata edge cases", () => {
		it("stores empty changes object", async () => {
			const entry = await controller.log({
				action: "update",
				resource: "product",
				description: "No changes recorded",
				changes: {},
			});
			expect(entry.changes).toEqual({});
		});

		it("stores deeply nested changes", async () => {
			const changes = {
				variants: {
					added: [{ id: "v1", name: "Small" }],
					removed: [{ id: "v2", name: "Large" }],
				},
			};
			const entry = await controller.log({
				action: "update",
				resource: "product",
				description: "Variant changes",
				changes,
			});
			expect(entry.changes).toEqual(changes);
		});

		it("stores empty metadata object", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				description: "With metadata",
				metadata: {},
			});
			expect(entry.metadata).toEqual({});
		});

		it("stores complex metadata", async () => {
			const metadata = {
				source: "bulk-import",
				batchId: "batch_123",
				affectedCount: 50,
				tags: ["products", "electronics"],
			};
			const entry = await controller.log({
				action: "import",
				resource: "product",
				description: "Bulk import",
				metadata,
			});
			expect(entry.metadata).toEqual(metadata);
		});
	});

	// ── Purge — granular tests ──────────────────────────────────────────

	describe("purge — granular edge cases", () => {
		it("handles mixed old and new entries correctly", async () => {
			// Create 3 old entries and 2 new
			for (let i = 0; i < 3; i++) {
				const entry = await controller.log({
					action: "create",
					resource: "product",
					description: `Old ${i}`,
				});
				const oldDate = new Date();
				oldDate.setDate(oldDate.getDate() - 90);
				await mockData.upsert("auditEntry", entry.id, {
					...entry,
					createdAt: oldDate,
				} as Record<string, unknown>);
			}
			for (let i = 0; i < 2; i++) {
				await controller.log({
					action: "update",
					resource: "order",
					description: `New ${i}`,
				});
			}

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purge(cutoff);

			expect(deleted).toBe(3);
			const remaining = await controller.list();
			expect(remaining.total).toBe(2);
		});

		it("purge on empty log returns 0", async () => {
			const cutoff = new Date();
			const deleted = await controller.purge(cutoff);
			expect(deleted).toBe(0);
		});
	});

	// ── getSummary — sorting and aggregation ────────────────────────────

	describe("getSummary — detailed aggregation", () => {
		it("sorts recentActors by count descending", async () => {
			// admin_3 = 3 actions, admin_2 = 2, admin_1 = 1
			for (let i = 0; i < 3; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					actorId: "admin_3",
					description: `A3-${i}`,
				});
			}
			for (let i = 0; i < 2; i++) {
				await controller.log({
					action: "update",
					resource: "order",
					actorId: "admin_2",
					description: `A2-${i}`,
				});
			}
			await controller.log({
				action: "delete",
				resource: "customer",
				actorId: "admin_1",
				description: "A1",
			});

			const summary = await controller.getSummary();
			expect(summary.recentActors[0].actorId).toBe("admin_3");
			expect(summary.recentActors[0].count).toBe(3);
			expect(summary.recentActors[1].actorId).toBe("admin_2");
			expect(summary.recentActors[1].count).toBe(2);
			expect(summary.recentActors[2].actorId).toBe("admin_1");
			expect(summary.recentActors[2].count).toBe(1);
		});

		it("counts all action types correctly", async () => {
			await controller.log({
				action: "bulk_create",
				resource: "product",
				description: "Bulk",
			});
			await controller.log({
				action: "login",
				resource: "auth",
				description: "Login",
			});
			await controller.log({
				action: "export",
				resource: "product",
				description: "Export",
			});

			const summary = await controller.getSummary();
			expect(summary.entriesByAction.bulk_create).toBe(1);
			expect(summary.entriesByAction.login).toBe(1);
			expect(summary.entriesByAction.export).toBe(1);
			expect(summary.entriesByResource.product).toBe(2);
			expect(summary.entriesByResource.auth).toBe(1);
		});
	});

	// ── getById — after modifications ───────────────────────────────────

	describe("getById — data integrity", () => {
		it("returns entry with all fields after creation", async () => {
			const created = await controller.log({
				action: "update",
				resource: "order",
				resourceId: "ord_99",
				actorId: "admin_5",
				actorEmail: "admin5@test.com",
				actorType: "admin",
				description: "Updated order",
				changes: { status: "shipped" },
				metadata: { carrier: "ups" },
				ipAddress: "10.0.0.1",
				userAgent: "TestAgent/1.0",
			});

			const found = await controller.getById(created.id);
			expect(found).not.toBeNull();
			expect(found?.resourceId).toBe("ord_99");
			expect(found?.actorEmail).toBe("admin5@test.com");
			expect(found?.changes).toEqual({ status: "shipped" });
			expect(found?.metadata).toEqual({ carrier: "ups" });
			expect(found?.ipAddress).toBe("10.0.0.1");
			expect(found?.userAgent).toBe("TestAgent/1.0");
		});

		it("returns null after entry is purged", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				description: "Will be purged",
			});

			const future = new Date();
			future.setDate(future.getDate() + 1);
			await controller.purge(future);

			const found = await controller.getById(entry.id);
			expect(found).toBeNull();
		});
	});
});
