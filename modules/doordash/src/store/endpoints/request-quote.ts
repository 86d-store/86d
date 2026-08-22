import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DoordashController } from "../../service";

export const requestQuoteEndpoint = createStoreEndpoint(
	"/doordash/quotes",
	{
		method: "POST",
		body: z.object({
			pickupAddress: z.string().min(1).max(500).transform(sanitizeText),
			pickupBusinessName: z.string().min(1).max(200).transform(sanitizeText),
			pickupPhoneNumber: z.string().min(1).max(30).transform(sanitizeText),
			dropoffAddress: z.string().min(1).max(500).transform(sanitizeText),
			dropoffBusinessName: z.string().min(1).max(200).transform(sanitizeText),
			dropoffPhoneNumber: z.string().min(1).max(30).transform(sanitizeText),
			orderValue: z.number().int().min(1),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		const role = ctx.context.session?.user?.role;
		if (!userId || role !== "admin") {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.doordash as DoordashController;
		const quote = await controller.requestQuote({
			pickupAddress: ctx.body.pickupAddress,
			pickupBusinessName: ctx.body.pickupBusinessName,
			pickupPhoneNumber: ctx.body.pickupPhoneNumber,
			dropoffAddress: ctx.body.dropoffAddress,
			dropoffBusinessName: ctx.body.dropoffBusinessName,
			dropoffPhoneNumber: ctx.body.dropoffPhoneNumber,
			orderValue: ctx.body.orderValue,
		});
		return { quote };
	},
);
