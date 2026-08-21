import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
vi.mock("auth/actions", () => ({ getSession: mockGetSession }));

const mockVerifyStoreAdminAccess = vi.hoisted(() => vi.fn());
vi.mock("auth/store-access", () => ({
	verifyStoreAdminAccess: mockVerifyStoreAdminAccess,
}));

const mockRateLimiterCheck = vi.hoisted(() => vi.fn());
vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({ check: mockRateLimiterCheck }),
}));

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock("utils/logger", () => ({
	logger: { warn: mockLoggerWarn, error: mockLoggerError },
}));

const mockEnsureBooted = vi.hoisted(() => vi.fn());
vi.mock("~/lib/api-registry", () => ({ ensureBooted: mockEnsureBooted }));
const mockCreateRequestContext = vi.hoisted(() => vi.fn());

const mockResolveStoreCommerceGate = vi.hoisted(() => vi.fn());
vi.mock("~/lib/store-commerce-availability", () => ({
	resolveStoreCommerceGate: mockResolveStoreCommerceGate,
}));

const mockCreateApiRouter = vi.hoisted(() => vi.fn());
const mockGetModuleIdForPath = vi.hoisted(() => vi.fn());
vi.mock("../../../../generated/api", () => ({
	createApiRouter: mockCreateApiRouter,
	getModuleIdForPath: mockGetModuleIdForPath,
}));

