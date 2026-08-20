import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AffiliateController } from "../../service";

export const applyEndpoint = createStoreEndpoint(
	"/affiliates/apply",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			email: z.string().email().max(320),
			website: z.string().url().max(500).optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;

		// Authenticated users must use session email to prevent identity hijacking
		const email = ctx.context.session
			? ctx.context.session.user.email
			: ctx.body.email;

		// Check if already applied
		const existing = await controller.getAffiliateByEmail(email);
		if (existing)
			return {
				error: "An application with this email already exists",
				status: 409,
			};

		const affiliate = await controller.apply({
			name: ctx.body.name,
			email,
			website: ctx.body.website,
			customerId,
			notes: ctx.body.notes,
		});
		void ctx.context.events?.emit("affiliates.application_submitted", {
			affiliateId: affiliate.id,
			email: affiliate.email,
			name: affiliate.name,
			customerId: affiliate.customerId,
		});
		return { affiliate };
	},
);
