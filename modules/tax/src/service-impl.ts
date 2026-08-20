import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { TaxJarProvider } from "./provider";
import type {
	CreateTaxCategoryParams,
	CreateTaxExemptionParams,
	CreateTaxNexusParams,
	CreateTaxRateParams,
	TaxAddress,
	TaxCalculation,
	TaxCategory,
	TaxController,
	TaxExemption,
	TaxLineItem,
	TaxLineResult,
	TaxNexus,
	TaxRate,
	TaxReportSummary,
	TaxTransaction,
	UpdateTaxRateParams,
} from "./service";

/**
 * Score how specifically a rate matches a given address.
 * Higher score = more specific match = higher priority when multiple rates exist.
 * Returns -1 if the rate does not match at all.
 */
function matchScore(rate: TaxRate, address: TaxAddress): number {
	if (rate.country !== address.country) return -1;

	let score = 1; // country match

	if (rate.state !== "*") {
		if (rate.state !== address.state) return -1;
		score += 10;
	}

	if (rate.city !== "*") {
		if (!address.city || rate.city.toLowerCase() !== address.city.toLowerCase())
			return -1;
		score += 100;
	}

	if (rate.postalCode !== "*") {
		if (!address.postalCode || rate.postalCode !== address.postalCode)
			return -1;
		score += 1000;
	}

	return score;
}

/**
 * Find the best matching rates for a given address and category.
 * More specific jurisdictions take precedence over broader ones.
 */
function findMatchingRates(
	allRates: TaxRate[],
	address: TaxAddress,
	categoryId: string,
): TaxRate[] {
	const scored = allRates
		.filter((r) => r.enabled)
		.filter((r) => r.categoryId === categoryId || r.categoryId === "default")
		.map((r) => ({ rate: r, score: matchScore(r, address) }))
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score || b.rate.priority - a.rate.priority);

	if (scored.length === 0) return [];

	// If we have category-specific rates that match, prefer those over "default"
	const categorySpecific = scored.filter(
		(s) => s.rate.categoryId === categoryId,
	);
	if (categorySpecific.length > 0 && categoryId !== "default") {
		return categorySpecific.map((s) => s.rate);
	}

	return scored.map((s) => s.rate);
}

/**
 * Apply tax rates to an amount, respecting compound and priority settings.
 * Non-compound rates at the same priority are additive.
 * Compound rates at higher priority apply to (amount + previously computed tax).
 */
function applyRates(
	amount: number,
	rates: TaxRate[],
): { tax: number; effectiveRate: number } {
	if (rates.length === 0) return { tax: 0, effectiveRate: 0 };

	// Group by priority
	const byPriority = new Map<number, TaxRate[]>();
	for (const r of rates) {
		const existing = byPriority.get(r.priority) ?? [];
		existing.push(r);
		byPriority.set(r.priority, existing);
	}

	const priorities = [...byPriority.keys()].sort((a, b) => a - b);

	let cumulativeTax = 0;

	for (const priority of priorities) {
		const group = byPriority.get(priority) ?? [];
		let groupTax = 0;

		for (const rate of group) {
			const base = rate.compound ? amount + cumulativeTax : amount;
			if (rate.type === "percentage") {
				groupTax += base * rate.rate;
			} else {
				groupTax += rate.rate;
			}
		}

		cumulativeTax += groupTax;
	}

	const effectiveRate = amount > 0 ? cumulativeTax / amount : 0;
	return { tax: roundCurrency(cumulativeTax), effectiveRate };
}

/** Round to 2 decimal places using banker's rounding */
function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

interface TaxControllerOptions {
	taxjarApiKey?: string | undefined;
	taxjarSandbox?: boolean | undefined;
}

