import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuditLogController } from "../service-impl";

describe("createAuditLogController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuditLogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuditLogController(mockData);
	});

	// ── Log entries ──────────────────────────────────────────────────────

	describe("log", () => {
		it("creates an audit entry with required fields", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				description: "Created product Widget",
			});
			expect(entry.id).toBeDefined();
			expect(entry.action).toBe("create");
			expect(entry.resource).toBe("product");
			expect(entry.description).toBe("Created product Widget");
			expect(entry.actorType).toBe("admin");
			expect(entry.createdAt).toBeInstanceOf(Date);
		});

		it("stores optional fields", async () => {
			const entry = await controller.log({
				action: "update",
				resource: "order",
				resourceId: "ord_123",
				actorId: "admin_1",
				actorEmail: "admin@example.com",
				actorType: "admin",
				description: "Updated order status",
				changes: { status: { from: "pending", to: "processing" } },
				metadata: { source: "admin-panel" },
				ipAddress: "192.168.1.1",
				userAgent: "Mozilla/5.0",
			});
			expect(entry.resourceId).toBe("ord_123");
			expect(entry.actorId).toBe("admin_1");
			expect(entry.actorEmail).toBe("admin@example.com");
			expect(entry.actorType).toBe("admin");
			expect(entry.changes).toEqual({
				status: { from: "pending", to: "processing" },
			});
			expect(entry.metadata).toEqual({ source: "admin-panel" });
			expect(entry.ipAddress).toBe("192.168.1.1");
			expect(entry.userAgent).toBe("Mozilla/5.0");
		});

		it("defaults actorType to admin", async () => {
			const entry = await controller.log({
				action: "delete",
				resource: "product",
				description: "Deleted product",
			});
			expect(entry.actorType).toBe("admin");
		});

		it("allows system actor type", async () => {
			const entry = await controller.log({
				action: "status_change",
				resource: "order",
				actorType: "system",
				description: "Auto-fulfilled order",
			});
			expect(entry.actorType).toBe("system");
		});

		it("allows api_key actor type", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				actorType: "api_key",
				description: "Created via API",
			});
			expect(entry.actorType).toBe("api_key");
		});

		it("creates unique IDs for each entry", async () => {
			const e1 = await controller.log({
				action: "create",
				resource: "product",
				description: "First",
			});
			const e2 = await controller.log({
				action: "create",
				resource: "product",
				description: "Second",
			});
			expect(e1.id).not.toBe(e2.id);
		});
	});

	// ── Get by ID ────────────────────────────────────────────────────────

	describe("getById", () => {
		it("returns entry by ID", async () => {
			const created = await controller.log({
				action: "create",
				resource: "product",
				description: "Test",
			});
			const found = await controller.getById(created.id);
			expect(found?.action).toBe("create");
			expect(found?.resource).toBe("product");
		});

		it("returns null for unknown ID", async () => {
			const found = await controller.getById("unknown");
			expect(found).toBeNull();
		});
	});

	// ── List entries ─────────────────────────────────────────────────────

	describe("list", () => {
		it("returns all entries", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "P1",
			});
			await controller.log({
				action: "update",
				resource: "order",
				description: "O1",
			});
			await controller.log({
				action: "delete",
				resource: "customer",
				description: "C1",
			});

			const result = await controller.list();
			expect(result.entries).toHaveLength(3);
			expect(result.total).toBe(3);
		});

		it("filters by action", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "P1",
			});
			await controller.log({
				action: "update",
				resource: "product",
				description: "P2",
			});
			await controller.log({
				action: "delete",
				resource: "product",
				description: "P3",
			});

			const result = await controller.list({ action: "create" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].action).toBe("create");
		});

		it("filters by resource", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "P1",
			});
			await controller.log({
				action: "create",
				resource: "order",
				description: "O1",
			});

			const result = await controller.list({ resource: "product" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].resource).toBe("product");
		});

		it("filters by actorId", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "By admin 1",
			});
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_2",
				description: "By admin 2",
			});

			const result = await controller.list({ actorId: "admin_1" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].actorId).toBe("admin_1");
		});

		it("filters by actorType", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorType: "admin",
				description: "Admin action",
			});
			await controller.log({
				action: "status_change",
				resource: "order",
				actorType: "system",
				description: "System action",
			});

			const result = await controller.list({ actorType: "system" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].actorType).toBe("system");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					description: `Product ${i}`,
				});
			}

			const result = await controller.list({ take: 2 });
			expect(result.entries).toHaveLength(2);
		});
	});

	// ── List for resource ────────────────────────────────────────────────

	describe("listForResource", () => {
		it("returns entries for a specific resource instance", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_1",
				description: "Created",
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_1",
				description: "Updated name",
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_2",
				description: "Different product",
			});

			const entries = await controller.listForResource("product", "prod_1");
			expect(entries).toHaveLength(2);
			for (const e of entries) {
				expect(e.resourceId).toBe("prod_1");
			}
		});

		it("returns empty array for unknown resource", async () => {
			const entries = await controller.listForResource("product", "unknown");
			expect(entries).toHaveLength(0);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "update",
					resource: "product",
					resourceId: "prod_1",
					description: `Update ${i}`,
				});
			}

			const entries = await controller.listForResource("product", "prod_1", {
				take: 2,
			});
			expect(entries).toHaveLength(2);
		});
	});

	// ── List for actor ───────────────────────────────────────────────────

	describe("listForActor", () => {
		it("returns entries by a specific actor", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Admin 1 action",
			});
			await controller.log({
				action: "update",
				resource: "order",
				actorId: "admin_1",
				description: "Admin 1 action 2",
			});
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_2",
				description: "Admin 2 action",
			});

			const entries = await controller.listForActor("admin_1");
			expect(entries).toHaveLength(2);
			for (const e of entries) {
				expect(e.actorId).toBe("admin_1");
			}
		});

		it("returns empty for unknown actor", async () => {
			const entries = await controller.listForActor("nobody");
			expect(entries).toHaveLength(0);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					actorId: "admin_1",
					description: `Action ${i}`,
				});
			}

			const entries = await controller.listForActor("admin_1", {
				take: 3,
			});
			expect(entries).toHaveLength(3);
		});
	});

	// ── Summary ──────────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns zero summary for empty log", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(0);
			expect(summary.entriesByAction).toEqual({});
			expect(summary.entriesByResource).toEqual({});
			expect(summary.recentActors).toHaveLength(0);
		});

		it("calculates correct action and resource counts", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "P1",
			});
			await controller.log({
				action: "create",
				resource: "product",
				description: "P2",
			});
			await controller.log({
				action: "update",
				resource: "order",
				description: "O1",
			});
			await controller.log({
				action: "delete",
				resource: "product",
				description: "P3",
			});

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(4);
			expect(summary.entriesByAction.create).toBe(2);
			expect(summary.entriesByAction.update).toBe(1);
			expect(summary.entriesByAction.delete).toBe(1);
			expect(summary.entriesByResource.product).toBe(3);
			expect(summary.entriesByResource.order).toBe(1);
		});

		it("tracks actor counts sorted by activity", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				actorEmail: "a1@test.com",
				description: "A",
			});
			await controller.log({
				action: "update",
				resource: "product",
				actorId: "admin_1",
				actorEmail: "a1@test.com",
				description: "B",
			});
			await controller.log({
				action: "create",
				resource: "order",
				actorId: "admin_2",
				actorEmail: "a2@test.com",
				description: "C",
			});

			const summary = await controller.getSummary();
			expect(summary.recentActors).toHaveLength(2);
			expect(summary.recentActors[0].actorId).toBe("admin_1");
			expect(summary.recentActors[0].count).toBe(2);
			expect(summary.recentActors[1].actorId).toBe("admin_2");
			expect(summary.recentActors[1].count).toBe(1);
		});

		it("ignores entries without actorId in recentActors", async () => {
			await controller.log({
				action: "status_change",
				resource: "order",
				actorType: "system",
				description: "System action without actorId",
			});

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(1);
			expect(summary.recentActors).toHaveLength(0);
		});
	});

	// ── Purge ────────────────────────────────────────────────────────────

	describe("purge", () => {
		it("deletes entries older than the given date", async () => {
			// Create an old entry by logging, then manually backdating it
			const oldEntry = await controller.log({
				action: "create",
				resource: "product",
				description: "Old entry",
			});
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: oldDate,
			} as Record<string, unknown>);

			// Create a recent entry
			await controller.log({
				action: "update",
				resource: "product",
				description: "Recent entry",
			});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purge(cutoff);

			expect(deleted).toBe(1);

			const result = await controller.list();
			expect(result.total).toBe(1);
			expect(result.entries[0].description).toBe("Recent entry");
		});

		it("returns 0 when nothing to purge", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Recent",
			});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purge(cutoff);
			expect(deleted).toBe(0);
		});

		it("purges all entries when cutoff is in the future", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "E1",
			});
			await controller.log({
				action: "update",
				resource: "order",
				description: "E2",
			});

			const future = new Date();
			future.setDate(future.getDate() + 1);
			const deleted = await controller.purge(future);

			expect(deleted).toBe(2);
			const result = await controller.list();
			expect(result.total).toBe(0);
		});
	});
});
