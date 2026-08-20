import { beforeEach, describe, expect, it } from "vitest";
import { productsState } from "../state";

describe("productsState", () => {
	beforeEach(() => {
		// Reset to defaults before each test
		productsState.clearFilters();
		productsState.setSortField("createdAt");
		productsState.setSortOrder("desc");
		productsState.setViewMode("grid");
	});

	describe("initial state", () => {
		it("has correct defaults", () => {
			expect(productsState.activeCategory).toBe("");
			expect(productsState.searchQuery).toBe("");
			expect(productsState.sortField).toBe("createdAt");
			expect(productsState.sortOrder).toBe("desc");
			expect(productsState.viewMode).toBe("grid");
			expect(productsState.minPrice).toBe("");
			expect(productsState.maxPrice).toBe("");
			expect(productsState.inStockOnly).toBe(false);
			expect(productsState.activeTag).toBe("");
		});

		it("hasActiveFilters is false initially", () => {
			expect(productsState.hasActiveFilters).toBe(false);
		});
	});

	describe("category filter", () => {
		it("sets category", () => {
			productsState.setCategory("electronics");
			expect(productsState.activeCategory).toBe("electronics");
			expect(productsState.hasActiveFilters).toBe(true);
		});

		it("clears category", () => {
			productsState.setCategory("electronics");
			productsState.setCategory("");
			expect(productsState.activeCategory).toBe("");
		});
	});

	describe("search query", () => {
		it("sets search query", () => {
			productsState.setSearchQuery("headphones");
			expect(productsState.searchQuery).toBe("headphones");
			expect(productsState.hasActiveFilters).toBe(true);
		});
	});

	describe("sort", () => {
		it("sets sort field", () => {
			productsState.setSortField("price");
			expect(productsState.sortField).toBe("price");
		});

		it("sets sort order", () => {
			productsState.setSortOrder("asc");
			expect(productsState.sortOrder).toBe("asc");
		});
	});

	describe("view mode", () => {
		it("toggles between grid and list", () => {
			expect(productsState.viewMode).toBe("grid");
			productsState.setViewMode("list");
			expect(productsState.viewMode).toBe("list");
			productsState.setViewMode("grid");
			expect(productsState.viewMode).toBe("grid");
		});
	});

	describe("price range", () => {
		it("sets price range", () => {
			productsState.setPriceRange("10", "100");
			expect(productsState.minPrice).toBe("10");
			expect(productsState.maxPrice).toBe("100");
			expect(productsState.hasActiveFilters).toBe(true);
		});

		it("detects active filters with only min price", () => {
			productsState.setPriceRange("10", "");
			expect(productsState.hasActiveFilters).toBe(true);
		});

		it("detects active filters with only max price", () => {
			productsState.setPriceRange("", "100");
			expect(productsState.hasActiveFilters).toBe(true);
		});
	});

	describe("in-stock filter", () => {
		it("sets in-stock only", () => {
			productsState.setInStockOnly(true);
			expect(productsState.inStockOnly).toBe(true);
			expect(productsState.hasActiveFilters).toBe(true);
		});
	});

	describe("tag filter", () => {
		it("sets active tag", () => {
			productsState.setActiveTag("sale");
			expect(productsState.activeTag).toBe("sale");
			expect(productsState.hasActiveFilters).toBe(true);
		});
	});

	describe("clearFilters", () => {
		it("resets all filters but preserves sort and view mode", () => {
			productsState.setCategory("clothing");
			productsState.setSearchQuery("shirt");
			productsState.setPriceRange("10", "50");
			productsState.setInStockOnly(true);
			productsState.setActiveTag("new");
			productsState.setSortField("price");
			productsState.setSortOrder("asc");
			productsState.setViewMode("list");

			productsState.clearFilters();

			// Filters should be cleared
			expect(productsState.activeCategory).toBe("");
			expect(productsState.searchQuery).toBe("");
			expect(productsState.minPrice).toBe("");
			expect(productsState.maxPrice).toBe("");
			expect(productsState.inStockOnly).toBe(false);
			expect(productsState.activeTag).toBe("");
			expect(productsState.hasActiveFilters).toBe(false);

			// Sort and view mode should be preserved
			expect(productsState.sortField).toBe("price");
			expect(productsState.sortOrder).toBe("asc");
			expect(productsState.viewMode).toBe("list");
		});
	});
});
