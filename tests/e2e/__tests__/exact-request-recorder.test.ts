import { describe, expect, it } from "vitest";
import {
	assertCanonicalBasePriceRequest,
	createExactlyOnceRequestRecorder,
} from "../fixtures/exact-request-recorder";

describe("exact request recorder", () => {
	it("fails synchronously when a matching request is recorded twice", () => {
		const recorder = createExactlyOnceRequestRecorder("pickup windows");
		recorder.record(
			"https://store.example/api/store-pickup/locations/one/windows?date=2026-08-25",
		);

		expect(() =>
			recorder.record(
				"https://store.example/api/store-pickup/locations/one/windows?date=2026-08-25",
			),
		).toThrow("pickup windows request was issued more than once");
	});

	it("fails closed until exactly one request has been recorded", () => {
		const recorder = createExactlyOnceRequestRecorder("bulk pricing tiers");

		expect(() => recorder.only()).toThrow(
			"Expected exactly one bulk pricing tiers request, received 0",
		);

		const expected = new URL(
			"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=2999",
		);
		recorder.record(expected.toString());

		expect(recorder.only()).toEqual(expected);
		expect(recorder.all()).toEqual([expected]);
	});
});

describe("Bulk Pricing request contract", () => {
	it.each(["0", "1", "2999"])(
		"accepts canonical non-negative integer cents %s",
		(basePrice) => {
			const url = new URL(
				`https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=${basePrice}`,
			);

			expect(assertCanonicalBasePriceRequest(url)).toBe(Number(basePrice));
		},
	);

	it.each([
		"https://store.example/api/bulk-pricing/product/product-1/tiers",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=01",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=1.5",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=-1",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=NaN",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=2999&debug=true",
		"https://store.example/api/bulk-pricing/product/product-1/tiers?basePrice=2999&basePrice=3999",
	])("rejects non-canonical or ambiguous requests: %s", (rawUrl) => {
		expect(() => assertCanonicalBasePriceRequest(new URL(rawUrl))).toThrow();
	});
});
