import { describe, expect, it } from "vitest";
import {
	buildAdminNavigation,
	isAdminPathActive,
	parseCollapsedNavigation,
} from "../admin-navigation";
import type { AdminNavGroup } from "../admin-registry";

const groups: AdminNavGroup[] = [
	{
		label: "Catalog",
		icon: "Package",
		items: [{ label: "Inventory", href: "/admin/inventory" }],
		subgroups: [
			{
				label: "Products",
				icon: "Package",
				items: [
					{ label: "Products", href: "/admin/products" },
					{ label: "Collections", href: "/admin/collections" },
				],
			},
		],
	},
];

describe("admin navigation", () => {
	it("matches routes at a segment boundary and keeps overview exact", () => {
		expect(isAdminPathActive("/admin/products", "/admin/products/one")).toBe(
			true,
		);
		expect(isAdminPathActive("/admin/products", "/admin/products/")).toBe(true);
		expect(
			isAdminPathActive("/admin/products", "/admin/products-reviews"),
		).toBe(false);
		expect(isAdminPathActive("/admin", "/admin/products")).toBe(false);
	});

	it("restores valid preferences and discards malformed storage", () => {
		expect([
			...parseCollapsedNavigation('["Catalog","Catalog:Products",42,null]'),
		]).toEqual(["Catalog", "Catalog:Products"]);
		for (const raw of [null, "nope", "{}", '"Catalog"']) {
			expect(parseCollapsedNavigation(raw).size).toBe(0);
		}
	});

	it("opens active parents without changing persisted preferences", () => {
		const collapsed = new Set(["Catalog", "Catalog:Products"]);
		const active = buildAdminNavigation(
			groups,
			"/admin/products/one",
			collapsed,
		);
		expect(active.sections[0]?.isOpen).toBe(true);
		expect(active.sections[0]?.sections[0]?.isOpen).toBe(true);
		expect([...collapsed]).toEqual(["Catalog", "Catalog:Products"]);
		const inactive = buildAdminNavigation(groups, "/admin", collapsed);
		expect(inactive.sections[0]?.isOpen).toBe(false);
	});

	it("marks only the longest matching destination current", () => {
		const navigation = buildAdminNavigation(
			[
				{
					label: "Catalog",
					icon: "Package",
					items: [
						{ label: "Catalog", href: "/admin/products" },
						{ label: "Archived", href: "/admin/products/archived" },
					],
					subgroups: [],
				},
			],
			"/admin/products/archived/one",
			new Set(),
		);
		expect(navigation.sections[0]?.items.map((item) => item.isActive)).toEqual([
			false,
			true,
		]);
		expect(navigation.activeItem?.label).toBe("Archived");
	});

	it("searches descendants, opens results, and preserves current page context", () => {
		const navigation = buildAdminNavigation(
			groups,
			"/admin/inventory",
			new Set(["Catalog", "Catalog:Products"]),
			"  collections  ",
		);
		expect(
			navigation.sections[0]?.sections[0]?.items.map((item) => item.label),
		).toEqual(["Collections"]);
		expect(navigation.sections[0]?.isOpen).toBe(true);
		expect(navigation.activeItem?.label).toBe("Inventory");
		expect(
			buildAdminNavigation(groups, "/admin", new Set(), "nothing").sections,
		).toEqual([]);
	});

	it("includes every child when the group name matches", () => {
		const navigation = buildAdminNavigation(
			groups,
			"/admin",
			new Set(),
			"catalog",
		);
		expect(navigation.sections[0]?.items).toHaveLength(1);
		expect(navigation.sections[0]?.sections[0]?.items).toHaveLength(2);
	});
});
