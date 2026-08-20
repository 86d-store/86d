import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { verifyWebhookSignature } from "../../provider";

export function createWebhookEndpoint(webhookSecret?: string) {
	return createStoreEndpoint(
		"/pinterest-shop/webhooks",
		{
			exposure: "provider_webhook",
			method: "POST",
			body: z.object({
				type: z.string().min(1).max(200),
				payload: z
					.record(z.string().max(100), z.unknown())
					.refine((r) => Object.keys(r).length <= 100, {
						message: "Too many fields in payload",
					}),
			}),
		},
		async (ctx) => {
			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!webhookSecret) {
				return Response.json(
					{ error: "Pinterest Shop webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (webhookSecret) {
				const signature =
					ctx.headers instanceof Headers
						? (ctx.headers.get("x-pinterest-signature") ?? "")
						: "";
				const rawBody = JSON.stringify(ctx.body);
				if (
					typeof signature === "string" &&
					!verifyWebhookSignature(rawBody, signature, webhookSecret)
				) {
					return { received: false, error: "Invalid signature" };
				}
			}

			return { received: true, type: ctx.body.type };
		},
	);
}

export const webhookEndpoint = createWebhookEndpoint();
