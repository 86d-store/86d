import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const tippingTipShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	amount: z.number(),
	percentage: z.number().optional(),
	type: z.string(),
	recipientType: z.string(),
	recipientId: z.string().optional(),
	customerId: z.string().optional(),
	status: z.string(),
	paidAt: z.coerce.date().optional(),
	metadata: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const tippingTipPayoutShape = z.object({
	id: z.string().register(col, { pk: true }),
	recipientId: z.string(),
	recipientType: z.string(),
	amount: z.number(),
	tipCount: z.number(),
	periodStart: z.coerce.date().default(() => new Date()),
	periodEnd: z.coerce.date().default(() => new Date()),
	status: z.string(),
	paidAt: z.coerce.date().optional(),
	reference: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const tippingTipSettingsShape = z.object({
	id: z.string().register(col, { pk: true }),
	presetPercents: z.record(z.string(), z.unknown()),
	allowCustom: z.boolean(),
	maxPercent: z.number(),
	maxAmount: z.number(),
	enableSplitting: z.boolean(),
	defaultRecipientType: z.string(),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for tipping. */
export const tippingStorage = {
	kind: "relational",
	tables: {
		tip: {
			shape: tippingTipShape,
		},
		tipPayout: {
			shape: tippingTipPayoutShape,
		},
		tipSettings: {
			shape: tippingTipSettingsShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
