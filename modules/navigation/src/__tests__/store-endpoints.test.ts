import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNavigationController } from "../service-impl";

/**
 * Store endpoint integration tests for the navigation module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-menus: returns active menus
 * 2. get-menu-by-slug: returns a menu by slug
 * 3. get-menu-with-items: returns menu with hierarchical items
 * 4. get-menu-by-location: returns active menu for a location
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

type MenuLocation = "header" | "footer" | "sidebar" | "mobile" | "custom";

async function simulateListMenus(
	data: DataService,
	query: { location?: MenuLocation } = {},
) {
	const controller = createNavigationController(data);
	const menus = await controller.listMenus({
		isActive: true,
		...query,
	});
	return { menus };
}

async function simulateGetMenuBySlug(data: DataService, slug: string) {
	const controller = createNavigationController(data);
	const menu = await controller.getMenuBySlug(slug);
	if (!menu?.isActive) {
		return { error: "Menu not found", status: 404 };
	}
	return { menu };
}

async function simulateGetMenuWithItems(data: DataService, id: string) {
	const controller = createNavigationController(data);
	const menu = await controller.getMenuWithItems(id);
	if (!menu) {
		return { error: "Menu not found", status: 404 };
	}
	return { menu };
}

async function simulateGetMenuByLocation(
	data: DataService,
	location: MenuLocation,
) {
	const controller = createNavigationController(data);
	const menu = await controller.getMenuByLocation(location);
	if (!menu) {
		return { error: "Menu not found", status: 404 };
	}
	return { menu };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list menus — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active menus", async () => {
		const ctrl = createNavigationController(data);
		await ctrl.createMenu({
			name: "Main Nav",
			slug: "main-nav",
			location: "header",
			isActive: true,
		});
		await ctrl.createMenu({
			name: "Draft Nav",
			slug: "draft-nav",
			location: "footer",
			isActive: false,
		});

		const result = await simulateListMenus(data);

		expect(result.menus).toHaveLength(1);
		expect(result.menus[0].name).toBe("Main Nav");
	});

	it("returns empty when no active menus exist", async () => {
		const result = await simulateListMenus(data);

		expect(result.menus).toHaveLength(0);
	});
});

describe("store endpoint: get menu by slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active menu", async () => {
		const ctrl = createNavigationController(data);
		await ctrl.createMenu({
			name: "Header Menu",
			slug: "header-menu",
			location: "header",
			isActive: true,
		});

		const result = await simulateGetMenuBySlug(data, "header-menu");

		expect("menu" in result).toBe(true);
		if ("menu" in result) {
			expect(result.menu.name).toBe("Header Menu");
		}
	});

	it("returns 404 for inactive menu", async () => {
		const ctrl = createNavigationController(data);
		await ctrl.createMenu({
			name: "Disabled",
			slug: "disabled-menu",
			location: "header",
			isActive: false,
		});

		const result = await simulateGetMenuBySlug(data, "disabled-menu");

		expect(result).toEqual({ error: "Menu not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetMenuBySlug(data, "no-such-menu");

		expect(result).toEqual({ error: "Menu not found", status: 404 });
	});
});

describe("store endpoint: get menu with items", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns menu with its items", async () => {
		const ctrl = createNavigationController(data);
		const menu = await ctrl.createMenu({
			name: "Main",
			slug: "main",
			location: "header",
			isActive: true,
		});
		await ctrl.createItem({
			menuId: menu.id,
			label: "Home",
			url: "/",
			position: 1,
			isVisible: true,
		});
		await ctrl.createItem({
			menuId: menu.id,
			label: "Products",
			url: "/products",
			position: 2,
			isVisible: true,
		});

		const result = await simulateGetMenuWithItems(data, menu.id);

		expect("menu" in result).toBe(true);
		if ("menu" in result) {
			expect(result.menu.name).toBe("Main");
			expect(result.menu.items.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("returns 404 for nonexistent menu", async () => {
		const result = await simulateGetMenuWithItems(data, "ghost_menu");

		expect(result).toEqual({ error: "Menu not found", status: 404 });
	});
});

describe("store endpoint: get menu by location", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns the active menu for a location", async () => {
		const ctrl = createNavigationController(data);
		const menu = await ctrl.createMenu({
			name: "Footer Nav",
			slug: "footer-nav",
			location: "footer",
			isActive: true,
		});
		await ctrl.createItem({
			menuId: menu.id,
			label: "Contact",
			url: "/contact",
			position: 1,
			isVisible: true,
		});

		const result = await simulateGetMenuByLocation(data, "footer");

		expect("menu" in result).toBe(true);
		if ("menu" in result) {
			expect(result.menu.name).toBe("Footer Nav");
		}
	});

	it("returns 404 when no menu at location", async () => {
		const result = await simulateGetMenuByLocation(data, "sidebar");

		expect(result).toEqual({ error: "Menu not found", status: 404 });
	});
});
