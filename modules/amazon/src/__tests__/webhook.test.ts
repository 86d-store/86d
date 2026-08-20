import { describe, expect, it, vi } from "vitest";
import { createAmazonWebhook } from "../store/endpoints/webhooks";

async function callWebhook(
	endpoint: ReturnType<typeof createAmazonWebhook>,
	request: Request,
	context: Record<string, unknown>,
): Promise<Response> {
	const candidate = endpoint as unknown as Record<string, unknown>;
	const handler =
		typeof candidate.handler === "function" ? candidate.handler : candidate;
	return (handler as CallableFunction)({
		request,
		context,
	}) as Promise<Response>;
}

describe("Amazon SP-API notification containment", () => {
	it("rejects the unsupported HTTP ingress before any mutation", async () => {
		const receiveOrder = vi.fn();
		const emit = vi.fn();
		const response = await callWebhook(
			createAmazonWebhook("custom-secret"),
			new Request("https://store.example.com/api/amazon/webhooks", {
				method: "POST",
				headers: { "x-amz-signature": "custom-signature" },
				body: JSON.stringify({
					type: "order.created",
					payload: { amazonOrderId: "AMZ-unsafe" },
				}),
			}),
			{
				controllers: { amazon: { receiveOrder } },
				events: { emit },
			},
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: expect.stringMatching(/disabled|unavailable/i),
		});
		expect(receiveOrder).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});
});
