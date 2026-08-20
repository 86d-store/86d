import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "../templates/styles";

describe("formatCurrency", () => {
	it("formats cents to USD dollars", () => {
		expect(formatCurrency(1999)).toBe("$19.99");
	});

	it("formats zero cents", () => {
		expect(formatCurrency(0)).toBe("$0.00");
	});

	it("formats whole dollar amounts", () => {
		expect(formatCurrency(10000)).toBe("$100.00");
	});

	it("formats single cent", () => {
		expect(formatCurrency(1)).toBe("$0.01");
	});

	it("formats large amounts with comma separators", () => {
		expect(formatCurrency(1234567)).toBe("$12,345.67");
	});

	it("uses EUR when specified", () => {
		const result = formatCurrency(2500, "EUR");
		expect(result).toContain("25");
	});

	it("uses GBP when specified", () => {
		const result = formatCurrency(2500, "GBP");
		expect(result).toContain("25");
	});

	it("uppercases currency code", () => {
		// Should not throw for lowercase currency
		const result = formatCurrency(1000, "usd");
		expect(result).toBe("$10.00");
	});
});

describe("formatDate", () => {
	it("formats a Date object", () => {
		const result = formatDate(new Date(2025, 0, 15));
		expect(result).toContain("January");
		expect(result).toContain("15");
		expect(result).toContain("2025");
	});

	it("formats an ISO date string", () => {
		const result = formatDate("2024-12-25T10:00:00Z");
		expect(result).toContain("December");
		expect(result).toContain("2024");
	});

	it("formats a date-only string", () => {
		const result = formatDate("2023-06-01");
		expect(result).toContain("2023");
	});

	it("returns a human-readable string with month name", () => {
		const result = formatDate(new Date(2025, 2, 26));
		expect(result).toContain("March");
		expect(result).toContain("26");
	});
});
