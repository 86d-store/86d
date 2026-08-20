import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AddTipParams,
	CreatePayoutParams,
	SplitEntry,
	Tip,
	TipPayout,
	TippingController,
	TipSettings,
	TipStats,
	UpdateTipParams,
} from "./service";

const DEFAULT_SETTINGS_ID = "default";

export function createTippingController(
	data: ModuleDataService,
): TippingController {
	return {
		async addTip(params: AddTipParams): Promise<Tip> {
			const id = crypto.randomUUID();
			const now = new Date();
			const settings = await this.getSettings();

			const tip: Tip = {
				id,
				orderId: params.orderId,
				amount: params.amount,
				percentage: params.percentage,
				type: params.type,
				recipientType:
					params.recipientType ??
					(settings.defaultRecipientType as Tip["recipientType"]),
				recipientId: params.recipientId,
				customerId: params.customerId,
				status: "pending",
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("tip", id, tip as Record<string, unknown>);
			return tip;
		},

		async updateTip(id: string, params: UpdateTipParams): Promise<Tip | null> {
			const raw = await data.get("tip", id);
			if (!raw) return null;

			const tip = raw as unknown as Tip;
			const updated: Tip = {
				...tip,
				...(params.amount !== undefined ? { amount: params.amount } : {}),
				...(params.percentage !== undefined
					? { percentage: params.percentage }
					: {}),
				...(params.recipientType !== undefined
					? { recipientType: params.recipientType }
					: {}),
				...(params.recipientId !== undefined
					? { recipientId: params.recipientId }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.status === "paid" ? { paidAt: new Date() } : {}),
				updatedAt: new Date(),
			};

			await data.upsert("tip", id, updated as Record<string, unknown>);
			return updated;
		},

		async removeTip(id: string): Promise<boolean> {
			const raw = await data.get("tip", id);
			if (!raw) return false;
			await data.delete("tip", id);
			return true;
		},

		async getTip(id: string): Promise<Tip | null> {
			const raw = await data.get("tip", id);
			if (!raw) return null;
			return raw as unknown as Tip;
		},

		async listTips(params): Promise<Tip[]> {
			const where: Record<string, unknown> = {};
			if (params?.orderId) where.orderId = params.orderId;
			if (params?.recipientId) where.recipientId = params.recipientId;
			if (params?.status) where.status = params.status;

			const results = await data.findMany("tip", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Tip[];
		},

		async splitTip(id: string, splits: SplitEntry[]): Promise<Tip[]> {
			const raw = await data.get("tip", id);
			if (!raw) return [];

			const original = raw as unknown as Tip;

			// Remove the original tip
			await data.delete("tip", id);

			const newTips: Tip[] = [];
			for (const split of splits) {
				const splitId = crypto.randomUUID();
				const now = new Date();

				const tip: Tip = {
					id: splitId,
					orderId: original.orderId,
					amount: split.amount,
					type: original.type,
					recipientType: split.recipientType,
					recipientId: split.recipientId,
					customerId: original.customerId,
					status: "pending",
					metadata: {
						...original.metadata,
						splitFrom: id,
					},
					createdAt: now,
					updatedAt: now,
				};

				await data.upsert("tip", splitId, tip as Record<string, unknown>);
				newTips.push(tip);
			}

			return newTips;
		},

		async getTipTotal(orderId: string): Promise<number> {
			const tips = await this.listTips({ orderId });
			let total = 0;
			for (const tip of tips) {
				if (tip.status !== "refunded") {
					total += tip.amount;
				}
			}
			return total;
		},

		async createPayout(params: CreatePayoutParams): Promise<TipPayout> {
			const id = crypto.randomUUID();
			const now = new Date();

			const payout: TipPayout = {
				id,
				recipientId: params.recipientId,
				recipientType: params.recipientType,
				amount: params.amount,
				tipCount: params.tipCount,
				periodStart: params.periodStart,
				periodEnd: params.periodEnd,
				status: "pending",
				reference: params.reference,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("tipPayout", id, payout as Record<string, unknown>);
			return payout;
		},

		async getPayout(id: string): Promise<TipPayout | null> {
			const raw = await data.get("tipPayout", id);
			if (!raw) return null;
			return raw as unknown as TipPayout;
		},

		async listPayouts(params): Promise<TipPayout[]> {
			const where: Record<string, unknown> = {};
			if (params?.recipientId) where.recipientId = params.recipientId;
			if (params?.status) where.status = params.status;

			const results = await data.findMany("tipPayout", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as TipPayout[];
		},

		async getSettings(): Promise<TipSettings> {
			const raw = await data.get("tipSettings", DEFAULT_SETTINGS_ID);
			if (raw) {
				return raw as unknown as TipSettings;
			}

			// Return defaults
			const defaults: TipSettings = {
				id: DEFAULT_SETTINGS_ID,
				presetPercents: [15, 18, 20, 25],
				allowCustom: true,
				maxPercent: 100,
				maxAmount: 1000,
				enableSplitting: false,
				defaultRecipientType: "store",
				updatedAt: new Date(),
			};

			await data.upsert(
				"tipSettings",
				DEFAULT_SETTINGS_ID,
				defaults as Record<string, unknown>,
			);
			return defaults;
		},

		async updateSettings(params): Promise<TipSettings> {
			const current = await this.getSettings();
			const updated: TipSettings = {
				...current,
				...(params.presetPercents !== undefined
					? { presetPercents: params.presetPercents }
					: {}),
				...(params.allowCustom !== undefined
					? { allowCustom: params.allowCustom }
					: {}),
				...(params.maxPercent !== undefined
					? { maxPercent: params.maxPercent }
					: {}),
				...(params.maxAmount !== undefined
					? { maxAmount: params.maxAmount }
					: {}),
				...(params.enableSplitting !== undefined
					? { enableSplitting: params.enableSplitting }
					: {}),
				...(params.defaultRecipientType !== undefined
					? { defaultRecipientType: params.defaultRecipientType }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"tipSettings",
				DEFAULT_SETTINGS_ID,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async getTipStats(params): Promise<TipStats> {
			const allTips = (await data.findMany("tip", {})) as unknown as Tip[];
			const allPayouts = (await data.findMany(
				"tipPayout",
				{},
			)) as unknown as TipPayout[];

			let totalAmount = 0;
			let totalPending = 0;
			let totalPaid = 0;
			let totalRefunded = 0;
			let filteredCount = 0;

			for (const tip of allTips) {
				// Apply date range filter if provided
				if (params?.startDate && tip.createdAt < params.startDate) continue;
				if (params?.endDate && tip.createdAt > params.endDate) continue;

				filteredCount++;
				totalAmount += tip.amount;

				switch (tip.status) {
					case "pending":
						totalPending++;
						break;
					case "paid":
						totalPaid++;
						break;
					case "refunded":
						totalRefunded++;
						break;
				}
			}

			let totalPayoutAmount = 0;
			for (const payout of allPayouts) {
				totalPayoutAmount += payout.amount;
			}

			return {
				totalTips: filteredCount,
				totalAmount,
				totalPending,
				totalPaid,
				totalRefunded,
				averageTip: filteredCount > 0 ? totalAmount / filteredCount : 0,
				totalPayouts: allPayouts.length,
				totalPayoutAmount,
			};
		},
	};
}
