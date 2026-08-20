import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ApplyResult,
	BulkCodeResult,
	CartAutoDiscountResult,
	CartPriceRule,
	CartPriceRuleApplyResult,
	CartPriceRuleCondition,
	CodeStats,
	Discount,
	DiscountAnalytics,
	DiscountCode,
	DiscountController,
	DiscountSummary,
} from "./service";

function calculateDiscountAmount(discount: Discount, subtotal: number): number {
	switch (discount.type) {
		case "percentage":
			return Math.min(
				Math.round((subtotal * Math.min(discount.value, 100)) / 100),
				subtotal,
			);
		case "fixed_amount":
			return Math.min(discount.value, subtotal);
		case "free_shipping":
			return 0; // Handled via freeShipping flag
		default:
			return 0;
	}
}

function isDiscountActive(discount: Discount): boolean {
	if (!discount.isActive) return false;
	const now = new Date();
	if (discount.startsAt && new Date(discount.startsAt) > now) return false;
	if (discount.endsAt && new Date(discount.endsAt) < now) return false;
	if (
		discount.maximumUses !== undefined &&
		discount.maximumUses !== null &&
		discount.usedCount >= discount.maximumUses
	)
		return false;
	return true;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRandomCode(length: number): string {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
	}
	return result;
}

function appliesToItems(
	discount: Pick<Discount, "appliesTo" | "appliesToIds">,
	productIds: string[],
	categoryIds: string[],
): boolean {
	if (discount.appliesTo === "all") return true;
	if (discount.appliesTo === "specific_products") {
		return productIds.some((id) => discount.appliesToIds.includes(id));
	}
	if (discount.appliesTo === "specific_categories") {
		return categoryIds.some((id) => discount.appliesToIds.includes(id));
	}
	return false;
}

function isPriceRuleActive(rule: CartPriceRule): boolean {
	if (!rule.isActive) return false;
	const now = new Date();
	if (rule.startsAt && new Date(rule.startsAt) > now) return false;
	if (rule.endsAt && new Date(rule.endsAt) < now) return false;
	if (
		rule.maximumUses !== undefined &&
		rule.maximumUses !== null &&
		rule.usedCount >= rule.maximumUses
	)
		return false;
	return true;
}

function calculateRuleAmount(
	type: string,
	value: number,
	subtotal: number,
): number {
	switch (type) {
		case "percentage":
			return Math.min(
				Math.round((subtotal * Math.min(value, 100)) / 100),
				subtotal,
			);
		case "fixed_amount":
			return Math.min(value, subtotal);
		case "free_shipping":
			return 0;
		default:
			return 0;
	}
}

function evaluateConditions(
	conditions: CartPriceRuleCondition[],
	context: {
		subtotal: number;
		itemCount: number;
		productIds: string[];
		categoryIds: string[];
	},
): boolean {
	return conditions.every((cond) => {
		switch (cond.type) {
			case "minimum_subtotal":
				return context.subtotal >= Number(cond.value);
			case "minimum_item_count":
				return context.itemCount >= Number(cond.value);
			case "contains_product":
				return context.productIds.includes(String(cond.value));
			case "contains_category":
				return context.categoryIds.includes(String(cond.value));
			default:
				return false;
		}
	});
}

