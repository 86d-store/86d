import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getStoreRoute: vi.fn(),
	ensureBooted: vi.fn(),
	resolvePathForMarkdown: vi.fn(),
	serializeToMarkdown: vi.fn(),
	rateLimitCheck: vi.fn(),
}));

vi.mock("~/lib/store-registry", () => ({
	getStoreRoute: mocks.getStoreRoute,
}));

vi.mock("~/lib/api-registry", () => ({
	ensureBooted: mocks.ensureBooted,
}));

vi.mock("~/lib/markdown-serializers", () => ({
	resolvePathForMarkdown: mocks.resolvePathForMarkdown,
	serializeToMarkdown: mocks.serializeToMarkdown,
}));

vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}));

const { GET } = await import("../route");

function makeRequest(path?: string, baseUrl = "http://localhost"): NextRequest {
	const url =
		path !== undefined
			? `${baseUrl}/api/store-markdown?path=${encodeURIComponent(path)}`
			: `${baseUrl}/api/store-markdown`;
	return new NextRequest(url);
}

function makeRequestFromUrl(urlPath: string): NextRequest {
	return new NextRequest(`http://localhost${urlPath}`);
}

describe("GET /api/store-markdown", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getStoreRoute.mockReturnValue(null);
		mocks.resolvePathForMarkdown.mockReturnValue({ type: "homepage" });
		mocks.serializeToMarkdown.mockResolvedValue("# Home\n\nWelcome!");
		// Default: allow all requests
		mocks.rateLimitCheck.mockReturnValue({ allowed: true, resetAt: 0 });
	});

	describe("rate limiting", () => {
		it("returns 429 when rate limit is exceeded", async () => {
			const resetAt = Date.now() + 30_000;
			mocks.rateLimitCheck.mockReturnValue({ allowed: false, resetAt });
			const response = await GET(makeRequest("/products"));
			expect(response.status).toBe(429);
		});

		it("includes Retry-After header on 429", async () => {
			const resetAt = Date.now() + 30_000;
			mocks.rateLimitCheck.mockReturnValue({ allowed: false, resetAt });
			const response = await GET(makeRequest("/"));
			expect(response.headers.get("Retry-After")).toBeTruthy();
		});

		it("sets Content-Type to text/markdown on 429", async () => {
			mocks.rateLimitCheck.mockReturnValue({
				allowed: false,
				resetAt: Date.now() + 1000,
			});
			const response = await GET(makeRequest("/"));
			expect(response.headers.get("Content-Type")).toContain("text/markdown");
		});

		it("does not call getStoreRoute when rate limited", async () => {
			mocks.rateLimitCheck.mockReturnValue({
				allowed: false,
				resetAt: Date.now() + 1000,
			});
			await GET(makeRequest("/products"));
			expect(mocks.getStoreRoute).not.toHaveBeenCalled();
		});

		it("allows requests when within rate limit", async () => {
			mocks.rateLimitCheck.mockReturnValue({ allowed: true, resetAt: 0 });
			const response = await GET(makeRequest("/"));
			expect(response.status).toBe(200);
		});
	});

	describe("path derivation", () => {
		it("uses the path query param when provided", async () => {
			await GET(makeRequest("/products"));
			expect(mocks.getStoreRoute).toHaveBeenCalledWith("/products");
		});

		it("derives path from URL when query param is missing", async () => {
			await GET(makeRequestFromUrl("/about.md"));
			expect(mocks.getStoreRoute).toHaveBeenCalledWith("/about");
		});

		it("strips .md suffix from URL-derived path", async () => {
			await GET(makeRequestFromUrl("/products/sneakers.md"));
			expect(mocks.getStoreRoute).toHaveBeenCalledWith("/products/sneakers");
		});

		it("returns 404 for a path not starting with /", async () => {
			const response = await GET(makeRequest("not-a-valid-path"));
			expect(response.status).toBe(404);
		});
	});

	describe("module toMarkdown delegation", () => {
		it("calls toMarkdown when the route provides it", async () => {
			const toMarkdown = vi.fn().mockResolvedValue("# Product\n\nDetails.");
			const mockCtx = {};
			const createRequestContext = vi.fn().mockReturnValue(mockCtx);
			mocks.getStoreRoute.mockReturnValue({
				moduleId: "products",
				component: "ProductDetail",
				params: { slug: "sneaker" },
				toMarkdown,
			});
			mocks.ensureBooted.mockResolvedValue({
				createRequestContext,
			});

			const response = await GET(makeRequest("/products/sneaker"));

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toContain("text/markdown");
			const text = await response.text();
			expect(text).toBe("# Product\n\nDetails.");
			expect(createRequestContext).toHaveBeenCalledWith("products", null);
			expect(toMarkdown).toHaveBeenCalledWith(mockCtx, { slug: "sneaker" });
		});

		it("falls through to fallback when toMarkdown returns null", async () => {
			const toMarkdown = vi.fn().mockResolvedValue(null);
			mocks.getStoreRoute.mockReturnValue({
				moduleId: "products",
				component: "ProductDetail",
				params: {},
				toMarkdown,
			});
			mocks.ensureBooted.mockResolvedValue({
				createRequestContext: vi.fn().mockReturnValue({}),
			});
			mocks.serializeToMarkdown.mockResolvedValue("# Fallback");

			const response = await GET(makeRequest("/products/gone"));
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toBe("# Fallback");
		});

		it("falls through to fallback when toMarkdown throws", async () => {
			const toMarkdown = vi.fn().mockRejectedValue(new Error("Module error"));
			mocks.getStoreRoute.mockReturnValue({
				moduleId: "products",
				component: "ProductDetail",
				params: {},
				toMarkdown,
			});
			mocks.ensureBooted.mockResolvedValue({
				createRequestContext: vi.fn().mockReturnValue({}),
			});
			mocks.serializeToMarkdown.mockResolvedValue("# Fallback after error");

			const response = await GET(makeRequest("/products/broken"));
			expect(response.status).toBe(200);
		});

		it("skips module delegation when route has no toMarkdown", async () => {
			mocks.getStoreRoute.mockReturnValue({
				moduleId: "cart",
				component: "CartPage",
				params: {},
			});

			await GET(makeRequest("/cart"));

			expect(mocks.ensureBooted).not.toHaveBeenCalled();
		});
	});

	describe("store-level fallback serialization", () => {
		it("returns 200 with markdown from serializeToMarkdown", async () => {
			mocks.serializeToMarkdown.mockResolvedValue("# Home\n\nWelcome!");

			const response = await GET(makeRequest("/"));

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toContain("text/markdown");
			const text = await response.text();
			expect(text).toBe("# Home\n\nWelcome!");
		});

		it("returns 404 when serializeToMarkdown returns null", async () => {
			mocks.serializeToMarkdown.mockResolvedValue(null);

			const response = await GET(makeRequest("/unknown-page"));

			expect(response.status).toBe(404);
			const text = await response.text();
			expect(text).toContain("Not Found");
		});

		it("passes resolved path to resolvePathForMarkdown", async () => {
			await GET(makeRequest("/search"));
			expect(mocks.resolvePathForMarkdown).toHaveBeenCalledWith("/search");
		});
	});

	describe("response headers", () => {
		it("sets Content-Type to text/markdown on success", async () => {
			mocks.serializeToMarkdown.mockResolvedValue("# OK");
			const response = await GET(makeRequest("/products"));
			expect(response.headers.get("Content-Type")).toContain("text/markdown");
		});

		it("sets Content-Type to text/markdown on 404", async () => {
			mocks.serializeToMarkdown.mockResolvedValue(null);
			const response = await GET(makeRequest("/nope"));
			expect(response.headers.get("Content-Type")).toContain("text/markdown");
		});
	});
});
