import {
	createEndpointExposureResolver,
	type EndpointExposure,
} from "@86d-app/core/endpoint-exposure";
import type { Session } from "auth";
import { getSession } from "auth/actions";
import { verifyStoreAdminAccess } from "auth/store-access";
import env from "env";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "utils/logger";
import { createRateLimiter } from "utils/rate-limit";
import { ensureBooted } from "~/lib/api-registry";
import { resolveStoreCommerceGate } from "~/lib/store-commerce-availability";
import { createApiRouter, getModuleIdForPath } from "../../../generated/api";

type RouteParams = { params: Promise<{ path: string[] }> };

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Created once at module load — shared across all requests in this process.

/** General public endpoint limit: 2000 requests per minute per IP. */
const publicLimiter = createRateLimiter({ limit: 2000, window: 60_000 });

/** Sensitive public endpoints (subscribe, checkout initiation): 10 per 10 minutes per IP. */
const sensitiveLimiter = createRateLimiter({ limit: 10, window: 600_000 });

/** Admin endpoint limit: 300 requests per minute per session user. */
const adminLimiter = createRateLimiter({ limit: 300, window: 60_000 });

/** Provider webhook limit: 600 per minute per source IP, separate from shopper traffic. */
const webhookLimiter = createRateLimiter({ limit: 600, window: 60_000 });

// ── Declared exposure ─────────────────────────────────────────────────────────

let exposureResolver: ((path: string) => EndpointExposure | undefined) | null =
	null;

/**
 * Resolve a request path to the exposure its endpoint declared at registration.
 *
 * Returns `internal` when nothing matches so an unknown path is refused rather
 * than defaulting to a reachable surface. The 404 for unmatched paths is still
 * produced downstream by module resolution.
 */
async function resolveExposure(fullPath: string): Promise<EndpointExposure> {
	if (!exposureResolver) {
		const reg = await ensureBooted();
		exposureResolver = createEndpointExposureResolver(
			reg.getEndpointExposures(),
		);
	}
	return exposureResolver(fullPath) ?? "internal";
}

// Paths that get the stricter rate limit
const SENSITIVE_PATHS = new Set([
	"/newsletter/subscribe",
	"/newsletter/unsubscribe",
	"/checkout/requests",
	"/checkout/sessions",
	"/payments/intents",
]);

function isIpAddress(value: string): boolean {
	if (value.includes(":")) return /^[0-9a-fA-F:.]{2,45}$/.test(value);
	return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}

/**
 * Identify the caller for rate limiting.
 *
 * `x-forwarded-for` is a list the client starts and each proxy appends to, so
 * its leftmost entry is whatever the client typed. Reading that entry lets one
 * caller mint a fresh rate-limit bucket per request and never reach a limit.
 * Count back from the right instead, to the hop our own edge appended.
 *
 * A caller whose address cannot be established shares one bucket, so stripping
 * headers buys stricter limiting rather than looser.
 */
function getClientIp(req: NextRequest): string {
	const forwarded = req.headers.get("x-forwarded-for");
	if (forwarded) {
		const hops = forwarded
			.split(",")
			.map((hop) => hop.trim())
			.filter(Boolean);
		const candidate = hops[hops.length - env.TRUSTED_PROXY_HOPS];
		if (candidate && isIpAddress(candidate)) return candidate;
	}
	const real = req.headers.get("x-real-ip")?.trim();
	if (real && isIpAddress(real)) return real;
	return "unattributed";
}

// ── Error response normalization ──────────────────────────────────────────────
// Module endpoints return { error: string, status: N } but the platform uses
// { error: { code, message } } consistently. Normalize at the edge.

function httpStatusToCode(status: number): string {
	switch (status) {
		case 400:
			return "BAD_REQUEST";
		case 401:
			return "UNAUTHORIZED";
		case 403:
			return "FORBIDDEN";
		case 404:
			return "NOT_FOUND";
		case 409:
			return "CONFLICT";
		case 422:
			return "UNPROCESSABLE_ENTITY";
		case 429:
			return "TOO_MANY_REQUESTS";
		default:
			return "INTERNAL_SERVER_ERROR";
	}
}

