import { createStoreEndpoint } from "@86d-app/core/api";
import { verifyWebhookSignature } from "../../provider";
import type { GoogleShoppingController } from "../../service";

interface WebhookPayload {
	type: string;
	payload: Record<string, unknown>;
}

/**
 * Create the Google Shopping webhook endpoint.
 * Uses HMAC-SHA256 with a shared webhook secret for signature verification.
 * The signature is sent in the X-Goog-Signature header as a hex string.
 */
export function createGoogleShoppingWebhook(
	webhookSecret?: string | undefined,
) {
	return createStoreEndpoint(
		"/google-shopping/webhooks",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;

			let rawBody: string;
			try {
				rawBody = await request.text();
			} catch {
				return Response.json(
					{ error: "Failed to read request body." },
					{ status: 400 },
				);
			}

			// Verify HMAC-SHA256 signature if webhook secret is configured
			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!webhookSecret) {
				return Response.json(
					{ error: "Google Shopping webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (webhookSecret) {
				const signature = request.headers.get("x-goog-signature") ?? "";

				if (!signature) {
					return Response.json(
						{ error: "Missing webhook signature." },
						{ status: 401 },
					);
				}

				const valid = await verifyWebhookSignature(
					rawBody,
					signature,
					webhookSecret,
				);
				if (!valid) {
					return Response.json(
						{ error: "Invalid webhook signature." },
						{ status: 401 },
					);
				}
			}

			let body: WebhookPayload;
			try {
				body = JSON.parse(rawBody) as WebhookPayload;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			if (
				!body.type ||
				typeof body.type !== "string" ||
				!body.payload ||
				typeof body.payload !== "object"
			) {
				return Response.json(
					{ error: "Missing type or payload." },
					{ status: 400 },
				);
			}

			const controller = ctx.context?.controllers?.["google-shopping"];
			if (!controller) {
				return Response.json({ received: true, handled: false });
			}
			const googleShopping = controller as GoogleShoppingController;

			const { type, payload } = body;

			switch (type) {
				case "order.created": {
					if (!payload.googleOrderId) return Response.json({ received: true });
					const order = await googleShopping.receiveOrder({
						googleOrderId: payload.googleOrderId as string,
						items: payload.items as unknown[],
						subtotal: payload.subtotal as number,
						shippingCost: payload.shippingCost as number,
						tax: payload.tax as number,
						total: payload.total as number,
						shippingAddress: payload.shippingAddress as Record<string, unknown>,
					});
					return Response.json({
						received: true,
						orderId: order.id,
					});
				}

				default:
					return Response.json({ received: true });
			}
		},
	);
}
