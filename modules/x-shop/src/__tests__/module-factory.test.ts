import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("x-shop module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("x-shop");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/x-shop/listings",
		);
	});

	it("exposes store webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).toContain(
			"/x-shop/webhooks",
		);
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/x-shop");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ apiKey: "test-123" });
		expect(mod.id).toBe("x-shop");
	});

	it("exposes admin settings endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/x-shop/settings",
		);
	});

	it("exposes admin drops endpoints", () => {
		const mod = createModule();
		const endpoints = Object.keys(mod.endpoints?.admin ?? {});
		expect(endpoints).toContain("/admin/x-shop/drops");
		expect(endpoints).toContain("/admin/x-shop/drops/create");
		expect(endpoints).toContain("/admin/x-shop/drops/:id/cancel");
		expect(endpoints).toContain("/admin/x-shop/drops/:id/stats");
	});

	it("exposes admin stats endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/x-shop/stats",
		);
	});
});