function isDeclaredErrorCode(value: unknown): value is string {
	return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,99}$/.test(value);
}

async function normalizeErrorResponse(
	response: Response,
): Promise<NextResponse> {
	try {
		const body = await response.json();
		// Already structured — pass through
		if (body.error && typeof body.error === "object" && body.error.code) {
			return NextResponse.json(body, { status: response.status });
		}
		// Module-style { error: string } — normalize
		if (body.error && typeof body.error === "string") {
			return NextResponse.json(
				{
					error: {
						code: isDeclaredErrorCode(body.code)
							? body.code
							: httpStatusToCode(response.status),
						message: body.error,
					},
				},
				{ status: response.status },
			);
		}
		// Unknown shape — return as-is
		return NextResponse.json(body, { status: response.status });
	} catch {
		return NextResponse.json(
			{
				error: {
					code: httpStatusToCode(response.status),
					message: "An unexpected error occurred.",
				},
			},
			{ status: response.status },
		);
	}
}

function rateLimitResponse(resetAt: number): NextResponse {
	const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
	return NextResponse.json(
		{
			error: {
				code: "TOO_MANY_REQUESTS",
				message: "Rate limit exceeded. Please slow down.",
			},
		},
		{
			status: 429,
			headers: {
				"Retry-After": String(retryAfter),
				"X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
			},
		},
	);
}

/**
 * Handle all API requests.
 * Uses session-based authentication (cookies) for browser-based storefront and admin.
 */
async function handleRequest(req: NextRequest, ctx: RouteParams) {
	const { path } = await ctx.params;
	const fullPath = `/${path.join("/")}`;

	// Reachability comes from the endpoint's declaration, never from the shape of
	// the request path. An unresolvable path is served as the most restrictive
	// option rather than being assumed to be a shopper endpoint.
	const exposure = await resolveExposure(fullPath);
	const isAdmin = exposure === "admin";
	const isMutation = req.method !== "GET" && req.method !== "HEAD";

	if (exposure === "shopper" && isMutation) {
		const commerceGate = await resolveStoreCommerceGate();
		if (!commerceGate.available) {
			return NextResponse.json(
				{
					error: {
						code: "STORE_COMMERCE_UNAVAILABLE",
						message: "This store is temporarily unavailable.",
					},
				},
				{
					status: 503,
					headers: {
						"Cache-Control": "no-store",
						"Retry-After": "30",
					},
				},
			);
		}
	}

	// A provider webhook authenticates by verifying the provider's signature
	// inside the endpoint. It carries no session, and a browser session must
	// never grant or deny it anything.
	if (exposure === "provider_webhook") {
		const ip = getClientIp(req);
		const result = webhookLimiter.check(`provider_webhook:${ip}`);
		if (!result.allowed) {
			logger.warn("Provider webhook rate limit exceeded", {
				ip,
				path: fullPath,
			});
			return rateLimitResponse(result.resetAt);
		}
		return handleAuthedRequest(req, fullPath, null);
	}

	// ── Session-based authentication ─────────────────────────────────────
	// Fetch session once and reuse for both auth checks and the handler.
	const session = await getSession();

	if (isAdmin) {
		if (!session) {
			return NextResponse.json(
				{ error: { code: "UNAUTHORIZED", message: "Admin access required." } },
				{ status: 401 },
			);
		}

		// Verify user has admin role (better-auth admin plugin)
		const access = verifyStoreAdminAccess(session.user);
		if (!access.hasAccess) {
			logger.warn("Store admin access denied", {
				userId: session.user.id,
				path: fullPath,
			});
			return NextResponse.json(
				{
					error: {
						code: "FORBIDDEN",
						message: "You do not have permission to access this store.",
					},
				},
				{ status: 403 },
			);
		}

		// Rate limit by user ID for admin routes
		const userId = session.user.id;
		const result = adminLimiter.check(`admin:${userId}`);
		if (!result.allowed) {
			logger.warn("Admin rate limit exceeded", { userId, path: fullPath });
			return rateLimitResponse(result.resetAt);
		}
	} else {
		// Rate limit public routes by IP
		const ip = getClientIp(req);
		const isSensitive =
			SENSITIVE_PATHS.has(fullPath) ||
			fullPath.startsWith("/checkout/requests/");
		const limiter = isSensitive ? sensitiveLimiter : publicLimiter;
		const limitKey = `${isSensitive ? "sensitive" : "public"}:${ip}`;

		const result = limiter.check(limitKey);
		if (!result.allowed) {
			logger.warn("Public rate limit exceeded", {
				ip,
				path: fullPath,
				sensitive: isSensitive,
			});
			return rateLimitResponse(result.resetAt);
		}
	}

	return handleAuthedRequest(req, fullPath, session);
}

