import { inventoryStockAdjustedV1 } from "@86d-app/core/durable-events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	INVENTORY_STOCK_ADJUSTED_CONSUMER,
	inventoryStockAdjustedAudit,
} from "../durable-consumers";

function envelope(overrides?: { id?: string; sequence?: number }) {
	return {
		id: overrides?.id ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		name: "inventory.stock-adjusted" as const,
		version: 1 as const,
		storeId: "store-1",
		sourceModule: "inventory" as const,
		aggregate: {
			type: "inventory-item",
			id: "p1:_:_",
			sequence: overrides?.sequence ?? 1,
		},
		occurredAt: new Date("2026-08-12T12:00:00.000Z"),
		payload: {
			productId: "p1",
			delta: -4,
			quantity: 6,
			reserved: 0,
			available: 6,
		},
	};
}

describe("Audit Log durable consumers", () => {
	it("declares a stable identity bound to the shipped event contract", () => {
		expect(inventoryStockAdjustedAudit.consumer).toBe(
			INVENTORY_STOCK_ADJUSTED_CONSUMER,
		);
		expect(inventoryStockAdjustedAudit.owner).toBe("audit-log");
		expect(inventoryStockAdjustedAudit.definition).toBe(
			inventoryStockAdjustedV1,
		);
	});

	it("records one audit entry keyed by the durable event ID", async () => {
		const data = createMockDataService();
		const event = envelope();

		await inventoryStockAdjustedAudit.handle({ data }, event);

		const stored = await data.get("auditEntry", event.id);
		expect(stored).toMatchObject({
			id: event.id,
			action: "update",
			resource: "inventory",
			resourceId: "p1:_:_",
			actorType: "system",
		});
		expect(stored?.description).toContain("-4");
		expect(stored?.changes).toMatchObject({ delta: -4, quantity: 6 });
		expect(stored?.metadata).toMatchObject({
			sourceModule: "inventory",
			eventName: "inventory.stock-adjusted",
			eventVersion: 1,
			aggregateSequence: 1,
		});
	});

	it("is idempotent, so a repeated delivery cannot double-count", async () => {
		const data = createMockDataService();
		const event = envelope();

		await inventoryStockAdjustedAudit.handle({ data }, event);
		await inventoryStockAdjustedAudit.handle({ data }, event);

		const entries = await data.findMany("auditEntry", {});
		expect(entries).toHaveLength(1);
	});

	it("keeps separate entries for separate adjustments", async () => {
		const data = createMockDataService();

		await inventoryStockAdjustedAudit.handle({ data }, envelope());
		await inventoryStockAdjustedAudit.handle(
			{ data },
			envelope({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sequence: 2 }),
		);

		const entries = await data.findMany("auditEntry", {});
		expect(entries).toHaveLength(2);
	});

	it("uses a positive sign for an increase", async () => {
		const data = createMockDataService();
		const event = envelope();

		await inventoryStockAdjustedAudit.handle(
			{ data },
			{ ...event, payload: { ...event.payload, delta: 7, quantity: 17 } },
		);

		const stored = await data.get("auditEntry", event.id);
		expect(stored?.description).toContain("+7");
	});
});
