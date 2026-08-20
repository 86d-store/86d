import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { WarrantyController } from "../service";
import { createWarrantyController } from "../service-impl";
import { getClaim } from "../store/endpoints/get-claim";
import { getWarranty } from "../store/endpoints/get-warranty";

/**
 * Security regression tests for warranties endpoints.
 *
 * Security focuses on:
 * - Customer ownership: submitClaim verifies customerId matches registration
 * - Expired warranty: submitClaim rejects if warranty is expired
 * - Inactive plans: cannot register for inactive plans
 * - Plan deletion blocked if active registrations exist
 * - Claim status transitions: full submitted→under_review→approved→in_repair→resolved→closed
 * - voidRegistration only works on active registrations
 * - Customer scoping: getRegistrationsByCustomer/getClaimsByCustomer only return that customer's data
 */

describe("warranties endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWarrantyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWarrantyController(mockData);
	});

	// Helper: create a standard active warranty plan
	async function createActivePlan(overrides?: { durationMonths?: number }) {
		return controller.createPlan({
			name: "Standard Warranty",
			type: "extended",
			durationMonths: overrides?.durationMonths ?? 12,
		});
	}

	// Helper: register a warranty for a customer
	async function registerWarranty(
		planId: string,
		customerId: string,
		purchaseDate?: Date,
	) {
		return controller.register({
			warrantyPlanId: planId,
			orderId: "order_001",
			customerId,
			productId: "product_001",
			productName: "Test Product",
			...(purchaseDate !== undefined ? { purchaseDate } : {}),
		});
	}

	async function callEndpoint<
		E extends (...args: never[]) => Promise<unknown>,
		I extends Parameters<E>[0] & object,
	>(
		endpoint: E,
		input: I,
		context: {
			controllers: { warranties: WarrantyController };
			session?:
				| {
						user: {
							email: string;
							id: string;
							name: string;
						};
				  }
				| undefined;
		},
	): Promise<Awaited<ReturnType<E>>> {
		return endpoint(
			Object.assign({}, input, { context }) as Parameters<E>[0],
		) as Promise<Awaited<ReturnType<E>>>;
	}

	describe("inactive plan protection", () => {
		it("cannot register for an inactive plan", async () => {
			const plan = await createActivePlan();
			await controller.updatePlan(plan.id, { isActive: false });

			await expect(registerWarranty(plan.id, "customer_1")).rejects.toThrow(
				"not active",
			);
		});

		it("can register for an active plan", async () => {
			const plan = await createActivePlan();

			const reg = await registerWarranty(plan.id, "customer_1");
			expect(reg.status).toBe("active");
			expect(reg.customerId).toBe("customer_1");
		});

		it("register throws for non-existent plan", async () => {
			await expect(
				controller.register({
					warrantyPlanId: "nonexistent-plan",
					orderId: "order_1",
					customerId: "customer_1",
					productId: "product_1",
					productName: "Product",
				}),
			).rejects.toThrow("not found");
		});
	});

	describe("plan deletion safety", () => {
		it("deletePlan is blocked when active registrations exist", async () => {
			const plan = await createActivePlan();
			await registerWarranty(plan.id, "customer_1");

			await expect(controller.deletePlan(plan.id)).rejects.toThrow(
				"Cannot delete a plan with active registrations",
			);
		});

		it("deletePlan succeeds when no active registrations exist", async () => {
			const plan = await createActivePlan();

			const result = await controller.deletePlan(plan.id);
			expect(result).toBe(true);
		});

		it("deletePlan returns false for non-existent plan", async () => {
			const result = await controller.deletePlan("nonexistent-plan");
			expect(result).toBe(false);
		});
	});

	describe("customer ownership enforcement", () => {
		it("submitClaim rejects wrong customerId", async () => {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_owner");

			await expect(
				controller.submitClaim({
					warrantyRegistrationId: reg.id,
					customerId: "customer_attacker",
					issueType: "defect",
					issueDescription: "Product is broken",
				}),
			).rejects.toThrow("Customer does not own this warranty");
		});

		it("submitClaim succeeds for correct owner", async () => {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_owner");

			const claim = await controller.submitClaim({
				warrantyRegistrationId: reg.id,
				customerId: "customer_owner",
				issueType: "defect",
				issueDescription: "Product stopped working",
			});
			expect(claim.status).toBe("submitted");
			expect(claim.customerId).toBe("customer_owner");
		});
	});

	describe("expired warranty protection", () => {
		it("submitClaim rejects expired warranty", async () => {
			// Create a plan and registration that expired in the past
			const plan = await createActivePlan({ durationMonths: 1 });

			// Purchase date 2 years ago → warranty expired long ago
			const oldDate = new Date();
			oldDate.setFullYear(oldDate.getFullYear() - 2);

			const reg = await registerWarranty(plan.id, "customer_exp", oldDate);

			await expect(
				controller.submitClaim({
					warrantyRegistrationId: reg.id,
					customerId: "customer_exp",
					issueType: "malfunction",
					issueDescription: "Device not working",
				}),
			).rejects.toThrow("Warranty has expired");
		});

		it("submitClaim succeeds for non-expired warranty", async () => {
			const plan = await createActivePlan({ durationMonths: 24 });
			const reg = await registerWarranty(plan.id, "customer_valid");

			const claim = await controller.submitClaim({
				warrantyRegistrationId: reg.id,
				customerId: "customer_valid",
				issueType: "defect",
				issueDescription: "Screen is cracked",
			});
			expect(claim.status).toBe("submitted");
		});
	});

	describe("claim status transitions", () => {
		async function createSubmittedClaim() {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_flow");
			return controller.submitClaim({
				warrantyRegistrationId: reg.id,
				customerId: "customer_flow",
				issueType: "defect",
				issueDescription: "Defective unit",
			});
		}

		it("full happy-path: submitted → under_review → approved → in_repair → resolved → closed", async () => {
			const claim = await createSubmittedClaim();
			expect(claim.status).toBe("submitted");

			const reviewed = await controller.reviewClaim(
				claim.id,
				"Needs investigation",
			);
			expect(reviewed?.status).toBe("under_review");

			const approved = await controller.approveClaim(
				claim.id,
				"repair",
				"Approved for repair",
			);
			expect(approved?.status).toBe("approved");

			const inRepair = await controller.startRepair(
				claim.id,
				"Sent to repair center",
			);
			expect(inRepair?.status).toBe("in_repair");

			const resolved = await controller.resolveClaim(claim.id, "Repair done");
			expect(resolved?.status).toBe("resolved");

			const closed = await controller.closeClaim(claim.id);
			expect(closed?.status).toBe("closed");
		});

		it("reviewClaim rejects non-submitted claim", async () => {
			const claim = await createSubmittedClaim();
			await controller.reviewClaim(claim.id);

			// Already under_review — reviewClaim again should fail
			await expect(controller.reviewClaim(claim.id)).rejects.toThrow(
				'Cannot review a claim with status "under_review"',
			);
		});

		it("startRepair rejects non-approved claim", async () => {
			const claim = await createSubmittedClaim();

			await expect(controller.startRepair(claim.id)).rejects.toThrow(
				'Cannot start repair for a claim with status "submitted"',
			);
		});

		it("closeClaim rejects non-resolved claim", async () => {
			const claim = await createSubmittedClaim();

			await expect(controller.closeClaim(claim.id)).rejects.toThrow(
				'Cannot close a claim with status "submitted"',
			);
		});

		it("denyClaim rejects terminal statuses", async () => {
			const claim = await createSubmittedClaim();
			await controller.reviewClaim(claim.id);
			await controller.approveClaim(claim.id, "refund");
			await controller.resolveClaim(claim.id);
			await controller.closeClaim(claim.id);

			await expect(controller.denyClaim(claim.id)).rejects.toThrow(
				'Cannot deny a claim with status "closed"',
			);
		});

		it("approveClaim requires submitted or under_review status", async () => {
			const claim = await createSubmittedClaim();
			await controller.reviewClaim(claim.id);
			await controller.approveClaim(claim.id, "repair");
			await controller.startRepair(claim.id);

			await expect(
				controller.approveClaim(claim.id, "replace"),
			).rejects.toThrow('Cannot approve a claim with status "in_repair"');
		});

		it("resolveClaim requires approved or in_repair status", async () => {
			const claim = await createSubmittedClaim();

			await expect(controller.resolveClaim(claim.id)).rejects.toThrow(
				'Cannot resolve a claim with status "submitted"',
			);
		});

		it("getClaim returns null for non-existent ID", async () => {
			const result = await controller.getClaim("nonexistent");
			expect(result).toBeNull();
		});

		it("reviewClaim returns null for non-existent claim", async () => {
			const result = await controller.reviewClaim("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("voidRegistration safety", () => {
		it("voidRegistration works on active registrations", async () => {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_void");
			expect(reg.status).toBe("active");

			const voided = await controller.voidRegistration(
				reg.id,
				"Customer request",
			);
			expect(voided?.status).toBe("voided");
			expect(voided?.voidReason).toBe("Customer request");
		});

		it("voidRegistration rejects already-voided registration", async () => {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_void2");

			await controller.voidRegistration(reg.id, "First void");

			await expect(
				controller.voidRegistration(reg.id, "Second void"),
			).rejects.toThrow('Cannot void a registration with status "voided"');
		});

		it("voidRegistration returns null for non-existent registration", async () => {
			const result = await controller.voidRegistration(
				"nonexistent",
				"Some reason",
			);
			expect(result).toBeNull();
		});

		it("cannot submit claim for voided registration", async () => {
			const plan = await createActivePlan();
			const reg = await registerWarranty(plan.id, "customer_voidclaim");

			await controller.voidRegistration(reg.id, "Voided");

			await expect(
				controller.submitClaim({
					warrantyRegistrationId: reg.id,
					customerId: "customer_voidclaim",
					issueType: "defect",
					issueDescription: "Broken",
				}),
			).rejects.toThrow(
				'Cannot submit claim for registration with status "voided"',
			);
		});
	});

	describe("customer scoping", () => {
		it("getRegistrationsByCustomer only returns that customer's registrations", async () => {
			const plan = await createActivePlan();

			await controller.register({
				warrantyPlanId: plan.id,
				orderId: "order_c1",
				customerId: "customer_A",
				productId: "prod_1",
				productName: "Product A",
			});
			await controller.register({
				warrantyPlanId: plan.id,
				orderId: "order_c2",
				customerId: "customer_B",
				productId: "prod_2",
				productName: "Product B",
			});
			await controller.register({
				warrantyPlanId: plan.id,
				orderId: "order_c3",
				customerId: "customer_A",
				productId: "prod_3",
				productName: "Product C",
			});

			const regsA = await controller.getRegistrationsByCustomer("customer_A");
			expect(regsA).toHaveLength(2);
			expect(regsA.every((r) => r.customerId === "customer_A")).toBe(true);

			const regsB = await controller.getRegistrationsByCustomer("customer_B");
			expect(regsB).toHaveLength(1);
			expect(regsB[0].customerId).toBe("customer_B");
		});

		it("getRegistrationsByCustomer returns empty for unknown customer", async () => {
			const regs = await controller.getRegistrationsByCustomer("unknown_cust");
			expect(regs).toHaveLength(0);
		});

		it("getClaimsByCustomer only returns that customer's claims", async () => {
			const plan = await createActivePlan();

			const regA = await controller.register({
				warrantyPlanId: plan.id,
				orderId: "order_ca1",
				customerId: "customer_X",
				productId: "prod_x",
				productName: "Product X",
			});
			const regB = await controller.register({
				warrantyPlanId: plan.id,
				orderId: "order_ca2",
				customerId: "customer_Y",
				productId: "prod_y",
				productName: "Product Y",
			});

			await controller.submitClaim({
				warrantyRegistrationId: regA.id,
				customerId: "customer_X",
				issueType: "defect",
				issueDescription: "Broken screen",
			});
			await controller.submitClaim({
				warrantyRegistrationId: regB.id,
				customerId: "customer_Y",
				issueType: "malfunction",
				issueDescription: "Won't turn on",
			});

			const claimsX = await controller.getClaimsByCustomer("customer_X");
			expect(claimsX).toHaveLength(1);
			expect(claimsX[0].customerId).toBe("customer_X");

			const claimsY = await controller.getClaimsByCustomer("customer_Y");
			expect(claimsY).toHaveLength(1);
			expect(claimsY[0].customerId).toBe("customer_Y");
		});

		it("getClaimsByCustomer returns empty for customer with no claims", async () => {
			const claims = await controller.getClaimsByCustomer("no_claims_cust");
			expect(claims).toHaveLength(0);
		});
	});

	describe("store endpoint anti-enumeration", () => {
		async function setupEndpointScenario(customerId: string) {
			const plan = await controller.createPlan({
				name: `Protection ${customerId}`,
				type: "extended",
				durationMonths: 24,
				price: 4999,
			});
			const registration = await controller.register({
				warrantyPlanId: plan.id,
				orderId: `order_${customerId}`,
				customerId,
				productId: `product_${customerId}`,
				productName: "Espresso Machine",
			});
			const claim = await controller.submitClaim({
				warrantyRegistrationId: registration.id,
				customerId,
				issueType: "malfunction",
				issueDescription: "Stops heating after ten minutes",
			});

			return { claim, registration };
		}

		it("getWarranty returns 404 for another customer's registration", async () => {
			const { registration } = await setupEndpointScenario("victim");

			const response = await callEndpoint(
				getWarranty,
				{
					params: { id: registration.id },
				},
				{
					controllers: { warranties: controller },
					session: {
						user: {
							id: "attacker",
							email: "attacker@example.com",
							name: "Attacker",
						},
					},
				},
			);

			expect(response).toEqual({ error: "Warranty not found", status: 404 });
		});

		it("getClaim returns 404 for another customer's claim", async () => {
			const { claim } = await setupEndpointScenario("victim");

			const response = await callEndpoint(
				getClaim,
				{
					params: { id: claim.id },
				},
				{
					controllers: { warranties: controller },
					session: {
						user: {
							id: "attacker",
							email: "attacker@example.com",
							name: "Attacker",
						},
					},
				},
			);

			expect(response).toEqual({ error: "Claim not found", status: 404 });
		});

		it("getWarranty still returns the registration for the owning customer", async () => {
			const { registration } = await setupEndpointScenario("owner");

			const response = await callEndpoint(
				getWarranty,
				{
					params: { id: registration.id },
				},
				{
					controllers: { warranties: controller },
					session: {
						user: {
							id: "owner",
							email: "owner@example.com",
							name: "Owner",
						},
					},
				},
			);

			expect("registration" in response).toBe(true);
			if ("registration" in response) {
				expect(response.registration.id).toBe(registration.id);
				expect(response.registration.customerId).toBe("owner");
			}
		});

		it("getClaim still returns the claim for the owning customer", async () => {
			const { claim } = await setupEndpointScenario("owner");

			const response = await callEndpoint(
				getClaim,
				{
					params: { id: claim.id },
				},
				{
					controllers: { warranties: controller },
					session: {
						user: {
							id: "owner",
							email: "owner@example.com",
							name: "Owner",
						},
					},
				},
			);

			expect("claim" in response).toBe(true);
			if ("claim" in response) {
				expect(response.claim.id).toBe(claim.id);
				expect(response.claim.customerId).toBe("owner");
			}
		});
	});
});
