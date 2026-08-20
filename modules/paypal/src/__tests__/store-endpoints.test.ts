import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/paypal/webhook", {
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

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Factory ───────────────────────────────────────────────────────────────────

describe("createStoreEndpoints — paypal", () => {
	it("returns an endpoint map with the /paypal/webhook path", () => {
		const endpoints = createStoreEndpoints({
			clientId: "test-client-id",
			clientSecret: "test-client-secret",
		});
		expect(endpoints).toHaveProperty("/paypal/webhook");
		expect(endpoints["/paypal/webhook"]).toBeDefined();
	});

	it("returns the same shape when webhookId is provided", () => {
		const endpoints = createStoreEndpoints({
			clientId: "test-client-id",
			clientSecret: "test-client-secret",
			webhookId: "WH-test-id",
		});
		expect(endpoints).toHaveProperty("/paypal/webhook");
	});

	it("endpoint fails closed before parsing invalid JSON", async () => {
		const endpoints = createStoreEndpoints({
			clientId: "c",
			clientSecret: "s",
		});
		const req = makeRequest("not-json");
		const res = await callEndpoint(endpoints, "/paypal/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint fails closed before checking event type", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
				status: 200,
			}),
		);
		const endpoints = createStoreEndpoints({
			clientId: "c",
			clientSecret: "s",
		});
		const req = makeRequest(JSON.stringify({ id: "EVT-001" }));
		const res = await callEndpoint(endpoints, "/paypal/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint rejects events when no webhookId is configured", async () => {
		const endpoints = createStoreEndpoints({
			clientId: "c",
			clientSecret: "s",
		});
		const req = makeRequest(
			JSON.stringify({ event_type: "UNKNOWN.EVENT", resource: {} }),
		);
		const res = await callEndpoint(endpoints, "/paypal/webhook", req);
		expect(res.status).toBe(503);
	});
});
