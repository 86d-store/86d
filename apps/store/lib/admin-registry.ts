/**
 * Admin registry: builds nav items and route table from module admin.pages.
 * Used by AdminShell (sidebar) and the catch-all admin route (resolve path → component).
 *
 * Supports 2-level navigation:
 *   Level 1 — Groups (Catalog, Sales, Customers, …)
 *   Level 2 — Subgroups within groups (Orders, Cart, Billing, …)
 *
 * Subgroups are assigned automatically based on the item's path prefix.
 * Modules can override this by setting `subgroup` on their AdminPage declarations.
 */

import type { AdminPage } from "@86d-app/core/types/module";
import { modules } from "generated/api";

export interface AdminNavItem {
	label: string;
	href: string;
	icon?: string;
	group?: string;
	subgroup?: string;
}

export interface AdminNavSubGroup {
	label: string;
	icon: string;
	items: AdminNavItem[];
}

export interface AdminNavGroup {
	label: string;
	icon: string;
	/** Direct items not assigned to any subgroup */
	items: AdminNavItem[];
	/** Collapsible subgroups within this group */
	subgroups: AdminNavSubGroup[];
}

export interface AdminRouteMatch {
	moduleId: string;
	component: string;
	params: Record<string, string>;
}

/**
 * Stable order and icons for sidebar groups.
 * Groups not listed here appear alphabetically after the defined ones.
 */
const GROUP_CONFIG: ReadonlyArray<{ label: string; icon: string }> = [
	{ label: "Catalog", icon: "Package" },
	{ label: "Sales", icon: "ShoppingCart" },
	{ label: "Customers", icon: "Users" },
	{ label: "Fulfillment", icon: "Truck" },
	{ label: "Marketing", icon: "Megaphone" },
	{ label: "Content", icon: "FileText" },
	{ label: "Finance", icon: "DollarSign" },
	{ label: "Support", icon: "LifeBuoy" },
	{ label: "System", icon: "Settings" },
] as const;

const GROUP_ORDER = GROUP_CONFIG.map((g) => g.label);

/** Map of group label → icon name for sidebar rendering */
export const GROUP_ICONS: Record<string, string> = Object.fromEntries(
	GROUP_CONFIG.map((g) => [g.label, g.icon]),
);

// ---------------------------------------------------------------------------
// Subgroup configuration
// ---------------------------------------------------------------------------

/**
 * Subgroup definitions per group.
 * Each entry: label, icon, and the admin path segments it owns.
 * Order here determines sidebar display order.
 */
const SUBGROUP_CONFIG: Record<
	string,
	ReadonlyArray<{
		label: string;
		icon: string;
		/** First path segment(s) after /admin/ that belong to this subgroup */
		segments: string[];
	}>
> = {
	Catalog: [
		{
			label: "Products",
			icon: "Package",
			segments: ["products", "categories", "collections", "bundles"],
		},
		{
			label: "Brands",
			icon: "Store",
			segments: ["brands", "vendors"],
		},
		{
			label: "Pricing",
			icon: "DollarSign",
			segments: ["bulk-pricing", "price-lists", "labels"],
		},
	],
	Sales: [
		{
			label: "Orders",
			icon: "ShoppingBag",
			segments: ["orders", "checkout", "returns"],
		},
		{
			label: "Cart",
			icon: "ShoppingCart",
			segments: ["carts", "abandoned-carts"],
		},
		{
			label: "Billing",
			icon: "Receipt",
			segments: ["payments", "invoices", "gift-cards", "downloads"],
		},
		{
			label: "Scheduling",
			icon: "Calendar",
			segments: ["appointments", "subscriptions"],
		},
		{
			label: "Promotions",
			icon: "Lightning",
			segments: ["flash-sales", "auctions", "quotes"],
		},
		{
			label: "Add-ons",
			icon: "Gift",
			segments: ["gift-wrapping", "gift-registries", "warranties"],
		},
	],
	Customers: [
		{
			label: "Manage",
			icon: "Users",
			segments: ["customers", "customer-groups"],
		},
		{
			label: "Programs",
			icon: "Crown",
			segments: ["loyalty", "memberships", "store-credits"],
		},
		{
			label: "Growth",
			icon: "TrendingUp",
			segments: ["affiliates", "referrals"],
		},
	],
	Fulfillment: [
		{
			label: "Shipping",
			icon: "Truck",
			segments: ["shipping", "fulfillment"],
		},
		{
			label: "Inventory",
			icon: "Warehouse",
			segments: ["inventory", "backorders", "preorders"],
		},
		{
			label: "Delivery",
			icon: "MapPin",
			segments: ["store-pickup", "delivery-slots"],
		},
	],
	Marketing: [
		{
			label: "Promotions",
			icon: "Tag",
			segments: ["discounts"],
		},
		{
			label: "Feedback",
			icon: "Star",
			segments: ["reviews", "product-qa", "comparisons"],
		},
		{
			label: "Engagement",
			icon: "Megaphone",
			segments: [
				"newsletter",
				"wishlist",
				"waitlist",
				"social-proof",
				"recently-viewed",
				"recommendations",
				"product-feeds",
			],
		},
	],
	Content: [
		{
			label: "Publishing",
			icon: "Article",
			segments: ["pages", "blog", "announcements"],
		},
		{
			label: "Knowledge",
			icon: "BookOpen",
			segments: ["faq", "forms"],
		},
		{
			label: "Site",
			icon: "Globe",
			segments: [
				"navigation",
				"media",
				"seo",
				"store-locator",
				"redirects",
				"sitemap",
			],
		},
	],
	Finance: [
		{
			label: "Reporting",
			icon: "ChartBar",
			segments: ["revenue"],
		},
		{
			label: "Gateways",
			icon: "CreditCard",
			segments: ["stripe", "paypal", "square", "braintree"],
		},
		{
			label: "Configuration",
			icon: "Sliders",
			segments: ["tax", "currencies"],
		},
	],
	Support: [
		{
			label: "Helpdesk",
			icon: "Ticket",
			segments: ["tickets"],
		},
		{
			label: "Messaging",
			icon: "Bell",
			segments: ["notifications"],
		},
	],
	System: [
		{
			label: "Monitoring",
			icon: "ChartBar",
			segments: ["analytics", "audit-log"],
		},
		{
			label: "Tools",
			icon: "Wrench",
			segments: ["settings", "search", "automations", "import-export"],
		},
	],
};

