import { createStoreEndpoint } from "@86d-app/core/api";
import type { ToastController } from "../../service";

interface ToastWebhookOptions {
	/** Toast webhook client secret for HMAC signature verification. */
	webhookSecret?: string | undefined;
}

// ── Toast HMAC-SHA256 signature verification ──────────────────────────────────

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

async function verifyToastSignature(
	rawBody: string,
	signatureHeader: string,
	secret: string,
): Promise<boolean> {
	if (!signatureHeader) return false;
	const expected = await hmacSha256Hex(secret, rawBody);
	return timingSafeEqual(signatureHeader, expected);
}

// ── Toast webhook event types ─────────────────────────────────────────────────

interface ToastWebhookEvent {
	eventType: string;
	eventGuid?: string | undefined;
	restaurantGuid?: string | undefined;
	entityGuid?: string | undefined;
	entityType?: string | undefined;
	timestamp?: string | undefined;
}

// ── Endpoint factory ──────────────────────────────────────────────────────────

export function createToastWebhook(opts: ToastWebhookOptions) {
	return createStoreEndpoint(
		"/toast/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;
			const rawBody = await request.text();

			// Signature verification (skipped if no secret configured)
			// An unconfigured Integration must not accept a provider event.
			// Skipping verification here would let anyone post one.
			if (!opts.webhookSecret) {
				return Response.json(
					{ error: "Toast webhook verification is not configured." },
					{ status: 503 },
				);
			}

			if (opts.webhookSecret) {
				const sigHeader = request.headers.get("x-toast-signature") ?? "";
				const valid = await verifyToastSignature(
					rawBody,
					sigHeader,
					opts.webhookSecret,
				);
				if (!valid) {
					return Response.json(
						{ error: "Invalid webhook signature." },
						{ status: 401 },
					);
				}
			}

			let event: ToastWebhookEvent;
			try {
				event = JSON.parse(rawBody) as ToastWebhookEvent;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const eventType = event.eventType;
			if (!eventType) {
				return Response.json({ error: "Missing eventType." }, { status: 400 });
			}

			const controller = ctx.context?.controllers?.toast as
				| ToastController
				| undefined;
			const events = ctx.context?.events;

			if (controller && event.entityGuid) {
				const entityGuid = event.entityGuid;

				if (
					eventType === "menu.item.updated" ||
					eventType === "menu.item.created"
				) {
					await controller.syncMenu({
						entityId: entityGuid,
						externalId: entityGuid,
						direction: "inbound",
					});
				} else if (
					eventType === "order.created" ||
					eventType === "order.updated"
				) {
					await controller.syncOrder({
						entityId: entityGuid,
						externalId: entityGuid,
						direction: "inbound",
					});
				} else if (eventType === "stock.updated") {
					await controller.syncInventory({
						entityId: entityGuid,
						externalId: entityGuid,
						direction: "inbound",
					});
				}
			}

			if (events) {
				await events.emit("toast.webhook.received", {
					eventType,
					entityGuid: event.entityGuid,
					restaurantGuid: event.restaurantGuid,
				});
			}

			return Response.json({ received: true, eventType });
		},
	);
}
