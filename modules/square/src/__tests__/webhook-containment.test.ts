import { describe, expect, it, vi } from "vitest";
import { createSquareWebhook } from "../store/endpoints/webhook";

const signatureKey = "square-signature-key";
const notificationUrl = "https://store.test/api/store/square/webhook";
const enc = new TextEncoder();

async function signature(body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(signatureKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const bytes = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(notificationUrl + body),
	);
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function request(body: string, squareSignature?: string): Request {
	const headers = new Headers({ "content-type": "application/json" });
	if (squareSignature !== undefined) {
		headers.set("x-square-hmacsha256-signature", squareSignature);
	}
	return new Request(notificationUrl, { method: "POST", headers, body });
}

function effects() {
	return {
		payments: {
			handleWebhookEvent: vi.fn().mockResolvedValue({
				id: "intent_1",
				amount: 1000,
				currency: "USD",
			}),
			handleWebhookRefund: vi.fn(),
		},
		events: { emit: vi.fn() },
	};
}

async function invoke(
	handler: ReturnType<typeof createSquareWebhook>,
	req: Request,
	fx = effects(),
): Promise<{ response: Response; fx: ReturnType<typeof effects> }> {
	const endpoint = handler as unknown as Record<string, unknown>;
	const fn =
		typeof endpoint.handler === "function" ? endpoint.handler : handler;
	const response = (await (fn as CallableFunction)({
		request: req,
		context: { controllers: { payments: fx.payments }, events: fx.events },
	})) as Response;
	return { response, fx };
}

const eventBody = JSON.stringify({
	event_id: "square-event-1",
	type: "payment.completed",
	data: { object: { payment: { id: "square-payment-1" } } },
});

describe("Square webhook containment", () => {
	it.each([{ webhookSignatureKey: signatureKey }, { notificationUrl }])(
		"fails closed with incomplete verification config",
		async (options) => {
			const { response, fx } = await invoke(
				createSquareWebhook(options),
				request(eventBody),
			);
			expect(response.status).toBe(503);
			expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
			expect(fx.events.emit).not.toHaveBeenCalled();
		},
	);

	it("rejects an invalid signature before any effects", async () => {
		const { response, fx } = await invoke(
			createSquareWebhook({
				webhookSignatureKey: signatureKey,
				notificationUrl,
			}),
			request(eventBody, "invalid"),
		);
		expect(response.status).toBe(401);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("accepts the official URL-plus-body HMAC format", async () => {
		const { response } = await invoke(
			createSquareWebhook({
				webhookSignatureKey: signatureKey,
				notificationUrl,
			}),
			request(eventBody, await signature(eventBody)),
		);
		expect(response.status).toBe(200);
	});

	it("rejects a refund without a stable provider refund ID", async () => {
		const body = JSON.stringify({
			event_id: "square-refund-without-id",
			type: "refund.completed",
			data: {
				object: {
					refund: {
						payment_id: "square-payment-1",
						amount_money: { amount: 1000 },
					},
				},
			},
		});
		const { response, fx } = await invoke(
			createSquareWebhook({
				webhookSignatureKey: signatureKey,
				notificationUrl,
			}),
			request(body, await signature(body)),
		);
		expect(response.status).toBe(400);
		expect(fx.payments.handleWebhookRefund).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("suppresses repeated effects for a duplicate event", async () => {
		const handler = createSquareWebhook({
			webhookSignatureKey: signatureKey,
			notificationUrl,
		});
		const fx = effects();
		const signed = await signature(eventBody);
		const first = await invoke(handler, request(eventBody, signed), fx);
		const second = await invoke(handler, request(eventBody, signed), fx);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
		expect(await second.response.json()).toMatchObject({ duplicate: true });
		expect(fx.payments.handleWebhookEvent).toHaveBeenCalledTimes(1);
		expect(fx.events.emit).toHaveBeenCalledTimes(1);
	});
});
