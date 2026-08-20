import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("etsy module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("etsy");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/etsy/listings",
		);
	});

	it("exposes store webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).toContain("/etsy/webhooks");
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/etsy");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ shopId: "test-123" });
		expect(mod.id).toBe("etsy");
	});

	it("wires settings endpoint when options provided", () => {
		const mod = createModule({
			apiKey: "test-key",
			shopId: "12345",
			accessToken: "test-token",
		});
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/etsy/settings",
		);
	});

	it("wires settings endpoint even without credentials", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/etsy/settings",
		);
	});
});
