import { describe, expect, it, vi } from "vitest";
import { addressSummary } from "../admin/endpoints/address-summary";
import { adminDeleteAddress } from "../admin/endpoints/delete-address";
import { listAllAddresses } from "../admin/endpoints/list-all-addresses";
import type {
	Address,
	AddressSummary,
	SavedAddressesController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAddress(overrides: Partial<Address> = {}): Address {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust-1",
		firstName: "Jane",
		lastName: "Doe",
		line1: "123 Main St",
		city: "Springfield",
		postalCode: "12345",
		country: "US",
		isDefault: false,
		isDefaultBilling: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<SavedAddressesController> = {},
): SavedAddressesController {
	const defaultSummary: AddressSummary = {
		totalAddresses: 0,
		countryCounts: [],
	};
	return {
		create: vi.fn().mockResolvedValue(makeAddress()),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		getById: vi.fn().mockResolvedValue(null),
		listByCustomer: vi.fn().mockResolvedValue([]),
		getDefault: vi.fn().mockResolvedValue(null),
		getDefaultBilling: vi.fn().mockResolvedValue(null),
		setDefault: vi.fn().mockResolvedValue(false),
		setDefaultBilling: vi.fn().mockResolvedValue(false),
		countByCustomer: vi.fn().mockResolvedValue(0),
		listAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		getSummary: vi.fn().mockResolvedValue(defaultSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SavedAddressesController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { savedAddresses: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listAllAddresses);
const deleteHandler = extractHandler(adminDeleteAddress);
const summaryHandler = extractHandler(addressSummary);

describe("admin GET /saved-addresses", () => {
	it("returns empty items and zero total", async () => {
		const result = (await call(listHandler)) as {
			items: Address[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards country filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { country: "CA" }, controller: ctrl });
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({ country: "CA" }),
		);
	});
});

describe("admin POST /saved-addresses/:id/delete", () => {
	it("returns 404 when address not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
			body: { customerId: "cust-1" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success when address is deleted", async () => {
		const ctrl = makeController({ delete: vi.fn().mockResolvedValue(true) });
		const result = (await call(deleteHandler, {
			params: { id: "addr-1" },
			body: { customerId: "cust-1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /saved-addresses/summary", () => {
	it("returns summary with zero totals", async () => {
		const result = (await call(summaryHandler)) as AddressSummary;
		expect(result.totalAddresses).toBe(0);
	});

	it("returns real summary stats", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalAddresses: 42,
				countryCounts: [{ country: "US", count: 30 }],
			}),
		});
		const result = (await call(summaryHandler, {
			controller: ctrl,
		})) as AddressSummary;
		expect(result.totalAddresses).toBe(42);
		expect(result.countryCounts).toHaveLength(1);
	});
});
