import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LabelType, ProductLabelController } from "../../service";

export const updateLabel = createAdminEndpoint(
	"/admin/product-labels/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			displayText: z
				.string()
				.min(1)
				.max(200)
				.transform(sanitizeText)
				.optional(),
			type: z
				.enum(["badge", "tag", "ribbon", "banner", "sticker", "custom"])
				.optional(),
			color: z.string().max(50).optional(),
			backgroundColor: z.string().max(50).optional(),
			icon: z.string().max(200).optional(),
			priority: z.number().int().min(0).max(1000).optional(),
			isActive: z.boolean().optional(),
			startsAt: z.coerce.date().nullable().optional(),
			endsAt: z.coerce.date().nullable().optional(),
			conditions: z
				.object({
					newWithinDays: z.number().int().min(1).optional(),
					discountMinPercent: z.number().min(0).max(100).optional(),
					lowStockThreshold: z.number().int().min(0).optional(),
					categories: z.array(z.string()).optional(),
					priceMin: z.number().min(0).optional(),
					priceMax: z.number().min(0).optional(),
				})
				.nullable()
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const label = await controller.updateLabel(ctx.params.id, {
			name: ctx.body.name,
			displayText: ctx.body.displayText,
			type: ctx.body.type as LabelType | undefined,
			color: ctx.body.color,
			backgroundColor: ctx.body.backgroundColor,
			icon: ctx.body.icon,
			priority: ctx.body.priority,
			isActive: ctx.body.isActive,
			startsAt: ctx.body.startsAt,
			endsAt: ctx.body.endsAt,
			conditions: ctx.body.conditions,
		});

		if (!label) {
			return { error: "Label not found", status: 404 };
		}

		return { label };
	},
);
