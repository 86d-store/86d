import { describe, expect, it, vi } from "vitest";
import { createItemEndpoint } from "../admin/endpoints/create-item";
import { createMenuEndpoint } from "../admin/endpoints/create-menu";
import { deleteItemEndpoint } from "../admin/endpoints/delete-item";
import { deleteMenuEndpoint } from "../admin/endpoints/delete-menu";
import { adminGetMenuEndpoint } from "../admin/endpoints/get-menu";
import { adminListMenusEndpoint } from "../admin/endpoints/list-menus";
import { reorderItemsEndpoint } from "../admin/endpoints/reorder-items";
import { updateItemEndpoint } from "../admin/endpoints/update-item";
import { updateMenuEndpoint } from "../admin/endpoints/update-menu";
import type {
	Menu,
	MenuItem,
	MenuItemType,
	MenuLocation,
	MenuWithItems,
	NavigationController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeMenu(overrides: Partial<Menu> = {}): Menu {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Main Menu",
		slug: "main-menu",
		location: "header" as MenuLocation,
		isActive: true,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		menuId: "menu_1",
		label: "Home",
		type: "link" as MenuItemType,
		openInNewTab: false,
		position: 0,
		isVisible: true,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMenuWithItems(
	overrides: Partial<MenuWithItems> = {},
): MenuWithItems {
	return {
		...makeMenu(),
		items: [],
		...overrides,
	};
}

function makeController(
	overrides: Partial<NavigationController> = {},
): NavigationController {
	return {
		createMenu: vi.fn().mockResolvedValue(makeMenu()),
		updateMenu: vi.fn().mockResolvedValue(null),
		deleteMenu: vi.fn().mockResolvedValue(false),
		getMenu: vi.fn().mockResolvedValue(null),
		getMenuBySlug: vi.fn().mockResolvedValue(null),
		listMenus: vi.fn().mockResolvedValue([]),
		createItem: vi.fn().mockResolvedValue(makeMenuItem()),
		updateItem: vi.fn().mockResolvedValue(null),
		deleteItem: vi.fn().mockResolvedValue(false),
		getItem: vi.fn().mockResolvedValue(null),
		listItems: vi.fn().mockResolvedValue([]),
		getMenuWithItems: vi.fn().mockResolvedValue(null),
		getMenuByLocation: vi.fn().mockResolvedValue(null),
		reorderItems: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: NavigationController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { navigation: opts.controller ?? makeController() },
		},
	});
}

const listMenusHandler = extractHandler(adminListMenusEndpoint);
const createMenuHandler = extractHandler(createMenuEndpoint);
const getMenuHandler = extractHandler(adminGetMenuEndpoint);
const updateMenuHandler = extractHandler(updateMenuEndpoint);
const deleteMenuHandler = extractHandler(deleteMenuEndpoint);
const reorderItemsHandler = extractHandler(reorderItemsEndpoint);
const createItemHandler = extractHandler(createItemEndpoint);
const updateItemHandler = extractHandler(updateItemEndpoint);
const deleteItemHandler = extractHandler(deleteItemEndpoint);

describe("admin GET /navigation/menus", () => {
	it("returns empty list", async () => {
		const result = (await call(listMenusHandler)) as { menus: Menu[] };
		expect(result.menus).toHaveLength(0);
	});

	it("forwards location filter", async () => {
		const ctrl = makeController();
		await call(listMenusHandler, {
			query: { location: "footer" },
			controller: ctrl,
		});
		expect(ctrl.listMenus).toHaveBeenCalledWith(
			expect.objectContaining({ location: "footer" }),
		);
	});

	it("returns menus", async () => {
		const menu = makeMenu({ id: "menu_1", name: "Main Menu" });
		const ctrl = makeController({
			listMenus: vi.fn().mockResolvedValue([menu]),
		});
		const result = (await call(listMenusHandler, {
			controller: ctrl,
		})) as { menus: Menu[] };
		expect(result.menus).toHaveLength(1);
		expect(result.menus[0].name).toBe("Main Menu");
	});
});

