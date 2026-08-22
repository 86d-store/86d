import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LabelType, ProductLabelController } from "../../service";

export const createLabel = createAdminEndpoint(
	"/admin/product-labels/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			displayText: z.string().min(1).max(200).transform(sanitizeText),
			type: z.enum(["badge", "tag", "ribbon", "banner", "sticker", "custom"]),
			color: z.string().max(50).optional(),
			backgroundColor: z.string().max(50).optional(),
			icon: z.string().max(200).optional(),
			priority: z.number().int().min(0).max(1000).optional(),
			isActive: z.boolean().optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
			conditions: z
				.object({
					newWithinDays: z.number().int().min(1).optional(),
					discountMinPercent: z.number().min(0).max(100).optional(),
					lowStockThreshold: z.number().int().min(0).optional(),
					categories: z.array(z.string()).optional(),
					priceMin: z.number().min(0).optional(),
					priceMax: z.number().min(0).optional(),
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		// Check for duplicate slug
		const existing = await controller.getLabelBySlug(ctx.body.slug);
		if (existing) {
			return { error: "A label with this slug already exists", status: 400 };
		}

		const label = await controller.createLabel({
			name: ctx.body.name,
			slug: ctx.body.slug,
			displayText: ctx.body.displayText,
			type: ctx.body.type as LabelType,
			color: ctx.body.color,
			backgroundColor: ctx.body.backgroundColor,
			icon: ctx.body.icon,
			priority: ctx.body.priority,
			isActive: ctx.body.isActive,
			startsAt: ctx.body.startsAt,
			endsAt: ctx.body.endsAt,
			conditions: ctx.body.conditions,
		});

		return { label };
	},
);
