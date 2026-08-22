import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	PayoutStats,
	Vendor,
	VendorController,
	VendorPayout,
	VendorProduct,
	VendorStats,
} from "./service";

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

export function createVendorController(
	data: ModuleDataService,
): VendorController {
	return {
		// ── Vendors ──────────────────────────────────────────

		async createVendor(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const vendor: Vendor = {
				id,
				name: params.name,
				slug: params.slug,
				email: params.email,
				commissionRate: params.commissionRate ?? 10,
				status: params.status ?? "pending",
				joinedAt: now,
				createdAt: now,
				updatedAt: now,
				...(params.phone != null && { phone: params.phone }),
				...(params.description != null && {
					description: params.description,
				}),
				...(params.logo != null && { logo: params.logo }),
				...(params.banner != null && { banner: params.banner }),
				...(params.website != null && { website: params.website }),
				...(params.addressLine1 != null && {
					addressLine1: params.addressLine1,
				}),
				...(params.addressLine2 != null && {
					addressLine2: params.addressLine2,
				}),
				...(params.city != null && { city: params.city }),
				...(params.state != null && { state: params.state }),
				...(params.postalCode != null && {
					postalCode: params.postalCode,
				}),
				...(params.country != null && { country: params.country }),
				...(params.metadata != null && { metadata: params.metadata }),
			};
			await data.upsert("vendor", id, vendor as Record<string, unknown>);
			return vendor;
		},

		async getVendor(id) {
			const raw = await data.get("vendor", id);
			return raw as unknown as Vendor;
		},

		async getVendorBySlug(slug) {
			const results = (await data.findMany("vendor", {
				where: { slug },
			})) as unknown as Vendor[];
			return results[0] ?? null;
		},

		async updateVendor(id, params) {
			const existing = await data.get("vendor", id);
			if (!existing) return null;

			const current = existing as unknown as Vendor;

			const base: Vendor = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				email: params.email ?? current.email,
				commissionRate: params.commissionRate ?? current.commissionRate,
				status: current.status,
				joinedAt: current.joinedAt,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const optionalFields: Partial<Vendor> = {};

			const phoneVal =
				params.phone === null ? null : (params.phone ?? current.phone);
			if (phoneVal != null) optionalFields.phone = phoneVal;

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) optionalFields.description = descVal;

			const logoVal =
				params.logo === null ? null : (params.logo ?? current.logo);
			if (logoVal != null) optionalFields.logo = logoVal;

			const bannerVal =
				params.banner === null ? null : (params.banner ?? current.banner);
			if (bannerVal != null) optionalFields.banner = bannerVal;

			const websiteVal =
				params.website === null ? null : (params.website ?? current.website);
			if (websiteVal != null) optionalFields.website = websiteVal;

			const line1Val =
				params.addressLine1 === null
					? null
					: (params.addressLine1 ?? current.addressLine1);
			if (line1Val != null) optionalFields.addressLine1 = line1Val;

			const line2Val =
				params.addressLine2 === null
					? null
					: (params.addressLine2 ?? current.addressLine2);
			if (line2Val != null) optionalFields.addressLine2 = line2Val;

			const cityVal =
				params.city === null ? null : (params.city ?? current.city);
			if (cityVal != null) optionalFields.city = cityVal;

			const stateVal =
				params.state === null ? null : (params.state ?? current.state);
			if (stateVal != null) optionalFields.state = stateVal;

			const postalVal =
				params.postalCode === null
					? null
					: (params.postalCode ?? current.postalCode);
			if (postalVal != null) optionalFields.postalCode = postalVal;

			const countryVal =
				params.country === null ? null : (params.country ?? current.country);
			if (countryVal != null) optionalFields.country = countryVal;

			const metaVal =
				params.metadata === null ? null : (params.metadata ?? current.metadata);
			if (metaVal != null) optionalFields.metadata = metaVal;

			const updated: Vendor = { ...base, ...optionalFields };

			await data.upsert("vendor", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteVendor(id) {
			const existing = await data.get("vendor", id);
			if (!existing) return false;

			// Cascade: remove product assignments
			const products = (await data.findMany("vendorProduct", {
				where: { vendorId: id },
			})) as unknown as VendorProduct[];
			for (const p of products) {
				await data.delete("vendorProduct", p.id);
			}

			// Cascade: remove payouts
			const payouts = (await data.findMany("vendorPayout", {
				where: { vendorId: id },
			})) as unknown as VendorPayout[];
			for (const p of payouts) {
				await data.delete("vendorPayout", p.id);
			}

			await data.delete("vendor", id);
			return true;
		},

		async listVendors(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"vendor",
				buildFindOptions({
					where,
					orderBy: { createdAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Vendor[];
		},

		async countVendors(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("vendor", {
				where,
			})) as unknown as Vendor[];
			return results.length;
		},

		async updateVendorStatus(id, status) {
			const existing = await data.get("vendor", id);
			if (!existing) return null;

			const current = existing as unknown as Vendor;
			const updated: Vendor = {
				...current,
				status,
				updatedAt: new Date(),
			};

			await data.upsert("vendor", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Products ─────────────────────────────────────────

		async assignProduct(params) {
			// Check if already assigned
			const existing = (await data.findMany("vendorProduct", {
				where: {
					vendorId: params.vendorId,
					productId: params.productId,
				},
			})) as unknown as VendorProduct[];

			if (existing.length > 0) return existing[0];

			const id = crypto.randomUUID();
			const assignment: VendorProduct = {
				id,
				vendorId: params.vendorId,
				productId: params.productId,
				status: "active",
				createdAt: new Date(),
				...(params.commissionOverride != null && {
					commissionOverride: params.commissionOverride,
				}),
			};
			await data.upsert(
				"vendorProduct",
				id,
				assignment as Record<string, unknown>,
			);
			return assignment;
		},

		async unassignProduct(params) {
			const existing = (await data.findMany("vendorProduct", {
				where: {
					vendorId: params.vendorId,
					productId: params.productId,
				},
			})) as unknown as VendorProduct[];

			if (existing.length === 0) return false;

			for (const item of existing) {
				await data.delete("vendorProduct", item.id);
			}
			return true;
		},

		async listVendorProducts(params) {
			const where: Record<string, unknown> = {
				vendorId: params.vendorId,
			};
			if (params.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"vendorProduct",
				buildFindOptions({
					where,
					orderBy: { createdAt: "desc" },
					take: params.take,
					skip: params.skip,
				}),
			)) as unknown as VendorProduct[];
		},

		async countVendorProducts(params) {
			const where: Record<string, unknown> = {
				vendorId: params.vendorId,
			};
			if (params.status !== undefined) where.status = params.status;

			const results = (await data.findMany("vendorProduct", {
				where,
			})) as unknown as VendorProduct[];
			return results.length;
		},

		async getProductVendor(productId) {
			const assignments = (await data.findMany("vendorProduct", {
				where: { productId, status: "active" },
			})) as unknown as VendorProduct[];

			if (assignments.length === 0) return null;

			const vendor = await data.get("vendor", assignments[0].vendorId);
			return vendor as unknown as Vendor;
		},

		// ── Payouts ──────────────────────────────────────────

		async createPayout(params) {
			const vendor = await data.get("vendor", params.vendorId);
			if (!vendor) throw new Error("Vendor not found");

			const id = crypto.randomUUID();
			const now = new Date();
			const payout: VendorPayout = {
				id,
				vendorId: params.vendorId,
				amount: params.amount,
				currency: params.currency,
				status: "pending",
				periodStart: params.periodStart,
				periodEnd: params.periodEnd,
				createdAt: now,
				...(params.method != null && { method: params.method }),
				...(params.reference != null && {
					reference: params.reference,
				}),
				...(params.notes != null && { notes: params.notes }),
			};
			await data.upsert("vendorPayout", id, payout as Record<string, unknown>);
			return payout;
		},

		async getPayout(id) {
			const raw = await data.get("vendorPayout", id);
			return raw as unknown as VendorPayout;
		},

		async updatePayoutStatus(id, status) {
			const existing = await data.get("vendorPayout", id);
			if (!existing) return null;

			const current = existing as unknown as VendorPayout;
			const updated: VendorPayout = {
				...current,
				status,
				...(status === "completed" && { completedAt: new Date() }),
			};

			await data.upsert("vendorPayout", id, updated as Record<string, unknown>);
			return updated;
		},

		async listPayouts(params) {
			const where: Record<string, unknown> = {};
			if (params?.vendorId !== undefined) where.vendorId = params.vendorId;
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"vendorPayout",
				buildFindOptions({
					where,
					orderBy: { createdAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as VendorPayout[];
		},

		async countPayouts(params) {
			const where: Record<string, unknown> = {};
			if (params?.vendorId !== undefined) where.vendorId = params.vendorId;
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("vendorPayout", {
				where,
			})) as unknown as VendorPayout[];
			return results.length;
		},

		async getPayoutStats(vendorId) {
			const where: Record<string, unknown> = {};
			if (vendorId !== undefined) where.vendorId = vendorId;

			const all = (await data.findMany("vendorPayout", {
				where,
			})) as unknown as VendorPayout[];

			const stats: PayoutStats = {
				totalPayouts: all.length,
				pendingAmount: all
					.filter((p) => p.status === "pending")
					.reduce((sum, p) => sum + p.amount, 0),
				processingAmount: all
					.filter((p) => p.status === "processing")
					.reduce((sum, p) => sum + p.amount, 0),
				completedAmount: all
					.filter((p) => p.status === "completed")
					.reduce((sum, p) => sum + p.amount, 0),
				failedAmount: all
					.filter((p) => p.status === "failed")
					.reduce((sum, p) => sum + p.amount, 0),
			};
			return stats;
		},

		// ── Admin ─────────────────────────────────────────────

		async getStats() {
			const allVendors = (await data.findMany(
				"vendor",
				{},
			)) as unknown as Vendor[];
			const allProducts = (await data.findMany(
				"vendorProduct",
				{},
			)) as unknown as VendorProduct[];
			const allPayouts = (await data.findMany(
				"vendorPayout",
				{},
			)) as unknown as VendorPayout[];

			const stats: VendorStats = {
				totalVendors: allVendors.length,
				activeVendors: allVendors.filter((v) => v.status === "active").length,
				pendingVendors: allVendors.filter((v) => v.status === "pending").length,
				suspendedVendors: allVendors.filter((v) => v.status === "suspended")
					.length,
				totalProducts: allProducts.length,
				totalPayouts: allPayouts.length,
				pendingPayoutAmount: allPayouts
					.filter((p) => p.status === "pending")
					.reduce((sum, p) => sum + p.amount, 0),
				completedPayoutAmount: allPayouts
					.filter((p) => p.status === "completed")
					.reduce((sum, p) => sum + p.amount, 0),
			};
			return stats;
		},
	};
}
