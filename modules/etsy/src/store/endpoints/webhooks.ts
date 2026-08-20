import { createStoreEndpoint } from "@86d-app/core/api";
import { verifyWebhookSignature } from "../../provider";
import type { EtsyController } from "../../service";

/**
 * Create the Etsy webhook endpoint.
 * Pass `webhookSecret` from module options to enable HMAC-SHA256 signature
 * verification via the `X-Etsy-Signature` header.
 *
 * Without a secret the endpoint still accepts requests (useful for local dev),
 * but all incoming payloads are processed without verification.
 */
export function createEtsyWebhook(webhookSecret?: string | undefined) {
	return createStoreEndpoint(
		"/etsy/webhooks",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;

			// Read raw body before parsing to preserve bytes for HMAC
			const rawBody = await request.text();

			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!webhookSecret) {
				return Response.json(
					{ error: "Etsy webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (webhookSecret) {
				const signature = request.headers.get("x-etsy-signature") ?? "";
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

			let body: Record<string, unknown>;
			try {
				body = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const type = body.type as string | undefined;
			const payload = body.payload as Record<string, unknown> | undefined;

			if (!type || !payload) {
				return Response.json(
					{ error: "Missing required fields: type and payload." },
					{ status: 400 },
				);
			}

			const controller = ctx.context?.controllers?.etsy as
				| EtsyController
				| undefined;

			if (type === "order.created" && payload.etsyReceiptId) {
				if (!controller) {
					return Response.json(
						{ error: "Etsy controller not available." },
						{ status: 500 },
					);
				}

				const order = await controller.receiveOrder({
					etsyReceiptId: payload.etsyReceiptId as string,
					items: (payload.items as unknown[]) ?? [],
					subtotal: (payload.subtotal as number) ?? 0,
					shippingCost: (payload.shippingCost as number) ?? 0,
					etsyFee: (payload.etsyFee as number) ?? 0,
					processingFee: (payload.processingFee as number) ?? 0,
					tax: (payload.tax as number) ?? 0,
					total: (payload.total as number) ?? 0,
					shippingAddress:
						(payload.shippingAddress as Record<string, unknown>) ?? {},
				});

				return Response.json({ received: true, orderId: order.id });
			}

			return Response.json({ received: true });
		},
	);
}
