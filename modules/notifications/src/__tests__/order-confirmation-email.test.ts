import { describe, expect, it } from "vitest";
import { buildOrderConfirmationEmail } from "../emails/order-confirmation";

const basePayload = {
	orderNumber: "ORD-ABC123",
	customerName: "Jane",
	items: [
		{ name: "Widget", quantity: 2, price: 1500 },
		{ name: "Gadget", quantity: 1, price: 3000 },
	],
	subtotal: 6000,
	taxAmount: 480,
	shippingAmount: 500,
	discountAmount: 0,
	giftCardAmount: 0,
	total: 6980,
	currency: "usd",
};

describe("buildOrderConfirmationEmail", () => {
	it("returns subject with order number", () => {
		const { subject } = buildOrderConfirmationEmail(basePayload);
		expect(subject).toBe("Order ORD-ABC123 confirmed");
	});

	it("includes item names and quantities in plain text", () => {
		const { text } = buildOrderConfirmationEmail(basePayload);
		expect(text).toContain("Widget x2");
		expect(text).toContain("Gadget x1");
	});

	it("includes formatted totals in plain text", () => {
		const { text } = buildOrderConfirmationEmail(basePayload);
		expect(text).toContain("Subtotal: 60.00 USD");
		expect(text).toContain("Tax: 4.80 USD");
		expect(text).toContain("Shipping: 5.00 USD");
		expect(text).toContain("Total: 69.80 USD");
	});

	it("omits zero-value lines", () => {
		const { text } = buildOrderConfirmationEmail(basePayload);
		expect(text).not.toContain("Discount");
		expect(text).not.toContain("Gift card");
	});

	it("shows discount and gift card when present", () => {
		const { text } = buildOrderConfirmationEmail({
			...basePayload,
			discountAmount: 500,
			giftCardAmount: 1000,
			total: 5480,
		});
		expect(text).toContain("Discount: -5.00 USD");
		expect(text).toContain("Gift card: -10.00 USD");
	});

	it("includes shipping address in text when provided", () => {
		const { text } = buildOrderConfirmationEmail({
			...basePayload,
			shippingAddress: {
				firstName: "Jane",
				lastName: "Doe",
				line1: "123 Main St",
				line2: "Apt 4",
				city: "Springfield",
				state: "IL",
				postalCode: "62704",
				country: "US",
			},
		});
		expect(text).toContain("Shipping to:");
		expect(text).toContain("Jane Doe");
		expect(text).toContain("123 Main St");
		expect(text).toContain("Apt 4");
		expect(text).toContain("Springfield, IL, 62704");
		expect(text).toContain("US");
	});

	it("omits shipping address section when not provided", () => {
		const { text } = buildOrderConfirmationEmail(basePayload);
		expect(text).not.toContain("Shipping to:");
	});

	it("generates valid HTML with item rows", () => {
		const { html } = buildOrderConfirmationEmail(basePayload);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Order Confirmed");
		expect(html).toContain("ORD-ABC123");
		expect(html).toContain("Widget");
		expect(html).toContain("Gadget");
		expect(html).toContain("69.80 USD");
	});

	it("escapes HTML in customer name and item names", () => {
		const { html } = buildOrderConfirmationEmail({
			...basePayload,
			customerName: '<script>alert("xss")</script>',
			items: [{ name: "Item <b>bold</b>", quantity: 1, price: 100 }],
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<b>bold</b>");
		expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
	});

	it("includes customer greeting in HTML", () => {
		const { html } = buildOrderConfirmationEmail(basePayload);
		expect(html).toContain("Hi Jane,");
	});

	it("includes shipping address in HTML when provided", () => {
		const { html } = buildOrderConfirmationEmail({
			...basePayload,
			shippingAddress: {
				firstName: "Jane",
				lastName: "Doe",
				line1: "123 Main St",
				city: "Portland",
				state: "OR",
				postalCode: "97201",
				country: "US",
			},
		});
		expect(html).toContain("Shipping to");
		expect(html).toContain("Jane Doe");
		expect(html).toContain("123 Main St");
	});

	it("handles different currencies", () => {
		const { text, html } = buildOrderConfirmationEmail({
			...basePayload,
			currency: "eur",
			total: 5000,
		});
		expect(text).toContain("50.00 EUR");
		expect(html).toContain("50.00 EUR");
	});
});
