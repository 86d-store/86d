import { describe, expect, it, vi } from "vitest";
import { adjustCredit } from "../admin/endpoints/adjust-credit";
import { creditSummary } from "../admin/endpoints/credit-summary";
import { freezeAccount } from "../admin/endpoints/freeze-account";
import { getAccount } from "../admin/endpoints/get-account";
import { listAccounts } from "../admin/endpoints/list-accounts";
import { listAllTransactions } from "../admin/endpoints/list-transactions";
import { unfreezeAccount } from "../admin/endpoints/unfreeze-account";
import type {
	CreditAccount,
	CreditSummary,
	CreditTransaction,
	StoreCreditController,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAccount(overrides: Partial<CreditAccount> = {}): CreditAccount {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		balance: 0,
		lifetimeCredited: 0,
		lifetimeDebited: 0,
		currency: "USD",
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTransaction(
	overrides: Partial<CreditTransaction> = {},
): CreditTransaction {
	return {
		id: crypto.randomUUID(),
		accountId: "acc_1",
		type: "credit",
		amount: 1000,
		balanceAfter: 1000,
		reason: "return_refund",
		description: "Refund",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<StoreCreditController> = {},
): StoreCreditController {
	return {
		getOrCreateAccount: vi.fn().mockResolvedValue(makeAccount()),
		getAccount: vi.fn().mockResolvedValue(null),
		getAccountById: vi.fn().mockResolvedValue(null),
		freezeAccount: vi.fn().mockResolvedValue(makeAccount({ status: "frozen" })),
		unfreezeAccount: vi
			.fn()
			.mockResolvedValue(makeAccount({ status: "active" })),
		credit: vi.fn().mockResolvedValue(makeTransaction()),
		debit: vi.fn().mockResolvedValue(makeTransaction({ type: "debit" })),
		getBalance: vi.fn().mockResolvedValue(0),
		listTransactions: vi.fn().mockResolvedValue([]),
		listAccounts: vi.fn().mockResolvedValue([]),
		getSummary: vi.fn().mockResolvedValue({
			totalAccounts: 0,
			totalOutstandingBalance: 0,
			totalLifetimeCredited: 0,
			totalLifetimeDebited: 0,
		} satisfies CreditSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: StoreCreditController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { "store-credits": opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listAccountsHandler = extractHandler(listAccounts);
const getAccountHandler = extractHandler(getAccount);
const adjustCreditHandler = extractHandler(adjustCredit);
const freezeAccountHandler = extractHandler(freezeAccount);
const unfreezeAccountHandler = extractHandler(unfreezeAccount);
const creditSummaryHandler = extractHandler(creditSummary);
const listAllTransactionsHandler = extractHandler(listAllTransactions);

// ── listAccounts ──────────────────────────────────────────────────────────────

describe("admin GET /store-credits/accounts", () => {
	it("returns empty list when no accounts exist", async () => {
		const result = (await call(listAccountsHandler)) as {
			accounts: CreditAccount[];
		};
		expect(result.accounts).toHaveLength(0);
	});

	it("returns accounts from controller", async () => {
		const accounts = [
			makeAccount({ customerId: "c1" }),
			makeAccount({ customerId: "c2" }),
		];
		const ctrl = makeController({
			listAccounts: vi.fn().mockResolvedValue(accounts),
		});
		const result = (await call(listAccountsHandler, { controller: ctrl })) as {
			accounts: CreditAccount[];
		};
		expect(result.accounts).toHaveLength(2);
	});
});

// ── getAccount ────────────────────────────────────────────────────────────────

describe("admin GET /store-credits/accounts/:customerId", () => {
	it("returns null account and empty transactions when not found", async () => {
		const result = (await call(getAccountHandler, {
			params: { customerId: "missing" },
		})) as { account: CreditAccount | null; transactions: CreditTransaction[] };
		expect(result.account).toBeNull();
		expect(result.transactions).toHaveLength(0);
	});

	it("returns account and transactions when found", async () => {
		const account = makeAccount({ id: "acc_1", customerId: "cust_1" });
		const txns = [makeTransaction({ accountId: "acc_1" })];
		const ctrl = makeController({
			getAccount: vi.fn().mockResolvedValue(account),
			listTransactions: vi.fn().mockResolvedValue(txns),
		});
		const result = (await call(getAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: CreditAccount; transactions: CreditTransaction[] };
		expect(result.account.customerId).toBe("cust_1");
		expect(result.transactions).toHaveLength(1);
	});
});

// ── adjustCredit ──────────────────────────────────────────────────────────────

describe("admin POST /store-credits/accounts/:customerId/adjust", () => {
	it("returns 400 when amount is zero", async () => {
		const result = (await call(adjustCreditHandler, {
			params: { customerId: "cust_1" },
			body: { amount: 0, description: "test" },
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("calls credit for positive amount and returns transaction and account", async () => {
		const account = makeAccount({ customerId: "cust_1", balance: 5000 });
		const txn = makeTransaction({ amount: 5000 });
		const ctrl = makeController({
			credit: vi.fn().mockResolvedValue(txn),
			getAccount: vi.fn().mockResolvedValue(account),
		});
		const result = (await call(adjustCreditHandler, {
			params: { customerId: "cust_1" },
			body: { amount: 5000, description: "Goodwill credit" },
			controller: ctrl,
		})) as { transaction: CreditTransaction; account: CreditAccount };
		expect(result.transaction.amount).toBe(5000);
		expect(ctrl.credit).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust_1", amount: 5000 }),
		);
	});
});

// ── freezeAccount ─────────────────────────────────────────────────────────────

describe("admin POST /store-credits/accounts/:customerId/freeze", () => {
	it("freezes account and returns it", async () => {
		const frozen = makeAccount({ status: "frozen" });
		const ctrl = makeController({
			freezeAccount: vi.fn().mockResolvedValue(frozen),
		});
		const result = (await call(freezeAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: CreditAccount };
		expect(result.account.status).toBe("frozen");
		expect(ctrl.freezeAccount).toHaveBeenCalledWith("cust_1");
	});
});

// ── unfreezeAccount ───────────────────────────────────────────────────────────

describe("admin POST /store-credits/accounts/:customerId/unfreeze", () => {
	it("unfreezes account and returns it", async () => {
		const active = makeAccount({ status: "active" });
		const ctrl = makeController({
			unfreezeAccount: vi.fn().mockResolvedValue(active),
		});
		const result = (await call(unfreezeAccountHandler, {
			params: { customerId: "cust_1" },
			controller: ctrl,
		})) as { account: CreditAccount };
		expect(result.account.status).toBe("active");
		expect(ctrl.unfreezeAccount).toHaveBeenCalledWith("cust_1");
	});
});

// ── creditSummary ─────────────────────────────────────────────────────────────

describe("admin GET /store-credits/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(creditSummaryHandler)) as CreditSummary;
		expect(result.totalAccounts).toBe(0);
		expect(result.totalOutstandingBalance).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const summary: CreditSummary = {
			totalAccounts: 10,
			totalOutstandingBalance: 50000,
			totalLifetimeCredited: 75000,
			totalLifetimeDebited: 25000,
		};
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue(summary),
		});
		const result = (await call(creditSummaryHandler, {
			controller: ctrl,
		})) as CreditSummary;
		expect(result.totalAccounts).toBe(10);
		expect(result.totalOutstandingBalance).toBe(50000);
	});
});

// ── listAllTransactions ───────────────────────────────────────────────────────

describe("admin GET /store-credits/transactions", () => {
	it("returns empty transactions when no accounts exist", async () => {
		const result = (await call(listAllTransactionsHandler)) as {
			transactions: CreditTransaction[];
		};
		expect(result.transactions).toHaveLength(0);
	});

	it("returns transactions for specific accountId", async () => {
		const txns = [makeTransaction(), makeTransaction()];
		const ctrl = makeController({
			listTransactions: vi.fn().mockResolvedValue(txns),
		});
		const result = (await call(listAllTransactionsHandler, {
			query: { accountId: "acc_1" },
			controller: ctrl,
		})) as { transactions: CreditTransaction[] };
		expect(result.transactions).toHaveLength(2);
		expect(ctrl.listTransactions).toHaveBeenCalledWith(
			"acc_1",
			expect.anything(),
		);
	});
});
