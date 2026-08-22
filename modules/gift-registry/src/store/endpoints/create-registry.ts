import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type {
	CreateRegistryParams,
	GiftRegistryController,
} from "../../service";

export const createRegistry = createStoreEndpoint(
	"/gift-registry/create",
	{
		method: "POST",
		body: z.object({
			title: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			type: z.enum([
				"wedding",
				"baby",
				"birthday",
				"housewarming",
				"holiday",
				"other",
			]),
			slug: z
				.string()
				.min(3)
				.max(100)
				.regex(/^[a-z0-9-]+$/)
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
		const params: CreateRegistryParams = {
			customerId: userId,
			customerName: ctx.context.session?.user?.name ?? "Customer",
			title: ctx.body.title,
			type: ctx.body.type,
		};
		if (ctx.body.description) params.description = ctx.body.description;
		if (ctx.body.slug) params.slug = ctx.body.slug;
		if (ctx.body.visibility) params.visibility = ctx.body.visibility;
		if (ctx.body.eventDate) params.eventDate = ctx.body.eventDate;
		if (ctx.body.coverImageUrl) params.coverImageUrl = ctx.body.coverImageUrl;
		if (ctx.body.thankYouMessage)
			params.thankYouMessage = ctx.body.thankYouMessage;

		const registry = await controller.createRegistry(params);
		return { registry };
	},
);
