import { createStoreEndpoint } from "@86d-app/core/api";
import {
	type EasyPostTrackingStatus,
	mapEasyPostStatusToInternal,
} from "../../provider";
import type { ShippingController } from "../../service";

/**
 * EasyPost webhook endpoint — handles tracker events to keep shipment status
 * in sync with real carrier data.
 *
 * Signature verification implements EasyPost's v2 HMAC contract. Verification
 * material is mandatory because tracker events can mutate shipment state.
 * https://support.easypost.com/hc/en-us/articles/39826034964237-Webhook-HMAC-Validation
 */

interface EasyPostTrackerResult {
	id: string;
	object: string;
	tracking_code: string;
	status: EasyPostTrackingStatus;
	carrier?: string;
	public_url?: string;
	est_delivery_date?: string | null;
}

interface EasyPostWebhookEvent {
	id: string;
	object: string;
	description: string;
	result: EasyPostTrackerResult;
}

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

const RFC_2822_TIMESTAMP =
	/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const EASYPOST_MAX_AGE_MS = 60_000;
const EASYPOST_FUTURE_SKEW_MS = 30_000;

function parseRfc2822Timestamp(value: string): number | null {
	const match = RFC_2822_TIMESTAMP.exec(value);
	if (!match) return null;

	const [
		,
		weekday,
		dayValue,
		monthValue,
		yearValue,
		hourValue,
		minuteValue,
		secondValue,
		sign,
		offsetHourValue,
		offsetMinuteValue,
	] = match;
	const day = Number(dayValue);
	const month = MONTHS.indexOf(monthValue ?? "");
	const year = Number(yearValue);
	const hour = Number(hourValue);
	const minute = Number(minuteValue);
	const second = Number(secondValue);
	const offsetHours = Number(offsetHourValue);
	const offsetMinutes = Number(offsetMinuteValue);

	if (
		month < 0 ||
		day < 1 ||
		day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate() ||
		hour > 23 ||
		minute > 59 ||
		second > 59 ||
		offsetHours > 23 ||
		offsetMinutes > 59 ||
		WEEKDAYS[new Date(Date.UTC(year, month, day)).getUTCDay()] !== weekday
	) {
		return null;
	}

	const localTime = Date.UTC(year, month, day, hour, minute, second);
	const offsetMs = (offsetHours * 60 + offsetMinutes) * 60_000;
	return sign === "+" ? localTime - offsetMs : localTime + offsetMs;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

async function verifyEasyPostSignature(
	rawBody: string,
	request: Request,
	secret: string,
): Promise<boolean> {
	const timestamp = request.headers.get("x-timestamp") ?? "";
	const signedPath = request.headers.get("x-path") ?? "";
	const signatureHeader = request.headers.get("x-hmac-signature-v2") ?? "";
	const requestPath = new URL(request.url).pathname;
	const timestampMs = parseRfc2822Timestamp(timestamp);
	const ageMs =
		timestampMs === null ? Number.POSITIVE_INFINITY : Date.now() - timestampMs;
	const signature = /^hmac-sha256-hex=([0-9a-fA-F]{64})$/.exec(
		signatureHeader,
	)?.[1];

	if (
		!signature ||
		!signedPath ||
		signedPath !== requestPath ||
		ageMs > EASYPOST_MAX_AGE_MS ||
		ageMs < -EASYPOST_FUTURE_SKEW_MS
	) {
		return false;
	}

	const signedPayload = `${timestamp}${request.method.toUpperCase()}${signedPath}${rawBody}`;
	const expected = await hmacSha256Hex(secret, signedPayload);
	return timingSafeEqual(signature.toLowerCase(), expected);
}

const MAX_WEBHOOK_RECEIPTS = 10_000;

function createReceiptGuard() {
	const receipts = new Map<string, "processing" | "processed">();

	return async function withReceipt(
		key: string,
		work: () => Promise<Response>,
	): Promise<Response> {
		const state = receipts.get(key);
		if (state === "processed") {
			return Response.json({ received: true, handled: false, duplicate: true });
		}
		if (state === "processing") {
			return Response.json(
				{ error: "Webhook event is already being processed." },
				{ status: 409 },
			);
		}

		receipts.set(key, "processing");
		try {
			const response = await work();
			if (response.ok) {
				receipts.set(key, "processed");
				if (receipts.size > MAX_WEBHOOK_RECEIPTS) {
					const oldest = receipts.keys().next().value;
					if (oldest) receipts.delete(oldest);
				}
			} else {
				receipts.delete(key);
			}
			return response;
		} catch (error) {
			receipts.delete(key);
			throw error;
		}
	};
}

export function createShippingWebhook(opts: {
	webhookSecret?: string | undefined;
}) {
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/shipping/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;
			if (!opts.webhookSecret) {
				return Response.json(
					{ error: "EasyPost webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await request.text();
			const valid = await verifyEasyPostSignature(
				rawBody,
				request,
				opts.webhookSecret,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}
			let event: EasyPostWebhookEvent;
			try {
				event = JSON.parse(rawBody) as EasyPostWebhookEvent;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			if (
				event.object !== "Event" ||
				!event.description?.startsWith("tracker.")
			) {
				return Response.json({ received: true, handled: false });
			}

			const tracker = event.result;
			if (tracker?.object !== "Tracker" || !tracker.tracking_code) {
				return Response.json({ received: true, handled: false });
			}
			if (!event.id) {
				return Response.json(
					{ error: "Missing EasyPost event ID." },
					{ status: 400 },
				);
			}

			return withReceipt(event.id, async () => {
				const shipping = ctx.context?.controllers?.shipping as
					| ShippingController
					| undefined;

				if (!shipping) {
					return Response.json({ received: true, handled: false });
				}

				const shipment = await shipping
					.findShipmentByTrackingNumber(tracker.tracking_code)
					.catch(() => null);

				if (!shipment) {
					return Response.json({ received: true, handled: false });
				}

				const internalStatus = mapEasyPostStatusToInternal(tracker.status);

				if (internalStatus === shipment.status) {
					return Response.json({ received: true, handled: false });
				}

				const updated = await shipping
					.updateShipmentStatus(shipment.id, internalStatus)
					.catch(() => null);
				if (!updated) {
					return Response.json({ received: true, handled: false });
				}

				return Response.json({
					received: true,
					handled: true,
					shipmentId: shipment.id,
					status: internalStatus,
				});
			});
		},
	);
}

/**
 * Registered containment endpoint. EasyPost provenance is verified, but
 * tracking cannot mutate Shipping until receipt and ordering are durable.
 */
export function createContainedShippingWebhook(opts: {
	webhookSecret?: string | undefined;
}) {
	return createStoreEndpoint(
		"/shipping/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const webhookSecret = opts.webhookSecret?.trim();
			if (!webhookSecret) {
				return Response.json(
					{ error: "EasyPost webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await ctx.request.text();
			if (
				!(await verifyEasyPostSignature(rawBody, ctx.request, webhookSecret))
			) {
				return Response.json(
					{ error: "Invalid or missing webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "SHIPPING_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"EasyPost webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
