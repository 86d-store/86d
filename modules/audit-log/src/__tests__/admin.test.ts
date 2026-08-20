import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuditLogController } from "../service-impl";

describe("audit-log admin workflows", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuditLogController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAuditLogController(data);
	});

	// ── Entry creation and retrieval ────────────────────────────────────

	describe("entry creation and retrieval", () => {
		it("logs a create action and persists all fields", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_1",
				actorId: "admin_1",
				actorEmail: "admin@shop.com",
				description: "Created product Gadget",
				ipAddress: "10.0.0.1",
				userAgent: "TestAgent/1.0",
			});
			expect(entry.action).toBe("create");
			expect(entry.resource).toBe("product");
			expect(entry.resourceId).toBe("prod_1");
			expect(entry.actorId).toBe("admin_1");
			expect(entry.actorEmail).toBe("admin@shop.com");
			expect(entry.description).toBe("Created product Gadget");
			expect(entry.ipAddress).toBe("10.0.0.1");
			expect(entry.userAgent).toBe("TestAgent/1.0");
			expect(entry.createdAt).toBeInstanceOf(Date);
		});

		it("generates unique IDs for each entry", async () => {
			const a = await controller.log({
				action: "create",
				resource: "product",
				description: "First",
			});
			const b = await controller.log({
				action: "create",
				resource: "product",
				description: "Second",
			});
			expect(a.id).toBeDefined();
			expect(b.id).toBeDefined();
			expect(a.id).not.toBe(b.id);
		});

		it("defaults actorType to admin when not specified", async () => {
			const entry = await controller.log({
				action: "update",
				resource: "order",
				description: "Updated order",
			});
			expect(entry.actorType).toBe("admin");
		});

		it("respects explicit actorType values", async () => {
			const system = await controller.log({
				action: "status_change",
				resource: "order",
				actorType: "system",
				description: "System status change",
			});
			const apiKey = await controller.log({
				action: "export",
				resource: "catalog",
				actorType: "api_key",
				description: "API export",
			});
			expect(system.actorType).toBe("system");
			expect(apiKey.actorType).toBe("api_key");
		});

		it("retrieves an entry by ID via getById", async () => {
			const created = await controller.log({
				action: "delete",
				resource: "category",
				resourceId: "cat_5",
				description: "Deleted category",
			});
			const fetched = await controller.getById(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.action).toBe("delete");
			expect(fetched?.resource).toBe("category");
			expect(fetched?.resourceId).toBe("cat_5");
		});
	});

	// ── Resource history tracking ───────────────────────────────────────

	describe("resource history tracking", () => {
		it("returns full history for a specific resource instance", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_42",
				description: "Created product",
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_42",
				description: "Updated price",
			});
			await controller.log({
				action: "status_change",
				resource: "product",
				resourceId: "prod_42",
				description: "Published product",
			});
			const history = await controller.listForResource("product", "prod_42");
			expect(history).toHaveLength(3);
		});

		it("filters by exact resourceId and does not mix resources", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_1",
				description: "Product 1",
			});
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_2",
				description: "Product 2",
			});
			const history = await controller.listForResource("product", "prod_1");
			expect(history).toHaveLength(1);
			expect(history[0]?.description).toBe("Product 1");
		});

		it("filters by resource type as well as resourceId", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "item_1",
				description: "Product item_1",
			});
			await controller.log({
				action: "create",
				resource: "order",
				resourceId: "item_1",
				description: "Order item_1",
			});
			const history = await controller.listForResource("product", "item_1");
			expect(history).toHaveLength(1);
			expect(history[0]?.resource).toBe("product");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "update",
					resource: "product",
					resourceId: "prod_paged",
					description: `Update ${i}`,
				});
			}
			const page = await controller.listForResource("product", "prod_paged", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no entries exist for a resource", async () => {
			const history = await controller.listForResource(
				"product",
				"nonexistent",
			);
			expect(history).toHaveLength(0);
		});
	});

	// ── Actor audit trail ───────────────────────────────────────────────

	describe("actor audit trail", () => {
		it("returns only entries for the specified actor", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_A",
				description: "Admin A action",
			});
			await controller.log({
				action: "update",
				resource: "product",
				actorId: "admin_B",
				description: "Admin B action",
			});
			const trail = await controller.listForActor("admin_A");
			expect(trail).toHaveLength(1);
			expect(trail[0]?.actorId).toBe("admin_A");
		});

		it("tracks actor actions across multiple resources", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_X",
				description: "Created product",
			});
			await controller.log({
				action: "update",
				resource: "order",
				actorId: "admin_X",
				description: "Updated order",
			});
			await controller.log({
				action: "delete",
				resource: "category",
				actorId: "admin_X",
				description: "Deleted category",
			});
			const trail = await controller.listForActor("admin_X");
			expect(trail).toHaveLength(3);
			const resources = trail.map((e) => e.resource);
			expect(resources).toContain("product");
			expect(resources).toContain("order");
			expect(resources).toContain("category");
		});

		it("supports pagination for actor trail", async () => {
			for (let i = 0; i < 6; i++) {
				await controller.log({
					action: "update",
					resource: "product",
					actorId: "busy_admin",
					description: `Action ${i}`,
				});
			}
			const page = await controller.listForActor("busy_admin", {
				take: 3,
				skip: 2,
			});
			expect(page).toHaveLength(3);
		});

		it("returns empty array for unknown actor", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Existing action",
			});
			const trail = await controller.listForActor("unknown_actor");
			expect(trail).toHaveLength(0);
		});

		it("distinguishes actors with different IDs in the same session", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Admin 1 creates",
			});
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_2",
				description: "Admin 2 creates",
			});
			const trail1 = await controller.listForActor("admin_1");
			const trail2 = await controller.listForActor("admin_2");
			expect(trail1).toHaveLength(1);
			expect(trail2).toHaveLength(1);
			expect(trail1[0]?.description).toBe("Admin 1 creates");
			expect(trail2[0]?.description).toBe("Admin 2 creates");
		});
	});

	// ── Filtering and search ────────────────────────────────────────────

	describe("filtering and search", () => {
		it("filters by action type", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Created",
			});
			await controller.log({
				action: "delete",
				resource: "product",
				description: "Deleted",
			});
			await controller.log({
				action: "create",
				resource: "order",
				description: "Created order",
			});
			const result = await controller.list({ action: "create" });
			expect(result.entries).toHaveLength(2);
			for (const e of result.entries) {
				expect(e.action).toBe("create");
			}
		});

		it("filters by resource type", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Product",
			});
			await controller.log({
				action: "create",
				resource: "order",
				description: "Order",
			});
			const result = await controller.list({ resource: "order" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0]?.resource).toBe("order");
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
			expect(result.entries[0]?.actorId).toBe("admin_1");
		});

		it("filters by actorType", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				actorType: "system",
				description: "System action",
			});
			await controller.log({
				action: "create",
				resource: "product",
				description: "Admin action",
			});
			const result = await controller.list({ actorType: "system" });
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0]?.actorType).toBe("system");
		});

		it("applies combined filters (action + resource)", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Create product",
			});
			await controller.log({
				action: "create",
				resource: "order",
				description: "Create order",
			});
			await controller.log({
				action: "delete",
				resource: "product",
				description: "Delete product",
			});
			const result = await controller.list({
				action: "create",
				resource: "product",
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0]?.description).toBe("Create product");
		});

		it("filters by date range (dateFrom and dateTo)", async () => {
			const entry = await controller.log({
				action: "create",
				resource: "product",
				description: "Recent entry",
			});
			// Override createdAt to a known past date
			const pastDate = new Date("2025-01-15T00:00:00Z");
			await data.upsert("auditEntry", entry.id, {
				...entry,
				createdAt: pastDate,
			} as Record<string, unknown>);

			const entry2 = await controller.log({
				action: "update",
				resource: "product",
				description: "Current entry",
			});

			// Filter to only include entries from 2026 onward
			const result = await controller.list({
				dateFrom: new Date("2026-01-01T00:00:00Z"),
			});
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0]?.id).toBe(entry2.id);

			// Filter to only include entries before 2026
			const pastResult = await controller.list({
				dateTo: new Date("2025-12-31T23:59:59Z"),
			});
			expect(pastResult.entries).toHaveLength(1);
			expect(pastResult.entries[0]?.id).toBe(entry.id);
		});
	});

	// ── Summary analytics ───────────────────────────────────────────────

	describe("summary analytics", () => {
		it("counts entries by action type", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "C1",
			});
			await controller.log({
				action: "create",
				resource: "product",
				description: "C2",
			});
			await controller.log({
				action: "delete",
				resource: "product",
				description: "D1",
			});
			const summary = await controller.getSummary();
			expect(summary.entriesByAction.create).toBe(2);
			expect(summary.entriesByAction.delete).toBe(1);
		});

		it("counts entries by resource type", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "P",
			});
			await controller.log({
				action: "create",
				resource: "order",
				description: "O1",
			});
			await controller.log({
				action: "update",
				resource: "order",
				description: "O2",
			});
			const summary = await controller.getSummary();
			expect(summary.entriesByResource.product).toBe(1);
			expect(summary.entriesByResource.order).toBe(2);
		});

		it("limits recentActors to top 10", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.log({
					action: "create",
					resource: "product",
					actorId: `actor_${i}`,
					description: `Action by actor ${i}`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.recentActors).toHaveLength(10);
		});

		it("sorts recentActors by count descending", async () => {
			// actor_heavy gets 5 entries, actor_light gets 1
			for (let i = 0; i < 5; i++) {
				await controller.log({
					action: "update",
					resource: "product",
					actorId: "actor_heavy",
					actorEmail: "heavy@shop.com",
					description: `Heavy action ${i}`,
				});
			}
			await controller.log({
				action: "create",
				resource: "product",
				actorId: "actor_light",
				actorEmail: "light@shop.com",
				description: "Light action",
			});
			for (let i = 0; i < 3; i++) {
				await controller.log({
					action: "delete",
					resource: "product",
					actorId: "actor_mid",
					actorEmail: "mid@shop.com",
					description: `Mid action ${i}`,
				});
			}

			const summary = await controller.getSummary();
			expect(summary.recentActors[0]?.actorId).toBe("actor_heavy");
			expect(summary.recentActors[0]?.count).toBe(5);
			expect(summary.recentActors[1]?.actorId).toBe("actor_mid");
			expect(summary.recentActors[1]?.count).toBe(3);
			expect(summary.recentActors[2]?.actorId).toBe("actor_light");
			expect(summary.recentActors[2]?.count).toBe(1);
		});

		it("supports date range filtering in summary", async () => {
			const oldEntry = await controller.log({
				action: "create",
				resource: "product",
				actorId: "admin_1",
				description: "Old entry",
			});
			const pastDate = new Date("2024-06-01T00:00:00Z");
			await data.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: pastDate,
			} as Record<string, unknown>);

			await controller.log({
				action: "update",
				resource: "order",
				actorId: "admin_2",
				description: "Recent entry",
			});

			const summary = await controller.getSummary({
				dateFrom: new Date("2026-01-01T00:00:00Z"),
			});
			expect(summary.totalEntries).toBe(1);
			expect(summary.entriesByAction.update).toBe(1);
			expect(summary.entriesByAction.create).toBeUndefined();
		});

		it("returns zeros and empty arrays for empty state", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(0);
			expect(summary.entriesByAction).toEqual({});
			expect(summary.entriesByResource).toEqual({});
			expect(summary.recentActors).toHaveLength(0);
		});
	});

	// ── Purge workflows ─────────────────────────────────────────────────

	describe("purge workflows", () => {
		it("deletes entries older than the cutoff and returns count", async () => {
			const old1 = await controller.log({
				action: "create",
				resource: "product",
				description: "Old 1",
			});
			const old2 = await controller.log({
				action: "update",
				resource: "product",
				description: "Old 2",
			});

			const pastDate = new Date("2024-01-01T00:00:00Z");
			await data.upsert("auditEntry", old1.id, {
				...old1,
				createdAt: pastDate,
			} as Record<string, unknown>);
			await data.upsert("auditEntry", old2.id, {
				...old2,
				createdAt: pastDate,
			} as Record<string, unknown>);

			await controller.log({
				action: "delete",
				resource: "product",
				description: "Recent",
			});

			const deleted = await controller.purge(new Date("2025-01-01T00:00:00Z"));
			expect(deleted).toBe(2);
		});

		it("keeps entries newer than the cutoff intact", async () => {
			const old = await controller.log({
				action: "create",
				resource: "product",
				description: "Old",
			});
			await data.upsert("auditEntry", old.id, {
				...old,
				createdAt: new Date("2024-01-01T00:00:00Z"),
			} as Record<string, unknown>);

			const recent = await controller.log({
				action: "update",
				resource: "product",
				description: "Recent",
			});

			await controller.purge(new Date("2025-01-01T00:00:00Z"));

			const remaining = await controller.list();
			expect(remaining.entries).toHaveLength(1);
			expect(remaining.entries[0]?.id).toBe(recent.id);
		});

		it("deletes all entries when cutoff is in the future", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Entry 1",
			});
			await controller.log({
				action: "update",
				resource: "order",
				description: "Entry 2",
			});

			const futureDate = new Date("2099-01-01T00:00:00Z");
			const deleted = await controller.purge(futureDate);
			expect(deleted).toBe(2);

			const remaining = await controller.list();
			expect(remaining.entries).toHaveLength(0);
		});

		it("returns 0 when purging an empty log", async () => {
			const deleted = await controller.purge(new Date("2099-01-01T00:00:00Z"));
			expect(deleted).toBe(0);
		});

		it("returns 0 when no entries are older than the cutoff", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "Recent entry",
			});
			const veryOldCutoff = new Date("2020-01-01T00:00:00Z");
			const deleted = await controller.purge(veryOldCutoff);
			expect(deleted).toBe(0);

			const remaining = await controller.list();
			expect(remaining.entries).toHaveLength(1);
		});
	});

	// ── Full admin audit workflow ───────────────────────────────────────

	describe("full admin audit workflow", () => {
		it("captures a complete admin session lifecycle", async () => {
			const actorId = "admin_session_1";
			const actorEmail = "admin@mystore.com";
			const ip = "192.168.1.100";

			await controller.log({
				action: "login",
				resource: "auth",
				actorId,
				actorEmail,
				ipAddress: ip,
				description: "Admin logged in",
			});
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_new",
				actorId,
				actorEmail,
				ipAddress: ip,
				description: "Created product Widget Pro",
				changes: { name: { from: null, to: "Widget Pro" } },
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_new",
				actorId,
				actorEmail,
				ipAddress: ip,
				description: "Updated product price",
				changes: { price: { from: 9.99, to: 14.99 } },
			});
			await controller.log({
				action: "delete",
				resource: "product",
				resourceId: "prod_new",
				actorId,
				actorEmail,
				ipAddress: ip,
				description: "Deleted product Widget Pro",
			});
			await controller.log({
				action: "logout",
				resource: "auth",
				actorId,
				actorEmail,
				ipAddress: ip,
				description: "Admin logged out",
			});

			const allEntries = await controller.list();
			expect(allEntries.total).toBe(5);
		});

		it("retrieves the full trail for the session admin", async () => {
			const actorId = "admin_trail";

			await controller.log({
				action: "login",
				resource: "auth",
				actorId,
				description: "Login",
			});
			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_A",
				actorId,
				description: "Created A",
			});
			await controller.log({
				action: "update",
				resource: "order",
				resourceId: "ord_B",
				actorId,
				description: "Updated B",
			});
			await controller.log({
				action: "logout",
				resource: "auth",
				actorId,
				description: "Logout",
			});

			const trail = await controller.listForActor(actorId);
			expect(trail).toHaveLength(4);
			const actions = trail.map((e) => e.action);
			expect(actions).toContain("login");
			expect(actions).toContain("create");
			expect(actions).toContain("update");
			expect(actions).toContain("logout");
		});

		it("retrieves resource-specific history within a session", async () => {
			const actorId = "admin_res";

			await controller.log({
				action: "create",
				resource: "product",
				resourceId: "prod_tracked",
				actorId,
				description: "Created",
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_tracked",
				actorId,
				description: "Updated title",
			});
			await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_tracked",
				actorId,
				description: "Updated price",
			});
			// unrelated resource
			await controller.log({
				action: "create",
				resource: "order",
				resourceId: "ord_1",
				actorId,
				description: "Created order",
			});

			const history = await controller.listForResource(
				"product",
				"prod_tracked",
			);
			expect(history).toHaveLength(3);
			for (const e of history) {
				expect(e.resource).toBe("product");
				expect(e.resourceId).toBe("prod_tracked");
			}
		});

		it("reflects the session in summary analytics", async () => {
			const actorId = "admin_summary";
			const actorEmail = "summary@shop.com";

			await controller.log({
				action: "login",
				resource: "auth",
				actorId,
				actorEmail,
				description: "Login",
			});
			await controller.log({
				action: "create",
				resource: "product",
				actorId,
				actorEmail,
				description: "Create",
			});
			await controller.log({
				action: "update",
				resource: "product",
				actorId,
				actorEmail,
				description: "Update",
			});
			await controller.log({
				action: "logout",
				resource: "auth",
				actorId,
				actorEmail,
				description: "Logout",
			});

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(4);
			expect(summary.entriesByAction.login).toBe(1);
			expect(summary.entriesByAction.create).toBe(1);
			expect(summary.entriesByAction.update).toBe(1);
			expect(summary.entriesByAction.logout).toBe(1);
			expect(summary.entriesByResource.auth).toBe(2);
			expect(summary.entriesByResource.product).toBe(2);
			expect(summary.recentActors).toHaveLength(1);
			expect(summary.recentActors[0]?.actorId).toBe(actorId);
			expect(summary.recentActors[0]?.actorEmail).toBe(actorEmail);
			expect(summary.recentActors[0]?.count).toBe(4);
		});
	});

	// ── Edge cases ──────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("getById returns null for non-existent ID", async () => {
			const result = await controller.getById("nonexistent_id_12345");
			expect(result).toBeNull();
		});

		it("logs with only required fields (action, resource, description)", async () => {
			const entry = await controller.log({
				action: "custom",
				resource: "system",
				description: "Minimal entry",
			});
			expect(entry.id).toBeDefined();
			expect(entry.action).toBe("custom");
			expect(entry.resource).toBe("system");
			expect(entry.description).toBe("Minimal entry");
			expect(entry.actorType).toBe("admin");
			expect(entry.resourceId).toBeUndefined();
			expect(entry.actorId).toBeUndefined();
			expect(entry.actorEmail).toBeUndefined();
			expect(entry.changes).toBeUndefined();
			expect(entry.metadata).toBeUndefined();
			expect(entry.ipAddress).toBeUndefined();
			expect(entry.userAgent).toBeUndefined();
		});

		it("logs with all optional fields populated", async () => {
			const entry = await controller.log({
				action: "bulk_update",
				resource: "inventory",
				resourceId: "inv_batch_1",
				actorId: "admin_full",
				actorEmail: "full@shop.com",
				actorType: "api_key",
				description: "Bulk inventory update via API",
				changes: {
					quantities: { from: [10, 20, 30], to: [15, 25, 35] },
				},
				metadata: {
					batchId: "batch_001",
					itemCount: 3,
					source: "external_sync",
				},
				ipAddress: "203.0.113.42",
				userAgent: "InventorySync/2.1",
			});
			expect(entry.actorType).toBe("api_key");
			expect(entry.resourceId).toBe("inv_batch_1");
			expect(entry.changes?.quantities).toEqual({
				from: [10, 20, 30],
				to: [15, 25, 35],
			});
			expect(entry.metadata?.batchId).toBe("batch_001");
			expect(entry.metadata?.itemCount).toBe(3);
			expect(entry.ipAddress).toBe("203.0.113.42");
			expect(entry.userAgent).toBe("InventorySync/2.1");
		});

		it("preserves field-level change diffs", async () => {
			const entry = await controller.log({
				action: "update",
				resource: "product",
				resourceId: "prod_diff",
				description: "Multi-field update",
				changes: {
					title: { from: "Old Title", to: "New Title" },
					price: { from: 19.99, to: 24.99 },
					tags: { from: ["sale"], to: ["sale", "featured"] },
					active: { from: true, to: false },
				},
			});
			expect(entry.changes?.title).toEqual({
				from: "Old Title",
				to: "New Title",
			});
			expect(entry.changes?.price).toEqual({ from: 19.99, to: 24.99 });
			expect(entry.changes?.tags).toEqual({
				from: ["sale"],
				to: ["sale", "featured"],
			});
			expect(entry.changes?.active).toEqual({ from: true, to: false });
		});

		it("preserves deeply nested metadata", async () => {
			const deepMeta = {
				request: {
					headers: {
						authorization: "Bearer ***",
						contentType: "application/json",
					},
					body: {
						filters: {
							categories: ["electronics", "gadgets"],
							priceRange: { min: 10, max: 100 },
						},
					},
				},
				response: {
					status: 200,
					timing: { db: 45, total: 120 },
				},
			};
			const entry = await controller.log({
				action: "export",
				resource: "catalog",
				description: "Full catalog export",
				metadata: deepMeta,
			});
			expect(entry.metadata).toEqual(deepMeta);
			const fetched = await controller.getById(entry.id);
			expect(fetched?.metadata).toEqual(deepMeta);
		});
	});

	// ── Entries without actorId excluded from recentActors ───────────────

	describe("summary actor exclusion", () => {
		it("excludes entries without actorId from recentActors", async () => {
			await controller.log({
				action: "create",
				resource: "product",
				description: "No actor ID",
			});
			await controller.log({
				action: "update",
				resource: "product",
				actorId: "admin_1",
				description: "Has actor ID",
			});

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(2);
			expect(summary.recentActors).toHaveLength(1);
			expect(summary.recentActors[0]?.actorId).toBe("admin_1");
		});
	});
});
