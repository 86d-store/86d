import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Delivery } from "../service";
import { createUberDirectController } from "../service-impl";
import { createUberDirectWebhook } from "../store/endpoints/webhook";

const TEST_SIGNING_KEY = "test-signing-key-for-uber-direct";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callWebhook(
	handler: ReturnType<typeof createUberDirectWebhook>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({ request, context }) as Promise<Response>;
}

function createMockEvents() {
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

async function makeWebhookRequest(
	body: Record<string, unknown>,
): Promise<Request> {
	const rawBody = JSON.stringify(body);
	const signature = await computeSignature(rawBody, TEST_SIGNING_KEY);
	return new Request("https://store.example.com/api/uber-direct/webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-uber-signature": signature,
		},
		body: rawBody,
	});
}

function createTestContext() {
	const data = createMockDataService();
	const events = createMockEvents();
	// No credentials — no real API provider, uses local data only
	const controller = createUberDirectController(data, events);
	return {
		data,
		events,
		controller,
		context: { controllers: { uberDirect: controller }, events },
	};
}

/** Insert a delivery directly into the mock data service with a known externalId. */
async function seedDelivery(
	data: ReturnType<typeof createMockDataService>,
	overrides: Partial<Delivery> = {},
): Promise<Delivery> {
	const now = new Date();
	const delivery: Delivery = {
		id: crypto.randomUUID(),
		orderId: "order-1",
		externalId: "uber-delivery-abc123",
		status: "pending",
		pickupAddress: { street: "901 Market St", city: "San Francisco" },
		dropoffAddress: { street: "123 Main St", city: "San Francisco" },
		fee: 899,
		tip: 0,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
	await data.upsert(
		"delivery",
		delivery.id,
		delivery as unknown as Record<string, unknown>,
	);
	return delivery;
}

// ── Realistic Uber Direct webhook payloads ────────────────────────────────────

const DELIVERY_PICKUP_PAYLOAD = {
	kind: "event.delivery_status",
	id: "uber-delivery-abc123",
	status: "pickup",
	tracking_url: "https://track.uber.com/abc123",
};

const DELIVERY_PICKED_UP_PAYLOAD = {
	kind: "event.delivery_status",
	id: "uber-delivery-abc123",
	status: "pickup_complete",
	tracking_url: "https://track.uber.com/abc123",
	courier: {
		name: "Jordan M.",
		phone_number: "+14155551234",
		vehicle_type: "bicycle",
	},
};

const DELIVERY_DELIVERED_PAYLOAD = {
	kind: "event.delivery_status",
	id: "uber-delivery-abc123",
	status: "delivered",
};

const DELIVERY_CANCELED_PAYLOAD = {
	kind: "event.delivery_status",
	id: "uber-delivery-abc123",
	status: "canceled",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("uber-direct webhook endpoint", () => {
	let endpoint: ReturnType<typeof createUberDirectWebhook>;

	beforeEach(() => {
		endpoint = createUberDirectWebhook(TEST_SIGNING_KEY);
	});

	it("rejects invalid JSON with 400", async () => {
		const signature = await computeSignature("not json", TEST_SIGNING_KEY);
		const request = new Request(
			"https://store.example.com/api/uber-direct/webhook",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-uber-signature": signature,
				},
				body: "not json",
			},
		);

		const { context } = createTestContext();
		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Invalid JSON body.");
	});

	it("rejects payloads missing kind with 400", async () => {
		const request = await makeWebhookRequest({
			id: "uber-delivery-abc123",
			status: "pickup",
		});
		const { context } = createTestContext();
		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Missing event kind.");
	});

	it("emits uber-direct.webhook.received for all events", async () => {
		const request = await makeWebhookRequest(DELIVERY_PICKUP_PAYLOAD);
		const { context, events } = createTestContext();

		await callWebhook(endpoint, request, context);

		expect(events.emitted).toContainEqual({
			type: "uber-direct.webhook.received",
			payload: {
				kind: "event.delivery_status",
				deliveryId: "uber-delivery-abc123",
			},
		});
	});

	it("returns handled:false for non-delivery_status events", async () => {
		const request = await makeWebhookRequest({
			kind: "event.courier_update",
			id: "uber-delivery-abc123",
		});
		const { context } = createTestContext();

		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.handled).toBe(false);
	});

	it("returns handled:false when delivery not found", async () => {
		const request = await makeWebhookRequest(DELIVERY_PICKUP_PAYLOAD);
		const { context } = createTestContext();

		// No delivery seeded — externalId won't match
		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.handled).toBe(false);
		expect(body.reason).toBe("delivery_not_found");
	});

	it("returns handled:false when payload is missing id or status", async () => {
		const request = await makeWebhookRequest({
			kind: "event.delivery_status",
			// missing id and status
		});
		const { context } = createTestContext();

		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.handled).toBe(false);
		expect(body.reason).toBe("missing_delivery_id_or_status");
	});

	it("updates status to accepted on pickup status", async () => {
		const { data, controller, context } = createTestContext();
		const delivery = await seedDelivery(data);

		const request = await makeWebhookRequest(DELIVERY_PICKUP_PAYLOAD);
		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.handled).toBe(true);
		expect(body.deliveryId).toBe(delivery.id);

		const updated = await controller.getDelivery(delivery.id);
		expect(updated?.status).toBe("accepted");
		expect(updated?.trackingUrl).toBe("https://track.uber.com/abc123");
	});

	it("updates status to picked-up on pickup_complete status", async () => {
		const { data, controller, context } = createTestContext();
		await seedDelivery(data, { status: "accepted" });

		const request = await makeWebhookRequest(DELIVERY_PICKED_UP_PAYLOAD);
		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.handled).toBe(true);

		// Find the delivery by looking it up via controller
		const deliveries = await controller.listDeliveries();
		const updated = deliveries[0];
		expect(updated?.status).toBe("picked-up");
		expect(updated?.courierName).toBe("Jordan M.");
		expect(updated?.courierPhone).toBe("+14155551234");
		expect(updated?.courierVehicle).toBe("bicycle");
		expect(updated?.actualPickupTime).toBeInstanceOf(Date);
	});

	it("updates status to delivered on delivered event", async () => {
		const { data, controller, context } = createTestContext();
		await seedDelivery(data, { status: "picked-up" });

		const request = await makeWebhookRequest(DELIVERY_DELIVERED_PAYLOAD);
		await callWebhook(endpoint, request, context);

		const deliveries = await controller.listDeliveries();
		const updated = deliveries[0];
		expect(updated?.status).toBe("delivered");
		expect(updated?.actualDeliveryTime).toBeInstanceOf(Date);
	});

	it("cancels delivery on canceled event", async () => {
		const { data, controller, context } = createTestContext();
		await seedDelivery(data);

		const request = await makeWebhookRequest(DELIVERY_CANCELED_PAYLOAD);
		await callWebhook(endpoint, request, context);

		const deliveries = await controller.listDeliveries();
		const updated = deliveries[0];
		expect(updated?.status).toBe("cancelled");
	});

	it("does not reapply or re-emit a duplicate delivery status", async () => {
		const { data, context, events } = createTestContext();
		await seedDelivery(data, { status: "accepted" });

		await callWebhook(
			endpoint,
			await makeWebhookRequest(DELIVERY_PICKED_UP_PAYLOAD),
			context,
		);
		await callWebhook(
			endpoint,
			await makeWebhookRequest(DELIVERY_PICKED_UP_PAYLOAD),
			context,
		);

		expect(
			events.emitted.filter(
				(event) => event.type === "uber-direct.delivery.picked-up",
			),
		).toHaveLength(1);
		expect(
			events.emitted.filter(
				(event) => event.type === "uber-direct.webhook.received",
			),
		).toHaveLength(1);
	});

	it("reserves a receipt before concurrent duplicate mutations", async () => {
		let releaseUpdate: (() => void) | undefined;
		const updateGate = new Promise<void>((resolve) => {
			releaseUpdate = resolve;
		});
		const events = createMockEvents();
		const updateDeliveryStatus = vi.fn(async () => {
			await updateGate;
			return { id: "delivery-local", status: "picked-up" };
		});
		const listDeliveries = vi.fn(async () => [
			{
				id: "delivery-local",
				externalId: DELIVERY_PICKED_UP_PAYLOAD.id,
				status: "accepted",
			},
		]);
		const context = {
			controllers: {
				uberDirect: { listDeliveries, updateDeliveryStatus },
			},
			events,
		};

		const first = callWebhook(
			endpoint,
			await makeWebhookRequest(DELIVERY_PICKED_UP_PAYLOAD),
			context,
		);
		await vi.waitFor(() =>
			expect(updateDeliveryStatus).toHaveBeenCalledTimes(1),
		);
		// Await the duplicate while the first request still holds "processing".
		// A short timeout before releasing the gate is racy on loaded CI runners.
		const secondResponse = await callWebhook(
			endpoint,
			await makeWebhookRequest(DELIVERY_PICKED_UP_PAYLOAD),
			context,
		);
		expect(secondResponse.status).toBe(409);
		releaseUpdate?.();
		const firstResponse = await first;

		expect(firstResponse.status).toBe(200);
		expect(listDeliveries).toHaveBeenCalledTimes(1);
		expect(updateDeliveryStatus).toHaveBeenCalledTimes(1);
		expect(
			events.emitted.filter(
				(event) => event.type === "uber-direct.webhook.received",
			),
		).toHaveLength(1);
	});
});

