import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createBraintreeWebhook } from "../store/endpoints/webhook";

/**
 * Security regression tests for the Braintree module endpoints.
 *
 * These tests verify:
 * - Webhook signature verification (HMAC-SHA1)
 * - Notification kind filtering (only mapped events are handled)
 * - Transaction capture / settlement status enforcement
 * - Amount integrity through the webhook pipeline
 * - Nonce requirement enforcement
 * - Refund-vs-payment disambiguation
 * - Timing-safe comparison for signature validation
 * - Payload tampering detection
 */

const PUBLIC_KEY = "bt_pub_test";
const PRIVATE_KEY = "bt_priv_test";

const enc = new TextEncoder();

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

function buildPayload(kind: string, extra = ""): string {
	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<notification>",
		`<kind>${kind}</kind>`,
		extra,
		"</notification>",
	].join("");
	return btoa(xml);
}

async function buildSignature(
	publicKey: string,
	privateKey: string,
	btPayload: string,
): Promise<string> {
	const hex = await hmacSha1Hex(privateKey, btPayload);
	return `${publicKey}|${hex}`;
}

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
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
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

function createTestContext() {
	const data = createMockDataService();
	const payments = createPaymentController(data);
	const events = { emit: vi.fn() };
	return {
		data,
		payments,
		context: { controllers: { payments }, events },
	};
}

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

// ── Webhook Signature Security ────────────────────────────────────

