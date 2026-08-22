import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateAuditEntryParams } from "../service";
import { createAuditLogController } from "../service-impl";

/**
 * Store endpoint integration tests for the audit-log module.
 *
 * These tests verify the business logic in endpoints:
 *
 * 1. log: creates an audit entry (admin)
 * 2. list: retrieves paginated audit entries (admin)
 * 3. list-for-resource: retrieves entries for a specific resource (admin)
 * 4. my-activity: returns the authenticated user's own activity; 401 without auth
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateLog(data: DataService, body: CreateAuditEntryParams) {
	const controller = createAuditLogController(data);
	const entry = await controller.log(body);
	return { entry };
}

async function simulateList(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createAuditLogController(data);
	const result = await controller.list(query);
	return result;
}

async function simulateListForResource(
	data: DataService,
	resource: string,
	resourceId: string,
) {
	const controller = createAuditLogController(data);
	const entries = await controller.listForResource(resource, resourceId);
	return { entries };
}

async function simulateMyActivity(
	data: DataService,
	query: { take?: number; skip?: number } = {},
	opts: { userId?: string } = {},
) {
	if (!opts.userId) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createAuditLogController(data);
	const entries = await controller.listForActor(opts.userId, query);
	return { entries, total: entries.length };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: log audit entry", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates an audit entry", async () => {
		const result = await simulateLog(data, {
			action: "create",
			resource: "product",
			resourceId: "prod_1",
			actorId: "admin_1",
			description: "Created product prod_1",
		});

		expect("entry" in result).toBe(true);
		if (!("entry" in result)) {
			throw new Error("expected 'entry' in result");
		}
		expect(result.entry.action).toBe("create");
		expect(result.entry.resource).toBe("product");
	});
});

describe("store endpoint: list audit entries", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns paginated audit entries", async () => {
		const ctrl = createAuditLogController(data);
		await ctrl.log({
			action: "create",
			resource: "product",
			resourceId: "prod_1",
			actorId: "admin_1",
			description: "Created product prod_1",
		});
		await ctrl.log({
			action: "update",
			resource: "product",
			resourceId: "prod_1",
			actorId: "admin_1",
			description: "Updated product prod_1",
		});

		const result = await simulateList(data);

		expect(result.entries).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("returns empty when no entries", async () => {
		const result = await simulateList(data);

		expect(result.entries).toHaveLength(0);
	});
});

describe("store endpoint: list for resource", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns entries for a specific resource", async () => {
		const ctrl = createAuditLogController(data);
		await ctrl.log({
			action: "create",
			resource: "product",
			resourceId: "prod_1",
			actorId: "admin_1",
			description: "Created product prod_1",
		});
		await ctrl.log({
			action: "create",
			resource: "order",
			resourceId: "order_1",
			actorId: "admin_1",
			description: "Created order order_1",
		});

		const result = await simulateListForResource(data, "product", "prod_1");

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].resource).toBe("product");
	});
});

describe("store endpoint: my-activity", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyActivity(data);

		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns only entries for the authenticated user", async () => {
		const ctrl = createAuditLogController(data);
		await ctrl.log({
			action: "login",
			resource: "product",
			resourceId: "prod_1",
			actorId: "user_1",
			description: "Viewed product",
		});
		await ctrl.log({
			action: "login",
			resource: "product",
			resourceId: "prod_2",
			actorId: "user_2",
			description: "Viewed product by another user",
		});

		const result = await simulateMyActivity(data, {}, { userId: "user_1" });

		expect("entries" in result).toBe(true);
		if (!("entries" in result)) {
			throw new Error("expected 'entries' in result");
		}
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].actorId).toBe("user_1");
	});

	it("returns empty when user has no activity", async () => {
		const result = await simulateMyActivity(
			data,
			{},
			{ userId: "user_no_activity" },
		);

		expect("entries" in result).toBe(true);
		if (!("entries" in result)) {
			throw new Error("expected 'entries' in result");
		}
		expect(result.entries).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("respects take and skip for pagination", async () => {
		const ctrl = createAuditLogController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.log({
				action: "login",
				resource: "product",
				resourceId: `prod_${i}`,
				actorId: "user_paginate",
				description: `Entry ${i}`,
			});
		}

		const page1 = await simulateMyActivity(
			data,
			{ take: 2, skip: 0 },
			{ userId: "user_paginate" },
		);
		const page2 = await simulateMyActivity(
			data,
			{ take: 2, skip: 2 },
			{ userId: "user_paginate" },
		);

		expect("entries" in page1 && "entries" in page2).toBe(true);
		if (!("entries" in page1 && "entries" in page2)) {
			throw new Error("expected 'entries' in page1 && 'entries' in page2");
		}
		expect(page1.entries).toHaveLength(2);
		expect(page2.entries).toHaveLength(2);
		const ids1 = page1.entries.map((e) => e.id);
		const ids2 = page2.entries.map((e) => e.id);
		expect(ids1.some((id) => ids2.includes(id))).toBe(false);
	});
});
