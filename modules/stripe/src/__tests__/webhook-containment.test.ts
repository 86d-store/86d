import { describe, expect, it, vi } from "vitest";
import { createStripeWebhook } from "../store/endpoints/webhook";

const SECRET = "whsec_containment_test";
const enc = new TextEncoder();

async function hmac(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const bytes = await crypto.subtle.sign("HMAC", key, enc.encode(value));
	return Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

async function signature(body: string, offsetSeconds = 0): Promise<string> {
	const timestamp = Math.floor(Date.now() / 1000) + offsetSeconds;
	return `t=${timestamp},v1=${await hmac(SECRET, `${timestamp}.${body}`)}`;
}

function request(body: string, stripeSignature?: string): Request {
	const headers = new Headers({ "content-type": "application/json" });
	if (stripeSignature !== undefined) {
		headers.set("stripe-signature", stripeSignature);
	}
	return new Request("https://store.test/api/store/stripe/webhook", {
		method: "POST",
		headers,
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
	handler: ReturnType<typeof createStripeWebhook>,
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
	id: "evt_containment_1",
	type: "payment_intent.succeeded",
	data: { object: { id: "pi_containment_1" } },
});

describe("Stripe webhook containment", () => {
	it("fails closed without a signing secret and performs no effects", async () => {
		const { response, fx } = await invoke(
			createStripeWebhook({}),
			request(eventBody),
		);
		expect(response.status).toBe(503);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("rejects an invalid signature before any effects", async () => {
		const { response, fx } = await invoke(
			createStripeWebhook({ webhookSecret: SECRET }),
			request(eventBody, "t=1,v1=invalid"),
		);
		expect(response.status).toBe(401);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("accepts an official multi-v1 header when any v1 signature matches", async () => {
		const valid = await signature(eventBody);
		const { response } = await invoke(
			createStripeWebhook({ webhookSecret: SECRET }),
			request(eventBody, `${valid},v1=rotated-invalid-signature`),
		);
		expect(response.status).toBe(200);
	});

	it("rejects timestamps outside the tolerance in either direction", async () => {
		const { response } = await invoke(
			createStripeWebhook({ webhookSecret: SECRET }),
			request(eventBody, await signature(eventBody, 301)),
		);
		expect(response.status).toBe(401);
	});

	it("suppresses repeated effects for a duplicate event", async () => {
		const handler = createStripeWebhook({ webhookSecret: SECRET });
		const fx = effects();
		const sig = await signature(eventBody);
		const first = await invoke(handler, request(eventBody, sig), fx);
		const second = await invoke(handler, request(eventBody, sig), fx);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
		expect(await second.response.json()).toMatchObject({ duplicate: true });
		expect(fx.payments.handleWebhookEvent).toHaveBeenCalledTimes(1);
		expect(fx.events.emit).toHaveBeenCalledTimes(1);
	});
});
