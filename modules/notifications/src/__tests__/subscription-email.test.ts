import { describe, expect, it } from "vitest";
import { buildSubscriptionStatusEmail } from "../emails/subscription-status";

const BASE = {
	customerEmail: "alice@example.com",
	planName: "Pro Monthly",
};

describe("buildSubscriptionStatusEmail", () => {
	it("created: returns correct subject", () => {
		const { subject } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
		});
		expect(subject).toBe("Subscription Confirmed");
	});

	it("cancelled: returns correct subject", () => {
		const { subject } = buildSubscriptionStatusEmail({
			...BASE,
			status: "cancelled",
		});
		expect(subject).toBe("Subscription Cancelled");
	});

	it("renewed: returns correct subject", () => {
		const { subject } = buildSubscriptionStatusEmail({
			...BASE,
			status: "renewed",
		});
		expect(subject).toBe("Subscription Renewed");
	});

	it("includes plan name in html and text", () => {
		const { html, text } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
		});
		expect(html).toContain("Pro Monthly");
		expect(text).toContain("Pro Monthly");
	});

	it("includes price when provided", () => {
		const { html, text } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
			price: 999,
			currency: "usd",
		});
		expect(html).toContain("9.99");
		expect(text).toContain("9.99");
	});

	it("omits price row when not provided", () => {
		const { html } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
		});
		expect(html).not.toContain("Amount");
	});

	it("includes next billing date when provided", () => {
		const nextDate = new Date("2026-07-15");
		const { html, text } = buildSubscriptionStatusEmail({
			...BASE,
			status: "renewed",
			nextBillingDate: nextDate,
		});
		expect(html).toContain("July");
		expect(text).toContain("Next billing");
	});

	it("returns valid html structure", () => {
		const { html } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
		});
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});

	it("escapes html in plan name", () => {
		const { html } = buildSubscriptionStatusEmail({
			...BASE,
			status: "created",
			planName: "<Bold> & Plan",
		});
		expect(html).not.toContain("<Bold>");
		expect(html).toContain("&lt;Bold&gt; &amp; Plan");
	});
});
