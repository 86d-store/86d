import { describe, expect, it } from "vitest";
import uberDirect from "../index";

describe("uber-direct events", () => {
	it("declares expected event emits", () => {
		const mod = uberDirect();
		expect(mod.events?.emits).toContain("uber-direct.delivery.created");
		expect(mod.events?.emits).toContain("uber-direct.delivery.picked-up");
		expect(mod.events?.emits).toContain("uber-direct.delivery.delivered");
		expect(mod.events?.emits).toContain("uber-direct.delivery.cancelled");
		expect(mod.events?.emits).toContain("uber-direct.quote.created");
		expect(mod.events?.emits).toContain("uber-direct.webhook.received");
	});

	it("has correct module id and version", () => {
		const mod = uberDirect();
		expect(mod.id).toBe("uber-direct");
		expect(mod.version).toBe("0.1.0");
	});

	it("includes schema with delivery and quote entities", () => {
		const mod = uberDirect();
		expect(mod.schema).toBeDefined();
		expect(mod.schema?.delivery).toBeDefined();
		expect(mod.schema?.quote).toBeDefined();
	});

	it("declares admin pages", () => {
		const mod = uberDirect();
		expect(mod.admin?.pages).toHaveLength(1);
		expect(mod.admin?.pages?.[0]?.path).toBe("/admin/uber-direct");
		expect(mod.admin?.pages?.[0]?.group).toBe("Fulfillment");
	});

	it("passes options through", () => {
		const mod = uberDirect({
			clientId: "test-id",
			clientSecret: "test-secret",
			customerId: "test-cust",
			webhookSigningKey: "test-key",
		});
		expect(mod.options).toEqual({
			clientId: "test-id",
			clientSecret: "test-secret",
			customerId: "test-cust",
			webhookSigningKey: "test-key",
		});
	});

	it("does not include webhook endpoint without its dedicated signing key", () => {
		const mod = uberDirect({
			clientId: "test-id",
			clientSecret: "test-secret",
			customerId: "test-cust",
		});
		const storeRoutes = Object.keys(
			mod.endpoints?.store as Record<string, unknown>,
		);
		expect(storeRoutes).not.toContain("/uber-direct/webhook");
	});

	it("includes webhook endpoint when API and webhook credentials are complete", () => {
		const mod = uberDirect({
			clientId: "test-id",
			clientSecret: "test-secret",
			customerId: "test-cust",
			webhookSigningKey: "test-signing-key",
		});
		const storeRoutes = Object.keys(
			mod.endpoints?.store as Record<string, unknown>,
		);
		expect(storeRoutes).toContain("/uber-direct/webhook");
	});

	it("includes settings endpoint when credentials are provided", () => {
		const mod = uberDirect({
			clientId: "test-id",
			clientSecret: "test-secret",
			customerId: "test-cust",
		});
		const adminRoutes = Object.keys(
			mod.endpoints?.admin as Record<string, unknown>,
		);
		expect(adminRoutes).toContain("/admin/uber-direct/settings");
	});

	it("excludes webhook without credentials but always exposes settings", () => {
		const mod = uberDirect();
		const storeRoutes = Object.keys(
			mod.endpoints?.store as Record<string, unknown>,
		);
		const adminRoutes = Object.keys(
			mod.endpoints?.admin as Record<string, unknown>,
		);
		expect(storeRoutes).not.toContain("/uber-direct/webhook");
		expect(adminRoutes).toContain("/admin/uber-direct/settings");
	});
});
