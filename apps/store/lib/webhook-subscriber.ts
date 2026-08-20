/**
 * Webhook delivery subscriber for store events.
 *
 * Subscribes to all webhook-eligible events on the EventBus,
 * looks up registered webhooks for the store, and delivers
 * HTTP POST requests to each matching endpoint.
 *
 * Delivery results are logged to WebhookDelivery for auditability.
 */

import type { EventBus, ModuleEvent } from "@86d-app/core/events";
import type { Database } from "db";
import { webhook, webhookDelivery } from "db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
	buildWebhookPayload,
	deliverWebhook,
	WEBHOOK_EVENT_TYPES,
} from "lib/webhook-delivery";
import { logger } from "utils/logger";

/**
 * Register webhook delivery handlers on the event bus.
 * Should be called once after the module registry boots.
 *
 * Returns an unsubscribe function to remove all handlers.
 */
export function registerWebhookHandlers(
	bus: EventBus,
	db: Database,
	storeId: string,
): () => void {
	const handler = async (event: ModuleEvent) => {
		try {
			const webhooks = await db
				.select({
					id: webhook.id,
					url: webhook.url,
					secret: webhook.secret,
				})
				.from(webhook)
				.where(
					and(
						eq(webhook.storeId, storeId),
						eq(webhook.isActive, true),
						sql`${event.type} = ANY(${webhook.events})`,
					),
				);

			if (webhooks.length === 0) return;

			const payload = buildWebhookPayload(
				event.type,
				event.source,
				event.payload,
			);

			const results = await Promise.allSettled(
				webhooks.map(async (hook) => {
					const result = await deliverWebhook(hook.url, hook.secret, payload);
					await db.insert(webhookDelivery).values({
						id: crypto.randomUUID(),
						cuid: `wd${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`,
						webhookId: hook.id,
						eventType: event.type,
						payload,
						status: result.success ? "success" : "failed",
						statusCode: result.statusCode,
						response: result.response,
						attempts: result.attempts,
						duration: result.duration,
						lastAttemptAt: new Date().toISOString(),
					});
					return result;
				}),
			);

			const failed = results.filter((r) => r.status === "rejected").length;
			if (failed > 0) {
				logger.warn("Some webhook deliveries failed", {
					eventType: event.type,
					failed,
					total: webhooks.length,
				});
			}
		} catch (error) {
			logger.error("Webhook handler error", {
				eventType: event.type,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const unsubscribers = WEBHOOK_EVENT_TYPES.map((eventType) =>
		bus.on(eventType, handler),
	);

	return () => {
		for (const unsubscribe of unsubscribers) {
			unsubscribe();
		}
	};
}
