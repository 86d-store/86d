import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const EXCLUDED_PREFIXES = ["/api", "/admin", "/auth", "/_next", "/favicon"];

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Only apply to store routes that end with .md
	if (!pathname.endsWith(".md")) {
		return NextResponse.next();
	}

	// Exclude API, admin, auth, and static assets
	for (const prefix of EXCLUDED_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return NextResponse.next();
		}
	}

	// Rewrite to markdown API: /products.md -> /api/store-markdown?path=/products
	const pathWithoutMd = pathname.slice(0, -3) || "/";
	const url = request.nextUrl.clone();
	url.pathname = "/api/store-markdown";
	url.searchParams.set("path", pathWithoutMd);

	return NextResponse.rewrite(url);
}

export const config = {
	matcher: ["/((?!api|_next|admin|auth|favicon).*)"],
};
