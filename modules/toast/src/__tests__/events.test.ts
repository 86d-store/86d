import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createToastController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

describe("toast.menu.synced event", () => {
	it("emits when menu is synced", async () => {
		const events = createMockEvents();
		const ctrl = createToastController(createMockDataService(), events);

		const record = await ctrl.syncMenu({
			entityId: "product-1",
			externalId: "toast-1",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("toast.menu.synced");
		expect(events.emitted[0].payload).toEqual({
			syncRecordId: record.id,
			entityType: "menu-item",
			entityId: "product-1",
			externalId: "toast-1",
		});
	});
});

describe("toast.order.synced event", () => {
	it("emits when order is synced", async () => {
		const events = createMockEvents();
		const ctrl = createToastController(createMockDataService(), events);

		await ctrl.syncOrder({
			entityId: "order-1",
			externalId: "toast-order-1",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("toast.order.synced");
	});
});

describe("toast.inventory.updated event", () => {
	it("emits when inventory is synced", async () => {
		const events = createMockEvents();
		const ctrl = createToastController(createMockDataService(), events);

		await ctrl.syncInventory({
			entityId: "inv-1",
			externalId: "toast-inv-1",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("toast.inventory.updated");
	});
});

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createToastController(createMockDataService());

		await ctrl.syncMenu({ entityId: "p-1", externalId: "t-1" });
		await ctrl.syncOrder({ entityId: "o-1", externalId: "to-1" });
		await expect(
			ctrl.syncInventory({ entityId: "i-1", externalId: "ti-1" }),
		).resolves.toBeUndefined();
	});
});

describe("full sync lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createToastController(createMockDataService(), events);

		await ctrl.syncMenu({ entityId: "p-1", externalId: "t-1" });
		await ctrl.syncOrder({ entityId: "o-1", externalId: "to-1" });
		await ctrl.syncInventory({ entityId: "i-1", externalId: "ti-1" });

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"toast.menu.synced",
			"toast.order.synced",
			"toast.inventory.updated",
		]);
	});
});
