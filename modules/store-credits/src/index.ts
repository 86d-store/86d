import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { storeCreditCheckoutProvider } from "./capabilities";
import { storeCreditsSchema } from "./schema";
import { createStoreCreditController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AccountStatus,
	CreditAccount,
	CreditParams,
	CreditReason,
	CreditSummary,
	CreditTransaction,
	CreditTransactionType,
	DebitParams,
	StoreCreditController,
} from "./service";

export interface StoreCreditsOptions extends ModuleConfig {
	/**
	 * Default currency for new credit accounts.
	 * @default "USD"
	 */
	currency?: string;
}

/**
 * Store credits module factory function.
 * Provides customer credit accounts that integrate with returns, referrals, and gift cards.
 *
 * Listens for:
 * - `return.refunded` — auto-credits the customer when a return is refunded as store credit
 * - `referrals.referral_completed` — auto-credits referral rewards issued as store credit
 *
 * Other modules can debit credits during checkout via the StoreCreditController.
 */
export default function storeCredits(options?: StoreCreditsOptions): Module {
	return {
		id: "store-credits",
		version: "0.0.1",
		schema: storeCreditsSchema,
		capabilities: { provides: [storeCreditCheckoutProvider] },
		exports: {
			read: ["creditBalance", "creditAccountStatus"],
		},
		events: {
			emits: [
				"store-credits.credited",
				"store-credits.debited",
				"store-credits.account.frozen",
				"store-credits.account.unfrozen",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createStoreCreditController(ctx.data);

			interface ReturnRefundedPayload {
				type?: string;
				customerId?: string;
				refundAmount?: number;
				returnRequestId?: string;
			}

			interface ReferralCompletedPayload {
				rewardType?: string;
				customerId?: string;
				rewardAmount?: number;
				referralId?: string;
			}

			// Auto-credit when a return is refunded as store_credit
			ctx.events?.on<ReturnRefundedPayload>(
				"return.refunded",
				async (event) => {
					if (event.payload?.type !== "store_credit") return;

					const customerId = event.payload?.customerId;
					const amount = event.payload?.refundAmount;
					const returnId = event.payload?.returnRequestId;

					if (!customerId || !amount || amount <= 0) return;

					await controller.credit({
						customerId,
						amount,
						reason: "return_refund",
						description: `Store credit from return ${returnId ?? ""}`.trim(),
						referenceType: "return",
						referenceId: returnId,
					});
				},
			);

			// Auto-credit when a referral reward is issued as store_credit
			ctx.events?.on<ReferralCompletedPayload>(
				"referrals.referral_completed",
				async (event) => {
					if (event.payload?.rewardType !== "store_credit") return;

					const customerId = event.payload?.customerId;
					const amount = event.payload?.rewardAmount;
					const referralId = event.payload?.referralId;

					if (!customerId || !amount || amount <= 0) return;

					await controller.credit({
						customerId,
						amount,
						reason: "referral_reward",
						description: `Referral reward ${referralId ?? ""}`.trim(),
						referenceType: "referral",
						referenceId: referralId,
					});
				},
			);

			return {
				controllers: { "store-credits": controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/store-credits",
					component: "StoreCreditsDashboard",
					label: "Store Credits",
					icon: "Wallet",
					group: "Customers",
				},
				{
					path: "/admin/store-credits/:customerId",
					component: "StoreCreditDetail",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/account/store-credits",
					component: "StoreCreditTransactions",
				},
			],
		},
		options,
	};
}
