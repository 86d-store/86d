import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "../provider";
import { createEtsyController } from "../service-impl";
import { createEtsyWebhook } from "../store/endpoints/webhooks";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_WEBHOOK_SECRET = "test-etsy-webhook-secret";

/** Compute HMAC-SHA256 hex digest — matches the implementation under test. */
async function computeHmacHex(
	payload: string,
	secret: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function createMockEvents() {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

function createTestContext() {
	const data = createMockDataService();
	const events = createMockEvents();
	const controller = createEtsyController(data, events);
	return {
		data,
		events,
		controller,
		context: { controllers: { etsy: controller }, events },
	};
}

/** Invoke the webhook endpoint handler. */
async function callWebhook(
	handler: ReturnType<typeof createEtsyWebhook>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({ request, context }) as Promise<Response>;
}

const ORDER_PAYLOAD = {
	type: "order.created",
	payload: {
		etsyReceiptId: "ETSY-12345",
		items: [],
		subtotal: 100,
		shippingCost: 10,
		etsyFee: 5,
		processingFee: 3,
		tax: 8,
		total: 126,
		shippingAddress: { city: "Brooklyn" },
	},
};

// ── Signature verification function tests ────────────────────────────────────

describe("verifyWebhookSignature", () => {
	it("returns true for valid signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const signature = await computeHmacHex(body, TEST_WEBHOOK_SECRET);
		const result = await verifyWebhookSignature(
			body,
			signature,
			TEST_WEBHOOK_SECRET,
		);
		expect(result).toBe(true);
	});

	it("returns false for tampered payload", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const signature = await computeHmacHex(body, TEST_WEBHOOK_SECRET);
		const result = await verifyWebhookSignature(
			'{"type":"order.cancelled","payload":{}}',
			signature,
			TEST_WEBHOOK_SECRET,
		);
		expect(result).toBe(false);
	});

	it("returns false for empty signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const result = await verifyWebhookSignature(body, "", TEST_WEBHOOK_SECRET);
		expect(result).toBe(false);
	});
});

// ── Webhook endpoint tests ───────────────────────────────────────────────────

describe("etsy webhook endpoint", () => {
	describe("without verification configuration", () => {
		const endpoint = createEtsyWebhook();

		it("refuses the event before parsing the body", async () => {
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not json",
			});
			const { context } = createTestContext();
			const response = await callWebhook(endpoint, request, context);

			// Unverifiable input is refused before it is interpreted at all.
			expect(response.status).toBe(503);
		});

		it("refuses a well-formed event rather than trusting it", async () => {
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(ORDER_PAYLOAD),
			});
			const { context } = createTestContext();
			const response = await callWebhook(endpoint, request, context);

			expect(response.status).toBe(503);
			const json = await response.json();
			expect(json.error).toMatch(/not configured/i);
		});
	});

	describe("with signature verification", () => {
		const signedEndpoint = createEtsyWebhook(TEST_WEBHOOK_SECRET);

		it("accepts valid signature", async () => {
			const body = JSON.stringify(ORDER_PAYLOAD);
			const signature = await computeHmacHex(body, TEST_WEBHOOK_SECRET);
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-etsy-signature": signature,
				},
				body,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(200);
			const json = await response.json();
			expect(json.received).toBe(true);
		});

		it("rejects invalid JSON with 400 once the signature checks out", async () => {
			const body = "not json";
			const signature = await computeHmacHex(body, TEST_WEBHOOK_SECRET);
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-etsy-signature": signature,
				},
				body,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(400);
		});

		it("rejects missing signature with 401", async () => {
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(ORDER_PAYLOAD),
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe("Invalid webhook signature.");
		});

		it("rejects invalid signature with 401", async () => {
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-etsy-signature":
						"0000000000000000000000000000000000000000000000000000000000000000",
				},
				body: JSON.stringify(ORDER_PAYLOAD),
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe("Invalid webhook signature.");
		});

		it("rejects tampered body with 401", async () => {
			const originalBody = JSON.stringify(ORDER_PAYLOAD);
			const signature = await computeHmacHex(originalBody, TEST_WEBHOOK_SECRET);
			const request = new Request("https://store.example.com/etsy/webhooks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-etsy-signature": signature,
				},
				body: JSON.stringify({
					type: "order.cancelled",
					payload: { orderId: "evil" },
				}),
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
		});
	});
});
