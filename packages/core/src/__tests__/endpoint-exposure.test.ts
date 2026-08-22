import { describe, expect, it } from "vitest";
import { createAdminEndpoint, createStoreEndpoint } from "../api";
import {
	collectEndpointExposures,
	createEndpointExposureResolver,
	endpointExposure,
	formatEndpointExposureViolations,
	isEndpointExposure,
} from "../endpoint-exposure";
import type { Module } from "../types/module";
import { z } from "../zod";

type ModuleEndpoints = NonNullable<Module["endpoints"]>;

function moduleWith(endpoints: ModuleEndpoints): Module {
	return { id: "demo", version: "1.0.0", endpoints };
}

describe("endpoint exposure declaration", () => {
	it("gives every store endpoint the shopper surface unless it says otherwise", () => {
		const shopper = createStoreEndpoint(
			"/demo/list",
			{ method: "GET" },
			async () => ({ ok: true }),
		);

		expect(endpointExposure(shopper)).toBe("shopper");
	});

	it("carries an explicit non-shopper declaration on the store surface", () => {
		const webhook = createStoreEndpoint(
			"/demo/webhook",
			{ exposure: "provider_webhook", method: "POST" },
			async () => ({ ok: true }),
		);
		const open = createStoreEndpoint(
			"/demo/feed",
			{ exposure: "public", method: "GET" },
			async () => ({ ok: true }),
		);

		expect(endpointExposure(webhook)).toBe("provider_webhook");
		expect(endpointExposure(open)).toBe("public");
	});

	it("fixes the admin surface to the admin exposure", () => {
		const adminEndpoint = createAdminEndpoint(
			"/admin/demo",
			{ method: "GET" },
			async () => ({ ok: true }),
		);

		expect(endpointExposure(adminEndpoint)).toBe("admin");
		expect(() =>
			createAdminEndpoint(
				"/admin/demo",
				{ exposure: "public", method: "GET" },
				async () => ({ ok: true }),
			),
		).toThrow(/cannot declare exposure "public"/);
	});

	it("refuses an unrecognized exposure at construction", () => {
		expect(() =>
			createStoreEndpoint(
				"/demo/bad",
				{ exposure: "webhook", method: "POST" },
				async () => ({ ok: true }),
			),
		).toThrow(/unrecognized exposure/);
	});

	it("refuses to guess when a declaration is missing", () => {
		const undeclared = { path: "/demo/undeclared", options: {} };

		expect(() =>
			endpointExposure(
				undeclared as unknown as Parameters<typeof endpointExposure>[0],
			),
		).toThrow(/does not declare a valid exposure/);
	});

	it("recognizes exactly the five exposures", () => {
		for (const value of [
			"public",
			"shopper",
			"admin",
			"provider_webhook",
			"internal",
		]) {
			expect(isEndpointExposure(value)).toBe(true);
		}
		for (const value of ["webhook", "", "ADMIN", undefined, 1, null]) {
			expect(isEndpointExposure(value)).toBe(false);
		}
	});
});

describe("collectEndpointExposures", () => {
	it("resolves an exposure for every registered endpoint", () => {
		const mod = moduleWith({
			store: {
				"/demo/list": createStoreEndpoint(
					"/demo/list",
					{ method: "GET" },
					async () => ({ ok: true }),
				),
				"/demo/webhook": createStoreEndpoint(
					"/demo/webhook",
					{ exposure: "provider_webhook", method: "POST" },
					async () => ({ ok: true }),
				),
			},
			admin: {
				"/admin/demo": createAdminEndpoint(
					"/admin/demo",
					{ method: "GET" },
					async () => ({ ok: true }),
				),
			},
		});

		const { entries, violations } = collectEndpointExposures([mod]);

		expect(violations).toEqual([]);
		expect(entries).toEqual([
			{
				moduleId: "demo",
				surface: "store",
				path: "/demo/list",
				exposure: "shopper",
			},
			{
				moduleId: "demo",
				surface: "store",
				path: "/demo/webhook",
				exposure: "provider_webhook",
			},
			{
				moduleId: "demo",
				surface: "admin",
				path: "/admin/demo",
				exposure: "admin",
			},
		]);
	});

	it("reports an endpoint that declares nothing", () => {
		const mod = moduleWith({
			store: {
				"/demo/raw": {
					path: "/demo/raw",
					options: {},
				} as unknown as NonNullable<ModuleEndpoints["store"]>[string],
			},
		});

		const { entries, violations } = collectEndpointExposures([mod]);

		expect(entries).toEqual([]);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatchObject({
			path: "/demo/raw",
			reason: "missing",
		});
		expect(formatEndpointExposureViolations(violations)[0]).toContain(
			"declares no exposure",
		);
	});

	it("reports a declaration its surface cannot serve", () => {
		const mod = moduleWith({
			store: {
				"/demo/sneaky": {
					path: "/demo/sneaky",
					options: { exposure: "admin" },
				} as unknown as NonNullable<ModuleEndpoints["store"]>[string],
			},
		});

		const { violations } = collectEndpointExposures([mod]);

		expect(violations[0]).toMatchObject({ reason: "surface_mismatch" });
	});
});

describe("createEndpointExposureResolver", () => {
	const resolve = createEndpointExposureResolver([
		{
			moduleId: "demo",
			surface: "store",
			path: "/products/:slug",
			exposure: "shopper",
		},
		{
			moduleId: "demo",
			surface: "store",
			path: "/products/feed",
			exposure: "public",
		},
		{
			moduleId: "stripe",
			surface: "store",
			path: "/stripe/webhook",
			exposure: "provider_webhook",
		},
		{
			moduleId: "demo",
			surface: "admin",
			path: "/admin/products/:id",
			exposure: "admin",
		},
	]);

	it("prefers a literal segment over a parameter", () => {
		expect(resolve("/products/feed")).toBe("public");
		expect(resolve("/products/anything-else")).toBe("shopper");
	});

	it("resolves provider webhooks and admin paths from the declaration", () => {
		expect(resolve("/stripe/webhook")).toBe("provider_webhook");
		expect(resolve("/admin/products/123")).toBe("admin");
	});

	it("returns nothing for an unregistered path", () => {
		expect(resolve("/nope")).toBeUndefined();
		expect(resolve("/products")).toBeUndefined();
		expect(resolve("/products/a/b")).toBeUndefined();
	});

	it("does not treat an admin-looking path as admin without a declaration", () => {
		// The path prefix carries no authority on its own.
		expect(resolve("/admin/not-registered")).toBeUndefined();
	});
});

describe("store endpoint schemas remain intact", () => {
	it("keeps body validation alongside the exposure declaration", async () => {
		const endpoint = createStoreEndpoint(
			"/demo/echo",
			{
				exposure: "public",
				method: "POST",
				body: z.object({ name: z.string().max(10) }),
			},
			async (ctx) => ({ name: ctx.body.name }),
		);

		expect(endpointExposure(endpoint)).toBe("public");
		await expect(endpoint({ body: { name: "ok" } })).resolves.toEqual({
			name: "ok",
		});
	});
});
