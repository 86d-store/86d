import { describe, expect, it } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/stripe/webhook", {
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

describe("createStoreEndpoints — stripe", () => {
	it("returns an endpoint map with the /stripe/webhook path", () => {
		const endpoints = createStoreEndpoints();
		expect(endpoints).toHaveProperty("/stripe/webhook");
		expect(endpoints["/stripe/webhook"]).toBeDefined();
	});

	it("returns the same shape when webhookSecret is provided", () => {
		const endpoints = createStoreEndpoints({ webhookSecret: "whsec_test" });
		expect(endpoints).toHaveProperty("/stripe/webhook");
	});

	it("endpoint fails closed before parsing invalid JSON", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest("not-json");
		const res = await callEndpoint(endpoints, "/stripe/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint fails closed before checking event type", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(JSON.stringify({ id: "evt_123" }));
		const res = await callEndpoint(endpoints, "/stripe/webhook", req);
		expect(res.status).toBe(503);
	});

	it("endpoint returns 401 when secret is set but signature header is missing", async () => {
		const endpoints = createStoreEndpoints({ webhookSecret: "whsec_test" });
		const req = makeRequest(
			JSON.stringify({ type: "payment_intent.succeeded" }),
		);
		const res = await callEndpoint(endpoints, "/stripe/webhook", req);
		expect(res.status).toBe(401);
	});

	it("endpoint rejects events when no secret is configured", async () => {
		const endpoints = createStoreEndpoints();
		const req = makeRequest(
			JSON.stringify({ type: "customer.created", data: { object: {} } }),
		);
		const res = await callEndpoint(endpoints, "/stripe/webhook", req);
		expect(res.status).toBe(503);
	});
});
