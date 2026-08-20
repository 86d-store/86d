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
import type { Prisma } from "db";
import {
	buildWebhookPayload,
	deliverWebhook,
	WEBHOOK_EVENT_TYPES,
} from "lib/webhook-delivery";
import { logger } from "utils/logger";

/**
 * Minimal DB interface for webhook queries.
 */
interface WebhookDb {
	webhook: {
		findMany(args: {
			where: { storeId: string; isActive: boolean; events: { has: string } };
			select: { id: boolean; url: boolean; secret: boolean };
		}): Promise<Array<{ id: string; url: string; secret: string }>>;
	};
	webhookDelivery: {
		create(args: {
			data: {
				webhookId: string;
				eventType: string;
				payload: Prisma.InputJsonValue | typeof Prisma.JsonNull;
				status: string;
				statusCode: number | null;
				response: string | null;
				attempts: number;
				duration: number;
				lastAttemptAt: Date;
			};
		}): Promise<unknown>;
	};
}

/**
 * Register webhook delivery handlers on the event bus.
 * Should be called once after the module registry boots.
 *
 * Returns an unsubscribe function to remove all handlers.
 */
export function registerWebhookHandlers(
	bus: EventBus,
	db: WebhookDb,
	storeId: string,
): () => void {
	const handler = async (event: ModuleEvent) => {
		try {
			const webhooks = await db.webhook.findMany({
				where: {
					storeId,
					isActive: true,
					events: { has: event.type },
				},
				select: { id: true, url: true, secret: true },
			});

			if (webhooks.length === 0) return;

			const payload = buildWebhookPayload(
				event.type,
				event.source,
				event.payload,
			);

			// Deliver to all matching webhooks concurrently
			const results = await Promise.allSettled(
				webhooks.map(async (webhook) => {
					const result = await deliverWebhook(
						webhook.url,
						webhook.secret,
						payload,
					);

					// Log delivery (fire-and-forget)
					db.webhookDelivery
						.create({
							data: {
								webhookId: webhook.id,
								eventType: event.type,
								payload: JSON.parse(
									JSON.stringify(payload),
								) as Prisma.InputJsonValue,
								status: result.success ? "delivered" : "failed",
								statusCode: result.statusCode,
								response: result.response,
								attempts: result.attempts,
								duration: result.duration,
								lastAttemptAt: new Date(),
							},
						})
						.catch((err) => {
							logger.warn("Failed to log webhook delivery", {
								webhookId: webhook.id,
								error: err instanceof Error ? err.message : String(err),
							});
						});

					return { webhookId: webhook.id, ...result };
				}),
			);

			const delivered = results.filter(
				(r) => r.status === "fulfilled" && r.value.success,
			).length;
			const failed = results.length - delivered;

			if (failed > 0) {
				logger.warn("Some webhook deliveries failed", {
					event: event.type,
					total: results.length,
					delivered,
					failed,
				});
			}
		} catch (err) {
			logger.error("Webhook subscriber error", {
				event: event.type,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	};

	const unsubs = WEBHOOK_EVENT_TYPES.map((eventType) =>
		bus.on(eventType, handler),
	);

	logger.info("Webhook delivery handlers registered", {
		events: WEBHOOK_EVENT_TYPES.length,
	});

	return () => {
		for (const unsub of unsubs) {
			unsub();
		}
	};
}
