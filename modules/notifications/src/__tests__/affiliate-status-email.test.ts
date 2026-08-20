import { describe, expect, it } from "vitest";
import { buildAffiliateStatusEmail } from "../emails/affiliate-status";

describe("buildAffiliateStatusEmail", () => {
	it("submitted — application received messaging", () => {
		const { subject, html, text } = buildAffiliateStatusEmail({
			status: "submitted",
			name: "Jane Doe",
		});
		expect(subject).toBe("Affiliate Application Received");
		expect(text).toContain("Application Received");
		expect(text).toContain("Hi Jane Doe");
		expect(html).toContain("Jane Doe");
		expect(html).toContain("Application Received");
	});

	it("approved — welcome messaging", () => {
		const { subject, html, text } = buildAffiliateStatusEmail({
			status: "approved",
			name: "John Smith",
		});
		expect(subject).toBe("Welcome to Our Affiliate Program!");
		expect(text).toContain("Application Approved");
		expect(html).toContain("Application Approved");
		expect(html).toContain("John Smith");
	});

	it("rejected — not approved messaging", () => {
		const { subject, html, text } = buildAffiliateStatusEmail({
			status: "rejected",
			name: "Alex Nguyen",
		});
		expect(subject).toBe("Affiliate Application Update");
		expect(text).toContain("Application Not Approved");
		expect(html).toContain("Application Not Approved");
	});

	it("escapes HTML in name", () => {
		const { html } = buildAffiliateStatusEmail({
			status: "approved",
			name: '<script>alert("xss")</script>',
		});
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});
