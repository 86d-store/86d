import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const submitClaim = createStoreEndpoint(
	"/warranties/claims/submit",
	{
		method: "POST",
		body: z.object({
			warrantyRegistrationId: z.string().max(200),
			issueType: z.enum([
				"defect",
				"malfunction",
				"accidental_damage",
				"wear_and_tear",
				"missing_parts",
				"other",
			]),
			issueDescription: z.string().min(10).max(2000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claim = await controller.submitClaim({
			warrantyRegistrationId: ctx.body.warrantyRegistrationId,
			customerId: userId,
			customerEmail: ctx.context.session?.user.email,
			issueType: ctx.body.issueType,
			issueDescription: ctx.body.issueDescription,
		});

		void ctx.context.events?.emit("claim.submitted", {
			claimId: claim.id,
			customerId: userId,
			warrantyRegistrationId: claim.warrantyRegistrationId,
			issueType: claim.issueType,
		});
		return { claim };
	},
);
