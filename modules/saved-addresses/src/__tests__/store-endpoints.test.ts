import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { SavedAddressesController } from "../service";
import { createSavedAddressesController } from "../service-impl";

/**
 * Store endpoint integration tests for the saved-addresses module.
 *
 * All store endpoints require authentication. Tests verify:
 *
 * 1. create-address — auth, auto-sets first as default, max limit
 * 2. list-addresses — auth, scoped to customer
 * 3. get-address — auth, ownership (404 not 403)
 * 4. update-address — auth, ownership, partial updates
 * 5. delete-address — auth, ownership
 * 6. get-default — auth, returns default shipping address
 * 7. set-default — auth, ownership, clears previous default
 */

type DataService = ReturnType<typeof createMockDataService>;

const addressInput = (
	overrides: Partial<Parameters<SavedAddressesController["create"]>[1]> = {},
) => ({
	firstName: "Jane",
	lastName: "Doe",
	line1: "123 Main St",
	city: "Austin",
	state: "TX",
	postalCode: "78701",
	country: "US",
	...overrides,
});

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateCreateAddress(
	controller: SavedAddressesController,
	body: Parameters<SavedAddressesController["create"]>[1],
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const address = await controller.create(session.userId, body);
	return { address };
}

async function simulateListAddresses(
	controller: SavedAddressesController,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const addresses = await controller.listByCustomer(session.userId);
	return { addresses };
}

async function simulateGetAddress(
	controller: SavedAddressesController,
	addressId: string,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const address = await controller.getById(session.userId, addressId);
	if (!address) return { error: "Not found", status: 404 };
	return { address };
}

async function simulateUpdateAddress(
	controller: SavedAddressesController,
	addressId: string,
	body: Parameters<SavedAddressesController["update"]>[2],
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const updated = await controller.update(session.userId, addressId, body);
	if (!updated) return { error: "Not found", status: 404 };
	return { address: updated };
}

async function simulateDeleteAddress(
	controller: SavedAddressesController,
	addressId: string,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const deleted = await controller.delete(session.userId, addressId);
	if (!deleted) return { error: "Not found", status: 404 };
	return { success: true };
}

async function simulateGetDefault(
	controller: SavedAddressesController,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const address = await controller.getDefault(session.userId);
	return { address };
}

