import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const analyticsSchema = {
	event: {
		fields: {
			id: { type: "string", required: true },
			type: { type: "string", required: true },
			sessionId: { type: "string", required: false },
			customerId: { type: "string", required: false },
			productId: { type: "string", required: false },
			orderId: { type: "string", required: false },
			value: { type: "number", required: false },
			data: { type: "json", required: true, defaultValue: {} },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const analyticsTables = transcodeModuleSchema(analyticsSchema);
