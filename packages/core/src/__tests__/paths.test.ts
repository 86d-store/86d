import { describe, expect, it } from "vitest";
import { formatPathConflicts, validateUniquePaths } from "../paths";
import type { Module } from "../types/module";

function makeModule(overrides: Partial<Module> & { id: string }): Module {
	return {
		version: "1.0.0",
		schema: {},
		...overrides,
	};
}

describe("validateUniquePaths", () => {
	it("returns no conflicts for unique admin and store paths", () => {
		const modules = [
			makeModule({
				id: "products",
				admin: {
					pages: [{ path: "/admin/products", component: "ProductList" }],
				},
				store: {
					pages: [{ path: "/products", component: "ProductListing" }],
				},
				endpoints: {
					admin: { "/admin/products/list": {} as never },
					store: { "/products": {} as never },
				},
			}),
			makeModule({
				id: "cart",
				admin: { pages: [{ path: "/admin/carts", component: "CartList" }] },
				store: { pages: [{ path: "/cart", component: "CartPage" }] },
				endpoints: {
					admin: { "/admin/carts/list": {} as never },
					store: { "/cart/get": {} as never },
				},
			}),
		];

		expect(validateUniquePaths(modules)).toEqual([]);
	});

	it("reports duplicate admin pages across modules", () => {
		const conflicts = validateUniquePaths([
			makeModule({
				id: "products",
				admin: {
					pages: [
						{ path: "/admin/collections", component: "CollectionsAdmin" },
					],
				},
			}),
			makeModule({
				id: "collections",
				admin: {
					pages: [{ path: "/admin/collections", component: "CollectionAdmin" }],
				},
			}),
		]);

		expect(conflicts).toContainEqual({
			kind: "admin_page",
			path: "/admin/collections",
			moduleIds: ["products", "collections"],
		});
	});

	it("reports duplicate admin endpoints across modules", () => {
		const conflicts = validateUniquePaths([
			makeModule({
				id: "orders",
				endpoints: {
					admin: { "/admin/returns": {} as never },
				},
			}),
			makeModule({
				id: "returns",
				endpoints: {
					admin: { "/admin/returns": {} as never },
				},
			}),
		]);

		expect(conflicts).toContainEqual({
			kind: "admin_endpoint",
			path: "/admin/returns",
			moduleIds: ["orders", "returns"],
		});
	});

	it("reports duplicate store pages across modules", () => {
		const conflicts = validateUniquePaths([
			makeModule({
				id: "wishlist",
				store: {
					pages: [{ path: "/favorites", component: "WishlistPage" }],
				},
			}),
			makeModule({
				id: "wish",
				store: {
					pages: [{ path: "/favorites", component: "WishPage" }],
				},
			}),
		]);

		expect(conflicts).toContainEqual({
			kind: "store_page",
			path: "/favorites",
			moduleIds: ["wishlist", "wish"],
		});
	});

	it("reports duplicate store endpoints across modules", () => {
		const conflicts = validateUniquePaths([
			{
				moduleId: "shipping-a",
				storeEndpoints: ["/shipping/rates"],
			},
			{
				moduleId: "shipping-b",
				storeEndpoints: ["/shipping/rates"],
			},
		]);

		expect(conflicts).toContainEqual({
			kind: "store_endpoint",
			path: "/shipping/rates",
			moduleIds: ["shipping-a", "shipping-b"],
		});
	});

	it("reports duplicate paths declared multiple times in the same module", () => {
		const conflicts = validateUniquePaths([
			{
				moduleId: "products",
				adminPages: ["/admin/products", "/admin/products"],
			},
		]);

		expect(conflicts).toEqual([
			{
				kind: "admin_page",
				path: "/admin/products",
				moduleIds: ["products", "products"],
			},
		]);
	});
});

describe("formatPathConflicts", () => {
	it("formats cross-module conflicts clearly", () => {
		expect(
			formatPathConflicts([
				{
					kind: "admin_endpoint",
					path: "/admin/returns",
					moduleIds: ["orders", "returns"],
				},
			]),
		).toEqual([
			'Modules "orders", "returns" all declare admin endpoint "/admin/returns".',
		]);
	});

	it("formats same-module duplicates clearly", () => {
		expect(
			formatPathConflicts([
				{
					kind: "admin_page",
					path: "/admin/products",
					moduleIds: ["products", "products"],
				},
			]),
		).toEqual([
			'Module "products" declares admin page "/admin/products" multiple times.',
		]);
	});
});
