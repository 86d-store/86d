import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Inline the HMAC logic to test signature verification ─────────────────────

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const TEST_WEBHOOK_SECRET = "toast-test-webhook-secret";

/** Build a request the configured endpoint will accept as authentic. */
async function signedRequest(rawBody: string): Promise<Request> {
	return new Request("http://localhost/toast/webhook", {
		method: "POST",
		body: rawBody,
		headers: {
			"Content-Type": "application/json",
			"x-toast-signature": await hmacSha256Hex(TEST_WEBHOOK_SECRET, rawBody),
		},
	});
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function invokeEndpoint(
	endpoint: unknown,
	ctx: Record<string, unknown>,
): Promise<Response> {
	const h = endpoint as Record<string, unknown>;
	const fn = (
		typeof h.handler === "function" ? h.handler : h
	) as CallableFunction;
	return fn(ctx) as Promise<Response>;
}

// ── Webhook handler tests ────────────────────────────────────────────────────

describe("Toast webhook handler", () => {
	const originalFetch = globalThis.fetch;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// Import the factory dynamically so globalThis.fetch is already mocked
	async function getWebhookFactory() {
		const mod = await import("../store/endpoints/webhook");
		return mod.createToastWebhook;
	}

	it("rejects requests with invalid JSON", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const request = await signedRequest("not json");

		const ctx = { request, context: { controllers: {}, events: null } };
		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid JSON body.");
	});

	it("rejects requests with missing eventType", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const request = await signedRequest(JSON.stringify({ entityGuid: "abc" }));

		const ctx = { request, context: { controllers: {}, events: null } };
		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Missing eventType.");
	});

	it("accepts a verified webhook with a known event type", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const syncMenuCalls: unknown[] = [];
		const emittedEvents: unknown[] = [];

		const mockController = {
			syncMenu: vi.fn(async (params: unknown) => {
				syncMenuCalls.push(params);
				return { id: "rec-1", entityType: "menu-item", status: "synced" };
			}),
		};

		const mockEvents = {
			emit: vi.fn(async (name: string, data: unknown) => {
				emittedEvents.push({ name, data });
			}),
		};

		const request = await signedRequest(
			JSON.stringify({
				eventType: "menu.item.updated",
				entityGuid: "item-guid-123",
				restaurantGuid: "rest-guid-456",
			}),
		);

		const ctx = {
			request,
			context: {
				controllers: { toast: mockController },
				events: mockEvents,
			},
		};

		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.received).toBe(true);
		expect(body.eventType).toBe("menu.item.updated");
		expect(mockController.syncMenu).toHaveBeenCalledWith({
			entityId: "item-guid-123",
			externalId: "item-guid-123",
			direction: "inbound",
		});
		expect(mockEvents.emit).toHaveBeenCalledWith(
			"toast.webhook.received",
			expect.objectContaining({ eventType: "menu.item.updated" }),
		);
	});

	it("routes order events to syncOrder", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const mockController = {
			syncOrder: vi.fn(async () => ({
				id: "rec-2",
				entityType: "order",
				status: "synced",
			})),
		};

		const request = await signedRequest(
			JSON.stringify({
				eventType: "order.created",
				entityGuid: "order-guid-789",
			}),
		);

		const ctx = {
			request,
			context: { controllers: { toast: mockController }, events: null },
		};

		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(200);
		expect(mockController.syncOrder).toHaveBeenCalledWith({
			entityId: "order-guid-789",
			externalId: "order-guid-789",
			direction: "inbound",
		});
	});

	it("routes stock events to syncInventory", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const mockController = {
			syncInventory: vi.fn(async () => ({
				id: "rec-3",
				entityType: "inventory",
				status: "synced",
			})),
		};

		const request = await signedRequest(
			JSON.stringify({
				eventType: "stock.updated",
				entityGuid: "stock-guid-001",
			}),
		);

		const ctx = {
			request,
			context: { controllers: { toast: mockController }, events: null },
		};

		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(200);
		expect(mockController.syncInventory).toHaveBeenCalledWith({
			entityId: "stock-guid-001",
			externalId: "stock-guid-001",
			direction: "inbound",
		});
	});

	it("rejects invalid signature when webhookSecret is configured", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: "my-secret" });

		const request = new Request("http://localhost/toast/webhook", {
			method: "POST",
			body: JSON.stringify({ eventType: "menu.item.updated" }),
			headers: {
				"Content-Type": "application/json",
				"x-toast-signature": "invalid-sig",
			},
		});

		const ctx = { request, context: { controllers: {}, events: null } };
		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Invalid webhook signature.");
	});

	it("accepts valid signature when webhookSecret is configured", async () => {
		const secret = "my-webhook-secret";
		const rawBody = JSON.stringify({
			eventType: "order.updated",
			entityGuid: "order-123",
		});
		const validSig = await hmacSha256Hex(secret, rawBody);

		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: secret });

		const mockController = {
			syncOrder: vi.fn(async () => ({
				id: "r",
				entityType: "order",
				status: "synced",
			})),
		};

		const request = new Request("http://localhost/toast/webhook", {
			method: "POST",
			body: rawBody,
			headers: {
				"Content-Type": "application/json",
				"x-toast-signature": validSig,
			},
		});

		const ctx = {
			request,
			context: { controllers: { toast: mockController }, events: null },
		};

		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(200);
		expect(mockController.syncOrder).toHaveBeenCalled();
	});

	it("accepts unknown event types without routing to controllers", async () => {
		const factory = await getWebhookFactory();
		const endpoint = factory({ webhookSecret: TEST_WEBHOOK_SECRET });

		const request = await signedRequest(
			JSON.stringify({
				eventType: "restaurant.updated",
				entityGuid: "rest-123",
			}),
		);

		const ctx = {
			request,
			context: { controllers: { toast: {} }, events: null },
		};

		const res = await invokeEndpoint(endpoint, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.received).toBe(true);
	});
});
