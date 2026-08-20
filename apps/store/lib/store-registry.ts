/**
 * Store registry: builds route table from module store.pages.
 * Used by the catch-all store route (resolve path → component).
 */

import type { ModuleContext } from "@86d-app/core/types/module";
import { modules } from "generated/api";

export interface StoreRouteMatch {
	moduleId: string;
	component: string;
	params: Record<string, string>;
	toMarkdown?: (
		ctx: ModuleContext,
		params: Record<string, string>,
	) => Promise<string | null>;
}

function buildRouteTable(): Array<{
	pattern: string;
	moduleId: string;
	component: string;
	toMarkdown?: StoreRouteMatch["toMarkdown"];
}> {
	const rows: Array<{
		pattern: string;
		moduleId: string;
		component: string;
		toMarkdown?: StoreRouteMatch["toMarkdown"];
	}> = [];
	for (const mod of modules) {
		const moduleId = mod.id;
		const pages = mod.store?.pages ?? [];
		for (const page of pages) {
			rows.push({
				pattern: page.path,
				moduleId,
				component: page.component,
				toMarkdown: page.toMarkdown,
			});
		}
	}
	// Most specific (longer) patterns first so /products/:slug wins over /products
	rows.sort((a, b) => b.pattern.length - a.pattern.length);
	return rows;
}

function matchPath(
	pattern: string,
	path: string,
): Record<string, string> | null {
	const patternSegments = pattern.replace(/^\//, "").split("/").filter(Boolean);
	const pathSegments = path.replace(/^\//, "").split("/").filter(Boolean);
	if (patternSegments.length !== pathSegments.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < patternSegments.length; i++) {
		const p = patternSegments[i];
		const v = pathSegments[i];
		if (!v) return null;
		if (p.startsWith(":")) {
			params[p.slice(1)] = v;
		} else if (p !== v) {
			return null;
		}
	}
	return params;
}

let routeTable: ReturnType<typeof buildRouteTable> | null = null;

function getRouteTable() {
	if (!routeTable) routeTable = buildRouteTable();
	return routeTable;
}

/**
 * Normalize path for route matching (strip trailing slash, optional .md from last segment).
 */
function normalizePathForMatch(path: string): string {
	let normalized = path.replace(/\/$/, "") || "/";
	const segments = normalized.split("/").filter(Boolean);
	const last = segments.at(-1);
	if (segments.length > 0 && last?.endsWith(".md")) {
		segments[segments.length - 1] = last.slice(0, -3);
		normalized = `/${segments.join("/")}`;
	}
	return normalized;
}

/**
 * Resolve a store path to the owning module, component, and extracted params.
 * Strips .md from the last segment if present for markdown URL support.
 */
export function getStoreRoute(path: string): StoreRouteMatch | null {
	const table = getRouteTable();
	const normalized = normalizePathForMatch(path);
	for (const row of table) {
		const params = matchPath(row.pattern, normalized);
		if (params !== null) {
			const match: StoreRouteMatch = {
				moduleId: row.moduleId,
				component: row.component,
				params,
			};
			if (row.toMarkdown) {
				match.toMarkdown = row.toMarkdown;
			}
			return match;
		}
	}
	return null;
}
