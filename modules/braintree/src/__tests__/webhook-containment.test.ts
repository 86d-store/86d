import { describe, expect, it, vi } from "vitest";
import { createBraintreeWebhook } from "../store/endpoints/webhook";

const publicKey = "braintree-public-key";
const privateKey = "braintree-private-key";
const enc = new TextEncoder();

async function officialSignature(payload: string): Promise<string> {
	const sha1 = await crypto.subtle.digest("SHA-1", enc.encode(privateKey));
	const key = await crypto.subtle.importKey(
		"raw",
		sha1,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const bytes = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
	return Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function payload(): string {
	return btoa(
		"<notification><kind>transaction_settled</kind><transaction><id>bt-transaction-1</id></transaction></notification>",
	);
}

function request(btPayload: string, btSignature: string): Request {
	return new Request("https://store.test/api/store/braintree/webhook", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			bt_payload: btPayload,
			bt_signature: btSignature,
		}),
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
	handler: ReturnType<typeof createBraintreeWebhook>,
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

describe("Braintree webhook containment", () => {
	it("fails closed with incomplete verification config", async () => {
		const btPayload = payload();
		const { response, fx } = await invoke(
			createBraintreeWebhook({ publicKey, privateKey: "" }),
			request(btPayload, `${publicKey}|invalid`),
		);
		expect(response.status).toBe(503);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("rejects an invalid signature before any effects", async () => {
		const btPayload = payload();
		const { response, fx } = await invoke(
			createBraintreeWebhook({ publicKey, privateKey }),
			request(btPayload, `${publicKey}|invalid`),
		);
		expect(response.status).toBe(401);
		expect(fx.payments.handleWebhookEvent).not.toHaveBeenCalled();
		expect(fx.events.emit).not.toHaveBeenCalled();
	});

	it("accepts the official SDK signature derivation and multi-key format", async () => {
		const btPayload = payload();
		const digest = await officialSignature(btPayload);
		const { response } = await invoke(
			createBraintreeWebhook({ publicKey, privateKey }),
			request(btPayload, `rotated-key|deadbeef&${publicKey}|${digest}`),
		);
		expect(response.status).toBe(200);
	});

	it("accepts the SDK-compatible trailing-newline signature", async () => {
		const btPayload = payload();
		const digest = await officialSignature(`${btPayload}\n`);
		const { response } = await invoke(
			createBraintreeWebhook({ publicKey, privateKey }),
			request(btPayload, `${publicKey}|${digest}`),
		);
		expect(response.status).toBe(200);
	});

	it("suppresses repeated effects for a duplicate payload", async () => {
		const btPayload = payload();
		const digest = await officialSignature(btPayload);
		const handler = createBraintreeWebhook({ publicKey, privateKey });
		const fx = effects();
		const first = await invoke(
			handler,
			request(btPayload, `${publicKey}|${digest}`),
			fx,
		);
		const second = await invoke(
			handler,
			request(btPayload, `${publicKey}|${digest}`),
			fx,
		);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
		expect(await second.response.json()).toMatchObject({ duplicate: true });
		expect(fx.payments.handleWebhookEvent).toHaveBeenCalledTimes(1);
		expect(fx.events.emit).toHaveBeenCalledTimes(1);
	});
});
