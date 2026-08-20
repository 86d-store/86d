import type { ModuleSchema } from "@86d-app/core/types/schema";

export const importExportSchema = {
	importJob: {
		fields: {
			id: { type: "string", required: true },
			type: {
				type: ["products", "customers", "orders", "inventory"],
				required: true,
			},
			status: {
				type: [
					"pending",
					"validating",
					"processing",
					"completed",
					"failed",
					"cancelled",
				],
				required: true,
				defaultValue: "pending",
			},
			filename: { type: "string", required: true },
			totalRows: { type: "number", required: true, defaultValue: 0 },
			processedRows: { type: "number", required: true, defaultValue: 0 },
			failedRows: { type: "number", required: true, defaultValue: 0 },
			skippedRows: { type: "number", required: true, defaultValue: 0 },
			/** JSON array of error objects [{row, field, message}] */
			errors: { type: "json", required: false, defaultValue: [] },
			/** JSON object with import options (e.g. updateExisting, skipDuplicates) */
			options: { type: "json", required: false, defaultValue: {} },
			createdBy: { type: "string", required: false },
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
			completedAt: { type: "date", required: false },
		},
	},
	exportJob: {
		fields: {
			id: { type: "string", required: true },
			type: {
				type: ["products", "customers", "orders", "inventory"],
				required: true,
			},
			status: {
				type: ["pending", "processing", "completed", "failed"],
				required: true,
				defaultValue: "pending",
			},
			format: {
				type: ["csv", "json"],
				required: true,
				defaultValue: "csv",
			},
			/** JSON object with export filters (e.g. dateRange, status) */
			filters: { type: "json", required: false, defaultValue: {} },
			totalRows: { type: "number", required: true, defaultValue: 0 },
			/** Serialized export data (CSV string or JSON string) */
			fileData: { type: "string", required: false },
			createdBy: { type: "string", required: false },
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
			completedAt: { type: "date", required: false },
		},
	},
} satisfies ModuleSchema;
