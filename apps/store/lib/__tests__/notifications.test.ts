import { createEventBus } from "@86d-app/core/events";
import { describe, expect, it, vi } from "vitest";

vi.mock("emails/abandoned-cart", () => ({
	default: vi.fn(() => "AbandonedCartEmail"),
}));
vi.mock("emails/back-in-stock", () => ({
	default: vi.fn(() => "BackInStockEmail"),
}));
vi.mock("emails/low-stock-alert", () => ({
	default: vi.fn(() => "LowStockAlert"),
}));
vi.mock("emails/review-request", () => ({
	default: vi.fn(() => "ReviewRequest"),
}));
vi.mock("emails/subscription-cancel", () => ({
	default: vi.fn(() => "SubscriptionCancel"),
}));
vi.mock("emails/subscription-complete", () => ({
	default: vi.fn(() => "SubscriptionComplete"),
}));
vi.mock("emails/subscription-update", () => ({
	default: vi.fn(() => "SubscriptionUpdate"),
}));
vi.mock("emails/welcome", () => ({
	default: vi.fn(() => "WelcomeEmail"),
}));
vi.mock("utils/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "utils/logger";
import { registerNotificationHandlers } from "../notifications";

type EmailMessage = {
	from: string;
	to: string[];
	subject: string;
	react: unknown;
};

function createMockResend() {
	return {
		emails: {
			send: vi.fn(async (_message: EmailMessage) => ({ id: "email-1" })),
		},
	};
}

const CONFIG = {
	fromAddress: "Test Store <orders@test.com>",
	storeName: "Test Store",
	adminEmail: "admin@test.com",
	adminUrl: "https://store.example.com/admin",
};

const NON_CRITICAL_EVENTS = [
	"inventory.low",
	"inventory.back-in-stock",
	"review.requested",
	"subscription.created",
	"subscription.renewed",
	"subscription.cancelled",
	"customer.created",
	"cart.abandoned",
] as const;

const COMMERCE_CRITICAL_EVENTS = [
	"checkout.completed",
	"order.shipped",
	"order.fulfilled",
	"order.cancelled",
	"payment.refunded",
	"shipment.delivered",
	"return.approved",
	"payment.failed",
] as const;

const NON_CRITICAL_CASES = [
	{
		event: "inventory.low",
		source: "inventory",
		payload: {
			productId: "product-1",
			quantity: 3,
			reserved: 1,
			available: 2,
			lowStockThreshold: 5,
		},
		to: "admin@test.com",
		subject: "Low Stock Alert - product-1",
	},
	{
		event: "inventory.back-in-stock",
		source: "inventory",
		payload: {
			productId: "product-1",
			available: 10,
			subscribers: [
				{ email: "shopper@example.com", productName: "Blue Widget" },
			],
		},
		to: "shopper@example.com",
		subject: "Back in Stock: Blue Widget",
	},
	{
		event: "review.requested",
		source: "reviews",
		payload: {
			orderId: "order-1",
			orderNumber: "ORD-1",
			email: "shopper@example.com",
			customerName: "Ada",
			items: [{ productId: "product-1", name: "Blue Widget" }],
		},
		to: "shopper@example.com",
		subject: "How Was Your Order? - ORD-1",
	},
	{
		event: "subscription.created",
		source: "subscriptions",
		payload: {
			subscriptionId: "subscription-1",
			planId: "plan-1",
			planName: "Pro",
			email: "member@example.com",
			status: "active",
			interval: "month",
			price: 2_999,
			currency: "USD",
		},
		to: "member@example.com",
		subject: "Subscription Confirmed - Pro",
	},
	{
		event: "subscription.renewed",
		source: "subscriptions",
		payload: {
			subscriptionId: "subscription-1",
			planId: "plan-1",
			planName: "Pro",
			email: "member@example.com",
			currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
			currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
		},
		to: "member@example.com",
		subject: "Subscription Renewed - Pro",
	},
	{
		event: "subscription.cancelled",
		source: "subscriptions",
		payload: {
			subscriptionId: "subscription-1",
			planId: "plan-1",
			email: "member@example.com",
			cancelledAt: new Date("2026-08-13T00:00:00.000Z"),
		},
		to: "member@example.com",
		subject: "Subscription Cancelled",
	},
	{
		event: "customer.created",
		source: "customers",
		payload: {
			customerId: "customer-1",
			email: "new@example.com",
			firstName: "Ada",
			lastName: "Lovelace",
		},
		to: "new@example.com",
		subject: "Welcome to Test Store!",
	},
	{
		event: "cart.abandoned",
		source: "cart",
		payload: {
			cartId: "cart-1",
			email: "shopper@example.com",
			cartTotal: 2_500,
			currency: "USD",
			itemCount: 2,
		},
		to: "shopper@example.com",
		subject: "You left something in your cart — Test Store",
	},
] as const;

describe("registerNotificationHandlers", () => {
	it("registers exactly the eight non-critical local handlers", () => {
		const bus = createEventBus();
		registerNotificationHandlers(bus, createMockResend(), CONFIG);

		expect(bus.listenerCount()).toBe(8);
		for (const event of NON_CRITICAL_EVENTS) {
			expect(bus.listenerCount(event), event).toBe(1);
		}
		for (const event of COMMERCE_CRITICAL_EVENTS) {
			expect(bus.listenerCount(event), event).toBe(0);
		}
	});

	it("unsubscribes all eight local handlers", () => {
		const bus = createEventBus();
		const unsubscribe = registerNotificationHandlers(
			bus,
			createMockResend(),
			CONFIG,
		);

		expect(bus.listenerCount()).toBe(8);
		unsubscribe();
		expect(bus.listenerCount()).toBe(0);
	});

	it("cannot re-enable a commerce-critical handler through the event filter", () => {
		const bus = createEventBus();
		registerNotificationHandlers(
			bus,
			createMockResend(),
			CONFIG,
			new Set(["checkout.completed", "customer.created"]),
		);

		expect(bus.listenerCount()).toBe(1);
		expect(bus.listenerCount("customer.created")).toBe(1);
		expect(bus.listenerCount("checkout.completed")).toBe(0);
	});

	it.each(NON_CRITICAL_CASES)(
		"keeps $event as a best-effort local notification",
		async ({ event, source, payload, to, subject }) => {
			const bus = createEventBus();
			const resend = createMockResend();
			registerNotificationHandlers(bus, resend, CONFIG);

			await bus.emit(event, source, payload);

			expect(resend.emails.send).toHaveBeenCalledOnce();
			expect(resend.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					from: CONFIG.fromAddress,
					to: [to],
					subject,
				}),
			);
		},
	);

	it("has zero local effects for commerce-critical events", async () => {
		const bus = createEventBus();
		const resend = createMockResend();
		registerNotificationHandlers(bus, resend, CONFIG);
		vi.clearAllMocks();

		for (const event of COMMERCE_CRITICAL_EVENTS) {
			await bus.emit(event, "commerce-test", { id: `${event}-1` });
		}

		expect(resend.emails.send).not.toHaveBeenCalled();
		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});
});
