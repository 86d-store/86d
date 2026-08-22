import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BundleController } from "../../service";

export const updateBundle = createAdminEndpoint(
	"/admin/bundles/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z
				.string()
				.min(1)
				.max(200)
				.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
				.optional(),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			status: z.enum(["active", "draft", "archived"]).optional(),
			discountType: z.enum(["fixed", "percentage"]).optional(),
			discountValue: z.number().min(0).optional(),
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

		if (
			ctx.body.discountType === "percentage" &&
			ctx.body.discountValue !== undefined &&
			ctx.body.discountValue > 100
		) {
			return { error: "Percentage discount cannot exceed 100%", status: 400 };
		}

		// Check slug uniqueness if slug is being changed
		if (ctx.body.slug) {
			const existing = await controller.getBySlug(ctx.body.slug);
			if (existing && existing.id !== ctx.params.id) {
				return {
					error: "A bundle with this slug already exists",
					status: 409,
				};
			}
		}

		// Build update payload excluding undefined values (exactOptionalPropertyTypes)
		const updates: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(ctx.body)) {
			if (value !== undefined) updates[key] = value;
		}

		const bundle = await controller.update(ctx.params.id, updates);

		if (!bundle) {
			return { error: "Bundle not found", status: 404 };
		}

		void ctx.context.events?.emit("bundle.updated", {
			bundleId: bundle.id,
			name: bundle.name,
			status: bundle.status,
		});
		if (ctx.body.status === "active") {
			void ctx.context.events?.emit("bundle.activated", {
				bundleId: bundle.id,
				name: bundle.name,
			});
		} else if (ctx.body.status === "archived") {
			void ctx.context.events?.emit("bundle.archived", {
				bundleId: bundle.id,
				name: bundle.name,
			});
		}

		return { bundle };
	},
);
