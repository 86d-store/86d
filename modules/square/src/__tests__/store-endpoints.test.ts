import { describe, expect, it } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/square/webhook", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
}

async function callEndpoint(
	endpoints: ReturnType<typeof createStoreEndpoints>,
	path: keyof ReturnType<typeof createStoreEndpoints>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const handler = endpoints[path] as unknown as Record<string, unknown>;
	const fn = typeof handler.handler === "function" ? handler.handler : handler;
	return (fn as CallableFunction)({ request, context }) as Promise<Response>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

describe("createStoreEndpoints — square", () => {
	it("returns an endpoint map with the /square/webhook path", () => {
		const endpoints = createStoreEndpoints();
		expect(endpoints).toHaveProperty("/square/webhook");
		expect(endpoints["/square/webhook"]).toBeDefined();
	});

	it("returns the same shape when webhookSignatureKey is provided", () => {
		const endpoints = createStoreEndpoints({
			webhookSignatureKey: "test-sig-key",
			webhookNotificationUrl: "https://example.com/api/square/webhook",
		});
		expect(endpoints).toHaveProperty("/square/webhook");
	});

	it("endpoint fails closed before parsing invalid JSON", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest("not-json");
		const res = await callEndpoint(endpoints, "/square/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint fails closed before checking event type", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(JSON.stringify({ id: "evt_123" }));
		const res = await callEndpoint(endpoints, "/square/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint returns 401 when signature key is set but header is missing", async () => {
		const endpoints = createStoreEndpoints({
			webhookSignatureKey: "test-sig-key",
			webhookNotificationUrl: "https://example.com/api/square/webhook",
		});
		const req = makeRequest(
			JSON.stringify({ type: "payment.created", data: { object: {} } }),
		);
		const res = await callEndpoint(endpoints, "/square/webhook", req);
		expect(res.status).toBe(401);
	});

	it("endpoint rejects events when no signature key is configured", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(
			JSON.stringify({ type: "catalog.version.updated", data: { object: {} } }),
		);
		const res = await callEndpoint(endpoints, "/square/webhook", req);
		expect(res.status).toBe(503);
	});
});
