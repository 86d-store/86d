/**
 * Email notification handlers for store events.
 *
 * Subscribes only to non-critical Store events and sends best-effort local
 * email through a literal provider credential. Checkout, Order, Payment,
 * Shipment, and Return communication must be driven by durable notification
 * intents and are deliberately not registered on the in-memory EventBus.
 */

import type { EventBus, ModuleEvent } from "@86d-app/core/events";
import AbandonedCartEmail from "emails/abandoned-cart";
import BackInStockEmail from "emails/back-in-stock";
import LowStockAlertEmail from "emails/low-stock-alert";
import ReviewRequestEmail from "emails/review-request";
import SubscriptionCancelEmail from "emails/subscription-cancel";
import SubscriptionCompleteEmail from "emails/subscription-complete";
import SubscriptionUpdateEmail from "emails/subscription-update";
import WelcomeEmail from "emails/welcome";
import { logger } from "utils/logger";

/**
 * Minimal interface for the Resend email client.
 * Avoids a direct dependency on the `resend` package in the store app.
 */
interface EmailClient {
	emails: {
		send(params: {
			from: string;
			to: string[];
			subject: string;
			react: React.ReactElement;
		}): Promise<unknown>;
	};
}

// ── Event payload types ──────────────────────────────────────────────

export interface CheckoutCompletedPayload {
	sessionId: string;
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	items: Array<{ name: string; quantity: number; price: number }>;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	total: number;
	currency: string;
	shippingAddress?:
		| {
				firstName: string;
				lastName: string;
				line1: string;
				line2?: string | undefined;
				city: string;
				state: string;
				postalCode: string;
				country: string;
		  }
		| undefined;
}

export interface OrderShippedPayload {
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	carrier?: string | undefined;
}

export interface OrderFulfilledPayload {
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
}

export interface OrderCancelledPayload {
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	reason?: string | undefined;
}

export interface PaymentRefundedPayload {
	paymentIntentId: string;
	refundId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	refundAmount: number;
	currency: string;
	items?: Array<{ name: string; quantity: number; price: number }> | undefined;
	reason?: string | undefined;
}

export interface ShipmentDeliveredPayload {
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	deliveredAt?: string | undefined;
	reviewUrl?: string | undefined;
}

export interface ReturnApprovedPayload {
	orderId: string;
	orderNumber: string;
	returnId: string;
	email: string;
	customerName: string;
	items?: string[] | undefined;
	instructions?: string | undefined;
}

export interface PaymentFailedPayload {
	paymentIntentId: string;
	orderNumber?: string | undefined;
	email: string;
	customerName: string;
	amount?: number | undefined;
	currency?: string | undefined;
	reason?: string | undefined;
	retryUrl?: string | undefined;
}

export interface InventoryLowPayload {
	productId: string;
	variantId?: string | undefined;
	locationId?: string | undefined;
	quantity: number;
	reserved: number;
	available: number;
	lowStockThreshold: number;
}

export interface BackInStockPayload {
	productId: string;
	variantId?: string | undefined;
	available: number;
	subscribers: Array<{
		email: string;
		productName?: string | undefined;
	}>;
}

export interface ReviewRequestedPayload {
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	items: Array<{
		productId: string;
		name: string;
		reviewUrl?: string | undefined;
	}>;
	storeName?: string | undefined;
	storeUrl?: string | undefined;
}

export interface SubscriptionCreatedPayload {
	subscriptionId: string;
	planId: string;
	planName: string;
	email: string;
	customerId?: string | undefined;
	status: string;
	interval: string;
	price: number;
	currency: string;
}

export interface SubscriptionRenewedPayload {
	subscriptionId: string;
	planId: string;
	planName: string;
	email: string;
	customerId?: string | undefined;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
}

export interface SubscriptionCancelledPayload {
	subscriptionId: string;
	planId: string;
	email: string;
	customerId?: string | undefined;
	cancelledAt?: Date | undefined;
}

export interface CustomerCreatedPayload {
	customerId: string;
	email: string;
	firstName: string;
	lastName: string;
}