/**
 * Pre-computed lookup: (group, path-segment) → subgroup label.
 * Built once from SUBGROUP_CONFIG.
 */
const SEGMENT_TO_SUBGROUP: Record<string, Record<string, string>> = {};
for (const [group, subgroups] of Object.entries(SUBGROUP_CONFIG)) {
	const map: Record<string, string> = {};
	for (const sg of subgroups) {
		for (const seg of sg.segments) {
			map[seg] = sg.label;
		}
	}
	SEGMENT_TO_SUBGROUP[group] = map;
}

/**
 * Pre-computed lookup: (group, subgroup label) → { label, icon }.
 */
const SUBGROUP_META: Record<
	string,
	Record<string, { label: string; icon: string }>
> = {};
for (const [group, subgroups] of Object.entries(SUBGROUP_CONFIG)) {
	const map: Record<string, { label: string; icon: string }> = {};
	for (const sg of subgroups) {
		map[sg.label] = { label: sg.label, icon: sg.icon };
	}
	SUBGROUP_META[group] = map;
}

/**
 * Extract the first path segment after /admin/ from an href.
 * e.g. "/admin/products/new" → "products"
 */
function extractAdminSegment(href: string): string {
	const parts = href.replace(/^\//, "").split("/");
	// parts[0] = "admin", parts[1] = first segment
	return parts[1] ?? "";
}

/**
 * Determine the subgroup for a nav item.
 * Priority: explicit page.subgroup > path-based auto-assignment > undefined.
 */
function resolveSubgroup(
	item: AdminNavItem,
	group: string,
): string | undefined {
	if (item.subgroup) return item.subgroup;
	const segmentMap = SEGMENT_TO_SUBGROUP[group];
	if (!segmentMap) return undefined;
	const segment = extractAdminSegment(item.href);
	return segmentMap[segment];
}

// ---------------------------------------------------------------------------
// Route table (unchanged)
// ---------------------------------------------------------------------------

function buildRouteTable(): Array<{
	pattern: string;
	moduleId: string;
	component: string;
}> {
	const rows: Array<{ pattern: string; moduleId: string; component: string }> =
		[];
	for (const mod of modules) {
		const moduleId = mod.id;
		const pages = mod.admin?.pages ?? [];
		for (const page of pages) {
			rows.push({
				pattern: page.path,
				moduleId,
				component: page.component,
			});
		}
	}
	// Most specific (longer) patterns first so /admin/products/:id/edit wins over /admin/products/:id
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
 * Resolve an admin path to the owning module, component, and extracted params.
 */
export function getAdminRoute(path: string): AdminRouteMatch | null {
	const table = getRouteTable();
	const normalized = path.replace(/\/$/, "") || "/";
	for (const row of table) {
		const params = matchPath(row.pattern, normalized);
		if (params !== null) {
			return {
				moduleId: row.moduleId,
				component: row.component,
				params,
			};
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Nav items (flat list)
// ---------------------------------------------------------------------------

/**
 * Nav items for the admin sidebar: only pages with a label, with optional group, icon, and subgroup.
 * Order: by group (Catalog, Sales, …), then by subgroup order, then alphabetically within subgroup.
 */
export function getAdminNavItems(): AdminNavItem[] {
	const withLabel: Array<AdminNavItem & { sortGroup: string }> = [];
	for (const mod of modules) {
		const pages = (mod.admin?.pages ?? []) as AdminPage[];
		for (const page of pages) {
			if (!page.label) continue;
			withLabel.push({
				label: page.label,
				href: page.path,
				...(page.icon !== undefined && page.icon !== "" && { icon: page.icon }),
				...(page.group !== undefined &&
					page.group !== "" && { group: page.group }),
				...(page.subgroup !== undefined &&
					page.subgroup !== "" && { subgroup: page.subgroup }),
				sortGroup: page.group ?? "\uFFFF", // ungrouped last when sorted
			});
		}
	}

	const orderIdx = (g: string) => {
		const i = GROUP_ORDER.indexOf(g);
		return i >= 0 ? i : GROUP_ORDER.length;
	};
	withLabel.sort((a, b) => {
		const oa = orderIdx(a.sortGroup);
		const ob = orderIdx(b.sortGroup);
		if (oa !== ob) return oa - ob;
		return a.label.localeCompare(b.label);
	});

	return withLabel.map(({ sortGroup: _, ...item }) => item);
}

// ---------------------------------------------------------------------------
// Nav groups (2-level structured)
// ---------------------------------------------------------------------------

/**
 * Structured nav groups for the sidebar with ordered sections and subgroups.
 * Each group has a label, icon, direct items (no subgroup), and subgroups.
 */
export function getAdminNavGroups(): AdminNavGroup[] {
	const items = getAdminNavItems();
	const groupMap = new Map<string, AdminNavItem[]>();

	for (const item of items) {
		const key = item.group ?? "";
		const arr = groupMap.get(key);
		if (arr) {
			arr.push(item);
		} else {
			groupMap.set(key, [item]);
		}
	}

	const orderIdx = (g: string) => {
		const i = GROUP_ORDER.indexOf(g);
		return i >= 0 ? i : GROUP_ORDER.length;
	};

	const groups: AdminNavGroup[] = [];
	for (const [label, groupItems] of groupMap) {
		if (!label) continue; // skip ungrouped for now

		// Separate items into subgroups and direct items
		const subgroupBuckets = new Map<string, AdminNavItem[]>();
		const directItems: AdminNavItem[] = [];

		for (const item of groupItems) {
			const sg = resolveSubgroup(item, label);
			if (sg) {
				const bucket = subgroupBuckets.get(sg);
				if (bucket) {
					bucket.push(item);
				} else {
					subgroupBuckets.set(sg, [item]);
				}
			} else {
				directItems.push(item);
			}
		}

		// Build subgroups in config order
		const subgroups: AdminNavSubGroup[] = [];
		const configOrder = SUBGROUP_CONFIG[label];
		if (configOrder) {
			for (const sgConfig of configOrder) {
				const sgItems = subgroupBuckets.get(sgConfig.label);
				if (sgItems && sgItems.length > 0) {
					sgItems.sort((a, b) => a.label.localeCompare(b.label));
					subgroups.push({
						label: sgConfig.label,
						icon: sgConfig.icon,
						items: sgItems,
					});
				}
			}
		}

		// Any subgroups not in config (from explicit module declarations) go at the end
		for (const [sgLabel, sgItems] of subgroupBuckets) {
			if (subgroups.some((sg) => sg.label === sgLabel)) continue;
			sgItems.sort((a, b) => a.label.localeCompare(b.label));
			const meta = SUBGROUP_META[label]?.[sgLabel];
			subgroups.push({
				label: sgLabel,
				icon: meta?.icon ?? "Folder",
				items: sgItems,
			});
		}

		directItems.sort((a, b) => a.label.localeCompare(b.label));

		groups.push({
			label,
			icon: GROUP_ICONS[label] ?? "Folder",
			items: directItems,
			subgroups,
		});
	}

	groups.sort((a, b) => {
		const oa = orderIdx(a.label);
		const ob = orderIdx(b.label);
		if (oa !== ob) return oa - ob;
		return a.label.localeCompare(b.label);
	});

	// Prepend ungrouped items as individual pseudo-group
	const ungrouped = groupMap.get("");
	if (ungrouped) {
		groups.unshift({
			label: "",
			icon: "",
			items: ungrouped,
			subgroups: [],
		});
	}

	return groups;
}