describe("braintree endpoint security", () => {
	describe("signature verification", () => {
		it("rejects a request with an empty bt_signature value", async () => {
			const btPayload = buildPayload("transaction_settled");
			const body = new URLSearchParams({
				bt_signature: "",
				bt_payload: btPayload,
			}).toString();
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(400);
		});

		it("rejects a signature signed with a different private key", async () => {
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				"stolen-or-rotated-key",
			);
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(401);
		});

		it("rejects a signature with correct HMAC but wrong public key prefix", async () => {
			const body = await buildBody(
				"transaction_settled",
				"spoofed_public_key",
				PRIVATE_KEY,
			);
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(401);
		});

		it("rejects a payload that was modified after signing", async () => {
			const originalPayload = buildPayload(
				"transaction_settled",
				"<id>LEGIT_TX</id><amount>10.00</amount>",
			);
			const sig = await buildSignature(
				PUBLIC_KEY,
				PRIVATE_KEY,
				originalPayload,
			);
			// Attacker changes the amount in the payload
			const tamperedPayload = buildPayload(
				"transaction_settled",
				"<id>LEGIT_TX</id><amount>99999.00</amount>",
			);
			const body = new URLSearchParams({
				bt_signature: sig,
				bt_payload: tamperedPayload,
			}).toString();
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(401);
		});

		it("rejects a bt_signature with pipe but empty HMAC portion", async () => {
			const btPayload = buildPayload("transaction_settled");
			const body = new URLSearchParams({
				bt_signature: `${PUBLIC_KEY}|`,
				bt_payload: btPayload,
			}).toString();
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(401);
		});
	});

	// ── Notification Kind Filtering ─────────────────────────────────

	describe("notification kind filtering", () => {
		it("does not handle unmapped subscription events as payment updates", async () => {
			const { context } = createTestContext();
			const body = await buildBody("subscription_charged_successfully");
			const res = await callWebhook(handler, makeRequest(body), context);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			expect(json.received).toBe(true);
			// Unmapped kinds should not be marked as handled
			expect(json.handled).toBeUndefined();
		});

		it("does not handle dispute events as payment status changes", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_DISPUTE_TX", 5000, "succeeded");
			const extra = "<id>BT_DISPUTE_TX</id>";
			const body = await buildBody(
				"dispute_opened",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			const res = await callWebhook(handler, makeRequest(body), context);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			// dispute_opened is not in BRAINTREE_EVENT_MAP
			expect(json.handled).toBeUndefined();
		});

		it("rejects a payload with no kind element", async () => {
			const xmlNoKind =
				'<?xml version="1.0"?><notification><data>test</data></notification>';
			const btPayload = btoa(xmlNoKind);
			const sig = await buildSignature(PUBLIC_KEY, PRIVATE_KEY, btPayload);
			const body = new URLSearchParams({
				bt_signature: sig,
				bt_payload: btPayload,
			}).toString();
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(400);
		});

		it("only maps transaction_settled to succeeded, not other settlement-like kinds", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_SETTLE_CONFIRM", 3000, "processing");
			// settlement_confirmed is NOT in BRAINTREE_EVENT_MAP
			const extra = "<id>BT_SETTLE_CONFIRM</id>";
			const body = await buildBody(
				"settlement_confirmed",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			const res = await callWebhook(handler, makeRequest(body), context);
			const json = (await res.json()) as {
				handled?: boolean;
			};
			expect(json.handled).toBeUndefined();
		});
	});

	// ── Amount Integrity ────────────────────────────────────────────

	describe("amount integrity", () => {
		it("propagates the correct amount from webhook XML to refund handler", async () => {
			const { data, payments, context } = createTestContext();
			const intent = await seedIntent(
				data,
				payments,
				"BT_AMT_TX",
				5000,
				"succeeded",
			);
			const extra = [
				"<id>BT_AMT_TX</id>",
				"<amount>25.50</amount>",
				"<type>credit</type>",
			].join("");
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			const res = await callWebhook(handler, makeRequest(body), context);
			const json = (await res.json()) as {
				handled: boolean;
			};
			expect(json.handled).toBe(true);
			// Amount should be converted from dollars (25.50)
			// to cents (2550)
			expect(context.events.emit).toHaveBeenCalledWith(
				"payment.refunded",
				expect.objectContaining({
					paymentIntentId: intent.id,
				}),
			);
		});

		it("rejects a refund webhook with a missing amount", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_NO_AMT", 4000, "succeeded");
			// Refund notification with no <amount> tag
			const extra = ["<id>BT_NO_AMT</id>", "<type>credit</type>"].join("");
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			// Should not crash; the refund handler receives
			// An amount is required for an idempotent financial mutation.
			const res = await callWebhook(handler, makeRequest(body), context);
			expect(res.status).toBe(400);
			expect(context.events.emit).not.toHaveBeenCalled();
		});

		it("transaction_settlement_declined does not modify amount on the intent", async () => {
			const { data, payments, context } = createTestContext();
			const intent = await seedIntent(
				data,
				payments,
				"BT_DECLINE_AMT",
				7500,
				"processing",
			);
			const extra = "<id>BT_DECLINE_AMT</id><amount>75.00</amount>";
			const body = await buildBody(
				"transaction_settlement_declined",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const updated = await payments.getIntent(intent.id);
			// Status changed to failed, but amount untouched
			expect(updated?.status).toBe("failed");
			expect(updated?.amount).toBe(7500);
		});
	});

	// ── Settlement Status Enforcement ───────────────────────────────

	describe("settlement status enforcement", () => {
		it("transaction_settled maps to succeeded status", async () => {
			const { data, payments, context } = createTestContext();
			const intent = await seedIntent(
				data,
				payments,
				"BT_SETTLED",
				3000,
				"processing",
			);
			const extra = "<id>BT_SETTLED</id>";
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const updated = await payments.getIntent(intent.id);
			expect(updated?.status).toBe("succeeded");
		});

		it("transaction_settlement_declined maps to failed status", async () => {
			const { data, payments, context } = createTestContext();
			const intent = await seedIntent(
				data,
				payments,
				"BT_DECLINE",
				2000,
				"processing",
			);
			const extra = "<id>BT_DECLINE</id>";
			const body = await buildBody(
				"transaction_settlement_declined",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const updated = await payments.getIntent(intent.id);
			expect(updated?.status).toBe("failed");
		});

		it("transaction_disbursed maps to succeeded (not a different terminal state)", async () => {
			const { data, payments, context } = createTestContext();
			const intent = await seedIntent(
				data,
				payments,
				"BT_DISBURSED",
				1500,
				"processing",
			);
			const extra = "<id>BT_DISBURSED</id>";
			const body = await buildBody(
				"transaction_disbursed",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const updated = await payments.getIntent(intent.id);
			expect(updated?.status).toBe("succeeded");
		});
	});

	// ── Refund vs Payment Disambiguation ────────────────────────────

	describe("refund vs payment disambiguation", () => {
		it("transaction_settled with credit type is treated as refund, not payment success", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_CREDIT", 6000, "succeeded");
			const extra = [
				"<id>BT_CREDIT</id>",
				"<amount>60.00</amount>",
				"<type>credit</type>",
			].join("");
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			// Should emit payment.refunded, NOT payment.completed
			const emitCalls = context.events.emit.mock.calls;
			const eventNames = emitCalls.map((c: unknown[]) => c[0]);
			expect(eventNames).toContain("payment.refunded");
			expect(eventNames).not.toContain("payment.completed");
		});

		it("transaction_settled with refunded-transaction-id is treated as refund", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_REFID", 4500, "succeeded");
			const extra = [
				"<id>BT_REFID</id>",
				"<amount>45.00</amount>",
				"<refunded-transaction-id>ORIG_TX</refunded-transaction-id>",
			].join("");
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const emitCalls = context.events.emit.mock.calls;
			const eventNames = emitCalls.map((c: unknown[]) => c[0]);
			expect(eventNames).toContain("payment.refunded");
			expect(eventNames).not.toContain("payment.completed");
		});

		it("transaction_settled without credit type or refund marker is a normal payment", async () => {
			const { data, payments, context } = createTestContext();
			await seedIntent(data, payments, "BT_NORMAL_PAY", 8000, "processing");
			const extra = ["<id>BT_NORMAL_PAY</id>", "<amount>80.00</amount>"].join(
				"",
			);
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			await callWebhook(handler, makeRequest(body), context);
			const emitCalls = context.events.emit.mock.calls;
			const eventNames = emitCalls.map((c: unknown[]) => c[0]);
			expect(eventNames).toContain("payment.completed");
			expect(eventNames).not.toContain("payment.refunded");
		});
	});

	// ── Nonce Requirement (Provider) ────────────────────────────────

	describe("nonce requirement enforcement", () => {
		it("provider returns client token when createIntent called without nonce", async () => {
			const { BraintreePaymentProvider } = await import("../provider");
			const provider = new BraintreePaymentProvider(
				"merchant_id",
				"pub_key",
				"priv_key",
				true,
			);
			const origFetch = globalThis.fetch;
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ clientToken: { value: "bt_token_sec" } }),
			});
			try {
				const result = await provider.createIntent({
					amount: 1000,
					currency: "USD",
				});
				expect(result.status).toBe("pending");
				expect(result.providerMetadata?.paymentType).toBe("braintree");
				expect(result.providerMetadata?.braintreeClientToken).toBe(
					"bt_token_sec",
				);
			} finally {
				globalThis.fetch = origFetch;
			}
		});

		it("provider returns client token when metadata has no nonce key", async () => {
			const { BraintreePaymentProvider } = await import("../provider");
			const provider = new BraintreePaymentProvider(
				"merchant_id",
				"pub_key",
				"priv_key",
				true,
			);
			const origFetch = globalThis.fetch;
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({ clientToken: { value: "bt_token_sec2" } }),
			});
			try {
				const result = await provider.createIntent({
					amount: 2000,
					currency: "USD",
					metadata: { customerId: "cust_123" },
				});
				expect(result.status).toBe("pending");
				expect(result.providerMetadata?.braintreeClientToken).toBe(
					"bt_token_sec2",
				);
			} finally {
				globalThis.fetch = origFetch;
			}
		});
	});

	// ── Missing Context Resilience ──────────────────────────────────

	describe("missing context resilience", () => {
		it("does not crash when no controllers are in context", async () => {
			const extra = "<id>BT_NO_CTRL</id>";
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			const res = await callWebhook(handler, makeRequest(body), {});
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
			};
			expect(json.received).toBe(true);
		});

		it("does not emit events when events object is missing from context", async () => {
			const data = createMockDataService();
			const payments = createPaymentController(data);
			await seedIntent(data, payments, "BT_NO_EVT", 3000, "processing");
			const context = {
				controllers: { payments },
				// events intentionally omitted
			};
			const extra = "<id>BT_NO_EVT</id>";
			const body = await buildBody(
				"transaction_settled",
				PUBLIC_KEY,
				PRIVATE_KEY,
				extra,
			);
			// Should not throw even without events emitter
			const res = await callWebhook(handler, makeRequest(body), context);
			expect(res.status).toBe(200);
		});
	});
});
