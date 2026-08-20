import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createAutomationsController } from "../service-impl";
import { createWebhookEndpoint } from "../store/endpoints/webhook";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callWebhook(
	handler: ReturnType<typeof createWebhookEndpoint>,
	request: Request,
	context?: Record<string, unknown>,
): Promise<Response> {
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	const body = request.headers.get("Content-Type")?.includes("json")
		? await request.json().catch(() => null)
		: null;
	return (fn as CallableFunction)({
		request,
		body,
		context,
	}) as Promise<Response>;
}

function createTestContext() {
	const data = createMockDataService();
	const controller = createAutomationsController(data);
	return {
		data,
		controller,
		context: { controllers: { automations: controller } },
	};
}

function makeWebhookRequest(
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://store.example.com/api/automations/webhooks", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("automations webhook endpoint — no secret configured", () => {
	const endpoint = createWebhookEndpoint();

	it("refuses every event, because it cannot authenticate the caller", async () => {
		const { context } = createTestContext();
		const request = makeWebhookRequest({
			eventType: "order.placed",
			payload: { orderId: "ord-1" },
		});

		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.error).toMatch(/not configured/i);
	});
});

describe("automations webhook endpoint — authenticated caller", () => {
	const AUTHED_SECRET = "test-webhook-secret-authed";
	const endpoint = createWebhookEndpoint({ webhookSecret: AUTHED_SECRET });

	function makeAuthedRequest(body: Record<string, unknown>): Request {
		return makeWebhookRequest(body, { "x-webhook-secret": AUTHED_SECRET });
	}

	it("accepts an authenticated event", async () => {
		const { context } = createTestContext();
		const request = makeAuthedRequest({
			eventType: "order.placed",
			payload: { orderId: "ord-1" },
		});

		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.eventType).toBe("order.placed");
		expect(body.triggered).toBe(0);
		expect(body.executions).toEqual([]);
	});

	it("triggers matching active automations", async () => {
		const { context, controller } = createTestContext();

		// Create an active automation matching order.placed
		const automation = await controller.create({
			name: "Order Placed Handler",
			triggerEvent: "order.placed",
			actions: [{ type: "log", config: {} }],
			status: "active",
		});

		const request = makeAuthedRequest({
			eventType: "order.placed",
			payload: { orderId: "ord-1" },
		});

		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.triggered).toBe(1);
		expect(body.executions).toHaveLength(1);
		expect(body.executions[0].automationId).toBe(automation.id);
		expect(body.executions[0].status).toBeDefined();
	});

	it("does not trigger draft automations", async () => {
		const { context, controller } = createTestContext();

		// Create a draft automation — should not trigger
		await controller.create({
			name: "Draft Handler",
			triggerEvent: "order.placed",
			actions: [{ type: "log", config: {} }],
			status: "draft",
		});

		const request = makeAuthedRequest({
			eventType: "order.placed",
			payload: { orderId: "ord-2" },
		});

		const response = await callWebhook(endpoint, request, context);

		const body = await response.json();
		expect(body.triggered).toBe(0);
	});

	it("handles missing payload gracefully (defaults to {})", async () => {
		const { context } = createTestContext();
		const request = makeAuthedRequest({ eventType: "product.created" });

		const response = await callWebhook(endpoint, request, context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.received).toBe(true);
		expect(body.eventType).toBe("product.created");
	});

	it("returns executions array with id, automationId, and status fields", async () => {
		const { context, controller } = createTestContext();

		await controller.create({
			name: "Event Handler",
			triggerEvent: "custom.event",
			actions: [{ type: "log", config: {} }],
			status: "active",
		});

		const request = makeAuthedRequest({
			eventType: "custom.event",
			payload: { source: "zapier" },
		});

		const response = await callWebhook(endpoint, request, context);
		const body = await response.json();

		expect(body.executions[0]).toMatchObject({
			id: expect.any(String),
			automationId: expect.any(String),
			status: expect.any(String),
		});
	});
});

describe("automations webhook endpoint — with secret configured", () => {
	const SECRET = "test-webhook-secret-1234";
	const signedEndpoint = createWebhookEndpoint({ webhookSecret: SECRET });

	it("accepts requests with the correct secret", async () => {
		const { context } = createTestContext();
		const request = makeWebhookRequest(
			{ eventType: "order.placed", payload: {} },
			{ "x-webhook-secret": SECRET },
		);

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.received).toBe(true);
	});

	it("rejects requests with wrong secret", async () => {
		const { context } = createTestContext();
		const request = makeWebhookRequest(
			{ eventType: "order.placed" },
			{ "x-webhook-secret": "wrong-secret" },
		);

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Invalid webhook secret.");
	});

	it("rejects requests with missing secret header", async () => {
		const { context } = createTestContext();
		const request = makeWebhookRequest({ eventType: "order.placed" });

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Invalid webhook secret.");
	});

	it("rejects requests with empty secret header", async () => {
		const { context } = createTestContext();
		const request = makeWebhookRequest(
			{ eventType: "order.placed" },
			{ "x-webhook-secret": "" },
		);

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(401);
	});

	it("triggers automations after successful auth", async () => {
		const { context, controller } = createTestContext();

		await controller.create({
			name: "Zapier Handler",
			triggerEvent: "zapier.event",
			actions: [{ type: "log", config: {} }],
			status: "active",
		});

		const request = makeWebhookRequest(
			{ eventType: "zapier.event", payload: { source: "zapier" } },
			{ "x-webhook-secret": SECRET },
		);

		const response = await callWebhook(signedEndpoint, request, context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.triggered).toBe(1);
	});
});
