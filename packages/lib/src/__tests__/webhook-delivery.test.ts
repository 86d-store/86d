import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildWebhookPayload,
	deliverWebhook,
	WEBHOOK_EVENT_TYPES,
} from "../webhook-delivery";

describe("WEBHOOK_EVENT_TYPES", () => {
	it("contains expected event types", () => {
		expect(WEBHOOK_EVENT_TYPES).toContain("order.placed");
		expect(WEBHOOK_EVENT_TYPES).toContain("order.shipped");
		expect(WEBHOOK_EVENT_TYPES).toContain("payment.failed");
		expect(WEBHOOK_EVENT_TYPES).toContain("customer.created");
		expect(WEBHOOK_EVENT_TYPES).toContain("inventory.low");
		expect(WEBHOOK_EVENT_TYPES).toContain("review.created");
	});

	it("has 13 event types", () => {
		expect(WEBHOOK_EVENT_TYPES.length).toBe(13);
	});
});

describe("buildWebhookPayload", () => {
	it("creates a payload with all required fields", () => {
		const payload = buildWebhookPayload("order.placed", "orders", {
			orderId: "123",
		});
		expect(payload.id).toBeTypeOf("string");
		expect(payload.id.length).toBeGreaterThan(0);
		expect(payload.type).toBe("order.placed");
		expect(payload.source).toBe("orders");
		expect(payload.data).toEqual({ orderId: "123" });
		expect(payload.timestamp).toBeTypeOf("string");
	});

	it("generates unique IDs for each payload", () => {
		const p1 = buildWebhookPayload("order.placed", "orders", {});
		const p2 = buildWebhookPayload("order.placed", "orders", {});
		expect(p1.id).not.toBe(p2.id);
	});

	it("sets timestamp as ISO string", () => {
		const payload = buildWebhookPayload("order.placed", "orders", {});
		expect(() => new Date(payload.timestamp)).not.toThrow();
		expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
	});
});

describe("deliverWebhook", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	it("sends POST with correct headers and body", async () => {
		const payload = buildWebhookPayload("order.placed", "orders", {
			id: "1",
		});
		const body = JSON.stringify(payload);
		const expectedSig = createHmac("sha256", "secret")
			.update(body)
			.digest("hex");

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve("OK"),
		});

		const result = await deliverWebhook(
			"https://example.com/webhook",
			"secret",
			payload,
		);

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://example.com/webhook",
			expect.objectContaining({
				method: "POST",
				body,
				headers: expect.objectContaining({
					"Content-Type": "application/json",
					"X-Webhook-Signature": expectedSig,
					"X-Webhook-Id": payload.id,
				}),
			}),
		);
		expect(result.success).toBe(true);
		expect(result.statusCode).toBe(200);
		expect(result.attempts).toBe(1);
	});

	it("returns failure for non-ok response", async () => {
		const payload = buildWebhookPayload("order.placed", "orders", {});
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Internal Server Error"),
		});

		const result = await deliverWebhook(
			"https://example.com/webhook",
			"secret",
			payload,
		);
		expect(result.success).toBe(false);
		expect(result.statusCode).toBe(500);
		expect(result.response).toBe("Internal Server Error");
	});

	it("handles network errors gracefully", async () => {
		const payload = buildWebhookPayload("order.placed", "orders", {});
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

		const result = await deliverWebhook(
			"https://example.com/webhook",
			"secret",
			payload,
		);
		expect(result.success).toBe(false);
		expect(result.statusCode).toBeNull();
		expect(result.response).toBeNull();
		expect(result.attempts).toBe(1);
	});

	it("truncates long responses to 1000 chars", async () => {
		const payload = buildWebhookPayload("order.placed", "orders", {});
		const longResponse = "x".repeat(2000);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve(longResponse),
		});

		const result = await deliverWebhook(
			"https://example.com/webhook",
			"secret",
			payload,
		);
		expect(result.response?.length).toBe(1000);
	});

	it("measures delivery duration", async () => {
		const payload = buildWebhookPayload("order.placed", "orders", {});
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve("OK"),
		});

		const result = await deliverWebhook(
			"https://example.com/webhook",
			"secret",
			payload,
		);
		expect(result.duration).toBeTypeOf("number");
		expect(result.duration).toBeGreaterThanOrEqual(0);
	});
});
