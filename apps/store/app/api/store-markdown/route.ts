import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createRateLimiter } from "utils/rate-limit";
import { ensureBooted } from "~/lib/api-registry";
import {
	resolvePathForMarkdown,
	serializeToMarkdown,
} from "~/lib/markdown-serializers";
import { getStoreRoute } from "~/lib/store-registry";

const MARKDOWN_HEADERS = {
	"Content-Type": "text/markdown; charset=utf-8",
} as const;

/** 120 requests per minute per IP — generous for LLM crawlers, protective against abuse. */
const markdownLimiter = createRateLimiter({ limit: 120, window: 60_000 });

export async function GET(request: NextRequest) {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	const rlResult = markdownLimiter.check(ip);
	if (!rlResult.allowed) {
		return new NextResponse("# Too Many Requests\n\nRate limit exceeded.", {
			status: 429,
			headers: {
				...MARKDOWN_HEADERS,
				"Retry-After": String(
					Math.ceil((rlResult.resetAt - Date.now()) / 1000),
				),
			},
		});
	}

	let rawPath = request.nextUrl.searchParams.get("path");
	// Middleware rewrites /products.md -> /api/store-markdown?path=/products, but the handler
	// may receive the original URL (request.url still shows /products.md). Derive path from
	// the request URL when the query param is missing.
	if (rawPath === "" || rawPath === null) {
		const urlPath = new URL(request.url).pathname;
		rawPath = urlPath.endsWith(".md")
			? urlPath.slice(0, -3) || "/"
			: urlPath || "/";
	}
	const path = rawPath === "" || rawPath === null ? "/" : rawPath;
	if (!path.startsWith("/")) {
		return new NextResponse("# Not Found\n\nInvalid path parameter.", {
			status: 404,
			headers: MARKDOWN_HEADERS,
		});
	}

	// Delegate to module toMarkdown when available
	const match = getStoreRoute(path);
	if (match?.toMarkdown) {
		try {
			const reg = await ensureBooted();
			const ctx = reg.createRequestContext(match.moduleId, null);
			const markdown = await match.toMarkdown(ctx, match.params);
			if (markdown) {
				return new NextResponse(markdown, {
					status: 200,
					headers: MARKDOWN_HEADERS,
				});
			}
		} catch {
			// Fall through to 404
		}
	}

	// Store-level fallback for /, /search, /about, etc.
	const resolution = resolvePathForMarkdown(path);
	const markdown = await serializeToMarkdown(resolution);

	if (!markdown) {
		return new NextResponse(
			"# Not Found\n\nThe requested page could not be found.",
			{
				status: 404,
				headers: MARKDOWN_HEADERS,
			},
		);
	}

	return new NextResponse(markdown, {
		status: 200,
		headers: MARKDOWN_HEADERS,
	});
}
