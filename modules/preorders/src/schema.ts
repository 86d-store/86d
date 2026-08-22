import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const preordersPreorderCampaignShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	productName: z.string(),
	variantId: z.string().optional(),
	variantLabel: z.string().optional(),
	status: z.string(),
	paymentType: z.string(),
	depositAmount: z.number().optional(),
	depositPercent: z.number().optional(),
	price: z.number(),
	maxQuantity: z.number().optional(),
	currentQuantity: z.number(),
	startDate: z.coerce.date(),
	endDate: z.coerce.date().optional(),
	estimatedShipDate: z.coerce.date().optional(),
	message: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const preordersPreorderItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	campaignId: z.string(),
	customerId: z.string(),
	customerEmail: z.string(),
	quantity: z.number(),
	status: z.string(),
	depositPaid: z.number(),
	totalPrice: z.number(),
	orderId: z.string().optional(),
	notifiedAt: z.coerce.date().optional(),
	cancelledAt: z.coerce.date().optional(),
	cancelReason: z.string().optional(),
	fulfilledAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for preorders. */
export const preordersStorage = {
	kind: "relational",
	tables: {
		preorderCampaign: {
			shape: preordersPreorderCampaignShape,
		},
		preorderItem: {
			shape: preordersPreorderItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
