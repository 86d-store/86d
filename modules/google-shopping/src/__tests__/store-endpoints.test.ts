import { describe, expect, it } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/google-shopping/webhooks", {
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

describe("createStoreEndpoints — google-shopping", () => {
	it("returns an endpoint map with the /google-shopping/webhooks path", () => {
		const endpoints = createStoreEndpoints();
		expect(endpoints).toHaveProperty("/google-shopping/webhooks");
		expect(endpoints["/google-shopping/webhooks"]).toBeDefined();
	});

	it("returns the same shape when webhookSecret is provided", () => {
		const endpoints = createStoreEndpoints("test-webhook-secret");
		expect(endpoints).toHaveProperty("/google-shopping/webhooks");
	});

	it("endpoint refuses an unverifiable body before parsing it", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest("not-json");
		const res = await callEndpoint(endpoints, "/google-shopping/webhooks", req);
		expect(res.status).toBe(503);
	});

	it("endpoint refuses an unverifiable payload before validating it", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(JSON.stringify({ id: "evt_123" }));
		const res = await callEndpoint(endpoints, "/google-shopping/webhooks", req);
		expect(res.status).toBe(503);
	});

	it("endpoint returns 401 when webhookSecret is set but signature header is missing", async () => {
		const endpoints = createStoreEndpoints("test-webhook-secret");
		const req = makeRequest(
			JSON.stringify({ type: "order.created", payload: {} }),
		);
		const res = await callEndpoint(endpoints, "/google-shopping/webhooks", req);
		expect(res.status).toBe(401);
	});

	it("endpoint refuses events when no verification material is configured", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(
			JSON.stringify({ type: "unknown.event", payload: {} }),
		);
		const res = await callEndpoint(endpoints, "/google-shopping/webhooks", req);
		expect(res.status).toBe(503);
		const json = (await res.json()) as { error: string };
		expect(json.error).toMatch(/not configured/i);
	});
});
