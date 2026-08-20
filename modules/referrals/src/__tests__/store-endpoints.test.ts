import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReferralController } from "../service-impl";

/**
 * Store endpoint integration tests for the referrals module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. my-code: auth required, get or auto-create referral code
 * 2. my-referrals: auth required, list referrals where customer is referrer
 * 3. my-stats: auth required, get stats with code and counts
 * 4. apply: auth required, apply a referral code (validates, prevents self-referral)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateMyCode(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createReferralController(data);
	const existing = await controller.getCodeForCustomer(opts.customerId);
	if (existing) {
		return { code: existing };
	}
	const created = await controller.createCode({
		customerId: opts.customerId,
	});
	return { code: created };
}

async function simulateMyReferrals(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createReferralController(data);
	const referrals = await controller.listReferrals({
		referrerCustomerId: opts.customerId,
	});
	return { referrals };
}

async function simulateMyStats(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createReferralController(data);
	const stats = await controller.getStatsForCustomer(opts.customerId);
	return { stats };
}

async function simulateApplyCode(
	data: DataService,
	body: { code: string; email?: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createReferralController(data);
	const normalizedCode = body.code.toUpperCase();
	const codeRecord = await controller.getCodeByCode(normalizedCode);

	if (!codeRecord) {
		return { error: "Referral code not found", status: 404 };
	}
	if (!codeRecord.active) {
		return { error: "Referral code is inactive", status: 422 };
	}
	if (codeRecord.customerId === opts.customerId) {
		return { error: "Cannot use your own referral code", status: 422 };
	}

	const referral = await controller.createReferral({
		referralCodeId: codeRecord.id,
		refereeCustomerId: opts.customerId,
		refereeEmail: body.email ?? "",
	});

	if (!referral) {
		return { error: "Referral code is no longer valid", status: 422 };
	}
	return { referral };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: my-code — get or auto-create referral code", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyCode(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("auto-creates a code if customer does not have one", async () => {
		const result = await simulateMyCode(data, { customerId: "cust_1" });

		expect("code" in result).toBe(true);
		if ("code" in result) {
			expect(result.code.customerId).toBe("cust_1");
			expect(result.code.code).toHaveLength(8);
			expect(result.code.active).toBe(true);
			expect(result.code.usageCount).toBe(0);
		}
	});

	it("returns existing code without creating a duplicate", async () => {
		const ctrl = createReferralController(data);
		const original = await ctrl.createCode({ customerId: "cust_1" });

		const result = await simulateMyCode(data, { customerId: "cust_1" });

		expect("code" in result).toBe(true);
		if ("code" in result) {
			expect(result.code.id).toBe(original.id);
			expect(result.code.code).toBe(original.code);
		}
	});

	it("creates distinct codes for different customers", async () => {
		const result1 = await simulateMyCode(data, { customerId: "cust_1" });
		const result2 = await simulateMyCode(data, { customerId: "cust_2" });

		expect("code" in result1).toBe(true);
		expect("code" in result2).toBe(true);
		if ("code" in result1 && "code" in result2) {
			expect(result1.code.id).not.toBe(result2.code.id);
			expect(result1.code.customerId).toBe("cust_1");
			expect(result2.code.customerId).toBe("cust_2");
		}
	});
});

describe("store endpoint: my-referrals — list referrals as referrer", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyReferrals(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns referrals where customer is the referrer", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });
		await ctrl.createReferral({
			referralCodeId: code.id,
			refereeCustomerId: "cust_2",
			refereeEmail: "cust2@example.com",
		});
		await ctrl.createReferral({
			referralCodeId: code.id,
			refereeCustomerId: "cust_3",
			refereeEmail: "cust3@example.com",
		});

		const result = await simulateMyReferrals(data, {
			customerId: "cust_1",
		});

		expect("referrals" in result).toBe(true);
		if ("referrals" in result) {
			expect(result.referrals).toHaveLength(2);
			expect(
				result.referrals.every((r) => r.referrerCustomerId === "cust_1"),
			).toBe(true);
		}
	});

	it("returns empty array for customer with no referrals", async () => {
		const result = await simulateMyReferrals(data, {
			customerId: "cust_new",
		});

		expect("referrals" in result).toBe(true);
		if ("referrals" in result) {
			expect(result.referrals).toHaveLength(0);
		}
	});

	it("excludes referrals where customer is the referee", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });
		await ctrl.createReferral({
			referralCodeId: code.id,
			refereeCustomerId: "cust_2",
			refereeEmail: "cust2@example.com",
		});

		// cust_2 is the referee, not the referrer — should see nothing
		const result = await simulateMyReferrals(data, {
			customerId: "cust_2",
		});

		expect("referrals" in result).toBe(true);
		if ("referrals" in result) {
			expect(result.referrals).toHaveLength(0);
		}
	});
});

describe("store endpoint: my-stats — referral stats for customer", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyStats(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns stats with code and referral counts", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });
		const ref1 = await ctrl.createReferral({
			referralCodeId: code.id,
			refereeCustomerId: "cust_2",
			refereeEmail: "cust2@example.com",
		});
		await ctrl.createReferral({
			referralCodeId: code.id,
			refereeCustomerId: "cust_3",
			refereeEmail: "cust3@example.com",
		});

		// Complete one referral
		if (ref1) {
			await ctrl.completeReferral(ref1.id);
		}

		const result = await simulateMyStats(data, { customerId: "cust_1" });

		expect("stats" in result).toBe(true);
		if ("stats" in result) {
			expect(result.stats.code).not.toBeNull();
			expect(result.stats.code?.id).toBe(code.id);
			expect(result.stats.totalReferrals).toBe(2);
			expect(result.stats.completedReferrals).toBe(1);
			expect(result.stats.pendingReferrals).toBe(1);
		}
	});

	it("returns null code and zero counts for customer without a code", async () => {
		const result = await simulateMyStats(data, {
			customerId: "cust_no_code",
		});

		expect("stats" in result).toBe(true);
		if ("stats" in result) {
			expect(result.stats.code).toBeNull();
			expect(result.stats.totalReferrals).toBe(0);
			expect(result.stats.completedReferrals).toBe(0);
			expect(result.stats.pendingReferrals).toBe(0);
		}
	});

	it("returns zero counts when code exists but no referrals yet", async () => {
		const ctrl = createReferralController(data);
		await ctrl.createCode({ customerId: "cust_1" });

		const result = await simulateMyStats(data, { customerId: "cust_1" });

		expect("stats" in result).toBe(true);
		if ("stats" in result) {
			expect(result.stats.code).not.toBeNull();
			expect(result.stats.totalReferrals).toBe(0);
			expect(result.stats.completedReferrals).toBe(0);
			expect(result.stats.pendingReferrals).toBe(0);
		}
	});
});

describe("store endpoint: apply — apply a referral code", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateApplyCode(data, { code: "ABCD1234" });
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("creates a referral with a valid code", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });

		const result = await simulateApplyCode(
			data,
			{ code: code.code, email: "referee@example.com" },
			{ customerId: "cust_2" },
		);

		expect("referral" in result).toBe(true);
		if ("referral" in result) {
			expect(result.referral.referrerCustomerId).toBe("cust_1");
			expect(result.referral.refereeCustomerId).toBe("cust_2");
			expect(result.referral.refereeEmail).toBe("referee@example.com");
			expect(result.referral.status).toBe("pending");
		}
	});

	it("converts code to uppercase before lookup", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });

		// Pass lowercase version of the code
		const result = await simulateApplyCode(
			data,
			{ code: code.code.toLowerCase(), email: "ref@example.com" },
			{ customerId: "cust_2" },
		);

		expect("referral" in result).toBe(true);
		if ("referral" in result) {
			expect(result.referral.referrerCustomerId).toBe("cust_1");
		}
	});

	it("returns 404 for a code that does not exist", async () => {
		const result = await simulateApplyCode(
			data,
			{ code: "NONEXIST" },
			{ customerId: "cust_2" },
		);

		expect(result).toEqual({
			error: "Referral code not found",
			status: 404,
		});
	});

	it("returns 422 for an inactive code", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });
		await ctrl.deactivateCode(code.id);

		const result = await simulateApplyCode(
			data,
			{ code: code.code },
			{ customerId: "cust_2" },
		);

		expect(result).toEqual({
			error: "Referral code is inactive",
			status: 422,
		});
	});

	it("returns 422 for self-referral", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });

		const result = await simulateApplyCode(
			data,
			{ code: code.code },
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Cannot use your own referral code",
			status: 422,
		});
	});

	it("returns 422 when maxUses is reached", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({
			customerId: "cust_1",
			maxUses: 1,
		});

		// First use succeeds
		const first = await simulateApplyCode(
			data,
			{ code: code.code, email: "first@example.com" },
			{ customerId: "cust_2" },
		);
		expect("referral" in first).toBe(true);

		// Second use fails — maxUses reached
		const second = await simulateApplyCode(
			data,
			{ code: code.code, email: "second@example.com" },
			{ customerId: "cust_3" },
		);
		expect(second).toEqual({
			error: "Referral code is no longer valid",
			status: 422,
		});
	});

	it("increments usageCount on successful referral", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({ customerId: "cust_1" });

		expect(code.usageCount).toBe(0);

		await simulateApplyCode(
			data,
			{ code: code.code, email: "ref1@example.com" },
			{ customerId: "cust_2" },
		);
		await simulateApplyCode(
			data,
			{ code: code.code, email: "ref2@example.com" },
			{ customerId: "cust_3" },
		);

		const updated = await ctrl.getCode(code.id);
		expect(updated).not.toBeNull();
		expect(updated?.usageCount).toBe(2);
	});

	it("returns 422 when code is expired", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({
			customerId: "cust_1",
			expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
		});

		const result = await simulateApplyCode(
			data,
			{ code: code.code, email: "ref@example.com" },
			{ customerId: "cust_2" },
		);

		expect(result).toEqual({
			error: "Referral code is no longer valid",
			status: 422,
		});
	});

	it("succeeds when maxUses is 0 (unlimited)", async () => {
		const ctrl = createReferralController(data);
		const code = await ctrl.createCode({
			customerId: "cust_1",
			maxUses: 0,
		});

		// Multiple uses should all succeed
		for (let i = 2; i <= 5; i++) {
			const result = await simulateApplyCode(
				data,
				{ code: code.code, email: `ref${i}@example.com` },
				{ customerId: `cust_${i}` },
			);
			expect("referral" in result).toBe(true);
		}

		const updated = await ctrl.getCode(code.id);
		expect(updated?.usageCount).toBe(4);
	});
});
