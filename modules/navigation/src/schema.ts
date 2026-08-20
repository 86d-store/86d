import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const navigationSchema = {
	menu: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			location: {
				type: ["header", "footer", "sidebar", "mobile", "custom"],
				required: true,
				defaultValue: "header",
			},
			isActive: { type: "boolean", required: true, defaultValue: true },
			metadata: { type: "json", required: false, defaultValue: {} },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	menuItem: {
		fields: {
			id: { type: "string", required: true },
			menuId: {
				type: "string",
				required: true,
				references: { model: "menu", field: "id", onDelete: "cascade" },
			},
			parentId: {
				type: "string",
				required: false,
				references: { model: "menuItem", field: "id", onDelete: "cascade" },
			},
			label: { type: "string", required: true },
			/** "link" | "category" | "collection" | "page" | "product" */
			type: {
				type: ["link", "category", "collection", "page", "product"],
				required: true,
				defaultValue: "link",
			},
			/** URL for link type, or resource ID for category/collection/page/product */
			url: { type: "string", required: false },
			resourceId: { type: "string", required: false },
			/** Whether to open in a new tab */
			openInNewTab: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			/** CSS class for custom styling */
			cssClass: { type: "string", required: false },
			/** Sort order within the parent (menu or parent item) */
			position: { type: "number", required: true, defaultValue: 0 },
			isVisible: { type: "boolean", required: true, defaultValue: true },
			metadata: { type: "json", required: false, defaultValue: {} },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const navigationTables = transcodeModuleSchema(navigationSchema);
