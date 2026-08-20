import { describe, expect, it, vi } from "vitest";
import { adminCreateCategory } from "../admin/endpoints/create-category";
import { adminCreateExemption } from "../admin/endpoints/create-exemption";
import { adminCreateNexus } from "../admin/endpoints/create-nexus";
import { adminCreateRate } from "../admin/endpoints/create-rate";
import { adminDeleteCategory } from "../admin/endpoints/delete-category";
import { adminDeleteExemption } from "../admin/endpoints/delete-exemption";
import { adminDeleteNexus } from "../admin/endpoints/delete-nexus";
import { adminDeleteRate } from "../admin/endpoints/delete-rate";
import { adminGetRate } from "../admin/endpoints/get-rate";
import { adminGetReport } from "../admin/endpoints/get-report";
import { adminLinkTransaction } from "../admin/endpoints/link-transaction";
import { adminListCategories } from "../admin/endpoints/list-categories";
import { adminListExemptions } from "../admin/endpoints/list-exemptions";
import { adminListNexus } from "../admin/endpoints/list-nexus";
import { adminListRates } from "../admin/endpoints/list-rates";
import { adminListTransactions } from "../admin/endpoints/list-transactions";
import { adminUpdateRate } from "../admin/endpoints/update-rate";
import type {
	TaxCategory,
	TaxController,
	TaxExemption,
	TaxNexus,
	TaxRate,
	TaxReportSummary,
	TaxTransaction,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeRate(overrides: Partial<TaxRate> = {}): TaxRate {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "US Standard",
		country: "US",
		state: "CA",
		city: "",
		postalCode: "",
		rate: 0.0825,
		type: "percentage",
		categoryId: "",
		enabled: true,
		priority: 0,
		compound: false,
		inclusive: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCategory(overrides: Partial<TaxCategory> = {}): TaxCategory {
	return {
		id: crypto.randomUUID(),
		name: "General",
		createdAt: new Date(),
		...overrides,
	};
}

function makeExemption(overrides: Partial<TaxExemption> = {}): TaxExemption {
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		type: "full",
		enabled: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeNexus(overrides: Partial<TaxNexus> = {}): TaxNexus {
	return {
		id: crypto.randomUUID(),
		country: "US",
		state: "CA",
		type: "physical",
		enabled: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeTx(overrides: Partial<TaxTransaction> = {}): TaxTransaction {
	return {
		id: crypto.randomUUID(),
		country: "US",
		state: "CA",
		subtotal: 10000,
		shippingAmount: 500,
		totalTax: 825,
		shippingTax: 41,
		effectiveRate: 0.0825,
		inclusive: false,
		exempt: false,
		lineDetails: [],
		rateNames: ["CA Sales Tax"],
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(overrides: Partial<TaxController> = {}): TaxController {
	return {
		createRate: vi.fn().mockResolvedValue(makeRate()),
		getRate: vi.fn().mockResolvedValue(null),
		listRates: vi.fn().mockResolvedValue([]),
		updateRate: vi.fn().mockResolvedValue(null),
		deleteRate: vi.fn().mockResolvedValue(false),
		createCategory: vi.fn().mockResolvedValue(makeCategory()),
		getCategory: vi.fn().mockResolvedValue(null),
		listCategories: vi.fn().mockResolvedValue([]),
		deleteCategory: vi.fn().mockResolvedValue(false),
		createExemption: vi.fn().mockResolvedValue(makeExemption()),
		getExemption: vi.fn().mockResolvedValue(null),
		listExemptions: vi.fn().mockResolvedValue([]),
		deleteExemption: vi.fn().mockResolvedValue(false),
		calculate: vi.fn().mockResolvedValue({
			totalTax: 0,
			shippingTax: 0,
			lines: [],
			effectiveRate: 0,
			inclusive: false,
			jurisdiction: { country: "US", state: "CA", city: "" },
		}),
		getRatesForAddress: vi.fn().mockResolvedValue([]),
		createNexus: vi.fn().mockResolvedValue(makeNexus()),
		getNexus: vi.fn().mockResolvedValue(null),
		listNexus: vi.fn().mockResolvedValue([]),
		deleteNexus: vi.fn().mockResolvedValue(false),
		hasNexus: vi.fn().mockResolvedValue(true),
		logTransaction: vi.fn().mockResolvedValue(makeTx()),
		listTransactions: vi.fn().mockResolvedValue([]),
		linkTransactionToOrder: vi.fn().mockResolvedValue(null),
		getReport: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: TaxController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { tax: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listRatesHandler = extractHandler(adminListRates);
const createRateHandler = extractHandler(adminCreateRate);
const getRateHandler = extractHandler(adminGetRate);
const updateRateHandler = extractHandler(adminUpdateRate);
const deleteRateHandler = extractHandler(adminDeleteRate);
const listCategoriesHandler = extractHandler(adminListCategories);
const createCategoryHandler = extractHandler(adminCreateCategory);
const deleteCategoryHandler = extractHandler(adminDeleteCategory);
const listExemptionsHandler = extractHandler(adminListExemptions);
const createExemptionHandler = extractHandler(adminCreateExemption);
const deleteExemptionHandler = extractHandler(adminDeleteExemption);
const listNexusHandler = extractHandler(adminListNexus);
const createNexusHandler = extractHandler(adminCreateNexus);
const deleteNexusHandler = extractHandler(adminDeleteNexus);
const listTxHandler = extractHandler(adminListTransactions);
const linkTxHandler = extractHandler(adminLinkTransaction);
const reportHandler = extractHandler(adminGetReport);

// ── Tax Rates ─────────────────────────────────────────────────────────────────

describe("admin GET /tax/rates", () => {
	it("returns empty list when no rates exist", async () => {
		const result = (await call(listRatesHandler)) as { rates: TaxRate[] };
		expect(result.rates).toHaveLength(0);
	});

	it("returns all rates from the controller", async () => {
		const rates = [makeRate({ country: "US" }), makeRate({ country: "CA" })];
		const ctrl = makeController({
			listRates: vi.fn().mockResolvedValue(rates),
		});
		const result = (await call(listRatesHandler, {
			controller: ctrl,
		})) as { rates: TaxRate[] };
		expect(result.rates).toHaveLength(2);
	});

	it("forwards country and state filters", async () => {
		const ctrl = makeController();
		await call(listRatesHandler, {
			query: { country: "US", state: "CA", enabled: "true" },
			controller: ctrl,
		});
		expect(ctrl.listRates).toHaveBeenCalledWith(
			expect.objectContaining({ country: "US", state: "CA", enabled: true }),
		);
	});

	it("forwards take and skip for pagination", async () => {
		const ctrl = makeController();
		await call(listRatesHandler, {
			query: { take: "10", skip: "20" },
			controller: ctrl,
		});
		expect(ctrl.listRates).toHaveBeenCalledWith(
			expect.objectContaining({ take: 10, skip: 20 }),
		);
	});
});

describe("admin POST /tax/rates/create", () => {
	it("creates a tax rate and returns it", async () => {
		const rate = makeRate({ name: "CA State Tax", rate: 0.06 });
		const ctrl = makeController({
			createRate: vi.fn().mockResolvedValue(rate),
		});
		const result = (await call(createRateHandler, {
			body: { name: "CA State Tax", country: "US", rate: 0.06 },
			controller: ctrl,
		})) as { taxRate: TaxRate };
		expect(result.taxRate.name).toBe("CA State Tax");
		expect(result.taxRate.rate).toBe(0.06);
	});
});

describe("admin GET /tax/rates/:id", () => {
	it("returns 404 when rate not found", async () => {
		const result = (await call(getRateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Tax rate not found");
	});

	it("returns rate when found", async () => {
		const rate = makeRate({ id: "r1" });
		const ctrl = makeController({ getRate: vi.fn().mockResolvedValue(rate) });
		const result = (await call(getRateHandler, {
			params: { id: "r1" },
			controller: ctrl,
		})) as { taxRate: TaxRate };
		expect(result.taxRate.id).toBe("r1");
	});
});

describe("admin PUT /tax/rates/:id/update", () => {
	it("returns 404 when rate not found", async () => {
		const result = (await call(updateRateHandler, {
			params: { id: "missing" },
			body: { enabled: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated rate on success", async () => {
		const rate = makeRate({ id: "r2", enabled: false });
		const ctrl = makeController({
			updateRate: vi.fn().mockResolvedValue(rate),
		});
		const result = (await call(updateRateHandler, {
			params: { id: "r2" },
			body: { enabled: false },
			controller: ctrl,
		})) as { taxRate: TaxRate };
		expect(result.taxRate.enabled).toBe(false);
		expect(ctrl.updateRate).toHaveBeenCalledWith(
			"r2",
			expect.objectContaining({ enabled: false }),
		);
	});
});

describe("admin DELETE /tax/rates/:id/delete", () => {
	it("returns 404 when rate not found", async () => {
		const result = (await call(deleteRateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes rate and returns success", async () => {
		const ctrl = makeController({
			deleteRate: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRateHandler, {
			params: { id: "r3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteRate).toHaveBeenCalledWith("r3");
	});
});

// ── Tax Categories ────────────────────────────────────────────────────────────

describe("admin GET /tax/categories", () => {
	it("returns empty list when no categories exist", async () => {
		const result = (await call(listCategoriesHandler)) as {
			categories: TaxCategory[];
		};
		expect(result.categories).toHaveLength(0);
	});

	it("returns all categories", async () => {
		const cats = [
			makeCategory({ name: "Food" }),
			makeCategory({ name: "Clothing" }),
		];
		const ctrl = makeController({
			listCategories: vi.fn().mockResolvedValue(cats),
		});
		const result = (await call(listCategoriesHandler, {
			controller: ctrl,
		})) as { categories: TaxCategory[] };
		expect(result.categories).toHaveLength(2);
	});
});

describe("admin POST /tax/categories/create", () => {
	it("creates a category and returns it", async () => {
		const cat = makeCategory({ name: "Digital Goods" });
		const ctrl = makeController({
			createCategory: vi.fn().mockResolvedValue(cat),
		});
		const result = (await call(createCategoryHandler, {
			body: { name: "Digital Goods" },
			controller: ctrl,
		})) as { category: TaxCategory };
		expect(result.category.name).toBe("Digital Goods");
	});
});

describe("admin DELETE /tax/categories/:id/delete", () => {
	it("returns 404 when category not found", async () => {
		const result = (await call(deleteCategoryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes category and returns success", async () => {
		const ctrl = makeController({
			deleteCategory: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCategoryHandler, {
			params: { id: "c1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Tax Exemptions ────────────────────────────────────────────────────────────

describe("admin GET /tax/exemptions", () => {
	it("returns exemptions for a customer", async () => {
		const exemptions = [makeExemption({ customerId: "cust_1" })];
		const ctrl = makeController({
			listExemptions: vi.fn().mockResolvedValue(exemptions),
		});
		const result = (await call(listExemptionsHandler, {
			query: { customerId: "cust_1" },
			controller: ctrl,
		})) as { exemptions: TaxExemption[] };
		expect(result.exemptions).toHaveLength(1);
		expect(ctrl.listExemptions).toHaveBeenCalledWith("cust_1");
	});

	it("returns empty list when customer has no exemptions", async () => {
		const result = (await call(listExemptionsHandler, {
			query: { customerId: "cust_2" },
		})) as { exemptions: TaxExemption[] };
		expect(result.exemptions).toHaveLength(0);
	});
});

describe("admin POST /tax/exemptions/create", () => {
	it("creates an exemption and returns it", async () => {
		const exemption = makeExemption({ customerId: "cust_3", type: "full" });
		const ctrl = makeController({
			createExemption: vi.fn().mockResolvedValue(exemption),
		});
		const result = (await call(createExemptionHandler, {
			body: { customerId: "cust_3", type: "full" },
			controller: ctrl,
		})) as { exemption: TaxExemption };
		expect(result.exemption.customerId).toBe("cust_3");
	});
});

describe("admin DELETE /tax/exemptions/:id/delete", () => {
	it("returns 404 when exemption not found", async () => {
		const result = (await call(deleteExemptionHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes exemption and returns success", async () => {
		const ctrl = makeController({
			deleteExemption: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteExemptionHandler, {
			params: { id: "e1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteExemption).toHaveBeenCalledWith("e1");
	});
});

// ── Tax Nexus ─────────────────────────────────────────────────────────────────

describe("admin GET /tax/nexus", () => {
	it("returns empty list when no nexus configured", async () => {
		const result = (await call(listNexusHandler)) as { nexus: TaxNexus[] };
		expect(result.nexus).toHaveLength(0);
	});

	it("returns nexus records filtered by country", async () => {
		const usNexus = [
			makeNexus({ country: "US" }),
			makeNexus({ country: "US", state: "NY" }),
		];
		const ctrl = makeController({
			listNexus: vi.fn().mockResolvedValue(usNexus),
		});
		const result = (await call(listNexusHandler, {
			query: { country: "US" },
			controller: ctrl,
		})) as { nexus: TaxNexus[] };
		expect(result.nexus).toHaveLength(2);
		expect(ctrl.listNexus).toHaveBeenCalledWith(
			expect.objectContaining({ country: "US" }),
		);
	});

	it("forwards enabled filter", async () => {
		const ctrl = makeController();
		await call(listNexusHandler, {
			query: { enabled: "true" },
			controller: ctrl,
		});
		expect(ctrl.listNexus).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: true }),
		);
	});
});

describe("admin POST /tax/nexus/create", () => {
	it("creates a nexus record and returns it", async () => {
		const nexus = makeNexus({ country: "US", state: "TX", type: "economic" });
		const ctrl = makeController({
			createNexus: vi.fn().mockResolvedValue(nexus),
		});
		const result = (await call(createNexusHandler, {
			body: { country: "US", state: "TX", type: "economic" },
			controller: ctrl,
		})) as { nexus: TaxNexus };
		expect(result.nexus.country).toBe("US");
		expect(result.nexus.type).toBe("economic");
	});
});

describe("admin DELETE /tax/nexus/:id/delete", () => {
	it("returns 404 when nexus not found", async () => {
		const result = (await call(deleteNexusHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes nexus and returns success", async () => {
		const ctrl = makeController({
			deleteNexus: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteNexusHandler, {
			params: { id: "n1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Tax Transactions ──────────────────────────────────────────────────────────

describe("admin GET /tax/transactions", () => {
	it("returns empty list when no transactions", async () => {
		const result = (await call(listTxHandler)) as {
			transactions: TaxTransaction[];
		};
		expect(result.transactions).toHaveLength(0);
	});

	it("returns transactions from controller", async () => {
		const txs = [makeTx({ country: "US" }), makeTx({ country: "CA" })];
		const ctrl = makeController({
			listTransactions: vi.fn().mockResolvedValue(txs),
		});
		const result = (await call(listTxHandler, {
			controller: ctrl,
		})) as { transactions: TaxTransaction[] };
		expect(result.transactions).toHaveLength(2);
	});

	it("forwards date range filters to controller", async () => {
		const ctrl = makeController();
		const startDate = "2024-01-01T00:00:00.000Z";
		const endDate = "2024-12-31T23:59:59.999Z";
		await call(listTxHandler, {
			query: { startDate, endDate, country: "US", state: "CA" },
			controller: ctrl,
		});
		expect(ctrl.listTransactions).toHaveBeenCalledWith(
			expect.objectContaining({
				country: "US",
				state: "CA",
			}),
		);
	});
});

describe("admin POST /tax/transactions/:id/link", () => {
	it("returns 404 when transaction not found", async () => {
		const result = (await call(linkTxHandler, {
			params: { id: "missing" },
			body: { orderId: "order_1" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("links transaction to order and returns it", async () => {
		const tx = makeTx({ id: "tx_1", orderId: "order_123" });
		const ctrl = makeController({
			linkTransactionToOrder: vi.fn().mockResolvedValue(tx),
		});
		const result = (await call(linkTxHandler, {
			params: { id: "tx_1" },
			body: { orderId: "order_123" },
			controller: ctrl,
		})) as { transaction: TaxTransaction };
		expect(result.transaction.orderId).toBe("order_123");
		expect(ctrl.linkTransactionToOrder).toHaveBeenCalledWith(
			"tx_1",
			"order_123",
		);
	});
});

// ── Tax Report ────────────────────────────────────────────────────────────────

describe("admin GET /tax/report", () => {
	it("returns empty report when no transactions", async () => {
		const result = (await call(reportHandler)) as {
			report: TaxReportSummary[];
		};
		expect(result.report).toHaveLength(0);
	});

	it("returns aggregated report data", async () => {
		const report: TaxReportSummary[] = [
			{
				jurisdiction: { country: "US", state: "CA" },
				totalTax: 12500,
				totalShippingTax: 620,
				totalSubtotal: 150000,
				transactionCount: 42,
				effectiveRate: 0.0833,
			},
		];
		const ctrl = makeController({
			getReport: vi.fn().mockResolvedValue(report),
		});
		const result = (await call(reportHandler, {
			controller: ctrl,
		})) as { report: TaxReportSummary[] };
		expect(result.report).toHaveLength(1);
		expect(result.report[0].jurisdiction.state).toBe("CA");
		expect(result.report[0].totalTax).toBe(12500);
	});

	it("forwards country and date range to controller", async () => {
		const ctrl = makeController();
		await call(reportHandler, {
			query: { country: "US", state: "NY" },
			controller: ctrl,
		});
		expect(ctrl.getReport).toHaveBeenCalledWith(
			expect.objectContaining({ country: "US", state: "NY" }),
		);
	});
});
