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

describe("warranties controller — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWarrantyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWarrantyController(mockData);
	});

	// ── Plan creation edge cases ─────────────────────────────────────

	describe("createPlan — edge cases", () => {
		it("creates plans with all warranty plan types", async () => {
			const types = ["manufacturer", "extended", "accidental_damage"] as const;
			for (const type of types) {
				const plan = await controller.createPlan(makePlan({ type }));
				expect(plan.type).toBe(type);
				expect(plan.isActive).toBe(true);
			}
		});

		it("creates plan with fractional price", async () => {
			const plan = await controller.createPlan(makePlan({ price: 19.99 }));
			expect(plan.price).toBe(19.99);
		});

		it("creates plan with large duration", async () => {
			const plan = await controller.createPlan(
				makePlan({ durationMonths: 120 }),
			);
			expect(plan.durationMonths).toBe(120);
		});

		it("assigns unique ids to multiple plans", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const plan = await controller.createPlan(
					makePlan({ name: `Plan ${i}` }),
				);
				ids.add(plan.id);
			}
			expect(ids.size).toBe(10);
		});

		it("sets createdAt and updatedAt to the same value on creation", async () => {
			const plan = await controller.createPlan(makePlan());
			expect(plan.createdAt.getTime()).toBe(plan.updatedAt.getTime());
		});
	});

	// ── Plan update edge cases ───────────────────────────────────────

	describe("updatePlan — edge cases", () => {
		it("preserves unmodified fields on partial update", async () => {
			const plan = await controller.createPlan(
				makePlan({
					description: "Keep me",
					coverageDetails: "Full coverage",
					exclusions: "Water damage",
					price: 49.99,
				}),
			);

			const updated = await controller.updatePlan(plan.id, {
				name: "Changed Name",
			});

			expect(updated?.name).toBe("Changed Name");
			expect(updated?.description).toBe("Keep me");
			expect(updated?.coverageDetails).toBe("Full coverage");
			expect(updated?.exclusions).toBe("Water damage");
			expect(updated?.price).toBe(49.99);
			expect(updated?.type).toBe("manufacturer");
		});

		it("updates updatedAt timestamp on update", async () => {
			const plan = await controller.createPlan(makePlan());
			const updated = await controller.updatePlan(plan.id, {
				name: "New Name",
			});
			expect(updated?.updatedAt).toBeInstanceOf(Date);
		});

		it("can deactivate and reactivate a plan", async () => {
			const plan = await controller.createPlan(makePlan());

			const deactivated = await controller.updatePlan(plan.id, {
				isActive: false,
			});
			expect(deactivated?.isActive).toBe(false);

			const reactivated = await controller.updatePlan(plan.id, {
				isActive: true,
			});
			expect(reactivated?.isActive).toBe(true);
		});

		it("throws for negative duration update", async () => {
			const plan = await controller.createPlan(makePlan());
			await expect(
				controller.updatePlan(plan.id, { durationMonths: -5 }),
			).rejects.toThrow("Duration must be greater than zero");
		});

		it("allows updating only description", async () => {
			const plan = await controller.createPlan(makePlan());
			const updated = await controller.updatePlan(plan.id, {
				description: "New description",
			});
			expect(updated?.description).toBe("New description");
			expect(updated?.name).toBe("Standard Warranty");
		});
	});

	// ── Plan listing with combined filters ────────────────────────────

	describe("listPlans — combined filters", () => {
		it("filters by type and activeOnly together", async () => {
			const p1 = await controller.createPlan(
				makePlan({ type: "extended", name: "Ext Active" }),
			);
			await controller.createPlan(
				makePlan({ type: "extended", name: "Ext Inactive" }),
			);
			await controller.createPlan(
				makePlan({ type: "manufacturer", name: "Mfr Active" }),
			);

			// Deactivate second plan
			const plans = await controller.listPlans({ type: "extended" });
			const secondExt = plans.find((p) => p.name === "Ext Inactive");
			if (secondExt) {
				await controller.updatePlan(secondExt.id, { isActive: false });
			}

			const result = await controller.listPlans({
				type: "extended",
				activeOnly: true,
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(p1.id);
		});

		it("returns empty array when no plans match", async () => {
			await controller.createPlan(makePlan({ type: "manufacturer" }));
			const result = await controller.listPlans({
				type: "accidental_damage",
			});
			expect(result).toHaveLength(0);
		});

		it("supports skip and take together", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPlan(makePlan({ name: `Plan ${i}` }));
			}
			const page = await controller.listPlans({ skip: 1, take: 2 });
			expect(page).toHaveLength(2);
		});

		it("skip beyond total returns empty array", async () => {
			await controller.createPlan(makePlan());
			const result = await controller.listPlans({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("returns empty when no plans exist", async () => {
			const plans = await controller.listPlans();
			expect(plans).toHaveLength(0);
		});
	});

	// ── Plan deletion edge cases ─────────────────────────────────────

	describe("deletePlan — edge cases", () => {
		it("allows deletion after all registrations are voided", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.voidRegistration(reg.id, "Cancelled");

			const deleted = await controller.deletePlan(plan.id);
			expect(deleted).toBe(true);
		});

		it("prevents deletion with multiple active registrations", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.register(
				makeRegistration(plan.id, { orderId: "order_1" }),
			);
			await controller.register(
				makeRegistration(plan.id, {
					orderId: "order_2",
					customerId: "cust_2",
				}),
			);

			await expect(controller.deletePlan(plan.id)).rejects.toThrow(
				"Cannot delete a plan with active registrations",
			);
		});

		it("deleted plan cannot be fetched", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.deletePlan(plan.id);
			const fetched = await controller.getPlan(plan.id);
			expect(fetched).toBeNull();
		});
	});

	// ── Registration edge cases ──────────────────────────────────────

	describe("register — edge cases", () => {
		it("defaults purchaseDate to current time when not provided", async () => {
			const plan = await controller.createPlan(makePlan());
			const before = new Date();
			const reg = await controller.register(makeRegistration(plan.id));
			const after = new Date();

			expect(reg.purchaseDate.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(reg.purchaseDate.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("calculates correct expiration for 24-month plan", async () => {
			const plan = await controller.createPlan(
				makePlan({ durationMonths: 24 }),
			);
			// Use local date constructor to avoid UTC/local timezone mismatch
			const purchaseDate = new Date(2025, 5, 15); // June 15, 2025
			const reg = await controller.register(
				makeRegistration(plan.id, { purchaseDate }),
			);
			expect(reg.expiresAt.getFullYear()).toBe(2027);
			expect(reg.expiresAt.getMonth()).toBe(5); // June (0-indexed)
			expect(reg.expiresAt.getDate()).toBe(15);
		});

		it("allows multiple registrations on the same plan for different customers", async () => {
			const plan = await controller.createPlan(makePlan());

			const reg1 = await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_1",
					orderId: "order_1",
				}),
			);
			const reg2 = await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_2",
					orderId: "order_2",
				}),
			);

			expect(reg1.id).not.toBe(reg2.id);
			expect(reg1.warrantyPlanId).toBe(reg2.warrantyPlanId);
		});

		it("rejects registration on deactivated plan even if recently active", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.updatePlan(plan.id, { isActive: false });

			await expect(
				controller.register(makeRegistration(plan.id)),
			).rejects.toThrow("Warranty plan is not active");
		});
	});

	// ── Registration listing combined filters ────────────────────────

	describe("getRegistrationsByCustomer — combined filters", () => {
		it("supports pagination with take and skip", async () => {
			const plan = await controller.createPlan(makePlan());
			for (let i = 0; i < 5; i++) {
				await controller.register(
					makeRegistration(plan.id, {
						orderId: `order_${i}`,
						productName: `Product ${i}`,
					}),
				);
			}

			const page = await controller.getRegistrationsByCustomer("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty for customer with no registrations", async () => {
			const result =
				await controller.getRegistrationsByCustomer("cust_nonexistent");
			expect(result).toHaveLength(0);
		});

		it("filters voided registrations by status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg1 = await controller.register(
				makeRegistration(plan.id, { orderId: "order_1" }),
			);
			await controller.register(
				makeRegistration(plan.id, { orderId: "order_2" }),
			);
			await controller.voidRegistration(reg1.id, "Cancelled");

			const voided = await controller.getRegistrationsByCustomer("cust_1", {
				status: "voided",
			});
			expect(voided).toHaveLength(1);
			expect(voided[0].status).toBe("voided");
		});
	});

	describe("listRegistrations — combined filters", () => {
		it("supports skip and take", async () => {
			const plan = await controller.createPlan(makePlan());
			for (let i = 0; i < 4; i++) {
				await controller.register(
					makeRegistration(plan.id, {
						orderId: `order_${i}`,
						customerId: `cust_${i}`,
					}),
				);
			}
			const page = await controller.listRegistrations({
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty when filtering status that has no matches", async () => {
			const plan = await controller.createPlan(makePlan());
			await controller.register(makeRegistration(plan.id));
			const result = await controller.listRegistrations({
				status: "expired",
			});
			expect(result).toHaveLength(0);
		});

		it("returns empty when no registrations exist", async () => {
			const result = await controller.listRegistrations();
			expect(result).toHaveLength(0);
		});
	});

	// ── Void registration edge cases ─────────────────────────────────

	describe("voidRegistration — edge cases", () => {
		it("preserves voidReason on voided registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const voided = await controller.voidRegistration(
				reg.id,
				"Full refund issued",
			);
			expect(voided?.voidReason).toBe("Full refund issued");

			// Verify persisted
			const fetched = await controller.getRegistration(reg.id);
			expect(fetched?.status).toBe("voided");
			expect(fetched?.voidReason).toBe("Full refund issued");
		});

		it("updates updatedAt on void", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const voided = await controller.voidRegistration(reg.id, "reason");
			expect(voided?.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── Claim submission edge cases ──────────────────────────────────

	describe("submitClaim — edge cases", () => {
		it("submits claims with all issue types", async () => {
			const issueTypes = [
				"defect",
				"malfunction",
				"accidental_damage",
				"wear_and_tear",
				"missing_parts",
				"other",
			] as const;

			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			for (const issueType of issueTypes) {
				const claim = await controller.submitClaim(
					makeClaim(reg.id, { issueType }),
				);
				expect(claim.issueType).toBe(issueType);
				expect(claim.status).toBe("submitted");
			}
		});

		it("allows multiple claims on the same registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			const claim1 = await controller.submitClaim(
				makeClaim(reg.id, {
					issueDescription: "First issue",
				}),
			);
			const claim2 = await controller.submitClaim(
				makeClaim(reg.id, {
					issueDescription: "Second issue",
				}),
			);

			expect(claim1.id).not.toBe(claim2.id);
			expect(claim1.warrantyRegistrationId).toBe(claim2.warrantyRegistrationId);
		});

		it("sets submittedAt on claim creation", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const before = new Date();
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const after = new Date();

			expect(claim.submittedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(claim.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("rejects claim when customerId does not match registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(
				makeRegistration(plan.id, { customerId: "cust_owner" }),
			);

			await expect(
				controller.submitClaim(
					makeClaim(reg.id, { customerId: "cust_impostor" }),
				),
			).rejects.toThrow("Customer does not own this warranty");
		});

		it("rejects claim on expired registration with past purchase date", async () => {
			const plan = await controller.createPlan(makePlan({ durationMonths: 3 }));
			const reg = await controller.register(
				makeRegistration(plan.id, {
					purchaseDate: new Date("2020-01-01"),
				}),
			);

			await expect(controller.submitClaim(makeClaim(reg.id))).rejects.toThrow(
				"Warranty has expired",
			);
		});
	});

	// ── Claim listing combined filters ───────────────────────────────

	describe("getClaimsByCustomer — combined filters", () => {
		it("supports take and skip", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			for (let i = 0; i < 5; i++) {
				await controller.submitClaim(
					makeClaim(reg.id, {
						issueDescription: `Issue ${i}`,
					}),
				);
			}

			const page = await controller.getClaimsByCustomer("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty for customer with no claims", async () => {
			const result = await controller.getClaimsByCustomer("cust_nonexistent");
			expect(result).toHaveLength(0);
		});
	});

	describe("listClaims — combined filters", () => {
		it("filters by status with skip and take", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			for (let i = 0; i < 5; i++) {
				await controller.submitClaim(
					makeClaim(reg.id, {
						issueDescription: `Issue ${i}`,
					}),
				);
			}

			const page = await controller.listClaims({
				status: "submitted",
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
			for (const c of page) {
				expect(c.status).toBe("submitted");
			}
		});

		it("returns empty when filtering status that has no matches", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.submitClaim(makeClaim(reg.id));

			const result = await controller.listClaims({ status: "closed" });
			expect(result).toHaveLength(0);
		});

		it("returns empty when no claims exist", async () => {
			const result = await controller.listClaims();
			expect(result).toHaveLength(0);
		});
	});

	// ── Claim state machine: every valid transition ──────────────────

	describe("state machine — valid transitions", () => {
		it("submitted -> under_review", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const result = await controller.reviewClaim(claim.id);
			expect(result?.status).toBe("under_review");
		});

		it("submitted -> approved", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const result = await controller.approveClaim(claim.id, "repair");
			expect(result?.status).toBe("approved");
		});

		it("submitted -> denied", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const result = await controller.denyClaim(claim.id);
			expect(result?.status).toBe("denied");
		});

		it("under_review -> approved", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			const result = await controller.approveClaim(claim.id, "replace");
			expect(result?.status).toBe("approved");
		});

		it("under_review -> denied", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			const result = await controller.denyClaim(claim.id);
			expect(result?.status).toBe("denied");
		});

		it("approved -> in_repair", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const result = await controller.startRepair(claim.id);
			expect(result?.status).toBe("in_repair");
		});

		it("approved -> resolved", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "replace");
			const result = await controller.resolveClaim(
				claim.id,
				"Replacement shipped",
			);
			expect(result?.status).toBe("resolved");
			expect(result?.resolvedAt).toBeInstanceOf(Date);
		});

		it("approved -> denied", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const result = await controller.denyClaim(
				claim.id,
				"Upon re-inspection, damage is user-caused",
			);
			expect(result?.status).toBe("denied");
		});

		it("in_repair -> resolved", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			const result = await controller.resolveClaim(
				claim.id,
				"Repair completed",
			);
			expect(result?.status).toBe("resolved");
			expect(result?.resolvedAt).toBeInstanceOf(Date);
		});

		it("in_repair -> denied", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			const result = await controller.denyClaim(
				claim.id,
				"Tampering discovered during repair",
			);
			expect(result?.status).toBe("denied");
		});

		it("resolved -> closed", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			const result = await controller.closeClaim(claim.id);
			expect(result?.status).toBe("closed");
		});
	});

	// ── Claim state machine: every invalid transition ────────────────

	describe("state machine — invalid transitions", () => {
		it("cannot review an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "under_review"',
			);
		});

		it("cannot review an approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "approved"',
			);
		});

		it("cannot review a denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "denied"',
			);
		});

		it("cannot review an in_repair claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "in_repair"',
			);
		});

		it("cannot review a resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "resolved"',
			);
		});

		it("cannot review a closed claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "closed"',
			);
		});

		it("cannot approve an already approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "approved"');
		});

		it("cannot approve a denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.approveClaim(claim.id, "repair")).rejects.toThrow(
				'Cannot approve a claim with status "denied"',
			);
		});

		it("cannot approve an in_repair claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "in_repair"');
		});

		it("cannot approve a resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "resolved"');
		});

		it("cannot approve a closed claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);
			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "closed"');
		});

		it("cannot deny a denied claim (terminal)", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "denied"',
			);
		});

		it("cannot deny a resolved claim (terminal)", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "resolved"',
			);
		});

		it("cannot deny a closed claim (terminal)", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);
			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "closed"',
			);
		});

		it("cannot start repair on a submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "submitted"',
			);
		});

		it("cannot start repair on an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "under_review"',
			);
		});

		it("cannot start repair on an in_repair claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "in_repair"',
			);
		});

		it("cannot start repair on a denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "denied"',
			);
		});

		it("cannot start repair on a resolved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "resolved"',
			);
		});

		it("cannot start repair on a closed claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);
			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "closed"',
			);
		});

		it("cannot resolve a submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "submitted"',
			);
		});

		it("cannot resolve an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "under_review"',
			);
		});

		it("cannot resolve a denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "denied"',
			);
		});

		it("cannot resolve a closed claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);
			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "closed"',
			);
		});

		it("cannot close a submitted claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "submitted"',
			);
		});

		it("cannot close an under_review claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.reviewClaim(claim.id);
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "under_review"',
			);
		});

		it("cannot close an approved claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "approved"',
			);
		});

		it("cannot close a denied claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.denyClaim(claim.id);
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "denied"',
			);
		});

		it("cannot close an in_repair claim", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "in_repair"',
			);
		});
	});

	// ── Nonexistent entity returns null ───────────────────────────────

	describe("nonexistent entity lookups return null", () => {
		it("reviewClaim returns null for nonexistent id", async () => {
			const result = await controller.reviewClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("approveClaim returns null for nonexistent id", async () => {
			const result = await controller.approveClaim("nonexistent", "repair");
			expect(result).toBeNull();
		});

		it("denyClaim returns null for nonexistent id", async () => {
			const result = await controller.denyClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("startRepair returns null for nonexistent id", async () => {
			const result = await controller.startRepair("nonexistent");
			expect(result).toBeNull();
		});

		it("resolveClaim returns null for nonexistent id", async () => {
			const result = await controller.resolveClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("closeClaim returns null for nonexistent id", async () => {
			const result = await controller.closeClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("getPlan returns null for nonexistent id", async () => {
			const result = await controller.getPlan("nonexistent");
			expect(result).toBeNull();
		});

		it("getRegistration returns null for nonexistent id", async () => {
			const result = await controller.getRegistration("nonexistent");
			expect(result).toBeNull();
		});

		it("getClaim returns null for nonexistent id", async () => {
			const result = await controller.getClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("updatePlan returns null for nonexistent id", async () => {
			const result = await controller.updatePlan("nonexistent", {
				name: "x",
			});
			expect(result).toBeNull();
		});

		it("voidRegistration returns null for nonexistent id", async () => {
			const result = await controller.voidRegistration("nonexistent", "reason");
			expect(result).toBeNull();
		});

		it("deletePlan returns false for nonexistent id", async () => {
			const result = await controller.deletePlan("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Admin notes and resolution notes persistence ─────────────────

	describe("admin notes and resolution notes persistence", () => {
		it("reviewClaim stores admin notes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const reviewed = await controller.reviewClaim(
				claim.id,
				"Checking photos",
			);
			expect(reviewed?.adminNotes).toBe("Checking photos");
		});

		it("approveClaim stores resolution and admin notes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const approved = await controller.approveClaim(
				claim.id,
				"refund",
				"Approved for full refund",
			);
			expect(approved?.resolution).toBe("refund");
			expect(approved?.adminNotes).toBe("Approved for full refund");
		});

		it("approveClaim with all resolution types", async () => {
			const resolutions = ["repair", "replace", "refund", "credit"] as const;
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			for (const resolution of resolutions) {
				const claim = await controller.submitClaim(
					makeClaim(reg.id, {
						issueDescription: `Test ${resolution}`,
					}),
				);
				const approved = await controller.approveClaim(claim.id, resolution);
				expect(approved?.resolution).toBe(resolution);
			}
		});

		it("denyClaim stores admin notes and resolvedAt", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const denied = await controller.denyClaim(claim.id, "Damage not covered");
			expect(denied?.adminNotes).toBe("Damage not covered");
			expect(denied?.resolvedAt).toBeInstanceOf(Date);
		});

		it("startRepair stores admin notes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const repaired = await controller.startRepair(
				claim.id,
				"Sent to service center",
			);
			expect(repaired?.adminNotes).toBe("Sent to service center");
		});

		it("resolveClaim stores resolution notes and resolvedAt", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "repair");
			const resolved = await controller.resolveClaim(
				claim.id,
				"Unit repaired and tested OK",
			);
			expect(resolved?.resolutionNotes).toBe("Unit repaired and tested OK");
			expect(resolved?.resolvedAt).toBeInstanceOf(Date);
		});

		it("reviewClaim without admin notes does not set adminNotes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			const reviewed = await controller.reviewClaim(claim.id);
			expect(reviewed?.adminNotes).toBeUndefined();
		});

		it("resolveClaim without notes does not set resolutionNotes", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));
			await controller.approveClaim(claim.id, "replace");
			const resolved = await controller.resolveClaim(claim.id);
			expect(resolved?.resolutionNotes).toBeUndefined();
		});
	});

	// ── getClaimSummary with all statuses ─────────────────────────────

	describe("getClaimSummary — all statuses", () => {
		it("counts all claim statuses correctly", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			// submitted (stays)
			await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s1" }),
			);

			// under_review
			const c2 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s2" }),
			);
			await controller.reviewClaim(c2.id);

			// approved
			const c3 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s3" }),
			);
			await controller.approveClaim(c3.id, "repair");

			// denied
			const c4 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s4" }),
			);
			await controller.denyClaim(c4.id);

			// in_repair
			const c5 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s5" }),
			);
			await controller.approveClaim(c5.id, "repair");
			await controller.startRepair(c5.id);

			// resolved
			const c6 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s6" }),
			);
			await controller.approveClaim(c6.id, "replace");
			await controller.resolveClaim(c6.id);

			// closed
			const c7 = await controller.submitClaim(
				makeClaim(reg.id, { issueDescription: "s7" }),
			);
			await controller.approveClaim(c7.id, "refund");
			await controller.resolveClaim(c7.id);
			await controller.closeClaim(c7.id);

			const summary = await controller.getClaimSummary();
			expect(summary.totalClaims).toBe(7);
			expect(summary.submitted).toBe(1);
			expect(summary.underReview).toBe(1);
			expect(summary.approved).toBe(1);
			expect(summary.denied).toBe(1);
			expect(summary.inRepair).toBe(1);
			expect(summary.resolved).toBe(1);
			expect(summary.closed).toBe(1);
		});

		it("returns zeros for empty claim set", async () => {
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

		it("handles multiple claims in the same status", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			for (let i = 0; i < 3; i++) {
				await controller.submitClaim(
					makeClaim(reg.id, {
						issueDescription: `submitted-${i}`,
					}),
				);
			}

			const summary = await controller.getClaimSummary();
			expect(summary.totalClaims).toBe(3);
			expect(summary.submitted).toBe(3);
			expect(summary.underReview).toBe(0);
		});
	});

	// ── Full lifecycle flows ─────────────────────────────────────────

	describe("full lifecycle flows", () => {
		it("complete lifecycle: submit -> review -> approve -> repair -> resolve -> close", async () => {
			const plan = await controller.createPlan(
				makePlan({
					name: "Extended Protection",
					type: "extended",
					durationMonths: 36,
					price: 79.99,
				}),
			);
			const reg = await controller.register(
				makeRegistration(plan.id, { serialNumber: "SN-2025-001" }),
			);

			const claim = await controller.submitClaim(
				makeClaim(reg.id, {
					issueType: "malfunction",
					issueDescription: "Screen flickering",
				}),
			);
			expect(claim.status).toBe("submitted");

			const reviewed = await controller.reviewClaim(
				claim.id,
				"Reviewing photos",
			);
			expect(reviewed?.status).toBe("under_review");

			const approved = await controller.approveClaim(
				claim.id,
				"repair",
				"Approved for display repair",
			);
			expect(approved?.status).toBe("approved");
			expect(approved?.resolution).toBe("repair");

			const repaired = await controller.startRepair(
				claim.id,
				"Shipped to service center",
			);
			expect(repaired?.status).toBe("in_repair");

			const resolved = await controller.resolveClaim(
				claim.id,
				"Display replaced and tested",
			);
			expect(resolved?.status).toBe("resolved");
			expect(resolved?.resolvedAt).toBeInstanceOf(Date);

			const closed = await controller.closeClaim(claim.id);
			expect(closed?.status).toBe("closed");
		});

		it("short lifecycle: submit -> approve -> resolve -> close (skip review and repair)", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));

			await controller.approveClaim(claim.id, "replace");
			await controller.resolveClaim(claim.id, "Replacement sent directly");
			const closed = await controller.closeClaim(claim.id);
			expect(closed?.status).toBe("closed");
		});

		it("deny path: submit -> review -> deny", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(
				makeClaim(reg.id, {
					issueType: "wear_and_tear",
					issueDescription: "Normal wear",
				}),
			);

			await controller.reviewClaim(claim.id);
			const denied = await controller.denyClaim(
				claim.id,
				"Wear and tear not covered",
			);
			expect(denied?.status).toBe("denied");
			expect(denied?.resolvedAt).toBeInstanceOf(Date);
		});

		it("immediate deny: submit -> deny", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));

			const denied = await controller.denyClaim(claim.id, "Invalid claim");
			expect(denied?.status).toBe("denied");
		});

		it("deny after approval: submit -> approve -> deny", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));

			await controller.approveClaim(claim.id, "repair");
			const denied = await controller.denyClaim(
				claim.id,
				"Re-inspection revealed tampering",
			);
			expect(denied?.status).toBe("denied");
			expect(denied?.resolvedAt).toBeInstanceOf(Date);
		});

		it("deny during repair: submit -> approve -> repair -> deny", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			const claim = await controller.submitClaim(makeClaim(reg.id));

			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);
			const denied = await controller.denyClaim(
				claim.id,
				"Found unauthorized modifications",
			);
			expect(denied?.status).toBe("denied");
		});
	});

	// ── Multiple claims across registrations and customers ───────────

	describe("multiple claims and registrations", () => {
		it("different customers see only their own claims", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg1 = await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_1",
					orderId: "order_1",
				}),
			);
			const reg2 = await controller.register(
				makeRegistration(plan.id, {
					customerId: "cust_2",
					orderId: "order_2",
				}),
			);

			await controller.submitClaim(
				makeClaim(reg1.id, { customerId: "cust_1" }),
			);
			await controller.submitClaim(
				makeClaim(reg1.id, {
					customerId: "cust_1",
					issueType: "malfunction",
				}),
			);
			await controller.submitClaim(
				makeClaim(reg2.id, { customerId: "cust_2" }),
			);

			const cust1Claims = await controller.getClaimsByCustomer("cust_1");
			const cust2Claims = await controller.getClaimsByCustomer("cust_2");

			expect(cust1Claims).toHaveLength(2);
			expect(cust2Claims).toHaveLength(1);
		});

		it("getClaimsByRegistration returns only claims for that registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg1 = await controller.register(
				makeRegistration(plan.id, { orderId: "order_1" }),
			);
			const reg2 = await controller.register(
				makeRegistration(plan.id, { orderId: "order_2" }),
			);

			await controller.submitClaim(makeClaim(reg1.id));
			await controller.submitClaim(
				makeClaim(reg1.id, { issueType: "malfunction" }),
			);
			await controller.submitClaim(makeClaim(reg2.id));

			const reg1Claims = await controller.getClaimsByRegistration(reg1.id);
			const reg2Claims = await controller.getClaimsByRegistration(reg2.id);

			expect(reg1Claims).toHaveLength(2);
			expect(reg2Claims).toHaveLength(1);
		});

		it("returns empty array for registration with no claims", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			const claims = await controller.getClaimsByRegistration(reg.id);
			expect(claims).toHaveLength(0);
		});

		it("registrations across different plans are independent", async () => {
			const plan1 = await controller.createPlan(
				makePlan({ name: "Plan A", durationMonths: 12 }),
			);
			const plan2 = await controller.createPlan(
				makePlan({ name: "Plan B", durationMonths: 24 }),
			);

			const reg1 = await controller.register(
				makeRegistration(plan1.id, { orderId: "order_1" }),
			);
			const reg2 = await controller.register(
				makeRegistration(plan2.id, { orderId: "order_2" }),
			);

			expect(reg1.warrantyPlanId).toBe(plan1.id);
			expect(reg2.warrantyPlanId).toBe(plan2.id);
			expect(reg1.warrantyPlanId).not.toBe(reg2.warrantyPlanId);
		});
	});

	// ── Plan-registration interaction edge cases ─────────────────────

	describe("plan-registration interaction", () => {
		it("voiding registration does not affect the plan", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));
			await controller.voidRegistration(reg.id, "Cancelled");

			const fetchedPlan = await controller.getPlan(plan.id);
			expect(fetchedPlan?.isActive).toBe(true);
		});

		it("deactivating a plan does not affect existing active registrations", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			await controller.updatePlan(plan.id, { isActive: false });

			const fetchedReg = await controller.getRegistration(reg.id);
			expect(fetchedReg?.status).toBe("active");
		});

		it("can submit claim on registration whose plan was deactivated after registration", async () => {
			const plan = await controller.createPlan(makePlan());
			const reg = await controller.register(makeRegistration(plan.id));

			// Deactivate plan after registration
			await controller.updatePlan(plan.id, { isActive: false });

			// Claim should still work since registration is active
			const claim = await controller.submitClaim(makeClaim(reg.id));
			expect(claim.status).toBe("submitted");
		});
	});
});
