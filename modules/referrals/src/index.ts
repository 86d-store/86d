import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { referralsStorage } from "./schema";
import { createReferralController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Referral,
	ReferralCode,
	ReferralController,
	ReferralRewardRule,
	ReferralStats,
	ReferralStatus,
	RewardType,
} from "./service";

export interface ReferralsOptions extends ModuleConfig {
	/** Max referral codes per customer (default: "1") */
	maxCodesPerCustomer?: string;
}

export default function referrals(options?: ReferralsOptions): Module {
	return {
		id: "referrals",
		version: "0.0.1",
		storage: referralsStorage,
		exports: {
			read: ["referralCode", "referralStatus"],
		},
		events: {
			emits: [
				"referrals.code_created",
				"referrals.referral_created",
				"referrals.referral_completed",
				"referrals.reward_granted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createReferralController(ctx.data);

			ctx.events?.on("checkout.completed", async (event) => {
				const p = event.payload as {
					customerId?: string | undefined;
					orderId: string;
				};
				if (!p?.customerId) return;

				const pending = await controller
					.listReferrals({
						refereeCustomerId: p.customerId,
						status: "pending",
						take: 1,
					})
					.catch(() => []);

				for (const referral of pending) {
					const completed = await controller
						.completeReferral(referral.id)
						.catch(() => null);
					if (!completed || !ctx.events) continue;

					// Emit reward events so store-credits and other modules can grant rewards
					const rules = await controller
						.listRewardRules({ active: true })
						.catch(() => []);
					const rule = rules[0];
					if (rule) {
						void ctx.events.emit("referrals.referral_completed", {
							referralId: completed.id,
							customerId: completed.referrerCustomerId,
							rewardType: rule.referrerRewardType,
							rewardAmount: rule.referrerRewardValue,
						});
						void ctx.events.emit("referrals.referral_completed", {
							referralId: completed.id,
							customerId: completed.refereeCustomerId,
							rewardType: rule.refereeRewardType,
							rewardAmount: rule.refereeRewardValue,
						});
					}
				}
			});

			return { controllers: { referrals: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/referrals",
					component: "ReferralList",
					label: "Referrals",
					icon: "UserPlus",
					group: "Customers",
				},
				{
					path: "/admin/referrals/codes",
					component: "CodeList",
					label: "Codes",
					icon: "Tag",
					group: "Customers",
				},
				{
					path: "/admin/referrals/rules",
					component: "RewardRules",
					label: "Reward Rules",
					icon: "Gift",
					group: "Customers",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/referrals",
					component: "ReferralDashboard",
				},
			],
		},
		options,
	};
}
