import type { ModuleSchema } from "@86d-app/core/types/schema";

export const announcementsSchema = {
	announcement: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			title: {
				type: "string",
				required: true,
			},
			content: {
				type: "string",
				required: true,
			},
			type: {
				type: ["bar", "banner", "popup"],
				required: true,
				defaultValue: "bar",
			},
			position: {
				type: ["top", "bottom"],
				required: true,
				defaultValue: "top",
			},
			linkUrl: {
				type: "string",
				required: false,
			},
			linkText: {
				type: "string",
				required: false,
			},
			backgroundColor: {
				type: "string",
				required: false,
			},
			textColor: {
				type: "string",
				required: false,
			},
			iconName: {
				type: "string",
				required: false,
			},
			priority: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			isActive: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			isDismissible: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			startsAt: {
				type: "date",
				required: false,
			},
			endsAt: {
				type: "date",
				required: false,
			},
			targetAudience: {
				type: ["all", "authenticated", "guest"],
				required: true,
				defaultValue: "all",
			},
			impressions: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			clicks: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			dismissals: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
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
