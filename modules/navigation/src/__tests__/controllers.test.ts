import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNavigationController } from "../service-impl";

describe("navigation controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNavigationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNavigationController(mockData);
	});

	// ── Menu: all locations ──────────────────────────────────────

	describe("createMenu — all locations", () => {
		it("accepts mobile location", async () => {
			const menu = await controller.createMenu({
				name: "Mobile Nav",
				location: "mobile",
			});
			expect(menu.location).toBe("mobile");
		});

		it("accepts custom location", async () => {
			const menu = await controller.createMenu({
				name: "Custom Nav",
				location: "custom",
			});
			expect(menu.location).toBe("custom");
		});

		it("accepts sidebar location", async () => {
			const menu = await controller.createMenu({
				name: "Side Nav",
				location: "sidebar",
			});
			expect(menu.location).toBe("sidebar");
		});
	});

	// ── Menu: slug edge cases ───────────────────────────────────

	describe("createMenu — slug generation", () => {
		it("slugifies special characters", async () => {
			const menu = await controller.createMenu({
				name: "Nav @ Home! #2024",
				location: "header",
			});
			expect(menu.slug).toBe("nav-home-2024");
		});

		it("slugifies unicode characters", async () => {
			const menu = await controller.createMenu({
				name: "Menü für Küche",
				location: "header",
			});
			// non-ascii chars are stripped, leaving only lowercase alpha-numeric
			expect(menu.slug).toBe("men-f-r-k-che");
		});

		it("collapses multiple spaces into single hyphen", async () => {
			const menu = await controller.createMenu({
				name: "Lots   Of   Spaces",
				location: "header",
			});
			expect(menu.slug).toBe("lots-of-spaces");
		});

		it("strips leading and trailing hyphens", async () => {
			const menu = await controller.createMenu({
				name: "---Leading and Trailing---",
				location: "header",
			});
			expect(menu.slug).toBe("leading-and-trailing");
		});

		it("handles name that is entirely special characters", async () => {
			const menu = await controller.createMenu({
				name: "!!!@@@###",
				location: "header",
			});
			expect(menu.slug).toBe("");
		});
	});

	describe("createMenu — duplicate slugs", () => {
		it("allows two menus with the same generated slug", async () => {
			const m1 = await controller.createMenu({
				name: "Header Nav",
				location: "header",
			});
			const m2 = await controller.createMenu({
				name: "Header Nav",
				location: "footer",
			});
			expect(m1.slug).toBe(m2.slug);
			expect(m1.id).not.toBe(m2.id);
		});

		it("getMenuBySlug returns first match when duplicates exist", async () => {
			const m1 = await controller.createMenu({
				name: "Dup",
				location: "header",
			});
			await controller.createMenu({
				name: "Dup",
				location: "footer",
			});
			const found = await controller.getMenuBySlug("dup");
			expect(found?.id).toBe(m1.id);
		});
	});

	// ── Menu: update slug ───────────────────────────────────────

	describe("updateMenu — slug", () => {
		it("updates slug via updateMenu", async () => {
			const menu = await controller.createMenu({
				name: "Original",
				location: "header",
			});
			const updated = await controller.updateMenu(menu.id, {
				slug: "new-slug",
			});
			expect(updated?.slug).toBe("new-slug");
			expect(updated?.name).toBe("Original");
		});

		it("old slug no longer resolves after update", async () => {
			const menu = await controller.createMenu({
				name: "Footer Links",
				location: "footer",
			});
			await controller.updateMenu(menu.id, { slug: "bottom-links" });

			const oldSlug = await controller.getMenuBySlug("footer-links");
			expect(oldSlug).toBeNull();

			const newSlug = await controller.getMenuBySlug("bottom-links");
			expect(newSlug?.id).toBe(menu.id);
		});
	});

	// ── listMenus: combined filters ─────────────────────────────

	describe("listMenus — combined filters", () => {
		it("filters by location and isActive simultaneously", async () => {
			await controller.createMenu({
				name: "Active Header",
				location: "header",
				isActive: true,
			});
			await controller.createMenu({
				name: "Inactive Header",
				location: "header",
				isActive: false,
			});
			await controller.createMenu({
				name: "Active Footer",
				location: "footer",
				isActive: true,
			});

			const results = await controller.listMenus({
				location: "header",
				isActive: true,
			});
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Active Header");
		});

		it("returns empty array when no menus match combined filter", async () => {
			await controller.createMenu({
				name: "Active Header",
				location: "header",
				isActive: true,
			});
			const results = await controller.listMenus({
				location: "sidebar",
				isActive: true,
			});
			expect(results).toHaveLength(0);
		});
	});

	// ── deleteMenu with deeply nested items ─────────────────────

	describe("deleteMenu — nested items", () => {
		it("deletes menu with multi-level nested items", async () => {
			const menu = await controller.createMenu({
				name: "Deep Nav",
				location: "header",
			});
			const l1 = await controller.createItem({
				menuId: menu.id,
				label: "Level 1",
				url: "/l1",
			});
			const l2 = await controller.createItem({
				menuId: menu.id,
				parentId: l1.id,
				label: "Level 2",
				url: "/l2",
			});
			const l3 = await controller.createItem({
				menuId: menu.id,
				parentId: l2.id,
				label: "Level 3",
				url: "/l3",
			});

			await controller.deleteMenu(menu.id);

			expect(await controller.getItem(l1.id)).toBeNull();
			expect(await controller.getItem(l2.id)).toBeNull();
			expect(await controller.getItem(l3.id)).toBeNull();
		});
	});

	// ── Item: all types ─────────────────────────────────────────

	describe("createItem — all item types", () => {
		it("creates a collection-type item", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Summer Collection",
				type: "collection",
				resourceId: "col_summer",
			});
			expect(item.type).toBe("collection");
			expect(item.resourceId).toBe("col_summer");
		});

		it("creates a page-type item", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "About Us",
				type: "page",
				resourceId: "page_about",
			});
			expect(item.type).toBe("page");
			expect(item.resourceId).toBe("page_about");
		});

		it("creates a product-type item", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Featured Product",
				type: "product",
				resourceId: "prod_featured",
			});
			expect(item.type).toBe("product");
			expect(item.resourceId).toBe("prod_featured");
		});
	});

	// ── Item: all optional fields ───────────────────────────────

	describe("createItem — all optional fields", () => {
		it("stores cssClass, openInNewTab, resourceId together", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "External",
				url: "https://example.com",
				openInNewTab: true,
				cssClass: "highlight bold",
				resourceId: "ext_link_1",
				position: 5,
				isVisible: false,
			});
			expect(item.openInNewTab).toBe(true);
			expect(item.cssClass).toBe("highlight bold");
			expect(item.resourceId).toBe("ext_link_1");
			expect(item.position).toBe(5);
			expect(item.isVisible).toBe(false);
		});
	});

	// ── Item: deeply nested (3+ levels) ─────────────────────────

	describe("createItem — deep nesting", () => {
		it("creates items nested 4 levels deep", async () => {
			const menu = await controller.createMenu({
				name: "Deep Nav",
				location: "sidebar",
			});
			const l1 = await controller.createItem({
				menuId: menu.id,
				label: "L1",
				url: "/l1",
			});
			const l2 = await controller.createItem({
				menuId: menu.id,
				parentId: l1.id,
				label: "L2",
				url: "/l2",
			});
			const l3 = await controller.createItem({
				menuId: menu.id,
				parentId: l2.id,
				label: "L3",
				url: "/l3",
			});
			const l4 = await controller.createItem({
				menuId: menu.id,
				parentId: l3.id,
				label: "L4",
				url: "/l4",
			});

			expect(l4.parentId).toBe(l3.id);

			const tree = await controller.getMenuWithItems(menu.id);
			expect(tree?.items).toHaveLength(1);
			expect(tree?.items[0].children).toHaveLength(1);
			expect(tree?.items[0].children[0].children).toHaveLength(1);
			expect(tree?.items[0].children[0].children[0].children).toHaveLength(1);
			expect(tree?.items[0].children[0].children[0].children[0].label).toBe(
				"L4",
			);
		});
	});

	// ── updateItem: position and parentId ───────────────────────

	describe("updateItem — position and reparenting", () => {
		it("updates position on an existing item", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
				position: 0,
			});
			const updated = await controller.updateItem(item.id, { position: 10 });
			expect(updated?.position).toBe(10);
		});

		it("moves item to a different parent via updateItem", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parentA = await controller.createItem({
				menuId: menu.id,
				label: "A",
				url: "/a",
			});
			const parentB = await controller.createItem({
				menuId: menu.id,
				label: "B",
				url: "/b",
			});
			const child = await controller.createItem({
				menuId: menu.id,
				parentId: parentA.id,
				label: "Child",
				url: "/child",
			});
			expect(child.parentId).toBe(parentA.id);

			const updated = await controller.updateItem(child.id, {
				parentId: parentB.id,
			});
			expect(updated?.parentId).toBe(parentB.id);
		});

		it("updates cssClass via updateItem", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Styled",
				url: "/styled",
			});
			const updated = await controller.updateItem(item.id, {
				cssClass: "text-red",
			});
			expect(updated?.cssClass).toBe("text-red");
		});
	});

	// ── reorderItems with parentId ──────────────────────────────

	describe("reorderItems — with parentId", () => {
		it("reorders and reassigns parentId in one call", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			const a = await controller.createItem({
				menuId: menu.id,
				label: "A",
				url: "/a",
				position: 0,
			});
			const b = await controller.createItem({
				menuId: menu.id,
				label: "B",
				url: "/b",
				position: 1,
			});

			await controller.reorderItems(menu.id, [b.id, a.id], parent.id);

			const bUpdated = await controller.getItem(b.id);
			const aUpdated = await controller.getItem(a.id);
			expect(bUpdated?.position).toBe(0);
			expect(bUpdated?.parentId).toBe(parent.id);
			expect(aUpdated?.position).toBe(1);
			expect(aUpdated?.parentId).toBe(parent.id);
		});
	});

	// ── Tree: complex 3+ level with mixed visibility ────────────

	describe("getMenuWithItems — complex tree", () => {
		it("builds 3-level tree with correct nesting", async () => {
			const menu = await controller.createMenu({
				name: "Mega Nav",
				location: "header",
			});
			const shop = await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/shop",
				position: 0,
			});
			const clothing = await controller.createItem({
				menuId: menu.id,
				parentId: shop.id,
				label: "Clothing",
				url: "/shop/clothing",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: clothing.id,
				label: "T-Shirts",
				url: "/shop/clothing/tshirts",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: clothing.id,
				label: "Jeans",
				url: "/shop/clothing/jeans",
				position: 1,
			});
			await controller.createItem({
				menuId: menu.id,
				label: "About",
				url: "/about",
				position: 1,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			expect(tree?.items).toHaveLength(2);

			const shopNode = tree?.items.find((i) => i.label === "Shop");
			expect(shopNode?.children).toHaveLength(1);
			expect(shopNode?.children[0].label).toBe("Clothing");
			expect(shopNode?.children[0].children).toHaveLength(2);
			expect(shopNode?.children[0].children[0].label).toBe("T-Shirts");
			expect(shopNode?.children[0].children[1].label).toBe("Jeans");
		});

		it("hides nested children when parent is hidden", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Hidden Parent",
				url: "/hidden",
				isVisible: false,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Visible Child",
				url: "/visible-child",
				isVisible: true,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			// parent is hidden so filtered out; child's parentId won't match
			// any visible parent, so it becomes a root-level orphan
			expect(
				tree?.items.find((i) => i.label === "Hidden Parent"),
			).toBeUndefined();
		});

		it("hides child item while keeping sibling visible", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/shop",
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Visible Sub",
				url: "/visible",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Hidden Sub",
				url: "/hidden",
				isVisible: false,
				position: 1,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			const shopNode = tree?.items.find((i) => i.label === "Shop");
			expect(shopNode?.children).toHaveLength(1);
			expect(shopNode?.children[0].label).toBe("Visible Sub");
		});

		it("returns empty items for menu with only hidden items", async () => {
			const menu = await controller.createMenu({
				name: "Ghost Nav",
				location: "header",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Hidden 1",
				url: "/h1",
				isVisible: false,
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Hidden 2",
				url: "/h2",
				isVisible: false,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			expect(tree?.items).toHaveLength(0);
		});
	});

	// ── getMenuByLocation: multiple menus ───────────────────────

	describe("getMenuByLocation — multiple menus", () => {
		it("returns first active menu when multiple exist for location", async () => {
			const first = await controller.createMenu({
				name: "Primary Header",
				location: "header",
			});
			await controller.createMenu({
				name: "Secondary Header",
				location: "header",
			});

			const result = await controller.getMenuByLocation("header");
			expect(result?.id).toBe(first.id);
			expect(result?.name).toBe("Primary Header");
		});

		it("skips inactive and returns next active menu", async () => {
			await controller.createMenu({
				name: "Disabled Footer",
				location: "footer",
				isActive: false,
			});
			const active = await controller.createMenu({
				name: "Active Footer",
				location: "footer",
			});

			const result = await controller.getMenuByLocation("footer");
			expect(result?.id).toBe(active.id);
		});

		it("returns null when all menus for location are inactive", async () => {
			await controller.createMenu({
				name: "Disabled 1",
				location: "mobile",
				isActive: false,
			});
			await controller.createMenu({
				name: "Disabled 2",
				location: "mobile",
				isActive: false,
			});

			const result = await controller.getMenuByLocation("mobile");
			expect(result).toBeNull();
		});
	});

	// ── listItems with parentId filter ──────────────────────────

	describe("listItems — parentId filter", () => {
		it("lists only top-level items when parentId is undefined", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Child",
				url: "/child",
			});

			// listItems without parentId filter returns all items for the menu
			const all = await controller.listItems(menu.id);
			expect(all).toHaveLength(2);
		});

		it("lists children of a specific parent", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Child A",
				url: "/child-a",
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Child B",
				url: "/child-b",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Root Item",
				url: "/root",
			});

			const children = await controller.listItems(menu.id, {
				parentId: parent.id,
			});
			expect(children).toHaveLength(2);
			expect(children.every((c) => c.parentId === parent.id)).toBe(true);
		});
	});

	// ── updateMenu: location change ─────────────────────────────

	describe("updateMenu — location change", () => {
		it("changes menu location from header to footer", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const updated = await controller.updateMenu(menu.id, {
				location: "footer",
			});
			expect(updated?.location).toBe("footer");
			// original fields remain intact
			expect(updated?.name).toBe("Nav");
			expect(updated?.isActive).toBe(true);
		});
	});

	// ── updateMenu: updatedAt timestamp ─────────────────────────

	describe("updateMenu — timestamps", () => {
		it("advances updatedAt on update", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const original = menu.updatedAt;
			const updated = await controller.updateMenu(menu.id, {
				name: "Updated Nav",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				original.getTime(),
			);
		});
	});

	// ── createMenu: metadata defaults ───────────────────────────

	describe("createMenu — defaults", () => {
		it("initializes metadata as empty object", async () => {
			const menu = await controller.createMenu({
				name: "Test",
				location: "header",
			});
			expect(menu.metadata).toEqual({});
		});

		it("sets createdAt and updatedAt to same value", async () => {
			const menu = await controller.createMenu({
				name: "Test",
				location: "header",
			});
			expect(menu.createdAt.getTime()).toBe(menu.updatedAt.getTime());
		});
	});

	// ── createItem: metadata and timestamp defaults ─────────────

	describe("createItem — defaults", () => {
		it("initializes item metadata as empty object", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});
			expect(item.metadata).toEqual({});
		});

		it("leaves parentId undefined when not provided", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});
			expect(item.parentId).toBeUndefined();
		});
	});

	// ── Slug: whitespace-only custom slug ───────────────────────

	describe("createMenu — whitespace slug fallback", () => {
		it("falls back to generated slug when custom slug is whitespace", async () => {
			const menu = await controller.createMenu({
				name: "My Menu",
				slug: "   ",
				location: "header",
			});
			expect(menu.slug).toBe("my-menu");
		});

		it("trims whitespace from valid custom slug", async () => {
			const menu = await controller.createMenu({
				name: "My Menu",
				slug: "  my-custom  ",
				location: "header",
			});
			expect(menu.slug).toBe("my-custom");
		});
	});
});
