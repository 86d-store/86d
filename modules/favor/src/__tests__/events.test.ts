import { describe, expect, it } from "vitest";
import favor from "../index";

describe("favor events", () => {
	it("declares expected event emits", () => {
		const mod = favor();
		expect(mod.events?.emits).toContain("favor.delivery.created");
		expect(mod.events?.emits).toContain("favor.delivery.assigned");
		expect(mod.events?.emits).toContain("favor.delivery.completed");
		expect(mod.events?.emits).toContain("favor.delivery.cancelled");
		expect(mod.events?.emits).toContain("favor.webhook.received");
	});

	it("has correct module id and version", () => {
		const mod = favor();
		expect(mod.id).toBe("favor");
		expect(mod.version).toBe("0.1.0");
	});

	it("includes schema with delivery and serviceArea entities", () => {
		const mod = favor();
		expect(mod.schema).toBeDefined();
		expect(mod.schema?.delivery).toBeDefined();
		expect(mod.schema?.serviceArea).toBeDefined();
	});

	it("declares admin pages", () => {
		const mod = favor();
		expect(mod.admin?.pages).toHaveLength(1);
		expect(mod.admin?.pages?.[0]?.path).toBe("/admin/favor");
		expect(mod.admin?.pages?.[0]?.group).toBe("Fulfillment");
	});

	it("passes options through", () => {
		const mod = favor({
			apiKey: "test-key",
			merchantId: "test-merchant",
			sandbox: "true",
		});
		expect(mod.options).toEqual({
			apiKey: "test-key",
			merchantId: "test-merchant",
			sandbox: "true",
		});
	});
});
