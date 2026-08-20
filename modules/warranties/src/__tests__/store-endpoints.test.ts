import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWarrantyController } from "../service-impl";

/**
 * Store endpoint integration tests for the warranties module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-plans: active warranty plans, optionally filtered by product
 * 2. get-plan: single plan details
 * 3. my-registrations: auth required, customer's warranty registrations
 * 4. submit-claim: auth required, files a warranty claim
 * 5. my-claims: auth required, customer's claims
 * 6. get-claim: auth required, single claim with ownership check
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListPlans(
	data: DataService,
	query: { productId?: string } = {},
) {
	const controller = createWarrantyController(data);
	const plans = await controller.listPlans({
		activeOnly: true,
		...(query.productId != null && { productId: query.productId }),
	});
	return { plans };
}

async function simulateGetPlan(data: DataService, planId: string) {
	const controller = createWarrantyController(data);
	const plan = await controller.getPlan(planId);
	if (!plan?.isActive) {
		return { error: "Plan not found", status: 404 };
	}
	return { plan };
}

async function simulateMyRegistrations(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createWarrantyController(data);
	const registrations = await controller.getRegistrationsByCustomer(
		opts.customerId,
	);
	return { registrations };
}

async function simulateSubmitClaim(
	data: DataService,
	body: {
		warrantyRegistrationId: string;
		issueType:
			| "defect"
			| "malfunction"
			| "accidental_damage"
			| "wear_and_tear"
			| "missing_parts"
			| "other";
		issueDescription: string;
	},
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createWarrantyController(data);
	const registration = await controller.getRegistration(
		body.warrantyRegistrationId,
	);
	if (!registration || registration.customerId !== opts.customerId) {
		return { error: "Registration not found", status: 404 };
	}
	if (registration.status !== "active") {
		return { error: "Warranty is not active", status: 400 };
	}
	const claim = await controller.submitClaim({
		warrantyRegistrationId: body.warrantyRegistrationId,
		customerId: opts.customerId,
		issueType: body.issueType,
		issueDescription: body.issueDescription,
	});
	return { claim };
}

async function simulateMyClams(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createWarrantyController(data);
	const claims = await controller.getClaimsByCustomer(opts.customerId);
	return { claims };
}

async function simulateGetClaim(
	data: DataService,
	claimId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createWarrantyController(data);
	const claim = await controller.getClaim(claimId);
	if (!claim || claim.customerId !== opts.customerId) {
		return { error: "Claim not found", status: 404 };
	}
	return { claim };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list plans — active warranty plans", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active plans", async () => {
		const ctrl = createWarrantyController(data);
		await ctrl.createPlan({
			name: "Basic Warranty",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		const inactive = await ctrl.createPlan({
			name: "Discontinued",
			type: "extended",
			durationMonths: 24,
			price: 2999,
		});
		await ctrl.updatePlan(inactive.id, { isActive: false });

		const result = await simulateListPlans(data);

		expect(result.plans).toHaveLength(1);
		expect(result.plans[0].name).toBe("Basic Warranty");
	});

	it("filters plans by product", async () => {
		const ctrl = createWarrantyController(data);
		await ctrl.createPlan({
			name: "Product Plan",
			type: "extended",
			durationMonths: 24,
			price: 1999,
			productId: "prod_laptop",
		});
		await ctrl.createPlan({
			name: "General Plan",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});

		const result = await simulateListPlans(data, {
			productId: "prod_laptop",
		});

		expect(result.plans).toHaveLength(1);
		expect(result.plans[0].name).toBe("Product Plan");
	});

	it("returns empty when no active plans exist", async () => {
		const result = await simulateListPlans(data);

		expect(result.plans).toHaveLength(0);
	});
});

describe("store endpoint: get plan — single plan details", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active plan", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Extended Protection",
			type: "extended",
			durationMonths: 36,
			price: 4999,
			coverageDetails: "Covers defects and accidental damage",
		});

		const result = await simulateGetPlan(data, plan.id);

		expect("plan" in result).toBe(true);
		if ("plan" in result) {
			expect(result.plan.name).toBe("Extended Protection");
			expect(result.plan.durationMonths).toBe(36);
		}
	});

	it("returns 404 for inactive plan", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Old Plan",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		await ctrl.updatePlan(plan.id, { isActive: false });

		const result = await simulateGetPlan(data, plan.id);

		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});

	it("returns 404 for nonexistent plan", async () => {
		const result = await simulateGetPlan(data, "ghost_plan");

		expect(result).toEqual({ error: "Plan not found", status: 404 });
	});
});

describe("store endpoint: my registrations — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyRegistrations(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's warranty registrations", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Standard",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_1",
			productId: "prod_laptop",
			productName: "Laptop",
		});
		await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_2",
			customerId: "cust_2",
			productId: "prod_phone",
			productName: "Phone",
		});

		const result = await simulateMyRegistrations(data, {
			customerId: "cust_1",
		});

		expect("registrations" in result).toBe(true);
		if ("registrations" in result) {
			expect(result.registrations).toHaveLength(1);
			expect(result.registrations[0].productName).toBe("Laptop");
		}
	});

	it("returns empty for customer with no registrations", async () => {
		const result = await simulateMyRegistrations(data, {
			customerId: "cust_new",
		});

		expect("registrations" in result).toBe(true);
		if ("registrations" in result) {
			expect(result.registrations).toHaveLength(0);
		}
	});
});

describe("store endpoint: submit claim — file warranty claim", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateSubmitClaim(data, {
			warrantyRegistrationId: "reg_1",
			issueType: "defect",
			issueDescription: "Screen cracked",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("submits a claim against an active warranty", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Protection",
			type: "accidental_damage",
			durationMonths: 24,
			price: 2999,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_1",
			productId: "prod_laptop",
			productName: "Laptop",
		});

		const result = await simulateSubmitClaim(
			data,
			{
				warrantyRegistrationId: reg.id,
				issueType: "accidental_damage",
				issueDescription: "Dropped and screen cracked",
			},
			{ customerId: "cust_1" },
		);

		expect("claim" in result).toBe(true);
		if ("claim" in result) {
			expect(result.claim.status).toBe("submitted");
			expect(result.claim.issueType).toBe("accidental_damage");
			expect(result.claim.customerId).toBe("cust_1");
		}
	});

	it("returns 404 when claiming against another customer's warranty", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Standard",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_2",
			productId: "prod_1",
			productName: "Widget",
		});

		const result = await simulateSubmitClaim(
			data,
			{
				warrantyRegistrationId: reg.id,
				issueType: "defect",
				issueDescription: "Broken",
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Registration not found",
			status: 404,
		});
	});

	it("rejects claim on voided warranty", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Standard",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_1",
			productId: "prod_1",
			productName: "Widget",
		});
		await ctrl.voidRegistration(reg.id, "Fraud detected");

		const result = await simulateSubmitClaim(
			data,
			{
				warrantyRegistrationId: reg.id,
				issueType: "defect",
				issueDescription: "Broken",
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Warranty is not active",
			status: 400,
		});
	});
});

describe("store endpoint: my claims — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyClams(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's claims", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Protection",
			type: "extended",
			durationMonths: 24,
			price: 1999,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_1",
			productId: "prod_1",
			productName: "Widget",
		});
		await ctrl.submitClaim({
			warrantyRegistrationId: reg.id,
			customerId: "cust_1",
			issueType: "defect",
			issueDescription: "Broken handle",
		});

		const result = await simulateMyClams(data, { customerId: "cust_1" });

		expect("claims" in result).toBe(true);
		if ("claims" in result) {
			expect(result.claims).toHaveLength(1);
			expect(result.claims[0].issueDescription).toBe("Broken handle");
		}
	});

	it("returns empty for customer with no claims", async () => {
		const result = await simulateMyClams(data, {
			customerId: "cust_new",
		});

		expect("claims" in result).toBe(true);
		if ("claims" in result) {
			expect(result.claims).toHaveLength(0);
		}
	});
});

describe("store endpoint: get claim — ownership check", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetClaim(data, "claim_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns a claim for the owner", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Standard",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_1",
			productId: "prod_1",
			productName: "Widget",
		});
		const claim = await ctrl.submitClaim({
			warrantyRegistrationId: reg.id,
			customerId: "cust_1",
			issueType: "malfunction",
			issueDescription: "Stops working after 5 minutes",
		});

		const result = await simulateGetClaim(data, claim.id, {
			customerId: "cust_1",
		});

		expect("claim" in result).toBe(true);
		if ("claim" in result) {
			expect(result.claim.issueType).toBe("malfunction");
		}
	});

	it("returns 404 for another customer's claim", async () => {
		const ctrl = createWarrantyController(data);
		const plan = await ctrl.createPlan({
			name: "Standard",
			type: "manufacturer",
			durationMonths: 12,
			price: 0,
		});
		const reg = await ctrl.register({
			warrantyPlanId: plan.id,
			orderId: "order_1",
			customerId: "cust_2",
			productId: "prod_1",
			productName: "Widget",
		});
		const claim = await ctrl.submitClaim({
			warrantyRegistrationId: reg.id,
			customerId: "cust_2",
			issueType: "defect",
			issueDescription: "Cracked",
		});

		const result = await simulateGetClaim(data, claim.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Claim not found", status: 404 });
	});

	it("returns 404 for nonexistent claim", async () => {
		const result = await simulateGetClaim(data, "ghost_claim", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Claim not found", status: 404 });
	});
});
