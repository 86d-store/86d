import { describe, expect, it } from "vitest";
import { buildCartRecoveryEmail } from "../emails/cart-recovery";

const baseData = {
	items: [
		{ name: "Classic Burger", quantity: 2, price: 1299 },
		{ name: "Fries", quantity: 1, price: 499 },
	],
	cartTotal: 3097,
	currency: "usd",
	recoveryUrl: "/abandoned-carts/recover/tok_abc123",
};

describe("buildCartRecoveryEmail", () => {
	it("returns default subject when none provided", () => {
		const { subject } = buildCartRecoveryEmail(baseData);
		expect(subject).toBe("You left something behind!");
	});

	it("uses custom subject when provided", () => {
		const { subject } = buildCartRecoveryEmail({
			...baseData,
			subject: "Come back!",
		});
		expect(subject).toBe("Come back!");
	});

	it("includes item names in plain text", () => {
		const { text } = buildCartRecoveryEmail(baseData);
		expect(text).toContain("Classic Burger");
		expect(text).toContain("Fries");
	});

	it("includes line totals (price * quantity) in plain text", () => {
		const { text } = buildCartRecoveryEmail(baseData);
		// 1299 * 2 = 2598 cents = 25.98 USD
		expect(text).toContain("25.98 USD");
		// 499 * 1 = 499 cents = 4.99 USD
		expect(text).toContain("4.99 USD");
	});

	it("includes cart total in plain text", () => {
		const { text } = buildCartRecoveryEmail(baseData);
		expect(text).toContain("30.97 USD");
	});

	it("includes recovery URL in plain text", () => {
		const { text } = buildCartRecoveryEmail(baseData);
		expect(text).toContain("/abandoned-carts/recover/tok_abc123");
	});

	it("generates valid HTML with DOCTYPE", () => {
		const { html } = buildCartRecoveryEmail(baseData);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});

	it("includes item table in HTML", () => {
		const { html } = buildCartRecoveryEmail(baseData);
		expect(html).toContain("Classic Burger");
		expect(html).toContain("Fries");
		expect(html).toContain("<table");
	});

	it("includes CTA link in HTML", () => {
		const { html } = buildCartRecoveryEmail(baseData);
		expect(html).toContain("Complete Your Purchase");
		expect(html).toContain("/abandoned-carts/recover/tok_abc123");
	});

	it("includes cart total in HTML", () => {
		const { html } = buildCartRecoveryEmail(baseData);
		expect(html).toContain("30.97 USD");
	});

	it("uppercases currency code", () => {
		const { text, html } = buildCartRecoveryEmail(baseData);
		expect(text).toContain("USD");
		expect(html).toContain("USD");
	});

	it("escapes HTML in item names", () => {
		const { html } = buildCartRecoveryEmail({
			...baseData,
			items: [
				{ name: '<script>alert("xss")</script>', quantity: 1, price: 100 },
			],
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes HTML in recovery URL", () => {
		const { html } = buildCartRecoveryEmail({
			...baseData,
			recoveryUrl: '"><script>alert(1)</script>',
		});
		expect(html).not.toContain('"><script>');
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	it("handles single item", () => {
		const { text, html } = buildCartRecoveryEmail({
			...baseData,
			items: [{ name: "Widget", quantity: 1, price: 500 }],
			cartTotal: 500,
		});
		expect(text).toContain("Widget");
		expect(text).toContain("5.00 USD");
		expect(html).toContain("Widget");
	});

	it("handles items with imageUrl", () => {
		const data = {
			...baseData,
			items: [
				{
					name: "Photo Item",
					quantity: 1,
					price: 1000,
					imageUrl: "https://example.com/img.jpg",
				},
			],
		};
		// Should not crash — imageUrl is accepted but not rendered in email
		const { text, html } = buildCartRecoveryEmail(data);
		expect(text).toContain("Photo Item");
		expect(html).toContain("Photo Item");
	});
});
