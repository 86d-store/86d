import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

/**
 * Store endpoint integration tests for the customers module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-me / update-me derive userId from session, never from request
 * 2. Address CRUD is scoped to the authenticated customer
 * 3. update-address / delete-address verify ownership (customerId match)
 *    and return 404 (not 403) to avoid leaking address existence
 * 4. list-addresses only returns the current user's addresses
 * 5. create-address assigns customerId from session
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ────────────────────────────────────

async function simulateGetMe(
	data: DataService,
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);
	const customer = await controller.getById(session.userId);
	if (!customer) {
		return { error: "Customer not found", status: 404 };
	}

	return { customer };
}

async function simulateUpdateMe(
	data: DataService,
	body: {
		firstName?: string;
		lastName?: string;
		phone?: string | null;
	},
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);
	const customer = await controller.update(session.userId, body);
	if (!customer) {
		return { error: "Customer not found", status: 404 };
	}

	return { customer };
}

async function simulateListAddresses(
	data: DataService,
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);
	const addresses = await controller.listAddresses(session.userId);
	return { addresses };
}

async function simulateCreateAddress(
	data: DataService,
	body: {
		firstName: string;
		lastName: string;
		line1: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		type?: "billing" | "shipping";
		isDefault?: boolean;
	},
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);
	const address = await controller.createAddress({
		customerId: session.userId,
		...body,
	});
	return { address };
}

async function simulateUpdateAddress(
	data: DataService,
	addressId: string,
	body: {
		firstName?: string;
		lastName?: string;
		line1?: string;
		city?: string;
	},
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);

	// Verify ownership (mirrors update-address.ts lines 44-48)
	const existing = await controller.getAddress(addressId);
	if (!existing || existing.customerId !== session.userId) {
		return { error: "Address not found", status: 404 };
	}

	const address = await controller.updateAddress(addressId, body);
	return { address };
}

async function simulateDeleteAddress(
	data: DataService,
	addressId: string,
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createCustomerController(data);

	// Verify ownership (mirrors delete-address.ts lines 19-22)
	const existing = await controller.getAddress(addressId);
	if (!existing || existing.customerId !== session.userId) {
		return { error: "Address not found", status: 404 };
	}

	await controller.deleteAddress(addressId);
	return { success: true };
}

// ── Helpers ──────────────────────────────────────────────────────────

async function seedCustomer(
	data: DataService,
	id: string,
	overrides: Partial<{
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
	}> = {},
) {
	const controller = createCustomerController(data);
	return controller.create({
		id,
		email: overrides.email ?? `${id}@example.com`,
		firstName: overrides.firstName ?? "Test",
		lastName: overrides.lastName ?? "User",
		...(overrides.phone !== undefined ? { phone: overrides.phone } : {}),
	});
}

function addressParams(
	overrides: Partial<{
		firstName: string;
		lastName: string;
		line1: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		type: "billing" | "shipping";
	}> = {},
) {
	return {
		firstName: "John",
		lastName: "Doe",
		line1: "123 Main St",
		city: "Austin",
		state: "TX",
		postalCode: "78701",
		country: "US",
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("store endpoint: get-me", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateGetMe(data, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns customer profile for authenticated user", async () => {
		await seedCustomer(data, "cust_1", {
			firstName: "Alice",
			lastName: "Smith",
			email: "alice@example.com",
		});

		const result = await simulateGetMe(data, { userId: "cust_1" });
		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.firstName).toBe("Alice");
			expect(result.customer.lastName).toBe("Smith");
			expect(result.customer.email).toBe("alice@example.com");
		}
	});

	it("returns 404 when customer record does not exist", async () => {
		const result = await simulateGetMe(data, { userId: "nonexistent" });
		expect(result).toEqual({ error: "Customer not found", status: 404 });
	});

	it("cannot access another customer's profile", async () => {
		await seedCustomer(data, "cust_1");
		await seedCustomer(data, "cust_2");

		// cust_1's session only returns cust_1's data
		const result = await simulateGetMe(data, { userId: "cust_1" });
		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.id).toBe("cust_1");
		}
	});
});

describe("store endpoint: update-me", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateUpdateMe(data, { firstName: "New" }, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("updates customer name", async () => {
		await seedCustomer(data, "cust_1", {
			firstName: "Alice",
			lastName: "Smith",
		});

		const result = await simulateUpdateMe(
			data,
			{ firstName: "Bob", lastName: "Jones" },
			{ userId: "cust_1" },
		);

		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.firstName).toBe("Bob");
			expect(result.customer.lastName).toBe("Jones");
		}
	});

	it("updates phone number", async () => {
		await seedCustomer(data, "cust_1");

		const result = await simulateUpdateMe(
			data,
			{ phone: "+1-555-0100" },
			{ userId: "cust_1" },
		);

		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.phone).toBe("+1-555-0100");
		}
	});

	it("clears phone number with null", async () => {
		await seedCustomer(data, "cust_1", { phone: "+1-555-0100" });

		const result = await simulateUpdateMe(
			data,
			{ phone: null },
			{ userId: "cust_1" },
		);

		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.phone).toBeUndefined();
		}
	});

	it("returns 404 for nonexistent customer", async () => {
		const result = await simulateUpdateMe(
			data,
			{ firstName: "Ghost" },
			{ userId: "nonexistent" },
		);
		expect(result).toEqual({ error: "Customer not found", status: 404 });
	});
});

describe("store endpoint: create-address — session-derived customerId", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateCreateAddress(data, addressParams(), null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("creates address with customerId from session", async () => {
		const result = await simulateCreateAddress(
			data,
			addressParams({ firstName: "Alice", lastName: "Smith" }),
			{ userId: "cust_1" },
		);

		expect("address" in result).toBe(true);
		if ("address" in result) {
			expect(result.address.customerId).toBe("cust_1");
			expect(result.address.firstName).toBe("Alice");
			expect(result.address.lastName).toBe("Smith");
			expect(result.address.city).toBe("Austin");
			expect(result.address.state).toBe("TX");
			expect(result.address.country).toBe("US");
		}
	});

	it("defaults type to shipping", async () => {
		const result = await simulateCreateAddress(data, addressParams(), {
			userId: "cust_1",
		});

		expect("address" in result).toBe(true);
		if ("address" in result) {
			expect(result.address.type).toBe("shipping");
		}
	});

	it("allows specifying billing type", async () => {
		const result = await simulateCreateAddress(
			data,
			addressParams({ type: "billing" }),
			{ userId: "cust_1" },
		);

		expect("address" in result).toBe(true);
		if ("address" in result) {
			expect(result.address.type).toBe("billing");
		}
	});
});

describe("store endpoint: list-addresses — customer scoping", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateListAddresses(data, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns only addresses belonging to the authenticated customer", async () => {
		// Create addresses for cust_1
		await simulateCreateAddress(data, addressParams({ firstName: "Home" }), {
			userId: "cust_1",
		});
		await simulateCreateAddress(data, addressParams({ firstName: "Work" }), {
			userId: "cust_1",
		});

		// Create address for cust_2
		await simulateCreateAddress(data, addressParams({ firstName: "Other" }), {
			userId: "cust_2",
		});

		const result = await simulateListAddresses(data, { userId: "cust_1" });

		expect("addresses" in result).toBe(true);
		if ("addresses" in result) {
			expect(result.addresses).toHaveLength(2);
			expect(
				result.addresses.every(
					(a: { customerId: string }) => a.customerId === "cust_1",
				),
			).toBe(true);
		}
	});

	it("returns empty array for customer with no addresses", async () => {
		const result = await simulateListAddresses(data, {
			userId: "cust_empty",
		});

		expect("addresses" in result).toBe(true);
		if ("addresses" in result) {
			expect(result.addresses).toHaveLength(0);
		}
	});

	it("does not expose other customers' addresses", async () => {
		await simulateCreateAddress(data, addressParams({ firstName: "Secret" }), {
			userId: "cust_other",
		});

		const result = await simulateListAddresses(data, { userId: "cust_1" });

		expect("addresses" in result).toBe(true);
		if ("addresses" in result) {
			expect(result.addresses).toHaveLength(0);
		}
	});
});

describe("store endpoint: update-address — ownership verification", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateUpdateAddress(
			data,
			"any_id",
			{ firstName: "New" },
			null,
		);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("updates address owned by the session user", async () => {
		const created = await simulateCreateAddress(
			data,
			addressParams({ firstName: "Old" }),
			{ userId: "cust_1" },
		);

		expect("address" in created).toBe(true);
		if ("address" in created) {
			const result = await simulateUpdateAddress(
				data,
				created.address.id,
				{ firstName: "Updated", city: "Dallas" },
				{ userId: "cust_1" },
			);

			expect("address" in result).toBe(true);
			if ("address" in result && result.address) {
				expect(result.address.firstName).toBe("Updated");
				expect(result.address.city).toBe("Dallas");
			}
		}
	});

	it("returns 404 when trying to update another customer's address", async () => {
		const created = await simulateCreateAddress(data, addressParams(), {
			userId: "cust_1",
		});

		expect("address" in created).toBe(true);
		if ("address" in created) {
			const result = await simulateUpdateAddress(
				data,
				created.address.id,
				{ firstName: "Hacked" },
				{ userId: "cust_attacker" },
			);

			// Returns 404, not 403 — prevents leaking address existence
			expect(result).toEqual({ error: "Address not found", status: 404 });
		}
	});

	it("returns 404 for nonexistent address ID", async () => {
		const result = await simulateUpdateAddress(
			data,
			"nonexistent",
			{ firstName: "Ghost" },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({ error: "Address not found", status: 404 });
	});
});

describe("store endpoint: delete-address — ownership verification", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without session", async () => {
		const result = await simulateDeleteAddress(data, "any_id", null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("deletes address owned by the session user", async () => {
		const created = await simulateCreateAddress(data, addressParams(), {
			userId: "cust_1",
		});

		expect("address" in created).toBe(true);
		if ("address" in created) {
			const result = await simulateDeleteAddress(data, created.address.id, {
				userId: "cust_1",
			});

			expect(result).toEqual({ success: true });

			// Verify it's gone
			const list = await simulateListAddresses(data, { userId: "cust_1" });
			expect("addresses" in list).toBe(true);
			if ("addresses" in list) {
				expect(list.addresses).toHaveLength(0);
			}
		}
	});

	it("returns 404 when trying to delete another customer's address", async () => {
		const created = await simulateCreateAddress(data, addressParams(), {
			userId: "cust_1",
		});

		expect("address" in created).toBe(true);
		if ("address" in created) {
			const result = await simulateDeleteAddress(data, created.address.id, {
				userId: "cust_attacker",
			});

			// Returns 404, not 403
			expect(result).toEqual({ error: "Address not found", status: 404 });

			// Address should still exist for the real owner
			const list = await simulateListAddresses(data, { userId: "cust_1" });
			expect("addresses" in list).toBe(true);
			if ("addresses" in list) {
				expect(list.addresses).toHaveLength(1);
			}
		}
	});

	it("returns 404 for nonexistent address ID", async () => {
		const result = await simulateDeleteAddress(data, "nonexistent", {
			userId: "cust_1",
		});

		expect(result).toEqual({ error: "Address not found", status: 404 });
	});

	it("does not affect other addresses when deleting one", async () => {
		await simulateCreateAddress(data, addressParams({ firstName: "Home" }), {
			userId: "cust_1",
		});
		const work = await simulateCreateAddress(
			data,
			addressParams({ firstName: "Work" }),
			{ userId: "cust_1" },
		);

		expect("address" in work).toBe(true);
		if ("address" in work) {
			await simulateDeleteAddress(data, work.address.id, {
				userId: "cust_1",
			});

			const list = await simulateListAddresses(data, { userId: "cust_1" });
			expect("addresses" in list).toBe(true);
			if ("addresses" in list) {
				expect(list.addresses).toHaveLength(1);
				expect(list.addresses[0].firstName).toBe("Home");
			}
		}
	});
});

describe("store endpoint: cross-endpoint flows", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("create address then update then delete lifecycle", async () => {
		const session = { userId: "cust_1" };

		// Create
		const created = await simulateCreateAddress(
			data,
			addressParams({ firstName: "Original" }),
			session,
		);
		expect("address" in created).toBe(true);

		if ("address" in created) {
			// Update
			const updated = await simulateUpdateAddress(
				data,
				created.address.id,
				{ firstName: "Modified" },
				session,
			);
			expect("address" in updated).toBe(true);
			if ("address" in updated && updated.address) {
				expect(updated.address.firstName).toBe("Modified");
			}

			// Delete
			const deleted = await simulateDeleteAddress(
				data,
				created.address.id,
				session,
			);
			expect(deleted).toEqual({ success: true });

			// Verify gone
			const list = await simulateListAddresses(data, session);
			expect("addresses" in list).toBe(true);
			if ("addresses" in list) {
				expect(list.addresses).toHaveLength(0);
			}
		}
	});

	it("update profile then verify via get-me", async () => {
		await seedCustomer(data, "cust_1", {
			firstName: "Alice",
			lastName: "Smith",
		});

		await simulateUpdateMe(
			data,
			{ firstName: "Bob", phone: "+1-555-0100" },
			{ userId: "cust_1" },
		);

		const result = await simulateGetMe(data, { userId: "cust_1" });
		expect("customer" in result).toBe(true);
		if ("customer" in result) {
			expect(result.customer.firstName).toBe("Bob");
			expect(result.customer.lastName).toBe("Smith"); // unchanged
			expect(result.customer.phone).toBe("+1-555-0100");
		}
	});
});
