import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TaxController } from "../../service";

export const getApplicableRates = createStoreEndpoint(
	"/tax/rates",
	{
		method: "GET",
		query: z.object({
			country: z.string().length(2).transform(sanitizeText),
			state: z.string().min(1).max(100).transform(sanitizeText),
			city: z.string().max(200).transform(sanitizeText).optional(),
			postalCode: z.string().max(20).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const rates = await controller.getRatesForAddress({
			country: ctx.query.country,
			state: ctx.query.state,
			city: ctx.query.city,
			postalCode: ctx.query.postalCode,
		});

		// Return only public-facing fields
		return {
			rates: rates.map((r) => ({
				name: r.name,
				rate: r.rate,
				type: r.type,
				inclusive: r.inclusive,
			})),
		};
	},
);
