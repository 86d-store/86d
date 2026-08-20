import { describe, expect, it, vi } from "vitest";

vi.mock("generated/api", () => ({
	modules: [
		{
			id: "products",
			admin: {
				pages: [
					{
						path: "/admin/products",
						component: "ProductList",
						label: "Products",
						icon: "Package",
						group: "Catalog",
					},
					{
						path: "/admin/products/:id",
						component: "ProductDetail",
						// No label — should not appear in nav
					},
					{
						path: "/admin/products/:id/edit",
						component: "ProductEdit",
						label: "Edit Product",
						group: "Catalog",
					},
				],
			},
		},
		{
			id: "orders",
			admin: {
				pages: [
					{
						path: "/admin/orders",
						component: "OrderList",
						label: "Orders",
						icon: "ShoppingBag",
						group: "Sales",
					},
					{
						path: "/admin/orders/:id",
						component: "OrderDetail",
						label: "Order Detail",
						group: "Sales",
					},
				],
			},
		},
		{
			id: "analytics",
			admin: {
				pages: [
					{
						path: "/admin/analytics",
						component: "AnalyticsDashboard",
						label: "Analytics",
						group: "System",
					},
				],
			},
		},
		{
			id: "settings",
			admin: {
				pages: [
					{
						path: "/admin/settings",
						component: "SettingsPage",
						label: "Settings",
						group: "System",
						subgroup: "CustomSub", // Explicit subgroup override
					},
				],
			},
		},
		{
			id: "ungrouped-module",
			admin: {
				pages: [
					{
						path: "/admin/ungrouped",
						component: "UngroupedPage",
						label: "Ungrouped Item",
						// No group
					},
				],
			},
		},
		{
			id: "no-admin",
			// No admin pages
		},
	],
}));

import {
	GROUP_ICONS,
	getAdminNavGroups,
	getAdminNavItems,
	getAdminRoute,
} from "../admin-registry";

// ── getAdminRoute ───────────────────────────────────────────────────

describe("getAdminRoute", () => {
	it("matches exact static paths", () => {
		const match = getAdminRoute("/admin/products");
		expect(match).not.toBeNull();
		expect(match?.moduleId).toBe("products");
		expect(match?.component).toBe("ProductList");
		expect(match?.params).toEqual({});
	});

	it("matches nested static paths", () => {
		const match = getAdminRoute("/admin/orders");
		expect(match).not.toBeNull();
		expect(match?.moduleId).toBe("orders");
	});

	it("extracts dynamic :id param", () => {
		const match = getAdminRoute("/admin/products/prod-123");
		expect(match).not.toBeNull();
		expect(match?.moduleId).toBe("products");
		expect(match?.component).toBe("ProductDetail");
		expect(match?.params).toEqual({ id: "prod-123" });
	});

	it("matches deeper nested paths with params", () => {
		const match = getAdminRoute("/admin/products/prod-abc/edit");
		expect(match).not.toBeNull();
		expect(match?.component).toBe("ProductEdit");
		expect(match?.params).toEqual({ id: "prod-abc" });
	});

	it("strips trailing slash before matching", () => {
		const match = getAdminRoute("/admin/orders/");
		expect(match).not.toBeNull();
		expect(match?.moduleId).toBe("orders");
	});

	it("returns null for unrecognized paths", () => {
		expect(getAdminRoute("/admin/not-a-route")).toBeNull();
	});

	it("returns null for paths that are too deep", () => {
		expect(getAdminRoute("/admin/orders/id/sub/extra")).toBeNull();
	});
});

// ── getAdminNavItems ────────────────────────────────────────────────

describe("getAdminNavItems", () => {
	it("excludes pages without a label", () => {
		const items = getAdminNavItems();
		const noLabelItem = items.find((i) => i.href === "/admin/products/:id");
		expect(noLabelItem).toBeUndefined();
	});

	it("includes pages that have a label", () => {
		const items = getAdminNavItems();
		const productItem = items.find((i) => i.href === "/admin/products");
		expect(productItem).toBeDefined();
		expect(productItem?.label).toBe("Products");
		expect(productItem?.icon).toBe("Package");
		expect(productItem?.group).toBe("Catalog");
	});

	it("sorts Catalog group before Sales before System", () => {
		const items = getAdminNavItems();
		const groups = items
			.map((i) => i.group)
			.filter((g): g is string => g !== undefined);
		const catalogIdx = groups.indexOf("Catalog");
		const salesIdx = groups.indexOf("Sales");
		const systemIdx = groups.indexOf("System");
		expect(catalogIdx).toBeLessThan(salesIdx);
		expect(salesIdx).toBeLessThan(systemIdx);
	});

	it("attaches explicit subgroup when declared on a page", () => {
		const items = getAdminNavItems();
		const settingsItem = items.find((i) => i.href === "/admin/settings");
		expect(settingsItem?.subgroup).toBe("CustomSub");
	});

	it("omits icon when page has no icon", () => {
		const items = getAdminNavItems();
		const analyticsItem = items.find((i) => i.href === "/admin/analytics");
		expect(analyticsItem).toBeDefined();
		expect(analyticsItem?.icon).toBeUndefined();
	});

	it("includes ungrouped items without a group property", () => {
		const items = getAdminNavItems();
		const ungrouped = items.find((i) => i.href === "/admin/ungrouped");
		expect(ungrouped).toBeDefined();
		expect(ungrouped?.group).toBeUndefined();
	});
});

