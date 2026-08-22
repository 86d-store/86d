import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createShippingController } from "../service-impl";
import { createShippingWebhook } from "../store/endpoints/webhook";

/**
 * Tests for the EasyPost tracking webhook handler.
 *
 * Covers:
 * 1. Signature verification — rejects invalid HMAC, accepts valid HMAC, skips
 *    when no secret is configured
 * 2. Event filtering — only handles tracker.* events
 * 3. Status mapping — maps EasyPost statuses to internal ShipmentStatus values
 * 4. Shipment lookup — finds by trackingNumber, returns handled:false if not found
 * 5. Status deduplication — skips update when status is unchanged
 * 6. Event emission — emits the correct domain event after update
 * 7. findShipmentByTrackingNumber — new controller method
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function makeTrackerEvent(
	status: string,
	trackingCode = "9400111899223450385668",
	description = "tracker.updated",
) {
	return {
		id: "evt_test_1",
		object: "Event",
		description,
		mode: "test",
		previous_attributes: {},
		result: {
			id: "trk_test_1",
			object: "Tracker",
			tracking_code: trackingCode,
			status,
			carrier: "USPS",
			public_url: "https://track.easypost.com/trk_test_1",
			est_delivery_date: null,
		},
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
}

async function callWebhook(
	endpoint: ReturnType<typeof createShippingWebhook>,
	request: Request,
	context: Record<string, unknown>,
): Promise<Response> {
	const candidate = endpoint as unknown as Record<string, unknown>;
	const handler =
		typeof candidate.handler === "function" ? candidate.handler : candidate;
	return (handler as CallableFunction)({
		request,
		context,
	}) as Promise<Response>;
}

function currentRfc2822Timestamp(): string {
	return new Date().toUTCString().replace("GMT", "+0000");
}

async function makeV2Request(
	body: string,
	secret: string,
	overrides: {
		timestamp?: string;
		path?: string;
		signature?: string | null;
	} = {},
): Promise<Request> {
	const timestamp = overrides.timestamp ?? currentRfc2822Timestamp();
	const path = overrides.path ?? "/api/shipping/webhook";
	const digest = await hmacSha256Hex(secret, `${timestamp}POST${path}${body}`);
	const headers: Record<string, string> = {
		"content-type": "application/json",
		"x-timestamp": timestamp,
		"x-path": path,
	};
	if (overrides.signature !== null) {
		headers["x-hmac-signature-v2"] =
			overrides.signature ?? `hmac-sha256-hex=${digest}`;
	}
	return new Request(`https://store.example.com${path}`, {
		method: "POST",
		headers,
		body,
	});
}

describe("EasyPost webhook HTTP boundary", () => {
	it("fails closed without verification material before any side effect", async () => {
		const findShipment = vi.fn();
		const emit = vi.fn();
		const request = await makeV2Request(
			JSON.stringify(makeTrackerEvent("delivered")),
			"unused-secret",
		);

		const response = await callWebhook(createShippingWebhook({}), request, {
			controllers: {
				shipping: { findShipmentByTrackingNumber: findShipment },
			},
			events: { emit },
		});

		expect(response.status).toBe(503);
		expect(findShipment).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it("accepts the documented EasyPost v2 signature inputs", async () => {
		const secret = "easypost-webhook-secret";
		const request = await makeV2Request(
			JSON.stringify(makeTrackerEvent("delivered")),
			secret,
		);
		const response = await callWebhook(
			createShippingWebhook({ webhookSecret: secret }),
			request,
			{
				controllers: {
					shipping: { findShipmentByTrackingNumber: vi.fn(async () => null) },
				},
				events: { emit: vi.fn() },
			},
		);

		expect(response.status).toBe(200);
	});

	it("rejects an invalid v2 signature before any side effect", async () => {
		const findShipment = vi.fn();
		const emit = vi.fn();
		const request = await makeV2Request(
			JSON.stringify(makeTrackerEvent("delivered")),
			"easypost-webhook-secret",
			{ signature: "hmac-sha256-hex=00" },
		);

		const response = await callWebhook(
			createShippingWebhook({ webhookSecret: "easypost-webhook-secret" }),
			request,
			{
				controllers: {
					shipping: { findShipmentByTrackingNumber: findShipment },
				},
				events: { emit },
			},
		);

		expect(response.status).toBe(401);
		expect(findShipment).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it("applies a duplicate EasyPost event only once", async () => {
		const data = createMockDataService();
		const emit = vi.fn(async (_type: string, _payload: unknown) => undefined);
		const controller = createShippingController(data, {
			emit,
			on: vi.fn(() => () => undefined),
			off: vi.fn(),
		});
		const carrier = await controller.createCarrier({
			name: "USPS",
			code: "usps",
			isActive: true,
		});
		const shipment = await controller.createShipment({
			orderId: "order_duplicate",
			carrierId: carrier.id,
			trackingNumber: "TRACK_DUPLICATE",
		});
		const stored = await data.get("shipment", shipment.id);
		await data.upsert("shipment", shipment.id, {
			...stored,
			status: "in_transit",
		});
		emit.mockClear();

		const secret = "easypost-webhook-secret";
		const body = JSON.stringify(
			makeTrackerEvent("delivered", "TRACK_DUPLICATE"),
		);
		const endpoint = createShippingWebhook({ webhookSecret: secret });
		const context = {
			controllers: { shipping: controller },
			events: { emit },
		};

		await callWebhook(endpoint, await makeV2Request(body, secret), context);
		await callWebhook(endpoint, await makeV2Request(body, secret), context);

		expect(
			emit.mock.calls.filter(([type]) => type === "shipment.delivered"),
		).toHaveLength(1);
		const updated = await controller.getShipment(shipment.id);
		expect(updated?.status).toBe("delivered");
	});

	it("reserves a receipt before concurrent duplicate mutations", async () => {
		let releaseUpdate: (() => void) | undefined;
		const updateGate = new Promise<void>((resolve) => {
			releaseUpdate = resolve;
		});
		const findShipment = vi.fn(async () => ({
			id: "shipment_concurrent",
			status: "in_transit",
		}));
		const updateShipmentStatus = vi.fn(async () => {
			await updateGate;
			return { id: "shipment_concurrent", status: "delivered" };
		});
		const secret = "easypost-webhook-secret";
		const body = JSON.stringify(
			makeTrackerEvent("delivered", "TRACK_CONCURRENT"),
		);
		const endpoint = createShippingWebhook({ webhookSecret: secret });
		const context = {
			controllers: {
				shipping: {
					findShipmentByTrackingNumber: findShipment,
					updateShipmentStatus,
				},
			},
			events: { emit: vi.fn() },
		};

		const first = callWebhook(
			endpoint,
			await makeV2Request(body, secret),
			context,
		);
		await vi.waitFor(() =>
			expect(updateShipmentStatus).toHaveBeenCalledTimes(1),
		);
		// Await the duplicate while the first request still holds "processing".
		// A short timeout before releasing the gate is racy on loaded CI runners.
		const second = await callWebhook(
			endpoint,
			await makeV2Request(body, secret),
			context,
		);
		expect(second.status).toBe(409);
		releaseUpdate?.();
		const firstResponse = await first;

		expect(firstResponse.status).toBe(200);
		expect(findShipment).toHaveBeenCalledTimes(1);
		expect(updateShipmentStatus).toHaveBeenCalledTimes(1);
	});
});

// ── Simulate the webhook endpoint core logic ──────────────────────────────────

interface SimulateResult {
	statusCode: number;
	body: Record<string, unknown>;
}

async function simulateWebhook(
	eventBody: Record<string, unknown>,
	opts: {
		webhookSecret?: string;
		incomingSignature?: string;
		shipmentTrackingNumber?: string;
		shipmentStatus?: string;
	} = {},
): Promise<SimulateResult> {
	const rawBody = JSON.stringify(eventBody);

	// Signature check
	if (opts.webhookSecret) {
		const sig = opts.incomingSignature ?? "";
		const expected = await hmacSha256Hex(opts.webhookSecret, rawBody);
		if (sig !== expected) {
			return { statusCode: 401, body: { error: "Invalid webhook signature." } };
		}
	}

	let event: typeof eventBody;
	try {
		event = JSON.parse(rawBody) as typeof eventBody;
	} catch {
		return { statusCode: 400, body: { error: "Invalid JSON body." } };
	}

	if (event.object !== "Event") {
		return { statusCode: 200, body: { received: true, handled: false } };
	}

	const description = event.description as string | undefined;
	if (!description?.startsWith("tracker.")) {
		return { statusCode: 200, body: { received: true, handled: false } };
	}

	const result = event.result as Record<string, unknown> | undefined;
	if (result?.object !== "Tracker" || !result.tracking_code) {
		return { statusCode: 200, body: { received: true, handled: false } };
	}

	const trackingCode = result.tracking_code as string;
	const easypostStatus = result.status as string;

	// Map EasyPost status to internal
	const { mapEasyPostStatusToInternal } = await import("../provider");
	const internalStatus = mapEasyPostStatusToInternal(
		easypostStatus as Parameters<typeof mapEasyPostStatusToInternal>[0],
	);

	// If shipment tracking number doesn't match, return handled:false
	if (
		!opts.shipmentTrackingNumber ||
		opts.shipmentTrackingNumber !== trackingCode
	) {
		return { statusCode: 200, body: { received: true, handled: false } };
	}

	// Status unchanged — skip
	if (opts.shipmentStatus === internalStatus) {
		return { statusCode: 200, body: { received: true, handled: false } };
	}

	return {
		statusCode: 200,
		body: {
			received: true,
			handled: true,
			status: internalStatus,
		},
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("shipping webhook", () => {
	describe("event filtering", () => {
		it("ignores non-Event objects", async () => {
			const result = await simulateWebhook({
				object: "SomethingElse",
				description: "tracker.updated",
				result: {},
			});
			expect(result.body.handled).toBe(false);
		});

		it("ignores non-tracker descriptions", async () => {
			const result = await simulateWebhook({
				object: "Event",
				description: "batch.created",
				result: {},
			});
			expect(result.body.handled).toBe(false);
		});

		it("handles tracker.created events", async () => {
			const event = makeTrackerEvent(
				"pre_transit",
				"TRACK123",
				"tracker.created",
			);
			const result = await simulateWebhook(event, {
				shipmentTrackingNumber: "TRACK123",
				shipmentStatus: "pending",
			});
			expect(result.body.received).toBe(true);
		});

		it("handles tracker.updated events", async () => {
			const event = makeTrackerEvent(
				"in_transit",
				"TRACK123",
				"tracker.updated",
			);
			const result = await simulateWebhook(event, {
				shipmentTrackingNumber: "TRACK123",
				shipmentStatus: "pending",
			});
			expect(result.body.handled).toBe(true);
		});
	});

	describe("status mapping", () => {
		const mappings: Array<[string, string]> = [
			["pre_transit", "pending"],
			["unknown", "pending"],
			["in_transit", "in_transit"],
			["out_for_delivery", "in_transit"],
			["available_for_pickup", "in_transit"],
			["delivered", "delivered"],
			["return_to_sender", "returned"],
			["failure", "failed"],
			["cancelled", "failed"],
			["error", "failed"],
		];

		for (const [easypostStatus, expected] of mappings) {
			it(`maps '${easypostStatus}' → '${expected}'`, async () => {
				const event = makeTrackerEvent(easypostStatus, "TRACK456");
				const result = await simulateWebhook(event, {
					shipmentTrackingNumber: "TRACK456",
					shipmentStatus: "pending",
				});
				const expectedBody =
					expected === "pending"
						? { handled: false }
						: { handled: true, status: expected };
				expect(result.body).toMatchObject(expectedBody);
			});
		}
	});

	describe("shipment lookup", () => {
		it("returns handled:false when no shipment has the tracking number", async () => {
			const event = makeTrackerEvent("delivered", "UNKNOWN_TRACK");
			const result = await simulateWebhook(event, {
				shipmentTrackingNumber: "DIFFERENT_TRACK",
			});
			expect(result.body.handled).toBe(false);
		});

		it("returns handled:true when shipment is found and status changes", async () => {
			const event = makeTrackerEvent("delivered", "TRACK789");
			const result = await simulateWebhook(event, {
				shipmentTrackingNumber: "TRACK789",
				shipmentStatus: "in_transit",
			});
			expect(result.body.handled).toBe(true);
			expect(result.body.status).toBe("delivered");
		});
	});

	describe("status deduplication", () => {
		it("skips update when status is already the same", async () => {
			const event = makeTrackerEvent("delivered", "TRACK_DUP");
			const result = await simulateWebhook(event, {
				shipmentTrackingNumber: "TRACK_DUP",
				shipmentStatus: "delivered",
			});
			expect(result.body.handled).toBe(false);
		});
	});
});

describe("findShipmentByTrackingNumber", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns null when no shipment exists with that tracking number", async () => {
		const ctrl = createShippingController(data);
		const result = await ctrl.findShipmentByTrackingNumber("NOTEXIST");
		expect(result).toBeNull();
	});

	it("returns the shipment when tracking number matches", async () => {
		const ctrl = createShippingController(data);

		// Create a carrier first (needed for shipment)
		const carrier = await ctrl.createCarrier({
			name: "USPS",
			code: "USPS",
			isActive: true,
		});

		// Create a shipment with a tracking number
		const shipment = await ctrl.createShipment({
			orderId: "order_001",
			carrierId: carrier.id,
			trackingNumber: "9400111899223450385668",
		});

		const found = await ctrl.findShipmentByTrackingNumber(
			"9400111899223450385668",
		);
		expect(found).not.toBeNull();
		expect(found?.id).toBe(shipment.id);
		expect(found?.trackingNumber).toBe("9400111899223450385668");
	});

	it("returns null for an unrelated tracking number", async () => {
		const ctrl = createShippingController(data);
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "FEDEX",
			isActive: true,
		});
		await ctrl.createShipment({
			orderId: "order_002",
			carrierId: carrier.id,
			trackingNumber: "123456789",
		});

		const found = await ctrl.findShipmentByTrackingNumber("999999");
		expect(found).toBeNull();
	});
});
