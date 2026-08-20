import { describe, expect, it } from "vitest";
import { getTrackingUrl } from "../carrier-tracking";

describe("getTrackingUrl", () => {
	it("returns UPS tracking URL", () => {
		const url = getTrackingUrl("ups", "1Z999AA10123456784");
		expect(url).toBe("https://www.ups.com/track?tracknum=1Z999AA10123456784");
	});

	it("returns FedEx tracking URL", () => {
		const url = getTrackingUrl("fedex", "123456789012");
		expect(url).toBe("https://www.fedex.com/fedextrack/?trknbr=123456789012");
	});

	it("returns USPS tracking URL", () => {
		const url = getTrackingUrl("usps", "9400111899223033005282");
		expect(url).toBe(
			"https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223033005282",
		);
	});

	it("returns DHL tracking URL", () => {
		const url = getTrackingUrl("dhl", "1234567890");
		expect(url).toBe(
			"https://www.dhl.com/en/express/tracking.html?AWB=1234567890",
		);
	});

	it("is case-insensitive for carrier name", () => {
		expect(getTrackingUrl("UPS", "123")).toBe(
			"https://www.ups.com/track?tracknum=123",
		);
		expect(getTrackingUrl("FedEx", "456")).toBe(
			"https://www.fedex.com/fedextrack/?trknbr=456",
		);
	});

	it("returns null for unknown carrier", () => {
		expect(getTrackingUrl("unknown", "123")).toBeNull();
	});

	it("returns null for empty carrier", () => {
		expect(getTrackingUrl("", "123")).toBeNull();
	});

	it("encodes special characters in tracking number", () => {
		const url = getTrackingUrl("ups", "track num/123");
		expect(url).toBe("https://www.ups.com/track?tracknum=track%20num%2F123");
	});
});
