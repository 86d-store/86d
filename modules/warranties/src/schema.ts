import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const warrantiesWarrantyPlanShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	type: z.enum(["manufacturer", "extended", "accidental_damage"]),
	durationMonths: z.number(),
	price: z.int().default(0),
	coverageDetails: z.string().optional(),
	exclusions: z.string().optional(),
	isActive: z.boolean().default(true),
	productId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const warrantiesWarrantyRegistrationShape = z.object({
	id: z.string().register(col, { pk: true }),
	warrantyPlanId: z.string().register(col, {
		references: {
			table: "self.warrantyPlan",
			column: "id",
			onDelete: "restrict",
		},
	}),
	orderId: z.string(),
	customerId: z.string(),
	productId: z.string(),
	productName: z.string(),
	serialNumber: z.string().optional(),
	purchaseDate: z.coerce.date(),
	expiresAt: z.coerce.date(),
	status: z.enum(["active", "expired", "voided", "claimed"]).default("active"),
	voidReason: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const warrantiesWarrantyClaimShape = z.object({
	id: z.string().register(col, { pk: true }),
	warrantyRegistrationId: z.string().register(col, {
		references: {
			table: "self.warrantyRegistration",
			column: "id",
			onDelete: "cascade",
		},
	}),
	customerId: z.string(),
	customerEmail: z.string().optional(),
	issueType: z.enum([
		"defect",
		"malfunction",
		"accidental_damage",
		"wear_and_tear",
		"missing_parts",
		"other",
	]),
	issueDescription: z.string(),
	status: z
		.enum([
			"submitted",
			"under_review",
			"approved",
			"denied",
			"in_repair",
			"resolved",
			"closed",
		])
		.default("submitted"),
	resolution: z.enum(["repair", "replace", "refund", "credit"]).optional(),
	resolutionNotes: z.string().optional(),
	adminNotes: z.string().optional(),
	submittedAt: z.coerce.date().default(() => new Date()),
	resolvedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for warranties. */
export const warrantiesStorage = {
	kind: "relational",
	tables: {
		warrantyPlan: {
			shape: warrantiesWarrantyPlanShape,
		},
		warrantyRegistration: {
			shape: warrantiesWarrantyRegistrationShape,
		},
		warrantyClaim: {
			shape: warrantiesWarrantyClaimShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
