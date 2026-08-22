import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const giftcardsGiftCardShape = z.object({
	id: z.string().register(col, { pk: true }),
	code: z.string(),
	initialBalance: z.number(),
	currentBalance: z.number(),
	currency: z.string(),
	status: z.string(),
	expiresAt: z.string().optional(),
	recipientEmail: z.string().optional(),
	recipientName: z.string().optional(),
	customerId: z.string().optional(),
	purchasedByCustomerId: z.string().optional(),
	senderName: z.string().optional(),
	senderEmail: z.string().optional(),
	message: z.string().optional(),
	deliveryMethod: z.string().optional(),
	delivered: z.boolean().optional(),
	deliveredAt: z.coerce.date().optional(),
	scheduledDeliveryAt: z.string().optional(),
	purchaseOrderId: z.string().optional(),
	note: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const giftcardsGiftCardTransactionShape = z.object({
	id: z.string().register(col, { pk: true }),
	giftCardId: z.string(),
	type: z.string(),
	amount: z.number(),
	balanceAfter: z.number(),
	orderId: z.string().optional(),
	customerId: z.string().optional(),
	note: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for giftcards. */
export const giftcardsStorage = {
	kind: "relational",
	tables: {
		giftCard: {
			shape: giftcardsGiftCardShape,
		},
		giftCardTransaction: {
			shape: giftcardsGiftCardTransactionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
