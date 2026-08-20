import { describe, expect, it, vi } from "vitest";

// Mock generated/api and db dependencies pulled in by store-registry
vi.mock("../store-registry", () => ({
	getStoreRoute: vi.fn(() => null),
}));

// We only test resolvePathForMarkdown here (pure path dispatch logic).
// serializeToMarkdown calls async helpers that require a live DB.
import { resolvePathForMarkdown } from "../markdown-serializers";
import { getStoreRoute } from "../store-registry";

const mockGetStoreRoute = vi.mocked(getStoreRoute);

describe("resolvePathForMarkdown", () => {
	it("resolves '/' to homepage", () => {
		mockGetStoreRoute.mockReturnValue(null);
		expect(resolvePathForMarkdown("/")).toEqual({ type: "homepage" });
	});

	it("resolves '/search' to search", () => {
		mockGetStoreRoute.mockReturnValue(null);
		expect(resolvePathForMarkdown("/search")).toEqual({ type: "search" });
	});

	it("strips trailing slash before resolving", () => {
		mockGetStoreRoute.mockReturnValue(null);
		expect(resolvePathForMarkdown("/search/")).toEqual({ type: "search" });
		expect(resolvePathForMarkdown("/about/")).toEqual({
			type: "static",
			path: "/about",
		});
	});

	it("resolves known static pages to static type", () => {
		mockGetStoreRoute.mockReturnValue(null);
		for (const path of [
			"/about",
			"/contact",
			"/privacy",
			"/terms",
			"/blog",
			"/gift-cards",
			"/checkout",
		]) {
			expect(resolvePathForMarkdown(path)).toEqual({ type: "static", path });
		}
	});

	it("resolves unknown paths to not-found", () => {
		mockGetStoreRoute.mockReturnValue(null);
		expect(resolvePathForMarkdown("/unknown-page")).toEqual({
			type: "not-found",
		});
		expect(resolvePathForMarkdown("/admin")).toEqual({ type: "not-found" });
	});

	it("returns not-found for module-registered routes even if they match a known static path", () => {
		mockGetStoreRoute.mockReturnValue({
			moduleId: "blog",
			component: "BlogList",
			params: {},
		});
		// /blog is in STORE_LEVEL_ROUTES but getStoreRoute returns a match → not-found
		expect(resolvePathForMarkdown("/blog")).toEqual({ type: "not-found" });
	});

	it("returns not-found for unregistered module paths like /products", () => {
		mockGetStoreRoute.mockReturnValue(null);
		// /products is NOT in STORE_LEVEL_ROUTES and not a module route → not-found
		expect(resolvePathForMarkdown("/products")).toEqual({ type: "not-found" });
	});
});
