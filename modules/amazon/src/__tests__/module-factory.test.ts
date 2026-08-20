import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("amazon module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("amazon");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/amazon/listings",
		);
	});

	it("does not expose the unsupported SP-API HTTP webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).not.toContain(
			"/amazon/webhooks",
		);
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/amazon");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ sellerId: "test-123" });
		expect(mod.id).toBe("amazon");
	});

	it("wires settings endpoint when options provided", () => {
		const mod = createModule({
			sellerId: "AXYZ123",
			clientId: "amzn1.application-oa2-client.test",
			clientSecret: "test-secret",
			refreshToken: "Atzr|test-token",
		});
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/amazon/settings",
		);
	});

	it("wires settings endpoint even without credentials", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/amazon/settings",
		);
	});
});
