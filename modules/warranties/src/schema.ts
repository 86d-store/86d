import type { ModuleSchema } from "@86d-app/core/types/schema";

export const warrantiesSchema = {
	warrantyPlan: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			type: {
				type: ["manufacturer", "extended", "accidental_damage"] as const,
				required: true,
			},
			durationMonths: { type: "number", required: true },
			price: { type: "number", required: true, defaultValue: 0 },
			coverageDetails: { type: "string", required: false },
			exclusions: { type: "string", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			productId: { type: "string", required: false },
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
	warrantyRegistration: {
		fields: {
			id: { type: "string", required: true },
			warrantyPlanId: {
				type: "string",
				required: true,
				references: {
					model: "warrantyPlan",
					field: "id",
					onDelete: "restrict" as const,
				},
			},
			orderId: { type: "string", required: true },
			customerId: { type: "string", required: true },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			serialNumber: { type: "string", required: false },
			purchaseDate: { type: "date", required: true },
			expiresAt: { type: "date", required: true },
			status: {
				type: ["active", "expired", "voided", "claimed"] as const,
				required: true,
				defaultValue: "active",
			},
			voidReason: { type: "string", required: false },
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
	warrantyClaim: {
		fields: {
			id: { type: "string", required: true },
			warrantyRegistrationId: {
				type: "string",
				required: true,
				references: {
					model: "warrantyRegistration",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: false },
			issueType: {
				type: [
					"defect",
					"malfunction",
					"accidental_damage",
					"wear_and_tear",
					"missing_parts",
					"other",
				] as const,
				required: true,
			},
			issueDescription: { type: "string", required: true },
			status: {
				type: [
					"submitted",
					"under_review",
					"approved",
					"denied",
					"in_repair",
					"resolved",
					"closed",
				] as const,
				required: true,
				defaultValue: "submitted",
			},
			resolution: {
				type: ["repair", "replace", "refund", "credit"] as const,
				required: false,
			},
			resolutionNotes: { type: "string", required: false },
			adminNotes: { type: "string", required: false },
			submittedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			resolvedAt: { type: "date", required: false },
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
