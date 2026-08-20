/**
 * Markdown serializers for store-level routes (non-module).
 * Module routes (products, collections, blog) use their own toMarkdown.
 */

import { getBaseUrl } from "utils/url";
import { getStoreName } from "./seo";
import { getStoreRoute } from "./store-registry";

const STORE_LEVEL_ROUTES = new Set([
	"/",
	"/search",
	"/about",
	"/contact",
	"/privacy",
	"/terms",
	"/blog",
	"/gift-cards",
	"/checkout",
]);

async function serializeHomepage(): Promise<string> {
	const storeName = await getStoreName();
	const url = getBaseUrl();

	return `# ${storeName}

Thoughtfully selected products that elevate your everyday. Quality craftsmanship meets modern design.

## Quick links

- [Shop all products](${url}/products)
- [Collections](${url}/collections)
- [Search](${url}/search)
`;
}

async function serializeSearch(): Promise<string> {
	const url = getBaseUrl();
	const storeName = await getStoreName();

	return `# Search

Search products at ${storeName}.

[Search products](${url}/search)
`;
}

async function serializeStaticPage(path: string): Promise<string> {
	const storeName = await getStoreName();
	const url = getBaseUrl();

	const titles: Record<string, string> = {
		"/about": "About",
		"/contact": "Contact",
		"/privacy": "Privacy Policy",
		"/terms": "Terms of Service",
		"/gift-cards": "Gift Cards",
		"/checkout": "Checkout",
		"/blog": "Blog",
	};

	const title = titles[path] ?? path.slice(1).replace(/-/g, " ");
	return `# ${title}

${storeName}

[View page](${url}${path})
`;
}

export type PathResolution =
	| { type: "homepage" }
	| { type: "search" }
	| { type: "static"; path: string }
	| { type: "not-found" };

/**
 * Resolve a normalized path to a store-level content type for markdown serialization.
 * Module routes (products, collections, blog) are handled by the API route via toMarkdown.
 */
export function resolvePathForMarkdown(path: string): PathResolution {
	const normalized = path.replace(/\/$/, "") || "/";

	// Module routes are delegated to modules; return not-found so we 404
	if (getStoreRoute(normalized)) {
		return { type: "not-found" };
	}

	if (normalized === "/") return { type: "homepage" };
	if (STORE_LEVEL_ROUTES.has(normalized)) {
		if (normalized === "/search") return { type: "search" };
		return { type: "static", path: normalized };
	}

	return { type: "not-found" };
}

/**
 * Serialize resolved path to markdown string (store-level routes only).
 */
export async function serializeToMarkdown(
	resolution: PathResolution,
): Promise<string | null> {
	switch (resolution.type) {
		case "homepage":
			return serializeHomepage();
		case "search":
			return serializeSearch();
		case "static":
			return serializeStaticPage(resolution.path);
		case "not-found":
			return null;
	}
}
