import { describe, expect, it, vi } from "vitest";
import { UberEatsProvider } from "../provider";
import { createUberEatsWebhook } from "../store/endpoints/webhook";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function computeSignature(body: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const CLIENT_SECRET = "test-client-secret-uber";

/** Build a request the configured endpoint will accept as authentic. */
async function createSignedRequest(body: string): Promise<Request> {
	return createMockRequest(body, {
		"x-uber-signature": await computeSignature(body, CLIENT_SECRET),
	});
}

function createMockRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("http://localhost/api/uber-eats/webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
		body,
	});
}

function createMockController() {
	return {
		receiveOrder: vi.fn(async (params: Record<string, unknown>) => ({
			id: "local-1",
			externalOrderId: params.externalOrderId,
			status: "pending",
			items: [],
			subtotal: 0,
			deliveryFee: 0,
			tax: 0,
			total: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		cancelOrder: vi.fn(async () => null),
		listOrders: vi.fn(async () => [
			{
				id: "local-1",
				externalOrderId: "order-xyz",
				status: "pending",
			},
		]),
		acceptOrder: vi.fn(),
		markReady: vi.fn(),
		getOrder: vi.fn(),
		syncMenu: vi.fn(),
		getLastMenuSync: vi.fn(),
		listMenuSyncs: vi.fn(),
		getOrderStats: vi.fn(),
	};
}

function createMockEvents() {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(),
		off: vi.fn(),
	};
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getHandler(
	webhook: ReturnType<typeof createUberEatsWebhook>,
): CallableFunction {
	const h = webhook as unknown as Record<string, unknown>;
	return (typeof h.handler === "function" ? h.handler : h) as CallableFunction;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("uber-eats webhook endpoint", () => {
	describe("signature verification", () => {
		it("rejects requests with invalid signature", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const body = JSON.stringify({
				event_type: "orders.notification",
				meta: { resource_id: "order-1" },
			});

			const request = createMockRequest(body, {
				"x-uber-signature": "invalid-signature-value",
			});

			const handler = getHandler(webhook);
			const response = await handler({
				request,
				context: { controllers: { "uber-eats": createMockController() } },
			});

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.error).toBe("Invalid webhook signature.");
		});

		it("accepts requests with valid signature", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const body = JSON.stringify({
				event_type: "orders.notification",
				meta: { resource_id: "order-1" },
			});

			const signature = await computeSignature(body, CLIENT_SECRET);
			const request = createMockRequest(body, {
				"x-uber-signature": signature,
			});

			const handler = getHandler(webhook);
			const response = await handler({
				request,
				context: {
					controllers: { "uber-eats": createMockController() },
					events: createMockEvents(),
				},
			});

			expect(response.status).toBe(200);
		});

		it("refuses the event when no secret is configured", async () => {
			const webhook = createUberEatsWebhook({});
			const body = JSON.stringify({
				event_type: "orders.notification",
				meta: { resource_id: "order-1" },
			});

			const request = createMockRequest(body);

			const handler = getHandler(webhook);
			const response = await handler({
				request,
				context: {
					controllers: { "uber-eats": createMockController() },
					events: createMockEvents(),
				},
			});

			// An unconfigured Integration cannot authenticate the sender.
			expect(response.status).toBe(503);
			const data = await response.json();
			expect(data.error).toMatch(/not configured/i);
		});
	});

	describe("event handling", () => {
		it("rejects invalid JSON", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const request = await createSignedRequest("not-json");

			const handler = getHandler(webhook);
			const response = await handler({
				request,
				context: { controllers: { "uber-eats": createMockController() } },
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBe("Invalid JSON body.");
		});

		it("rejects missing event_type", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const request = await createSignedRequest(JSON.stringify({ meta: {} }));

			const handler = getHandler(webhook);
			const response = await handler({
				request,
				context: { controllers: { "uber-eats": createMockController() } },
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBe("Missing event_type.");
		});

		it("creates order on orders.notification event", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const controller = createMockController();
			const body = JSON.stringify({
				event_type: "orders.notification",
				meta: { resource_id: "uber-order-abc" },
			});
			const request = await createSignedRequest(body);

			const handler = getHandler(webhook);
			await handler({
				request,
				context: {
					controllers: { "uber-eats": controller },
					events: createMockEvents(),
				},
			});

			expect(controller.receiveOrder).toHaveBeenCalledWith(
				expect.objectContaining({
					externalOrderId: "uber-order-abc",
					orderType: "DELIVERY_BY_UBER",
				}),
			);
		});

		it("cancels order on orders.cancel event", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const controller = createMockController();
			const body = JSON.stringify({
				event_type: "orders.cancel",
				meta: { resource_id: "order-xyz" },
			});
			const request = await createSignedRequest(body);

			const handler = getHandler(webhook);
			await handler({
				request,
				context: {
					controllers: { "uber-eats": controller },
					events: createMockEvents(),
				},
			});

			expect(controller.listOrders).toHaveBeenCalled();
			expect(controller.cancelOrder).toHaveBeenCalledWith(
				"local-1",
				"Cancelled via Uber Eats webhook",
			);
		});

		it("emits ubereats.webhook.received event", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const events = createMockEvents();
			const body = JSON.stringify({
				event_type: "store.status.changed",
				event_id: "evt-123",
				meta: { resource_id: "store-1" },
			});
			const request = await createSignedRequest(body);

			const handler = getHandler(webhook);
			await handler({
				request,
				context: {
					controllers: { "uber-eats": createMockController() },
					events,
				},
			});

			expect(events.emit).toHaveBeenCalledWith(
				"ubereats.webhook.received",
				expect.objectContaining({
					eventType: "store.status.changed",
					resourceId: "store-1",
					eventId: "evt-123",
				}),
			);
		});

		it("extracts resource_id from resource_href fallback", async () => {
			const webhook = createUberEatsWebhook({ clientSecret: CLIENT_SECRET });
			const controller = createMockController();
			const body = JSON.stringify({
				event_type: "orders.notification",
				resource_href:
					"https://api.uber.com/v1/eats/order/uber-order-from-href",
			});
			const request = await createSignedRequest(body);

			const handler = getHandler(webhook);
			await handler({
				request,
				context: {
					controllers: { "uber-eats": controller },
					events: createMockEvents(),
				},
			});

			expect(controller.receiveOrder).toHaveBeenCalledWith(
				expect.objectContaining({
					externalOrderId: "uber-order-from-href",
				}),
			);
		});
	});
});

describe("UberEatsProvider.verifyWebhookSignature static method", () => {
	it("matches the static verification against known input", async () => {
		const body = '{"event_type":"test"}';
		const secret = "webhook-secret-123";

		const signature = await computeSignature(body, secret);
		const valid = await UberEatsProvider.verifyWebhookSignature(
			body,
			signature,
			secret,
		);
		expect(valid).toBe(true);
	});
});
