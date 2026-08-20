import { describe, expect, it } from "vitest";
import { buildQuoteStatusEmail } from "../emails/quote-status";

describe("buildQuoteStatusEmail", () => {
	it("submitted — subject and key content", () => {
		const { subject, html, text } = buildQuoteStatusEmail({
			status: "submitted",
			quoteId: "q_123",
			total: 5000,
			currency: "usd",
		});
		expect(subject).toBe("Quote Request Received");
		expect(text).toContain("Quote Request Received");
		expect(text).toContain("Quote ID: q_123");
		expect(text).toContain("50.00 USD");
		expect(html).toContain("Quote Request Received");
		expect(html).toContain("q_123");
		expect(html).toContain("50.00 USD");
	});

	it("reviewed — subject and message", () => {
		const { subject, text } = buildQuoteStatusEmail({
			status: "reviewed",
			quoteId: "q_456",
		});
		expect(subject).toBe("Your Quote Is Ready");
		expect(text).toContain("Your Quote Is Ready");
		expect(text).toContain("q_456");
	});

	it("accepted — subject and message", () => {
		const { subject, text } = buildQuoteStatusEmail({
			status: "accepted",
			quoteId: "q_789",
			total: 12500,
		});
		expect(subject).toBe("Quote Accepted");
		expect(text).toContain("Quote Accepted");
		expect(text).toContain("125.00 USD");
	});

	it("rejected — includes reason when provided", () => {
		const { subject, html, text } = buildQuoteStatusEmail({
			status: "rejected",
			quoteId: "q_999",
			reason: "Items no longer in stock",
		});
		expect(subject).toBe("Quote Declined");
		expect(text).toContain("Quote Declined");
		expect(text).toContain("Reason: Items no longer in stock");
		expect(html).toContain("Items no longer in stock");
	});

	it("converted — order confirmed messaging", () => {
		const { subject, text } = buildQuoteStatusEmail({
			status: "converted",
			quoteId: "q_111",
			total: 8000,
			currency: "gbp",
		});
		expect(subject).toBe("Quote Converted to Order");
		expect(text).toContain("Your Order Is Confirmed");
		expect(text).toContain("80.00 GBP");
	});

	it("escapes HTML in quoteId", () => {
		const { html } = buildQuoteStatusEmail({
			status: "submitted",
			quoteId: '<script>alert("xss")</script>',
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("omits total row when total not provided", () => {
		const { html, text } = buildQuoteStatusEmail({
			status: "reviewed",
			quoteId: "q_no_total",
		});
		expect(html).not.toContain("Total");
		expect(text).not.toContain("Total:");
	});
});
