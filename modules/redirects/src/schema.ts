import type { ModuleSchema } from "@86d-app/core/types/schema";

export const redirectsSchema = {
	redirect: {
		fields: {
			id: { type: "string", required: true },
			sourcePath: { type: "string", required: true, index: true },
			targetPath: { type: "string", required: true },
			statusCode: { type: "number", required: true },
			isActive: { type: "boolean", required: true },
			isRegex: { type: "boolean", required: true },
			preserveQueryString: { type: "boolean", required: true },
			note: { type: "string", required: false },
			hitCount: { type: "number", required: true },
			lastHitAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
