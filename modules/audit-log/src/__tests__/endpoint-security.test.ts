import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry, CreateAuditEntryParams } from "../service";
import { createAuditLogController } from "../service-impl";

/**
 * Security regression tests for audit-log endpoints.
 *
 * Audit logs are the backbone of compliance and forensic review.
 * These tests verify:
 * - Actor isolation: one actor's log trail cannot leak into another's view
 * - Immutability: logged entries cannot be silently modified or replaced
 * - Date range filtering integrity: ranges cannot be abused to widen scope
 * - Action type scoping: filtering by action never leaks unrelated entries
 * - Resource-level filtering: resource + resourceId pair is exact-match
 * - Purge safety: purge only removes what it should, never future entries
 * - Summary integrity: aggregated counts reflect reality, not stale data
 */

function makeEntry(
	overrides: Partial<CreateAuditEntryParams> = {},
): CreateAuditEntryParams {
	return {
		action: "create",
		resource: "product",
		description: "Default test entry",
		...overrides,
	};
}

describe("audit-log endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuditLogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuditLogController(mockData);
	});

	// ── Actor Isolation ────────────────────────────────────────────────

	describe("actor isolation", () => {
		it("listForActor never returns entries from other actors", async () => {
			await controller.log(
				makeEntry({
					actorId: "admin_victim",
					description: "Victim action",
				}),
			);
			await controller.log(
				makeEntry({
					actorId: "admin_victim",
					description: "Another victim action",
				}),
			);
			await controller.log(
				makeEntry({
					actorId: "admin_attacker",
					description: "Attacker action",
				}),
			);

			const attackerEntries = await controller.listForActor("admin_attacker");
			expect(attackerEntries).toHaveLength(1);
			for (const entry of attackerEntries) {
				expect(entry.actorId).toBe("admin_attacker");
			}
		});

		it("list filtered by actorId excludes other actors", async () => {
			await controller.log(
				makeEntry({ actorId: "actor_a", resource: "order" }),
			);
			await controller.log(
				makeEntry({ actorId: "actor_b", resource: "order" }),
			);
			await controller.log(
				makeEntry({ actorId: "actor_a", resource: "product" }),
			);

			const result = await controller.list({ actorId: "actor_b" });
			expect(result.total).toBe(1);
			expect(result.entries[0]?.actorId).toBe("actor_b");
		});

		it("entries without actorId are not returned by listForActor", async () => {
			await controller.log(
				makeEntry({ actorType: "system", description: "System event" }),
			);
			await controller.log(
				makeEntry({
					actorId: "admin_1",
					description: "Admin event",
				}),
			);

			const systemEntries = await controller.listForActor("system");
			expect(systemEntries).toHaveLength(0);

			const adminEntries = await controller.listForActor("admin_1");
			expect(adminEntries).toHaveLength(1);
		});

		it("actor filter combined with actorType is conjunctive", async () => {
			await controller.log(
				makeEntry({
					actorId: "key_1",
					actorType: "api_key",
					description: "API key action",
				}),
			);
			await controller.log(
				makeEntry({
					actorId: "key_1",
					actorType: "admin",
					description: "Admin impersonation",
				}),
			);

			const result = await controller.list({
				actorId: "key_1",
				actorType: "api_key",
			});
			expect(result.total).toBe(1);
			expect(result.entries[0]?.actorType).toBe("api_key");
		});
	});

	// ── Immutability ───────────────────────────────────────────────────

	describe("immutability — entries cannot be silently altered", () => {
		it("logged entry retains original data when re-fetched", async () => {
			const original = await controller.log(
				makeEntry({
					action: "settings_change",
					resource: "store",
					resourceId: "store_1",
					actorId: "admin_root",
					actorEmail: "root@store.com",
					description: "Changed payment settings",
					changes: { currency: { from: "USD", to: "EUR" } },
					ipAddress: "10.0.0.1",
					userAgent: "Admin/1.0",
				}),
			);

			const fetched = await controller.getById(original.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.action).toBe("settings_change");
			expect(fetched?.resource).toBe("store");
			expect(fetched?.resourceId).toBe("store_1");
			expect(fetched?.actorId).toBe("admin_root");
			expect(fetched?.actorEmail).toBe("root@store.com");
			expect(fetched?.description).toBe("Changed payment settings");
			expect(fetched?.ipAddress).toBe("10.0.0.1");
			expect(fetched?.userAgent).toBe("Admin/1.0");
		});

		it("each log call creates a distinct entry even with identical params", async () => {
			const params = makeEntry({
				action: "login",
				resource: "auth",
				actorId: "admin_1",
				description: "Logged in",
			});

			const e1 = await controller.log(params);
			const e2 = await controller.log(params);

			expect(e1.id).not.toBe(e2.id);

			const result = await controller.list({ action: "login" });
			expect(result.total).toBe(2);
		});

		it("getById returns null for fabricated IDs", async () => {
			await controller.log(makeEntry());

			const result = await controller.getById("fabricated_id_12345");
			expect(result).toBeNull();
		});
	});

	// ── Date Range Filtering Integrity ─────────────────────────────────

	describe("date range filtering integrity", () => {
		let oldEntry: AuditEntry;
		let midEntry: AuditEntry;
		let recentEntry: AuditEntry;

		beforeEach(async () => {
			oldEntry = await controller.log(makeEntry({ description: "Old entry" }));
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: new Date("2024-01-15"),
			} as Record<string, unknown>);

			midEntry = await controller.log(makeEntry({ description: "Mid entry" }));
			await mockData.upsert("auditEntry", midEntry.id, {
				...midEntry,
				createdAt: new Date("2024-06-15"),
			} as Record<string, unknown>);

			recentEntry = await controller.log(
				makeEntry({ description: "Recent entry" }),
			);
			await mockData.upsert("auditEntry", recentEntry.id, {
				...recentEntry,
				createdAt: new Date("2025-01-15"),
			} as Record<string, unknown>);
		});

		it("dateFrom excludes entries before the boundary", async () => {
			const result = await controller.list({
				dateFrom: new Date("2024-06-01"),
			});
			expect(result.total).toBe(2);
			const descriptions = result.entries.map((e) => e.description);
			expect(descriptions).not.toContain("Old entry");
			expect(descriptions).toContain("Mid entry");
			expect(descriptions).toContain("Recent entry");
		});

		it("dateTo excludes entries after the boundary", async () => {
			const result = await controller.list({
				dateTo: new Date("2024-12-31"),
			});
			expect(result.total).toBe(2);
			const descriptions = result.entries.map((e) => e.description);
			expect(descriptions).toContain("Old entry");
			expect(descriptions).toContain("Mid entry");
			expect(descriptions).not.toContain("Recent entry");
		});

		it("tight range returns only entries within bounds", async () => {
			const result = await controller.list({
				dateFrom: new Date("2024-06-01"),
				dateTo: new Date("2024-07-01"),
			});
			expect(result.total).toBe(1);
			expect(result.entries[0]?.description).toBe("Mid entry");
		});

		it("impossible range returns zero entries", async () => {
			const result = await controller.list({
				dateFrom: new Date("2030-01-01"),
				dateTo: new Date("2030-01-02"),
			});
			expect(result.total).toBe(0);
			expect(result.entries).toHaveLength(0);
		});
	});

	// ── Action Type Scoping ────────────────────────────────────────────

	describe("action type scoping", () => {
		it("filtering by one action never leaks other actions", async () => {
			const actions = [
				"create",
				"update",
				"delete",
				"login",
				"export",
			] as const;
			for (const action of actions) {
				await controller.log(
					makeEntry({ action, description: `Action: ${action}` }),
				);
			}

			for (const action of actions) {
				const result = await controller.list({ action });
				expect(result.total).toBe(1);
				expect(result.entries[0]?.action).toBe(action);
			}
		});

		it("actorType filter scopes strictly to that type", async () => {
			await controller.log(
				makeEntry({ actorType: "admin", description: "Admin" }),
			);
			await controller.log(
				makeEntry({ actorType: "system", description: "System" }),
			);
			await controller.log(
				makeEntry({ actorType: "api_key", description: "API Key" }),
			);

			const systemOnly = await controller.list({
				actorType: "system",
			});
			expect(systemOnly.total).toBe(1);
			expect(systemOnly.entries[0]?.actorType).toBe("system");
			expect(systemOnly.entries[0]?.description).toBe("System");
		});

		it("combined action + resource filter is conjunctive", async () => {
			await controller.log(
				makeEntry({
					action: "delete",
					resource: "product",
					description: "Delete product",
				}),
			);
			await controller.log(
				makeEntry({
					action: "delete",
					resource: "order",
					description: "Delete order",
				}),
			);
			await controller.log(
				makeEntry({
					action: "update",
					resource: "product",
					description: "Update product",
				}),
			);

			const result = await controller.list({
				action: "delete",
				resource: "product",
			});
			expect(result.total).toBe(1);
			expect(result.entries[0]?.description).toBe("Delete product");
		});
	});

	// ── Resource-Level Filtering Integrity ─────────────────────────────

	describe("resource-level filtering integrity", () => {
		it("listForResource matches exact resource + resourceId pair", async () => {
			await controller.log(
				makeEntry({
					resource: "product",
					resourceId: "prod_1",
					description: "Exact match",
				}),
			);
			await controller.log(
				makeEntry({
					resource: "product",
					resourceId: "prod_2",
					description: "Different ID",
				}),
			);
			await controller.log(
				makeEntry({
					resource: "order",
					resourceId: "prod_1",
					description: "Different resource same ID",
				}),
			);

			const entries = await controller.listForResource("product", "prod_1");
			expect(entries).toHaveLength(1);
			expect(entries[0]?.description).toBe("Exact match");
		});

		it("listForResource returns empty for non-existent resource", async () => {
			await controller.log(
				makeEntry({ resource: "product", resourceId: "prod_1" }),
			);

			const entries = await controller.listForResource(
				"product",
				"nonexistent",
			);
			expect(entries).toHaveLength(0);
		});

		it("listForResource respects take limit", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.log(
					makeEntry({
						resource: "product",
						resourceId: "prod_flood",
						description: `Entry ${i}`,
					}),
				);
			}

			const entries = await controller.listForResource(
				"product",
				"prod_flood",
				{ take: 3 },
			);
			expect(entries).toHaveLength(3);
			for (const e of entries) {
				expect(e.resourceId).toBe("prod_flood");
			}
		});
	});

	// ── Purge Safety ───────────────────────────────────────────────────

	describe("purge safety", () => {
		it("purge does not delete entries newer than cutoff", async () => {
			const oldEntry = await controller.log(makeEntry({ description: "Old" }));
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: oldDate,
			} as Record<string, unknown>);

			const newEntry = await controller.log(makeEntry({ description: "New" }));

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purge(cutoff);
			expect(deleted).toBe(1);

			const surviving = await controller.getById(newEntry.id);
			expect(surviving).not.toBeNull();
			expect(surviving?.description).toBe("New");

			const purged = await controller.getById(oldEntry.id);
			expect(purged).toBeNull();
		});

		it("purge with past cutoff deletes nothing when all entries are recent", async () => {
			await controller.log(makeEntry({ description: "Fresh 1" }));
			await controller.log(makeEntry({ description: "Fresh 2" }));

			const pastCutoff = new Date();
			pastCutoff.setDate(pastCutoff.getDate() - 30);
			const deleted = await controller.purge(pastCutoff);
			expect(deleted).toBe(0);

			const result = await controller.list();
			expect(result.total).toBe(2);
		});

		it("purge preserves entries from other actors", async () => {
			const oldEntry = await controller.log(
				makeEntry({
					actorId: "admin_old",
					description: "Old admin",
				}),
			);
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 90);
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: oldDate,
			} as Record<string, unknown>);

			await controller.log(
				makeEntry({
					actorId: "admin_new",
					description: "New admin",
				}),
			);

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			await controller.purge(cutoff);

			const newActorEntries = await controller.listForActor("admin_new");
			expect(newActorEntries).toHaveLength(1);

			const oldActorEntries = await controller.listForActor("admin_old");
			expect(oldActorEntries).toHaveLength(0);
		});
	});

	// ── Summary Integrity ──────────────────────────────────────────────

	describe("summary integrity", () => {
		it("summary counts match actual entry counts per action", async () => {
			await controller.log(makeEntry({ action: "create" }));
			await controller.log(makeEntry({ action: "create" }));
			await controller.log(makeEntry({ action: "update" }));
			await controller.log(makeEntry({ action: "delete" }));
			await controller.log(makeEntry({ action: "delete" }));
			await controller.log(makeEntry({ action: "delete" }));

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(6);
			expect(summary.entriesByAction.create).toBe(2);
			expect(summary.entriesByAction.update).toBe(1);
			expect(summary.entriesByAction.delete).toBe(3);
		});

		it("summary reflects state after purge", async () => {
			const oldEntry = await controller.log(
				makeEntry({ action: "login", actorId: "admin_old" }),
			);
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: oldDate,
			} as Record<string, unknown>);

			await controller.log(
				makeEntry({ action: "export", actorId: "admin_new" }),
			);

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			await controller.purge(cutoff);

			const summary = await controller.getSummary();
			expect(summary.totalEntries).toBe(1);
			expect(summary.entriesByAction.login).toBeUndefined();
			expect(summary.entriesByAction.export).toBe(1);
			expect(summary.recentActors).toHaveLength(1);
			expect(summary.recentActors[0]?.actorId).toBe("admin_new");
		});

		it("summary date range does not leak out-of-range data", async () => {
			const oldEntry = await controller.log(
				makeEntry({
					action: "create",
					actorId: "admin_1",
					resource: "product",
				}),
			);
			await mockData.upsert("auditEntry", oldEntry.id, {
				...oldEntry,
				createdAt: new Date("2024-01-01"),
			} as Record<string, unknown>);

			await controller.log(
				makeEntry({
					action: "update",
					actorId: "admin_2",
					resource: "order",
				}),
			);

			const summary = await controller.getSummary({
				dateFrom: new Date("2025-01-01"),
			});
			expect(summary.totalEntries).toBe(1);
			expect(summary.entriesByResource.product).toBeUndefined();
			expect(summary.entriesByResource.order).toBe(1);
			expect(summary.recentActors).toHaveLength(1);
			expect(summary.recentActors[0]?.actorId).toBe("admin_2");
		});

		it("summary with no matching date range returns zeroes", async () => {
			await controller.log(makeEntry({ actorId: "admin_1" }));

			const summary = await controller.getSummary({
				dateFrom: new Date("2099-01-01"),
				dateTo: new Date("2099-12-31"),
			});
			expect(summary.totalEntries).toBe(0);
			expect(summary.entriesByAction).toEqual({});
			expect(summary.entriesByResource).toEqual({});
			expect(summary.recentActors).toHaveLength(0);
		});
	});

	// ── Pagination Safety ──────────────────────────────────────────────

	describe("pagination safety", () => {
		it("list with skip beyond total returns empty", async () => {
			await controller.log(makeEntry());
			await controller.log(makeEntry());

			const result = await controller.list({ skip: 100 });
			expect(result.entries).toHaveLength(0);
		});

		it("listForActor with take=0 returns empty", async () => {
			await controller.log(makeEntry({ actorId: "admin_1", description: "A" }));
			await controller.log(makeEntry({ actorId: "admin_1", description: "B" }));

			const entries = await controller.listForActor("admin_1", {
				take: 0,
			});
			expect(entries).toHaveLength(0);
		});

		it("listForResource with skip beyond count returns empty", async () => {
			await controller.log(
				makeEntry({ resource: "product", resourceId: "prod_1" }),
			);

			const entries = await controller.listForResource("product", "prod_1", {
				skip: 100,
			});
			expect(entries).toHaveLength(0);
		});

		it("list with take and skip pages correctly", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.log(makeEntry({ description: `Entry ${i}` }));
			}

			const page1 = await controller.list({ take: 3, skip: 0 });
			const page2 = await controller.list({ take: 3, skip: 3 });
			expect(page1.entries).toHaveLength(3);
			expect(page2.entries).toHaveLength(3);
			// Pages should not overlap
			const ids1 = page1.entries.map((e) => e.id);
			const ids2 = page2.entries.map((e) => e.id);
			expect(ids1.some((id) => ids2.includes(id))).toBe(false);
		});
	});

	// ── IP Address and User Agent Tracking ─────────────────────────────

	describe("IP and user agent tracking", () => {
		it("preserves IP address across entries", async () => {
			const e1 = await controller.log(makeEntry({ ipAddress: "192.168.1.1" }));
			const e2 = await controller.log(makeEntry({ ipAddress: "10.0.0.1" }));
			const e3 = await controller.log(makeEntry());

			expect((await controller.getById(e1.id))?.ipAddress).toBe("192.168.1.1");
			expect((await controller.getById(e2.id))?.ipAddress).toBe("10.0.0.1");
			expect((await controller.getById(e3.id))?.ipAddress).toBeUndefined();
		});

		it("preserves user agent across entries", async () => {
			const entry = await controller.log(
				makeEntry({ userAgent: "CustomBot/2.0" }),
			);
			const fetched = await controller.getById(entry.id);
			expect(fetched?.userAgent).toBe("CustomBot/2.0");
		});
	});

	// ── Changes Tracking Integrity ────────────────────────────────────

	describe("changes tracking integrity", () => {
		it("changes for same resource are not merged across entries", async () => {
			const e1 = await controller.log(
				makeEntry({
					resource: "product",
					resourceId: "prod_1",
					changes: { name: { from: "A", to: "B" } },
					description: "Name change",
				}),
			);
			const e2 = await controller.log(
				makeEntry({
					resource: "product",
					resourceId: "prod_1",
					changes: { price: { from: 100, to: 200 } },
					description: "Price change",
				}),
			);

			const fetched1 = await controller.getById(e1.id);
			const fetched2 = await controller.getById(e2.id);
			expect(fetched1?.changes).toEqual({
				name: { from: "A", to: "B" },
			});
			expect(fetched2?.changes).toEqual({
				price: { from: 100, to: 200 },
			});
		});

		it("entries without changes have undefined changes field", async () => {
			const entry = await controller.log(makeEntry());
			expect(entry.changes).toBeUndefined();
		});
	});

	// ── Purge Boundary Precision ──────────────────────────────────────

	describe("purge boundary precision", () => {
		it("purge with future cutoff deletes all entries", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.log(makeEntry({ description: `E${i}` }));
			}

			const future = new Date();
			future.setDate(future.getDate() + 1);
			const deleted = await controller.purge(future);
			expect(deleted).toBe(5);

			const result = await controller.list();
			expect(result.total).toBe(0);
		});

		it("purge on empty log is safe", async () => {
			const deleted = await controller.purge(new Date());
			expect(deleted).toBe(0);
		});

		it("repeated purge with same cutoff is idempotent", async () => {
			const entry = await controller.log(makeEntry());
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			await mockData.upsert("auditEntry", entry.id, {
				...entry,
				createdAt: oldDate,
			} as Record<string, unknown>);

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);

			const first = await controller.purge(cutoff);
			expect(first).toBe(1);

			const second = await controller.purge(cutoff);
			expect(second).toBe(0);
		});
	});

	// ── Actor Email in Summary ─────────────────────────────────────────

	describe("summary actor email tracking", () => {
		it("preserves actor email in recentActors", async () => {
			await controller.log(
				makeEntry({
					actorId: "admin_1",
					actorEmail: "admin1@store.com",
				}),
			);
			await controller.log(
				makeEntry({
					actorId: "admin_2",
					actorEmail: "admin2@store.com",
				}),
			);

			const summary = await controller.getSummary();
			const admin1 = summary.recentActors.find((a) => a.actorId === "admin_1");
			const admin2 = summary.recentActors.find((a) => a.actorId === "admin_2");
			expect(admin1?.actorEmail).toBe("admin1@store.com");
			expect(admin2?.actorEmail).toBe("admin2@store.com");
		});

		it("entries by resource counts multiple resources correctly", async () => {
			await controller.log(
				makeEntry({ resource: "product", action: "create" }),
			);
			await controller.log(
				makeEntry({ resource: "product", action: "update" }),
			);
			await controller.log(makeEntry({ resource: "order", action: "create" }));
			await controller.log(
				makeEntry({ resource: "customer", action: "delete" }),
			);

			const summary = await controller.getSummary();
			expect(summary.entriesByResource.product).toBe(2);
			expect(summary.entriesByResource.order).toBe(1);
			expect(summary.entriesByResource.customer).toBe(1);
		});
	});

	// ── All Action Types Filterable ────────────────────────────────────

	describe("all action types are filterable", () => {
		const allActions = [
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

		it("each action type can be logged and filtered", async () => {
			for (const action of allActions) {
				await controller.log(
					makeEntry({
						action,
						description: `Test ${action}`,
					}),
				);
			}

			for (const action of allActions) {
				const result = await controller.list({ action });
				expect(result.total).toBeGreaterThanOrEqual(1);
				expect(result.entries[0]?.action).toBe(action);
			}
		});
	});
});
