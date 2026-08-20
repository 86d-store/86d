import { describe, expect, it } from "vitest";
import { buildOrderFulfilledEmail } from "../emails/order-fulfilled";

const basePayload = {
	orderNumber: "ORD-ABC123",
	customerName: "Jane",
};

describe("buildOrderFulfilledEmail", () => {
	it("returns subject with order number", () => {
		const { subject } = buildOrderFulfilledEmail(basePayload);
		expect(subject).toBe("Order ORD-ABC123 has been fulfilled");
	});

	it("includes customer greeting in plain text", () => {
		const { text } = buildOrderFulfilledEmail(basePayload);
		expect(text).toContain("Hi Jane,");
	});

	it("includes fulfillment message in plain text", () => {
		const { text } = buildOrderFulfilledEmail(basePayload);
		expect(text).toContain("has been fulfilled and is on its way");
	});

	it("includes order number in plain text", () => {
		const { text } = buildOrderFulfilledEmail(basePayload);
		expect(text).toContain("ORD-ABC123");
	});

	it("generates valid HTML with order number", () => {
		const { html } = buildOrderFulfilledEmail(basePayload);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Order Fulfilled");
		expect(html).toContain("ORD-ABC123");
	});

	it("includes customer greeting in HTML", () => {
		const { html } = buildOrderFulfilledEmail(basePayload);
		expect(html).toContain("Hi Jane,");
	});

	it("escapes HTML in customer name", () => {
		const { html } = buildOrderFulfilledEmail({
			...basePayload,
			customerName: '<script>alert("xss")</script>',
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes HTML in order number", () => {
		const { html } = buildOrderFulfilledEmail({
			...basePayload,
			orderNumber: 'ORD-<img src="x">',
		});
		expect(html).not.toContain('<img src="x">');
		expect(html).toContain("&lt;img");
	});
});
