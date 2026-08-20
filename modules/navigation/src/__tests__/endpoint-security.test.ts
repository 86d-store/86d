import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNavigationController } from "../service-impl";

/**
 * Security and isolation tests for navigation endpoints.
 *
 * These verify:
 * - Menu items are isolated to their owning menu
 * - Reorder operations cannot move items across menu boundaries
 * - Location-based queries only return active menus for the requested location
 * - Slug uniqueness and lookup correctness
 * - Tree resolution excludes hidden items and respects nesting
 * - Cascade deletes remove all child items without leaking across menus
 * - Ordering integrity is preserved after reorder operations
 */

describe("navigation endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNavigationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNavigationController(mockData);
	});

	describe("menu isolation", () => {
		it("items from one menu do not appear in another menu's listItems", async () => {
			const header = await controller.createMenu({
				name: "Header",
				location: "header",
			});
			const footer = await controller.createMenu({
				name: "Footer",
				location: "footer",
			});

			await controller.createItem({
				menuId: header.id,
				label: "Home",
				url: "/",
			});
			await controller.createItem({
				menuId: header.id,
				label: "Shop",
				url: "/shop",
			});
			await controller.createItem({
				menuId: footer.id,
				label: "Privacy",
				url: "/privacy",
			});

			const headerItems = await controller.listItems(header.id);
			const footerItems = await controller.listItems(footer.id);

			expect(headerItems).toHaveLength(2);
			expect(footerItems).toHaveLength(1);
			expect(headerItems.every((i) => i.menuId === header.id)).toBe(true);
			expect(footerItems.every((i) => i.menuId === footer.id)).toBe(true);
		});

		it("getMenuWithItems only includes items belonging to that menu", async () => {
			const menuA = await controller.createMenu({
				name: "Menu A",
				location: "header",
			});
			const menuB = await controller.createMenu({
				name: "Menu B",
				location: "footer",
			});

			await controller.createItem({
				menuId: menuA.id,
				label: "A1",
				url: "/a1",
			});
			await controller.createItem({
				menuId: menuB.id,
				label: "B1",
				url: "/b1",
			});
			await controller.createItem({
				menuId: menuB.id,
				label: "B2",
				url: "/b2",
			});

			const treeA = await controller.getMenuWithItems(menuA.id);
			const treeB = await controller.getMenuWithItems(menuB.id);

			expect(treeA?.items).toHaveLength(1);
			expect(treeA?.items[0].label).toBe("A1");
			expect(treeB?.items).toHaveLength(2);
		});

		it("deleting a menu does not remove items from a different menu", async () => {
			const menuA = await controller.createMenu({
				name: "Menu A",
				location: "header",
			});
			const menuB = await controller.createMenu({
				name: "Menu B",
				location: "footer",
			});

			await controller.createItem({
				menuId: menuA.id,
				label: "A Item",
				url: "/a",
			});
			const bItem = await controller.createItem({
				menuId: menuB.id,
				label: "B Item",
				url: "/b",
			});

			await controller.deleteMenu(menuA.id);

			const found = await controller.getItem(bItem.id);
			expect(found).not.toBeNull();
			expect(found?.label).toBe("B Item");
		});
	});

	describe("reorder cross-menu protection", () => {
		it("reorderItems skips items that belong to a different menu", async () => {
			const menuA = await controller.createMenu({
				name: "Menu A",
				location: "header",
			});
			const menuB = await controller.createMenu({
				name: "Menu B",
				location: "footer",
			});

			const itemA = await controller.createItem({
				menuId: menuA.id,
				label: "A1",
				url: "/a1",
				position: 0,
			});
			const itemB = await controller.createItem({
				menuId: menuB.id,
				label: "B1",
				url: "/b1",
				position: 5,
			});

			await controller.reorderItems(menuA.id, [itemB.id, itemA.id]);

			const itemBAfter = await controller.getItem(itemB.id);
			expect(itemBAfter?.position).toBe(5);
			expect(itemBAfter?.menuId).toBe(menuB.id);

			const itemAAfter = await controller.getItem(itemA.id);
			expect(itemAAfter?.position).toBe(1);
		});

		it("reorderItems ignores non-existent item IDs without crashing", async () => {
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

			await controller.reorderItems(menu.id, ["nonexistent-id", item.id]);

			const updated = await controller.getItem(item.id);
			expect(updated?.position).toBe(1);
		});
	});

	describe("ordering integrity", () => {
		it("reorderItems assigns sequential positions starting from 0", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const a = await controller.createItem({
				menuId: menu.id,
				label: "A",
				url: "/a",
				position: 10,
			});
			const b = await controller.createItem({
				menuId: menu.id,
				label: "B",
				url: "/b",
				position: 20,
			});
			const c = await controller.createItem({
				menuId: menu.id,
				label: "C",
				url: "/c",
				position: 30,
			});

			await controller.reorderItems(menu.id, [c.id, a.id, b.id]);

			const cAfter = await controller.getItem(c.id);
			const aAfter = await controller.getItem(a.id);
			const bAfter = await controller.getItem(b.id);

			expect(cAfter?.position).toBe(0);
			expect(aAfter?.position).toBe(1);
			expect(bAfter?.position).toBe(2);
		});

		it("reorderItems with parentId reassigns parent for all specified items", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			const x = await controller.createItem({
				menuId: menu.id,
				label: "X",
				url: "/x",
				position: 0,
			});
			const y = await controller.createItem({
				menuId: menu.id,
				label: "Y",
				url: "/y",
				position: 1,
			});

			await controller.reorderItems(menu.id, [y.id, x.id], parent.id);

			const xAfter = await controller.getItem(x.id);
			const yAfter = await controller.getItem(y.id);

			expect(yAfter?.parentId).toBe(parent.id);
			expect(yAfter?.position).toBe(0);
			expect(xAfter?.parentId).toBe(parent.id);
			expect(xAfter?.position).toBe(1);
		});
	});

	describe("location-based scoping", () => {
		it("getMenuByLocation returns null for a location with no menus", async () => {
			await controller.createMenu({ name: "Header", location: "header" });
			const result = await controller.getMenuByLocation("sidebar");
			expect(result).toBeNull();
		});

		it("getMenuByLocation skips inactive menus at the requested location", async () => {
			await controller.createMenu({
				name: "Disabled Header",
				location: "header",
				isActive: false,
			});
			const active = await controller.createMenu({
				name: "Active Header",
				location: "header",
			});
			await controller.createItem({
				menuId: active.id,
				label: "Home",
				url: "/",
			});

			const result = await controller.getMenuByLocation("header");
			expect(result?.id).toBe(active.id);
			expect(result?.items).toHaveLength(1);
		});

		it("getMenuByLocation does not return menus from other locations", async () => {
			const footer = await controller.createMenu({
				name: "Footer Nav",
				location: "footer",
			});
			await controller.createItem({
				menuId: footer.id,
				label: "Terms",
				url: "/terms",
			});

			const headerResult = await controller.getMenuByLocation("header");
			expect(headerResult).toBeNull();

			const footerResult = await controller.getMenuByLocation("footer");
			expect(footerResult?.id).toBe(footer.id);
		});

		it("listMenus filters correctly by location", async () => {
			await controller.createMenu({ name: "H1", location: "header" });
			await controller.createMenu({ name: "H2", location: "header" });
			await controller.createMenu({ name: "F1", location: "footer" });
			await controller.createMenu({ name: "S1", location: "sidebar" });

			const headers = await controller.listMenus({ location: "header" });
			expect(headers).toHaveLength(2);
			expect(headers.every((m) => m.location === "header")).toBe(true);

			const sidebars = await controller.listMenus({ location: "sidebar" });
			expect(sidebars).toHaveLength(1);
		});
	});

	describe("slug uniqueness and lookup", () => {
		it("getMenuBySlug returns the first menu when duplicate slugs exist", async () => {
			const first = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			await controller.createMenu({
				name: "Nav",
				location: "footer",
			});

			const found = await controller.getMenuBySlug("nav");
			expect(found?.id).toBe(first.id);
		});

		it("updating a slug makes the old slug unreachable", async () => {
			const menu = await controller.createMenu({
				name: "Main Menu",
				location: "header",
			});

			await controller.updateMenu(menu.id, { slug: "primary-menu" });

			const oldLookup = await controller.getMenuBySlug("main-menu");
			expect(oldLookup).toBeNull();

			const newLookup = await controller.getMenuBySlug("primary-menu");
			expect(newLookup?.id).toBe(menu.id);
		});

		it("getMenuBySlug returns null for a slug that was never created", async () => {
			const result = await controller.getMenuBySlug("ghost-slug");
			expect(result).toBeNull();
		});
	});

	describe("nested item depth and tree integrity", () => {
		it("deeply nested items render correctly in tree output", async () => {
			const menu = await controller.createMenu({
				name: "Deep Nav",
				location: "sidebar",
			});
			const l1 = await controller.createItem({
				menuId: menu.id,
				label: "L1",
				url: "/l1",
				position: 0,
			});
			const l2 = await controller.createItem({
				menuId: menu.id,
				parentId: l1.id,
				label: "L2",
				url: "/l2",
				position: 0,
			});
			const l3 = await controller.createItem({
				menuId: menu.id,
				parentId: l2.id,
				label: "L3",
				url: "/l3",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: l3.id,
				label: "L4",
				url: "/l4",
				position: 0,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			expect(tree?.items).toHaveLength(1);
			const depth1 = tree?.items[0];
			expect(depth1?.label).toBe("L1");
			expect(depth1?.children).toHaveLength(1);
			expect(depth1?.children[0].children).toHaveLength(1);
			expect(depth1?.children[0].children[0].children).toHaveLength(1);
			expect(depth1?.children[0].children[0].children[0].label).toBe("L4");
		});

		it("hidden parent causes its visible children to become orphan roots in tree", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const hidden = await controller.createItem({
				menuId: menu.id,
				label: "Hidden Parent",
				url: "/hidden",
				isVisible: false,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: hidden.id,
				label: "Orphaned Child",
				url: "/orphan",
				isVisible: true,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			const hiddenNode = tree?.items.find((i) => i.label === "Hidden Parent");
			expect(hiddenNode).toBeUndefined();
			const orphan = tree?.items.find((i) => i.label === "Orphaned Child");
			expect(orphan).toBeDefined();
			expect(orphan?.children).toHaveLength(0);
		});

		it("hidden child is excluded while visible siblings remain", async () => {
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
				label: "Visible",
				url: "/visible",
				position: 0,
			});
			await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Secret",
				url: "/secret",
				isVisible: false,
				position: 1,
			});

			const tree = await controller.getMenuWithItems(menu.id);
			const shopNode = tree?.items.find((i) => i.label === "Shop");
			expect(shopNode?.children).toHaveLength(1);
			expect(shopNode?.children[0].label).toBe("Visible");
		});
	});

	describe("cascade delete integrity", () => {
		it("deleteMenu removes all nested items at every depth", async () => {
			const menu = await controller.createMenu({
				name: "Cascade Nav",
				location: "header",
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

			await controller.deleteMenu(menu.id);

			expect(await controller.getItem(l1.id)).toBeNull();
			expect(await controller.getItem(l2.id)).toBeNull();
			expect(await controller.getItem(l3.id)).toBeNull();
			expect(await controller.getMenu(menu.id)).toBeNull();
		});

		it("deleteItem cascades to direct children", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			const child = await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "Child",
				url: "/child",
			});

			await controller.deleteItem(parent.id);

			expect(await controller.getItem(parent.id)).toBeNull();
			expect(await controller.getItem(child.id)).toBeNull();
		});

		it("deleteItem on a leaf does not affect its siblings", async () => {
			const menu = await controller.createMenu({
				name: "Nav",
				location: "header",
			});
			const parent = await controller.createItem({
				menuId: menu.id,
				label: "Parent",
				url: "/parent",
			});
			const siblingA = await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "A",
				url: "/a",
			});
			const siblingB = await controller.createItem({
				menuId: menu.id,
				parentId: parent.id,
				label: "B",
				url: "/b",
			});

			await controller.deleteItem(siblingA.id);

			expect(await controller.getItem(siblingA.id)).toBeNull();
			expect(await controller.getItem(siblingB.id)).not.toBeNull();
			expect(await controller.getItem(parent.id)).not.toBeNull();
		});
	});

	describe("non-existent resource handling", () => {
		it("getMenu returns null for non-existent ID", async () => {
			expect(await controller.getMenu("fake-id")).toBeNull();
		});

		it("updateMenu returns null for non-existent ID", async () => {
			expect(await controller.updateMenu("fake-id", { name: "X" })).toBeNull();
		});

		it("deleteMenu returns false for non-existent ID", async () => {
			expect(await controller.deleteMenu("fake-id")).toBe(false);
		});

		it("updateItem returns null for non-existent ID", async () => {
			expect(await controller.updateItem("fake-id", { label: "X" })).toBeNull();
		});

		it("deleteItem returns false for non-existent ID", async () => {
			expect(await controller.deleteItem("fake-id")).toBe(false);
		});

		it("getMenuWithItems returns null for non-existent menu", async () => {
			expect(await controller.getMenuWithItems("fake-id")).toBeNull();
		});
	});
});
