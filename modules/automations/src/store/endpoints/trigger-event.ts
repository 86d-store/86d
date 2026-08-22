import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AutomationsController } from "../../service";

/**
 * Public endpoint for triggering automation events from the storefront.
 *
 * The store frontend or external integrations can POST an event type and
 * payload. All active automations whose `triggerEvent` matches are
 * evaluated and executed. Only events from a predefined allowlist are
 * accepted to prevent abuse.
 */

const ALLOWED_STORE_EVENTS = new Set([
	"storefront.form_submitted",
	"storefront.page_viewed",
	"storefront.product_viewed",
	"storefront.cart_updated",
	"storefront.checkout_started",
	"storefront.search_performed",
	"storefront.wishlist_updated",
	"storefront.review_submitted",
]);

export const triggerEvent = createStoreEndpoint(
	"/automations/trigger",
	{
		method: "POST",
		body: z.object({
			eventType: z.string().min(1).max(200).transform(sanitizeText),
			payload: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;

		const eventType = ctx.body.eventType;

		// Only allow storefront-prefixed events from the public API
		if (!ALLOWED_STORE_EVENTS.has(eventType)) {
			return { error: "Event type not allowed", status: 403 };
		}

		const executions = await controller.evaluateEvent(
			eventType,
			ctx.body.payload ?? {},
		);

		return {
			triggered: executions.length,
			executions: executions.map((e) => ({
				id: e.id,
				automationId: e.automationId,
				status: e.status,
			})),
		};
	},
);
