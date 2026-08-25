import { describe, expect, it } from "vitest";
import { createAdminQueryRecorder } from "../fixtures/admin-query-recorder";

describe("admin query recorder", () => {
	it("counts only requests with the exact path and URLSearchParams", () => {
		const recorder = createAdminQueryRecorder();

		recorder.record(
			"https://store.example/api/admin/analytics/stats?since=2026-07-26T12%3A00%3A00.000Z",
		);
		recorder.record(
			"https://store.example/api/admin/analytics/stats?since=2026-07-26T12%3A00%3A00.000Z&since=duplicate",
		);
		recorder.record(
			"https://store.example/api/admin/analytics/stats?since=2026-07-26T12%3A00%3A00.000Z&debug=true",
		);
		recorder.record(
			"https://store.example/api/admin/analytics/top-products?since=2026-07-26T12%3A00%3A00.000Z",
		);

		const expected = new URLSearchParams({
			since: "2026-07-26T12:00:00.000Z",
		});

		expect(recorder.countExact("/api/admin/analytics/stats", expected)).toBe(1);
		expect(recorder.countPath("/api/admin/analytics/stats")).toBe(3);
	});

	it("treats query parameter order as immaterial", () => {
		const recorder = createAdminQueryRecorder();
		recorder.record(
			"https://store.example/api/admin/revenue/stats?to=2026-08-25T12%3A00%3A00.000Z&from=2026-07-26T12%3A00%3A00.000Z",
		);

		const expected = new URLSearchParams({
			from: "2026-07-26T12:00:00.000Z",
			to: "2026-08-25T12:00:00.000Z",
		});

		expect(recorder.countExact("/api/admin/revenue/stats", expected)).toBe(1);
	});
});
