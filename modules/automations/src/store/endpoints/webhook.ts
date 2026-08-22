import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

/**
 * Webhook reception endpoint for external services.
 *
 * External platforms (Zapier, custom integrations, etc.) can POST events
 * that trigger matching automations. A shared secret is required and is
 * validated against the `x-webhook-secret` header; without one configured the
 * endpoint refuses, because it would otherwise let anyone trigger automations.
 *
 * Unlike the `/automations/trigger` endpoint, this accepts any event
 * type (not limited to the storefront allowlist) because the caller is
 * authenticated via the webhook secret.
 */
export function createWebhookEndpoint(opts?: {
	webhookSecret?: string | undefined;
}) {
	return createStoreEndpoint(
		"/automations/webhooks",
		{
			exposure: "provider_webhook",
			method: "POST",
			body: z.object({
				eventType: z.string().min(1).max(200),
				payload: z
					.record(z.string().max(100), z.unknown())
					.refine((r) => Object.keys(r).length <= 50, "Too many keys")
					.optional(),
			}),
			requireRequest: true,
		},
		async (ctx): Promise<Response> => {
			const request = ctx.request;

			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!opts?.webhookSecret) {
				return Response.json(
					{ error: "Automations webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (opts?.webhookSecret) {
				const provided = request.headers.get("x-webhook-secret") ?? "";
				if (provided !== opts.webhookSecret) {
					return Response.json(
						{ error: "Invalid webhook secret." },
						{ status: 401 },
					);
				}
			}

			const controller = ctx.context.controllers
				.automations as AutomationsController;

			const { eventType, payload } = ctx.body as {
				eventType: string;
				payload?: Record<string, unknown>;
			};

			const executions = await controller.evaluateEvent(
				eventType,
				payload ?? {},
			);

			return Response.json({
				received: true,
				eventType,
				triggered: executions.length,
				executions: executions.map((e) => ({
					id: e.id,
					automationId: e.automationId,
					status: e.status,
				})),
			});
		},
	);
}
