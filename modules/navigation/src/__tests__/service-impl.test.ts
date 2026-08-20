import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNavigationController } from "../service-impl";

describe("createNavigationController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNavigationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNavigationController(mockData);
	});

	// ── Menu CRUD ────────────────────────────────────────────────

	describe("createMenu", () => {
		it("creates a menu with default slug", async () => {
			const menu = await controller.createMenu({
				name: "Main Navigation",
				location: "header",
			});
			expect(menu.id).toBeDefined();
			expect(menu.name).toBe("Main Navigation");
			expect(menu.slug).toBe("main-navigation");
			expect(menu.location).toBe("header");
			expect(menu.isActive).toBe(true);
		});

		it("uses custom slug when provided", async () => {
			const menu = await controller.createMenu({
				name: "Main Nav",
				slug: "primary-nav",
				location: "header",
			});
			expect(menu.slug).toBe("primary-nav");
		});

		it("respects isActive option", async () => {
			const menu = await controller.createMenu({
				name: "Draft",
				location: "footer",
				isActive: false,
			});
			expect(menu.isActive).toBe(false);
		});
	});

	describe("updateMenu", () => {
		it("updates menu fields", async () => {
			const menu = await controller.createMenu({
				name: "Header",
				location: "header",
			});
			const updated = await controller.updateMenu(menu.id, {
				name: "Primary Header",
				location: "header",
			});
			expect(updated?.name).toBe("Primary Header");
		});

		it("returns null for non-existent menu", async () => {
			const result = await controller.updateMenu("missing", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates only provided fields", async () => {
			const menu = await controller.createMenu({
				name: "Footer",
				location: "footer",
			});
			const updated = await controller.updateMenu(menu.id, {
				isActive: false,
			});
			expect(updated?.name).toBe("Footer");
			expect(updated?.location).toBe("footer");
			expect(updated?.isActive).toBe(false);
		});
	});

	describe("deleteMenu", () => {
		it("deletes an existing menu", async () => {
			const menu = await controller.createMenu({
				name: "Temp",
				location: "sidebar",
			});
			const deleted = await controller.deleteMenu(menu.id);
			expect(deleted).toBe(true);

			const found = await controller.getMenu(menu.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent menu", async () => {
			const deleted = await controller.deleteMenu("missing");
			expect(deleted).toBe(false);
		});

		it("deletes child items when menu is deleted", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});

			await controller.deleteMenu(menu.id);

			const found = await controller.getItem(item.id);
			expect(found).toBeNull();
		});
	});

	describe("getMenu", () => {
		it("returns null for non-existent ID", async () => {
			const menu = await controller.getMenu("unknown");
			expect(menu).toBeNull();
		});

		it("returns existing menu", async () => {
			const created = await controller.createMenu({
				name: "Test",
				location: "header",
			});
			const found = await controller.getMenu(created.id);
			expect(found?.name).toBe("Test");
		});
	});

	describe("getMenuBySlug", () => {
		it("returns menu by slug", async () => {
			await controller.createMenu({
				name: "Footer Nav",
				location: "footer",
			});
			const found = await controller.getMenuBySlug("footer-nav");
			expect(found?.name).toBe("Footer Nav");
		});

		it("returns null for unknown slug", async () => {
			const found = await controller.getMenuBySlug("nope");
			expect(found).toBeNull();
		});
	});

	describe("listMenus", () => {
		it("returns all menus", async () => {
			await controller.createMenu({
				name: "Header",
				location: "header",
			});
			await controller.createMenu({
				name: "Footer",
				location: "footer",
			});
			const menus = await controller.listMenus();
			expect(menus).toHaveLength(2);
		});

		it("filters by location", async () => {
			await controller.createMenu({
				name: "Header",
				location: "header",
			});
			await controller.createMenu({
				name: "Footer",
				location: "footer",
			});
			const headerMenus = await controller.listMenus({
				location: "header",
			});
			expect(headerMenus).toHaveLength(1);
			expect(headerMenus[0].name).toBe("Header");
		});

		it("filters by isActive", async () => {
			await controller.createMenu({
				name: "Active",
				location: "header",
			});
			await controller.createMenu({
				name: "Inactive",
				location: "header",
				isActive: false,
			});
			const active = await controller.listMenus({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});
	});

	// ── Menu Item CRUD ───────────────────────────────────────────

	describe("createItem", () => {
		it("creates a menu item with defaults", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});
			expect(item.id).toBeDefined();
			expect(item.menuId).toBe(menu.id);
			expect(item.label).toBe("Home");
			expect(item.type).toBe("link");
			expect(item.url).toBe("/");
			expect(item.openInNewTab).toBe(false);
			expect(item.position).toBe(0);
			expect(item.isVisible).toBe(true);
		});

		it("creates a category-type item with resourceId", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Shoes",
				type: "category",
				resourceId: "cat_shoes",
			});
			expect(item.type).toBe("category");
			expect(item.resourceId).toBe("cat_shoes");
		});

		it("creates nested item with parentId", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/products",
			});
			const child = await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "New Arrivals",
				url: "/products?sort=newest",
			});
			expect(child.parentId).toBe(parent.id);
		});
	});

	describe("updateItem", () => {
		it("updates item fields", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});
			const updated = await controller.updateItem(item.id, {
				label: "Homepage",
				openInNewTab: true,
			});
			expect(updated?.label).toBe("Homepage");
			expect(updated?.openInNewTab).toBe(true);
			expect(updated?.url).toBe("/");
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateItem("missing", {
				label: "Test",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteItem", () => {
		it("deletes an item", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const item = await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});
			const deleted = await controller.deleteItem(item.id);
			expect(deleted).toBe(true);

			const found = await controller.getItem(item.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent item", async () => {
			const deleted = await controller.deleteItem("missing");
			expect(deleted).toBe(false);
		});

		it("deletes child items when parent is deleted", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/products",
			});
			const child = await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Sale",
				url: "/sale",
			});

			await controller.deleteItem(parent.id);

			const found = await controller.getItem(child.id);
			expect(found).toBeNull();
		});
	});

	describe("listItems", () => {
		it("lists items for a menu", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/products",
				position: 1,
			});
			const items = await controller.listItems(menu.id);
			expect(items).toHaveLength(2);
		});

		it("does not return items from other menus", async () => {
			const menu1 = await controller.createMenu({
				name: "Nav1",
				location: "header",
			});
			const menu2 = await controller.createMenu({
				name: "Nav2",
				location: "footer",
			});
			await controller.createItem({
				menuId: menu1.id,
				label: "Home",
				url: "/",
			});
			await controller.createItem({
				menuId: menu2.id,
				label: "About",
				url: "/about",
			});

			const items1 = await controller.listItems(menu1.id);
			expect(items1).toHaveLength(1);
			expect(items1[0].label).toBe("Home");
		});
	});

	// ── Tree resolution ──────────────────────────────────────────

	describe("getMenuWithItems", () => {
		it("returns null for non-existent menu", async () => {
			const result = await controller.getMenuWithItems("missing");
			expect(result).toBeNull();
		});

		it("returns menu with empty items array", async () => {
			const menu = await controller.createMenu({
				name: "Empty",
				location: "header",
			});
			const result = await controller.getMenuWithItems(menu.id);
			expect(result?.name).toBe("Empty");
			expect(result?.items).toHaveLength(0);
		});

		it("builds nested tree structure", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Shop",
				url: "/products",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "New Arrivals",
				url: "/products?sort=newest",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Sale",
				url: "/sale",
				position: 1,
			});
			await controller.createItem({
				menuId: menu.id,
				label: "About",
				url: "/about",
				position: 1,
			});

			const result = await controller.getMenuWithItems(menu.id);
			expect(result?.items).toHaveLength(2);

			const shopItem = result?.items.find((i) => i.label === "Shop");
			expect(shopItem?.children).toHaveLength(2);
			expect(shopItem?.children[0].label).toBe("New Arrivals");
			expect(shopItem?.children[1].label).toBe("Sale");

			const aboutItem = result?.items.find((i) => i.label === "About");
			expect(aboutItem?.children).toHaveLength(0);
		});

		it("excludes hidden items from tree", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Visible",
				url: "/visible",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Hidden",
				url: "/hidden",
				isVisible: false,
			});

			const result = await controller.getMenuWithItems(menu.id);
			expect(result?.items).toHaveLength(1);
			expect(result?.items[0].label).toBe("Visible");
		});
	});

	describe("getMenuByLocation", () => {
		it("returns null when no menu exists for location", async () => {
			const result = await controller.getMenuByLocation("sidebar");
			expect(result).toBeNull();
		});

		it("returns active menu for location with items", async () => {
			const menu = await controller.createMenu({
				name: "Header Nav",
				location: "header",
			});
			await controller.createItem({
				menuId: menu.id,
				label: "Home",
				url: "/",
			});

			const result = await controller.getMenuByLocation("header");
			expect(result?.name).toBe("Header Nav");
			expect(result?.items).toHaveLength(1);
		});

		it("ignores inactive menus", async () => {
			await controller.createMenu({
				name: "Inactive",
				location: "footer",
				isActive: false,
			});

			const result = await controller.getMenuByLocation("footer");
			expect(result).toBeNull();
		});
	});

	describe("reorderItems", () => {
		it("reorders items by position", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
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
			const c = await controller.createItem({
				menuId: menu.id,
				label: "C",
				url: "/c",
				position: 2,
			});

			// Reverse order: C, A, B
			await controller.reorderItems(menu.id, [c.id, a.id, b.id]);

			const cUpdated = await controller.getItem(c.id);
			const aUpdated = await controller.getItem(a.id);
			const bUpdated = await controller.getItem(b.id);

			expect(cUpdated?.position).toBe(0);
			expect(aUpdated?.position).toBe(1);
			expect(bUpdated?.position).toBe(2);
		});

		it("ignores items from other menus", async () => {
			const menu1 = await controller.createMenu({
				name: "M1",
				location: "header",
			});
			const menu2 = await controller.createMenu({
				name: "M2",
				location: "footer",
			});
			const item1 = await controller.createItem({
				menuId: menu1.id,
				label: "Item1",
				url: "/1",
				position: 0,
			});
			const item2 = await controller.createItem({
				menuId: menu2.id,
				label: "Item2",
				url: "/2",
				position: 0,
			});

			// Try to reorder item2 under menu1 — should not update it
			await controller.reorderItems(menu1.id, [item2.id, item1.id]);

			const item2After = await controller.getItem(item2.id);
			expect(item2After?.position).toBe(0); // unchanged
		});
	});
});
