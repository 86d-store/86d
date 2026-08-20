import { describe, expect, it } from "vitest";
import {
	isEventEnabled,
	parseNotificationSettings,
} from "../notification-settings";

describe("parseNotificationSettings", () => {
	it("returns empty object for null input", () => {
		expect(parseNotificationSettings(null)).toEqual({});
	});

	it("returns empty object for undefined input", () => {
		expect(parseNotificationSettings(undefined)).toEqual({});
	});

	it("returns empty object for non-object input", () => {
		expect(parseNotificationSettings("string")).toEqual({});
		expect(parseNotificationSettings(123)).toEqual({});
		expect(parseNotificationSettings(true)).toEqual({});
	});

	it("parses fromAddress", () => {
		const result = parseNotificationSettings({
			fromAddress: "noreply@store.com",
		});
		expect(result.fromAddress).toBe("noreply@store.com");
	});

	it("parses adminEmail", () => {
		const result = parseNotificationSettings({
			adminEmail: "admin@store.com",
		});
		expect(result.adminEmail).toBe("admin@store.com");
	});

	it("parses events record", () => {
		const result = parseNotificationSettings({
			events: { "order.placed": true, "order.shipped": false },
		});
		expect(result.events).toEqual({
			"order.placed": true,
			"order.shipped": false,
		});
	});

	it("ignores non-string fromAddress", () => {
		const result = parseNotificationSettings({ fromAddress: 123 });
		expect(result.fromAddress).toBeUndefined();
	});

	it("ignores non-string adminEmail", () => {
		const result = parseNotificationSettings({ adminEmail: true });
		expect(result.adminEmail).toBeUndefined();
	});

	it("ignores non-object events", () => {
		const result = parseNotificationSettings({ events: "not-object" });
		expect(result.events).toBeUndefined();
	});

	it("parses all fields together", () => {
		const result = parseNotificationSettings({
			fromAddress: "from@store.com",
			adminEmail: "admin@store.com",
			events: { "order.placed": true },
		});
		expect(result).toEqual({
			fromAddress: "from@store.com",
			adminEmail: "admin@store.com",
			events: { "order.placed": true },
		});
	});
});

describe("isEventEnabled", () => {
	it("returns true when no events config", () => {
		expect(isEventEnabled({}, "order.placed")).toBe(true);
	});

	it("returns true when event is explicitly true", () => {
		const settings = parseNotificationSettings({
			events: { "order.placed": true },
		});
		expect(isEventEnabled(settings, "order.placed")).toBe(true);
	});

	it("returns false when event is explicitly false", () => {
		const settings = parseNotificationSettings({
			events: { "order.placed": false },
		});
		expect(isEventEnabled(settings, "order.placed")).toBe(false);
	});

	it("returns true when event is not in config (default enabled)", () => {
		const settings = parseNotificationSettings({
			events: { "order.placed": true },
		});
		expect(isEventEnabled(settings, "order.shipped")).toBe(true);
	});
});
