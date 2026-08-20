import { describe, expect, it, vi } from "vitest";

const productDetailMarkdown = vi.hoisted(() => vi.fn(async () => "# Content"));

vi.mock("generated/api", () => ({
	modules: [
		{
			id: "products",
			store: {
				pages: [
					{ path: "/products", component: "ProductList" },
					{
						path: "/products/:slug",
						component: "ProductDetail",
						toMarkdown: productDetailMarkdown,
					},
				],
			},
		},
		{
			id: "cart",
			store: {
				pages: [{ path: "/cart", component: "CartPage" }],
			},
		},
		{
			id: "orders",
			store: {
				pages: [
					{ path: "/account/orders", component: "OrdersList" },
					{ path: "/account/orders/:id", component: "OrderDetail" },
				],
			},
		},
		{
			id: "search",
			store: {
				pages: [{ path: "/search/:query", component: "SearchResults" }],
			},
		},
		{
			id: "nostore",
			// no store pages
		},
	],
}));

import { getStoreRoute } from "../store-registry";

describe("getStoreRoute", () => {
	describe("exact static paths", () => {
		it("matches /products", () => {
			const match = getStoreRoute("/products");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("products");
			expect(match?.component).toBe("ProductList");
			expect(match?.params).toEqual({});
		});

		it("matches /cart", () => {
			const match = getStoreRoute("/cart");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("cart");
			expect(match?.component).toBe("CartPage");
			expect(match?.params).toEqual({});
		});

		it("matches nested static /account/orders", () => {
			const match = getStoreRoute("/account/orders");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("orders");
			expect(match?.component).toBe("OrdersList");
		});
	});

	describe("dynamic path params", () => {
		it("extracts :slug from /products/:slug", () => {
			const match = getStoreRoute("/products/red-sneakers");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("products");
			expect(match?.component).toBe("ProductDetail");
			expect(match?.params).toEqual({ slug: "red-sneakers" });
		});

		it("extracts :id from /account/orders/:id", () => {
			const match = getStoreRoute("/account/orders/order-42");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("orders");
			expect(match?.component).toBe("OrderDetail");
			expect(match?.params).toEqual({ id: "order-42" });
		});

		it("extracts :query containing special characters", () => {
			const match = getStoreRoute("/search/running+shoes");
			expect(match).not.toBeNull();
			expect(match?.component).toBe("SearchResults");
			expect(match?.params).toEqual({ query: "running+shoes" });
		});
	});

	describe(".md suffix stripping", () => {
		it("strips .md from the last segment and matches", () => {
			const match = getStoreRoute("/products/red-sneakers.md");
			expect(match).not.toBeNull();
			expect(match?.component).toBe("ProductDetail");
			expect(match?.params).toEqual({ slug: "red-sneakers" });
		});

		it("strips .md from a static segment and matches", () => {
			const match = getStoreRoute("/products.md");
			expect(match).not.toBeNull();
			expect(match?.component).toBe("ProductList");
			expect(match?.params).toEqual({});
		});
	});

	describe("trailing slash handling", () => {
		it("strips trailing slash before matching", () => {
			const match = getStoreRoute("/cart/");
			expect(match).not.toBeNull();
			expect(match?.moduleId).toBe("cart");
		});

		it("strips trailing slash from dynamic routes", () => {
			const match = getStoreRoute("/products/my-shoe/");
			expect(match).not.toBeNull();
			expect(match?.component).toBe("ProductDetail");
			expect(match?.params).toEqual({ slug: "my-shoe" });
		});
	});

	describe("no match", () => {
		it("returns null for unknown paths", () => {
			expect(getStoreRoute("/not-a-real-route")).toBeNull();
		});

		it("returns null for too many segments", () => {
			expect(getStoreRoute("/products/a/b")).toBeNull();
		});

		it("returns null for root /", () => {
			expect(getStoreRoute("/")).toBeNull();
		});

		it("returns null for empty string", () => {
			expect(getStoreRoute("")).toBeNull();
		});
	});

	describe("toMarkdown attachment", () => {
		it("attaches toMarkdown when the route defines it", () => {
			const match = getStoreRoute("/products/with-markdown");
			expect(match?.toMarkdown).toBe(productDetailMarkdown);
		});

		it("omits toMarkdown when the route does not define it", () => {
			const match = getStoreRoute("/cart");
			expect(match?.toMarkdown).toBeUndefined();
		});
	});

	describe("specificity ordering", () => {
		it("routes with more segments beat shorter ones (different segment counts never conflict)", () => {
			const list = getStoreRoute("/products");
			const detail = getStoreRoute("/products/slug-value");
			expect(list?.component).toBe("ProductList");
			expect(detail?.component).toBe("ProductDetail");
		});
	});
});