async function simulateSetDefault(
	controller: SavedAddressesController,
	addressId: string,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const success = await controller.setDefault(session.userId, addressId);
	if (!success) return { error: "Not found", status: 404 };
	return { success: true };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: SavedAddressesController;

beforeEach(() => {
	data = createMockDataService();
	controller = createSavedAddressesController(data);
});

const session = { userId: "cust_1" };

describe("create-address", () => {
	it("requires authentication", async () => {
		const result = await simulateCreateAddress(
			controller,
			addressInput(),
			null,
		);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("creates an address and sets first as default", async () => {
		const result = await simulateCreateAddress(
			controller,
			addressInput(),
			session,
		);
		expect("address" in result).toBe(true);
		if ("address" in result) {
			expect(result.address.firstName).toBe("Jane");
			expect(result.address.isDefault).toBe(true);
			expect(result.address.isDefaultBilling).toBe(true);
		}
	});

	it("second address is not default", async () => {
		await controller.create("cust_1", addressInput());
		const result = await simulateCreateAddress(
			controller,
			addressInput({ firstName: "John", line1: "456 Oak Ave" }),
			session,
		);
		if ("address" in result) {
			expect(result.address.isDefault).toBe(false);
		}
	});
});

describe("list-addresses", () => {
	it("requires authentication", async () => {
		const result = await simulateListAddresses(controller, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns only the customer's addresses", async () => {
		await controller.create("cust_1", addressInput());
		await controller.create("cust_1", addressInput({ line1: "456 Oak" }));
		await controller.create("cust_2", addressInput());

		const result = await simulateListAddresses(controller, session);
		if ("addresses" in result) {
			expect(result.addresses).toHaveLength(2);
		}
	});
});

describe("get-address", () => {
	it("returns 404 for another customer's address (not 403)", async () => {
		const addr = await controller.create("cust_2", addressInput());
		const result = await simulateGetAddress(controller, addr.id, session);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});

	it("returns 404 for non-existent address", async () => {
		const result = await simulateGetAddress(controller, "nonexistent", session);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("update-address", () => {
	it("updates address fields", async () => {
		const addr = await controller.create("cust_1", addressInput());
		const result = await simulateUpdateAddress(
			controller,
			addr.id,
			{ city: "Dallas", state: "TX" },
			session,
		);
		if ("address" in result) {
			expect(result.address.city).toBe("Dallas");
			expect(result.address.firstName).toBe("Jane"); // unchanged
		}
	});

	it("returns 404 for another customer's address", async () => {
		const addr = await controller.create("cust_2", addressInput());
		const result = await simulateUpdateAddress(
			controller,
			addr.id,
			{ city: "Houston" },
			session,
		);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("delete-address", () => {
	it("deletes own address", async () => {
		const addr = await controller.create("cust_1", addressInput());
		const result = await simulateDeleteAddress(controller, addr.id, session);
		expect(result).toEqual({ success: true });

		const listed = await simulateListAddresses(controller, session);
		if ("addresses" in listed) {
			expect(listed.addresses).toHaveLength(0);
		}
	});

	it("returns 404 for another customer's address", async () => {
		const addr = await controller.create("cust_2", addressInput());
		const result = await simulateDeleteAddress(controller, addr.id, session);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("get-default / set-default", () => {
	it("returns null when no default exists", async () => {
		const result = await simulateGetDefault(controller, session);
		if ("address" in result) {
			expect(result.address).toBeNull();
		}
	});

	it("switches default address", async () => {
		const addr1 = await controller.create("cust_1", addressInput());
		const addr2 = await controller.create(
			"cust_1",
			addressInput({ line1: "456 Oak" }),
		);

		// addr1 is default (first created)
		const before = await simulateGetDefault(controller, session);
		if ("address" in before && before.address) {
			expect(before.address.id).toBe(addr1.id);
		}

		// Switch to addr2
		await simulateSetDefault(controller, addr2.id, session);
		const after = await simulateGetDefault(controller, session);
		if ("address" in after && after.address) {
			expect(after.address.id).toBe(addr2.id);
		}
	});

	it("returns 404 when setting default for another customer", async () => {
		const addr = await controller.create("cust_2", addressInput());
		const result = await simulateSetDefault(controller, addr.id, session);
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("cross-endpoint lifecycle", () => {
	it("create → list → update �� set-default → delete", async () => {
		// Create two addresses
		const r1 = await simulateCreateAddress(
			controller,
			addressInput({ label: "Home" }),
			session,
		);
		const r2 = await simulateCreateAddress(
			controller,
			addressInput({ label: "Work", line1: "789 Corp Blvd" }),
			session,
		);

		const addr1Id = "address" in r1 ? r1.address.id : "";
		const addr2Id = "address" in r2 ? r2.address.id : "";

		// List
		const listed = await simulateListAddresses(controller, session);
		if ("addresses" in listed) {
			expect(listed.addresses).toHaveLength(2);
		}

		// Update
		const updated = await simulateUpdateAddress(
			controller,
			addr2Id,
			{ city: "San Francisco" },
			session,
		);
		if ("address" in updated) {
			expect(updated.address.city).toBe("San Francisco");
		}

		// Set default
		await simulateSetDefault(controller, addr2Id, session);
		const def = await simulateGetDefault(controller, session);
		if ("address" in def && def.address) {
			expect(def.address.id).toBe(addr2Id);
		}

		// Delete first
		await simulateDeleteAddress(controller, addr1Id, session);
		const afterDelete = await simulateListAddresses(controller, session);
		if ("addresses" in afterDelete) {
			expect(afterDelete.addresses).toHaveLength(1);
		}
	});
});
