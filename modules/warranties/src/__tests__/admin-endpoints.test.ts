import { describe, expect, it, vi } from "vitest";
import { approveClaim } from "../admin/endpoints/approve-claim";
import { claimSummary } from "../admin/endpoints/claim-summary";
import { closeClaim } from "../admin/endpoints/close-claim";
import { createPlan } from "../admin/endpoints/create-plan";
import { deletePlan } from "../admin/endpoints/delete-plan";
import { denyClaim } from "../admin/endpoints/deny-claim";
import { getClaim } from "../admin/endpoints/get-claim";
import { getRegistration } from "../admin/endpoints/get-registration";
import { listClaims } from "../admin/endpoints/list-claims";
import { listPlans } from "../admin/endpoints/list-plans";
import { listRegistrations } from "../admin/endpoints/list-registrations";
import { registerWarranty } from "../admin/endpoints/register-warranty";
import { resolveClaim } from "../admin/endpoints/resolve-claim";
import { reviewClaim } from "../admin/endpoints/review-claim";
import { startRepair } from "../admin/endpoints/start-repair";
import { updatePlan } from "../admin/endpoints/update-plan";
import { voidRegistration } from "../admin/endpoints/void-registration";
import type {
	ClaimSummary,
	WarrantyClaim,
	WarrantyController,
	WarrantyPlan,
	WarrantyRegistration,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePlan(overrides: Partial<WarrantyPlan> = {}): WarrantyPlan {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "1-Year Extended",
		type: "extended",
		durationMonths: 12,
		price: 2999,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeRegistration(
	overrides: Partial<WarrantyRegistration> = {},
): WarrantyRegistration {
	const now = new Date();
	const expires = new Date(now);
	expires.setFullYear(expires.getFullYear() + 1);
	return {
		id: crypto.randomUUID(),
		warrantyPlanId: "plan_1",
		orderId: "order_1",
		customerId: "cust_1",
		productId: "prod_1",
		productName: "Test Product",
		purchaseDate: now,
		expiresAt: expires,
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeClaim(overrides: Partial<WarrantyClaim> = {}): WarrantyClaim {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		warrantyRegistrationId: "reg_1",
		customerId: "cust_1",
		issueType: "malfunction",
		issueDescription: "Device stopped working",
		status: "submitted",
		submittedAt: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSummary(): ClaimSummary {
	return {
		totalClaims: 0,
		submitted: 0,
		underReview: 0,
		approved: 0,
		denied: 0,
		inRepair: 0,
		resolved: 0,
		closed: 0,
	};
}

function makeController(
	overrides: Partial<WarrantyController> = {},
): WarrantyController {
	return {
		createPlan: vi.fn().mockResolvedValue(makePlan()),
		updatePlan: vi.fn().mockResolvedValue(null),
		getPlan: vi.fn().mockResolvedValue(null),
		listPlans: vi.fn().mockResolvedValue([]),
		deletePlan: vi.fn().mockResolvedValue(false),
		register: vi.fn().mockResolvedValue(makeRegistration()),
		getRegistration: vi.fn().mockResolvedValue(null),
		getRegistrationsByCustomer: vi.fn().mockResolvedValue([]),
		listRegistrations: vi.fn().mockResolvedValue([]),
		voidRegistration: vi.fn().mockResolvedValue(null),
		submitClaim: vi.fn().mockResolvedValue(makeClaim()),
		getClaim: vi.fn().mockResolvedValue(null),
		getClaimsByRegistration: vi.fn().mockResolvedValue([]),
		getClaimsByCustomer: vi.fn().mockResolvedValue([]),
		listClaims: vi.fn().mockResolvedValue([]),
		reviewClaim: vi.fn().mockResolvedValue(null),
		approveClaim: vi.fn().mockResolvedValue(null),
		denyClaim: vi.fn().mockResolvedValue(null),
		startRepair: vi.fn().mockResolvedValue(null),
		resolveClaim: vi.fn().mockResolvedValue(null),
		closeClaim: vi.fn().mockResolvedValue(null),
		getClaimSummary: vi.fn().mockResolvedValue(makeSummary()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | boolean | number | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: WarrantyController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { warranties: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listPlansHandler = extractHandler(listPlans);
const createPlanHandler = extractHandler(createPlan);
const updatePlanHandler = extractHandler(updatePlan);
const deletePlanHandler = extractHandler(deletePlan);
const listRegistrationsHandler = extractHandler(listRegistrations);
const registerHandler = extractHandler(registerWarranty);
const getRegistrationHandler = extractHandler(getRegistration);
const voidHandler = extractHandler(voidRegistration);
const listClaimsHandler = extractHandler(listClaims);
const getClaimHandler = extractHandler(getClaim);
const reviewClaimHandler = extractHandler(reviewClaim);
const approveClaimHandler = extractHandler(approveClaim);
const denyClaimHandler = extractHandler(denyClaim);
const startRepairHandler = extractHandler(startRepair);
const resolveClaimHandler = extractHandler(resolveClaim);
const closeClaimHandler = extractHandler(closeClaim);
const summaryHandler = extractHandler(claimSummary);

// ── Plans ─────────────────────────────────────────────────────────────────────

describe("admin GET /warranties/plans", () => {
	it("returns empty list when no plans", async () => {
		const result = (await call(listPlansHandler)) as {
			plans: WarrantyPlan[];
		};
		expect(result.plans).toHaveLength(0);
	});

	it("returns plans from controller", async () => {
		const plans = [
			makePlan({ type: "extended" }),
			makePlan({ type: "manufacturer" }),
		];
		const ctrl = makeController({
			listPlans: vi.fn().mockResolvedValue(plans),
		});
		const result = (await call(listPlansHandler, { controller: ctrl })) as {
			plans: WarrantyPlan[];
		};
		expect(result.plans).toHaveLength(2);
	});

	it("forwards type and activeOnly filters", async () => {
		const ctrl = makeController();
		await call(listPlansHandler, {
			query: { type: "extended", activeOnly: "true" },
			controller: ctrl,
		});
		expect(ctrl.listPlans).toHaveBeenCalledWith(
			expect.objectContaining({ type: "extended", activeOnly: true }),
		);
	});
});

describe("admin POST /warranties/plans/create", () => {
	it("creates a warranty plan and returns it", async () => {
		const plan = makePlan({ name: "2-Year Extended" });
		const ctrl = makeController({
			createPlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(createPlanHandler, {
			body: {
				name: "2-Year Extended",
				type: "extended",
				durationMonths: 24,
				price: 4999,
			},
			controller: ctrl,
		})) as { plan: WarrantyPlan };
		expect(result.plan.name).toBe("2-Year Extended");
	});
});

describe("admin PUT /warranties/plans/:id/update", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(updatePlanHandler, {
			params: { id: "missing" },
			body: { isActive: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated plan on success", async () => {
		const plan = makePlan({ isActive: false });
		const ctrl = makeController({
			updatePlan: vi.fn().mockResolvedValue(plan),
		});
		const result = (await call(updatePlanHandler, {
			params: { id: plan.id },
			body: { isActive: false },
			controller: ctrl,
		})) as { plan: WarrantyPlan };
		expect(result.plan.isActive).toBe(false);
	});
});

describe("admin DELETE /warranties/plans/:id/delete", () => {
	it("returns 404 when plan not found", async () => {
		const result = (await call(deletePlanHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes plan and returns success", async () => {
		const ctrl = makeController({
			deletePlan: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePlanHandler, {
			params: { id: "p1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Registrations ─────────────────────────────────────────────────────────────

describe("admin GET /warranties/registrations", () => {
	it("returns empty list when no registrations", async () => {
		const result = (await call(listRegistrationsHandler)) as {
			registrations: WarrantyRegistration[];
		};
		expect(result.registrations).toHaveLength(0);
	});

	it("returns registrations from controller", async () => {
		const regs = [makeRegistration(), makeRegistration()];
		const ctrl = makeController({
			listRegistrations: vi.fn().mockResolvedValue(regs),
		});
		const result = (await call(listRegistrationsHandler, {
			controller: ctrl,
		})) as { registrations: WarrantyRegistration[] };
		expect(result.registrations).toHaveLength(2);
	});
});

describe("admin POST /warranties/registrations/register", () => {
	it("registers a warranty and returns registration", async () => {
		const reg = makeRegistration({ customerId: "cust_2" });
		const ctrl = makeController({ register: vi.fn().mockResolvedValue(reg) });
		const result = (await call(registerHandler, {
			body: {
				warrantyPlanId: "plan_1",
				orderId: "order_2",
				customerId: "cust_2",
				productId: "prod_2",
				productName: "Widget Pro",
			},
			controller: ctrl,
		})) as { registration: WarrantyRegistration };
		expect(result.registration.customerId).toBe("cust_2");
	});
});

describe("admin GET /warranties/registrations/:id", () => {
	it("returns 404 when registration not found", async () => {
		const result = (await call(getRegistrationHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns registration when found", async () => {
		const reg = makeRegistration({ id: "reg_1" });
		const ctrl = makeController({
			getRegistration: vi.fn().mockResolvedValue(reg),
		});
		const result = (await call(getRegistrationHandler, {
			params: { id: "reg_1" },
			controller: ctrl,
		})) as { registration: WarrantyRegistration };
		expect(result.registration.id).toBe("reg_1");
	});
});

describe("admin POST /warranties/registrations/:id/void", () => {
	it("returns 404 when registration not found", async () => {
		const result = (await call(voidHandler, {
			params: { id: "missing" },
			body: { reason: "customer request" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("voids registration and returns it", async () => {
		const reg = makeRegistration({ status: "voided" });
		const ctrl = makeController({
			voidRegistration: vi.fn().mockResolvedValue(reg),
		});
		const result = (await call(voidHandler, {
			params: { id: reg.id },
			body: { reason: "customer request" },
			controller: ctrl,
		})) as { registration: WarrantyRegistration };
		expect(result.registration.status).toBe("voided");
	});
});

// ── Claims ────────────────────────────────────────────────────────────────────

describe("admin GET /warranties/claims", () => {
	it("returns empty list when no claims", async () => {
		const result = (await call(listClaimsHandler)) as {
			claims: WarrantyClaim[];
		};
		expect(result.claims).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listClaimsHandler, {
			query: { status: "submitted" },
			controller: ctrl,
		});
		expect(ctrl.listClaims).toHaveBeenCalledWith(
			expect.objectContaining({ status: "submitted" }),
		);
	});
});

describe("admin GET /warranties/claims/:id", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(getClaimHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns claim when found", async () => {
		const claim = makeClaim({ id: "claim_1" });
		const ctrl = makeController({ getClaim: vi.fn().mockResolvedValue(claim) });
		const result = (await call(getClaimHandler, {
			params: { id: "claim_1" },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.id).toBe("claim_1");
	});
});

describe("admin POST /warranties/claims/:id/review", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(reviewClaimHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("moves claim to under_review status", async () => {
		const claim = makeClaim({ status: "under_review" });
		const ctrl = makeController({
			reviewClaim: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(reviewClaimHandler, {
			params: { id: claim.id },
			body: { adminNotes: "Checking photos" },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("under_review");
	});
});

describe("admin POST /warranties/claims/:id/approve", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(approveClaimHandler, {
			params: { id: "missing" },
			body: { resolution: "repair" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("approves claim with resolution type", async () => {
		const claim = makeClaim({ status: "approved", resolution: "repair" });
		const ctrl = makeController({
			approveClaim: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(approveClaimHandler, {
			params: { id: claim.id },
			body: { resolution: "repair" },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("approved");
		expect(result.claim.resolution).toBe("repair");
		expect(ctrl.approveClaim).toHaveBeenCalledWith(
			claim.id,
			"repair",
			undefined,
		);
	});
});

describe("admin POST /warranties/claims/:id/deny", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(denyClaimHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("denies claim and returns it", async () => {
		const claim = makeClaim({ status: "denied" });
		const ctrl = makeController({
			denyClaim: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(denyClaimHandler, {
			params: { id: claim.id },
			body: { adminNotes: "Out of warranty period" },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("denied");
	});
});

describe("admin POST /warranties/claims/:id/start-repair", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(startRepairHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("starts repair and returns updated claim", async () => {
		const claim = makeClaim({ status: "in_repair" });
		const ctrl = makeController({
			startRepair: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(startRepairHandler, {
			params: { id: claim.id },
			body: {},
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("in_repair");
	});
});

describe("admin POST /warranties/claims/:id/resolve", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(resolveClaimHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("resolves claim and returns it", async () => {
		const claim = makeClaim({ status: "resolved" });
		const ctrl = makeController({
			resolveClaim: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(resolveClaimHandler, {
			params: { id: claim.id },
			body: { resolutionNotes: "Device replaced" },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("resolved");
	});
});

describe("admin POST /warranties/claims/:id/close", () => {
	it("returns 404 when claim not found", async () => {
		const result = (await call(closeClaimHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("closes claim and returns it", async () => {
		const claim = makeClaim({ status: "closed" });
		const ctrl = makeController({
			closeClaim: vi.fn().mockResolvedValue(claim),
		});
		const result = (await call(closeClaimHandler, {
			params: { id: claim.id },
			controller: ctrl,
		})) as { claim: WarrantyClaim };
		expect(result.claim.status).toBe("closed");
	});
});

describe("admin GET /warranties/claims/summary", () => {
	it("returns zero-state summary when no claims", async () => {
		const result = (await call(summaryHandler)) as { summary: ClaimSummary };
		expect(result.summary.totalClaims).toBe(0);
		expect(result.summary.submitted).toBe(0);
	});

	it("returns real summary data", async () => {
		const ctrl = makeController({
			getClaimSummary: vi.fn().mockResolvedValue({
				totalClaims: 42,
				submitted: 10,
				underReview: 8,
				approved: 12,
				denied: 5,
				inRepair: 3,
				resolved: 2,
				closed: 2,
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: ClaimSummary;
		};
		expect(result.summary.totalClaims).toBe(42);
		expect(result.summary.approved).toBe(12);
	});
});
