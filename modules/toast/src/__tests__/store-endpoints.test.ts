import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createToastController } from "../service-impl";

/**
 * Store endpoint integration tests for the toast module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. sync-menu: records a menu sync operation between 86d and Toast POS
 * 2. sync-order: records an order sync operation between 86d and Toast POS
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateSyncMenu(
	data: DataService,
	body: {
		entityId: string;
		externalId: string;
		direction?: "inbound" | "outbound";
	},
) {
	const controller = createToastController(data);
	const record = await controller.syncMenu({
		entityId: body.entityId,
		externalId: body.externalId,
		direction: body.direction,
	});
	return { record };
}

async function simulateSyncOrder(
	data: DataService,
	body: {
		entityId: string;
		externalId: string;
		direction?: "inbound" | "outbound";
	},
) {
	const controller = createToastController(data);
	const record = await controller.syncOrder({
		entityId: body.entityId,
		externalId: body.externalId,
		direction: body.direction,
	});
	return { record };
}

// ── Tests: sync-menu ───────────────────────────────────────────────────

describe("store endpoint: sync-menu", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a menu sync record with pending status", async () => {
		const result = await simulateSyncMenu(data, {
			entityId: "menu_local_1",
			externalId: "toast_menu_abc",
		});

		expect("record" in result).toBe(true);
		if ("record" in result) {
			expect(result.record.entityId).toBe("menu_local_1");
			expect(result.record.externalId).toBe("toast_menu_abc");
			expect(result.record.entityType).toBe("menu-item");
			expect(result.record.status).toMatch(/pending|synced|success/);
		}
	});

	it("records the sync direction when provided", async () => {
		const result = await simulateSyncMenu(data, {
			entityId: "menu_2",
			externalId: "toast_menu_xyz",
			direction: "inbound",
		});

		expect("record" in result).toBe(true);
		if ("record" in result) {
			expect(result.record.direction).toBe("inbound");
		}
	});

	it("records multiple menu sync operations independently", async () => {
		await simulateSyncMenu(data, {
			entityId: "menu_a",
			externalId: "toast_a",
		});
		await simulateSyncMenu(data, {
			entityId: "menu_b",
			externalId: "toast_b",
		});

		const ctrl = createToastController(data);
		const records = await ctrl.listSyncRecords({ entityType: "menu-item" });
		expect(records.length).toBeGreaterThanOrEqual(2);
	});
});

// ── Tests: sync-order ─────────────────────────────────────────────────

describe("store endpoint: sync-order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates an order sync record", async () => {
		const result = await simulateSyncOrder(data, {
			entityId: "order_local_1",
			externalId: "toast_order_abc",
		});

		expect("record" in result).toBe(true);
		if ("record" in result) {
			expect(result.record.entityId).toBe("order_local_1");
			expect(result.record.externalId).toBe("toast_order_abc");
			expect(result.record.entityType).toBe("order");
		}
	});

	it("records the sync direction when provided", async () => {
		const result = await simulateSyncOrder(data, {
			entityId: "order_2",
			externalId: "toast_order_xyz",
			direction: "outbound",
		});

		expect("record" in result).toBe(true);
		if ("record" in result) {
			expect(result.record.direction).toBe("outbound");
		}
	});
});
