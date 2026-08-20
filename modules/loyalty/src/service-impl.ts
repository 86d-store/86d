import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	LoyaltyAccount,
	LoyaltyController,
	LoyaltyRule,
	LoyaltyTier,
	LoyaltyTierSlug,
	LoyaltyTransaction,
} from "./service";

const DEFAULT_TIERS: Array<{ slug: LoyaltyTierSlug; minPoints: number }> = [
	{ slug: "bronze", minPoints: 0 },
	{ slug: "silver", minPoints: 500 },
	{ slug: "gold", minPoints: 2000 },
	{ slug: "platinum", minPoints: 5000 },
];

function computeTier(
	lifetimeEarned: number,
	tiers: Array<{ slug: string; minPoints: number }>,
): LoyaltyTierSlug {
	const sorted = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
	for (const tier of sorted) {
		if (lifetimeEarned >= tier.minPoints) {
			return tier.slug as LoyaltyTierSlug;
		}
	}
	return "bronze";
}

export function createLoyaltyController(
	data: ModuleDataService,
): LoyaltyController {
	async function getTierThresholds(): Promise<
		Array<{ slug: string; minPoints: number }>
	> {
		const tiers = (await data.findMany("loyaltyTier", {
			orderBy: { sortOrder: "asc" },
		})) as unknown as LoyaltyTier[];
		if (tiers.length === 0) return DEFAULT_TIERS;
		return tiers.map((t) => ({ slug: t.slug, minPoints: t.minPoints }));
	}

	async function recalcTier(account: LoyaltyAccount): Promise<LoyaltyAccount> {
		const thresholds = await getTierThresholds();
		const newTier = computeTier(account.lifetimeEarned, thresholds);
		if (newTier !== account.tier) {
			const updated = { ...account, tier: newTier, updatedAt: new Date() };
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);
			return updated;
		}
		return account;
	}

	return {
		// ── Account operations ────────────────────────────────────────

		async getOrCreateAccount(customerId) {
			const existing = await data.findMany("loyaltyAccount", {
				where: { customerId },
				take: 1,
			});
			const accounts = existing as unknown as LoyaltyAccount[];
			if (accounts.length > 0) return accounts[0];

			const id = crypto.randomUUID();
			const account: LoyaltyAccount = {
				id,
				customerId,
				balance: 0,
				lifetimeEarned: 0,
				lifetimeRedeemed: 0,
				tier: "bronze",
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				id,
				account as Record<string, unknown>,
			);
			return account;
		},

		async getAccount(customerId) {
			const existing = await data.findMany("loyaltyAccount", {
				where: { customerId },
				take: 1,
			});
			const accounts = existing as unknown as LoyaltyAccount[];
			return accounts.length > 0 ? accounts[0] : null;
		},

		async getAccountById(id) {
			const raw = await data.get("loyaltyAccount", id);
			if (!raw) return null;
			return raw as unknown as LoyaltyAccount;
		},

		async suspendAccount(customerId) {
			const account = await this.getOrCreateAccount(customerId);
			const updated = {
				...account,
				status: "suspended" as const,
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async reactivateAccount(customerId) {
			const account = await this.getOrCreateAccount(customerId);
			const updated = {
				...account,
				status: "active" as const,
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ── Points operations ─────────────────────────────────────────

		async earnPoints(params) {
			const account = await this.getOrCreateAccount(params.customerId);
			if (account.status !== "active") {
				throw new Error("Cannot earn points on a non-active account");
			}

			const ledgerKey = params.orderId
				? `${account.id}:${params.orderId}:earn`
				: undefined;
			if (ledgerKey) {
				const existing = (await data.findMany("loyaltyTransaction", {
					where: { ledgerKey },
					take: 1,
				})) as LoyaltyTransaction[];
				if (existing[0]) return existing[0];
			}

			const updated: LoyaltyAccount = {
				...account,
				balance: account.balance + params.points,
				lifetimeEarned: account.lifetimeEarned + params.points,
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);

			const txnId = crypto.randomUUID();
			const txn: LoyaltyTransaction = {
				id: txnId,
				accountId: account.id,
				type: "earn",
				points: params.points,
				description: params.description,
				orderId: params.orderId,
				...(ledgerKey ? { ledgerKey } : {}),
				createdAt: new Date(),
			};
			await data.upsert(
				"loyaltyTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			await recalcTier(updated);
			return txn;
		},

		async redeemPoints(params) {
			const account = await this.getOrCreateAccount(params.customerId);
			if (account.status !== "active") {
				throw new Error("Cannot redeem points on a non-active account");
			}

			const ledgerKey = params.orderId
				? `${account.id}:${params.orderId}:redeem`
				: undefined;
			if (ledgerKey) {
				const existing = (await data.findMany("loyaltyTransaction", {
					where: { ledgerKey },
					take: 1,
				})) as LoyaltyTransaction[];
				if (existing[0]) return existing[0];
			}

			if (account.balance < params.points) {
				throw new Error("Insufficient points balance");
			}

			const updated: LoyaltyAccount = {
				...account,
				balance: account.balance - params.points,
				lifetimeRedeemed: account.lifetimeRedeemed + params.points,
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);

			const txnId = crypto.randomUUID();
			const txn: LoyaltyTransaction = {
				id: txnId,
				accountId: account.id,
				type: "redeem",
				points: params.points,
				description: params.description,
				orderId: params.orderId,
				...(ledgerKey ? { ledgerKey } : {}),
				createdAt: new Date(),
			};
			await data.upsert(
				"loyaltyTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			return txn;
		},

		async adjustPoints(params) {
			const account = await this.getOrCreateAccount(params.customerId);

			const newBalance = account.balance + params.points;
			const updated: LoyaltyAccount = {
				...account,
				balance: newBalance,
				...(params.points > 0
					? { lifetimeEarned: account.lifetimeEarned + params.points }
					: {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"loyaltyAccount",
				account.id,
				updated as Record<string, unknown>,
			);

			const txnId = crypto.randomUUID();
			const txn: LoyaltyTransaction = {
				id: txnId,
				accountId: account.id,
				type: "adjust",
				points: params.points,
				description: params.description,
				createdAt: new Date(),
			};
			await data.upsert(
				"loyaltyTransaction",
				txnId,
				txn as Record<string, unknown>,
			);

			if (params.points > 0) {
				await recalcTier(updated);
			}
			return txn;
		},

		// ── Transaction history ───────────────────────────────────────

		async listTransactions(accountId, params) {
			const where: Record<string, unknown> = { accountId };
			if (params?.type) where.type = params.type;

			const all = await data.findMany("loyaltyTransaction", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as LoyaltyTransaction[];
		},

		// ── Rules ─────────────────────────────────────────────────────

		async createRule(params) {
			const id = crypto.randomUUID();
			const rule: LoyaltyRule = {
				id,
				name: params.name,
				type: params.type,
				points: params.points,
				minOrderAmount: params.minOrderAmount,
				active: true,
				createdAt: new Date(),
			};
			await data.upsert("loyaltyRule", id, rule as Record<string, unknown>);
			return rule;
		},

		async updateRule(id, params) {
			const raw = await data.get("loyaltyRule", id);
			if (!raw) return null;
			const existing = raw as unknown as LoyaltyRule;
			const updated = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.points !== undefined ? { points: params.points } : {}),
				...(params.minOrderAmount !== undefined
					? { minOrderAmount: params.minOrderAmount }
					: {}),
				...(params.active !== undefined ? { active: params.active } : {}),
			};
			await data.upsert("loyaltyRule", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteRule(id) {
			const raw = await data.get("loyaltyRule", id);
			if (!raw) return false;
			await data.delete("loyaltyRule", id);
			return true;
		},

		async listRules(activeOnly) {
			const options = activeOnly ? { where: { active: true } } : {};
			const all = await data.findMany("loyaltyRule", options);
			return all as unknown as LoyaltyRule[];
		},

		async calculateOrderPoints(orderAmount) {
			const rules = await this.listRules(true);
			let totalPoints = 0;

			for (const rule of rules) {
				if (
					rule.minOrderAmount !== undefined &&
					rule.minOrderAmount !== null &&
					orderAmount < rule.minOrderAmount
				) {
					continue;
				}
				switch (rule.type) {
					case "per_dollar":
						totalPoints += Math.floor(orderAmount * rule.points);
						break;
					case "fixed_bonus":
						totalPoints += rule.points;
						break;
					case "multiplier":
						totalPoints = Math.floor(totalPoints * rule.points);
						break;
				}
			}

			return totalPoints;
		},

		// ── Tiers ─────────────────────────────────────────────────────

		async listTiers() {
			const all = await data.findMany("loyaltyTier", {
				orderBy: { sortOrder: "asc" },
			});
			return all as unknown as LoyaltyTier[];
		},

		async getTier(slug) {
			const found = await data.findMany("loyaltyTier", {
				where: { slug },
				take: 1,
			});
			const tiers = found as unknown as LoyaltyTier[];
			return tiers.length > 0 ? tiers[0] : null;
		},

		async createTier(params) {
			const id = crypto.randomUUID();
			const existing = await this.listTiers();
			const tier: LoyaltyTier = {
				id,
				name: params.name,
				slug: params.slug,
				minPoints: params.minPoints,
				multiplier: params.multiplier ?? 1,
				perks: params.perks,
				sortOrder: existing.length,
			};
			await data.upsert("loyaltyTier", id, tier as Record<string, unknown>);
			return tier;
		},

		async updateTier(id, params) {
			const raw = await data.get("loyaltyTier", id);
			if (!raw) return null;
			const existing = raw as unknown as LoyaltyTier;
			const updated = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.minPoints !== undefined
					? { minPoints: params.minPoints }
					: {}),
				...(params.multiplier !== undefined
					? { multiplier: params.multiplier }
					: {}),
				...(params.perks !== undefined ? { perks: params.perks } : {}),
			};
			await data.upsert("loyaltyTier", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteTier(id) {
			const raw = await data.get("loyaltyTier", id);
			if (!raw) return false;
			await data.delete("loyaltyTier", id);
			return true;
		},

		// ── Admin ─────────────────────────────────────────────────────

		async listAccounts(params) {
			const where: Record<string, unknown> = {};
			if (params?.tier) where.tier = params.tier;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("loyaltyAccount", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as LoyaltyAccount[];
		},

		async getSummary() {
			const all = await data.findMany("loyaltyAccount", {});
			const accounts = all as unknown as LoyaltyAccount[];

			const tierCounts = new Map<LoyaltyTierSlug, number>();
			let totalOutstanding = 0;
			let totalLifetime = 0;

			for (const account of accounts) {
				totalOutstanding += account.balance;
				totalLifetime += account.lifetimeEarned;
				tierCounts.set(account.tier, (tierCounts.get(account.tier) ?? 0) + 1);
			}

			const tierBreakdown = Array.from(tierCounts.entries()).map(
				([tier, count]) => ({ tier, count }),
			);

			return {
				totalAccounts: accounts.length,
				totalPointsOutstanding: totalOutstanding,
				totalLifetimeEarned: totalLifetime,
				tierBreakdown,
			};
		},
	};
}
