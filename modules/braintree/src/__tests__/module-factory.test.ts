import { describe, expect, it } from "vitest";
import braintree from "../index";

const baseOpts = {
	merchantId: "m_test_merchant",
	publicKey: "pk_test_public",
	privateKey: "sk_test_private",
};

describe("braintree module factory", () => {
	it('has id "braintree"', () => {
		const mod = braintree(baseOpts);
		expect(mod.id).toBe("braintree");
	});

	it('has version "0.0.1"', () => {
		const mod = braintree(baseOpts);
		expect(mod.version).toBe("0.0.1");
	});

	it("has empty schema", () => {
		const mod = braintree(baseOpts);
		expect(mod.schema).toEqual({});
	});

	it("init is defined", () => {
		const mod = braintree(baseOpts);
		expect(mod.init).toBeDefined();
	});

	// ── admin pages ──────────────────────────────────────────────────────

	describe("admin", () => {
		it("has one admin page", () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages).toHaveLength(1);
		});

		it('page path is "/admin/braintree"', () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages?.[0]?.path).toBe("/admin/braintree");
		});

		it('page component is "BraintreeAdmin"', () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages?.[0]?.component).toBe("BraintreeAdmin");
		});

		it('page label is "Braintree"', () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages?.[0]?.label).toBe("Braintree");
		});

		it('page icon is "CreditCard"', () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages?.[0]?.icon).toBe("CreditCard");
		});

		it('page group is "Finance"', () => {
			const mod = braintree(baseOpts);
			expect(mod.admin?.pages?.[0]?.group).toBe("Finance");
		});
	});

	// ── options ──────────────────────────────────────────────────────────

	describe("options", () => {
		it("includes merchantId, publicKey, and privateKey", () => {
			const mod = braintree(baseOpts);
			const opts = mod.options as Record<string, unknown>;
			expect(opts.merchantId).toBe("m_test_merchant");
			expect(opts.publicKey).toBe("pk_test_public");
			expect(opts.privateKey).toBe("sk_test_private");
		});

		it("sets sandbox to empty string when not provided", () => {
			const mod = braintree(baseOpts);
			const opts = mod.options as Record<string, unknown>;
			expect(opts.sandbox).toBe("");
		});

		it("includes sandbox when provided", () => {
			const mod = braintree({ ...baseOpts, sandbox: "true" });
			const opts = mod.options as Record<string, unknown>;
			expect(opts.sandbox).toBe("true");
		});

		it("preserves sandbox value of '1'", () => {
			const mod = braintree({ ...baseOpts, sandbox: "1" });
			const opts = mod.options as Record<string, unknown>;
			expect(opts.sandbox).toBe("1");
		});
	});

	// ── endpoints ────────────────────────────────────────────────────────

	describe("endpoints", () => {
		it("has store endpoints defined", () => {
			const mod = braintree(baseOpts);
			expect(mod.endpoints?.store).toBeDefined();
		});

		it("has admin endpoints defined", () => {
			const mod = braintree(baseOpts);
			expect(mod.endpoints?.admin).toBeDefined();
		});

		it("store endpoints include webhook", () => {
			const mod = braintree(baseOpts);
			const store = mod.endpoints?.store as Record<string, unknown>;
			expect(store["/braintree/webhook"]).toBeDefined();
		});

		it("admin endpoints include settings", () => {
			const mod = braintree(baseOpts);
			const admin = mod.endpoints?.admin as Record<string, unknown>;
			expect(admin["/admin/braintree/settings"]).toBeDefined();
		});
	});
});
