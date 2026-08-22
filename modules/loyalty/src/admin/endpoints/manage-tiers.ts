import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const createTier = createAdminEndpoint(
	"/admin/loyalty/tiers/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().max(100).transform(sanitizeText),
			slug: z
				.string()
				.max(50)
				.regex(/^[a-z0-9-]+$/),
			minPoints: z.number().int().min(0),
			multiplier: z.number().min(0).optional(),
			perks: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const tier = await controller.createTier({
			name: ctx.body.name,
			slug: ctx.body.slug,
			minPoints: ctx.body.minPoints,
			multiplier: ctx.body.multiplier,
			perks: ctx.body.perks,
		});
		return { tier };
	},
);

export const updateTier = createAdminEndpoint(
	"/admin/loyalty/tiers/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().max(100).transform(sanitizeText).optional(),
			minPoints: z.number().int().min(0).optional(),
			multiplier: z.number().min(0).optional(),
			perks: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const tier = await controller.updateTier(ctx.params.id, {
			name: ctx.body.name,
			minPoints: ctx.body.minPoints,
			multiplier: ctx.body.multiplier,
			perks: ctx.body.perks,
		});
		if (!tier) {
			return { error: "Tier not found" };
		}
		return { tier };
	},
);

export const deleteTier = createAdminEndpoint(
	"/admin/loyalty/tiers/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const deleted = await controller.deleteTier(ctx.params.id);
		return { deleted };
	},
);
