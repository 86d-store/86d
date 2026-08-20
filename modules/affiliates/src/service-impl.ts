import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Affiliate,
	AffiliateController,
	AffiliateConversion,
	AffiliateLink,
	AffiliatePayout,
	AffiliateStats,
} from "./service";

function generateCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

function generateSlug(): string {
	const chars = "abcdefghjkmnpqrstuvwxyz23456789";
	let slug = "";
	for (let i = 0; i < 10; i++) {
		slug += chars[Math.floor(Math.random() * chars.length)];
	}
	return slug;
}

export function createAffiliateController(
	data: ModuleDataService,
): AffiliateController {
	return {
		// ── Affiliates ─────────────────────────────────────────

		async apply(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const affiliate: Affiliate = {
				id,
				name: params.name,
				email: params.email,
				website: params.website,
				code: generateCode(),
				commissionRate: 0,
				status: "pending",
				totalClicks: 0,
				totalConversions: 0,
				totalRevenue: 0,
				totalCommission: 0,
				totalPaid: 0,
				customerId: params.customerId,
				notes: params.notes,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("affiliate", id, affiliate as Record<string, unknown>);
			return affiliate;
		},

		async getAffiliate(id) {
			const raw = await data.get("affiliate", id);
			if (!raw) return null;
			return raw as unknown as Affiliate;
		},

		async getAffiliateByCode(code) {
			const matches = await data.findMany("affiliate", {
				where: { code },
				take: 1,
			});
			if (matches.length === 0) return null;
			return matches[0] as unknown as Affiliate;
		},

		async getAffiliateByEmail(email) {
			const matches = await data.findMany("affiliate", {
				where: { email },
				take: 1,
			});
			if (matches.length === 0) return null;
			return matches[0] as unknown as Affiliate;
		},

		async listAffiliates(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			const results = await data.findMany("affiliate", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Affiliate[];
		},

		async approveAffiliate(id, commissionRate) {
			const existing = await data.get("affiliate", id);
			if (!existing) return null;
			const affiliate = existing as unknown as Affiliate;
			if (affiliate.status !== "pending") return null;

			const updated: Affiliate = {
				...affiliate,
				status: "approved",
				commissionRate: commissionRate ?? 10,
				updatedAt: new Date(),
			};
			await data.upsert("affiliate", id, updated as Record<string, unknown>);
			return updated;
		},

		async suspendAffiliate(id) {
			const existing = await data.get("affiliate", id);
			if (!existing) return null;
			const affiliate = existing as unknown as Affiliate;
			if (affiliate.status !== "approved") return null;

			const updated: Affiliate = {
				...affiliate,
				status: "suspended",
				updatedAt: new Date(),
			};
			await data.upsert("affiliate", id, updated as Record<string, unknown>);
			return updated;
		},

		async rejectAffiliate(id) {
			const existing = await data.get("affiliate", id);
			if (!existing) return null;
			const affiliate = existing as unknown as Affiliate;
			if (affiliate.status !== "pending") return null;

			const updated: Affiliate = {
				...affiliate,
				status: "rejected",
				updatedAt: new Date(),
			};
			await data.upsert("affiliate", id, updated as Record<string, unknown>);
			return updated;
		},

		async updateAffiliate(id, params) {
			const existing = await data.get("affiliate", id);
			if (!existing) return null;
			const affiliate = existing as unknown as Affiliate;

			const updated: Affiliate = {
				...affiliate,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.email !== undefined ? { email: params.email } : {}),
				...(params.website !== undefined ? { website: params.website } : {}),
				...(params.commissionRate !== undefined
					? { commissionRate: params.commissionRate }
					: {}),
				...(params.notes !== undefined ? { notes: params.notes } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("affiliate", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Links ──────────────────────────────────────────────

		async createLink(params) {
			const affiliateRaw = await data.get("affiliate", params.affiliateId);
			if (!affiliateRaw) return null;
			const affiliate = affiliateRaw as unknown as Affiliate;
			if (affiliate.status !== "approved") return null;

			const id = crypto.randomUUID();
			const link: AffiliateLink = {
				id,
				affiliateId: params.affiliateId,
				targetUrl: params.targetUrl,
				slug: generateSlug(),
				clicks: 0,
				conversions: 0,
				revenue: 0,
				active: true,
				createdAt: new Date(),
			};
			await data.upsert("affiliateLink", id, link as Record<string, unknown>);
			return link;
		},

		async getLink(id) {
			const raw = await data.get("affiliateLink", id);
			if (!raw) return null;
			return raw as unknown as AffiliateLink;
		},

		async getLinkBySlug(slug) {
			const matches = await data.findMany("affiliateLink", {
				where: { slug },
				take: 1,
			});
			if (matches.length === 0) return null;
			return matches[0] as unknown as AffiliateLink;
		},

		async listLinks(params) {
			const where: Record<string, unknown> = {};
			if (params?.affiliateId !== undefined)
				where.affiliateId = params.affiliateId;
			if (params?.active !== undefined) where.active = params.active;

			const results = await data.findMany("affiliateLink", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as AffiliateLink[];
		},

		async recordClick(linkId) {
			const existing = await data.get("affiliateLink", linkId);
			if (!existing) return null;
			const link = existing as unknown as AffiliateLink;
			if (!link.active) return null;

			const updated: AffiliateLink = {
				...link,
				clicks: link.clicks + 1,
			};
			await data.upsert(
				"affiliateLink",
				linkId,
				updated as Record<string, unknown>,
			);

			// Update affiliate total clicks
			const affiliateRaw = await data.get("affiliate", link.affiliateId);
			if (affiliateRaw) {
				const affiliate = affiliateRaw as unknown as Affiliate;
				const updatedAffiliate: Affiliate = {
					...affiliate,
					totalClicks: affiliate.totalClicks + 1,
					updatedAt: new Date(),
				};
				await data.upsert(
					"affiliate",
					affiliate.id,
					updatedAffiliate as Record<string, unknown>,
				);
			}

			return updated;
		},

		async deactivateLink(id) {
			const existing = await data.get("affiliateLink", id);
			if (!existing) return null;
			const link = existing as unknown as AffiliateLink;

			const updated: AffiliateLink = { ...link, active: false };
			await data.upsert(
				"affiliateLink",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ── Conversions ────────────────────────────────────────

		async recordConversion(params) {
			const affiliateRaw = await data.get("affiliate", params.affiliateId);
			if (!affiliateRaw) return null;
			const affiliate = affiliateRaw as unknown as Affiliate;
			if (affiliate.status !== "approved") return null;

			const commissionAmount =
				params.orderAmount * (affiliate.commissionRate / 100);

			const id = crypto.randomUUID();
			const conversion: AffiliateConversion = {
				id,
				affiliateId: params.affiliateId,
				linkId: params.linkId,
				orderId: params.orderId,
				orderAmount: params.orderAmount,
				commissionRate: affiliate.commissionRate,
				commissionAmount,
				status: "pending",
				createdAt: new Date(),
			};
			await data.upsert(
				"affiliateConversion",
				id,
				conversion as Record<string, unknown>,
			);

			// Update link stats if linkId provided
			if (params.linkId) {
				const linkRaw = await data.get("affiliateLink", params.linkId);
				if (linkRaw) {
					const link = linkRaw as unknown as AffiliateLink;
					const updatedLink: AffiliateLink = {
						...link,
						conversions: link.conversions + 1,
						revenue: link.revenue + params.orderAmount,
					};
					await data.upsert(
						"affiliateLink",
						params.linkId,
						updatedLink as Record<string, unknown>,
					);
				}
			}

			return conversion;
		},

		async getConversion(id) {
			const raw = await data.get("affiliateConversion", id);
			if (!raw) return null;
			return raw as unknown as AffiliateConversion;
		},

		async listConversions(params) {
			const where: Record<string, unknown> = {};
			if (params?.affiliateId !== undefined)
				where.affiliateId = params.affiliateId;
			if (params?.status !== undefined) where.status = params.status;

			const results = await data.findMany("affiliateConversion", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as AffiliateConversion[];
		},

		async approveConversion(id) {
			const existing = await data.get("affiliateConversion", id);
			if (!existing) return null;
			const conversion = existing as unknown as AffiliateConversion;
			if (conversion.status !== "pending") return null;

			const updated: AffiliateConversion = {
				...conversion,
				status: "approved",
			};
			await data.upsert(
				"affiliateConversion",
				id,
				updated as Record<string, unknown>,
			);

			// Update affiliate totals
			const affiliateRaw = await data.get("affiliate", conversion.affiliateId);
			if (affiliateRaw) {
				const affiliate = affiliateRaw as unknown as Affiliate;
				const updatedAffiliate: Affiliate = {
					...affiliate,
					totalConversions: affiliate.totalConversions + 1,
					totalRevenue: affiliate.totalRevenue + conversion.orderAmount,
					totalCommission:
						affiliate.totalCommission + conversion.commissionAmount,
					updatedAt: new Date(),
				};
				await data.upsert(
					"affiliate",
					affiliate.id,
					updatedAffiliate as Record<string, unknown>,
				);
			}

			return updated;
		},

		async rejectConversion(id) {
			const existing = await data.get("affiliateConversion", id);
			if (!existing) return null;
			const conversion = existing as unknown as AffiliateConversion;
			if (conversion.status !== "pending") return null;

			const updated: AffiliateConversion = {
				...conversion,
				status: "rejected",
			};
			await data.upsert(
				"affiliateConversion",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ── Payouts ────────────────────────────────────────────

		async createPayout(params) {
			const affiliateRaw = await data.get("affiliate", params.affiliateId);
			if (!affiliateRaw) return null;
			const affiliate = affiliateRaw as unknown as Affiliate;
			if (affiliate.status !== "approved") return null;

			const balance = affiliate.totalCommission - affiliate.totalPaid;
			if (params.amount > balance) return null;

			const id = crypto.randomUUID();
			const payout: AffiliatePayout = {
				id,
				affiliateId: params.affiliateId,
				amount: params.amount,
				method: params.method,
				reference: params.reference,
				notes: params.notes,
				status: "pending",
				createdAt: new Date(),
			};
			await data.upsert(
				"affiliatePayout",
				id,
				payout as Record<string, unknown>,
			);
			return payout;
		},

		async getPayout(id) {
			const raw = await data.get("affiliatePayout", id);
			if (!raw) return null;
			return raw as unknown as AffiliatePayout;
		},

		async listPayouts(params) {
			const where: Record<string, unknown> = {};
			if (params?.affiliateId !== undefined)
				where.affiliateId = params.affiliateId;
			if (params?.status !== undefined) where.status = params.status;

			const results = await data.findMany("affiliatePayout", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as AffiliatePayout[];
		},

		async completePayout(id) {
			const existing = await data.get("affiliatePayout", id);
			if (!existing) return null;
			const payout = existing as unknown as AffiliatePayout;
			if (payout.status !== "pending" && payout.status !== "processing")
				return null;

			const updated: AffiliatePayout = {
				...payout,
				status: "completed",
				paidAt: new Date(),
			};
			await data.upsert(
				"affiliatePayout",
				id,
				updated as Record<string, unknown>,
			);

			// Update affiliate totalPaid
			const affiliateRaw = await data.get("affiliate", payout.affiliateId);
			if (affiliateRaw) {
				const affiliate = affiliateRaw as unknown as Affiliate;
				const updatedAffiliate: Affiliate = {
					...affiliate,
					totalPaid: affiliate.totalPaid + payout.amount,
					updatedAt: new Date(),
				};
				await data.upsert(
					"affiliate",
					affiliate.id,
					updatedAffiliate as Record<string, unknown>,
				);
			}

			return updated;
		},

		async failPayout(id) {
			const existing = await data.get("affiliatePayout", id);
			if (!existing) return null;
			const payout = existing as unknown as AffiliatePayout;
			if (payout.status !== "pending" && payout.status !== "processing")
				return null;

			const updated: AffiliatePayout = { ...payout, status: "failed" };
			await data.upsert(
				"affiliatePayout",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ── Stats ──────────────────────────────────────────────

		async getStats() {
			const affiliates = await data.findMany("affiliate", {});
			const typedAffiliates = affiliates as unknown as Affiliate[];

			const active = typedAffiliates.filter((a) => a.status === "approved");
			const pending = typedAffiliates.filter((a) => a.status === "pending");

			const totalClicks = typedAffiliates.reduce(
				(sum, a) => sum + a.totalClicks,
				0,
			);
			const totalConversions = typedAffiliates.reduce(
				(sum, a) => sum + a.totalConversions,
				0,
			);
			const totalRevenue = typedAffiliates.reduce(
				(sum, a) => sum + a.totalRevenue,
				0,
			);
			const totalCommission = typedAffiliates.reduce(
				(sum, a) => sum + a.totalCommission,
				0,
			);
			const totalPaid = typedAffiliates.reduce(
				(sum, a) => sum + a.totalPaid,
				0,
			);

			const stats: AffiliateStats = {
				totalAffiliates: typedAffiliates.length,
				activeAffiliates: active.length,
				pendingApplications: pending.length,
				totalClicks,
				totalConversions,
				totalRevenue,
				totalCommission,
				totalPaid,
				conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
			};
			return stats;
		},

		async getAffiliateBalance(affiliateId) {
			const affiliateRaw = await data.get("affiliate", affiliateId);
			if (!affiliateRaw) {
				return { totalCommission: 0, totalPaid: 0, balance: 0 };
			}
			const affiliate = affiliateRaw as unknown as Affiliate;
			return {
				totalCommission: affiliate.totalCommission,
				totalPaid: affiliate.totalPaid,
				balance: affiliate.totalCommission - affiliate.totalPaid,
			};
		},
	};
}
