import { describe, expect, it, vi } from "vitest";
import { createResendWebhook } from "../store/endpoints/resend-webhook";

const webhookSecret = "whsec_testwebhooksecret123456789";

async function signSvix(
	id: string,
	timestamp: string,
	body: string,
	secret = webhookSecret,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${id}.${timestamp}.${body}`),
	);
	return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

function request(body: string, headers: HeadersInit = {}): Request {
	return new Request("https://store.example/notifications/webhook/resend", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body,
	});
}

function effects() {
	return {
		findByExternalId: vi.fn(),
		updateDeliveryStatus: vi.fn(),
	};
}

async function invoke(
	endpoint: ReturnType<typeof createResendWebhook>,
	webhookRequest: Request,
	notifications = effects(),
) {
	const response = await endpoint({
		request: webhookRequest,
		context: { controllers: { notifications } },
	});
	return { response, notifications };
}

const body = JSON.stringify({
	type: "email.delivered",
	data: { email_id: "email-1" },
});

describe("Resend webhook containment", () => {
	it("fails closed when verification is not configured", async () => {
		const { response, notifications } = await invoke(
			createResendWebhook({}),
			request(body),
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: expect.stringMatching(/not configured/i),
		});
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("rejects missing signature headers before any projection effect", async () => {
		const { response, notifications } = await invoke(
			createResendWebhook({ webhookSecret }),
			request(body),
		);

		expect(response.status).toBe(401);
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("rejects invalid and expired signatures before any projection effect", async () => {
		const id = "message-invalid";
		const expired = String(Math.floor(Date.now() / 1000) - 600);
		const endpoint = createResendWebhook({ webhookSecret });
		const invalid = await invoke(
			endpoint,
			request(body, {
				"svix-id": id,
				"svix-timestamp": String(Math.floor(Date.now() / 1000)),
				"svix-signature": "v1,invalid",
			}),
		);
		const stale = await invoke(
			endpoint,
			request(body, {
				"svix-id": id,
				"svix-timestamp": expired,
				"svix-signature": await signSvix(id, expired, body),
			}),
		);

		expect(invalid.response.status).toBe(401);
		expect(stale.response.status).toBe(401);
		expect(invalid.notifications.findByExternalId).not.toHaveBeenCalled();
		expect(stale.notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("authenticates an official multi-signature header then requests a durable retry", async () => {
		const id = "message-valid";
		const timestamp = String(Math.floor(Date.now() / 1000));
		const valid = await signSvix(id, timestamp, body);
		const { response, notifications } = await invoke(
			createResendWebhook({ webhookSecret }),
			request(body, {
				"svix-id": id,
				"svix-timestamp": timestamp,
				"svix-signature": `v1,rotated-invalid ${valid}`,
			}),
		);

		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("60");
		expect(await response.json()).toMatchObject({
			code: "NOTIFICATION_WEBHOOK_DURABILITY_REQUIRED",
		});
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});
});
