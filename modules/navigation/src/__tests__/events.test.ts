import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createNavigationController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// menu.created
// ---------------------------------------------------------------------------

describe("menu.created event", () => {
	it("emits when a menu is created", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("menu.created");
		expect(events.emitted[0].payload).toEqual({
			menuId: menu.id,
			name: "Main Menu",
			slug: menu.slug,
			location: "header",
		});
	});

	it("includes auto-generated slug in payload", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		await ctrl.createMenu({ name: "Footer Links", location: "footer" });

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.slug).toBe("footer-links");
		expect(payload.location).toBe("footer");
	});

	it("includes custom slug in payload", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		await ctrl.createMenu({
			name: "Main Menu",
			slug: "custom-slug",
			location: "header",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.slug).toBe("custom-slug");
	});
});

// ---------------------------------------------------------------------------
// menu.updated
// ---------------------------------------------------------------------------

describe("menu.updated event", () => {
	it("emits when a menu is updated", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});
		events.emitted.length = 0;

		await ctrl.updateMenu(menu.id, { name: "Updated Menu" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("menu.updated");
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.menuId).toBe(menu.id);
		expect(payload.name).toBe("Updated Menu");
	});

	it("does not emit when menu does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		await ctrl.updateMenu("nonexistent", { name: "Test" });

		expect(
			events.emitted.filter((e) => e.type === "menu.updated"),
		).toHaveLength(0);
	});

	it("reflects location change in payload", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});
		events.emitted.length = 0;

		await ctrl.updateMenu(menu.id, { location: "sidebar" });

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.location).toBe("sidebar");
	});
});

// ---------------------------------------------------------------------------
// menu.deleted
// ---------------------------------------------------------------------------

describe("menu.deleted event", () => {
	it("emits when a menu is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});
		events.emitted.length = 0;

		await ctrl.deleteMenu(menu.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("menu.deleted");
		expect(events.emitted[0].payload).toEqual({ menuId: menu.id });
	});

	it("does not emit when menu does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		await ctrl.deleteMenu("nonexistent");

		expect(
			events.emitted.filter((e) => e.type === "menu.deleted"),
		).toHaveLength(0);
	});

	it("emits after cascade-deleting menu items", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});
		await ctrl.createItem({
			menuId: menu.id,
			label: "Home",
			url: "/",
		});
		await ctrl.createItem({
			menuId: menu.id,
			label: "About",
			url: "/about",
		});
		events.emitted.length = 0;

		await ctrl.deleteMenu(menu.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("menu.deleted");
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createNavigationController(createMockDataService());

		const menu = await ctrl.createMenu({
			name: "Main Menu",
			location: "header",
		});
		await ctrl.updateMenu(menu.id, { name: "Updated" });
		await expect(ctrl.deleteMenu(menu.id)).resolves.toBeUndefined();

		// No errors thrown — graceful no-op
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		const menu = await ctrl.createMenu({
			name: "Header Nav",
			location: "header",
		});
		await ctrl.updateMenu(menu.id, { name: "Updated Header Nav" });
		await ctrl.deleteMenu(menu.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual(["menu.created", "menu.updated", "menu.deleted"]);
	});

	it("emits separate events for multiple menus", async () => {
		const events = createMockEvents();
		const ctrl = createNavigationController(createMockDataService(), events);

		await ctrl.createMenu({ name: "Header", location: "header" });
		await ctrl.createMenu({ name: "Footer", location: "footer" });

		expect(events.emitted).toHaveLength(2);
		const payloads = events.emitted.map(
			(e) => (e.payload as Record<string, unknown>).location,
		);
		expect(payloads).toEqual(["header", "footer"]);
	});
});
