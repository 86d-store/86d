import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BundleController } from "../../service";

export const createBundle = createAdminEndpoint(
	"/admin/bundles/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z
				.string()
				.min(1)
				.max(200)
				.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			discountType: z.enum(["fixed", "percentage"]),
			discountValue: z.number().min(0),
			minQuantity: z.number().int().min(1).optional(),
			maxQuantity: z.number().int().min(1).optional(),
			startsAt: z.string().optional(),
			endsAt: z.string().optional(),
			imageUrl: z.string().url().max(2000).optional(),
			sortOrder: z.number().int().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;

		// Validate percentage discount is <= 100
		if (
			ctx.body.discountType === "percentage" &&
			ctx.body.discountValue > 100
		) {
			return { error: "Percentage discount cannot exceed 100%", status: 400 };
		}

		// Check slug uniqueness
		const existing = await controller.getBySlug(ctx.body.slug);
		if (existing) {
			return { error: "A bundle with this slug already exists", status: 409 };
		}

		const bundle = await controller.create(ctx.body);
		void ctx.context.events?.emit("bundle.created", {
			bundleId: bundle.id,
			name: bundle.name,
			slug: bundle.slug,
		});
		return { bundle };
	},
);