// ── Signature verification tests ─────────────────────────────────────────────

async function computeSignature(
	payload: string,
	signingKey: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(signingKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function makeSignedRequest(
	body: string,
	signatureHeader: string | null,
	headerName = "x-uber-signature",
): Request {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (signatureHeader !== null) {
		headers[headerName] = signatureHeader;
	}
	return new Request("https://store.example.com/api/uber-direct/webhook", {
		method: "POST",
		headers,
		body,
	});
}

describe("uber-direct webhook signature verification", () => {
	const signedEndpoint = createUberDirectWebhook(TEST_SIGNING_KEY);

	it("accepts a valid x-uber-signature", async () => {
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const signature = await computeSignature(body, TEST_SIGNING_KEY);
		const request = makeSignedRequest(body, signature);
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.received).toBe(true);
	});

	it("accepts a valid x-postmates-signature", async () => {
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const signature = await computeSignature(body, TEST_SIGNING_KEY);
		const request = makeSignedRequest(body, signature, "x-postmates-signature");
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.received).toBe(true);
	});

	it("rejects missing signature with 401", async () => {
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const request = makeSignedRequest(body, null);
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toBe("Missing webhook signature.");
	});

	it("rejects empty signature with 401", async () => {
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const request = makeSignedRequest(body, "");
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toBe("Missing webhook signature.");
	});

	it("rejects invalid signature with 401", async () => {
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const request = makeSignedRequest(
			body,
			"0000000000000000000000000000000000000000000000000000000000000000",
		);
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
		const json = await response.json();
		expect(json.error).toBe("Invalid webhook signature.");
	});

	it("rejects tampered body with 401", async () => {
		const originalBody = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const signature = await computeSignature(originalBody, TEST_SIGNING_KEY);
		const tamperedBody = JSON.stringify({
			...DELIVERY_PICKUP_PAYLOAD,
			status: "canceled",
		});
		const request = makeSignedRequest(tamperedBody, signature);
		const { context } = createTestContext();

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
	});

	it("fails closed when no signing key is configured", async () => {
		const unsignedEndpoint = createUberDirectWebhook();
		const body = JSON.stringify(DELIVERY_PICKUP_PAYLOAD);
		const request = makeSignedRequest(body, null);
		const { context, events } = createTestContext();

		const response = await callWebhook(unsignedEndpoint, request, context);

		expect(response.status).toBe(503);
		const json = await response.json();
		expect(json.error).toMatch(/not configured/i);
		expect(events.emitted).toHaveLength(0);
	});
});
