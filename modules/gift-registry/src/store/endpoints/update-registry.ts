import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type {
	GiftRegistryController,
	UpdateRegistryParams,
} from "../../service";

export const updateRegistry = createStoreEndpoint(
	"/gift-registry/update",
	{
		method: "POST",
		body: z.object({
			registryId: z.string().max(200),
			title: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(2000).transform(sanitizeText).optional(),
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
			eventDate: z.coerce.date().optional(),
			coverImageUrl: z.string().url().max(2048).optional(),
			thankYouMessage: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const existing = await controller.getRegistry(ctx.body.registryId);
		if (!existing || existing.customerId !== userId) {
			return { error: "Registry not found", status: 404 };
		}

		const params: UpdateRegistryParams = {};
		if (ctx.body.title) params.title = ctx.body.title;
		if (ctx.body.description) params.description = ctx.body.description;
		if (ctx.body.type) params.type = ctx.body.type;
		if (ctx.body.visibility) params.visibility = ctx.body.visibility;
		if (ctx.body.eventDate) params.eventDate = ctx.body.eventDate;
		if (ctx.body.coverImageUrl) params.coverImageUrl = ctx.body.coverImageUrl;
		if (ctx.body.thankYouMessage)
			params.thankYouMessage = ctx.body.thankYouMessage;

		const registry = await controller.updateRegistry(
			ctx.body.registryId,
			params,
		);
		return { registry };
	},
);