export function createTaxController(
	data: ModuleDataService,
	_events?: ScopedEventEmitter | undefined,
	options?: TaxControllerOptions | undefined,
): TaxController {
	const provider = options?.taxjarApiKey
		? new TaxJarProvider(options.taxjarApiKey, options.taxjarSandbox ?? false)
		: null;

	return {
		// --- Tax Rates ---
		async createRate(params: CreateTaxRateParams): Promise<TaxRate> {
			const id = crypto.randomUUID();
			const now = new Date();

			const rate: TaxRate = {
				id,
				name: params.name,
				country: params.country,
				state: params.state ?? "*",
				city: params.city ?? "*",
				postalCode: params.postalCode ?? "*",
				rate: params.rate,
				type: params.type ?? "percentage",
				categoryId: params.categoryId ?? "default",
				enabled: params.enabled ?? true,
				priority: params.priority ?? 0,
				compound: params.compound ?? false,
				inclusive: params.inclusive ?? false,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"taxRate",
				id,
				rate as unknown as Record<string, unknown>,
			);
			return rate;
		},

		async getRate(id: string): Promise<TaxRate | null> {
			return (await data.get("taxRate", id)) as TaxRate | null;
		},

		async listRates(params): Promise<TaxRate[]> {
			const where: Record<string, unknown> = {};
			if (params?.country) where.country = params.country;
			if (params?.state) where.state = params.state;
			if (params?.enabled !== undefined) where.enabled = params.enabled;

			return (await data.findMany("taxRate", {
				where,
				take: params?.take ?? 200,
				skip: params?.skip ?? 0,
			})) as TaxRate[];
		},

		async updateRate(
			id: string,
			params: UpdateTaxRateParams,
		): Promise<TaxRate | null> {
			const existing = (await data.get("taxRate", id)) as TaxRate | null;
			if (!existing) return null;

			const updated: TaxRate = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.rate !== undefined ? { rate: params.rate } : {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
				...(params.priority !== undefined ? { priority: params.priority } : {}),
				...(params.compound !== undefined ? { compound: params.compound } : {}),
				...(params.inclusive !== undefined
					? { inclusive: params.inclusive }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"taxRate",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteRate(id: string): Promise<boolean> {
			const existing = (await data.get("taxRate", id)) as TaxRate | null;
			if (!existing) return false;
			await data.delete("taxRate", id);
			return true;
		},

		// --- Tax Categories ---
		async createCategory(
			params: CreateTaxCategoryParams,
		): Promise<TaxCategory> {
			const id = crypto.randomUUID();
			const category: TaxCategory = {
				id,
				name: params.name,
				description: params.description,
				createdAt: new Date(),
			};

			await data.upsert(
				"taxCategory",
				id,
				category as unknown as Record<string, unknown>,
			);
			return category;
		},

		async getCategory(id: string): Promise<TaxCategory | null> {
			return (await data.get("taxCategory", id)) as TaxCategory | null;
		},

		async listCategories(): Promise<TaxCategory[]> {
			return (await data.findMany("taxCategory", {})) as TaxCategory[];
		},

		async deleteCategory(id: string): Promise<boolean> {
			const existing = (await data.get(
				"taxCategory",
				id,
			)) as TaxCategory | null;
			if (!existing) return false;
			await data.delete("taxCategory", id);
			return true;
		},

		// --- Tax Exemptions ---
		async createExemption(
			params: CreateTaxExemptionParams,
		): Promise<TaxExemption> {
			const id = crypto.randomUUID();
			const exemption: TaxExemption = {
				id,
				customerId: params.customerId,
				type: params.type ?? "full",
				categoryId: params.categoryId,
				taxIdNumber: params.taxIdNumber,
				reason: params.reason,
				expiresAt: params.expiresAt,
				enabled: true,
				createdAt: new Date(),
			};

			await data.upsert(
				"taxExemption",
				id,
				exemption as unknown as Record<string, unknown>,
			);
			return exemption;
		},

		async getExemption(id: string): Promise<TaxExemption | null> {
			return (await data.get("taxExemption", id)) as TaxExemption | null;
		},

		async listExemptions(customerId: string): Promise<TaxExemption[]> {
			return (await data.findMany("taxExemption", {
				where: { customerId },
			})) as TaxExemption[];
		},

		async deleteExemption(id: string): Promise<boolean> {
			const existing = (await data.get(
				"taxExemption",
				id,
			)) as TaxExemption | null;
			if (!existing) return false;
			await data.delete("taxExemption", id);
			return true;
		},

		// --- Tax Calculation ---
		async calculate(params: {
			address: TaxAddress;
			lineItems: TaxLineItem[];
			shippingAmount?: number | undefined;
			customerId?: string | undefined;
		}): Promise<TaxCalculation> {
			// Use TaxJar API when configured — real-time tax calculation
			if (provider) {
				try {
					// Build nexus addresses from stored nexus records
					const nexusRecords = (await data.findMany("taxNexus", {
						where: { enabled: true },
					})) as TaxNexus[];

					const nexusAddresses = nexusRecords.map((n) => ({
						country: n.country,
						state: n.state,
						zip: "",
					}));

					const response = await provider.calculateTax({
						fromAddress: {
							country: nexusAddresses[0]?.country ?? "US",
							zip: nexusAddresses[0]?.zip ?? "",
							state: nexusAddresses[0]?.state ?? "",
						},
						toAddress: {
							country: params.address.country,
							zip: params.address.postalCode ?? "",
							state: params.address.state,
							city: params.address.city,
						},
						shipping: params.shippingAmount ?? 0,
						lineItems: params.lineItems.map((item, idx) => ({
							id: item.productId ?? String(idx),
							quantity: 1,
							unit_price: item.amount,
							product_tax_code: item.categoryId,
						})),
						nexusAddresses:
							nexusAddresses.length > 0 ? nexusAddresses : undefined,
					});

					const tax = response.tax;
					const lines: TaxLineResult[] = params.lineItems.map((item, idx) => {
						const lineBreakdown = tax.breakdown?.line_items?.find(
							(li) => li.id === (item.productId ?? String(idx)),
						);
						return {
							productId: item.productId,
							taxableAmount: lineBreakdown?.taxable_amount ?? item.amount,
							taxAmount: lineBreakdown?.tax_collectable ?? 0,
							rate: lineBreakdown?.combined_tax_rate ?? tax.rate,
							rateNames: [
								`${tax.jurisdictions?.state ?? params.address.state} (TaxJar)`,
							],
						};
					});

					return {
						totalTax: tax.amount_to_collect,
						shippingTax: tax.freight_taxable
							? roundCurrency((params.shippingAmount ?? 0) * tax.rate)
							: 0,
						lines,
						effectiveRate: tax.rate,
						inclusive: false,
						jurisdiction: {
							country: tax.jurisdictions?.country ?? params.address.country,
							state: tax.jurisdictions?.state ?? params.address.state,
							city: tax.jurisdictions?.city ?? params.address.city ?? "*",
						},
					};
				} catch {
					// Fall back to local calculation if TaxJar call fails
				}
			}

			// Local calculation fallback
			// Check nexus — if nexus records exist, only collect tax where we have nexus
			const nexusActive = await this.hasNexus(params.address);
			if (!nexusActive) {
				const zeroLines = params.lineItems.map((item) => ({
					productId: item.productId,
					taxableAmount: item.amount,
					taxAmount: 0,
					rate: 0,
					rateNames: [],
				}));
				return {
					totalTax: 0,
					shippingTax: 0,
					lines: zeroLines,
					effectiveRate: 0,
					inclusive: false,
					jurisdiction: {
						country: params.address.country,
						state: params.address.state,
						city: params.address.city ?? "*",
					},
				};
			}

			// Fetch all enabled rates
			const allRates = (await data.findMany("taxRate", {
				where: { enabled: true },
			})) as TaxRate[];

			// Check customer exemptions
			let exemptions: TaxExemption[] = [];
			if (params.customerId) {
				exemptions = (
					(await data.findMany("taxExemption", {
						where: { customerId: params.customerId, enabled: true },
					})) as TaxExemption[]
				).filter((e) => !e.expiresAt || new Date(e.expiresAt) > new Date());
			}

			const isFullyExempt = exemptions.some((e) => e.type === "full");
			const exemptCategories = new Set(
				exemptions
					.filter((e) => e.type === "category" && e.categoryId)
					.map((e) => e.categoryId as string),
			);

			const lines: TaxLineResult[] = [];
			let totalItemTax = 0;
			let totalTaxableAmount = 0;

			// Determine if rates are inclusive (check default category rates)
			const defaultRates = findMatchingRates(
				allRates,
				params.address,
				"default",
			);
			const inclusive =
				defaultRates.length > 0 ? defaultRates[0].inclusive : false;

			for (const item of params.lineItems) {
				const categoryId = item.categoryId ?? "default";

				// Check exemptions
				if (isFullyExempt || exemptCategories.has(categoryId)) {
					lines.push({
						productId: item.productId,
						taxableAmount: item.amount,
						taxAmount: 0,
						rate: 0,
						rateNames: [],
					});
					continue;
				}

				const matchingRates = findMatchingRates(
					allRates,
					params.address,
					categoryId,
				);

				// Reaching here means tax is owed at this address: an explicit nexus
				// list matched it, or nexus enforcement is off entirely. With no rate
				// configured there is nothing to calculate from, so the zero below is
				// an absence of a decision rather than a decision to charge nothing.
				// The line records that difference; callers that would sell on the
				// number refuse, while reporting and jurisdiction checks still read a
				// plain zero.
				const resolved = matchingRates.length > 0;

				// Check if these specific rates are inclusive
				const itemInclusive =
					matchingRates.length > 0 ? matchingRates[0].inclusive : false;

				let tax: number;
				let itemEffectiveRate: number;

				if (itemInclusive) {
					// Tax-inclusive: extract tax from the price
					// price = base + tax = base + base * rate = base * (1 + rate)
					// base = price / (1 + rate), tax = price - base
					const { effectiveRate: combinedRate } = applyRates(1, matchingRates);
					const base = item.amount / (1 + combinedRate);
					tax = roundCurrency(item.amount - base);
					itemEffectiveRate = combinedRate;
				} else {
					const result = applyRates(item.amount, matchingRates);
					tax = result.tax;
					itemEffectiveRate = result.effectiveRate;
				}

				lines.push({
					productId: item.productId,
					taxableAmount: item.amount,
					taxAmount: tax,
					rate: itemEffectiveRate,
					rateNames: matchingRates.map((r) => r.name),
					...(resolved ? {} : { unresolved: true as const }),
				});

				totalItemTax += tax;
				totalTaxableAmount += item.amount;
			}

			// Calculate shipping tax (use "default" category for shipping)
			let shippingTax = 0;
			let shippingUnresolved = false;
			if (
				params.shippingAmount &&
				params.shippingAmount > 0 &&
				!isFullyExempt
			) {
				const shippingRates = findMatchingRates(
					allRates,
					params.address,
					"default",
				);
				// Rates may all be configured under a specific category, leaving
				// shipping with no match. That is an undetermined amount, not a
				// zero the Checkout may sell on.
				shippingUnresolved = shippingRates.length === 0;

				if (inclusive && shippingRates.length > 0) {
					const { effectiveRate: shippingCombinedRate } = applyRates(
						1,
						shippingRates,
					);
					const base = params.shippingAmount / (1 + shippingCombinedRate);
					shippingTax = roundCurrency(params.shippingAmount - base);
				} else {
					shippingTax = applyRates(params.shippingAmount, shippingRates).tax;
				}
			}

			const totalTax = roundCurrency(totalItemTax + shippingTax);
			const effectiveRate =
				totalTaxableAmount > 0 ? totalItemTax / totalTaxableAmount : 0;

			return {
				totalTax,
				shippingTax,
				...(shippingUnresolved ? { shippingUnresolved: true as const } : {}),
				lines,
				effectiveRate,
				inclusive,
				jurisdiction: {
					country: params.address.country,
					state: params.address.state,
					city: params.address.city ?? "*",
				},
			};
		},

		async getRatesForAddress(address: TaxAddress): Promise<TaxRate[]> {
			const allRates = (await data.findMany("taxRate", {
				where: { enabled: true },
			})) as TaxRate[];

			return allRates
				.filter((r) => matchScore(r, address) > 0)
				.sort(
					(a, b) =>
						matchScore(b, address) - matchScore(a, address) ||
						b.priority - a.priority,
				);
		},

		// --- Tax Nexus ---
		async createNexus(params: CreateTaxNexusParams): Promise<TaxNexus> {
			const id = crypto.randomUUID();
			const nexus: TaxNexus = {
				id,
				country: params.country,
				state: params.state ?? "*",
				type: params.type ?? "physical",
				enabled: true,
				notes: params.notes,
				createdAt: new Date(),
			};

			await data.upsert(
				"taxNexus",
				id,
				nexus as unknown as Record<string, unknown>,
			);
			return nexus;
		},

		async getNexus(id: string): Promise<TaxNexus | null> {
			return (await data.get("taxNexus", id)) as TaxNexus | null;
		},

		async listNexus(params): Promise<TaxNexus[]> {
			const where: Record<string, unknown> = {};
			if (params?.country) where.country = params.country;
			if (params?.enabled !== undefined) where.enabled = params.enabled;

			return (await data.findMany("taxNexus", { where })) as TaxNexus[];
		},

		async deleteNexus(id: string): Promise<boolean> {
			const existing = (await data.get("taxNexus", id)) as TaxNexus | null;
			if (!existing) return false;
			await data.delete("taxNexus", id);
			return true;
		},

		async hasNexus(address: TaxAddress): Promise<boolean> {
			const allNexus = (await data.findMany("taxNexus", {})) as TaxNexus[];

			// If no nexus records exist, nexus enforcement is off — tax everywhere
			if (allNexus.length === 0) return true;

			return allNexus.some(
				(n) =>
					n.enabled &&
					n.country === address.country &&
					(n.state === "*" || n.state === address.state),
			);
		},

		// --- Tax Transactions ---
		async logTransaction(params: {
			orderId?: string | undefined;
			customerId?: string | undefined;
			address: TaxAddress;
			calculation: TaxCalculation;
			subtotal: number;
			shippingAmount: number;
		}): Promise<TaxTransaction> {
			const id = crypto.randomUUID();
			const allRateNames = new Set<string>();
			for (const line of params.calculation.lines) {
				for (const name of line.rateNames) {
					allRateNames.add(name);
				}
			}

			const transaction: TaxTransaction = {
				id,
				orderId: params.orderId,
				customerId: params.customerId,
				country: params.address.country,
				state: params.address.state,
				city: params.address.city,
				postalCode: params.address.postalCode,
				subtotal: params.subtotal,
				shippingAmount: params.shippingAmount,
				totalTax: params.calculation.totalTax,
				shippingTax: params.calculation.shippingTax,
				effectiveRate: params.calculation.effectiveRate,
				inclusive: params.calculation.inclusive,
				exempt: params.calculation.totalTax === 0 && params.subtotal > 0,
				lineDetails: params.calculation.lines,
				rateNames: [...allRateNames],
				createdAt: new Date(),
			};

			await data.upsert(
				"taxTransaction",
				id,
				transaction as unknown as Record<string, unknown>,
			);
			return transaction;
		},

		async listTransactions(params): Promise<TaxTransaction[]> {
			const allTransactions = (await data.findMany(
				"taxTransaction",
				{},
			)) as TaxTransaction[];

			let filtered = allTransactions;

			if (params?.country) {
				filtered = filtered.filter((t) => t.country === params.country);
			}
			if (params?.state) {
				filtered = filtered.filter((t) => t.state === params.state);
			}
			if (params?.startDate) {
				const start = params.startDate;
				filtered = filtered.filter((t) => new Date(t.createdAt) >= start);
			}
			if (params?.endDate) {
				const end = params.endDate;
				filtered = filtered.filter((t) => new Date(t.createdAt) <= end);
			}

			// Sort by newest first
			filtered.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const offset = params?.offset ?? 0;
			const limit = params?.limit ?? 200;
			return filtered.slice(offset, offset + limit);
		},

		async linkTransactionToOrder(
			transactionId: string,
			orderId: string,
		): Promise<TaxTransaction | null> {
			const existing = (await data.get(
				"taxTransaction",
				transactionId,
			)) as TaxTransaction | null;
			if (!existing) return null;

			const updated: TaxTransaction = { ...existing, orderId };

			await data.upsert(
				"taxTransaction",
				transactionId,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		// --- Tax Reporting ---
		async getReport(params): Promise<TaxReportSummary[]> {
			const transactions = await this.listTransactions({
				startDate: params?.startDate,
				endDate: params?.endDate,
				country: params?.country,
				state: params?.state,
				limit: 10000,
			});

			// Group by country + state
			const groups = new Map<
				string,
				{
					country: string;
					state: string;
					totalTax: number;
					totalShippingTax: number;
					totalSubtotal: number;
					count: number;
				}
			>();

			for (const t of transactions) {
				const key = `${t.country}:${t.state}`;
				const existing = groups.get(key);
				if (existing) {
					existing.totalTax += t.totalTax;
					existing.totalShippingTax += t.shippingTax;
					existing.totalSubtotal += t.subtotal;
					existing.count += 1;
				} else {
					groups.set(key, {
						country: t.country,
						state: t.state,
						totalTax: t.totalTax,
						totalShippingTax: t.shippingTax,
						totalSubtotal: t.subtotal,
						count: 1,
					});
				}
			}

			return [...groups.values()]
				.map((g) => ({
					jurisdiction: { country: g.country, state: g.state },
					totalTax: roundCurrency(g.totalTax),
					totalShippingTax: roundCurrency(g.totalShippingTax),
					totalSubtotal: roundCurrency(g.totalSubtotal),
					transactionCount: g.count,
					effectiveRate: g.totalSubtotal > 0 ? g.totalTax / g.totalSubtotal : 0,
				}))
				.sort((a, b) => b.totalTax - a.totalTax);
		},
	};
}
