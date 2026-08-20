import { createStoreEndpoint } from "@86d-app/core/api";
import { UberEatsProvider } from "../../provider";
import type { UberEatsController } from "../../service";

interface UberEatsWebhookOptions {
	clientSecret?: string | undefined;
}

// ── Uber Eats webhook event types ──────────────────────────────────────────

interface UberEatsWebhookEvent {
	event_type: string;
	event_id?: string | undefined;
	event_time?: number | undefined;
	meta?: {
		resource_id?: string | undefined;
		resource_href?: string | undefined;
		status?: string | undefined;
		user_id?: string | undefined;
	};
	resource_href?: string | undefined;
}

// ── Endpoint factory ───────────────────────────────────────────────────────

export function createUberEatsWebhook(opts: UberEatsWebhookOptions) {
	return createStoreEndpoint(
		"/uber-eats/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;
			const rawBody = await request.text();

			// Verify webhook signature using X-Uber-Signature header
			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!opts.clientSecret) {
				return Response.json(
					{ error: "Uber Eats webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (opts.clientSecret) {
				const sigHeader = request.headers.get("x-uber-signature") ?? "";
				const valid = await UberEatsProvider.verifyWebhookSignature(
					rawBody,
					sigHeader,
					opts.clientSecret,
				);
				if (!valid) {
					return Response.json(
						{ error: "Invalid webhook signature." },
						{ status: 401 },
					);
				}
			}

			let event: UberEatsWebhookEvent;
			try {
				event = JSON.parse(rawBody) as UberEatsWebhookEvent;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const eventType = event.event_type;
			if (!eventType) {
				return Response.json({ error: "Missing event_type." }, { status: 400 });
			}

			const controller = ctx.context?.controllers?.["uber-eats"] as
				| UberEatsController
				| undefined;
			const events = ctx.context?.events;

			const resourceId =
				event.meta?.resource_id ?? event.resource_href?.split("/").pop();

			if (controller && resourceId) {
				if (
					eventType === "orders.notification" ||
					eventType === "orders.scheduled.notification"
				) {
					// Uber is notifying us of a new order — fetch full details
					// and persist locally using the resource ID
					await controller.receiveOrder({
						externalOrderId: resourceId,
						items: [],
						subtotal: 0,
						deliveryFee: 0,
						tax: 0,
						total: 0,
						orderType: "DELIVERY_BY_UBER",
					});
				} else if (
					eventType === "orders.cancel" ||
					eventType === "orders.failure"
				) {
					// Find local order by external ID and cancel it
					const orders = await controller.listOrders();
					const match = orders.find((o) => o.externalOrderId === resourceId);
					if (match) {
						await controller.cancelOrder(
							match.id,
							"Cancelled via Uber Eats webhook",
						);
					}
				}
			}

			if (events) {
				await events.emit("ubereats.webhook.received", {
					eventType,
					resourceId,
					eventId: event.event_id,
				});
			}

			return Response.json({ received: true, event_type: eventType });
		},
	);
}
