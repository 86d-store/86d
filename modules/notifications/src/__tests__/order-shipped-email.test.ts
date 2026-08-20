import { describe, expect, it } from "vitest";
import { buildOrderShippedEmail } from "../emails/order-shipped";

const basePayload = {
	orderNumber: "ORD-SHIP001",
	customerName: "Bob",
};

describe("buildOrderShippedEmail", () => {
	it("returns subject with order number", () => {
		const { subject } = buildOrderShippedEmail(basePayload);
		expect(subject).toBe("Order ORD-SHIP001 has shipped");
	});

	it("includes customer greeting in plain text", () => {
		const { text } = buildOrderShippedEmail(basePayload);
		expect(text).toContain("Hi Bob,");
	});

	it("includes shipped message in plain text", () => {
		const { text } = buildOrderShippedEmail(basePayload);
		expect(text).toContain("Your order has shipped!");
	});

	it("includes carrier in plain text when provided", () => {
		const { text } = buildOrderShippedEmail({
			...basePayload,
			carrier: "UPS",
		});
		expect(text).toContain("Carrier: UPS");
	});

	it("includes tracking number in plain text when provided", () => {
		const { text } = buildOrderShippedEmail({
			...basePayload,
			trackingNumber: "1Z999AA10123456784",
		});
		expect(text).toContain("Tracking number: 1Z999AA10123456784");
	});

	it("includes tracking URL in plain text when provided", () => {
		const { text } = buildOrderShippedEmail({
			...basePayload,
			trackingUrl: "https://track.example.com/1Z999",
		});
		expect(text).toContain("Track your order: https://track.example.com/1Z999");
	});

	it("omits tracking section in plain text when no carrier or tracking", () => {
		const { text } = buildOrderShippedEmail(basePayload);
		expect(text).not.toContain("Carrier:");
		expect(text).not.toContain("Tracking number:");
		expect(text).not.toContain("Track your order:");
	});

	it("generates valid HTML with DOCTYPE", () => {
		const { html } = buildOrderShippedEmail(basePayload);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
		expect(html).toContain("Order Shipped");
	});

	it("includes carrier in HTML tracking section", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			carrier: "FedEx",
		});
		expect(html).toContain("Carrier");
		expect(html).toContain("FedEx");
	});

	it("includes tracking number in HTML tracking section", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			trackingNumber: "TRK-12345",
		});
		expect(html).toContain("Tracking");
		expect(html).toContain("TRK-12345");
	});

	it("includes Track Your Order CTA when trackingUrl provided", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			trackingUrl: "https://track.example.com/abc",
		});
		expect(html).toContain("Track Your Order");
		expect(html).toContain("https://track.example.com/abc");
	});

	it("omits CTA when no trackingUrl", () => {
		const { html } = buildOrderShippedEmail(basePayload);
		expect(html).not.toContain("Track Your Order");
	});

	it("omits tracking section in HTML when no carrier or tracking number", () => {
		const { html } = buildOrderShippedEmail(basePayload);
		// The tracking section has a gray background div
		expect(html).not.toContain("Carrier");
		expect(html).not.toContain("Tracking");
	});

	it("escapes HTML in customer name", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			customerName: '<script>alert("xss")</script>',
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes HTML in carrier name", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			carrier: '<img src="x" onerror="hack()">',
		});
		expect(html).not.toContain('<img src="x"');
		expect(html).toContain("&lt;img");
	});

	it("escapes HTML in tracking URL", () => {
		const { html } = buildOrderShippedEmail({
			...basePayload,
			trackingUrl: '"><script>alert(1)</script>',
		});
		expect(html).not.toContain('"><script>');
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	it("includes all tracking details together", () => {
		const { text, html } = buildOrderShippedEmail({
			...basePayload,
			carrier: "USPS",
			trackingNumber: "9400111899223456789012",
			trackingUrl:
				"https://tools.usps.com/go/TrackConfirmAction?tRef=ft&tLc=2&tLabels=9400111899223456789012",
		});
		expect(text).toContain("Carrier: USPS");
		expect(text).toContain("Tracking number: 9400111899223456789012");
		expect(text).toContain("Track your order:");
		expect(html).toContain("USPS");
		expect(html).toContain("9400111899223456789012");
		expect(html).toContain("Track Your Order");
	});
});