/**
 * Process the actual request after authentication is resolved.
 */
async function handleAuthedRequest(
	req: NextRequest,
	fullPath: string,
	session: Session | null,
) {
	try {
		const resolvedModuleId = getModuleIdForPath(fullPath);
		if (!resolvedModuleId) {
			return NextResponse.json(
				{
					error: {
						code: "NOT_FOUND",
						message: "Module endpoint not found.",
					},
				},
				{ status: 404 },
			);
		}

		if (fullPath === "/admin/inventory/adjust" && req.method === "POST") {
			if (!session) {
				return NextResponse.json(
					{
						error: {
							code: "UNAUTHORIZED",
							message: "Admin access required.",
						},
					},
					{ status: 401 },
				);
			}
			const { handleInventoryStockAdjustCommand } = await import(
				"~/lib/inventory-command-route"
			);
			const commandResponse = await handleInventoryStockAdjustCommand(
				req,
				session,
			);
			return commandResponse;
		}

		if (
			req.method === "POST" &&
			(fullPath === "/admin/catalog/revisions/create" ||
				/^\/admin\/catalog\/revisions\/[^/]+\/(?:review|publish)$/.test(
					fullPath,
				))
		) {
			if (!session) {
				return NextResponse.json(
					{
						error: {
							code: "UNAUTHORIZED",
							message: "Admin access required.",
						},
					},
					{ status: 401 },
				);
			}
			const { handleCatalogRevisionCommand, matchCatalogRevisionCommandPath } =
				await import("~/lib/catalog-command-route");
			const catalogCommand = matchCatalogRevisionCommandPath(fullPath);
			if (!catalogCommand) {
				return NextResponse.json(
					{
						error: {
							code: "NOT_FOUND",
							message: "Module endpoint not found.",
						},
					},
					{ status: 404 },
				);
			}
			const commandResponse = await handleCatalogRevisionCommand(
				req,
				session,
				catalogCommand,
			);
			return commandResponse;
		}

		const reg = await ensureBooted();
		const context = reg.createRequestContext(resolvedModuleId, session);

		const router = createApiRouter(context, {
			basePath: "/api",
			onError: (e) => {
				logger.error("Router error", {
					path: fullPath,
					error: e instanceof Error ? e.message : String(e),
				});
			},
		});

		const response = await router.handler(req);

		// Normalize module error responses to { error: { code, message } }
		if (response.status >= 400) {
			return normalizeErrorResponse(response);
		}

		// Durable event delivery is independently scheduled
		// (`bun run worker:durable-events`). Web traffic is neither the
		// scheduler nor the retry mechanism.
		return response;
	} catch (error) {
		console.error("API route unhandled error", fullPath, error);
		logger.error("API route unhandled error", {
			path: fullPath,
			error: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json(
			{
				error: {
					code: "INTERNAL_SERVER_ERROR",
					message: "An unexpected error occurred.",
				},
			},
			{ status: 500 },
		);
	}
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