const mockHandleCatalogRevisionCommand = vi.hoisted(() => vi.fn());
vi.mock("~/lib/catalog-command-route", () => ({
	handleCatalogRevisionCommand: mockHandleCatalogRevisionCommand,
	matchCatalogRevisionCommandPath: (path: string) => {
		if (path === "/admin/catalog/revisions/create") {
			return { action: "draft" };
		}
		if (path === "/admin/catalog/revisions/revision-1/review") {
			return { action: "review", revisionId: "revision-1" };
		}
		if (path === "/admin/catalog/revisions/revision-1/publish") {
			return { action: "publish", revisionId: "revision-1" };
		}
		return null;
	},
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
import { GET, POST } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
	_path: string,
	method = "GET",
	extraHeaders: Record<string, string> = {},
) {
	return {
		method,
		headers: {
			get: (name: string) => {
				const h: Record<string, string> = {
					"x-forwarded-for": "10.0.0.1",
					...extraHeaders,
				};
				return h[name.toLowerCase()] ?? null;
			},
		},
	} as unknown as NextRequest;
}

function makeCtx(pathSegments: string[]) {
	return { params: Promise.resolve({ path: pathSegments }) };
}

const mockSession = {
	user: { id: "user_admin", email: "admin@example.com", role: "admin" },
};

function makeHandlerResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();

	// Default: rate limit allows all requests
	mockRateLimiterCheck.mockReturnValue({
		allowed: true,
		resetAt: Date.now() + 60_000,
	});

	// Default: authenticated as admin
	mockGetSession.mockResolvedValue(mockSession);
	mockVerifyStoreAdminAccess.mockReturnValue({
		hasAccess: true,
		role: "admin",
	});
	mockResolveStoreCommerceGate.mockResolvedValue({
		managed: false,
		available: true,
		reason: "standalone",
	});

	// Default: registry boots successfully. Endpoint reachability comes from the
	// declarations the registry resolved at boot, not from the request path.
	mockEnsureBooted.mockResolvedValue({
		createRequestContext: mockCreateRequestContext.mockReturnValue({}),
		isReady: () => true,
		getDurableEventConsumers: () => [],
		getModuleDbId: () => "22222222-2222-4222-8222-222222222222",
		getEndpointExposures: () => [
			{
				moduleId: "products",
				surface: "store",
				path: "/products",
				exposure: "shopper",
			},
			{
				moduleId: "orders",
				surface: "admin",
				path: "/admin/orders",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/products",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/catalog/revisions/create",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/catalog/revisions/:id/review",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/catalog/revisions/:id/publish",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/catalog/revisions/list",
				exposure: "admin",
			},
			{
				moduleId: "products",
				surface: "admin",
				path: "/admin/catalog/revisions/:id",
				exposure: "admin",
			},
			{
				moduleId: "stripe",
				surface: "store",
				path: "/stripe/webhook",
				exposure: "provider_webhook",
			},
		],
	});

	// Default: route belongs to the products module
	mockGetModuleIdForPath.mockReturnValue("products");

	// Default: router handler returns 200
	mockCreateApiRouter.mockReturnValue({
		handler: vi.fn().mockResolvedValue(makeHandlerResponse(200, { ok: true })),
	});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET|POST /api/[...path]", () => {
	describe("module-scoped context", () => {
		it("creates context for the resolved owner before routing", async () => {
			mockGetModuleIdForPath.mockReturnValue("orders");

			const response = await GET(
				makeRequest("/admin/orders"),
				makeCtx(["admin", "orders"]),
			);

			expect(response.status).toBe(200);
			expect(mockCreateRequestContext).toHaveBeenCalledWith(
				"orders",
				mockSession,
			);
		});

		it("returns 404 without booting when no module owns the path", async () => {
			mockGetModuleIdForPath.mockReturnValue(undefined);

			const response = await GET(
				makeRequest("/not-a-module"),
				makeCtx(["not-a-module"]),
			);
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.error.code).toBe("NOT_FOUND");
			expect(mockEnsureBooted).not.toHaveBeenCalled();
		});
	});

	describe("admin route — authentication", () => {
		it("returns 401 when admin route is accessed without a session", async () => {
			mockGetSession.mockResolvedValue(null);

			const res = await GET(
				makeRequest("/admin/products"),
				makeCtx(["admin", "products"]),
			);
			const json = await res.json();

			expect(res.status).toBe(401);
			expect(json.error.code).toBe("UNAUTHORIZED");
		});

		it("returns 403 when user lacks admin role on admin route", async () => {
			mockVerifyStoreAdminAccess.mockReturnValue({
				hasAccess: false,
				role: "user",
			});

			const res = await GET(
				makeRequest("/admin/products"),
				makeCtx(["admin", "products"]),
			);
			const json = await res.json();

			expect(res.status).toBe(403);
			expect(json.error.code).toBe("FORBIDDEN");
		});

		it("logs a warning when admin access is denied", async () => {
			mockVerifyStoreAdminAccess.mockReturnValue({ hasAccess: false });

			await GET(makeRequest("/admin/orders"), makeCtx(["admin", "orders"]));

			expect(mockLoggerWarn).toHaveBeenCalledWith(
				"Store admin access denied",
				expect.objectContaining({
					userId: "user_admin",
					path: "/admin/orders",
				}),
			);
		});

		it("allows admin access when session exists and user has admin role", async () => {
			const res = await GET(
				makeRequest("/admin/products"),
				makeCtx(["admin", "products"]),
			);

			expect(res.status).toBe(200);
		});
	});

	describe("admin route — rate limiting", () => {
		it("returns 429 when admin rate limit is exceeded", async () => {
			const resetAt = Date.now() + 30_000;
			mockRateLimiterCheck.mockReturnValue({ allowed: false, resetAt });

			const res = await GET(
				makeRequest("/admin/products"),
				makeCtx(["admin", "products"]),
			);
			const json = await res.json();

			expect(res.status).toBe(429);
			expect(json.error.code).toBe("TOO_MANY_REQUESTS");
		});

		it("includes Retry-After and X-RateLimit-Reset headers on 429", async () => {
			const resetAt = Date.now() + 60_000;
			mockRateLimiterCheck.mockReturnValue({ allowed: false, resetAt });

			const res = await GET(
				makeRequest("/admin/products"),
				makeCtx(["admin", "products"]),
			);

			expect(res.headers.get("Retry-After")).toBeTruthy();
			expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
		});
	});

	describe("public route — rate limiting", () => {
		it("applies the sensitive limiter to checkout session creation", async () => {
			await POST(
				makeRequest("/checkout/sessions", "POST"),
				makeCtx(["checkout", "sessions"]),
			);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith("sensitive:10.0.0.1");
		});

		it("returns 429 when public rate limit is exceeded", async () => {
			const resetAt = Date.now() + 60_000;
			mockRateLimiterCheck.mockReturnValue({ allowed: false, resetAt });

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(res.status).toBe(429);
			expect(json.error.code).toBe("TOO_MANY_REQUESTS");
		});

		it("logs a warning when public rate limit is exceeded", async () => {
			mockRateLimiterCheck.mockReturnValue({
				allowed: false,
				resetAt: Date.now() + 60_000,
			});

			await GET(makeRequest("/products"), makeCtx(["products"]));

			expect(mockLoggerWarn).toHaveBeenCalledWith(
				"Public rate limit exceeded",
				expect.objectContaining({ path: "/products" }),
			);
		});

		it("uses x-forwarded-for IP for rate limiting on public routes", async () => {
			await GET(
				makeRequest("/products", "GET", { "x-forwarded-for": "203.0.113.5" }),
				makeCtx(["products"]),
			);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				expect.stringContaining("203.0.113.5"),
			);
		});

		it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
			const req = {
				headers: {
					get: (name: string) => (name === "x-real-ip" ? "198.51.100.1" : null),
				},
			} as unknown as NextRequest;

			await GET(req, makeCtx(["products"]));

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				expect.stringContaining("198.51.100.1"),
			);
		});
	});

	describe("error response normalization", () => {
		it("preserves an explicit module failure code at the API boundary", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi.fn().mockResolvedValue(
					makeHandlerResponse(503, {
						code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
						error:
							"Checkout activation is unavailable until authoritative commerce decisions are configured.",
					}),
				),
			});

			const res = await POST(
				makeRequest("/checkout/sessions/session-1/complete", "POST"),
				makeCtx(["checkout", "sessions", "session-1", "complete"]),
			);
			const json = await res.json();

			expect(res.status).toBe(503);
			expect(json).toEqual({
				error: {
					code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
					message:
						"Checkout activation is unavailable until authoritative commerce decisions are configured.",
				},
			});
		});

		it("normalizes module string errors to { error: { code, message } } shape", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi
					.fn()
					.mockResolvedValue(
						makeHandlerResponse(400, { error: "Invalid quantity" }),
					),
			});

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(res.status).toBe(400);
			expect(json.error.code).toBe("BAD_REQUEST");
			expect(json.error.message).toBe("Invalid quantity");
		});

		it("passes through already-structured errors unchanged", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi.fn().mockResolvedValue(
					makeHandlerResponse(404, {
						error: { code: "NOT_FOUND", message: "Product not found" },
					}),
				),
			});

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(json.error.code).toBe("NOT_FOUND");
			expect(json.error.message).toBe("Product not found");
		});

		it("handles non-JSON error responses gracefully", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi.fn().mockResolvedValue(
					new Response("Internal Server Error", {
						status: 500,
						headers: { "Content-Type": "text/plain" },
					}),
				),
			});

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
		});

		it("returns 500 with structured error when router throws", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi.fn().mockRejectedValue(new Error("Registry unavailable")),
			});

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
		});

		it("logs errors when the router handler throws", async () => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi.fn().mockRejectedValue(new Error("DB connection lost")),
			});

			await GET(makeRequest("/products"), makeCtx(["products"]));

			expect(mockLoggerError).toHaveBeenCalledWith(
				"API route unhandled error",
				expect.objectContaining({
					path: "/products",
					error: "DB connection lost",
				}),
			);
		});
	});

	describe("HTTP method routing", () => {
		it("handles POST requests through the same handler", async () => {
			const res = await POST(makeRequest("/products"), makeCtx(["products"]));

			expect(res.status).toBe(200);
		});
	});

	describe("Store-scoped commerce availability", () => {
		it("blocks a shopper mutation before session or Module execution", async () => {
			mockResolveStoreCommerceGate.mockResolvedValueOnce({
				managed: true,
				available: false,
				reason: "entitlement_unavailable",
			});

			const response = await POST(
				makeRequest("/products", "POST"),
				makeCtx(["products"]),
			);

			expect(response.status).toBe(503);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
			expect(response.headers.get("Retry-After")).toBe("30");
			await expect(response.json()).resolves.toEqual({
				error: {
					code: "STORE_COMMERCE_UNAVAILABLE",
					message: "This store is temporarily unavailable.",
				},
			});
			expect(mockGetSession).not.toHaveBeenCalled();
			expect(mockCreateApiRouter).not.toHaveBeenCalled();
		});

		it("keeps shopper reads available without consulting the mutation gate", async () => {
			const response = await GET(
				makeRequest("/products"),
				makeCtx(["products"]),
			);

			expect(response.status).toBe(200);
			expect(mockResolveStoreCommerceGate).not.toHaveBeenCalled();
		});

		it("keeps Store Admin recovery mutations available during suspension", async () => {
			const response = await POST(
				makeRequest("/admin/products", "POST"),
				makeCtx(["admin", "products"]),
			);

			expect(response.status).toBe(200);
			expect(mockResolveStoreCommerceGate).not.toHaveBeenCalled();
		});

		it("keeps provider webhooks independent of Store entitlement and browser sessions", async () => {
			mockGetModuleIdForPath.mockReturnValue("stripe");

			const response = await POST(
				makeRequest("/stripe/webhook", "POST"),
				makeCtx(["stripe", "webhook"]),
			);

			expect(response.status).toBe(200);
			expect(mockResolveStoreCommerceGate).not.toHaveBeenCalled();
			expect(mockGetSession).not.toHaveBeenCalled();
			expect(mockCreateRequestContext).toHaveBeenCalledWith("stripe", null);
		});
	});

	describe("Catalog Command Admin transport", () => {
		it("refuses unauthenticated catalog publish", async () => {
			mockGetSession.mockResolvedValue(null);

			const response = await POST(
				makeRequest("/admin/catalog/revisions/revision-1/publish", "POST"),
				makeCtx(["admin", "catalog", "revisions", "revision-1", "publish"]),
			);

			expect(response.status).toBe(401);
			expect(mockHandleCatalogRevisionCommand).not.toHaveBeenCalled();
			expect(mockCreateApiRouter).not.toHaveBeenCalled();
		});

		it("refuses a non-admin session on catalog review", async () => {
			mockVerifyStoreAdminAccess.mockReturnValue({
				hasAccess: false,
				role: "customer",
			});

			const response = await POST(
				makeRequest("/admin/catalog/revisions/revision-1/review", "POST"),
				makeCtx(["admin", "catalog", "revisions", "revision-1", "review"]),
			);

			expect(response.status).toBe(403);
			expect(mockHandleCatalogRevisionCommand).not.toHaveBeenCalled();
		});

		it("does not intercept catalog revision reads", async () => {
			const response = await GET(
				makeRequest("/admin/catalog/revisions/list"),
				makeCtx(["admin", "catalog", "revisions", "list"]),
			);

			expect(response.status).toBe(200);
			expect(mockHandleCatalogRevisionCommand).not.toHaveBeenCalled();
			expect(mockCreateApiRouter).toHaveBeenCalled();
		});

		it("executes catalog draft through the Command transport", async () => {
			mockHandleCatalogRevisionCommand.mockResolvedValue(
				makeHandlerResponse(201, { revision: { state: "draft" } }),
			);

			const response = await POST(
				makeRequest("/admin/catalog/revisions/create", "POST"),
				makeCtx(["admin", "catalog", "revisions", "create"]),
			);

			expect(response.status).toBe(201);
			expect(mockHandleCatalogRevisionCommand).toHaveBeenCalled();
			expect(mockCreateApiRouter).not.toHaveBeenCalled();
		});
	});

	describe("status code mapping", () => {
		it.each([
			[400, "BAD_REQUEST"],
			[401, "UNAUTHORIZED"],
			[403, "FORBIDDEN"],
			[404, "NOT_FOUND"],
			[409, "CONFLICT"],
			[422, "UNPROCESSABLE_ENTITY"],
			[429, "TOO_MANY_REQUESTS"],
			[503, "INTERNAL_SERVER_ERROR"],
		])("maps HTTP %i to error code %s", async (httpStatus, expectedCode) => {
			mockCreateApiRouter.mockReturnValue({
				handler: vi
					.fn()
					.mockResolvedValue(
						makeHandlerResponse(httpStatus, { error: "some error" }),
					),
			});

			const res = await GET(makeRequest("/products"), makeCtx(["products"]));
			const json = await res.json();

			expect(json.error.code).toBe(expectedCode);
		});
	});
});
