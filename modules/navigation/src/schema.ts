import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const navigationMenuShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	location: z
		.enum(["header", "footer", "sidebar", "mobile", "custom"])
		.default("header"),
	isActive: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const navigationMenuItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	menuId: z.string().register(col, {
		references: { table: "self.menu", column: "id", onDelete: "cascade" },
	}),
	parentId: z
		.string()
		.register(col, {
			references: { table: "self.menuItem", column: "id", onDelete: "cascade" },
		})
		.optional(),
	label: z.string(),
	type: z
		.enum(["link", "category", "collection", "page", "product"])
		.default("link"),
	url: z.string().optional(),
	resourceId: z.string().optional(),
	openInNewTab: z.boolean().default(false),
	cssClass: z.string().optional(),
	position: z.int().default(0),
	isVisible: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for navigation. */
export const navigationStorage = {
	kind: "relational",
	tables: {
		menu: {
			shape: navigationMenuShape,
		},
		menuItem: {
			shape: navigationMenuItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
