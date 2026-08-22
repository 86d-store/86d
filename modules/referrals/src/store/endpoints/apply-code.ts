import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ReferralController } from "../../service";

export const applyCodeEndpoint = createStoreEndpoint(
	"/referrals/apply",
	{
		method: "POST",
		body: z.object({
			code: z.string().max(20).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers.referrals as ReferralController;

		const codeRecord = await controller.getCodeByCode(
			ctx.body.code.toUpperCase(),
		);
		if (!codeRecord) return { error: "Invalid referral code", status: 404 };
		if (!codeRecord.active) {
			return { error: "This code is no longer active", status: 422 };
		}
		if (codeRecord.customerId === customerId) {
			return { error: "You cannot use your own referral code", status: 422 };
		}

		const referral = await controller.createReferral({
			referralCodeId: codeRecord.id,
			refereeCustomerId: customerId,
			refereeEmail: ctx.context.session?.user.email ?? "",
		});

		if (!referral)
			return { error: "Unable to apply referral code", status: 422 };
		return { referral };
	},
);
