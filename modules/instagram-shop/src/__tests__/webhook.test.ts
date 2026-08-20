import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "../provider";
import { createInstagramShopController } from "../service-impl";
import { createInstagramShopWebhook } from "../store/endpoints/webhook";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_APP_SECRET = "test-meta-app-secret-for-unit-tests";

async function computeHubSignature(
	payload: string,
	appSecret: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(appSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `sha256=${hex}`;
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
	const controller = createInstagramShopController(data, events);
	return {
		context: { controllers: { instagramShop: controller }, events },
	};
}

async function callWebhook(
	handler: ReturnType<typeof createInstagramShopWebhook>,
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
		externalOrderId: "ig-12345",
		instagramOrderId: "ig-order-12345",
		igUsername: "@shopuser",
		status: "pending",
		items: [],
		subtotal: 100,
		shippingFee: 10,
		platformFee: 5,
		total: 115,
		shippingAddress: { city: "Los Angeles" },
	},
};

// ── Signature verification function tests ────────────────────────────────────

describe("verifyWebhookSignature", () => {
	it("returns true for a valid sha256= prefixed signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const signature = await computeHubSignature(body, TEST_APP_SECRET);
		const result = await verifyWebhookSignature(
			body,
			signature,
			TEST_APP_SECRET,
		);
		expect(result).toBe(true);
	});

	it("returns false for a tampered payload", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const signature = await computeHubSignature(body, TEST_APP_SECRET);
		const result = await verifyWebhookSignature(
			'{"type":"order.cancelled"}',
			signature,
			TEST_APP_SECRET,
		);
		expect(result).toBe(false);
	});

	it("returns false for an empty signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const result = await verifyWebhookSignature(body, "", TEST_APP_SECRET);
		expect(result).toBe(false);
	});
});

// ── Webhook endpoint tests ───────────────────────────────────────────────────

describe("instagram-shop webhook endpoint", () => {
	describe("without verification configuration", () => {
		const endpoint = createInstagramShopWebhook();

		it("refuses the event before parsing the body", async () => {
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: "not json",
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(endpoint, request, context);

			// Unverifiable input is refused before it is interpreted at all.
			expect(response.status).toBe(503);
		});

		it("refuses a well-formed event rather than trusting it", async () => {
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(ORDER_PAYLOAD),
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(endpoint, request, context);

			expect(response.status).toBe(503);
			const json = await response.json();
			expect(json.error).toMatch(/not configured/i);
		});
	});

	describe("with signature verification", () => {
		const signedEndpoint = createInstagramShopWebhook(TEST_APP_SECRET);

		it("accepts a valid signature", async () => {
			const body = JSON.stringify(ORDER_PAYLOAD);
			const signature = await computeHubSignature(body, TEST_APP_SECRET);
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-hub-signature-256": signature,
					},
					body,
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);
			expect(response.status).toBe(200);
		});

		it("rejects invalid JSON with 400 once the signature checks out", async () => {
			const body = "not json";
			const signature = await computeHubSignature(body, TEST_APP_SECRET);
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-hub-signature-256": signature,
					},
					body,
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(400);
		});

		it("rejects missing signature with 401", async () => {
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(ORDER_PAYLOAD),
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);
			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe("Missing webhook signature.");
		});

		it("rejects invalid signature with 401", async () => {
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-hub-signature-256":
							"sha256=0000000000000000000000000000000000000000000000000000000000000000",
					},
					body: JSON.stringify(ORDER_PAYLOAD),
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);
			expect(response.status).toBe(401);
		});

		it("rejects tampered body with 401", async () => {
			const originalBody = JSON.stringify(ORDER_PAYLOAD);
			const signature = await computeHubSignature(
				originalBody,
				TEST_APP_SECRET,
			);
			const request = new Request(
				"https://store.example.com/instagram-shop/webhooks",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-hub-signature-256": signature,
					},
					body: JSON.stringify({
						type: "order.cancelled",
						payload: { orderId: "evil" },
					}),
				},
			);
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);
			expect(response.status).toBe(401);
		});
	});
});
