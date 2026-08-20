import { describe, expect, it, vi } from "vitest";
import { adminBulkTags } from "../admin/endpoints/bulk-tags";
import { adminCreateAddress } from "../admin/endpoints/create-address";
import { adminDeleteAddress } from "../admin/endpoints/delete-address";
import { adminDeleteCustomer } from "../admin/endpoints/delete-customer";
import { adminExportCustomers } from "../admin/endpoints/export-customers";
import { adminGetCustomer } from "../admin/endpoints/get-customer";
import { adminImportCustomers } from "../admin/endpoints/import-customers";
import { adminListCustomers } from "../admin/endpoints/list-customers";
import { adminListTags } from "../admin/endpoints/list-tags";
import { adminAdjustPoints } from "../admin/endpoints/loyalty-adjust";
import {
	adminGetLoyaltyBalance,
	adminGetLoyaltyHistory,
} from "../admin/endpoints/loyalty-balance";
import { adminEarnPoints } from "../admin/endpoints/loyalty-earn";
import { adminRedeemPoints } from "../admin/endpoints/loyalty-redeem";
import { adminGetLoyaltyStats } from "../admin/endpoints/loyalty-stats";
import { adminAddTags, adminRemoveTags } from "../admin/endpoints/manage-tags";
import { adminSetDefaultAddress } from "../admin/endpoints/set-default-address";
import { adminUpdateAddress } from "../admin/endpoints/update-address";
import { adminUpdateCustomer } from "../admin/endpoints/update-customer";
import type {
	Customer,
	CustomerAddress,
	CustomerController,
	LoyaltyBalance,
	LoyaltyStats,
	LoyaltyTransaction,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		email: "test@example.com",
		firstName: "Test",
		lastName: "User",
		tags: [],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeAddress(
	overrides: Partial<CustomerAddress> = {},
): CustomerAddress {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust-1",
		type: "shipping",
		firstName: "John",
		lastName: "Doe",
		line1: "123 Main St",
		city: "Springfield",
		state: "IL",
		postalCode: "62701",
		country: "US",
		isDefault: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTransaction(
	overrides: Partial<LoyaltyTransaction> = {},
): LoyaltyTransaction {
	return {
		id: crypto.randomUUID(),
		customerId: "cust-1",
		type: "earn",
		points: 100,
		balance: 100,
		reason: "Purchase",
		createdAt: new Date(),
		...overrides,
	};
}

function makeBalance(overrides: Partial<LoyaltyBalance> = {}): LoyaltyBalance {
	return {
		customerId: "cust-1",
		totalEarned: 0,
		totalRedeemed: 0,
		balance: 0,
		transactionCount: 0,
		...overrides,
	};
}

function makeStats(overrides: Partial<LoyaltyStats> = {}): LoyaltyStats {
	return {
		totalCustomersWithPoints: 0,
		totalPointsIssued: 0,
		totalPointsRedeemed: 0,
		totalPointsOutstanding: 0,
		averageBalance: 0,
		topCustomers: [],
		...overrides,
	};
}

function makeController(
	overrides: Partial<CustomerController> = {},
): CustomerController {
	return {
		getById: vi.fn().mockResolvedValue(null),
		getByEmail: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue(makeCustomer()),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue({ customers: [], total: 0 }),
		addTags: vi.fn().mockResolvedValue(null),
		removeTags: vi.fn().mockResolvedValue(null),
		listAllTags: vi.fn().mockResolvedValue([]),
		bulkAddTags: vi.fn().mockResolvedValue({ updated: 0 }),
		bulkRemoveTags: vi.fn().mockResolvedValue({ updated: 0 }),
		listAddresses: vi.fn().mockResolvedValue([]),
		getAddress: vi.fn().mockResolvedValue(null),
		createAddress: vi.fn().mockResolvedValue(makeAddress()),
		updateAddress: vi.fn().mockResolvedValue(null),
		deleteAddress: vi.fn().mockResolvedValue(undefined),
		setDefaultAddress: vi.fn().mockResolvedValue(null),
		listForExport: vi.fn().mockResolvedValue([]),
		importCustomers: vi
			.fn()
			.mockResolvedValue({ created: 0, updated: 0, errors: [] }),
		getLoyaltyBalance: vi.fn().mockResolvedValue(makeBalance()),
		getLoyaltyHistory: vi
			.fn()
			.mockResolvedValue({ transactions: [], total: 0 }),
		earnPoints: vi.fn().mockResolvedValue(makeTransaction()),
		redeemPoints: vi
			.fn()
			.mockResolvedValue(makeTransaction({ type: "redeem" })),
		adjustPoints: vi
			.fn()
			.mockResolvedValue(makeTransaction({ type: "adjust" })),
		getLoyaltyStats: vi.fn().mockResolvedValue(makeStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: CustomerController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				customer: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listCustomersHandler = extractHandler(adminListCustomers);
const getCustomerHandler = extractHandler(adminGetCustomer);
const updateCustomerHandler = extractHandler(adminUpdateCustomer);
const deleteCustomerHandler = extractHandler(adminDeleteCustomer);
const exportCustomersHandler = extractHandler(adminExportCustomers);
const importCustomersHandler = extractHandler(adminImportCustomers);
const listTagsHandler = extractHandler(adminListTags);
const addTagsHandler = extractHandler(adminAddTags);
const removeTagsHandler = extractHandler(adminRemoveTags);
const bulkTagsHandler = extractHandler(adminBulkTags);
const createAddressHandler = extractHandler(adminCreateAddress);
const updateAddressHandler = extractHandler(adminUpdateAddress);
const deleteAddressHandler = extractHandler(adminDeleteAddress);
const setDefaultAddressHandler = extractHandler(adminSetDefaultAddress);
const getLoyaltyBalanceHandler = extractHandler(adminGetLoyaltyBalance);
const getLoyaltyHistoryHandler = extractHandler(adminGetLoyaltyHistory);
const earnPointsHandler = extractHandler(adminEarnPoints);
const redeemPointsHandler = extractHandler(adminRedeemPoints);
const adjustPointsHandler = extractHandler(adminAdjustPoints);
const getLoyaltyStatsHandler = extractHandler(adminGetLoyaltyStats);

// ── adminListCustomers ────────────────────────────────────────────────────────

describe("admin GET /admin/customers", () => {
	it("returns customers list with pagination metadata", async () => {
		const customers = [
			makeCustomer({ email: "a@test.com" }),
			makeCustomer({ email: "b@test.com" }),
		];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue({ customers, total: 2 }),
		});
		const result = (await call(listCustomersHandler, { controller: ctrl })) as {
			customers: Customer[];
			total: number;
			page: number;
			limit: number;
			pages: number;
		};
		expect(result.customers).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(result.page).toBe(1);
		expect(result.pages).toBe(1);
	});

	it("forwards search and tag query params to controller", async () => {
		const ctrl = makeController();
		await call(listCustomersHandler, {
			query: { search: "alice", tag: "vip" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ search: "alice", tag: "vip" }),
		);
	});
});

// ── adminGetCustomer ──────────────────────────────────────────────────────────

describe("admin GET /admin/customers/:id", () => {
	it("returns customer with addresses when found", async () => {
		const customer = makeCustomer({ id: "cust-1" });
		const addresses = [makeAddress({ customerId: "cust-1" })];
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(customer),
			listAddresses: vi.fn().mockResolvedValue(addresses),
		});
		const result = (await call(getCustomerHandler, {
			params: { id: "cust-1" },
			controller: ctrl,
		})) as { customer: Customer; addresses: CustomerAddress[] };
		expect(result.customer.id).toBe("cust-1");
		expect(result.addresses).toHaveLength(1);
	});

	it("returns 404 when customer not found", async () => {
		const result = (await call(getCustomerHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminUpdateCustomer ───────────────────────────────────────────────────────

describe("admin PUT /admin/customers/:id/update", () => {
	it("updates customer and returns it", async () => {
		const updated = makeCustomer({ id: "cust-2", firstName: "Updated" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCustomerHandler, {
			params: { id: "cust-2" },
			body: { firstName: "Updated" },
			controller: ctrl,
		})) as { customer: Customer };
		expect(result.customer.firstName).toBe("Updated");
		expect(ctrl.update).toHaveBeenCalledWith(
			"cust-2",
			expect.objectContaining({ firstName: "Updated" }),
		);
	});

	it("returns 404 when customer not found", async () => {
		const result = (await call(updateCustomerHandler, {
			params: { id: "missing" },
			body: { firstName: "Ghost" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminDeleteCustomer ───────────────────────────────────────────────────────

describe("admin DELETE /admin/customers/:id/delete", () => {
	it("deletes customer and returns success", async () => {
		const customer = makeCustomer({ id: "cust-3" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(customer),
			delete: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteCustomerHandler, {
			params: { id: "cust-3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("cust-3");
	});

	it("returns 404 when customer does not exist", async () => {
		const result = (await call(deleteCustomerHandler, {
			params: { id: "nobody" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminExportCustomers ──────────────────────────────────────────────────────

describe("admin GET /admin/customers/export", () => {
	it("returns all customers and total count", async () => {
		const customers = [makeCustomer(), makeCustomer(), makeCustomer()];
		const ctrl = makeController({
			listForExport: vi.fn().mockResolvedValue(customers),
		});
		const result = (await call(exportCustomersHandler, {
			controller: ctrl,
		})) as { customers: Customer[]; total: number };
		expect(result.customers).toHaveLength(3);
		expect(result.total).toBe(3);
	});

	it("forwards search, tag, dateFrom, dateTo to controller", async () => {
		const ctrl = makeController();
		await call(exportCustomersHandler, {
			query: {
				search: "jones",
				tag: "wholesale",
				dateFrom: "2025-01-01T00:00:00Z",
				dateTo: "2025-12-31T23:59:59Z",
			},
			controller: ctrl,
		});
		expect(ctrl.listForExport).toHaveBeenCalledWith(
			expect.objectContaining({
				search: "jones",
				tag: "wholesale",
				dateFrom: "2025-01-01T00:00:00Z",
				dateTo: "2025-12-31T23:59:59Z",
			}),
		);
	});
});

// ── adminImportCustomers ──────────────────────────────────────────────────────

describe("admin POST /admin/customers/import", () => {
	it("returns created/updated/errors summary", async () => {
		const ctrl = makeController({
			importCustomers: vi
				.fn()
				.mockResolvedValue({ created: 2, updated: 1, errors: [] }),
		});
		const result = (await call(importCustomersHandler, {
			body: {
				customers: [
					{ email: "new@test.com", firstName: "New", lastName: "User" },
					{
						email: "existing@test.com",
						firstName: "Existing",
						lastName: "User",
					},
					{ email: "another@test.com" },
				],
			},
			controller: ctrl,
		})) as { created: number; updated: number; errors: unknown[] };
		expect(result.created).toBe(2);
		expect(result.updated).toBe(1);
		expect(result.errors).toHaveLength(0);
	});

	it("passes parsed rows to controller importCustomers", async () => {
		const ctrl = makeController();
		await call(importCustomersHandler, {
			body: {
				customers: [
					{ email: "import@test.com", firstName: "Import", lastName: "Me" },
				],
			},
			controller: ctrl,
		});
		expect(ctrl.importCustomers).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ email: "import@test.com" }),
			]),
		);
	});
});

// ── adminListTags ─────────────────────────────────────────────────────────────

describe("admin GET /admin/customers/tags", () => {
	it("returns empty tags list when no tags exist", async () => {
		const result = (await call(listTagsHandler)) as {
			tags: { tag: string; count: number }[];
		};
		expect(result.tags).toHaveLength(0);
	});

	it("returns tags with counts from controller", async () => {
		const tags = [
			{ tag: "vip", count: 5 },
			{ tag: "wholesale", count: 3 },
		];
		const ctrl = makeController({
			listAllTags: vi.fn().mockResolvedValue(tags),
		});
		const result = (await call(listTagsHandler, { controller: ctrl })) as {
			tags: { tag: string; count: number }[];
		};
		expect(result.tags).toHaveLength(2);
		expect(result.tags[0]?.tag).toBe("vip");
		expect(result.tags[0]?.count).toBe(5);
	});
});

// ── adminAddTags ──────────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:id/tags", () => {
	it("adds tags to customer and returns updated customer", async () => {
		const customer = makeCustomer({ id: "cust-4", tags: ["vip", "new-tag"] });
		const ctrl = makeController({
			addTags: vi.fn().mockResolvedValue(customer),
		});
		const result = (await call(addTagsHandler, {
			params: { id: "cust-4" },
			body: { tags: ["new-tag"] },
			controller: ctrl,
		})) as { customer: Customer };
		expect(result.customer.tags).toContain("new-tag");
		expect(ctrl.addTags).toHaveBeenCalledWith("cust-4", ["new-tag"]);
	});

	it("returns 404 when customer not found", async () => {
		const result = (await call(addTagsHandler, {
			params: { id: "missing" },
			body: { tags: ["vip"] },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminRemoveTags ───────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:id/tags/remove", () => {
	it("removes tags from customer and returns updated customer", async () => {
		const customer = makeCustomer({ id: "cust-5", tags: ["remaining"] });
		const ctrl = makeController({
			removeTags: vi.fn().mockResolvedValue(customer),
		});
		const result = (await call(removeTagsHandler, {
			params: { id: "cust-5" },
			body: { tags: ["removed"] },
			controller: ctrl,
		})) as { customer: Customer };
		expect(result.customer.tags).toEqual(["remaining"]);
		expect(ctrl.removeTags).toHaveBeenCalledWith("cust-5", ["removed"]);
	});

	it("returns 404 when customer not found", async () => {
		const result = (await call(removeTagsHandler, {
			params: { id: "ghost" },
			body: { tags: ["vip"] },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminBulkTags ─────────────────────────────────────────────────────────────

describe("admin POST /admin/customers/bulk-tags", () => {
	it("bulk adds tags and returns updated count", async () => {
		const ctrl = makeController({
			bulkAddTags: vi.fn().mockResolvedValue({ updated: 4 }),
		});
		const result = (await call(bulkTagsHandler, {
			body: {
				action: "add",
				customerIds: ["c1", "c2", "c3", "c4"],
				tags: ["promo"],
			},
			controller: ctrl,
		})) as { updated: number };
		expect(result.updated).toBe(4);
		expect(ctrl.bulkAddTags).toHaveBeenCalledWith(
			["c1", "c2", "c3", "c4"],
			["promo"],
		);
	});

	it("bulk removes tags and returns updated count", async () => {
		const ctrl = makeController({
			bulkRemoveTags: vi.fn().mockResolvedValue({ updated: 2 }),
		});
		const result = (await call(bulkTagsHandler, {
			body: {
				action: "remove",
				customerIds: ["c1", "c2"],
				tags: ["old-tag"],
			},
			controller: ctrl,
		})) as { updated: number };
		expect(result.updated).toBe(2);
		expect(ctrl.bulkRemoveTags).toHaveBeenCalledWith(["c1", "c2"], ["old-tag"]);
	});
});

// ── adminCreateAddress ────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:customerId/addresses/create", () => {
	it("creates address for existing customer and returns it", async () => {
		const customer = makeCustomer({ id: "cust-6" });
		const address = makeAddress({ customerId: "cust-6" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(customer),
			createAddress: vi.fn().mockResolvedValue(address),
		});
		const result = (await call(createAddressHandler, {
			params: { customerId: "cust-6" },
			body: {
				firstName: "John",
				lastName: "Doe",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			},
			controller: ctrl,
		})) as { address: CustomerAddress };
		expect(result.address.customerId).toBe("cust-6");
		expect(ctrl.createAddress).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-6", line1: "123 Main St" }),
		);
	});

	it("returns 404 when customer not found", async () => {
		const result = (await call(createAddressHandler, {
			params: { customerId: "no-such-customer" },
			body: {
				firstName: "Jane",
				lastName: "Doe",
				line1: "456 Elm St",
				city: "Chicago",
				state: "IL",
				postalCode: "60601",
				country: "US",
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Customer not found");
	});
});

// ── adminUpdateAddress ────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:customerId/addresses/:addressId/update", () => {
	it("updates address and returns it", async () => {
		const address = makeAddress({ id: "addr-1", city: "NewCity" });
		const ctrl = makeController({
			updateAddress: vi.fn().mockResolvedValue(address),
		});
		const result = (await call(updateAddressHandler, {
			params: { customerId: "cust-7", addressId: "addr-1" },
			body: { city: "NewCity" },
			controller: ctrl,
		})) as { address: CustomerAddress };
		expect(result.address.city).toBe("NewCity");
		expect(ctrl.updateAddress).toHaveBeenCalledWith(
			"addr-1",
			expect.objectContaining({ city: "NewCity" }),
		);
	});

	it("returns 404 when address not found", async () => {
		const result = (await call(updateAddressHandler, {
			params: { customerId: "cust-7", addressId: "addr-missing" },
			body: { city: "Nowhere" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Address not found");
	});
});

// ── adminDeleteAddress ────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:customerId/addresses/:addressId/delete", () => {
	it("deletes address belonging to customer and returns success", async () => {
		const address = makeAddress({ id: "addr-2", customerId: "cust-8" });
		const ctrl = makeController({
			getAddress: vi.fn().mockResolvedValue(address),
			deleteAddress: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteAddressHandler, {
			params: { customerId: "cust-8", addressId: "addr-2" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteAddress).toHaveBeenCalledWith("addr-2");
	});

	it("returns 404 when address does not belong to customer", async () => {
		const address = makeAddress({ id: "addr-3", customerId: "other-customer" });
		const ctrl = makeController({
			getAddress: vi.fn().mockResolvedValue(address),
		});
		const result = (await call(deleteAddressHandler, {
			params: { customerId: "cust-9", addressId: "addr-3" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Address not found");
	});
});

// ── adminSetDefaultAddress ────────────────────────────────────────────────────

describe("admin POST /admin/customers/:customerId/addresses/:addressId/set-default", () => {
	it("sets address as default and returns it", async () => {
		const address = makeAddress({ id: "addr-4", isDefault: true });
		const ctrl = makeController({
			setDefaultAddress: vi.fn().mockResolvedValue(address),
		});
		const result = (await call(setDefaultAddressHandler, {
			params: { customerId: "cust-10", addressId: "addr-4" },
			controller: ctrl,
		})) as { address: CustomerAddress };
		expect(result.address.isDefault).toBe(true);
		expect(ctrl.setDefaultAddress).toHaveBeenCalledWith("cust-10", "addr-4");
	});

	it("returns 404 when address not found", async () => {
		const result = (await call(setDefaultAddressHandler, {
			params: { customerId: "cust-10", addressId: "addr-missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Address not found");
	});
});

// ── adminGetLoyaltyBalance ────────────────────────────────────────────────────

describe("admin GET /admin/customers/:id/loyalty", () => {
	it("returns loyalty balance for customer", async () => {
		const balance = makeBalance({
			customerId: "cust-11",
			balance: 250,
			totalEarned: 300,
			totalRedeemed: 50,
			transactionCount: 5,
		});
		const ctrl = makeController({
			getLoyaltyBalance: vi.fn().mockResolvedValue(balance),
		});
		const result = (await call(getLoyaltyBalanceHandler, {
			params: { id: "cust-11" },
			controller: ctrl,
		})) as { balance: LoyaltyBalance };
		expect(result.balance.balance).toBe(250);
		expect(result.balance.totalEarned).toBe(300);
		expect(ctrl.getLoyaltyBalance).toHaveBeenCalledWith("cust-11");
	});

	it("returns zero balance for customer with no transactions", async () => {
		const result = (await call(getLoyaltyBalanceHandler, {
			params: { id: "new-cust" },
		})) as { balance: LoyaltyBalance };
		expect(result.balance.balance).toBe(0);
		expect(result.balance.transactionCount).toBe(0);
	});
});

// ── adminGetLoyaltyHistory ────────────────────────────────────────────────────

describe("admin GET /admin/customers/:id/loyalty/history", () => {
	it("returns loyalty transaction history with total", async () => {
		const transactions = [
			makeTransaction({ customerId: "cust-12" }),
			makeTransaction({ customerId: "cust-12", type: "redeem", points: 50 }),
		];
		const ctrl = makeController({
			getLoyaltyHistory: vi.fn().mockResolvedValue({ transactions, total: 2 }),
		});
		const result = (await call(getLoyaltyHistoryHandler, {
			params: { id: "cust-12" },
			controller: ctrl,
		})) as { transactions: LoyaltyTransaction[]; total: number };
		expect(result.transactions).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(ctrl.getLoyaltyHistory).toHaveBeenCalledWith(
			"cust-12",
			expect.any(Object),
		);
	});

	it("returns empty history for customer with no transactions", async () => {
		const result = (await call(getLoyaltyHistoryHandler, {
			params: { id: "no-txns" },
		})) as { transactions: LoyaltyTransaction[]; total: number };
		expect(result.transactions).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

// ── adminEarnPoints ───────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:id/loyalty/earn", () => {
	it("earns points for customer and returns transaction", async () => {
		const txn = makeTransaction({
			customerId: "cust-13",
			type: "earn",
			points: 200,
			balance: 200,
			reason: "Referral bonus",
		});
		const ctrl = makeController({
			earnPoints: vi.fn().mockResolvedValue(txn),
		});
		const result = (await call(earnPointsHandler, {
			params: { id: "cust-13" },
			body: { points: 200, reason: "Referral bonus" },
			controller: ctrl,
		})) as { transaction: LoyaltyTransaction };
		expect(result.transaction.points).toBe(200);
		expect(result.transaction.type).toBe("earn");
		expect(ctrl.earnPoints).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: "cust-13",
				points: 200,
				reason: "Referral bonus",
			}),
		);
	});

	it("passes orderId when provided", async () => {
		const ctrl = makeController();
		await call(earnPointsHandler, {
			params: { id: "cust-13" },
			body: { points: 50, reason: "Order reward", orderId: "order-abc" },
			controller: ctrl,
		});
		expect(ctrl.earnPoints).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order-abc" }),
		);
	});
});

// ── adminRedeemPoints ─────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:id/loyalty/redeem", () => {
	it("redeems points for customer and returns transaction", async () => {
		const txn = makeTransaction({
			customerId: "cust-14",
			type: "redeem",
			points: 100,
			balance: 150,
			reason: "Coupon applied",
		});
		const ctrl = makeController({
			redeemPoints: vi.fn().mockResolvedValue(txn),
		});
		const result = (await call(redeemPointsHandler, {
			params: { id: "cust-14" },
			body: { points: 100, reason: "Coupon applied" },
			controller: ctrl,
		})) as { transaction: LoyaltyTransaction };
		expect(result.transaction.type).toBe("redeem");
		expect(result.transaction.points).toBe(100);
		expect(ctrl.redeemPoints).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: "cust-14",
				points: 100,
				reason: "Coupon applied",
			}),
		);
	});

	it("passes orderId when provided", async () => {
		const ctrl = makeController();
		await call(redeemPointsHandler, {
			params: { id: "cust-14" },
			body: { points: 25, reason: "Discount", orderId: "order-xyz" },
			controller: ctrl,
		});
		expect(ctrl.redeemPoints).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order-xyz" }),
		);
	});
});

// ── adminAdjustPoints ─────────────────────────────────────────────────────────

describe("admin POST /admin/customers/:id/loyalty/adjust", () => {
	it("adjusts points for customer and returns transaction", async () => {
		const txn = makeTransaction({
			customerId: "cust-15",
			type: "adjust",
			points: 50,
			balance: 50,
			reason: "Admin correction",
		});
		const ctrl = makeController({
			adjustPoints: vi.fn().mockResolvedValue(txn),
		});
		const result = (await call(adjustPointsHandler, {
			params: { id: "cust-15" },
			body: { points: 50, reason: "Admin correction" },
			controller: ctrl,
		})) as { transaction: LoyaltyTransaction };
		expect(result.transaction.type).toBe("adjust");
		expect(result.transaction.points).toBe(50);
		expect(ctrl.adjustPoints).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: "cust-15",
				points: 50,
				reason: "Admin correction",
			}),
		);
	});

	it("supports negative adjustment for deduction", async () => {
		const txn = makeTransaction({
			customerId: "cust-15",
			type: "adjust",
			points: -30,
			balance: 70,
			reason: "Correction",
		});
		const ctrl = makeController({
			adjustPoints: vi.fn().mockResolvedValue(txn),
		});
		const result = (await call(adjustPointsHandler, {
			params: { id: "cust-15" },
			body: { points: -30, reason: "Correction" },
			controller: ctrl,
		})) as { transaction: LoyaltyTransaction };
		expect(result.transaction.points).toBe(-30);
		expect(ctrl.adjustPoints).toHaveBeenCalledWith(
			expect.objectContaining({ points: -30 }),
		);
	});
});

// ── adminGetLoyaltyStats ──────────────────────────────────────────────────────

describe("admin GET /admin/customers/loyalty/stats", () => {
	it("returns zero-state stats when no loyalty activity exists", async () => {
		const result = (await call(getLoyaltyStatsHandler)) as {
			stats: LoyaltyStats;
		};
		expect(result.stats.totalCustomersWithPoints).toBe(0);
		expect(result.stats.totalPointsIssued).toBe(0);
		expect(result.stats.totalPointsOutstanding).toBe(0);
		expect(result.stats.topCustomers).toHaveLength(0);
	});

	it("returns real stats from controller", async () => {
		const stats = makeStats({
			totalCustomersWithPoints: 42,
			totalPointsIssued: 10000,
			totalPointsRedeemed: 2500,
			totalPointsOutstanding: 7500,
			averageBalance: 178,
			topCustomers: [
				{
					customerId: "c1",
					email: "top@test.com",
					name: "Top Customer",
					balance: 500,
				},
			],
		});
		const ctrl = makeController({
			getLoyaltyStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(getLoyaltyStatsHandler, {
			controller: ctrl,
		})) as {
			stats: LoyaltyStats;
		};
		expect(result.stats.totalCustomersWithPoints).toBe(42);
		expect(result.stats.totalPointsIssued).toBe(10000);
		expect(result.stats.topCustomers).toHaveLength(1);
		expect(result.stats.topCustomers[0]?.email).toBe("top@test.com");
	});
});
