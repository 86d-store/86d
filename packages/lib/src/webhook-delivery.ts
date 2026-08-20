import { createHmac } from "node:crypto";

export const WEBHOOK_EVENT_TYPES = [
	"order.placed",
	"order.shipped",
	"order.delivered",
	"order.cancelled",
	"order.completed",
	"order.refunded",
	"payment.failed",
	"subscription.created",
	"subscription.cancelled",
	"subscription.updated",
	"customer.created",
	"inventory.low",
	"review.created",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

interface WebhookPayload {
	id: string;
	type: string;
	source: string;
	timestamp: string;
	data: unknown;
}

export function buildWebhookPayload(
	type: string,
	source: string,
	data: unknown,
): WebhookPayload {
	return {
		id: crypto.randomUUID(),
		type,
		source,
		timestamp: new Date().toISOString(),
		data,
	};
}

function signPayload(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

interface DeliveryResult {
	success: boolean;
	statusCode: number | null;
	response: string | null;
	attempts: number;
	duration: number;
}

export async function deliverWebhook(
	url: string,
	secret: string,
	payload: WebhookPayload,
): Promise<DeliveryResult> {
	const body = JSON.stringify(payload);
	const signature = signPayload(body, secret);
	const start = Date.now();

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Webhook-Signature": signature,
				"X-Webhook-Id": payload.id,
			},
			body,
			signal: AbortSignal.timeout(10_000),
		});

		const responseText = await res.text().catch(() => null);
		return {
			success: res.ok,
			statusCode: res.status,
			response: responseText?.slice(0, 1000) ?? null,
			attempts: 1,
			duration: Date.now() - start,
		};
	} catch {
		return {
			success: false,
			statusCode: null,
			response: null,
			attempts: 1,
			duration: Date.now() - start,
		};
	}
}

export function getWebhookDeliveryByHash(
	_hash: string,
): Promise<unknown | null> {
	return Promise.resolve(null);
}
