import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	BulkPricingController,
	BulkPricingSummary,
	CreateRuleParams,
	CreateTierParams,
	DiscountType,
	ListRulesParams,
	ListTiersParams,
	PricingRule,
	PricingScope,
	PricingTier,
	ResolvedBulkPrice,
	ResolvePriceParams,
	TierPreview,
	UpdateRuleParams,
	UpdateTierParams,
} from "./service";

const VALID_SCOPES: PricingScope[] = [
	"product",
	"variant",
	"collection",
	"global",
];
const VALID_DISCOUNT_TYPES: DiscountType[] = [
	"percentage",
	"fixed_amount",
	"fixed_price",
];

function validateDiscountValue(type: DiscountType, value: number): void {
	if (value < 0) {
		throw new Error("Discount value must be non-negative");
	}
	if (type === "percentage" && value > 100) {
		throw new Error("Percentage discount cannot exceed 100");
	}
}

function applyDiscount(
	basePrice: number,
	type: DiscountType,
	value: number,
): number {
	switch (type) {
		case "percentage":
			return Math.max(0, basePrice * (1 - value / 100));
		case "fixed_amount":
			return Math.max(0, basePrice - value);
		case "fixed_price":
			return Math.max(0, value);
	}
}

export function createBulkPricingController(
	data: ModuleDataService,
): BulkPricingController {
	async function getRuleRecord(id: string): Promise<PricingRule | null> {
		const raw = await data.get("pricingRule", id);
		return raw ? (raw as unknown as PricingRule) : null;
	}

	async function getTierRecord(id: string): Promise<PricingTier | null> {
		const raw = await data.get("pricingTier", id);
		return raw ? (raw as unknown as PricingTier) : null;
	}

	/** Check whether a rule is currently within its scheduled date window */
	function isRuleActive(rule: PricingRule, now: Date): boolean {
		if (!rule.active) return false;
		if (rule.startsAt && now < rule.startsAt) return false;
		if (rule.endsAt && now > rule.endsAt) return false;
		return true;
	}

	return {
		// ── Rule CRUD ─────────────────────────────────────────────

		async createRule(params: CreateRuleParams): Promise<PricingRule> {
			if (!params.name.trim()) {
				throw new Error("Rule name is required");
			}
			if (!VALID_SCOPES.includes(params.scope)) {
				throw new Error(`Invalid scope: ${params.scope}`);
			}
			if (params.scope !== "global" && !params.targetId?.trim()) {
				throw new Error("Target ID is required for non-global scope");
			}
			if (params.scope === "global" && params.targetId) {
				throw new Error("Global scope rules must not have a target ID");
			}
			if (params.priority !== undefined && !Number.isInteger(params.priority)) {
				throw new Error("Priority must be an integer");
			}
			if (
				params.startsAt &&
				params.endsAt &&
				params.startsAt >= params.endsAt
			) {
				throw new Error("Start date must be before end date");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const rule: PricingRule = {
				id,
				name: params.name.trim(),
				scope: params.scope,
				priority: params.priority ?? 0,
				active: params.active ?? true,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.targetId != null && { targetId: params.targetId.trim() }),
				...(params.startsAt != null && { startsAt: params.startsAt }),
				...(params.endsAt != null && { endsAt: params.endsAt }),
			};

			await data.upsert(
				"pricingRule",
				id,
				rule as unknown as Record<string, unknown>,
			);
			return rule;
		},

		async updateRule(
			id: string,
			params: UpdateRuleParams,
		): Promise<PricingRule | null> {
			const existing = await getRuleRecord(id);
			if (!existing) return null;

			if (params.name !== undefined && !params.name.trim()) {
				throw new Error("Rule name cannot be empty");
			}
			if (params.scope !== undefined && !VALID_SCOPES.includes(params.scope)) {
				throw new Error(`Invalid scope: ${params.scope}`);
			}
			if (params.priority !== undefined && !Number.isInteger(params.priority)) {
				throw new Error("Priority must be an integer");
			}

			const newScope = params.scope ?? existing.scope;
			const newTargetId =
				params.targetId !== undefined ? params.targetId : existing.targetId;
			if (newScope !== "global" && !newTargetId?.trim()) {
				throw new Error("Target ID is required for non-global scope");
			}
			if (newScope === "global" && newTargetId) {
				throw new Error("Global scope rules must not have a target ID");
			}

			const newStartsAt =
				params.startsAt === null
					? undefined
					: (params.startsAt ?? existing.startsAt);
			const newEndsAt =
				params.endsAt === null ? undefined : (params.endsAt ?? existing.endsAt);
			if (newStartsAt && newEndsAt && newStartsAt >= newEndsAt) {
				throw new Error("Start date must be before end date");
			}

			const updates: Record<string, unknown> = {};
			if (params.name !== undefined) updates.name = params.name.trim();
			if (params.description !== undefined)
				updates.description = params.description;
			if (params.scope !== undefined) updates.scope = params.scope;
			if (params.targetId !== undefined) updates.targetId = params.targetId;
			if (params.priority !== undefined) updates.priority = params.priority;
			if (params.active !== undefined) updates.active = params.active;
			if (params.startsAt !== undefined)
				updates.startsAt = params.startsAt ?? undefined;
			if (params.endsAt !== undefined)
				updates.endsAt = params.endsAt ?? undefined;

			const updated = {
				...(existing as unknown as Record<string, unknown>),
				...updates,
				updatedAt: new Date(),
			};
			await data.upsert("pricingRule", id, updated);
			return updated as unknown as PricingRule;
		},

		async getRule(id: string): Promise<PricingRule | null> {
			return getRuleRecord(id);
		},

		async listRules(params?: ListRulesParams): Promise<PricingRule[]> {
			const where: Record<string, unknown> = {};
			if (params?.scope !== undefined) where.scope = params.scope;
			if (params?.targetId !== undefined) where.targetId = params.targetId;
			if (params?.active !== undefined) where.active = params.active;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { priority: "desc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("pricingRule", query);
			const rules = raw as unknown as PricingRule[];
			rules.sort((a, b) => b.priority - a.priority);
			return rules;
		},

		async deleteRule(id: string): Promise<boolean> {
			const existing = await data.get("pricingRule", id);
			if (!existing) return false;
			await data.delete("pricingRule", id);
			return true;
		},

		// ── Tier CRUD ─────────────────────────────────────────────

		async createTier(params: CreateTierParams): Promise<PricingTier> {
			const rule = await getRuleRecord(params.ruleId);
			if (!rule) {
				throw new Error("Pricing rule not found");
			}

			if (!Number.isInteger(params.minQuantity) || params.minQuantity < 1) {
				throw new Error("Minimum quantity must be a positive integer");
			}
			if (params.maxQuantity !== undefined) {
				if (!Number.isInteger(params.maxQuantity) || params.maxQuantity < 1) {
					throw new Error("Maximum quantity must be a positive integer");
				}
				if (params.maxQuantity < params.minQuantity) {
					throw new Error(
						"Maximum quantity must be greater than or equal to minimum quantity",
					);
				}
			}
			if (!VALID_DISCOUNT_TYPES.includes(params.discountType)) {
				throw new Error(`Invalid discount type: ${params.discountType}`);
			}
			validateDiscountValue(params.discountType, params.discountValue);

			const id = crypto.randomUUID();
			const now = new Date();

			const tier: PricingTier = {
				id,
				ruleId: params.ruleId,
				minQuantity: params.minQuantity,
				discountType: params.discountType,
				discountValue: params.discountValue,
				createdAt: now,
				updatedAt: now,
				...(params.maxQuantity != null && {
					maxQuantity: params.maxQuantity,
				}),
				...(params.label != null && { label: params.label }),
			};

			await data.upsert(
				"pricingTier",
				id,
				tier as unknown as Record<string, unknown>,
			);
			return tier;
		},

		async updateTier(
			id: string,
			params: UpdateTierParams,
		): Promise<PricingTier | null> {
			const existing = await getTierRecord(id);
			if (!existing) return null;

			if (
				params.minQuantity !== undefined &&
				(!Number.isInteger(params.minQuantity) || params.minQuantity < 1)
			) {
				throw new Error("Minimum quantity must be a positive integer");
			}

			const effectiveMax =
				params.maxQuantity === null
					? undefined
					: (params.maxQuantity ?? existing.maxQuantity);
			const effectiveMin = params.minQuantity ?? existing.minQuantity;

			if (effectiveMax !== undefined) {
				if (!Number.isInteger(effectiveMax) || effectiveMax < 1) {
					throw new Error("Maximum quantity must be a positive integer");
				}
				if (effectiveMax < effectiveMin) {
					throw new Error(
						"Maximum quantity must be greater than or equal to minimum quantity",
					);
				}
			}

			if (
				params.discountType !== undefined &&
				!VALID_DISCOUNT_TYPES.includes(params.discountType)
			) {
				throw new Error(`Invalid discount type: ${params.discountType}`);
			}

			const effectiveType = params.discountType ?? existing.discountType;
			const effectiveValue = params.discountValue ?? existing.discountValue;
			if (
				params.discountType !== undefined ||
				params.discountValue !== undefined
			) {
				validateDiscountValue(effectiveType, effectiveValue);
			}

			const updates: Record<string, unknown> = {};
			if (params.minQuantity !== undefined)
				updates.minQuantity = params.minQuantity;
			if (params.maxQuantity !== undefined)
				updates.maxQuantity = params.maxQuantity ?? undefined;
			if (params.discountType !== undefined)
				updates.discountType = params.discountType;
			if (params.discountValue !== undefined)
				updates.discountValue = params.discountValue;
			if (params.label !== undefined) updates.label = params.label ?? undefined;

			const updated = {
				...(existing as unknown as Record<string, unknown>),
				...updates,
				updatedAt: new Date(),
			};
			await data.upsert("pricingTier", id, updated);
			return updated as unknown as PricingTier;
		},

		async getTier(id: string): Promise<PricingTier | null> {
			return getTierRecord(id);
		},

		async listTiers(params: ListTiersParams): Promise<PricingTier[]> {
			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where: { ruleId: params.ruleId },
				orderBy: { minQuantity: "asc" },
			};
			if (params.take != null) query.take = params.take;
			if (params.skip != null) query.skip = params.skip;

			const raw = await data.findMany("pricingTier", query);
			const tiers = raw as unknown as PricingTier[];
			tiers.sort((a, b) => a.minQuantity - b.minQuantity);
			return tiers;
		},

		async deleteTier(id: string): Promise<boolean> {
			const existing = await data.get("pricingTier", id);
			if (!existing) return false;
			await data.delete("pricingTier", id);
			return true;
		},

		// ── Price resolution ──────────────────────────────────────

		async resolvePrice(params: ResolvePriceParams): Promise<ResolvedBulkPrice> {
			if (params.quantity < 1 || !Number.isInteger(params.quantity)) {
				throw new Error("Quantity must be a positive integer");
			}
			if (params.basePrice < 0) {
				throw new Error("Base price must be non-negative");
			}

			const noDiscount: ResolvedBulkPrice = {
				basePrice: params.basePrice,
				unitPrice: params.basePrice,
				discountPerUnit: 0,
				totalPrice: params.basePrice * params.quantity,
				matchedTier: null,
				matchedRule: null,
				hasDiscount: false,
			};

			// Gather all potentially matching rules
			const allRules = (await data.findMany("pricingRule", {
				where: { active: true },
				orderBy: { priority: "desc" },
			})) as unknown as PricingRule[];
			allRules.sort((a, b) => b.priority - a.priority);

			const now = new Date();
			const candidateRules: PricingRule[] = [];

			for (const rule of allRules) {
				if (!isRuleActive(rule, now)) continue;

				switch (rule.scope) {
					case "global":
						candidateRules.push(rule);
						break;
					case "product":
						if (rule.targetId === params.productId) {
							candidateRules.push(rule);
						}
						break;
					case "variant":
						if (params.variantId && rule.targetId === params.variantId) {
							candidateRules.push(rule);
						}
						break;
					case "collection":
						if (params.collectionIds?.includes(rule.targetId ?? "")) {
							candidateRules.push(rule);
						}
						break;
				}
			}

			if (candidateRules.length === 0) return noDiscount;

			// Rules are already ordered by priority desc; find the first with a matching tier
			for (const rule of candidateRules) {
				const tiers = (await data.findMany("pricingTier", {
					where: { ruleId: rule.id },
					orderBy: { minQuantity: "desc" },
				})) as unknown as PricingTier[];
				tiers.sort((a, b) => b.minQuantity - a.minQuantity);

				// Find the best matching tier (highest minQuantity that the quantity meets)
				for (const tier of tiers) {
					if (params.quantity < tier.minQuantity) continue;
					if (
						tier.maxQuantity !== undefined &&
						params.quantity > tier.maxQuantity
					)
						continue;

					const unitPrice = applyDiscount(
						params.basePrice,
						tier.discountType,
						tier.discountValue,
					);

					return {
						basePrice: params.basePrice,
						unitPrice,
						discountPerUnit: params.basePrice - unitPrice,
						totalPrice: unitPrice * params.quantity,
						matchedTier: tier,
						matchedRule: rule,
						hasDiscount: unitPrice < params.basePrice,
					};
				}
			}

			return noDiscount;
		},

		async previewTiers(
			ruleId: string,
			basePrice: number,
		): Promise<TierPreview[]> {
			const rule = await getRuleRecord(ruleId);
			if (!rule) {
				throw new Error("Pricing rule not found");
			}
			if (basePrice < 0) {
				throw new Error("Base price must be non-negative");
			}

			const tiers = (await data.findMany("pricingTier", {
				where: { ruleId },
				orderBy: { minQuantity: "asc" },
			})) as unknown as PricingTier[];
			tiers.sort((a, b) => a.minQuantity - b.minQuantity);

			return tiers.map((tier) => {
				const unitPrice = applyDiscount(
					basePrice,
					tier.discountType,
					tier.discountValue,
				);
				const savingsPercent =
					basePrice > 0
						? Math.round(((basePrice - unitPrice) / basePrice) * 10000) / 100
						: 0;

				return { tier, unitPrice, savingsPercent };
			});
		},

		// ── Analytics ─────────────────────────────────────────────

		async getSummary(): Promise<BulkPricingSummary> {
			const allRules = (await data.findMany("pricingRule", {
				where: {},
			})) as unknown as PricingRule[];
			const allTiers = await data.findMany("pricingTier", {
				where: {},
			});

			const rulesByScope: Record<PricingScope, number> = {
				product: 0,
				variant: 0,
				collection: 0,
				global: 0,
			};
			for (const rule of allRules) {
				rulesByScope[rule.scope]++;
			}

			return {
				totalRules: allRules.length,
				activeRules: allRules.filter((r) => r.active).length,
				totalTiers: allTiers.length,
				rulesByScope,
			};
		},
	};
}
