import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Menu,
	MenuItem,
	MenuItemTree,
	NavigationController,
} from "./service";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function buildTree(items: MenuItem[]): MenuItemTree[] {
	const map = new Map<string, MenuItemTree>();
	const roots: MenuItemTree[] = [];

	for (const item of items) {
		map.set(item.id, { ...item, children: [] });
	}

	for (const item of items) {
		const node = map.get(item.id);
		if (!node) continue;

		if (item.parentId) {
			const parent = map.get(item.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	return roots;
}

export function createNavigationController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): NavigationController {
	return {
		// ── Menu CRUD ────────────────────────────────────────────

		async createMenu(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const menu: Menu = {
				id,
				name: params.name,
				slug: params.slug?.trim() ? params.slug.trim() : slugify(params.name),
				location: params.location,
				isActive: params.isActive ?? true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("menu", id, menu as Record<string, unknown>);
			void events?.emit("menu.created", {
				menuId: menu.id,
				name: menu.name,
				slug: menu.slug,
				location: menu.location,
			});
			return menu;
		},

		async updateMenu(id, params) {
			const existing = await data.get("menu", id);
			if (!existing) return null;

			const menu = existing as unknown as Menu;
			const now = new Date();
			const updated: Menu = {
				...menu,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.slug !== undefined ? { slug: params.slug } : {}),
				...(params.location !== undefined ? { location: params.location } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: now,
			};
			await data.upsert("menu", id, updated as Record<string, unknown>);
			void events?.emit("menu.updated", {
				menuId: updated.id,
				name: updated.name,
				slug: updated.slug,
				location: updated.location,
			});
			return updated;
		},

		async deleteMenu(id) {
			const existing = await data.get("menu", id);
			if (!existing) return false;

			// Delete all items belonging to this menu
			const items = await data.findMany("menuItem", {
				where: { menuId: id },
			});
			for (const item of items) {
				const mi = item as unknown as MenuItem;
				await data.delete("menuItem", mi.id);
			}

			await data.delete("menu", id);
			void events?.emit("menu.deleted", { menuId: id });
			return true;
		},

		async getMenu(id) {
			const raw = await data.get("menu", id);
			if (!raw) return null;
			return raw as unknown as Menu;
		},

		async getMenuBySlug(slug) {
			const matches = await data.findMany("menu", {
				where: { slug },
				take: 1,
			});
			return (matches[0] as unknown as Menu | undefined) ?? null;
		},

		async listMenus(params) {
			const where: Record<string, unknown> = {};
			if (params?.location) where.location = params.location;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("menu", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				orderBy: { createdAt: "asc" },
			});
			return all as unknown as Menu[];
		},

		// ── Menu Item CRUD ───────────────────────────────────────

		async createItem(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const item: MenuItem = {
				id,
				menuId: params.menuId,
				parentId: params.parentId,
				label: params.label,
				type: params.type ?? "link",
				url: params.url,
				resourceId: params.resourceId,
				openInNewTab: params.openInNewTab ?? false,
				cssClass: params.cssClass,
				position: params.position ?? 0,
				isVisible: params.isVisible ?? true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("menuItem", id, item as Record<string, unknown>);
			return item;
		},

		async updateItem(id, params) {
			const existing = await data.get("menuItem", id);
			if (!existing) return null;

			const item = existing as unknown as MenuItem;
			const now = new Date();
			const updated: MenuItem = {
				...item,
				...(params.label !== undefined ? { label: params.label } : {}),
				...(params.parentId !== undefined ? { parentId: params.parentId } : {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.url !== undefined ? { url: params.url } : {}),
				...(params.resourceId !== undefined
					? { resourceId: params.resourceId }
					: {}),
				...(params.openInNewTab !== undefined
					? { openInNewTab: params.openInNewTab }
					: {}),
				...(params.cssClass !== undefined ? { cssClass: params.cssClass } : {}),
				...(params.position !== undefined ? { position: params.position } : {}),
				...(params.isVisible !== undefined
					? { isVisible: params.isVisible }
					: {}),
				updatedAt: now,
			};
			await data.upsert("menuItem", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteItem(id) {
			const existing = await data.get("menuItem", id);
			if (!existing) return false;

			// Delete child items recursively
			const children = await data.findMany("menuItem", {
				where: { parentId: id },
			});
			for (const child of children) {
				const ci = child as unknown as MenuItem;
				await data.delete("menuItem", ci.id);
			}

			await data.delete("menuItem", id);
			return true;
		},

		async getItem(id) {
			const raw = await data.get("menuItem", id);
			if (!raw) return null;
			return raw as unknown as MenuItem;
		},

		async listItems(menuId, params) {
			const where: Record<string, unknown> = { menuId };
			if (params?.parentId !== undefined) where.parentId = params.parentId;

			const all = await data.findMany("menuItem", {
				where,
				orderBy: { position: "asc" },
			});
			return all as unknown as MenuItem[];
		},

		// ── Tree resolution ──────────────────────────────────────

		async getMenuWithItems(id) {
			const menuRaw = await data.get("menu", id);
			if (!menuRaw) return null;

			const menu = menuRaw as unknown as Menu;
			const allItems = await data.findMany("menuItem", {
				where: { menuId: id, isVisible: true },
				orderBy: { position: "asc" },
			});
			const items = allItems as unknown as MenuItem[];

			return { ...menu, items: buildTree(items) };
		},

		async getMenuByLocation(location) {
			const menus = await data.findMany("menu", {
				where: { location, isActive: true },
				orderBy: { createdAt: "asc" },
				take: 1,
			});
			const menu = menus[0] as unknown as Menu | undefined;
			if (!menu) return null;

			const allItems = await data.findMany("menuItem", {
				where: { menuId: menu.id, isVisible: true },
				orderBy: { position: "asc" },
			});
			const items = allItems as unknown as MenuItem[];

			return { ...menu, items: buildTree(items) };
		},

		async reorderItems(menuId, itemIds, parentId) {
			for (let i = 0; i < itemIds.length; i++) {
				const raw = await data.get("menuItem", itemIds[i]);
				if (!raw) continue;

				const item = raw as unknown as MenuItem;
				if (item.menuId !== menuId) continue;

				const updated: MenuItem = {
					...item,
					position: i,
					...(parentId !== undefined ? { parentId } : {}),
					updatedAt: new Date(),
				};
				await data.upsert(
					"menuItem",
					item.id,
					updated as Record<string, unknown>,
				);
			}
		},
	};
}
