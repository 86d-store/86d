import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const importExportImportJobShape = z.object({
	id: z.string().register(col, { pk: true }),
	type: z.enum(["products", "customers", "orders", "inventory"]),
	status: z
		.enum([
			"pending",
			"validating",
			"processing",
			"completed",
			"failed",
			"cancelled",
		])
		.default("pending"),
	filename: z.string(),
	totalRows: z.int().default(0),
	processedRows: z.int().default(0),
	failedRows: z.int().default(0),
	skippedRows: z.int().default(0),
	errors: z.array(z.unknown()).default([]),
	options: z.record(z.string(), z.unknown()).default({}),
	createdBy: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
});

export const importExportExportJobShape = z.object({
	id: z.string().register(col, { pk: true }),
	type: z.enum(["products", "customers", "orders", "inventory"]),
	status: z
		.enum(["pending", "processing", "completed", "failed"])
		.default("pending"),
	format: z.enum(["csv", "json"]).default("csv"),
	filters: z.record(z.string(), z.unknown()).default({}),
	totalRows: z.int().default(0),
	fileData: z.string().optional(),
	createdBy: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
});

/** Native Relational storage for import-export. */
export const importExportStorage = {
	kind: "relational",
	tables: {
		importJob: {
			shape: importExportImportJobShape,
		},
		exportJob: {
			shape: importExportExportJobShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
