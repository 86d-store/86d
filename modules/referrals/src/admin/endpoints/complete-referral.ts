import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReferralController } from "../../service";

export const completeReferralEndpoint = createAdminEndpoint(
	"/admin/referrals/:id/complete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const referral = await controller.completeReferral(ctx.params.id);
		if (!referral) return { error: "Cannot complete referral" };

		// Look up active reward rules and emit per-person reward events
		if (ctx.context.events) {
			const rules = await controller.listRewardRules({ active: true });
			const rule = rules[0];

			if (rule) {
				// Emit for referrer reward
				await ctx.context.events.emit("referrals.referral_completed", {
					referralId: referral.id,
					customerId: referral.referrerCustomerId,
					rewardType: rule.referrerRewardType,
					rewardAmount: rule.referrerRewardValue,
				});
				// Emit for referee reward
				await ctx.context.events.emit("referrals.referral_completed", {
					referralId: referral.id,
					customerId: referral.refereeCustomerId,
					rewardType: rule.refereeRewardType,
					rewardAmount: rule.refereeRewardValue,
				});
			}
		}

		return { referral };
	},
);
