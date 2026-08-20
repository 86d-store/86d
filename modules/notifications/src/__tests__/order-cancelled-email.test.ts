import { describe, expect, it } from "vitest";
import { buildOrderCancelledEmail } from "../emails/order-cancelled";

const basePayload = {
	orderNumber: "ORD-XYZ789",
	customerName: "Alice",
};

describe("buildOrderCancelledEmail", () => {
	it("returns subject with order number", () => {
		const { subject } = buildOrderCancelledEmail(basePayload);
		expect(subject).toBe("Order ORD-XYZ789 has been cancelled");
	});

	it("includes customer greeting in plain text", () => {
		const { text } = buildOrderCancelledEmail(basePayload);
		expect(text).toContain("Hi Alice,");
	});

	it("includes cancellation message in plain text", () => {
		const { text } = buildOrderCancelledEmail(basePayload);
		expect(text).toContain("has been cancelled");
	});

	it("includes refund information in plain text", () => {
		const { text } = buildOrderCancelledEmail(basePayload);
		expect(text).toContain("refund will be processed automatically");
	});

	it("omits reason when not provided", () => {
		const { text } = buildOrderCancelledEmail(basePayload);
		expect(text).not.toContain("Reason:");
	});

	it("includes reason when provided", () => {
		const { text, html } = buildOrderCancelledEmail({
			...basePayload,
			reason: "Out of stock",
		});
		expect(text).toContain("Reason: Out of stock");
		expect(html).toContain("Out of stock");
	});

	it("generates valid HTML", () => {
		const { html } = buildOrderCancelledEmail(basePayload);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Order Cancelled");
		expect(html).toContain("ORD-XYZ789");
	});

	it("includes reason block in HTML when reason is provided", () => {
		const { html } = buildOrderCancelledEmail({
			...basePayload,
			reason: "Item unavailable",
		});
		expect(html).toContain("Reason:");
		expect(html).toContain("Item unavailable");
	});

	it("omits reason block in HTML when no reason", () => {
		const { html } = buildOrderCancelledEmail(basePayload);
		expect(html).not.toContain("Reason:");
	});

	it("escapes HTML in customer name and reason", () => {
		const { html } = buildOrderCancelledEmail({
			...basePayload,
			customerName: '<script>alert("xss")</script>',
			reason: '<img src="x" onerror="hack()">',
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain('<img src="x"');
		expect(html).toContain("&lt;img");
	});

	it("includes refund information in HTML", () => {
		const { html } = buildOrderCancelledEmail(basePayload);
		expect(html).toContain("refund will be processed automatically");
	});
});
