import { describe, expect, it } from "vitest";
import square from "../index";

describe("square module factory", () => {
	const minimalOpts = { accessToken: "sq_test_token_abc" };

	// ── core identity ─────────────────────────────────────────────────────

	it('has id "square"', () => {
		const mod = square(minimalOpts);
		expect(mod.id).toBe("square");
	});

	it('has version "0.0.1"', () => {
		const mod = square(minimalOpts);
		expect(mod.version).toBe("0.0.1");
	});

	it("has empty schema", () => {
		const mod = square(minimalOpts);
		expect(mod.schema).toEqual({});
	});

	it("init is defined", () => {
		const mod = square(minimalOpts);
		expect(mod.init).toBeDefined();
	});

	// ── admin pages ───────────────────────────────────────────────────────

	it('admin pages has one page at "/admin/square" with group "Finance"', () => {
		const mod = square(minimalOpts);
		expect(mod.admin?.pages).toHaveLength(1);

		const page = mod.admin?.pages?.[0];
		expect(page?.path).toBe("/admin/square");
		expect(page?.component).toBe("SquareAdmin");
		expect(page?.label).toBe("Square");
		expect(page?.icon).toBe("CreditCard");
		expect(page?.group).toBe("Finance");
	});

	// ── options passthrough ───────────────────────────────────────────────

	it("options include accessToken", () => {
		const mod = square({ accessToken: "sq_live_xyz" });
		const opts = mod.options as Record<string, unknown>;
		expect(opts.accessToken).toBe("sq_live_xyz");
	});

	it("options set webhookSignatureKey to empty string when not provided", () => {
		const mod = square(minimalOpts);
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookSignatureKey).toBe("");
	});

	it("options set webhookNotificationUrl to empty string when not provided", () => {
		const mod = square(minimalOpts);
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookNotificationUrl).toBe("");
	});

	it("options include webhookSignatureKey when provided", () => {
		const mod = square({
			accessToken: "sq_tok",
			webhookSignatureKey: "sig_key_123",
		});
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookSignatureKey).toBe("sig_key_123");
	});

	it("options include webhookNotificationUrl when provided", () => {
		const mod = square({
			accessToken: "sq_tok",
			webhookNotificationUrl: "https://example.com/webhook",
		});
		const opts = mod.options as Record<string, unknown>;
		expect(opts.webhookNotificationUrl).toBe("https://example.com/webhook");
	});

	// ── endpoints ─────────────────────────────────────────────────────────

	it("endpoints.store and endpoints.admin are defined", () => {
		const mod = square(minimalOpts);
		expect(mod.endpoints?.store).toBeDefined();
		expect(mod.endpoints?.admin).toBeDefined();
	});
});
