import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Membership,
	MembershipBenefit,
	MembershipController,
	MembershipPlan,
	MembershipProduct,
	MembershipStats,
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

export function createMembershipController(
	data: ModuleDataService,
): MembershipController {
	return {
		// ── Plans ──────────────────────────────────────────

		async createPlan(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const plan: MembershipPlan = {
				id,
				name: params.name,
				slug: params.slug,
				price: params.price,
				billingInterval: params.billingInterval,
				trialDays: params.trialDays ?? 0,
				isActive: params.isActive ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.features != null && { features: params.features }),
				...(params.maxMembers != null && {
					maxMembers: params.maxMembers,
				}),
			};
			await data.upsert("membershipPlan", id, plan as Record<string, unknown>);
			return plan;
		},

		async getPlan(id) {
			const raw = await data.get("membershipPlan", id);
			return raw as unknown as MembershipPlan;
		},

		async getPlanBySlug(slug) {
			const results = (await data.findMany("membershipPlan", {
				where: { slug },
			})) as unknown as MembershipPlan[];
			return results[0] ?? null;
		},

		async updatePlan(id, params) {
			const existing = await data.get("membershipPlan", id);
			if (!existing) return null;

			const current = existing as unknown as MembershipPlan;

			const base: MembershipPlan = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				price: params.price ?? current.price,
				billingInterval: params.billingInterval ?? current.billingInterval,
				trialDays: params.trialDays ?? current.trialDays,
				isActive: params.isActive ?? current.isActive,
				sortOrder: params.sortOrder ?? current.sortOrder,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const optionalFields: Partial<MembershipPlan> = {};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) optionalFields.description = descVal;

			const featVal =
				params.features === null ? null : (params.features ?? current.features);
			if (featVal != null) optionalFields.features = featVal;

			const maxVal =
				params.maxMembers === null
					? null
					: (params.maxMembers ?? current.maxMembers);
			if (maxVal != null) optionalFields.maxMembers = maxVal;

			const updated: MembershipPlan = { ...base, ...optionalFields };

			await data.upsert(
				"membershipPlan",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deletePlan(id) {
			const existing = await data.get("membershipPlan", id);
			if (!existing) return false;

			// Cascade: remove benefits
			const benefits = (await data.findMany("membershipBenefit", {
				where: { planId: id },
			})) as unknown as MembershipBenefit[];
			for (const b of benefits) {
				await data.delete("membershipBenefit", b.id);
			}

			// Cascade: remove gated products
			const products = (await data.findMany("membershipProduct", {
				where: { planId: id },
			})) as unknown as MembershipProduct[];
			for (const p of products) {
				await data.delete("membershipProduct", p.id);
			}

			// Cascade: remove memberships
			const memberships = (await data.findMany("membership", {
				where: { planId: id },
			})) as unknown as Membership[];
			for (const m of memberships) {
				await data.delete("membership", m.id);
			}

			await data.delete("membershipPlan", id);
			return true;
		},

		async listPlans(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			return (await data.findMany(
				"membershipPlan",
				buildFindOptions({
					where,
					orderBy: { sortOrder: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as MembershipPlan[];
		},

		async countPlans(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const results = (await data.findMany("membershipPlan", {
				where,
			})) as unknown as MembershipPlan[];
			return results.length;
		},

		// ── Memberships ───────────────────────────────────

		async subscribe(params) {
			const plan = await data.get("membershipPlan", params.planId);
			if (!plan) throw new Error("Plan not found");

			const typed = plan as unknown as MembershipPlan;
			if (!typed.isActive) throw new Error("Plan is not active");

			// Check max members limit
			if (typed.maxMembers != null) {
				const existing = (await data.findMany("membership", {
					where: { planId: params.planId, status: "active" },
				})) as unknown as Membership[];
				const trialMembers = (await data.findMany("membership", {
					where: { planId: params.planId, status: "trial" },
				})) as unknown as Membership[];
				if (existing.length + trialMembers.length >= typed.maxMembers) {
					throw new Error("Plan has reached maximum members");
				}
			}

			// Cancel any existing active/trial membership for this customer
			const current = (await data.findMany("membership", {
				where: { customerId: params.customerId },
			})) as unknown as Membership[];
			for (const m of current) {
				if (m.status === "active" || m.status === "trial") {
					const cancelled: Membership = {
						...m,
						status: "cancelled",
						cancelledAt: new Date(),
						updatedAt: new Date(),
					};
					await data.upsert(
						"membership",
						m.id,
						cancelled as Record<string, unknown>,
					);
				}
			}

			const id = crypto.randomUUID();
			const now = new Date();
			const hasTrial = typed.trialDays > 0;

			const membership: Membership = {
				id,
				customerId: params.customerId,
				planId: params.planId,
				status: hasTrial ? "trial" : "active",
				startDate: now,
				createdAt: now,
				updatedAt: now,
			};

			if (hasTrial) {
				const trialEnd = new Date(now);
				trialEnd.setDate(trialEnd.getDate() + typed.trialDays);
				membership.trialEndDate = trialEnd;
			}

			if (typed.billingInterval !== "lifetime") {
				const endDate = new Date(now);
				if (typed.billingInterval === "monthly") {
					endDate.setMonth(endDate.getMonth() + 1);
				} else {
					endDate.setFullYear(endDate.getFullYear() + 1);
				}
				membership.endDate = endDate;
			}

			await data.upsert(
				"membership",
				id,
				membership as Record<string, unknown>,
			);
			return membership;
		},

		async cancelMembership(id) {
			const existing = await data.get("membership", id);
			if (!existing) return null;

			const current = existing as unknown as Membership;
			if (current.status === "cancelled" || current.status === "expired") {
				return current;
			}

			const updated: Membership = {
				...current,
				status: "cancelled",
				cancelledAt: new Date(),
				updatedAt: new Date(),
			};

			await data.upsert("membership", id, updated as Record<string, unknown>);
			return updated;
		},

		async pauseMembership(id) {
			const existing = await data.get("membership", id);
			if (!existing) return null;

			const current = existing as unknown as Membership;
			if (current.status !== "active" && current.status !== "trial") {
				return current;
			}

			const updated: Membership = {
				...current,
				status: "paused",
				pausedAt: new Date(),
				updatedAt: new Date(),
			};

			await data.upsert("membership", id, updated as Record<string, unknown>);
			return updated;
		},

		async resumeMembership(id) {
			const existing = await data.get("membership", id);
			if (!existing) return null;

			const current = existing as unknown as Membership;
			if (current.status !== "paused") return current;

			const updated: Membership = {
				...current,
				status: "active",
				updatedAt: new Date(),
			};

			await data.upsert("membership", id, updated as Record<string, unknown>);
			return updated;
		},

		async getMembership(id) {
			const raw = await data.get("membership", id);
			return raw as unknown as Membership;
		},

		async getCustomerMembership(customerId) {
			const memberships = (await data.findMany("membership", {
				where: { customerId },
			})) as unknown as Membership[];

			// Find the most relevant membership: active > trial > paused
			const active = memberships.find(
				(m) =>
					m.status === "active" ||
					m.status === "trial" ||
					m.status === "paused",
			);
			if (!active) return null;

			const plan = await data.get("membershipPlan", active.planId);
			if (!plan) return null;

			return {
				...active,
				plan: plan as unknown as MembershipPlan,
			};
		},

		async listMemberships(params) {
			const where: Record<string, unknown> = {};
			if (params?.planId !== undefined) where.planId = params.planId;
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"membership",
				buildFindOptions({
					where,
					orderBy: { createdAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Membership[];
		},

		async countMemberships(params) {
			const where: Record<string, unknown> = {};
			if (params?.planId !== undefined) where.planId = params.planId;
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("membership", {
				where,
			})) as unknown as Membership[];
			return results.length;
		},

		// ── Benefits ──────────────────────────────────────

		async addBenefit(params) {
			const id = crypto.randomUUID();
			const benefit: MembershipBenefit = {
				id,
				planId: params.planId,
				type: params.type,
				value: params.value,
				isActive: params.isActive ?? true,
				createdAt: new Date(),
				...(params.description != null && {
					description: params.description,
				}),
			};
			await data.upsert(
				"membershipBenefit",
				id,
				benefit as Record<string, unknown>,
			);
			return benefit;
		},

		async removeBenefit(id) {
			const existing = await data.get("membershipBenefit", id);
			if (!existing) return false;
			await data.delete("membershipBenefit", id);
			return true;
		},

		async listBenefits(planId) {
			return (await data.findMany("membershipBenefit", {
				where: { planId },
			})) as unknown as MembershipBenefit[];
		},

		async getCustomerBenefits(customerId) {
			const memberships = (await data.findMany("membership", {
				where: { customerId },
			})) as unknown as Membership[];

			const active = memberships.find(
				(m) => m.status === "active" || m.status === "trial",
			);
			if (!active) return [];

			const benefits = (await data.findMany("membershipBenefit", {
				where: { planId: active.planId, isActive: true },
			})) as unknown as MembershipBenefit[];

			return benefits;
		},

		// ── Product gating ────────────────────────────────

		async gateProduct(params) {
			// Check if already gated to this plan
			const existing = (await data.findMany("membershipProduct", {
				where: { planId: params.planId, productId: params.productId },
			})) as unknown as MembershipProduct[];

			if (existing.length > 0) return existing[0];

			const id = crypto.randomUUID();
			const gated: MembershipProduct = {
				id,
				planId: params.planId,
				productId: params.productId,
				assignedAt: new Date(),
			};
			await data.upsert(
				"membershipProduct",
				id,
				gated as Record<string, unknown>,
			);
			return gated;
		},

		async ungateProduct(params) {
			const existing = (await data.findMany("membershipProduct", {
				where: { planId: params.planId, productId: params.productId },
			})) as unknown as MembershipProduct[];

			if (existing.length === 0) return false;

			for (const item of existing) {
				await data.delete("membershipProduct", item.id);
			}
			return true;
		},

		async listGatedProducts(params) {
			return (await data.findMany(
				"membershipProduct",
				buildFindOptions({
					where: { planId: params.planId },
					orderBy: { assignedAt: "desc" },
					take: params.take,
					skip: params.skip,
				}),
			)) as unknown as MembershipProduct[];
		},

		async countGatedProducts(planId) {
			const results = (await data.findMany("membershipProduct", {
				where: { planId },
			})) as unknown as MembershipProduct[];
			return results.length;
		},

		async canAccessProduct(params) {
			// Check if the product is gated at all
			const gated = (await data.findMany("membershipProduct", {
				where: { productId: params.productId },
			})) as unknown as MembershipProduct[];

			// Not gated — everyone can access
			if (gated.length === 0) return true;

			// Gated — check if customer has an active membership for any qualifying plan
			const memberships = (await data.findMany("membership", {
				where: { customerId: params.customerId },
			})) as unknown as Membership[];

			const activeMembership = memberships.find(
				(m) => m.status === "active" || m.status === "trial",
			);
			if (!activeMembership) return false;

			return gated.some((g) => g.planId === activeMembership.planId);
		},

		// ── Admin ─────────────────────────────────────────

		async getStats() {
			const allPlans = (await data.findMany(
				"membershipPlan",
				{},
			)) as unknown as MembershipPlan[];
			const allMemberships = (await data.findMany(
				"membership",
				{},
			)) as unknown as Membership[];
			const allGated = (await data.findMany(
				"membershipProduct",
				{},
			)) as unknown as MembershipProduct[];

			const stats: MembershipStats = {
				totalPlans: allPlans.length,
				activePlans: allPlans.filter((p) => p.isActive).length,
				totalMembers: allMemberships.length,
				activeMembers: allMemberships.filter((m) => m.status === "active")
					.length,
				trialMembers: allMemberships.filter((m) => m.status === "trial").length,
				cancelledMembers: allMemberships.filter((m) => m.status === "cancelled")
					.length,
				gatedProducts: new Set(allGated.map((g) => g.productId)).size,
			};
			return stats;
		},
	};
}
