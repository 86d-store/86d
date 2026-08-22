import { createStoreEndpoint } from "@86d-app/core/api";
import { verifyWebhookSignature } from "../../provider";
import type { TikTokShopController } from "../../service";

interface WebhookPayload {
	type: string;
	payload: Record<string, unknown>;
}

/**
 * Create the TikTok Shop webhook endpoint.
 * TikTok signs push notifications using HMAC-SHA256 with the app_secret.
 * The signature is sent as the `sign` query parameter.
 */
export function createTikTokShopWebhook(appSecret?: string | undefined) {
	return createStoreEndpoint(
		"/tiktok-shop/webhooks",
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

			// Verify signature if app secret is configured
			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!appSecret) {
				return Response.json(
					{ error: "TikTok Shop webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (appSecret) {
				const url = new URL(request.url);
				const params: Record<string, string> = {};
				for (const [key, value] of url.searchParams.entries()) {
					params[key] = value;
				}

				if (!params.sign) {
					return Response.json(
						{ error: "Missing webhook signature." },
						{ status: 401 },
					);
				}

				const valid = await verifyWebhookSignature(
					url.pathname,
					params,
					rawBody,
					appSecret,
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

			const controller = ctx.context?.controllers?.tiktokShop;
			if (!controller) {
				return Response.json({ received: true, handled: false });
			}
			const _tiktokShop = controller as TikTokShopController;

			const { type, payload } = body;

			switch (type) {
				case "order.created": {
					if (!payload.externalOrderId)
						return Response.json({ received: true });
					const order = await controller.receiveOrder({
						externalOrderId: payload.externalOrderId as string,
						status:
							(payload.status as "pending" | "confirmed" | undefined) ??
							"pending",
						items: payload.items as unknown[],
						subtotal: payload.subtotal as number,
						shippingFee: payload.shippingFee as number,
						platformFee: payload.platformFee as number,
						total: payload.total as number,
						customerName: payload.customerName as string | undefined,
						shippingAddress: payload.shippingAddress as Record<string, unknown>,
					});
					return Response.json({
						received: true,
						orderId: order.id,
					});
				}

				case "order.shipped": {
					if (!payload.orderId || !payload.trackingNumber)
						return Response.json({ received: true });
					const order = await controller.updateOrderStatus(
						payload.orderId as string,
						"shipped",
						payload.trackingNumber as string,
						payload.trackingUrl as string | undefined,
					);
					return Response.json({
						received: true,
						orderId: order?.id,
					});
				}

				case "order.cancelled": {
					if (!payload.orderId) return Response.json({ received: true });
					const order = await controller.updateOrderStatus(
						payload.orderId as string,
						"cancelled",
					);
					return Response.json({
						received: true,
						orderId: order?.id,
					});
				}

				case "product.sync": {
					const result = await controller.syncProducts();
					return Response.json({
						received: true,
						synced: result.synced,
					});
				}

				case "order.sync": {
					const result = await controller.syncOrders();
					return Response.json({
						received: true,
						synced: result.synced,
					});
				}

				case "catalog.sync": {
					const sync = await controller.syncCatalog();
					return Response.json({
						received: true,
						syncId: sync.id,
					});
				}

				default:
					return Response.json({ received: true });
			}
		},
	);
}
