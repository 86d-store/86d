import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWarrantyController } from "../service-impl";

// --- Test data factories ---

const makePlan = (overrides?: Record<string, unknown>) => ({
	name: "Standard Warranty",
	type: "manufacturer" as const,
	durationMonths: 12,
	price: 0,
	...overrides,
});

const makeRegistration = (
	warrantyPlanId: string,
	overrides?: Record<string, unknown>,
) => ({
	warrantyPlanId,
	orderId: "order_1",
	customerId: "cust_1",
	productId: "prod_1",
	productName: "Widget Pro",
	...overrides,
});

const makeClaim = (
	warrantyRegistrationId: string,
	overrides?: Record<string, unknown>,
) => ({
	warrantyRegistrationId,
	customerId: "cust_1",
	issueType: "defect" as const,
	issueDescription: "The product stopped working after normal use",
	...overrides,
});

describe("createWarrantyController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWarrantyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWarrantyController(mockData);
	});

	// ==================== Plans ====================

	describe("createPlan", () => {
		it("creates a warranty plan", async () => {
			const plan = await controller.createPlan(makePlan());
			expect(plan.id).toBeDefined();
			expect(plan.name).toBe("Standard Warranty");
			expect(plan.type).toBe("manufacturer");
			expect(plan.durationMonths).toBe(12);
			expect(plan.price).toBe(0);
			expect(plan.isActive).toBe(true);
			expect(plan.createdAt).toBeInstanceOf(Date);
			expect(plan.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a plan with optional fields", async () => {
			const plan = await controller.createPlan(
				makePlan({
					description: "Covers manufacturing defects",
					coverageDetails: "Full parts and labor",
					exclusions: "Accidental damage not covered",
					productId: "prod_1",
					price: 49.99,
				}),
			);
			expect(plan.description).toBe("Covers manufacturing defects");
			expect(plan.coverageDetails).toBe("Full parts and labor");
			expect(plan.exclusions).toBe("Accidental damage not covered");
			expect(plan.productId).toBe("prod_1");
			expect(plan.price).toBe(49.99);
		});

		it("defaults price to 0", async () => {
			const plan = await controller.createPlan(makePlan({ price: undefined }));
			expect(plan.price).toBe(0);
		});

		it("throws for zero duration", async () => {
			await expect(
				controller.createPlan(makePlan({ durationMonths: 0 })),
			).rejects.toThrow("Duration must be greater than zero");
		});

		it("throws for negative duration", async () => {
			await expect(
				controller.createPlan(makePlan({ durationMonths: -1 })),
			).rejects.toThrow("Duration must be greater than zero");
		});
	});

	describe("updatePlan", () => {
		it("updates plan fields", async () => {
			const plan = await controller.createPlan(makePlan());
			const updated = await controller.updatePlan(plan.id, {
				name: "Premium Warranty",
				price: 99.99,
			});
			expect(updated?.name).toBe("Premium Warranty");
			expect(updated?.price).toBe(99.99);
			expect(updated?.type).toBe("manufacturer");
		});

		it("returns null for nonexistent plan", async () => {
			const result = await controller.updatePlan("nonexistent", {
				name: "x",
			});
			expect(result).toBeNull();
		});

		it("deactivates a plan", async () => {
			const plan = await controller.createPlan(makePlan());
			const updated = await controller.updatePlan(plan.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("throws for zero duration update", async () => {
			const plan = await controller.createPlan(makePlan());
			await expect(
				controller.updatePlan(plan.id, { durationMonths: 0 }),
			).rejects.toThrow("Duration must be greater than zero");
		});
	});

	describe("getPlan", () => {
		it("returns plan by id", async () => {
			const created = await controller.createPlan(makePlan());
			const plan = await controller.getPlan(created.id);
			expect(plan?.name).toBe("Standard Warranty");
		});

		it("returns null for nonexistent plan", async () => {
			const plan = await controller.getPlan("nonexistent");
			expect(plan).toBeNull();
		});
	});

	describe("listPlans", () => {
		it("lists all plans", async () => {
			await controller.createPlan(makePlan());
			await controller.createPlan(
				makePlan({ name: "Extended", type: "extended" }),
			);
			const plans = await controller.listPlans();
			expect(plans).toHaveLength(2);
		});

		it("filters by type", async () => {
			await controller.createPlan(makePlan());
			await controller.createPlan(
				makePlan({ name: "Extended", type: "extended" }),
			);
			const plans = await controller.listPlans({ type: "extended" });
			expect(plans).toHaveLength(1);
			expect(plans[0].type).toBe("extended");
		});

		it("filters by productId", async () => {
			await controller.createPlan(makePlan({ productId: "prod_1" }));
			await controller.createPlan(
				makePlan({ name: "Other", productId: "prod_2" }),
			);
			const plans = await controller.listPlans({
				productId: "prod_1",
			});
			expect(plans).toHaveLength(1);
		});

		it("filters active only", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.createPlan(makePlan({ name: "Other" }));
			await controller.updatePlan(plan.id, { isActive: false });
			const plans = await controller.listPlans({ activeOnly: true });
			expect(plans).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await controller.createPlan(makePlan({ name: "A" }));
			await controller.createPlan(makePlan({ name: "B" }));
			await controller.createPlan(makePlan({ name: "C" }));
			const plans = await controller.listPlans({ take: 2 });
			expect(plans).toHaveLength(2);
		});
	});

	describe("deletePlan", () => {
		it("deletes a plan", async () => {
			const plan = await controller.createPlan(makePlan());
			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);
			const fetched = await controller.getPlan(plan.id);
			expect(fetched).toBeNull();
		});

		it("returns false for nonexistent plan", async () => {
			const result = await controller.deletePlan("nonexistent");
			expect(result).toBe(false);
		});

		it("throws when deleting a plan with active registrations", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.register(makeRegistration(plan.id));
			await expect(controller.deletePlan(plan.id)).rejects.toThrow(
				"Cannot delete a plan with active registrations",
			);
		});
	});

	// ==================== Registrations ====================

	describe("register", () => {
		it("registers a warranty for a customer", async () => {
			const plan = await controller.createPlan(
				makePlan({ durationMonths: 24 }),
			);
			const reg = await controller.register(makeRegistration(plan.id));
			expect(reg.id).toBeDefined();
			expect(reg.warrantyPlanId).toBe(plan.id);
			expect(reg.orderId).toBe("order_1");
			expect(reg.customerId).toBe("cust_1");
			expect(reg.productName).toBe("Widget Pro");
			expect(reg.status).toBe("active");
			expect(reg.purchaseDate).toBeInstanceOf(Date);
			expect(reg.expiresAt).toBeInstanceOf(Date);
		});

		it("calculates expiration from plan duration", async () => {
			const plan = await controller.createPlan(makePlan({ durationMonths: 6 }));
			const purchaseDate = new Date("2025-01-15");
			const reg = await controller.register(
				makeRegistration(plan.id, { purchaseDate }),
			);
			expect(reg.expiresAt.getFullYear()).toBe(2025);
			expect(reg.expiresAt.getMonth()).toBe(6); // July (0-indexed)
		});

		it("throws for nonexistent plan", async () => {
			await expect(
				controller.register(makeRegistration("nonexistent")),
			).rejects.toThrow("Warranty plan not found");
		});

		it("throws for inactive plan", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.updatePlan(plan.id, { isActive: false });
			await expect(
				controller.register(makeRegistration(plan.id)),
			).rejects.toThrow("Warranty plan is not active");
		});

		it("stores serial number", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(
				makeRegistration(plan.id, {
					serialNumber: "SN-12345",
				}),
			);
			expect(reg.serialNumber).toBe("SN-12345");
		});
	});

	describe("getRegistration", () => {
		it("returns registration by id", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const fetched = await controller.getRegistration(reg.id);
			expect(fetched?.productName).toBe("Widget Pro");
		});

		it("returns null for nonexistent registration", async () => {
			const result = await controller.getRegistration("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getRegistrationsByCustomer", () => {
		it("returns registrations for a customer", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.register(makeRegistration(plan.id));
			await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_2",
					productName: "Other",
				}),
			);
			const regs = await controller.getRegistrationsByCustomer("cust_1");
			expect(regs).toHaveLength(1);
			expect(regs[0].customerId).toBe("cust_1");
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.register(
				makeRegistration(plan.id, {
					orderId: "order_2",
					productName: "Other",
				}),
			);
			await controller.voidRegistration(reg.id, "Refunded");
			const active = await controller.getRegistrationsByCustomer("cust_1", {
				status: "active",
			});
			expect(active).toHaveLength(1);
		});
	});

	describe("listRegistrations", () => {
		it("lists all registrations", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.register(makeRegistration(plan.id));
			await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_2",
					productName: "Other",
				}),
			);
			const regs = await controller.listRegistrations();
			expect(regs).toHaveLength(2);
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_2",
					productName: "Other",
				}),
			);
			await controller.voidRegistration(reg.id, "Refunded");
			const voided = await controller.listRegistrations({
				status: "voided",
			});
			expect(voided).toHaveLength(1);
		});
	});

	describe("voidRegistration", () => {
		it("voids an active registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const voided = await controller.voidRegistration(
				reg.id,
				"Customer refunded",
			);
			expect(voided?.status).toBe("voided");
			expect(voided?.voidReason).toBe("Customer refunded");
		});

		it("returns null for nonexistent registration", async () => {
			const result = await controller.voidRegistration("nonexistent", "reason");
			expect(result).toBeNull();
		});

		it("throws when voiding non-active registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.voidRegistration(reg.id, "reason");
			await expect(
				controller.voidRegistration(reg.id, "again"),
			).rejects.toThrow('Cannot void a registration with status "voided"');
		});
	});

	// ==================== Claims ====================

	describe("submitClaim", () => {
		it("submits a claim against active registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			expect(claim.id).toBeDefined();
			expect(claim.warrantyRegistrationId).toBe(reg.id);
			expect(claim.customerId).toBe("cust_1");
			expect(claim.issueType).toBe("defect");
			expect(claim.status).toBe("submitted");
			expect(claim.submittedAt).toBeInstanceOf(Date);
		});

		it("throws for nonexistent registration", async () => {
			await expect(
				controller.submitClaim(makeClaim("nonexistent")),
			).rejects.toThrow("Warranty registration not found");
		});

		it("throws for voided registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.voidRegistration(reg.id, "refunded");
			await expect(controller.submitClaim(makeClaim(reg.id))).rejects.toThrow(
				'Cannot submit claim for registration with status "voided"',
			);
		});

		it("throws when customer does not own warranty", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await expect(
				controller.submitClaim(makeClaim(reg.id, { customerId: "cust_other" })),
			).rejects.toThrow("Customer does not own this warranty");
		});

		it("throws for expired warranty", async () => {
			const plan = await controller.createPlan(makePlan({ durationMonths: 1 }));
			const pastDate = new Date("2020-01-01");
			const reg = await controller.register(
				makeRegistration(plan.id, { purchaseDate: pastDate }),
			);
			await expect(controller.submitClaim(makeClaim(reg.id))).rejects.toThrow(
				"Warranty has expired",
			);
		});
	});

	describe("getClaim", () => {
		it("returns claim by id", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const fetched = await controller.getClaim(claim.id);
			expect(fetched?.issueType).toBe("defect");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.getClaim("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getClaimsByRegistration", () => {
		it("returns claims for a registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.submitClaim(makeClaim(reg.id));
			await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);
			const claims = await controller.getClaimsByRegistration(reg.id);
			expect(claims).toHaveLength(2);
		});
	});

	describe("getClaimsByCustomer", () => {
		it("returns claims for a customer", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.submitClaim(makeClaim(reg.id));
			const claims = await controller.getClaimsByCustomer("cust_1");
			expect(claims).toHaveLength(1);
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);
			await controller.reviewClaim(claim.id);
			const submitted = await controller.getClaimsByCustomer("cust_1", {
				status: "submitted",
			});
			expect(submitted).toHaveLength(1);
		});
	});

	describe("listClaims", () => {
		it("lists all claims", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.submitClaim(makeClaim(reg.id));
			await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);
			const claims = await controller.listClaims();
			expect(claims).toHaveLength(2);
		});

		it("filters by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);
			await controller.reviewClaim(claim.id);
			const underReview = await controller.listClaims({
				status: "under_review",
			});
			expect(underReview).toHaveLength(1);
		});

		it("supports pagination", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.submitClaim(makeClaim(reg.id));
			await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);
			await controller.submitClaim(makeClaim(reg.id, { issueType: "other" }));
			const claims = await controller.listClaims({ take: 2 });
			expect(claims).toHaveLength(2);
		});
	});

	// ==================== Claim workflow ====================

	describe("reviewClaim", () => {
		it("moves submitted claim to under_review", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const reviewed = await controller.reviewClaim(claim.id);
			expect(reviewed?.status).toBe("under_review");
		});

		it("stores admin notes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const reviewed = await controller.reviewClaim(
				claim.id,
				"Checking photos",
			);
			expect(reviewed?.adminNotes).toBe("Checking photos");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.reviewClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("throws for non-submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "under_review"',
			);
		});
	});

	describe("approveClaim", () => {
		it("approves a submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const approved = await controller.approveClaim(claim.id, "repair");
			expect(approved?.status).toBe("approved");
			expect(approved?.resolution).toBe("repair");
		});

		it("approves an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			const approved = await controller.approveClaim(
				claim.id,
				"replace",
				"Parts unavailable, replacing unit",
			);
			expect(approved?.status).toBe("approved");
			expect(approved?.resolution).toBe("replace");
			expect(approved?.adminNotes).toBe("Parts unavailable, replacing unit");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.approveClaim("nonexistent", "repair");
			expect(result).toBeNull();
		});

		it("throws for already approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "approved"');
		});
	});

	describe("denyClaim", () => {
		it("denies a submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const denied = await controller.denyClaim(
				claim.id,
				"Not covered under warranty terms",
			);
			expect(denied?.status).toBe("denied");
			expect(denied?.adminNotes).toBe("Not covered under warranty terms");
			expect(denied?.resolvedAt).toBeInstanceOf(Date);
		});

		it("denies an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			const denied = await controller.denyClaim(claim.id);
			expect(denied?.status).toBe("denied");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.denyClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("throws for already denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "denied"',
			);
		});

		it("throws for resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "resolved"',
			);
		});
	});

	describe("startRepair", () => {
		it("starts repair on approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const repaired = await controller.startRepair(claim.id);
			expect(repaired?.status).toBe("in_repair");
		});

		it("stores admin notes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const repaired = await controller.startRepair(
				claim.id,
				"Sent to repair center",
			);
			expect(repaired?.adminNotes).toBe("Sent to repair center");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.startRepair("nonexistent");
			expect(result).toBeNull();
		});

		it("throws for non-approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "submitted"',
			);
		});
	});

	describe("resolveClaim", () => {
		it("resolves an approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "replace");
			const resolved = await controller.resolveClaim(
				claim.id,
				"Replacement shipped",
			);
			expect(resolved?.status).toBe("resolved");
			expect(resolved?.resolutionNotes).toBe("Replacement shipped");
			expect(resolved?.resolvedAt).toBeInstanceOf(Date);
		});

		it("resolves an in_repair claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			const resolved = await controller.resolveClaim(
				claim.id,
				"Repair completed",
			);
			expect(resolved?.status).toBe("resolved");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.resolveClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("throws for submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "submitted"',
			);
		});
	});

	describe("closeClaim", () => {
		it("closes a resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			const closed = await controller.closeClaim(claim.id);
			expect(closed?.status).toBe("closed");
		});

		it("returns null for nonexistent claim", async () => {
			const result = await controller.closeClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("throws for non-resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "submitted"',
			);
		});
	});

	describe("getClaimSummary", () => {
		it("returns empty summary when no claims", async () => {
			const summary = await controller.getClaimSummary();
			expect(summary.totalClaims).toBe(0);
			expect(summary.submitted).toBe(0);
			expect(summary.underReview).toBe(0);
			expect(summary.approved).toBe(0);
			expect(summary.denied).toBe(0);
			expect(summary.inRepair).toBe(0);
			expect(summary.resolved).toBe(0);
			expect(summary.closed).toBe(0);
		});

		it("counts claims by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			// 2 submitted
			await controller.submitClaim(makeClaim(reg.id));
			const claim2 = await controller.submitClaim(
				makeClaim(reg.id, { issueType: "malfunction" }),
			);

			// 1 under_review
			const claim3 = await controller.submitClaim(
				makeClaim(reg.id, { issueType: "other" }),
			);
			await controller.reviewClaim(claim3.id);

			// 1 approved
			await controller.approveClaim(claim2.id, "replace");

			const summary = await controller.getClaimSummary();
			expect(summary.totalClaims).toBe(3);
			expect(summary.submitted).toBe(1);
			expect(summary.underReview).toBe(1);
			expect(summary.approved).toBe(1);
		});
	});

	// ==================== Full workflow ====================

	describe("full claim lifecycle", () => {
		it("completes the full claim workflow: submit -> review -> approve -> repair -> resolve -> close", async () => {
			const plan = await controller.createPlan(
				makePlan({
					name: "Extended Protection",
					type: "extended",
					durationMonths: 36,
					price: 79.99,
				}),
			);
			const reg = await controller.register(
				makeRegistration(plan.id, {
					serialNumber: "SN-2025-001",
				}),
			);

			// Submit claim
			const claim = await controller.submitClaim(
				makeClaim(reg.id, {
					issueType: "malfunction",
					issueDescription: "Screen flickering intermittently",
				}),
			);
			expect(claim.status).toBe("submitted");

			// Review
			const reviewed = await controller.reviewClaim(
				claim.id,
				"Reviewing attached photos",
			);
			expect(reviewed?.status).toBe("under_review");

			// Approve with repair resolution
			const approved = await controller.approveClaim(
				claim.id,
				"repair",
				"Approved for display repair",
			);
			expect(approved?.status).toBe("approved");
			expect(approved?.resolution).toBe("repair");

			// Start repair
			const repaired = await controller.startRepair(
				claim.id,
				"Shipped to service center",
			);
			expect(repaired?.status).toBe("in_repair");

			// Resolve
			const resolved = await controller.resolveClaim(
				claim.id,
				"Display replaced and tested",
			);
			expect(resolved?.status).toBe("resolved");
			expect(resolved?.resolvedAt).toBeInstanceOf(Date);

			// Close
			const closed = await controller.closeClaim(claim.id);
			expect(closed?.status).toBe("closed");
		});

		it("handles the deny path: submit -> deny", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(
				makeClaim(reg.id, {
					issueType: "wear_and_tear",
					issueDescription: "Normal wear after 3 years",
				}),
			);

			const denied = await controller.denyClaim(
				claim.id,
				"Wear and tear is not covered",
			);
			expect(denied?.status).toBe("denied");
			expect(denied?.resolvedAt).toBeInstanceOf(Date);
		});
	});
});
