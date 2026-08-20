import { describe, expect, it } from "vitest";
import paypal from "../index";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_OPTIONS = {
	clientId: "test-client-id",
	clientSecret: "test-client-secret",
};

// ── Module identity ──────────────────────────────────────────────────────────

describe("paypal module factory — identity", () => {
	it("has id 'paypal'", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.id).toBe("paypal");
	});

	it("has version '0.0.1'", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.version).toBe("0.0.1");
	});

	it("has empty schema", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.schema).toEqual({});
	});
});

// ── init ─────────────────────────────────────────────────────────────────────

describe("paypal module factory — init", () => {
	it("init is defined", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.init).toBeDefined();
	});
});

// ── admin pages ──────────────────────────────────────────────────────────────

describe("paypal module factory — admin pages", () => {
	it("has one admin page at /admin/paypal", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.admin?.pages).toHaveLength(1);
		expect(mod.admin?.pages?.[0]?.path).toBe("/admin/paypal");
	});

	it("admin page has component PayPalAdmin", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.admin?.pages?.[0]?.component).toBe("PayPalAdmin");
	});

	it("admin page has label PayPal", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.admin?.pages?.[0]?.label).toBe("PayPal");
	});

	it("admin page has icon CreditCard", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.admin?.pages?.[0]?.icon).toBe("CreditCard");
	});

	it("admin page has group Finance", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.admin?.pages?.[0]?.group).toBe("Finance");
	});
});

// ── options passthrough ──────────────────────────────────────────────────────

describe("paypal module factory — options", () => {
	it("includes clientId and clientSecret in options", () => {
		const mod = paypal(BASE_OPTIONS);
		const opts = mod.options as Record<string, unknown>;
		expect(opts.clientId).toBe("test-client-id");
		expect(opts.clientSecret).toBe("test-client-secret");
	});

	it("sets sandbox to empty string when not provided", () => {
		const mod = paypal(BASE_OPTIONS);
		const opts = mod.options as Record<string, unknown>;
		expect(opts.sandbox).toBe("");
	});

	it("sets webhookId to empty string when not provided", () => {
		const mod = paypal(BASE_OPTIONS);
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookId).toBe("");
	});

	it("includes sandbox when provided", () => {
		const mod = paypal({ ...BASE_OPTIONS, sandbox: "true" });
		const opts = mod.options as Record<string, unknown>;
		expect(opts.sandbox).toBe("true");
	});

	it("includes webhookId when provided", () => {
		const mod = paypal({ ...BASE_OPTIONS, webhookId: "WH-1234" });
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookId).toBe("WH-1234");
	});
});

// ── endpoints ────────────────────────────────────────────────────────────────

describe("paypal module factory — endpoints", () => {
	it("endpoints.store is defined", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.endpoints?.store).toBeDefined();
	});

	it("endpoints.admin is defined", () => {
		const mod = paypal(BASE_OPTIONS);
		expect(mod.endpoints?.admin).toBeDefined();
	});

	it("endpoints.store contains /paypal/webhook", () => {
		const mod = paypal(BASE_OPTIONS);
		const store = mod.endpoints?.store as Record<string, unknown>;
		expect(store["/paypal/webhook"]).toBeDefined();
	});

	it("endpoints.admin contains /admin/paypal/settings", () => {
		const mod = paypal(BASE_OPTIONS);
		const admin = mod.endpoints?.admin as Record<string, unknown>;
		expect(admin["/admin/paypal/settings"]).toBeDefined();
	});
});
