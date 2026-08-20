import { describe, expect, it } from "vitest";
import stripe from "../index";

describe("stripe module factory", () => {
	const mod = stripe({ apiKey: "sk_test_factory_key" });

	it('has id "stripe"', () => {
		expect(mod.id).toBe("stripe");
	});

	it('has version "0.0.1"', () => {
		expect(mod.version).toBe("0.0.1");
	});

	it("has an empty schema", () => {
		expect(mod.schema).toEqual({});
	});

	it("init is defined", () => {
		expect(mod.init).toBeDefined();
	});

	it("admin pages array has one page", () => {
		expect(mod.admin?.pages).toHaveLength(1);
	});

	it('admin page has path "/admin/stripe"', () => {
		expect(mod.admin?.pages?.[0]?.path).toBe("/admin/stripe");
	});

	it('admin page has group "Finance", icon "CreditCard", and label "Stripe"', () => {
		const page = mod.admin?.pages?.[0];
		expect(page?.group).toBe("Finance");
		expect(page?.icon).toBe("CreditCard");
		expect(page?.label).toBe("Stripe");
	});

	it("options include apiKey from input", () => {
		expect(mod.options?.apiKey).toBe("sk_test_factory_key");
	});

	it("options set webhookSecret to empty string when not provided", () => {
		expect(mod.options?.webhookSecret).toBe("");
	});

	it("options include webhookSecret when provided", () => {
		const modWithSecret = stripe({
			apiKey: "sk_test_key",
			webhookSecret: "whsec_abc",
		});
		expect(modWithSecret.options?.webhookSecret).toBe("whsec_abc");
	});

	it("endpoints.store is defined", () => {
		expect(mod.endpoints?.store).toBeDefined();
	});

	it("endpoints.admin is defined", () => {
		expect(mod.endpoints?.admin).toBeDefined();
	});
});
