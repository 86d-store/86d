import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	GiftRegistryController,
	ListRegistriesParams,
} from "../../service";

export const listRegistries = createAdminEndpoint(
	"/admin/gift-registry",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "completed", "archived"]).optional(),
			type: z
				.enum([
					"wedding",
					"baby",
					"birthday",
					"housewarming",
					"holiday",
					"other",
				])
				.optional(),
			visibility: z.enum(["public", "unlisted", "private"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const params: ListRegistriesParams = {
			take: ctx.query.take ?? 20,
		};
		if (ctx.query.status) params.status = ctx.query.status;
		if (ctx.query.type) params.type = ctx.query.type;
		if (ctx.query.visibility) params.visibility = ctx.query.visibility;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;

		const registries = await controller.listRegistries(params);
		return { registries };
	},
);
