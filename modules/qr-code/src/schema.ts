import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const qrCodeQrCodeShape = z.object({
	id: z.string().register(col, { pk: true }),
	label: z.string(),
	targetUrl: z.string(),
	targetType: z.string().default("custom"),
	targetId: z.string().optional(),
	format: z.string().default("svg"),
	size: z.int().default(256),
	errorCorrection: z.string().default("M"),
	scanCount: z.int().default(0),
	isActive: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const qrCodeQrScanShape = z.object({
	id: z.string().register(col, { pk: true }),
	qrCodeId: z.string(),
	scannedAt: z.coerce.date().default(() => new Date()),
	userAgent: z.string().optional(),
	ipAddress: z.string().optional(),
	referrer: z.string().optional(),
});

/** Native Relational storage for qr-code. */
export const qrCodeStorage = {
	kind: "relational",
	tables: {
		qrCode: {
			shape: qrCodeQrCodeShape,
		},
		qrScan: {
			shape: qrCodeQrScanShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
