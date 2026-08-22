import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	GiftRegistryController,
	ListRegistriesParams,
} from "../../service";

export const browseRegistries = createStoreEndpoint(
	"/gift-registry",
	{
		method: "GET",
		query: z.object({
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
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const params: ListRegistriesParams = {
			visibility: "public",
			status: "active",
			take: ctx.query.take ?? 20,
		};
		if (ctx.query.type) params.type = ctx.query.type;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;

		const registries = await controller.listRegistries(params);
		return { registries };
	},
);
