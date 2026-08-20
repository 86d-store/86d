import { createStoreEndpoint } from "@86d-app/core/api";
import {
	mapUberStatusToInternal,
	verifyWebhookSignature,
} from "../../provider";
import type { UberDirectController } from "../../service";

/**
 * Uber Direct webhook event types.
 * See: https://developer.uber.com/docs/deliveries/guides/webhooks
 */
type UberWebhookKind =
	| "event.delivery_status"
	| "event.courier_update"
	| "event.refund_request"
	| "event.shopping_progress";

interface WebhookPayload {
	kind: UberWebhookKind;
	id?: string | undefined;
	status?: string | undefined;
	external_id?: string | undefined;
	tracking_url?: string | undefined;
	courier?: {
		name?: string | undefined;
		phone_number?: string | undefined;
		vehicle_type?: string | undefined;
		location?: { lat?: number; lng?: number } | undefined;
	};
	dropoff_eta?: string | undefined;
	pickup_eta?: string | undefined;
	location?: { lat?: number; lng?: number } | undefined;
}

const enc = new TextEncoder();
const MAX_WEBHOOK_RECEIPTS = 10_000;

async function sha256Hex(data: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", enc.encode(data));
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function createReceiptGuard() {
	const receipts = new Map<string, "processing" | "processed">();

	return async function withReceipt(
		key: string,
		duplicateBody: Record<string, unknown>,
		work: () => Promise<Response>,
	): Promise<Response> {
		const state = receipts.get(key);
		if (state === "processed") {
			return Response.json({ ...duplicateBody, duplicate: true });
		}
		if (state === "processing") {
			return Response.json(
				{ error: "Webhook event is already being processed." },
				{ status: 409 },
			);
		}

		receipts.set(key, "processing");
		try {
			const response = await work();
			if (response.ok) {
				receipts.set(key, "processed");
				if (receipts.size > MAX_WEBHOOK_RECEIPTS) {
					const oldest = receipts.keys().next().value;
					if (oldest) receipts.delete(oldest);
				}
			} else {
				receipts.delete(key);
			}
			return response;
		} catch (error) {
			receipts.delete(key);
			throw error;
		}
	};
}

/**
 * Create the Uber Direct webhook endpoint.
 * Uber sends delivery status updates to this endpoint.
 * Signature verification uses HMAC-SHA256 with the webhook signing key.
 */
export function createUberDirectWebhook(signingKey?: string | undefined) {
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/uber-direct/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;
			if (!signingKey) {
				return Response.json(
					{ error: "Uber Direct webhook verification is not configured." },
					{ status: 503 },
				);
			}

			let rawBody: string;
			try {
				rawBody = await request.text();
			} catch {
				return Response.json(
					{ error: "Failed to read request body." },
					{ status: 400 },
				);
			}

			const signature =
				request.headers.get("x-uber-signature") ??
				request.headers.get("x-postmates-signature") ??
				"";

			if (!signature) {
				return Response.json(
					{ error: "Missing webhook signature." },
					{ status: 401 },
				);
			}

			const valid = await verifyWebhookSignature(
				rawBody,
				signature,
				signingKey,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}

			let payload: WebhookPayload;
			try {
				payload = JSON.parse(rawBody) as WebhookPayload;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			if (!payload.kind) {
				return Response.json({ error: "Missing event kind." }, { status: 400 });
			}
			const receiptKey = await sha256Hex(rawBody);

			return withReceipt(
				receiptKey,
				{ received: true, kind: payload.kind, handled: false },
				async () => {
					const controller = ctx.context?.controllers
						?.uberDirect as UberDirectController;
					const events = ctx.context?.events;

					// Only handle delivery status events
					if (payload.kind !== "event.delivery_status" || !controller) {
						void events?.emit("uber-direct.webhook.received", {
							kind: payload.kind,
							deliveryId: payload.id,
						});
						return Response.json({
							received: true,
							kind: payload.kind,
							handled: false,
						});
					}

					if (!payload.id || !payload.status) {
						void events?.emit("uber-direct.webhook.received", {
							kind: payload.kind,
							deliveryId: payload.id,
						});
						return Response.json({
							received: true,
							kind: payload.kind,
							handled: false,
							reason: "missing_delivery_id_or_status",
						});
					}

					// Find delivery by external ID
					const deliveries = await controller.listDeliveries();
					const delivery = deliveries.find((d) => d.externalId === payload.id);

					if (!delivery) {
						void events?.emit("uber-direct.webhook.received", {
							kind: payload.kind,
							deliveryId: payload.id,
						});
						return Response.json({
							received: true,
							kind: payload.kind,
							handled: false,
							reason: "delivery_not_found",
						});
					}

					// Map Uber status to internal status and update
					const uberStatus = payload.status as Parameters<
						typeof mapUberStatusToInternal
					>[0];
					const internalStatus = mapUberStatusToInternal(uberStatus);
					if (internalStatus === delivery.status) {
						return Response.json({
							received: true,
							kind: payload.kind,
							handled: false,
							reason: "duplicate_status",
						});
					}

					void events?.emit("uber-direct.webhook.received", {
						kind: payload.kind,
						deliveryId: payload.id,
					});

					if (internalStatus === "cancelled") {
						await controller.cancelDelivery(delivery.id);
					} else {
						await controller.updateDeliveryStatus(delivery.id, internalStatus, {
							trackingUrl: payload.tracking_url,
							courierName: payload.courier?.name,
							courierPhone: payload.courier?.phone_number,
							courierVehicle: payload.courier?.vehicle_type,
							...(internalStatus === "picked-up"
								? { actualPickupTime: new Date() }
								: {}),
							...(internalStatus === "delivered"
								? { actualDeliveryTime: new Date() }
								: {}),
						});
					}

					return Response.json({
						received: true,
						kind: payload.kind,
						handled: true,
						deliveryId: delivery.id,
					});
				},
			);
		},
	);
}
