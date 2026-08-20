import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("tiktok-shop module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("tiktok-shop");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/tiktok-shop/listings",
		);
	});

	it("exposes store webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).toContain(
			"/tiktok-shop/webhooks",
		);
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/tiktok-shop");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ appKey: "test-123" });
		expect(mod.id).toBe("tiktok-shop");
	});

	it("wires settings endpoint when options provided", () => {
		const mod = createModule({
			appKey: "test-key",
			appSecret: "test-secret",
			accessToken: "test-token",
		});
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/tiktok-shop/settings",
		);
	});

	it("wires settings endpoint even without credentials", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/tiktok-shop/settings",
		);
	});
});
