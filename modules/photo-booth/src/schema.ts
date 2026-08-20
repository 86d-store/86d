import type { ModuleSchema } from "@86d-app/core/types/schema";

export const photoBoothSchema = {
	photo: {
		fields: {
			id: { type: "string", required: true },
			sessionId: { type: "string", required: true },
			imageUrl: { type: "string", required: true },
			thumbnailUrl: { type: "string", required: false },
			caption: { type: "string", required: false },
			email: { type: "string", required: false },
			phoneNumber: { type: "string", required: false },
			sendStatus: {
				type: "string",
				required: true,
				defaultValue: "none",
			},
			tags: { type: "json", required: true, defaultValue: [] },
			metadata: { type: "json", required: true, defaultValue: {} },
			isPublic: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	photoSession: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			photoCount: { type: "number", required: true, defaultValue: 0 },
			startedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			endedAt: { type: "date", required: false },
			settings: { type: "json", required: true, defaultValue: {} },
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
	photoStream: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			isLive: { type: "boolean", required: true, defaultValue: false },
			photoCount: { type: "number", required: true, defaultValue: 0 },
			settings: { type: "json", required: true, defaultValue: {} },
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
