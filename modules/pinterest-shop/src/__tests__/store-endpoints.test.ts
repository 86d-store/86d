import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../provider";

/**
 * Store endpoint integration tests for the pinterest-shop module.
 *
 * These tests simulate the business logic executed by the store-facing endpoint:
 *
 * 1. webhooks (/pinterest-shop/webhooks): receives inbound Pinterest platform
 *    events. When a webhook secret is configured the handler verifies the
 *    HMAC-SHA256 signature in the x-pinterest-signature header. Unverified
 *    requests are rejected; verified requests (or requests without a secret
 *    configured) are acknowledged.
 */

// ── Helpers ────────────────────────────────────────────────────────────

function computeSignature(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

function simulateWebhook(
	body: { type: string; payload: Record<string, unknown> },
	opts: { webhookSecret?: string; signatureHeader?: string } = {},
) {
	const rawBody = JSON.stringify(body);

	if (opts.webhookSecret) {
		const signature = opts.signatureHeader ?? "";
		if (!verifyWebhookSignature(rawBody, signature, opts.webhookSecret)) {
			return { received: false, error: "Invalid signature" };
		}
	}

	return { received: true, type: body.type };
}

// ── Tests: webhooks — no secret configured ─────────────────────────────

describe("store endpoint: webhooks (no secret configured)", () => {
	it("acknowledges any event without signature verification", () => {
		const result = simulateWebhook({
			type: "catalog.feed.updated",
			payload: { feedId: "feed_001" },
		});

		expect(result.received).toBe(true);
		expect((result as { type?: string }).type).toBe("catalog.feed.updated");
	});

	it("passes through order events without signature check", () => {
		const result = simulateWebhook({
			type: "conversion.tag.dispatched",
			payload: { conversionId: "conv_abc", value: 4999 },
		});

		expect(result.received).toBe(true);
	});

	it("passes through unknown event types", () => {
		const result = simulateWebhook({
			type: "unknown.pinterest.event",
			payload: {},
		});

		expect(result.received).toBe(true);
	});
});

// ── Tests: webhooks — with secret configured ───────────────────────────

describe("store endpoint: webhooks (with secret configured)", () => {
	const SECRET = "test-pinterest-webhook-secret";

	it("accepts a request with a valid HMAC-SHA256 signature", () => {
		const body = {
			type: "catalog.feed.updated",
			payload: { feedId: "feed_valid_001" },
		};
		const rawBody = JSON.stringify(body);
		const signature = computeSignature(rawBody, SECRET);

		const result = simulateWebhook(body, {
			webhookSecret: SECRET,
			signatureHeader: signature,
		});

		expect(result.received).toBe(true);
		expect((result as { type?: string }).type).toBe("catalog.feed.updated");
	});

	it("rejects a request with an invalid signature", () => {
		const body = {
			type: "order.created",
			payload: { orderId: "pin-order-001" },
		};

		const result = simulateWebhook(body, {
			webhookSecret: SECRET,
			signatureHeader: "deadbeefdeadbeef",
		});

		expect(result.received).toBe(false);
		expect((result as { error?: string }).error).toBe("Invalid signature");
	});

	it("rejects a request with an empty signature", () => {
		const body = {
			type: "catalog.updated",
			payload: {},
		};

		const result = simulateWebhook(body, {
			webhookSecret: SECRET,
			signatureHeader: "",
		});

		expect(result.received).toBe(false);
	});

	it("rejects a request with a tampered payload", () => {
		const body = {
			type: "catalog.feed.updated",
			payload: { feedId: "feed_tampered" },
		};
		const rawBody = JSON.stringify(body);
		const signature = computeSignature(rawBody, SECRET);

		// Tamper: change the feedId in the body that gets re-serialized
		const tamperedBody = {
			type: "catalog.feed.updated",
			payload: { feedId: "INJECTED_VALUE" },
		};

		const result = simulateWebhook(tamperedBody, {
			webhookSecret: SECRET,
			signatureHeader: signature,
		});

		expect(result.received).toBe(false);
	});

	it("accepts a valid signature for a different event type", () => {
		const body = {
			type: "ad.campaign.updated",
			payload: { campaignId: "campaign_xyz", status: "active" },
		};
		const rawBody = JSON.stringify(body);
		const signature = computeSignature(rawBody, SECRET);

		const result = simulateWebhook(body, {
			webhookSecret: SECRET,
			signatureHeader: signature,
		});

		expect(result.received).toBe(true);
	});

	it("handles a different secret producing a different signature", () => {
		const body = {
			type: "order.shipped",
			payload: { orderId: "pin-ship-001" },
		};
		const rawBody = JSON.stringify(body);
		// Sign with one secret, verify with another
		const signatureFromOtherSecret = computeSignature(rawBody, "other-secret");

		const result = simulateWebhook(body, {
			webhookSecret: SECRET,
			signatureHeader: signatureFromOtherSecret,
		});

		expect(result.received).toBe(false);
	});
});

// ── Tests: verifyWebhookSignature directly ─────────────────────────────

describe("verifyWebhookSignature", () => {
	it("returns true for a correctly signed payload", () => {
		const payload = '{"type":"test","payload":{}}';
		const secret = "my-secret";
		const signature = computeSignature(payload, secret);

		expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
	});

	it("returns false for a wrong signature", () => {
		const payload = '{"type":"test","payload":{}}';
		expect(verifyWebhookSignature(payload, "wrongsignature", "my-secret")).toBe(
			false,
		);
	});

	it("returns false for an empty signature", () => {
		const payload = '{"type":"test","payload":{}}';
		expect(verifyWebhookSignature(payload, "", "my-secret")).toBe(false);
	});

	it("returns false when the payload has been altered", () => {
		const originalPayload = '{"type":"original","payload":{}}';
		const alteredPayload = '{"type":"altered","payload":{}}';
		const secret = "my-secret";
		const signature = computeSignature(originalPayload, secret);

		expect(verifyWebhookSignature(alteredPayload, signature, secret)).toBe(
			false,
		);
	});
});
