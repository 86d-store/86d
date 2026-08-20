import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoreEndpointsWithRates } from "../store/endpoints/routes";

const NOW = new Date("2026-08-13T12:00:00.000Z");

async function signedWebhookRequest(secret: string, body: string) {
	const timestamp = "Thu, 13 Aug 2026 12:00:00 +0000";
	const path = "/api/shipping/webhook";
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${timestamp}POST${path}${body}`),
	);
	const hex = Array.from(new Uint8Array(signature), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return new Request(`https://store.example.com${path}`, {
		method: "POST",
		headers: {
			"x-timestamp": timestamp,
			"x-path": path,
			"x-hmac-signature-v2": `hmac-sha256-hex=${hex}`,
		},
		body,
	});
}

afterEach(() => {
	vi.useRealTimers();
});

describe("shipping — module factory settings wiring", () => {
	it("includes the settings endpoint when EasyPost is not configured", async () => {
		const { default: shipping } = await import("../index");
		const mod = shipping({});

		expect(mod.endpoints?.admin).toHaveProperty("/admin/shipping/settings");
	});

	it("keeps store endpoints in no-credentials mode", async () => {
		const { default: shipping } = await import("../index");
		const mod = shipping({});

		expect(mod.endpoints?.store).toHaveProperty("/shipping/calculate");
	});

	it("does not activate EasyPost routes without webhook verification material", async () => {
		const { default: shipping } = await import("../index");
		const mod = shipping({ easypostApiKey: "EZTK_test" });

		expect(mod.endpoints?.store).not.toHaveProperty("/shipping/live-rates");
		expect(mod.endpoints?.store).not.toHaveProperty("/shipping/webhook");
	});

	it("exposes only the contained EasyPost webhook when credentials are complete", async () => {
		const { default: shipping } = await import("../index");
		const mod = shipping({
			easypostApiKey: "EZTK_test",
			easypostWebhookSecret: "webhook-secret",
		});

		expect(mod.endpoints?.store).not.toHaveProperty("/shipping/live-rates");
		expect(mod.endpoints?.store).toHaveProperty("/shipping/webhook");
	});

	it("authenticates EasyPost but requires a durable receipt before processing", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const secret = "webhook-secret";
		const body = JSON.stringify({ id: "event-1", object: "Event" });
		const endpoints = createStoreEndpointsWithRates({ webhookSecret: secret });
		const response = await endpoints["/shipping/webhook"]({
			request: await signedWebhookRequest(secret, body),
		});

		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("60");
		await expect(response.json()).resolves.toEqual({
			code: "SHIPPING_WEBHOOK_DURABILITY_REQUIRED",
			error: "EasyPost webhook processing requires a durable provider receipt.",
		});
	});
});
