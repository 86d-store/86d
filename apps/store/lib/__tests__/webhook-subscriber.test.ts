import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies before import
vi.mock("lib/webhook-delivery", () => ({
	WEBHOOK_EVENT_TYPES: [
		"order.placed",
		"order.shipped",
		"order.delivered",
		"order.cancelled",
		"order.completed",
		"order.refunded",
		"payment.failed",
		"subscription.created",
		"subscription.cancelled",
		"subscription.updated",
		"customer.created",
		"inventory.low",
		"review.created",
	],
	buildWebhookPayload: vi.fn((type: string, source: string, data: unknown) => ({
		id: "wh_test_id",
		type,
		source,
		timestamp: "2026-03-18T00:00:00.000Z",
		data,
	})),
	deliverWebhook: vi.fn(async () => ({
		success: true,
		statusCode: 200,
		response: "OK",
		attempts: 1,
		duration: 50,
	})),
}));

vi.mock("utils/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { deliverWebhook } from "lib/webhook-delivery";
import { registerWebhookHandlers } from "../webhook-subscriber";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockBus() {
	const handlers = new Map<string, Array<(event: unknown) => Promise<void>>>();
	return {
		on: vi.fn((type: string, handler: (event: unknown) => Promise<void>) => {
			const list = handlers.get(type) ?? [];
			list.push(handler);
			handlers.set(type, list);
			return () => {
				const idx = list.indexOf(handler);
				if (idx >= 0) list.splice(idx, 1);
			};
		}),
		emit: vi.fn(),
		off: vi.fn(),
		removeAllListeners: vi.fn(),
		listenerCount: vi.fn(() => 0),
		async fire(type: string, source: string, payload: Record<string, unknown>) {
			const list = handlers.get(type) ?? [];
			for (const handler of list) {
				await handler({ type, source, payload, timestamp: Date.now() });
			}
		},
	};
}

function createMockDb(
	webhooks: Array<{ id: string; url: string; secret: string }> = [],
) {
	return {
		webhook: {
			findMany: vi.fn(async () => webhooks),
		},
		webhookDelivery: {
			create: vi.fn(async () => ({ id: "del-1" })),
		},
	};
}

const STORE_ID = "store-001";

// ── Tests ────────────────────────────────────────────────────────────

describe("registerWebhookHandlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("subscribes to all webhook event types", () => {
		const bus = createMockBus();
		const db = createMockDb();

		registerWebhookHandlers(bus, db, STORE_ID);

		const subscribedEvents = bus.on.mock.calls.map(
			(call: unknown[]) => call[0],
		);
		expect(subscribedEvents).toContain("order.placed");
		expect(subscribedEvents).toContain("order.shipped");
		expect(subscribedEvents).toContain("order.delivered");
		expect(subscribedEvents).toContain("order.cancelled");
		expect(subscribedEvents).toContain("order.completed");
		expect(subscribedEvents).toContain("order.refunded");
		expect(subscribedEvents).toContain("payment.failed");
		expect(subscribedEvents).toContain("subscription.created");
		expect(subscribedEvents).toContain("subscription.cancelled");
		expect(subscribedEvents).toContain("subscription.updated");
		expect(subscribedEvents).toContain("customer.created");
		expect(subscribedEvents).toContain("inventory.low");
		expect(subscribedEvents).toContain("review.created");
		expect(bus.on).toHaveBeenCalledTimes(13);
	});

	it("returns unsubscribe function that removes all handlers", () => {
		const bus = createMockBus();
		const db = createMockDb();

		const unsubs: Array<() => void> = [];
		bus.on.mockImplementation((_type: string) => {
			const unsub = vi.fn();
			unsubs.push(unsub);
			return unsub;
		});

		const unsubAll = registerWebhookHandlers(bus, db, STORE_ID);
		unsubAll();

		for (const unsub of unsubs) {
			expect(unsub).toHaveBeenCalledOnce();
		}
	});

	it("delivers to matching webhooks when event fires", async () => {
		const bus = createMockBus();
		const db = createMockDb([
			{
				id: "wh-1",
				url: "https://example.com/webhook",
				secret: "whsec_test",
			},
		]);

		registerWebhookHandlers(bus, db, STORE_ID);
		await bus.fire("order.placed", "orders", { orderId: "ord-1" });

		// Should query webhooks matching the event
		expect(db.webhook.findMany).toHaveBeenCalledWith({
			where: {
				storeId: STORE_ID,
				isActive: true,
				events: { has: "order.placed" },
			},
			select: { id: true, url: true, secret: true },
		});

		// Should call deliverWebhook
		expect(deliverWebhook).toHaveBeenCalledOnce();
		expect(vi.mocked(deliverWebhook).mock.calls[0][0]).toBe(
			"https://example.com/webhook",
		);
		expect(vi.mocked(deliverWebhook).mock.calls[0][1]).toBe("whsec_test");
	});

	it("records delivery result in database", async () => {
		const bus = createMockBus();
		const db = createMockDb([
			{ id: "wh-1", url: "https://hook.example.com", secret: "sec" },
		]);

		registerWebhookHandlers(bus, db, STORE_ID);
		await bus.fire("order.placed", "orders", { orderId: "ord-1" });

		// Allow microtask for fire-and-forget create
		await new Promise((r) => setTimeout(r, 10));

		expect(db.webhookDelivery.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					webhookId: "wh-1",
					eventType: "order.placed",
					status: "delivered",
					statusCode: 200,
					attempts: 1,
				}),
			}),
		);
	});

	it("records failed delivery status", async () => {
		vi.mocked(deliverWebhook).mockResolvedValueOnce({
			success: false,
			statusCode: 500,
			response: "Internal Server Error",
			attempts: 1,
			duration: 100,
		});

		const bus = createMockBus();
		const db = createMockDb([
			{ id: "wh-1", url: "https://hook.example.com", secret: "sec" },
		]);

		registerWebhookHandlers(bus, db, STORE_ID);
		await bus.fire("order.placed", "orders", { orderId: "ord-1" });

		await new Promise((r) => setTimeout(r, 10));

		expect(db.webhookDelivery.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					webhookId: "wh-1",
					status: "failed",
					statusCode: 500,
				}),
			}),
		);
	});

	it("delivers to multiple webhooks concurrently", async () => {
		const bus = createMockBus();
		const db = createMockDb([
			{ id: "wh-1", url: "https://hook1.example.com", secret: "sec1" },
			{ id: "wh-2", url: "https://hook2.example.com", secret: "sec2" },
			{ id: "wh-3", url: "https://hook3.example.com", secret: "sec3" },
		]);

		registerWebhookHandlers(bus, db, STORE_ID);
		await bus.fire("order.placed", "orders", { orderId: "ord-1" });

		expect(deliverWebhook).toHaveBeenCalledTimes(3);
	});

	it("does nothing when no webhooks match", async () => {
		const bus = createMockBus();
		const db = createMockDb([]);

		registerWebhookHandlers(bus, db, STORE_ID);
		await bus.fire("order.placed", "orders", { orderId: "ord-1" });

		expect(deliverWebhook).not.toHaveBeenCalled();
		expect(db.webhookDelivery.create).not.toHaveBeenCalled();
	});

	it("does not throw when DB query fails", async () => {
		const bus = createMockBus();
		const db = createMockDb();
		db.webhook.findMany.mockRejectedValue(new Error("DB connection lost"));

		registerWebhookHandlers(bus, db, STORE_ID);

		await expect(
			bus.fire("order.placed", "orders", { orderId: "ord-1" }),
		).resolves.toBeUndefined();
	});

	it("does not throw when delivery logging fails", async () => {
		const bus = createMockBus();
		const db = createMockDb([
			{ id: "wh-1", url: "https://hook.example.com", secret: "sec" },
		]);
		db.webhookDelivery.create.mockRejectedValue(new Error("Write failed"));

		registerWebhookHandlers(bus, db, STORE_ID);

		await expect(
			bus.fire("order.placed", "orders", { orderId: "ord-1" }),
		).resolves.toBeUndefined();
	});
});
