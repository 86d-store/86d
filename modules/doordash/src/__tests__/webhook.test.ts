import { describe, expect, it, vi } from "vitest";
import { createDoordashWebhook } from "../store/endpoints/webhook";

async function callWebhook(
	endpoint: ReturnType<typeof createDoordashWebhook>,
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

describe("DoorDash webhook containment", () => {
	it("explicitly rejects the undocumented HMAC ingress without side effects", async () => {
		const listDeliveries = vi.fn();
		const emit = vi.fn();
		const request = new Request(
			"https://store.example.com/api/doordash/webhook",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-doordash-signature": "invented-signature",
				},
				body: JSON.stringify({
					external_delivery_id: "delivery-1",
					event_name: "DELIVERY_CANCELLED",
				}),
			},
		);

		const response = await callWebhook(
			createDoordashWebhook("api-jwt-signing-secret"),
			request,
			{
				controllers: { doordash: { listDeliveries } },
				events: { emit },
			},
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: expect.stringMatching(/disabled|unavailable/i),
		});
		expect(listDeliveries).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});
});