// ── getAdminNavGroups ───────────────────────────────────────────────

describe("getAdminNavGroups", () => {
	it("returns groups ordered by GROUP_CONFIG order (Catalog → Sales → System)", () => {
		const groups = getAdminNavGroups();
		const labels = groups.filter((g) => g.label).map((g) => g.label);
		const catalogIdx = labels.indexOf("Catalog");
		const salesIdx = labels.indexOf("Sales");
		const systemIdx = labels.indexOf("System");
		expect(catalogIdx).toBeLessThan(salesIdx);
		expect(salesIdx).toBeLessThan(systemIdx);
	});

	it("assigns the correct icon from GROUP_ICONS", () => {
		const groups = getAdminNavGroups();
		const catalogGroup = groups.find((g) => g.label === "Catalog");
		expect(catalogGroup?.icon).toBe(GROUP_ICONS.Catalog);
		const salesGroup = groups.find((g) => g.label === "Sales");
		expect(salesGroup?.icon).toBe(GROUP_ICONS.Sales);
	});

	it("auto-assigns items to subgroups by path segment", () => {
		const groups = getAdminNavGroups();
		const salesGroup = groups.find((g) => g.label === "Sales");
		expect(salesGroup).toBeDefined();
		// /admin/orders → "orders" segment → "Orders" subgroup in Sales
		const ordersSubgroup = salesGroup?.subgroups.find(
			(sg) => sg.label === "Orders",
		);
		expect(ordersSubgroup).toBeDefined();
		const orderItem = ordersSubgroup?.items.find(
			(i) => i.href === "/admin/orders",
		);
		expect(orderItem).toBeDefined();
	});

	it("places items with explicit subgroup into that subgroup", () => {
		const groups = getAdminNavGroups();
		const systemGroup = groups.find((g) => g.label === "System");
		const customSubgroup = systemGroup?.subgroups.find(
			(sg) => sg.label === "CustomSub",
		);
		expect(customSubgroup).toBeDefined();
		expect(
			customSubgroup?.items.find((i) => i.href === "/admin/settings"),
		).toBeDefined();
	});

	it("sorts items alphabetically within a subgroup", () => {
		const groups = getAdminNavGroups();
		const salesGroup = groups.find((g) => g.label === "Sales");
		const ordersSubgroup = salesGroup?.subgroups.find(
			(sg) => sg.label === "Orders",
		);
		const labels = ordersSubgroup?.items.map((i) => i.label) ?? [];
		const sorted = [...labels].sort((a, b) => a.localeCompare(b));
		expect(labels).toEqual(sorted);
	});

	it("excludes pages without labels from nav groups", () => {
		const groups = getAdminNavGroups();
		const allItems = groups.flatMap((g) => [
			...g.items,
			...g.subgroups.flatMap((sg) => sg.items),
		]);
		const noLabel = allItems.find((i) => i.href === "/admin/products/:id");
		expect(noLabel).toBeUndefined();
	});

	it("places items with no group in the ungrouped slot", () => {
		const groups = getAdminNavGroups();
		const ungroupedGroup = groups.find((g) => g.label === "");
		expect(ungroupedGroup).toBeDefined();
		expect(
			ungroupedGroup?.items.find((i) => i.href === "/admin/ungrouped"),
		).toBeDefined();
	});
});

// ── GROUP_ICONS ─────────────────────────────────────────────────────

describe("GROUP_ICONS", () => {
	it("has icons for all standard groups", () => {
		const expected = [
			"Catalog",
			"Sales",
			"Customers",
			"Fulfillment",
			"Marketing",
			"Content",
			"Finance",
			"Support",
			"System",
		];
		for (const group of expected) {
			expect(GROUP_ICONS[group]).toBeDefined();
			expect(typeof GROUP_ICONS[group]).toBe("string");
		}
	});
});