export interface CartAbandonedPayload {
	cartId: string;
	email?: string | null | undefined;
	cartTotal: number;
	currency?: string | null | undefined;
	itemCount: number;
}

// ── Configuration ────────────────────────────────────────────────────

export interface NotificationConfig {
	/** "From" address for emails (e.g., "Store Name <orders@86d.app>") */
	fromAddress: string;
	/** Store name shown in email footers */
	storeName: string;
	/** Admin email for operational alerts (low stock, etc.). If not set, alerts are skipped. */
	adminEmail?: string | undefined;
	/** URL prefix for the store admin (e.g., "https://store.example.com/admin") */
	adminUrl?: string | undefined;
}

const DEFAULT_CONFIG: NotificationConfig = {
	fromAddress: "86d Store <orders@86d.app>",
	storeName: "86d Store",
};

// ── Non-critical local handlers ─────────────────────────────────────

function createReviewRequestedHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<ReviewRequestedPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn("review.requested: no email address, skipping notification", {
				orderId: p.orderId,
			});
			return;
		}

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: `How Was Your Order? - ${p.orderNumber}`,
			react: ReviewRequestEmail({
				orderNumber: p.orderNumber,
				customerName: p.customerName,
				items: p.items.map((item) => ({
					name: item.name,
					reviewUrl: item.reviewUrl,
				})),
				storeName: p.storeName ?? config.storeName,
				storeUrl: p.storeUrl,
			}),
		});

		logger.info("Review request email sent", {
			orderNumber: p.orderNumber,
			to: p.email,
			itemCount: p.items.length,
		});
	};
}

function createInventoryLowHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<InventoryLowPayload>) => {
		if (!config.adminEmail) {
			logger.warn(
				"inventory.low: no adminEmail configured, skipping notification",
				{ productId: event.payload.productId },
			);
			return;
		}

		const p = event.payload;
		const inventoryUrl = config.adminUrl
			? `${config.adminUrl}/inventory`
			: undefined;

		await resend.emails.send({
			from: config.fromAddress,
			to: [config.adminEmail],
			subject: `Low Stock Alert - ${p.productId}${p.available === 0 ? " (Out of Stock)" : ""}`,
			react: LowStockAlertEmail({
				items: [
					{
						productId: p.productId,
						productName: p.productId,
						quantity: p.quantity,
						reserved: p.reserved,
						available: p.available,
						lowStockThreshold: p.lowStockThreshold,
					},
				],
				storeName: config.storeName,
				adminUrl: inventoryUrl,
			}),
		});

		logger.info("Low stock alert email sent", {
			productId: p.productId,
			available: p.available,
			threshold: p.lowStockThreshold,
			to: config.adminEmail,
		});
	};
}

function createBackInStockHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<BackInStockPayload>) => {
		const p = event.payload;
		if (!p.subscribers || p.subscribers.length === 0) {
			return;
		}

		let sent = 0;
		for (const sub of p.subscribers) {
			const productName = sub.productName ?? p.productId;
			await resend.emails.send({
				from: config.fromAddress,
				to: [sub.email],
				subject: `Back in Stock: ${productName}`,
				react: BackInStockEmail({
					productName,
					storeName: config.storeName,
				}),
			});
			sent++;
		}

		logger.info("Back-in-stock notification emails sent", {
			productId: p.productId,
			subscriberCount: sent,
		});
	};
}

function createSubscriptionCreatedHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<SubscriptionCreatedPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn(
				"subscription.created: no email address, skipping notification",
				{ subscriptionId: p.subscriptionId },
			);
			return;
		}

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: `Subscription Confirmed - ${p.planName}`,
			react: SubscriptionCompleteEmail({
				storeName: config.storeName,
			}),
		});

		logger.info("Subscription confirmation email sent", {
			subscriptionId: p.subscriptionId,
			planName: p.planName,
			to: p.email,
		});
	};
}

function createSubscriptionRenewedHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<SubscriptionRenewedPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn(
				"subscription.renewed: no email address, skipping notification",
				{ subscriptionId: p.subscriptionId },
			);
			return;
		}

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: `Subscription Renewed - ${p.planName}`,
			react: SubscriptionUpdateEmail({
				storeName: config.storeName,
			}),
		});

		logger.info("Subscription renewed email sent", {
			subscriptionId: p.subscriptionId,
			planName: p.planName,
			to: p.email,
		});
	};
}

function createSubscriptionCancelledHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<SubscriptionCancelledPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn(
				"subscription.cancelled: no email address, skipping notification",
				{ subscriptionId: p.subscriptionId },
			);
			return;
		}

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: "Subscription Cancelled",
			react: SubscriptionCancelEmail({
				storeName: config.storeName,
			}),
		});

		logger.info("Subscription cancelled email sent", {
			subscriptionId: p.subscriptionId,
			to: p.email,
		});
	};
}

function createCustomerCreatedHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<CustomerCreatedPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn("customer.created: no email address, skipping notification", {
				customerId: p.customerId,
			});
			return;
		}

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: `Welcome to ${config.storeName}!`,
			react: WelcomeEmail({
				storeName: config.storeName,
			}),
		});

		logger.info("Welcome email sent", {
			customerId: p.customerId,
			to: p.email,
		});
	};
}

function createCartAbandonedHandler(
	resend: EmailClient,
	config: NotificationConfig,
) {
	return async (event: ModuleEvent<CartAbandonedPayload>) => {
		const p = event.payload;
		if (!p.email) {
			logger.warn("cart.abandoned: no email address, skipping notification", {
				cartId: p.cartId,
			});
			return;
		}

		const storeUrl = config.adminUrl?.replace(/\/admin\/?$/, "") ?? "";
		const cartUrl = storeUrl ? `${storeUrl}/cart` : "/cart";

		await resend.emails.send({
			from: config.fromAddress,
			to: [p.email],
			subject: `You left something in your cart — ${config.storeName}`,
			react: AbandonedCartEmail({
				cartTotal: p.cartTotal,
				currency: p.currency ?? "USD",
				itemCount: p.itemCount,
				cartUrl,
				storeName: config.storeName,
			}),
		});

		logger.info("Abandoned cart email sent", {
			cartId: p.cartId,
			to: p.email,
		});
	};
}

// ── Registration ─────────────────────────────────────────────────────

/**
 * Register all email notification handlers on the event bus.
 * Should be called once after the module registry boots.
 *
 * @param enabledEvents - Set of event types that are enabled. When undefined, all events are enabled.
 * Returns an unsubscribe function to remove all handlers.
 */
export function registerNotificationHandlers(
	bus: EventBus,
	resend: EmailClient,
	config?: Partial<NotificationConfig> | undefined,
	enabledEvents?: Set<string> | undefined,
): () => void {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	const registeredEvents: string[] = [];
	const unsubs: Array<() => void> = [];
	let totalHandlers = 0;

	function register<T>(
		event: string,
		handler: (e: ModuleEvent<T>) => Promise<void>,
	) {
		totalHandlers += 1;
		if (enabledEvents && !enabledEvents.has(event)) return;
		unsubs.push(bus.on(event, handler));
		registeredEvents.push(event);
	}

	register("inventory.low", createInventoryLowHandler(resend, mergedConfig));
	register(
		"inventory.back-in-stock",
		createBackInStockHandler(resend, mergedConfig),
	);
	register(
		"review.requested",
		createReviewRequestedHandler(resend, mergedConfig),
	);
	register(
		"subscription.created",
		createSubscriptionCreatedHandler(resend, mergedConfig),
	);
	register(
		"subscription.renewed",
		createSubscriptionRenewedHandler(resend, mergedConfig),
	);
	register(
		"subscription.cancelled",
		createSubscriptionCancelledHandler(resend, mergedConfig),
	);
	register(
		"customer.created",
		createCustomerCreatedHandler(resend, mergedConfig),
	);
	register("cart.abandoned", createCartAbandonedHandler(resend, mergedConfig));

	logger.info("Email notification handlers registered", {
		events: registeredEvents,
		skipped: enabledEvents ? totalHandlers - registeredEvents.length : 0,
	});

	return () => {
		for (const unsub of unsubs) {
			unsub();
		}
	};
}
