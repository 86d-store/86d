import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "../provider";
import { createTikTokShopController } from "../service-impl";
import { createTikTokShopWebhook } from "../store/endpoints/webhook";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_APP_SECRET = "test-tiktok-app-secret-for-unit-tests";

/** Compute TikTok-style HMAC-SHA256 signature for test payloads. */
async function computeSignature(
	path: string,
	params: Record<string, string>,
	body: string,
	appSecret: string,
): Promise<string> {
	const sortedKeys = Object.keys(params).sort();
	let signString = path;
	for (const key of sortedKeys) {
		signString += key + params[key];
	}
	if (body) signString += body;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(appSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signString));
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
	const controller = createTikTokShopController(data, events);
	return {
		data,
		events,
		controller,
		context: { controllers: { tiktokShop: controller }, events },
	};
}

/** Invoke the webhook endpoint handler. */
async function callWebhook(
	handler: ReturnType<typeof createTikTokShopWebhook>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({ request, context }) as Promise<Response>;
}

const WEBHOOK_PATH = "/tiktok-shop/webhooks";

function makeSignedUrl(path: string, params: Record<string, string>): string {
	const qs = new URLSearchParams(params).toString();
	return `https://store.example.com${path}?${qs}`;
}

const ORDER_PAYLOAD = {
	type: "order.created",
	payload: {
		externalOrderId: "tt-12345",
		status: "pending",
		items: [],
		subtotal: 100,
		shippingFee: 10,
		platformFee: 5,
		total: 115,
		shippingAddress: { city: "New York" },
	},
};

// ── Signature verification function tests ────────────────────────────────────

describe("verifyWebhookSignature", () => {
	it("returns true for a valid signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const params: Record<string, string> = {
			app_key: "test-key",
			timestamp: "1711497600",
			shop_id: "shop-1",
		};
		const sign = await computeSignature(
			WEBHOOK_PATH,
			params,
			body,
			TEST_APP_SECRET,
		);
		const result = await verifyWebhookSignature(
			WEBHOOK_PATH,
			{ ...params, sign },
			body,
			TEST_APP_SECRET,
		);
		expect(result).toBe(true);
	});

	it("returns false for a tampered body", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const params: Record<string, string> = {
			app_key: "test-key",
			timestamp: "1711497600",
			shop_id: "shop-1",
		};
		const sign = await computeSignature(
			WEBHOOK_PATH,
			params,
			body,
			TEST_APP_SECRET,
		);
		const result = await verifyWebhookSignature(
			WEBHOOK_PATH,
			{ ...params, sign },
			'{"type":"order.cancelled","payload":{}}',
			TEST_APP_SECRET,
		);
		expect(result).toBe(false);
	});

	it("returns false for a wrong signature", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const params: Record<string, string> = {
			app_key: "test-key",
			timestamp: "1711497600",
			shop_id: "shop-1",
		};
		const result = await verifyWebhookSignature(
			WEBHOOK_PATH,
			{
				...params,
				sign: "0000000000000000000000000000000000000000000000000000000000000000",
			},
			body,
			TEST_APP_SECRET,
		);
		expect(result).toBe(false);
	});

	it("returns false when sign param is missing", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const params: Record<string, string> = {
			app_key: "test-key",
			timestamp: "1711497600",
		};
		const result = await verifyWebhookSignature(
			WEBHOOK_PATH,
			params,
			body,
			TEST_APP_SECRET,
		);
		expect(result).toBe(false);
	});

	it("excludes access_token from signature computation", async () => {
		const body = JSON.stringify(ORDER_PAYLOAD);
		const paramsWithoutToken: Record<string, string> = {
			app_key: "test-key",
			timestamp: "1711497600",
			shop_id: "shop-1",
		};
		const sign = await computeSignature(
			WEBHOOK_PATH,
			paramsWithoutToken,
			body,
			TEST_APP_SECRET,
		);
		// Verify passes even with access_token present (it gets excluded)
		const result = await verifyWebhookSignature(
			WEBHOOK_PATH,
			{ ...paramsWithoutToken, access_token: "tok-abc", sign },
			body,
			TEST_APP_SECRET,
		);
		expect(result).toBe(true);
	});
});

// ── Webhook endpoint tests ───────────────────────────────────────────────────

