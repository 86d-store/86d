import { describe, expect, it, vi } from "vitest";
import { createTwilioWebhook } from "../store/endpoints/twilio-webhook";

const authToken = "testtwilioauthtoken123456789abc";
const webhookUrl = "https://store.example/notifications/webhook/twilio";

async function signTwilio(
	params: Record<string, string>,
	token = authToken,
): Promise<string> {
	const sorted = Object.keys(params)
		.sort()
		.map((key) => `${key}${params[key]}`)
		.join("");
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(token),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${webhookUrl}${sorted}`),
	);
	return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function request(params: Record<string, string>, signature?: string): Request {
	const headers = new Headers({
		"content-type": "application/x-www-form-urlencoded",
	});
	if (signature !== undefined) {
		headers.set("x-twilio-signature", signature);
	}
	return new Request(webhookUrl, {
		method: "POST",
		headers,
		body: new URLSearchParams(params),
	});
}

function effects() {
	return {
		findByExternalId: vi.fn(),
		updateDeliveryStatus: vi.fn(),
	};
}

async function invoke(
	endpoint: ReturnType<typeof createTwilioWebhook>,
	webhookRequest: Request,
	notifications = effects(),
) {
	const response = await endpoint({
		request: webhookRequest,
		context: { controllers: { notifications } },
	});
	return { response, notifications };
}

const payload = {
	MessageSid: "SM-1",
	MessageStatus: "delivered",
	AccountSid: "AC-test",
	From: "+15555550100",
	To: "+15555550200",
};

describe("Twilio webhook containment", () => {
	it("fails closed when verification is not configured", async () => {
		const { response, notifications } = await invoke(
			createTwilioWebhook({}),
			request(payload),
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: expect.stringMatching(/not configured/i),
		});
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("rejects a missing signature before any projection effect", async () => {
		const { response, notifications } = await invoke(
			createTwilioWebhook({ authToken, webhookUrl }),
			request(payload),
		);

		expect(response.status).toBe(401);
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("rejects an invalid signature before any projection effect", async () => {
		const { response, notifications } = await invoke(
			createTwilioWebhook({ authToken, webhookUrl }),
			request(payload, "invalid-signature"),
		);

		expect(response.status).toBe(401);
		expect(notifications.findByExternalId).not.toHaveBeenCalled();
		expect(notifications.updateDeliveryStatus).not.toHaveBeenCalled();
	});

	it("authenticates the official signature then requests a durable retry", async () => {
		const { response, notifications } = await invoke(
			createTwilioWebhook({ authToken, webhookUrl }),
			request(payload, await signTwilio(payload)),
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
