import { afterEach, describe, expect, it, vi } from "vitest";
import { createPayPalWebhook } from "../store/endpoints/webhook";

const options = {
	clientId: "client-id",
	clientSecret: "client-secret",
	webhookId: "WH-containment",
};

const paypalHeaders = {
	"paypal-auth-algo": "SHA256withRSA",
	"paypal-cert-url": "https://api.paypal.com/cert.pem",
	"paypal-transmission-id": "transmission-1",
	"paypal-transmission-sig": "signature",
	"paypal-transmission-time": "2026-08-11T12:00:00Z",
};

function request(body: string, headers = paypalHeaders): Request {
	return new Request("https://store.test/api/store/paypal/webhook", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body,
	});
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
	handler: ReturnType<typeof createPayPalWebhook>,
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

function mockVerification(status: "SUCCESS" | "FAILURE" = "SUCCESS") {
	return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const url = String(input);
		if (url.endsWith("/v1/oauth2/token")) {
			return Response.json({ access_token: "token" });
		}
		return Response.json({ verification_status: status });
	});
}

const eventBody = JSON.stringify({
	id: "WH-event-1",
	event_type: "PAYMENT.CAPTURE.COMPLETED",
	resource: { id: "PAYPAL-ORDER-1" },
});

afterEach(() => vi.restoreAllMocks());

describe("PayPal webhook containment", () => {
	it("fails closed without the webhook ID and performs no effects", async () => {
		const { response, fx } = await invoke(
			createPayPalWebhook({ clientId: "client", clientSecret: "secret" }),
			request(eventBody),
		);
		expect(response.status).toBe(503);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("rejects failed provider verification before any effects", async () => {
		mockVerification("FAILURE");
		const { response, fx } = await invoke(
			createPayPalWebhook(options),
			request(eventBody),
		);
		expect(response.status).toBe(401);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("embeds the exact raw event JSON in PayPal's verification request", async () => {
		const rawBody = ` {\n  "id":"WH-raw-1", "event_type" : "PAYMENT.CAPTURE.COMPLETED",\n  "resource": { "id": "PAYPAL-RAW-1" }\n} `;
		const fetchSpy = mockVerification();
		const { response } = await invoke(
			createPayPalWebhook(options),
			request(rawBody),
		);
		expect(response.status).toBe(200);
		const verificationCall = fetchSpy.mock.calls.find(([input]) =>
			String(input).includes("/verify-webhook-signature"),
		);
		const init = verificationCall?.[1] as RequestInit | undefined;
		expect(init?.body).toContain(`"webhook_event":${rawBody}`);
	});

	it("suppresses repeated effects for a duplicate event", async () => {
		mockVerification();
		const handler = createPayPalWebhook(options);
		const fx = effects();
		const first = await invoke(handler, request(eventBody), fx);
		const second = await invoke(handler, request(eventBody), fx);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
		expect(await second.response.json()).toMatchObject({ duplicate: true });
		expect(fx.payments.handleWebhookEvent).toHaveBeenCalledTimes(1);
		expect(fx.events.emit).toHaveBeenCalledTimes(1);
	});
});
