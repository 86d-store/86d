import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ClaimSummary,
	WarrantyClaim,
	WarrantyController,
	WarrantyPlan,
	WarrantyRegistration,
} from "./service";

const TERMINAL_CLAIM_STATUSES = new Set(["denied", "resolved", "closed"]);

export function createWarrantyController(
	data: ModuleDataService,
): WarrantyController {
	// --- Helpers ---

	async function updateClaim(
		id: string,
		updates: Record<string, unknown>,
	): Promise<WarrantyClaim | null> {
		const existing = await data.get("warrantyClaim", id);
		if (!existing) return null;

		const updated = {
			...(existing as unknown as WarrantyClaim),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("warrantyClaim", id, updated as Record<string, unknown>);
		return updated;
	}

	return {
		// ==================== Plans ====================

		async createPlan(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			if (params.durationMonths <= 0) {
				throw new Error("Duration must be greater than zero");
			}

			const plan: WarrantyPlan = {
				id,
				name: params.name,
				description: params.description,
				type: params.type,
				durationMonths: params.durationMonths,
				price: params.price ?? 0,
				coverageDetails: params.coverageDetails,
				exclusions: params.exclusions,
				isActive: true,
				productId: params.productId,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("warrantyPlan", id, plan as Record<string, unknown>);
			return plan;
		},

		async updatePlan(id, params) {
			const existing = await data.get("warrantyPlan", id);
			if (!existing) return null;

			if (params.durationMonths !== undefined && params.durationMonths <= 0) {
				throw new Error("Duration must be greater than zero");
			}

			const updated = {
				...(existing as unknown as WarrantyPlan),
				...Object.fromEntries(
					Object.entries(params).filter(([, v]) => v !== undefined),
				),
				updatedAt: new Date(),
			};

			await data.upsert("warrantyPlan", id, updated as Record<string, unknown>);
			return updated as WarrantyPlan;
		},

		async getPlan(id) {
			const raw = await data.get("warrantyPlan", id);
			if (!raw) return null;
			return raw as unknown as WarrantyPlan;
		},

		async listPlans(params) {
			const where: Record<string, unknown> = {};
			if (params?.type) where.type = params.type;
			if (params?.productId) where.productId = params.productId;
			if (params?.activeOnly) where.isActive = true;

			const raw = await data.findMany("warrantyPlan", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyPlan[];
		},

		async deletePlan(id) {
			const existing = await data.get("warrantyPlan", id);
			if (!existing) return false;

			const registrations = await data.findMany("warrantyRegistration", {
				where: { warrantyPlanId: id, status: "active" },
			});
			if ((registrations as unknown[]).length > 0) {
				throw new Error("Cannot delete a plan with active registrations");
			}

			await data.delete("warrantyPlan", id);
			return true;
		},

		// ==================== Registrations ====================

		async register(params) {
			const plan = await data.get("warrantyPlan", params.warrantyPlanId);
			if (!plan) {
				throw new Error("Warranty plan not found");
			}
			const planData = plan as unknown as WarrantyPlan;
			if (!planData.isActive) {
				throw new Error("Warranty plan is not active");
			}

			const id = crypto.randomUUID();
			const now = new Date();
			const purchaseDate = params.purchaseDate ?? now;
			const expiresAt = new Date(purchaseDate);
			expiresAt.setMonth(expiresAt.getMonth() + planData.durationMonths);

			const registration: WarrantyRegistration = {
				id,
				warrantyPlanId: params.warrantyPlanId,
				orderId: params.orderId,
				customerId: params.customerId,
				productId: params.productId,
				productName: params.productName,
				serialNumber: params.serialNumber,
				purchaseDate,
				expiresAt,
				status: "active",
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"warrantyRegistration",
				id,
				registration as Record<string, unknown>,
			);
			return registration;
		},

		async getRegistration(id) {
			const raw = await data.get("warrantyRegistration", id);
			if (!raw) return null;
			return raw as unknown as WarrantyRegistration;
		},

		async getRegistrationsByCustomer(customerId, params) {
			const where: Record<string, unknown> = { customerId };
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("warrantyRegistration", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyRegistration[];
		},

		async listRegistrations(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("warrantyRegistration", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyRegistration[];
		},

		async voidRegistration(id, reason) {
			const existing = await data.get("warrantyRegistration", id);
			if (!existing) return null;
			const reg = existing as unknown as WarrantyRegistration;

			if (reg.status !== "active") {
				throw new Error(
					`Cannot void a registration with status "${reg.status}"`,
				);
			}

			const updated: WarrantyRegistration = {
				...reg,
				status: "voided",
				voidReason: reason,
				updatedAt: new Date(),
			};

			await data.upsert(
				"warrantyRegistration",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ==================== Claims ====================

		async submitClaim(params) {
			const registration = await data.get(
				"warrantyRegistration",
				params.warrantyRegistrationId,
			);
			if (!registration) {
				throw new Error("Warranty registration not found");
			}
			const reg = registration as unknown as WarrantyRegistration;

			if (reg.status !== "active") {
				throw new Error(
					`Cannot submit claim for registration with status "${reg.status}"`,
				);
			}
			if (reg.customerId !== params.customerId) {
				throw new Error("Customer does not own this warranty");
			}

			const now = new Date();
			if (reg.expiresAt < now) {
				throw new Error("Warranty has expired");
			}

			const id = crypto.randomUUID();
			const claim: WarrantyClaim = {
				id,
				warrantyRegistrationId: params.warrantyRegistrationId,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				issueType: params.issueType,
				issueDescription: params.issueDescription,
				status: "submitted",
				submittedAt: now,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("warrantyClaim", id, claim as Record<string, unknown>);
			return claim;
		},

		async getClaim(id) {
			const raw = await data.get("warrantyClaim", id);
			if (!raw) return null;
			return raw as unknown as WarrantyClaim;
		},

		async getClaimsByRegistration(warrantyRegistrationId) {
			const raw = await data.findMany("warrantyClaim", {
				where: { warrantyRegistrationId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyClaim[];
		},

		async getClaimsByCustomer(customerId, params) {
			const where: Record<string, unknown> = { customerId };
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("warrantyClaim", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyClaim[];
		},

		async listClaims(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("warrantyClaim", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as WarrantyClaim[];
		},

		async reviewClaim(id, adminNotes) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (claim.status !== "submitted") {
				throw new Error(`Cannot review a claim with status "${claim.status}"`);
			}

			return updateClaim(id, {
				status: "under_review",
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async approveClaim(id, resolution, adminNotes) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (claim.status !== "submitted" && claim.status !== "under_review") {
				throw new Error(`Cannot approve a claim with status "${claim.status}"`);
			}

			return updateClaim(id, {
				status: "approved",
				resolution,
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async denyClaim(id, adminNotes) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (TERMINAL_CLAIM_STATUSES.has(claim.status)) {
				throw new Error(`Cannot deny a claim with status "${claim.status}"`);
			}

			return updateClaim(id, {
				status: "denied",
				resolvedAt: new Date(),
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async startRepair(id, adminNotes) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (claim.status !== "approved") {
				throw new Error(
					`Cannot start repair for a claim with status "${claim.status}"`,
				);
			}

			return updateClaim(id, {
				status: "in_repair",
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async resolveClaim(id, resolutionNotes) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (claim.status !== "approved" && claim.status !== "in_repair") {
				throw new Error(`Cannot resolve a claim with status "${claim.status}"`);
			}

			return updateClaim(id, {
				status: "resolved",
				resolvedAt: new Date(),
				...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
			});
		},

		async closeClaim(id) {
			const existing = await data.get("warrantyClaim", id);
			if (!existing) return null;
			const claim = existing as unknown as WarrantyClaim;

			if (claim.status !== "resolved") {
				throw new Error(`Cannot close a claim with status "${claim.status}"`);
			}

			return updateClaim(id, {
				status: "closed",
			});
		},

		async getClaimSummary() {
			const all = await data.findMany("warrantyClaim", {});
			const claims = all as unknown as WarrantyClaim[];

			const summary: ClaimSummary = {
				totalClaims: claims.length,
				submitted: 0,
				underReview: 0,
				approved: 0,
				denied: 0,
				inRepair: 0,
				resolved: 0,
				closed: 0,
			};

			for (const claim of claims) {
				switch (claim.status) {
					case "submitted":
						summary.submitted++;
						break;
					case "under_review":
						summary.underReview++;
						break;
					case "approved":
						summary.approved++;
						break;
					case "denied":
						summary.denied++;
						break;
					case "in_repair":
						summary.inRepair++;
						break;
					case "resolved":
						summary.resolved++;
						break;
					case "closed":
						summary.closed++;
						break;
				}
			}

			return summary;
		},
	};
}