describe("tiktok-shop webhook endpoint", () => {
	describe("without verification configuration", () => {
		const endpoint = createTikTokShopWebhook();

		it("refuses the event before parsing the body", async () => {
			const request = new Request(`https://store.example.com${WEBHOOK_PATH}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not json",
			});
			const { context } = createTestContext();
			const response = await callWebhook(endpoint, request, context);

			expect(response.status).toBe(503);
		});

		it("refuses a well-formed event rather than trusting it", async () => {
			const request = new Request(`https://store.example.com${WEBHOOK_PATH}`, {
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
		const signedEndpoint = createTikTokShopWebhook(TEST_APP_SECRET);

		it("accepts a valid signature", async () => {
			const body = JSON.stringify(ORDER_PAYLOAD);
			const params: Record<string, string> = {
				app_key: "test-key",
				timestamp: "1711497600",
				shop_id: "shop-1",
			};
			const sign = await computeSignature(
				WEBHOOK_PATH,
				params,
				body,
				TEST_APP_SECRET,
			);
			const url = makeSignedUrl(WEBHOOK_PATH, { ...params, sign });
			const request = new Request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(200);
			const json = await response.json();
			expect(json.received).toBe(true);
		});

		async function signedRequest(body: string): Promise<Request> {
			const params: Record<string, string> = {
				app_key: "test-key",
				timestamp: "1711497600",
				shop_id: "shop-1",
			};
			const sign = await computeSignature(
				WEBHOOK_PATH,
				params,
				body,
				TEST_APP_SECRET,
			);
			return new Request(makeSignedUrl(WEBHOOK_PATH, { ...params, sign }), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
		}

		it("rejects invalid JSON with 400 once the signature checks out", async () => {
			const { context } = createTestContext();
			const response = await callWebhook(
				signedEndpoint,
				await signedRequest("not json"),
				context,
			);

			expect(response.status).toBe(400);
			const json = await response.json();
			expect(json.error).toBe("Invalid JSON body.");
		});

		it("rejects payloads missing type", async () => {
			const { context } = createTestContext();
			const response = await callWebhook(
				signedEndpoint,
				await signedRequest(JSON.stringify({ payload: {} })),
				context,
			);

			expect(response.status).toBe(400);
		});

		it("handles order.created events", async () => {
			const { context } = createTestContext();
			const response = await callWebhook(
				signedEndpoint,
				await signedRequest(JSON.stringify(ORDER_PAYLOAD)),
				context,
			);

			expect(response.status).toBe(200);
			const json = await response.json();
			expect(json.received).toBe(true);
			expect(json.orderId).toBeDefined();
		});

		it("returns received:true for unknown event types", async () => {
			const { context } = createTestContext();
			const response = await callWebhook(
				signedEndpoint,
				await signedRequest(
					JSON.stringify({ type: "inventory.updated", payload: {} }),
				),
				context,
			);

			const json = await response.json();
			expect(json.received).toBe(true);
		});

		it("rejects missing signature with 401", async () => {
			const body = JSON.stringify(ORDER_PAYLOAD);
			const url = makeSignedUrl(WEBHOOK_PATH, {
				app_key: "test-key",
				timestamp: "1711497600",
			});
			const request = new Request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe("Missing webhook signature.");
		});

		it("rejects invalid signature with 401", async () => {
			const body = JSON.stringify(ORDER_PAYLOAD);
			const url = makeSignedUrl(WEBHOOK_PATH, {
				app_key: "test-key",
				timestamp: "1711497600",
				sign: "0000000000000000000000000000000000000000000000000000000000000000",
			});
			const request = new Request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
			const json = await response.json();
			expect(json.error).toBe("Invalid webhook signature.");
		});

		it("rejects tampered body with 401", async () => {
			const originalBody = JSON.stringify(ORDER_PAYLOAD);
			const params: Record<string, string> = {
				app_key: "test-key",
				timestamp: "1711497600",
				shop_id: "shop-1",
			};
			const sign = await computeSignature(
				WEBHOOK_PATH,
				params,
				originalBody,
				TEST_APP_SECRET,
			);
			const tamperedBody = JSON.stringify({
				type: "order.cancelled",
				payload: { orderId: "evil-order" },
			});
			const url = makeSignedUrl(WEBHOOK_PATH, { ...params, sign });
			const request = new Request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: tamperedBody,
			});
			const { context } = createTestContext();
			const response = await callWebhook(signedEndpoint, request, context);

			expect(response.status).toBe(401);
		});
	});
});
