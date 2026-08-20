import type { ModuleSchema } from "@86d-app/core/types/schema";

export const qrCodeSchema = {
	qrCode: {
		fields: {
			id: { type: "string", required: true },
			label: { type: "string", required: true },
			targetUrl: { type: "string", required: true },
			targetType: { type: "string", required: true, defaultValue: "custom" },
			targetId: { type: "string", required: false },
			format: { type: "string", required: true, defaultValue: "svg" },
			size: { type: "number", required: true, defaultValue: 256 },
			errorCorrection: {
				type: "string",
				required: true,
				defaultValue: "M",
			},
			scanCount: { type: "number", required: true, defaultValue: 0 },
			isActive: { type: "boolean", required: true, defaultValue: true },
			metadata: { type: "json", required: true, defaultValue: {} },
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
	qrScan: {
		fields: {
			id: { type: "string", required: true },
			qrCodeId: { type: "string", required: true },
			scannedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			userAgent: { type: "string", required: false },
			ipAddress: { type: "string", required: false },
			referrer: { type: "string", required: false },
		},
	},
} satisfies ModuleSchema;