describe("admin POST /navigation/menus/create", () => {
	it("creates and returns a menu", async () => {
		const menu = makeMenu({ name: "Footer Nav", location: "footer" });
		const ctrl = makeController({
			createMenu: vi.fn().mockResolvedValue(menu),
		});
		const result = (await call(createMenuHandler, {
			body: { name: "Footer Nav", location: "footer" },
			controller: ctrl,
		})) as { menu: Menu };
		expect(result.menu.name).toBe("Footer Nav");
		expect(result.menu.location).toBe("footer");
	});
});

describe("admin GET /navigation/menus/:id", () => {
	it("returns null menu when not found", async () => {
		const result = (await call(getMenuHandler, {
			params: { id: "missing" },
		})) as { menu: MenuWithItems | null };
		expect(result.menu).toBeNull();
	});

	it("calls getMenuWithItems", async () => {
		const menuWithItems = makeMenuWithItems({ id: "menu_1" });
		const ctrl = makeController({
			getMenuWithItems: vi.fn().mockResolvedValue(menuWithItems),
		});
		const result = (await call(getMenuHandler, {
			params: { id: "menu_1" },
			controller: ctrl,
		})) as { menu: MenuWithItems };
		expect(result.menu.id).toBe("menu_1");
		expect(ctrl.getMenuWithItems).toHaveBeenCalledWith("menu_1");
	});
});

describe("admin POST /navigation/menus/:id/update", () => {
	it("returns null menu when not found", async () => {
		const result = (await call(updateMenuHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { menu: Menu | null };
		expect(result.menu).toBeNull();
	});

	it("updates and returns the menu", async () => {
		const menu = makeMenu({ id: "menu_1", name: "Updated Name" });
		const ctrl = makeController({
			updateMenu: vi.fn().mockResolvedValue(menu),
		});
		const result = (await call(updateMenuHandler, {
			params: { id: "menu_1" },
			body: { name: "Updated Name" },
			controller: ctrl,
		})) as { menu: Menu };
		expect(result.menu.name).toBe("Updated Name");
	});
});

describe("admin POST /navigation/menus/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteMenuHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes menu and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteMenu: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteMenuHandler, {
			params: { id: "menu_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

describe("admin POST /navigation/menus/:menuId/reorder", () => {
	it("reorders items and returns reordered=true", async () => {
		const ctrl = makeController({
			reorderItems: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(reorderItemsHandler, {
			params: { menuId: "menu_1" },
			body: { itemIds: ["item_2", "item_1"] },
			controller: ctrl,
		})) as { reordered: boolean };
		expect(result.reordered).toBe(true);
		expect(ctrl.reorderItems).toHaveBeenCalledWith(
			"menu_1",
			["item_2", "item_1"],
			undefined,
		);
	});
});

describe("admin POST /navigation/items/create", () => {
	it("creates and returns a menu item", async () => {
		const item = makeMenuItem({ menuId: "menu_1", label: "About" });
		const ctrl = makeController({
			createItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(createItemHandler, {
			body: { menuId: "menu_1", label: "About", type: "link" },
			controller: ctrl,
		})) as { item: MenuItem };
		expect(result.item.label).toBe("About");
		expect(result.item.menuId).toBe("menu_1");
	});
});

describe("admin POST /navigation/items/:id/update", () => {
	it("returns null item when not found", async () => {
		const result = (await call(updateItemHandler, {
			params: { id: "missing" },
			body: { label: "New Label" },
		})) as { item: MenuItem | null };
		expect(result.item).toBeNull();
	});

	it("updates and returns the item", async () => {
		const item = makeMenuItem({ id: "item_1", label: "Updated Label" });
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(updateItemHandler, {
			params: { id: "item_1" },
			body: { label: "Updated Label" },
			controller: ctrl,
		})) as { item: MenuItem };
		expect(result.item.label).toBe("Updated Label");
	});
});

describe("admin POST /navigation/items/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteItemHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes item and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});
