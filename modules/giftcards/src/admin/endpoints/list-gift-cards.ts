import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import {
	GIFT_CARD_ADMIN_SORT_FIELDS,
	type GiftCardController,
} from "../../service";
import { GiftCardDataUnavailableError } from "../../service-impl";

export const listGiftCards = createAdminEndpoint(
	"/admin/gift-cards",
	{
		method: "GET",
		query: z.object({
			status: z.string().min(1).max(100).transform(sanitizeText).optional(),
			customerId: z.string().min(1).max(200).transform(sanitizeText).optional(),
			search: z.string().max(200).transform(sanitizeText).optional(),
			sort: z.enum(GIFT_CARD_ADMIN_SORT_FIELDS).optional(),
			direction: z.enum(["asc", "desc"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		try {
			return await controller.listAdminPage({
				status: ctx.query.status,
				customerId: ctx.query.customerId,
				search: ctx.query.search,
				sort: ctx.query.sort,
				direction: ctx.query.direction,
				take,
				skip,
			});
		} catch (error) {
			if (error instanceof GiftCardDataUnavailableError) {
				return { error: "Gift cards are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
