import { describe, expect, it } from "vitest";
import { buildAppointmentStatusEmail } from "../emails/appointment-status";

const BASE = {
	customerName: "Alice Smith",
	serviceName: "Deep Tissue Massage",
	startsAt: new Date("2026-06-15T14:00:00Z"),
};

describe("buildAppointmentStatusEmail", () => {
	it("created: returns correct subject", () => {
		const { subject } = buildAppointmentStatusEmail({
			...BASE,
			status: "created",
		});
		expect(subject).toBe("Appointment Request Received");
	});

	it("confirmed: returns correct subject", () => {
		const { subject } = buildAppointmentStatusEmail({
			...BASE,
			status: "confirmed",
		});
		expect(subject).toBe("Appointment Confirmed");
	});

	it("cancelled: returns correct subject", () => {
		const { subject } = buildAppointmentStatusEmail({
			...BASE,
			status: "cancelled",
		});
		expect(subject).toBe("Appointment Cancelled");
	});

	it("includes service name in html and text", () => {
		const { html, text } = buildAppointmentStatusEmail({
			...BASE,
			status: "confirmed",
		});
		expect(html).toContain("Deep Tissue Massage");
		expect(text).toContain("Deep Tissue Massage");
	});

	it("includes customer name in html and text", () => {
		const { html, text } = buildAppointmentStatusEmail({
			...BASE,
			status: "confirmed",
		});
		expect(html).toContain("Alice Smith");
		expect(text).toContain("Alice Smith");
	});

	it("includes staff name when provided", () => {
		const { html, text } = buildAppointmentStatusEmail({
			...BASE,
			status: "confirmed",
			staffName: "Bob Johnson",
		});
		expect(html).toContain("Bob Johnson");
		expect(text).toContain("Bob Johnson");
	});

	it("omits staff name row when not provided", () => {
		const { html } = buildAppointmentStatusEmail({
			...BASE,
			status: "confirmed",
		});
		expect(html).not.toContain("Staff");
	});

	it("escapes html in service name", () => {
		const { html } = buildAppointmentStatusEmail({
			...BASE,
			status: "created",
			serviceName: "<Script> & Test",
		});
		expect(html).not.toContain("<Script>");
		expect(html).toContain("&lt;Script&gt; &amp; Test");
	});

	it("includes html and text fields", () => {
		const result = buildAppointmentStatusEmail({
			...BASE,
			status: "created",
		});
		expect(result.html).toContain("<!DOCTYPE html>");
		expect(result.text.length).toBeGreaterThan(10);
	});
});
