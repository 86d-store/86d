import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createBraintreeWebhook } from "../store/endpoints/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PUBLIC_KEY = "braintree-public-key";
const PRIVATE_KEY = "braintree-private-key";

const enc = new TextEncoder();

/** Compute the SDK-compatible Braintree signature digest. */
async function hmacSha1Hex(secret: string, data: string): Promise<string> {
	const derivedKey = await crypto.subtle.digest("SHA-1", enc.encode(secret));
	const key = await crypto.subtle.importKey(
		"raw",
		derivedKey,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Build a valid bt_payload (base64-encoded XML with the given kind). */
function buildPayload(kind: string, extra = ""): string {
	const xml = `<?xml version="1.0" encoding="UTF-8"?><notification><kind>${kind}</kind>${extra}</notification>`;
	return btoa(xml);
}

/** Build a valid bt_signature for a given payload and keys. */
async function buildSignature(
	publicKey: string,
	privateKey: string,
	btPayload: string,
): Promise<string> {
	const hex = await hmacSha1Hex(privateKey, btPayload);
	return `${publicKey}|${hex}`;
}

/** Build a URL-encoded form body with bt_signature and bt_payload. */
async function buildBody(
	kind: string,
	publicKey = PUBLIC_KEY,
	privateKey = PRIVATE_KEY,
	extra = "",
): Promise<string> {
	const btPayload = buildPayload(kind, extra);
	const btSignature = await buildSignature(publicKey, privateKey, btPayload);
	return new URLSearchParams({
		bt_signature: btSignature,
		bt_payload: btPayload,
	}).toString();
}

function makeRequest(body: string): Request {
	return new Request("https://example.com/api/braintree/webhook", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
}

async function callWebhook(
	handler: ReturnType<typeof createBraintreeWebhook>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({ request, context }) as Promise<Response>;
}

/** Create a mock module context with a real payments controller and spy events. */
function createTestContext() {
	const data = createMockDataService();
	const payments = createPaymentController(data);
	const events = { emit: vi.fn() };
	return { data, payments, context: { controllers: { payments }, events } };
}

/** Seed a payment intent with a specific providerIntentId. */
async function seedIntent(
	data: ReturnType<typeof createMockDataService>,
	payments: ReturnType<typeof createPaymentController>,
	providerIntentId: string,
	amount = 2000,
	status = "pending",
) {
	const intent = await payments.createIntent({ amount });
	await data.upsert("paymentIntent", intent.id, {
		...intent,
		providerIntentId,
		status,
	});
	return intent;
}

const handler = createBraintreeWebhook({
	publicKey: PUBLIC_KEY,
	privateKey: PRIVATE_KEY,
});

// ── Valid signatures ──────────────────────────────────────────────────────────

describe("createBraintreeWebhook — valid signature", () => {
	it("accepts a correctly signed webhook and returns the kind", async () => {
		const body = await buildBody("subscription_charged_successfully");
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; kind: string };
		expect(json.received).toBe(true);
		expect(json.kind).toBe("subscription_charged_successfully");
	});

	it("handles different event kinds", async () => {
		const body = await buildBody("transaction_settled");
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; kind: string };
		expect(json.kind).toBe("transaction_settled");
	});
});

// ── Missing fields ────────────────────────────────────────────────────────────

describe("createBraintreeWebhook — missing fields", () => {
	it("returns 400 when bt_signature is missing", async () => {
		const btPayload = buildPayload("subscription_charged_successfully");
		const body = new URLSearchParams({ bt_payload: btPayload }).toString();
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(400);
	});

	it("returns 400 when bt_payload is missing", async () => {
		const btSignature = `${PUBLIC_KEY}|somehex`;
		const body = new URLSearchParams({ bt_signature: btSignature }).toString();
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(400);
	});

	it("returns 400 for an empty body", async () => {
		const res = await callWebhook(handler, makeRequest(""));
		expect(res.status).toBe(400);
	});
});

// ── Invalid signatures ────────────────────────────────────────────────────────

describe("createBraintreeWebhook — invalid signature", () => {
	it("rejects a tampered payload", async () => {
		const btPayload = buildPayload("subscription_charged_successfully");
		const sig = await buildSignature(PUBLIC_KEY, PRIVATE_KEY, btPayload);
		// Tamper the payload after signing
		const tamperedPayload = buildPayload("transaction_disbursed");
		const body = new URLSearchParams({
			bt_signature: sig,
			bt_payload: tamperedPayload,
		}).toString();
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(401);
	});

	it("rejects a wrong private key", async () => {
		const body = await buildBody(
			"subscription_charged_successfully",
			PUBLIC_KEY,
			"wrong-private-key",
		);
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(401);
	});

	it("rejects a wrong public key prefix in signature", async () => {
		const body = await buildBody(
			"subscription_charged_successfully",
			"wrong-public-key",
			PRIVATE_KEY,
		);
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(401);
	});

	it("rejects a malformed bt_signature (no pipe separator)", async () => {
		const btPayload = buildPayload("subscription_charged_successfully");
		const body = new URLSearchParams({
			bt_signature: "no-pipe-here",
			bt_payload: btPayload,
		}).toString();
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(401);
	});
});

// ── Malformed payload ─────────────────────────────────────────────────────────

describe("createBraintreeWebhook — malformed payload", () => {
	it("returns 400 when bt_payload is not valid base64 XML", async () => {
		const btPayload = btoa("<notification><no-kind-here/></notification>");
		const sig = await buildSignature(PUBLIC_KEY, PRIVATE_KEY, btPayload);
		const body = new URLSearchParams({
			bt_signature: sig,
			bt_payload: btPayload,
		}).toString();
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(400);
	});
});

// ── Event handling ────────────────────────────────────────────────────────────

describe("createBraintreeWebhook — event handling", () => {
	it("handles transaction_settled and emits payment.completed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "BT_TX_123");

		const extra = "<id>BT_TX_123</id><amount>20.00</amount>";
		const body = await buildBody(
			"transaction_settled",
			PUBLIC_KEY,
			PRIVATE_KEY,
			extra,
		);

		const res = await callWebhook(handler, makeRequest(body), context);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { handled: boolean; kind: string };
		expect(json.handled).toBe(true);
		expect(json.kind).toBe("transaction_settled");

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("succeeded");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.completed",
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("handles transaction_settlement_declined and emits payment.failed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "BT_FAIL_TX");

		const extra = "<id>BT_FAIL_TX</id>";
		const body = await buildBody(
			"transaction_settlement_declined",
			PUBLIC_KEY,
			PRIVATE_KEY,
			extra,
		);

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("failed");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.failed",
			expect.anything(),
		);
	});

	it("handles refund notification (credit transaction) and emits payment.refunded", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(
			data,
			payments,
			"BT_REFUND_TX",
			3000,
			"succeeded",
		);

		const extra =
			"<id>BT_REFUND_TX</id><amount>30.00</amount><type>credit</type>";
		const body = await buildBody(
			"transaction_settled",
			PUBLIC_KEY,
			PRIVATE_KEY,
			extra,
		);

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("refunded");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.refunded",
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("returns unhandled for unknown Braintree event kinds", async () => {
		const { context } = createTestContext();
		const body = await buildBody("subscription_charged_successfully");

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});

	it("skips handling when no payments controller in context", async () => {
		const extra = "<id>BT_NO_CTX</id>";
		const body = await buildBody(
			"transaction_settled",
			PUBLIC_KEY,
			PRIVATE_KEY,
			extra,
		);

		const res = await callWebhook(handler, makeRequest(body));
		const json = (await res.json()) as {
			received: boolean;
			handled?: boolean;
			kind: string;
		};
		expect(json.received).toBe(true);
		expect(json.kind).toBe("transaction_settled");
		expect(json.handled).toBeUndefined();
	});
});
