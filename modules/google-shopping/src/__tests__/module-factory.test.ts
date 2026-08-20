import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("google-shopping module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("google-shopping");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/google-shopping/feed-items",
		);
	});

	it("exposes store webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).toContain(
			"/google-shopping/webhooks",
		);
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/google-shopping");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ merchantId: "test-123" });
		expect(mod.id).toBe("google-shopping");
	});

	it("wires settings endpoint when options provided", () => {
		const mod = createModule({
			merchantId: "12345",
			apiKey: "AIzaSy_test_key",
		});
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/google-shopping/settings",
		);
	});

	it("wires settings endpoint even without credentials", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/google-shopping/settings",
		);
	});
});
