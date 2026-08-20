import type { ModuleSchema } from "@86d-app/core/types/schema";

export const digitalDownloadsSchema = {
	downloadableFile: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			name: { type: "string", required: true },
			url: { type: "string", required: true },
			fileSize: { type: "number", required: false },
			mimeType: { type: "string", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
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
	downloadToken: {
		fields: {
			id: { type: "string", required: true },
			token: { type: "string", required: true },
			fileId: { type: "string", required: true },
			orderId: { type: "string", required: false },
			email: { type: "string", required: true },
			maxDownloads: { type: "number", required: false },
			downloadCount: { type: "number", required: true, defaultValue: 0 },
			expiresAt: { type: "date", required: false },
			revokedAt: { type: "date", required: false },
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
