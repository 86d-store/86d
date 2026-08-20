import { describe, expect, it } from "vitest";
import { buildReturnStatusEmail } from "../emails/return-status";

const baseData = {
	orderNumber: "ORD-RET001",
	customerName: "Alice",
};

describe("buildReturnStatusEmail", () => {
	describe("status: requested", () => {
		it("returns subject with order number", () => {
			const { subject } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
			});
			expect(subject).toBe("Return for order ORD-RET001 — received");
		});

		it("includes received message in text", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
			});
			expect(text).toContain("We've received your return request");
		});

		it("includes reason in text when provided", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
				reason: "Defective product",
			});
			expect(text).toContain("Reason: Defective product");
		});

		it("includes reason in HTML when provided", () => {
			const { html } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
				reason: "Wrong size",
			});
			expect(html).toContain("Reason:");
			expect(html).toContain("Wrong size");
		});

		it("omits reason when not provided", () => {
			const { text, html } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
			});
			expect(text).not.toContain("Reason:");
			expect(html).not.toContain("Reason:");
		});
	});

	describe("status: approved", () => {
		it("returns subject with approved", () => {
			const { subject } = buildReturnStatusEmail({
				...baseData,
				status: "approved",
			});
			expect(subject).toBe("Return for order ORD-RET001 — approved");
		});

		it("includes approval message", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "approved",
			});
			expect(text).toContain("has been approved");
		});

		it("includes heading in HTML", () => {
			const { html } = buildReturnStatusEmail({
				...baseData,
				status: "approved",
			});
			expect(html).toContain("Return Request Approved");
		});
	});

	describe("status: rejected", () => {
		it("returns subject with update", () => {
			const { subject } = buildReturnStatusEmail({
				...baseData,
				status: "rejected",
			});
			expect(subject).toBe("Return for order ORD-RET001 — update");
		});

		it("includes rejection message", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "rejected",
			});
			expect(text).toContain("unable to approve");
		});

		it("includes admin notes when provided", () => {
			const { text, html } = buildReturnStatusEmail({
				...baseData,
				status: "rejected",
				adminNotes: "Item was used beyond return window",
			});
			expect(text).toContain("Note: Item was used beyond return window");
			expect(html).toContain("Item was used beyond return window");
		});

		it("omits admin notes when not provided", () => {
			const { text, html } = buildReturnStatusEmail({
				...baseData,
				status: "rejected",
			});
			expect(text).not.toContain("Note:");
			expect(html).not.toContain("<strong>Note:</strong>");
		});
	});

	describe("status: completed", () => {
		it("returns subject with completed", () => {
			const { subject } = buildReturnStatusEmail({
				...baseData,
				status: "completed",
			});
			expect(subject).toBe("Return for order ORD-RET001 — completed");
		});

		it("includes completion message", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "completed",
			});
			expect(text).toContain("fully processed");
		});

		it("mentions refund timeline", () => {
			const { text } = buildReturnStatusEmail({
				...baseData,
				status: "completed",
			});
			expect(text).toContain("few business days");
		});
	});

	describe("common behavior", () => {
		it("generates valid HTML for all statuses", () => {
			for (const status of [
				"requested",
				"approved",
				"rejected",
				"completed",
			] as const) {
				const { html } = buildReturnStatusEmail({ ...baseData, status });
				expect(html).toContain("<!DOCTYPE html>");
				expect(html).toContain("</html>");
				expect(html).toContain("ORD-RET001");
			}
		});

		it("includes customer greeting in all statuses", () => {
			for (const status of [
				"requested",
				"approved",
				"rejected",
				"completed",
			] as const) {
				const { text } = buildReturnStatusEmail({ ...baseData, status });
				expect(text).toContain("Hi Alice,");
			}
		});

		it("escapes HTML in customer name", () => {
			const { html } = buildReturnStatusEmail({
				...baseData,
				status: "approved",
				customerName: '<script>alert("xss")</script>',
			});
			expect(html).not.toContain("<script>");
			expect(html).toContain("&lt;script&gt;");
		});

		it("escapes HTML in order number", () => {
			const { html } = buildReturnStatusEmail({
				status: "requested",
				orderNumber: '"><img src=x>',
				customerName: "Test",
			});
			expect(html).not.toContain("<img");
			expect(html).toContain("&lt;img");
		});

		it("escapes HTML in reason", () => {
			const { html } = buildReturnStatusEmail({
				...baseData,
				status: "requested",
				reason: "<script>hack()</script>",
			});
			expect(html).not.toContain("<script>hack");
			expect(html).toContain("&lt;script&gt;");
		});

		it("escapes HTML in admin notes", () => {
			const { html } = buildReturnStatusEmail({
				...baseData,
				status: "rejected",
				adminNotes: '<img onerror="alert(1)">',
			});
			expect(html).not.toContain("<img onerror");
			expect(html).toContain("&lt;img");
		});
	});
});