export function createDiscountController(
	data: ModuleDataService,
): DiscountController {
	return {
		async create(params): Promise<Discount> {
			const id = params.id ?? crypto.randomUUID();
			const now = new Date();
			const discount: Discount = {
				id,
				name: params.name,
				description: params.description,
				type: params.type,
				value: params.value,
				minimumAmount: params.minimumAmount,
				maximumUses: params.maximumUses,
				usedCount: 0,
				isActive: params.isActive ?? true,
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				appliesTo: params.appliesTo ?? "all",
				appliesToIds: params.appliesToIds ?? [],
				stackable: params.stackable ?? false,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("discount", id, discount as Record<string, unknown>);
			return discount;
		},

		async getById(id: string): Promise<Discount | null> {
			return (await data.get("discount", id)) as Discount | null;
		},

		async update(id: string, params): Promise<Discount | null> {
			const existing = (await data.get("discount", id)) as Discount | null;
			if (!existing) return null;

			const updated: Discount = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.value !== undefined ? { value: params.value } : {}),
				...(params.minimumAmount !== undefined
					? { minimumAmount: params.minimumAmount ?? undefined }
					: {}),
				...(params.maximumUses !== undefined
					? { maximumUses: params.maximumUses ?? undefined }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.startsAt !== undefined
					? { startsAt: params.startsAt ?? undefined }
					: {}),
				...(params.endsAt !== undefined
					? { endsAt: params.endsAt ?? undefined }
					: {}),
				...(params.appliesTo !== undefined
					? { appliesTo: params.appliesTo }
					: {}),
				...(params.appliesToIds !== undefined
					? { appliesToIds: params.appliesToIds }
					: {}),
				...(params.stackable !== undefined
					? { stackable: params.stackable }
					: {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("discount", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id: string): Promise<void> {
			// Delete all codes first
			const codes = (await data.findMany("discountCode", {
				where: { discountId: id },
			})) as DiscountCode[];
			for (const code of codes) {
				await data.delete("discountCode", code.id);
			}
			await data.delete("discount", id);
		},

		async list(params): Promise<{ discounts: Discount[]; total: number }> {
			const { limit = 20, offset = 0, isActive } = params;

			const all = (await data.findMany("discount", {
				...(isActive !== undefined ? { where: { isActive } } : {}),
			})) as Discount[];

			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return {
				discounts: all.slice(offset, offset + limit),
				total: all.length,
			};
		},

		async createCode(params): Promise<DiscountCode> {
			const id = crypto.randomUUID();
			const now = new Date();
			const code: DiscountCode = {
				id,
				discountId: params.discountId,
				code: params.code.toUpperCase().trim(),
				usedCount: 0,
				maximumUses: params.maximumUses,
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("discountCode", id, code as Record<string, unknown>);
			return code;
		},

		async getCodeByValue(code: string): Promise<DiscountCode | null> {
			const results = (await data.findMany("discountCode", {
				where: { code: code.toUpperCase().trim() },
				take: 1,
			})) as DiscountCode[];
			return results[0] ?? null;
		},

		async listCodes(discountId: string): Promise<DiscountCode[]> {
			return (await data.findMany("discountCode", {
				where: { discountId },
			})) as DiscountCode[];
		},

		async deleteCode(id: string): Promise<void> {
			await data.delete("discountCode", id);
		},

		async validateCode(params): Promise<ApplyResult> {
			const { code, subtotal, productIds = [], categoryIds = [] } = params;

			const discountCode = (await data.findMany("discountCode", {
				where: { code: code.toUpperCase().trim() },
				take: 1,
			})) as DiscountCode[];

			const dc = discountCode[0];
			if (!dc) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "Invalid promo code",
				};
			}

			if (!dc.isActive) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "This promo code is no longer active",
				};
			}

			if (
				dc.maximumUses !== undefined &&
				dc.maximumUses !== null &&
				dc.usedCount >= dc.maximumUses
			) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "This promo code has reached its usage limit",
				};
			}

			const discount = (await data.get(
				"discount",
				dc.discountId,
			)) as Discount | null;
			if (!discount) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "Discount not found",
				};
			}

			if (!isDiscountActive(discount)) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "This discount is not currently active",
				};
			}

			if (
				discount.minimumAmount !== undefined &&
				discount.minimumAmount !== null &&
				subtotal < discount.minimumAmount
			) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: `Minimum order amount of ${discount.minimumAmount} required`,
				};
			}

			if (!appliesToItems(discount, productIds, categoryIds)) {
				return {
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "This discount does not apply to the items in your cart",
				};
			}

			const discountAmount = calculateDiscountAmount(discount, subtotal);
			const freeShipping = discount.type === "free_shipping";

			return {
				valid: true,
				discountAmount,
				freeShipping,
				discount,
				code: dc,
			};
		},

		async applyCode(params): Promise<ApplyResult> {
			const result = await this.validateCode(params);
			if (!result.valid || !result.code || !result.discount) {
				return result;
			}

			// Increment code usage
			const updatedCode: DiscountCode = {
				...result.code,
				usedCount: result.code.usedCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert(
				"discountCode",
				result.code.id,
				updatedCode as Record<string, unknown>,
			);

			// Increment discount usage
			const updatedDiscount: Discount = {
				...result.discount,
				usedCount: result.discount.usedCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert(
				"discount",
				result.discount.id,
				updatedDiscount as Record<string, unknown>,
			);

			return {
				...result,
				code: updatedCode,
				discount: updatedDiscount,
			};
		},

		async updateCode(id, params): Promise<DiscountCode | null> {
			const existing = (await data.get(
				"discountCode",
				id,
			)) as DiscountCode | null;
			if (!existing) return null;

			const updated: DiscountCode = {
				...existing,
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.maximumUses !== undefined
					? { maximumUses: params.maximumUses ?? undefined }
					: {}),
				updatedAt: new Date(),
			};
			await data.upsert("discountCode", id, updated as Record<string, unknown>);
			return updated;
		},

		async generateBulkCodes(params): Promise<BulkCodeResult> {
			const { discountId, count, prefix = "", maximumUses } = params;
			const codeLength = 8;
			const normalizedPrefix = prefix.toUpperCase().trim();
			const generated: DiscountCode[] = [];
			const existingCodes = new Set<string>();

			// Pre-fetch existing codes to avoid collisions
			const allCodes = (await data.findMany("discountCode", {
				where: { discountId },
			})) as DiscountCode[];
			for (const c of allCodes) {
				existingCodes.add(c.code);
			}

			let attempts = 0;
			const maxAttempts = count * 10;

			while (generated.length < count && attempts < maxAttempts) {
				attempts++;
				const random = generateRandomCode(codeLength);
				const code = normalizedPrefix
					? `${normalizedPrefix}-${random}`
					: random;

				if (existingCodes.has(code)) continue;
				existingCodes.add(code);

				const id = crypto.randomUUID();
				const now = new Date();
				const discountCode: DiscountCode = {
					id,
					discountId,
					code,
					usedCount: 0,
					maximumUses,
					isActive: true,
					createdAt: now,
					updatedAt: now,
				};
				await data.upsert(
					"discountCode",
					id,
					discountCode as Record<string, unknown>,
				);
				generated.push(discountCode);
			}

			return { generated: generated.length, codes: generated };
		},

		async getCodeStats(discountId): Promise<CodeStats> {
			const codes = (await data.findMany("discountCode", {
				where: { discountId },
			})) as DiscountCode[];

			let active = 0;
			let inactive = 0;
			let totalRedemptions = 0;
			let fullyUsed = 0;
			let unused = 0;

			for (const c of codes) {
				if (c.isActive) {
					active++;
				} else {
					inactive++;
				}
				totalRedemptions += c.usedCount;
				if (c.usedCount === 0) {
					unused++;
				}
				if (
					c.maximumUses !== undefined &&
					c.maximumUses !== null &&
					c.usedCount >= c.maximumUses
				) {
					fullyUsed++;
				}
			}

			const total = codes.length;
			const redemptionRate =
				total > 0 ? Math.round(((total - unused) / total) * 100) : 0;

			return {
				total,
				active,
				inactive,
				totalRedemptions,
				fullyUsed,
				unused,
				redemptionRate,
			};
		},

		async getAnalytics(): Promise<DiscountAnalytics> {
			const allDiscounts = (await data.findMany("discount", {})) as Discount[];
			const allCodes = (await data.findMany(
				"discountCode",
				{},
			)) as DiscountCode[];

			const now = new Date();
			let activeCount = 0;
			let expiredCount = 0;
			let scheduledCount = 0;
			let totalUsage = 0;
			const typeDistribution: Record<string, number> = {
				percentage: 0,
				fixed_amount: 0,
				free_shipping: 0,
			};

			// Build code counts per discount
			const codeCountByDiscount = new Map<string, number>();
			for (const code of allCodes) {
				codeCountByDiscount.set(
					code.discountId,
					(codeCountByDiscount.get(code.discountId) ?? 0) + 1,
				);
			}

			const summaries: DiscountSummary[] = [];

			for (const d of allDiscounts) {
				totalUsage += d.usedCount;

				if (d.type in typeDistribution) {
					typeDistribution[d.type] = (typeDistribution[d.type] ?? 0) + 1;
				}

				// Classify status
				if (d.startsAt && new Date(d.startsAt) > now) {
					scheduledCount++;
				} else if (
					!d.isActive ||
					(d.endsAt && new Date(d.endsAt) < now) ||
					(d.maximumUses !== undefined &&
						d.maximumUses !== null &&
						d.usedCount >= d.maximumUses)
				) {
					expiredCount++;
				} else {
					activeCount++;
				}

				summaries.push({
					id: d.id,
					name: d.name,
					type: d.type,
					value: d.value,
					usedCount: d.usedCount,
					maximumUses: d.maximumUses,
					isActive: d.isActive,
					codesCount: codeCountByDiscount.get(d.id) ?? 0,
				});
			}

			// Sort by usage descending, take top 10
			summaries.sort((a, b) => b.usedCount - a.usedCount);
			const topByUsage = summaries.slice(0, 10);

			return {
				totalDiscounts: allDiscounts.length,
				activeCount,
				expiredCount,
				scheduledCount,
				totalUsage,
				totalCodes: allCodes.length,
				typeDistribution,
				topByUsage,
			};
		},

		// --- Cart Price Rules ---

		async createPriceRule(params): Promise<CartPriceRule> {
			const id = params.id ?? crypto.randomUUID();
			const now = new Date();
			const rule: CartPriceRule = {
				id,
				name: params.name,
				description: params.description,
				type: params.type,
				value: params.value,
				conditions: params.conditions ?? [],
				appliesTo: params.appliesTo ?? "all",
				appliesToIds: params.appliesToIds ?? [],
				priority: params.priority ?? 0,
				stackable: params.stackable ?? false,
				maximumUses: params.maximumUses,
				usedCount: 0,
				isActive: params.isActive ?? true,
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("cartPriceRule", id, rule as Record<string, unknown>);
			return rule;
		},

		async getPriceRule(id: string): Promise<CartPriceRule | null> {
			return (await data.get("cartPriceRule", id)) as CartPriceRule | null;
		},

		async updatePriceRule(id, params): Promise<CartPriceRule | null> {
			const existing = (await data.get(
				"cartPriceRule",
				id,
			)) as CartPriceRule | null;
			if (!existing) return null;

			const updated: CartPriceRule = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.value !== undefined ? { value: params.value } : {}),
				...(params.conditions !== undefined
					? { conditions: params.conditions }
					: {}),
				...(params.appliesTo !== undefined
					? { appliesTo: params.appliesTo }
					: {}),
				...(params.appliesToIds !== undefined
					? { appliesToIds: params.appliesToIds }
					: {}),
				...(params.priority !== undefined ? { priority: params.priority } : {}),
				...(params.stackable !== undefined
					? { stackable: params.stackable }
					: {}),
				...(params.maximumUses !== undefined
					? { maximumUses: params.maximumUses ?? undefined }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.startsAt !== undefined
					? { startsAt: params.startsAt ?? undefined }
					: {}),
				...(params.endsAt !== undefined
					? { endsAt: params.endsAt ?? undefined }
					: {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"cartPriceRule",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deletePriceRule(id: string): Promise<void> {
			await data.delete("cartPriceRule", id);
		},

		async listPriceRules(
			params,
		): Promise<{ rules: CartPriceRule[]; total: number }> {
			const { limit = 20, offset = 0, isActive } = params;

			const all = (await data.findMany("cartPriceRule", {
				...(isActive !== undefined ? { where: { isActive } } : {}),
			})) as CartPriceRule[];

			all.sort((a, b) => a.priority - b.priority);

			return {
				rules: all.slice(offset, offset + limit),
				total: all.length,
			};
		},

		async evaluateCartRules(params): Promise<CartAutoDiscountResult> {
			const { subtotal, itemCount, productIds = [], categoryIds = [] } = params;

			const all = (await data.findMany("cartPriceRule", {
				where: { isActive: true },
			})) as CartPriceRule[];

			// Filter to active rules that match conditions and target items
			const matching = all
				.filter((rule) => isPriceRuleActive(rule))
				.filter((rule) =>
					evaluateConditions(rule.conditions, {
						subtotal,
						itemCount,
						productIds,
						categoryIds,
					}),
				)
				.filter((rule) => appliesToItems(rule, productIds, categoryIds));

			// Sort by priority (lower = higher priority)
			matching.sort((a, b) => a.priority - b.priority);

			const applied: CartPriceRuleApplyResult[] = [];
			let totalDiscount = 0;
			let freeShipping = false;
			let remainingSubtotal = subtotal;

			for (const rule of matching) {
				// If we already have a non-stackable rule applied, stop
				if (applied.length > 0) {
					const lastApplied = matching.find(
						(r) => r.id === applied[applied.length - 1].ruleId,
					);
					if (lastApplied && !lastApplied.stackable) break;
					if (!rule.stackable && applied.length > 0) break;
				}

				const discountAmount = calculateRuleAmount(
					rule.type,
					rule.value,
					remainingSubtotal,
				);
				const ruleResult: CartPriceRuleApplyResult = {
					ruleId: rule.id,
					ruleName: rule.name,
					type: rule.type,
					discountAmount,
					freeShipping: rule.type === "free_shipping",
				};

				applied.push(ruleResult);
				totalDiscount += discountAmount;
				remainingSubtotal = Math.max(0, remainingSubtotal - discountAmount);
				if (rule.type === "free_shipping") freeShipping = true;
			}

			return { rules: applied, totalDiscount, freeShipping };
		},

		async applyPriceRules(ruleIds: string[]): Promise<void> {
			for (const ruleId of ruleIds) {
				const rule = (await data.get(
					"cartPriceRule",
					ruleId,
				)) as CartPriceRule | null;
				if (!rule) continue;
				const updated: CartPriceRule = {
					...rule,
					usedCount: rule.usedCount + 1,
					updatedAt: new Date(),
				};
				await data.upsert(
					"cartPriceRule",
					ruleId,
					updated as Record<string, unknown>,
				);
			}
		},
	};
}
