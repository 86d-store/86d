import { describe, expect, it } from "vitest";
import createModule from "../index";

describe("pinterest-shop module factory", () => {
	it("has correct id", () => {
		const mod = createModule();
		expect(mod.id).toBe("pinterest-shop");
	});

	it("has a semver version", () => {
		const mod = createModule();
		expect(mod.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("exposes admin listing endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.admin ?? {})).toContain(
			"/admin/pinterest-shop/items",
		);
	});

	it("exposes store webhook endpoint", () => {
		const mod = createModule();
		expect(Object.keys(mod.endpoints?.store ?? {})).toContain(
			"/pinterest-shop/webhooks",
		);
	});

	it("declares main admin page", () => {
		const mod = createModule();
		const paths = (mod.admin?.pages ?? []).map((p) => p.path);
		expect(paths).toContain("/admin/pinterest-shop");
	});

	it("works without options", () => {
		expect(() => createModule()).not.toThrow();
	});

	it("accepts options", () => {
		const mod = createModule({ accessToken: "test-123" });
		expect(mod.id).toBe("pinterest-shop");
	});
});
